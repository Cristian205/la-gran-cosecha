"""
El dashboard ejecutivo (`/api/admin/analitica/...`).

Protege las reglas de cálculo que el panel promete:

- la venta es lo ENTREGADO y un pendiente nunca suma ventas;
- «nuevo» por primera compra y «nuevo» por registro son cosas distintas, y
  compradores = nuevos por primera compra + recurrentes;
- el período anterior tiene la misma duración y, si el período llega a ahora,
  se corta a la misma hora;
- las cantidades de presentaciones distintas solo se suman cuando el catálogo
  dice cómo convertirlas;
- los listados con nombres de clientes o pedidos respetan los permisos.
"""
from datetime import datetime, time, timedelta
from decimal import Decimal

import pytest
from django.utils import timezone

from apps.catalog.models import Categoria, PresentacionProducto, Producto, UnidadMedida
from apps.orders import analitica
from apps.orders.models import Cliente, DetallePedido, Pedido

pytestmark = pytest.mark.django_db

BASE = "/api/admin/analitica"


def _momento(dia, hora=12):
    return timezone.make_aware(datetime.combine(dia, time(hora)), timezone.get_current_timezone())


def _cliente(nombre, registrado):
    cliente = Cliente.objects.create(nombre_cliente=nombre)
    Cliente.objects.filter(pk=cliente.pk).update(fecha_registro_cliente=_momento(registrado))
    return cliente


def _pedido(cliente, dia, lineas, estado="ENTREGADO", hora=12):
    pedido = Pedido.objects.create(cliente=cliente, estado=estado)
    for presentacion, cantidad in lineas:
        DetallePedido.objects.create(pedido=pedido, presentacion=presentacion, cantidad=cantidad)
    pedido.actualizar_total()
    # `fecha_pedido` es auto_now_add: se mueve después, como un pedido real de ese día.
    Pedido.objects.filter(pk=pedido.pk).update(fecha_pedido=_momento(dia, hora))
    return pedido


@pytest.fixture
def dia():
    """El último día del período de prueba: en el pasado, para que nada se recorte."""
    return timezone.localdate() - timedelta(days=10)


@pytest.fixture
def catalogo(negocio):
    kg = UnidadMedida.objects.create(nombre_unidad="Kilogramo", abreviatura_unidad="kg")
    und = UnidadMedida.objects.create(nombre_unidad="Unidad", abreviatura_unidad="und")
    frutas = Categoria.objects.create(nombre_categoria="Frutas", abreviatura="FRU", orden=1)
    tuberculos = Categoria.objects.create(nombre_categoria="Tubérculos", abreviatura="TUB", orden=2)

    papa = Producto.objects.create(nombre_producto="Papa pastusa", categoria=tuberculos, unidad_base=kg)
    piña = Producto.objects.create(nombre_producto="Piña", categoria=frutas)  # sin unidad base
    return {
        "frutas": frutas,
        "tuberculos": tuberculos,
        "bulto": PresentacionProducto.objects.create(
            producto=papa, nombre_presentacion="Bulto 50 kg", unidad_venta=kg,
            factor_conversion=50, precio_unitario=100000,
        ),
        "kilo": PresentacionProducto.objects.create(
            producto=papa, nombre_presentacion="Kilo", unidad_venta=kg,
            factor_conversion=1, precio_unitario=2000,
        ),
        "canastilla": PresentacionProducto.objects.create(
            producto=piña, nombre_presentacion="Canastilla", unidad_venta=und,
            factor_conversion=12, precio_unitario=30000,
        ),
        "unidad": PresentacionProducto.objects.create(
            producto=piña, nombre_presentacion="Unidad", unidad_venta=und,
            factor_conversion=1, precio_unitario=3000,
        ),
    }


@pytest.fixture
def escenario(catalogo, dia):
    """
    Período: los 7 días que terminan en `dia`. Anterior: los 7 de antes.

    - Ana: compró en el período anterior y vuelve a comprar → recurrente.
    - Beto: registrado hace un mes, primera compra en el período, y una
      segunda → nuevo por primera compra (no por registro), 2 compras.
    - Carla: se registra en el período, solo tiene un pedido PENDIENTE →
      nueva por registro, no compradora.
    - Elena: compró hace más de 100 días y nada más → inactiva.
    """
    c = catalogo
    ana = _cliente("Ana", dia - timedelta(days=60))
    beto = _cliente("Beto", dia - timedelta(days=30))
    carla = _cliente("Carla", dia - timedelta(days=3))
    elena = _cliente("Elena", dia - timedelta(days=200))

    _pedido(ana, dia - timedelta(days=10), [(c["kilo"], 40)])  # anterior: 80.000
    _pedido(ana, dia - timedelta(days=2), [(c["bulto"], 1)])  # 100.000
    _pedido(beto, dia - timedelta(days=1), [(c["bulto"], 1), (c["kilo"], 10), (c["canastilla"], 1)])  # 150.000
    _pedido(beto, dia, [(c["unidad"], 10)])  # 30.000
    _pedido(carla, dia - timedelta(days=3), [(c["bulto"], 5)], estado="PENDIENTE")  # no es venta
    _pedido(elena, dia - timedelta(days=110), [(c["kilo"], 5)])
    return {"ana": ana, "beto": beto, "carla": carla, "elena": elena}


def _get(api, modulo, dia, **extra):
    r = api.get(f"{BASE}/{modulo}/", {"desde": dia - timedelta(days=6), "hasta": dia, **extra})
    assert r.status_code == 200, r.json()
    return r.json()


# ==========================================================================
# RESUMEN EJECUTIVO
# ==========================================================================
def test_los_kpi_cuentan_solo_lo_entregado(api_owner, escenario, dia):
    datos = _get(api_owner, "resumen", dia)

    assert datos["ventas"]["total"] == 280000.0
    assert datos["ventas"]["entregados"] == 3
    assert datos["ticket"]["promedio"] == pytest.approx(93333.33)
    # Los pedidos realizados sí incluyen el pendiente.
    assert datos["pedidos"]["total"] == 4
    assert datos["pedidos"]["por_estado"]["PENDIENTE"] == 1
    assert datos["pedidos"]["por_estado"]["ENTREGADO"] == 3
    assert datos["clientes"] == {**datos["clientes"], "activos": 2, "nuevos": 1, "recurrentes": 1}
    # Una cubeta por día, también las vacías.
    assert len(datos["ventas"]["serie"]) == 7
    assert sum(datos["ventas"]["serie"]) == 280000.0
    assert datos["anterior"]["ventas"] == 80000.0
    assert datos["anterior"]["clientes_activos"] == 1
    assert datos["periodo"]["anterior"]["hasta"] == str(dia - timedelta(days=7))


def test_sin_comparar_no_se_calcula_el_anterior(api_owner, escenario, dia):
    datos = _get(api_owner, "resumen", dia, comparar="0")
    assert datos["anterior"] is None
    assert datos["periodo"]["anterior"] is None


def test_sin_entregados_no_hay_ticket(api_owner, negocio, dia):
    datos = _get(api_owner, "resumen", dia)
    assert datos["ticket"]["promedio"] is None
    assert datos["ventas"]["total"] == 0


# ==========================================================================
# VENTAS
# ==========================================================================
def test_la_serie_alinea_el_anterior_en_las_mismas_cubetas(api_owner, escenario, dia):
    datos = _get(api_owner, "ventas", dia)
    serie = datos["serie"]
    # La venta del anterior fue 10 días antes de `dia`: 7 días después cae en
    # la cubeta de `dia - 3`.
    punto = next(p for p in serie if p["inicio"] == str(dia - timedelta(days=3)))
    assert punto["anterior"]["ventas"] == 80000.0
    assert punto["ventas"] == 0

    ind = datos["indicadores"]
    assert ind["dia_mayor_facturacion"]["fecha"] == str(dia - timedelta(days=1))
    assert ind["dia_mayor_facturacion"]["ventas"] == 150000.0
    assert ind["promedio_diario"] == 40000.0
    assert ind["mejor_dia_semana"]["dia"] in analitica.DIAS_SEMANA


@pytest.mark.parametrize(
    "dias,grano,puntos", [(1, "hora", 24), (30, "dia", 30), (90, "semana", None), (200, "mes", None)]
)
def test_el_grano_se_adapta_al_rango(api_owner, negocio, dia, dias, grano, puntos):
    r = api_owner.get(f"{BASE}/ventas/", {"desde": dia - timedelta(days=dias - 1), "hasta": dia}).json()
    assert r["periodo"]["granularidad"] == grano
    if puntos:
        assert len(r["serie"]) == puntos


def test_un_rango_de_mas_de_un_anio_se_rechaza(api_owner, negocio, dia):
    r = api_owner.get(f"{BASE}/ventas/", {"desde": dia - timedelta(days=366), "hasta": dia})
    assert r.status_code == 400


def test_hoy_se_compara_con_ayer_a_la_misma_hora():
    hoy = timezone.localdate()
    ahora = _momento(hoy, 10)
    periodo = analitica.construir_periodo(hoy, hoy, ahora=ahora)
    assert periodo.recortado
    assert periodo.actual.fin == ahora
    assert periodo.anterior.inicio == _momento(hoy - timedelta(days=1), 0)
    assert periodo.anterior.fin == _momento(hoy - timedelta(days=1), 10)
    assert periodo.como_dict()["anterior"]["hasta_hora"] == "10:00"


# ==========================================================================
# CLIENTES
# ==========================================================================
def test_nuevo_por_registro_y_por_primera_compra_no_son_lo_mismo(api_owner, escenario, dia):
    datos = _get(api_owner, "clientes", dia)
    assert datos["registrados"] == 4
    assert datos["nuevos_registro"] == 1  # Carla, que no compró
    assert datos["nuevos_compra"] == 1  # Beto, registrado antes del período
    assert datos["activos"] == 2
    assert datos["recurrentes"] == 1  # Ana
    assert datos["con_compras"] == 3
    assert datos["inactivos"] == 1  # Elena
    assert {f["clave"]: f["clientes"] for f in datos["frecuencia"]} == {"1": 1, "2": 1, "3-4": 0, "5+": 0}
    evolucion = {p["inicio"]: p for p in datos["evolucion"]}
    assert evolucion[str(dia - timedelta(days=1))]["primera_compra"] == 1
    assert evolucion[str(dia - timedelta(days=3))]["registro"] == 1


def test_clientes_destacados(api_owner, escenario, dia):
    datos = _get(api_owner, "clientes-destacados", dia)
    assert [c["nombre"] for c in datos["clientes"]] == ["Beto", "Ana"]
    assert datos["clientes"][0]["pedidos"] == 2
    assert datos["clientes"][0]["participacion"] == pytest.approx(64.3)


# ==========================================================================
# PRODUCTOS Y CATEGORÍAS
# ==========================================================================
def test_las_presentaciones_se_agrupan_sin_mezclar_unidades(api_owner, escenario, dia):
    datos = _get(api_owner, "productos", dia)
    por_nombre = {p["nombre"]: p for p in datos["productos"]}

    papa = por_nombre["Papa pastusa"]
    # 2 bultos de 50 kg + 10 kg: hay unidad base, así que se convierte.
    assert papa["cantidad"] == {"valor": 110.0, "unidad": "kg", "convertida": True}
    assert papa["ingresos"] == 220000.0
    assert papa["frecuencia"] == 2
    # El pedido PENDIENTE de Carla (5 bultos) no cuenta.
    assert sum(d["cantidad"] for d in papa["desglose"]) == 12.0

    pina = por_nombre["Piña"]
    # Sin unidad base no hay conversión: canastillas y unidades van aparte.
    assert pina["cantidad"]["convertida"] is False
    assert {d["presentacion"]: d["cantidad"] for d in pina["desglose"]} == {"Canastilla": 1.0, "Unidad": 10.0}
    assert papa["participacion"] + pina["participacion"] == pytest.approx(100, abs=0.2)


def test_el_ranking_se_ordena_y_filtra_por_categoria(api_owner, escenario, catalogo, dia):
    por_ingresos = _get(api_owner, "productos", dia, orden="ingresos")["productos"]
    assert [p["posicion"] for p in por_ingresos] == [1, 2]
    assert por_ingresos[0]["nombre"] == "Papa pastusa"

    frutas = _get(api_owner, "productos", dia, categoria=catalogo["frutas"].id)["productos"]
    assert [p["nombre"] for p in frutas] == ["Piña"]

    r = api_owner.get(f"{BASE}/productos/", {"orden": "inventado"})
    assert r.status_code == 400


def test_ventas_por_categoria_con_su_anterior(api_owner, escenario, catalogo, dia):
    datos = _get(api_owner, "categorias", dia)
    cats = {c["nombre"]: c for c in datos["categorias"]}
    assert cats["Tubérculos"]["ingresos"] == 220000.0
    assert cats["Tubérculos"]["pedidos"] == 2
    assert cats["Tubérculos"]["anterior"] == 80000.0
    assert cats["Frutas"]["anterior"] == 0.0
    assert datos["categorias"][0]["nombre"] == "Tubérculos"
    assert datos["total"] == 280000.0


# ==========================================================================
# OPERACIÓN Y PERMISOS
# ==========================================================================
def test_resumen_operativo(api_owner, escenario, dia):
    datos = _get(api_owner, "operacion", dia)
    assert datos["recibidos"] == 4
    assert datos["cumplimiento"] == 75.0
    # El pendiente de Carla es trabajo abierto, sea del período que sea.
    assert datos["abiertos"]["PENDIENTE"] == 1


def test_recientes_pagina(api_owner, escenario, dia):
    primera = api_owner.get(f"{BASE}/recientes/", {"limite": 2}).json()
    assert len(primera["pedidos"]) == 2 and primera["hay_mas"] is True
    resto = api_owner.get(f"{BASE}/recientes/", {"limite": 10, "desde_fila": 2}).json()
    assert len(resto["pedidos"]) == 4 and resto["hay_mas"] is False


def test_los_listados_con_nombres_respetan_permisos(api_staff, escenario, dia):
    # Sin permisos concedidos ve los agregados, no quién compró ni qué pedidos.
    assert api_staff.get(f"{BASE}/resumen/").status_code == 200
    assert api_staff.get(f"{BASE}/recientes/").status_code == 403
    assert api_staff.get(f"{BASE}/clientes-destacados/").status_code == 403


def test_sin_sesion_no_hay_analitica(api, negocio):
    assert api.get(f"{BASE}/resumen/").status_code in (401, 403)
