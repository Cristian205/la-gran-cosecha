"""
La migración de reglas de cantidad (catalog 0011–0013) sobre datos que YA
existen: no borra, no cambia precios ni estados, y cada presentación hereda
exactamente la regla de cantidad que tenía su producto.
"""
from decimal import Decimal

import pytest
from django.db import connection
from django.db.migrations.executor import MigrationExecutor

ANTES = [("catalog", "0010_imagen_por_presentacion")]
DESPUES = [("catalog", "0013_indice_y_restricciones_presentacion")]


@pytest.mark.django_db(transaction=True)
def test_la_migracion_conserva_los_productos_existentes():
    executor = MigrationExecutor(connection)
    executor.migrate(ANTES)
    viejas = executor.loader.project_state(ANTES).apps

    Tenant = viejas.get_model("tenancy", "Tenant")
    Categoria = viejas.get_model("catalog", "Categoria")
    Unidad = viejas.get_model("catalog", "UnidadMedida")
    Producto = viejas.get_model("catalog", "Producto")
    Presentacion = viejas.get_model("catalog", "PresentacionProducto")

    tenant = Tenant.objects.create(slug="migracion", nombre="Migración", estado="ACTIVO")
    cat = Categoria.objects.create(tenant=tenant, nombre_categoria="Frutas", abreviatura="FRU")
    kg = Unidad.objects.create(tenant=tenant, nombre_unidad="Kilogramo", abreviatura_unidad="kg")

    def producto(nombre, codigo, orden, fraccion, tipo):
        return Producto.objects.create(
            tenant=tenant, nombre_producto=nombre, codigo_producto=codigo, slug=codigo.lower(),
            orden=orden, categoria=cat, permite_fraccion=fraccion, tipo_cantidad=tipo,
        )

    entero = producto("Piña", "FRU-001", 1, False, "entero")
    medio = producto("Papa", "FRU-002", 2, True, "medio")
    cuarto = producto("Queso", "FRU-003", 3, True, "cuarto")
    # Dato incoherente pero posible: "cuartos" sin permitir fracción = entero.
    raro = producto("Mango", "FRU-004", 4, False, "cuarto")

    def pres(prod, nombre, precio, activa=True):
        return Presentacion.objects.create(
            tenant=tenant, producto=prod, nombre_presentacion=nombre, unidad_venta=kg,
            precio_unitario=Decimal(precio), factor_conversion=Decimal("1"),
            estado_presentacion=activa, imagen="tenants/x/foto.png",
        )

    p_entero = pres(entero, "Unidad", "3500")
    p_medio_b = pres(medio, "Bulto", "90000")
    p_medio_a = pres(medio, "Libra", "1200", activa=False)
    p_cuarto = pres(cuarto, "Libra", "8000")
    p_raro = pres(raro, "Kilo", "0")
    antes = {
        p.id: (p.nombre_presentacion, p.precio_unitario, p.estado_presentacion, p.imagen.name)
        for p in Presentacion.objects.all()
    }

    executor = MigrationExecutor(connection)
    executor.loader.build_graph()
    executor.migrate(DESPUES)
    nuevas = executor.loader.project_state(DESPUES).apps
    Presentacion = nuevas.get_model("catalog", "PresentacionProducto")

    despues = {p.id: p for p in Presentacion.objects.all()}
    assert set(despues) == set(antes)
    for pid, (nombre, precio, activa, imagen) in antes.items():
        p = despues[pid]
        assert (p.nombre_presentacion, p.precio_unitario, p.estado_presentacion, p.imagen.name) == (
            nombre, precio, activa, imagen,
        )

    def regla(p):
        x = despues[p.id]
        return (x.cantidad_minima, x.incremento_cantidad, x.decimales_cantidad)

    assert regla(p_entero) == (Decimal("1"), Decimal("1"), 0)
    assert regla(p_medio_b) == (Decimal("0.5"), Decimal("0.5"), 1)
    assert regla(p_medio_a) == (Decimal("0.5"), Decimal("0.5"), 1)
    assert regla(p_cuarto) == (Decimal("0.25"), Decimal("0.25"), 2)
    assert regla(p_raro) == (Decimal("1"), Decimal("1"), 0)
    # Orden de alta dentro de cada producto.
    assert (despues[p_medio_b.id].orden, despues[p_medio_a.id].orden) == (0, 1)
    assert all(p.version == 1 for p in despues.values())
