"""
Revisión de productos que los clientes escriben a mano en la tienda.

Aceptar crea el producto y enlaza la línea; vincular la enlaza a uno que ya
existía sin duplicar el catálogo; rechazar no toca nada. Las tres decisiones
quedan en la línea de tiempo del pedido y no se pueden repetir.
"""
from decimal import Decimal

import pytest

from apps.catalog.models import PresentacionProducto, Producto
from apps.orders.models import DetallePedido, EventoPedido, Pedido

pytestmark = pytest.mark.django_db


@pytest.fixture
def sugerido(api, categoria, unidad):
    r = api.post(
        "/api/orders/",
        {
            "cliente": {"nombre": "Doña Marta", "autoriza_datos": True},
            "personalizados": [
                {"nombre": "papa criolla", "cantidad": "4", "unidad_id": unidad.id, "categoria_id": categoria.id}
            ],
        },
        format="json",
    )
    assert r.status_code == 201, r.content
    return DetallePedido.objects.get(pedido_id=r.json()["pedido_id"])


def _producto(categoria, unidad, precio="3000"):
    return {
        "nombre_producto": "Papa criolla",
        "categoria": categoria.id,
        "unidad_base": unidad.id,
        "tipo_cantidad": "medio",
        "permite_fraccion": True,
        "estado_producto": True,
        "controla_stock": False,
        "codigo_barras": "",
        "presentaciones": [
            {
                "nombre_presentacion": "Por kilo",
                "unidad_venta": unidad.id,
                "factor_conversion": "1",
                "precio_unitario": precio,
                "cantidad_minima": "0.5",
                "incremento_cantidad": "0.5",
                "decimales_cantidad": 1,
            }
        ],
    }


def test_la_lista_trae_el_contexto_para_revisar(api_owner, sugerido):
    fila = api_owner.get("/api/orders-productos-pendientes/").json()[0]
    assert fila["nombre_personalizado"] == "papa criolla"
    assert fila["pedido_estado"] == "PENDIENTE"
    assert "pedido_fecha" in fila and "subtotal" in fila


def test_aprobar_crea_el_producto_enlaza_la_linea_y_lo_registra(api_owner, sugerido, categoria, unidad):
    r = api_owner.post(
        f"/api/orders-productos-pendientes/{sugerido.id}/aprobar/", _producto(categoria, unidad), format="json"
    )
    assert r.status_code == 201, r.content
    sugerido.refresh_from_db()
    assert sugerido.estado_revision == "ACEPTADO"
    assert sugerido.presentacion.nombre_presentacion == "Por kilo"
    assert sugerido.precio_unitario == Decimal("3000")
    assert sugerido.pedido.total_pedido == Decimal("12000")
    assert "Papa criolla" in sugerido.nombre_congelado
    # La regla de cantidad enviada se respeta.
    assert sugerido.presentacion.cantidad_minima == Decimal("0.5")
    evento = EventoPedido.objects.get(pedido=sugerido.pedido, tipo="CATALOGO")
    assert evento.usuario is not None


def test_aprobar_dos_veces_no_crea_dos_productos(api_owner, sugerido, categoria, unidad):
    url = f"/api/orders-productos-pendientes/{sugerido.id}/aprobar/"
    assert api_owner.post(url, _producto(categoria, unidad), format="json").status_code == 201
    assert api_owner.post(url, _producto(categoria, unidad), format="json").status_code == 404
    assert Producto.objects.filter(nombre_producto="Papa criolla").count() == 1


def test_vincular_a_uno_existente_no_duplica_el_catalogo(api_owner, sugerido, presentacion):
    productos_antes = Producto.objects.count()
    r = api_owner.post(
        f"/api/orders-productos-pendientes/{sugerido.id}/vincular/",
        {"presentacion_id": presentacion.id},
        format="json",
    )
    assert r.status_code == 200, r.content
    assert Producto.objects.count() == productos_antes
    sugerido.refresh_from_db()
    assert sugerido.presentacion_id == presentacion.id
    assert sugerido.es_catalogo and sugerido.estado_revision == "ACEPTADO"
    assert sugerido.precio_unitario == presentacion.precio_unitario
    assert sugerido.pedido.total_pedido == Decimal("4") * presentacion.precio_unitario
    assert EventoPedido.objects.filter(pedido=sugerido.pedido, tipo="CATALOGO").count() == 1


def test_vincular_puede_conservar_el_precio_pactado(api_owner, sugerido, presentacion):
    DetallePedido.objects.filter(pk=sugerido.pk).update(precio_unitario=Decimal("2500"))
    r = api_owner.post(
        f"/api/orders-productos-pendientes/{sugerido.id}/vincular/",
        {"presentacion_id": presentacion.id, "conservar_precio": True},
        format="json",
    )
    assert r.status_code == 200, r.content
    sugerido.refresh_from_db()
    assert sugerido.precio_unitario == Decimal("2500")
    assert sugerido.subtotal == Decimal("10000")


def test_no_se_vincula_a_una_presentacion_desactivada(api_owner, sugerido, presentacion):
    PresentacionProducto.objects.filter(pk=presentacion.pk).update(estado_presentacion=False)
    r = api_owner.post(
        f"/api/orders-productos-pendientes/{sugerido.id}/vincular/",
        {"presentacion_id": presentacion.id},
        format="json",
    )
    assert r.status_code == 400
    sugerido.refresh_from_db()
    assert sugerido.estado_revision == "PENDIENTE"


def test_rechazar_deja_el_pedido_igual_y_lo_registra(api_owner, sugerido):
    total = Pedido.objects.get(pk=sugerido.pedido_id).total_pedido
    r = api_owner.post(f"/api/orders-productos-pendientes/{sugerido.id}/rechazar/")
    assert r.status_code == 200
    sugerido.refresh_from_db()
    assert sugerido.estado_revision == "RECHAZADO"
    assert sugerido.presentacion_id is None
    assert sugerido.pedido.total_pedido == total
    assert EventoPedido.objects.filter(pedido=sugerido.pedido, tipo="CATALOGO").exists()
