"""
El panel del dashboard (`/api/admin/stats/panel/`).

Protege que los números sean honestos: la venta es lo ENTREGADO, el período
anterior es el tramo de igual duración justo antes, la serie trae cada cubeta
aunque esté vacía (y cambia de grano con el rango), y la operación cuenta el
trabajo abierto aunque el pedido sea de otro día.
"""
from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone

from apps.orders.models import Cliente, DetallePedido, LotePedidos, Pedido

URL = "/api/admin/stats/panel/"


def _pedido(cliente, presentacion, *, estado, dias_atras=0, total=Decimal("100000")):
    pedido = Pedido.objects.create(cliente=cliente, estado=estado)
    DetallePedido.objects.create(
        pedido=pedido, presentacion=presentacion, cantidad=1, precio_unitario=total
    )
    # `fecha_pedido` es auto_now_add: se mueve después, como un pedido real de ese día.
    Pedido.objects.filter(pk=pedido.pk).update(
        fecha_pedido=timezone.now() - timedelta(days=dias_atras), total_pedido=total
    )
    return pedido


@pytest.fixture
def operacion(negocio, cliente_negocio, presentacion):
    """Un cliente que ya compraba, y un mes con una venta, un pendiente y uno impreso."""
    Cliente.objects.filter(pk=cliente_negocio.pk).update(
        fecha_registro_cliente=timezone.now() - timedelta(days=90)
    )
    nuevo = Cliente.objects.create(nombre_cliente="Frutería nueva")
    return {
        "venta_hoy": _pedido(cliente_negocio, presentacion, estado="ENTREGADO"),
        "pendiente": _pedido(nuevo, presentacion, estado="PENDIENTE", total=Decimal("50000")),
        "impreso_viejo": _pedido(nuevo, presentacion, estado="IMPRESO", dias_atras=80),
        # Del período anterior (30 días justo antes del rango de 30).
        "venta_anterior": _pedido(
            cliente_negocio, presentacion, estado="ENTREGADO", dias_atras=40, total=Decimal("80000")
        ),
    }


def test_resume_el_periodo_contra_el_anterior(api_owner, operacion):
    hoy = timezone.localdate()
    datos = api_owner.get(URL, {"desde": hoy - timedelta(days=29), "hasta": hoy}).json()

    assert datos["ventas"] == {"total": 100000.0, "anterior": 80000.0}
    assert datos["pedidos"]["total"] == 2
    assert datos["pedidos"]["por_estado"] == {"ENTREGADO": 1, "PENDIENTE": 1}
    assert datos["ticket"]["promedio"] == 100000.0
    assert datos["ticket"]["entregados"] == 1
    assert datos["anterior"]["hasta"] == str(hoy - timedelta(days=30))


def test_los_clientes_distinguen_nuevos_activos_y_los_que_vuelven(api_owner, operacion):
    hoy = timezone.localdate()
    clientes = api_owner.get(URL, {"desde": hoy - timedelta(days=29), "hasta": hoy}).json()["clientes"]

    assert clientes["activos"] == 2
    assert clientes["nuevos"] == 1  # la frutería; el otro se registró hace 90 días
    # Volvió a pedir quien ya tenía pedidos antes del período: los dos (la
    # frutería tiene el impreso de hace 80 días).
    assert clientes["recurrentes"] == 2
    assert {c["nombre"] for c in clientes["top"]} == {"Tienda del barrio", "Frutería nueva"}


def test_la_operacion_cuenta_lo_abierto_de_cualquier_fecha(api_owner, operacion):
    hoy = timezone.localdate()
    operacion_ = api_owner.get(URL, {"desde": hoy, "hasta": hoy}).json()["operacion"]

    assert operacion_["abiertos"]["PENDIENTE"] == 1
    assert operacion_["abiertos"]["IMPRESO"] == 1  # de hace 80 días, y sigue sin entregar
    assert set(operacion_["abiertos"]) == {"PENDIENTE", "EDITADO", "CERRADO", "IMPRESO"}


def test_entregados_hoy_sale_del_lote_de_entrega(api_owner, operacion, usuario_owner):
    viejo = operacion["venta_anterior"]
    # Un pedido de hace 40 días que se entregó hoy en lote cuenta hoy.
    lote = LotePedidos.objects.create(tipo="ENTREGA", usuario=usuario_owner, cantidad_pedidos=1)
    lote.pedidos.set([viejo])
    Pedido.objects.filter(pk=viejo.pk).update(fecha_modificacion=timezone.now() - timedelta(days=40))
    Pedido.objects.filter(pk=operacion["venta_hoy"].pk).update(
        fecha_modificacion=timezone.now() - timedelta(days=2)
    )

    hoy = timezone.localdate()
    datos = api_owner.get(URL, {"desde": hoy, "hasta": hoy}).json()
    assert datos["operacion"]["entregados_hoy"] == 1


@pytest.mark.parametrize(
    "dias, granularidad, cubetas, vendido",
    # A 100 días entra también la venta de hace 40.
    [(1, "hora", 24, 100000.0), (30, "dia", 30, 100000.0), (100, "semana", None, 180000.0)],
)
def test_la_serie_cambia_de_grano_y_no_se_salta_cubetas(
    api_owner, operacion, dias, granularidad, cubetas, vendido
):
    hoy = timezone.localdate()
    datos = api_owner.get(URL, {"desde": hoy - timedelta(days=dias - 1), "hasta": hoy}).json()

    assert datos["granularidad"] == granularidad
    if cubetas:
        assert len(datos["serie"]) == cubetas
    assert sum(c["total"] for c in datos["serie"]) == vendido  # solo lo entregado del rango


def test_los_mas_solicitados_cuentan_pedidos_no_unidades(api_owner, operacion, producto, presentacion):
    hoy = timezone.localdate()
    productos = api_owner.get(URL, {"desde": hoy - timedelta(days=29), "hasta": hoy}).json()["productos"]
    # Dos pedidos del período lo llevan; el total es la suma de sus líneas.
    assert productos == [
        {"nombre": producto.nombre_producto, "pedidos": 2, "total": float(presentacion.precio_unitario * 2)}
    ]


def test_rango_invalido(api_owner, negocio):
    assert api_owner.get(URL, {"desde": "2026-09-10", "hasta": "2026-09-01"}).status_code == 400
    assert api_owner.get(URL, {"desde": "ayer"}).status_code == 400
    assert api_owner.get(URL, {"desde": "2024-01-01", "hasta": "2026-01-01"}).status_code == 400


def test_sin_datos_no_inventa_nada(api_owner, negocio):
    datos = api_owner.get(URL).json()
    assert datos["ventas"] == {"total": 0.0, "anterior": 0.0}
    assert datos["ticket"]["promedio"] is None
    assert datos["productos"] == [] and datos["recientes"] == []
    assert all(c["total"] == 0 for c in datos["serie"])


def test_el_panel_no_es_publico(api, negocio):
    assert api.get(URL).status_code in (401, 403)


def test_el_resumen_cuenta_los_productos_por_revisar(api_owner, operacion, cliente_negocio):
    """El contador del menú: líneas escritas a mano que esperan aprobación."""
    # Las líneas del catálogo llevan `es_catalogo=True` en el flujo real (lo
    # pone el serializer); el fixture las crea directo.
    DetallePedido.objects.filter(presentacion__isnull=False).update(es_catalogo=True)
    pedido = operacion["pendiente"]
    DetallePedido.objects.create(
        pedido=pedido, nombre_personalizado="Papa criolla costeña", cantidad=2, precio_unitario=0
    )
    rechazada = DetallePedido.objects.create(
        pedido=pedido, nombre_personalizado="Otra cosa", cantidad=1, precio_unitario=0
    )
    DetallePedido.objects.filter(pk=rechazada.pk).update(estado_revision="RECHAZADO")

    assert api_owner.get("/api/admin/stats/").json()["productos_por_revisar"] == 1
