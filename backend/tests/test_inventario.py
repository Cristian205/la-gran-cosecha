"""
El libro mayor de existencias.

Lo que se comprueba no es que los números sumen —eso lo hace cualquier
contador—, sino las cuatro promesas de las que depende todo lo que viene
después:

1. Que el saldo y el histórico no pueden discrepar, porque hay un solo escritor.
2. Que reservar y descontar son cosas distintas, que es lo que permite que la
   tienda online y el mostrador convivan sobre el mismo stock.
3. Que un pedido no puede confirmarse si no hay mercancía para entregarlo.
4. Que el inventario de un negocio no se cruza con el de otro.

El que cierra la promesa de concurrencia —dos cajeros vendiendo la última
unidad a la vez— está al final y va marcado `postgres`: necesita dos
conexiones reales y un `select_for_update` que bloquee de verdad, y en SQLite
no bloquea nada. Se salta solo, avisando de que esa capa no se verifica.
"""
from decimal import Decimal

import pytest

from apps.catalog.models import PresentacionProducto, Producto
from apps.inventory import operaciones
from apps.inventory.models import Existencia, MovimientoInventario, Ubicacion
from apps.orders.inventario import despachar_pedido
from apps.orders.models import DetallePedido, Pedido
from apps.tenancy.context import usar_tenant

pytestmark = pytest.mark.django_db


@pytest.fixture
def bodega(negocio):
    return Ubicacion.objects.create(
        nombre="Bodega central", codigo="central", es_predeterminada=True
    )


@pytest.fixture
def producto_con_stock(producto, bodega):
    """Un producto que controla existencias y tiene 100 unidades."""
    producto.controla_stock = True
    producto.save(update_fields=["controla_stock"])
    operaciones.entrada(producto, 100, ubicacion=bodega, motivo="Inventario inicial")
    return producto


# ==========================================================================
# 1. EL SALDO NO PUEDE DISCREPAR DEL HISTÓRICO
# ==========================================================================
def test_cada_movimiento_deja_su_rastro(producto_con_stock, bodega):
    operaciones.salida(producto_con_stock, 30, ubicacion=bodega)

    existencia = Existencia.objects.get(producto=producto_con_stock, ubicacion=bodega)
    assert existencia.cantidad == Decimal("70.000")
    # La prueba de que la caché no ha derivado: sumar el histórico da lo mismo.
    assert operaciones.recalcular(producto_con_stock, bodega) == existencia.cantidad

    movimientos = MovimientoInventario.objects.filter(producto=producto_con_stock)
    assert movimientos.count() == 2
    assert movimientos.first().saldo_resultante == Decimal("70.000")


def test_no_se_puede_sacar_mas_de_lo_que_hay(producto_con_stock, bodega):
    with pytest.raises(operaciones.StockInsuficiente):
        operaciones.salida(producto_con_stock, 101, ubicacion=bodega)

    # Y nada se escribió: el rechazo ocurre ANTES de tocar el saldo.
    assert operaciones.disponible(producto_con_stock) == Decimal("100.000")
    assert MovimientoInventario.objects.filter(producto=producto_con_stock).count() == 1


def test_el_ajuste_recibe_el_total_contado_no_la_diferencia(producto_con_stock, bodega):
    operaciones.ajustar(producto_con_stock, 93, ubicacion=bodega, motivo="Conteo de mayo")

    existencia = Existencia.objects.get(producto=producto_con_stock, ubicacion=bodega)
    assert existencia.cantidad == Decimal("93.000")
    ajuste = MovimientoInventario.objects.filter(tipo="AJUSTE").first()
    assert ajuste.cantidad == Decimal("-7.000")  # la diferencia, firmada


def test_la_presentacion_se_convierte_a_unidad_base(producto, unidad, bodega):
    """Tres cajas de doce son treinta y seis unidades, no tres."""
    caja = PresentacionProducto.objects.create(
        producto=producto,
        nombre_presentacion="Caja",
        unidad_venta=unidad,
        factor_conversion=12,
        precio_unitario=50000,
    )
    assert operaciones.a_unidad_base(caja, 3) == Decimal("36")


def test_el_traslado_no_crea_ni_destruye(producto_con_stock, bodega, negocio):
    tienda = Ubicacion.objects.create(nombre="Mostrador", codigo="mostrador")
    operaciones.trasladar(producto_con_stock, 40, origen=bodega, destino=tienda)

    assert operaciones.disponible(producto_con_stock, bodega) == Decimal("60.000")
    assert operaciones.disponible(producto_con_stock, tienda) == Decimal("40.000")
    # Sin ubicación, el disponible es el del negocio entero.
    assert operaciones.disponible(producto_con_stock) == Decimal("100.000")


# ==========================================================================
# 2. RESERVAR NO ES DESCONTAR
# ==========================================================================
def test_la_reserva_aparta_sin_sacar(producto_con_stock, bodega):
    operaciones.reservar(producto_con_stock, 25, ubicacion=bodega)

    existencia = Existencia.objects.get(producto=producto_con_stock, ubicacion=bodega)
    # Físicamente siguen estando las cien: no han salido por la puerta.
    assert existencia.cantidad == Decimal("100.000")
    # Pero solo se pueden prometer setenta y cinco.
    assert existencia.disponible == Decimal("75.000")


def test_no_se_puede_reservar_lo_ya_reservado(producto_con_stock, bodega):
    operaciones.reservar(producto_con_stock, 90, ubicacion=bodega)
    with pytest.raises(operaciones.StockInsuficiente):
        operaciones.reservar(producto_con_stock, 20, ubicacion=bodega)


def test_despachar_convierte_la_reserva_en_salida(producto_con_stock, bodega):
    operaciones.reservar(producto_con_stock, 25, ubicacion=bodega)
    operaciones.despachar(producto_con_stock, 25, ubicacion=bodega)

    existencia = Existencia.objects.get(producto=producto_con_stock, ubicacion=bodega)
    assert existencia.cantidad == Decimal("75.000")
    assert existencia.reservada == Decimal("0.000")
    assert operaciones.recalcular(producto_con_stock, bodega) == Decimal("75.000")


# ==========================================================================
# 3. LOS PEDIDOS Y EL STOCK
# ==========================================================================
@pytest.fixture
def presentacion_con_stock(producto_con_stock, unidad):
    return PresentacionProducto.objects.create(
        producto=producto_con_stock,
        nombre_presentacion="Unidad",
        unidad_venta=unidad,
        factor_conversion=1,
        precio_unitario=1000,
    )


def _pedido_de(cliente, presentacion, cantidad):
    pedido = Pedido.objects.create(cliente=cliente, estado="PENDIENTE")
    DetallePedido.objects.create(
        pedido=pedido, presentacion=presentacion, cantidad=cantidad, es_catalogo=True
    )
    pedido.actualizar_total()
    return pedido


def test_el_pedido_de_la_tienda_reserva(
    cliente_negocio, presentacion_con_stock, producto_con_stock
):
    from apps.orders.inventario import resincronizar_reserva

    pedido = _pedido_de(cliente_negocio, presentacion_con_stock, 10)
    resincronizar_reserva(pedido)

    assert operaciones.disponible(producto_con_stock) == Decimal("90.000")
    # Nada ha salido todavía: sigue habiendo cien en la bodega.
    assert Existencia.objects.get(producto=producto_con_stock).cantidad == Decimal("100.000")


def test_resincronizar_es_idempotente(
    cliente_negocio, presentacion_con_stock, producto_con_stock
):
    """Llamarla dos veces no aparta el doble. Es lo que la hace segura."""
    from apps.orders.inventario import resincronizar_reserva

    pedido = _pedido_de(cliente_negocio, presentacion_con_stock, 10)
    resincronizar_reserva(pedido)
    resincronizar_reserva(pedido)

    assert operaciones.disponible(producto_con_stock) == Decimal("90.000")


def test_bajar_la_cantidad_devuelve_la_diferencia(
    cliente_negocio, presentacion_con_stock, producto_con_stock
):
    from apps.orders.inventario import resincronizar_reserva

    pedido = _pedido_de(cliente_negocio, presentacion_con_stock, 10)
    resincronizar_reserva(pedido)

    detalle = pedido.detalles.first()
    detalle.cantidad = Decimal("4")
    detalle.save()
    resincronizar_reserva(pedido)

    assert operaciones.disponible(producto_con_stock) == Decimal("96.000")


def test_entregar_descuenta_y_es_idempotente(
    cliente_negocio, presentacion_con_stock, producto_con_stock
):
    from apps.orders.inventario import resincronizar_reserva

    pedido = _pedido_de(cliente_negocio, presentacion_con_stock, 10)
    resincronizar_reserva(pedido)

    despachar_pedido(pedido)
    assert Existencia.objects.get(producto=producto_con_stock).cantidad == Decimal("90.000")

    # El botón de entregar del panel se pulsa dos veces más de una vez.
    despachar_pedido(pedido)
    assert Existencia.objects.get(producto=producto_con_stock).cantidad == Decimal("90.000")


def test_borrar_el_pedido_devuelve_lo_apartado(
    cliente_negocio, presentacion_con_stock, producto_con_stock
):
    from apps.orders.inventario import resincronizar_reserva

    pedido = _pedido_de(cliente_negocio, presentacion_con_stock, 10)
    resincronizar_reserva(pedido)
    assert operaciones.disponible(producto_con_stock) == Decimal("90.000")

    pedido.delete()  # dispara la señal post_delete
    assert operaciones.disponible(producto_con_stock) == Decimal("100.000")


def test_un_producto_que_no_controla_stock_no_mueve_nada(
    cliente_negocio, presentacion, producto
):
    """
    El caso de todo el catálogo existente el día del despliegue.

    Encender el inventario no puede empezar a rechazar pedidos de productos
    cuyo stock nadie ha cargado todavía.
    """
    from apps.orders.inventario import resincronizar_reserva

    assert producto.controla_stock is False
    pedido = _pedido_de(cliente_negocio, presentacion, 999)
    resincronizar_reserva(pedido)

    assert MovimientoInventario.objects.count() == 0


def test_la_api_rechaza_un_pedido_sin_stock(
    api, cliente_negocio, presentacion_con_stock, producto_con_stock
):
    respuesta = api.post(
        "/api/orders/",
        {
            "cliente": {"nombre": "Quien sea", "telefono": "3000000000"},
            "items": [{"presentacion_id": presentacion_con_stock.id, "cantidad": "500"}],
        },
        format="json",
    )
    assert respuesta.status_code == 400
    assert "stock" in respuesta.data
    # Y el pedido no quedó a medias: la transacción entera se deshizo.
    assert Pedido.objects.count() == 0


# ==========================================================================
# 4. AISLAMIENTO ENTRE NEGOCIOS
# ==========================================================================
def test_el_inventario_de_un_negocio_no_se_ve_desde_otro(
    producto_con_stock, tenant_a, tenant_b
):
    """
    El saldo dice qué vende un negocio y a qué ritmo. Es de lo más sensible que
    guarda la plataforma, y la primera capa que lo protege es el manager.
    """
    with usar_tenant(tenant_a):
        categoria_a = producto_con_stock.categoria.__class__.objects.create(
            nombre_categoria="Suyo", abreviatura="SUY", orden=1
        )
        suyo = Producto.objects.create(nombre_producto="Solo de A", categoria=categoria_a)
        suyo.controla_stock = True
        suyo.save(update_fields=["controla_stock"])
        operaciones.entrada(suyo, 50)
        assert Existencia.objects.count() == 1

    with usar_tenant(tenant_b):
        assert Existencia.objects.count() == 0
        assert MovimientoInventario.objects.count() == 0


def test_no_se_puede_mover_stock_a_la_bodega_de_otro_negocio(
    producto_con_stock, tenant_a
):
    with usar_tenant(tenant_a):
        ajena = Ubicacion.objects.create(nombre="Ajena", codigo="ajena")

    with pytest.raises(operaciones.ErrorDeInventario):
        operaciones.entrada(producto_con_stock, 10, ubicacion=ajena)


# ==========================================================================
# 5. EL NOMBRE CONGELADO
# ==========================================================================
def test_renombrar_un_producto_no_reescribe_las_facturas_viejas(
    cliente_negocio, presentacion, producto
):
    pedido = _pedido_de(cliente_negocio, presentacion, 2)
    detalle = pedido.detalles.first()
    vendido_como = detalle.nombre_congelado
    assert producto.nombre_producto in vendido_como

    producto.nombre_producto = "Nombre corregido"
    producto.save(update_fields=["nombre_producto"])

    detalle.refresh_from_db()
    assert detalle.nombre_congelado == vendido_como


# ==========================================================================
# 6. LO QUE VE LA TIENDA
# ==========================================================================
def test_el_catalogo_publico_expone_el_disponible(
    api, producto_con_stock, presentacion_con_stock
):
    respuesta = api.get("/api/catalog/products/")
    assert respuesta.status_code == 200

    fila = next(
        p for p in respuesta.data["results"] if p["id"] == producto_con_stock.id
    )
    assert Decimal(fila["disponible"]) == Decimal("100.000")
    assert fila["controla_stock"] is True


def test_el_disponible_no_se_multiplica_por_las_presentaciones(
    api, producto_con_stock, unidad
):
    """
    La trampa que hace fallar la version obvia de esta anotacion.

    La consulta del catalogo ya se une a las presentaciones para calcular
    `precio_desde`. Un `Sum` sobre existencias en la misma consulta se
    multiplicaria por el numero de presentaciones — cien pasarian a ser
    trescientas—, y el numero seguiria pareciendo plausible. Por eso el
    disponible va como subconsulta.
    """
    for nombre in ("Unidad", "Media docena", "Docena"):
        PresentacionProducto.objects.create(
            producto=producto_con_stock,
            nombre_presentacion=nombre,
            unidad_venta=unidad,
            factor_conversion=1,
            precio_unitario=1000,
        )

    respuesta = api.get("/api/catalog/products/")
    fila = next(
        p for p in respuesta.data["results"] if p["id"] == producto_con_stock.id
    )
    assert Decimal(fila["disponible"]) == Decimal("100.000")


# ==========================================================================
# 7. LA CONCURRENCIA — LA PROMESA QUE SOLO POSTGRES PUEDE VERIFICAR
# ==========================================================================
@pytest.mark.postgres
@pytest.mark.django_db(transaction=True)
def test_dos_cajeros_no_venden_la_misma_ultima_unidad(settings, negocio, categoria):
    """
    El caso que no aparece en desarrollo y aparece un sábado con dos cajas.

    Sin el `select_for_update()` de `_bloquear`, las dos transacciones leen «hay
    una», las dos concluyen que pueden vender, y las dos escriben: el saldo
    queda en -1 y el negocio ha vendido dos veces la misma mercancía. Con el
    bloqueo, la segunda espera a que la primera confirme, vuelve a leer y ve
    cero.

    Necesita PostgreSQL de verdad: en SQLite `select_for_update` no bloquea, así
    que este test pasaría sin demostrar nada — que es peor que no tenerlo.
    """
    if not getattr(settings, "USA_POSTGRES_EN_TESTS", False):
        pytest.skip("Necesita TEST_DATABASE_URL apuntando a PostgreSQL")

    import threading

    from django.db import connections

    producto = Producto.objects.create(
        nombre_producto="La última unidad", categoria=categoria, controla_stock=True
    )
    bodega = Ubicacion.objects.create(
        nombre="Mostrador", codigo="mostrador", es_predeterminada=True
    )
    operaciones.entrada(producto, 1, ubicacion=bodega)

    resultados = []

    def vender():
        # Cada hilo estrena conexión; sin eso compartirían transacción y no
        # habría concurso que medir.
        try:
            with usar_tenant(negocio):
                operaciones.salida(producto, 1, ubicacion=bodega)
            resultados.append("vendida")
        except operaciones.StockInsuficiente:
            resultados.append("rechazada")
        finally:
            connections.close_all()

    cajeros = [threading.Thread(target=vender) for _ in range(2)]
    for hilo in cajeros:
        hilo.start()
    for hilo in cajeros:
        hilo.join()

    assert sorted(resultados) == ["rechazada", "vendida"]
    assert operaciones.disponible(producto, bodega) == Decimal("0.000")


# ==========================================================================
# 8. EL MODULO EXISTE PARA LA PLATAFORMA, NO SOLO PARA EL NEGOCIO
# ==========================================================================
def test_inventario_esta_en_el_catalogo_comercial():
    """
    El hueco que deja tener dos catalogos de permisos.

    `accounts/permisos.py` (Python) basta para que un GERENTE reciba el
    permiso; `billing.PermisoDisponible` (base) es lo que Crynex vende y
    administra. Anadir solo al primero deja el modulo funcionando pero
    invisible para la plataforma: no se puede incluir en ningun plan.
    """
    from apps.accounts.permisos import TODOS_LOS_CODENAMES
    from apps.billing.models import PermisoDisponible, Plan, Producto

    assert Producto.objects.filter(slug="inventario").exists()

    codenames = set(
        PermisoDisponible.objects.filter(producto__slug="inventario").values_list(
            "codename", flat=True
        )
    )
    assert codenames == {"inventory.view_existencia", "inventory.change_existencia"}
    # Y los dos catalogos dicen lo mismo: es la deriva que este test vigila.
    assert codenames <= TODOS_LOS_CODENAMES

    # Todo plan puede al menos mirar el stock.
    for plan in Plan.objects.all():
        assert "inventory.view_existencia" in plan.permisos, plan.slug


def test_el_panel_puede_encender_el_control_de_stock(api_owner, producto):
    """
    El eslabon que enciende todo lo demas.

    Sin poder marcar `controla_stock` desde el panel, el inventario existe pero
    ningun producto llega nunca a el, y la pantalla de existencias se queda
    vacia para siempre.
    """
    respuesta = api_owner.patch(
        f"/api/catalog/products/{producto.id}/",
        {"controla_stock": True, "codigo_barras": "7701234567890"},
        format="json",
    )
    assert respuesta.status_code == 200

    producto.refresh_from_db()
    assert producto.controla_stock is True
    assert producto.codigo_barras == "7701234567890"
