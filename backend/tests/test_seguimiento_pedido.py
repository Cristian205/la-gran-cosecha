"""
El seguimiento del pedido que ve el cliente en la tienda.

  * Al registrar el pedido, la respuesta trae lo que de verdad quedó guardado
    —fecha, referencias, unidades, total— y el paso en que va.
  * Un pedido recién recibido dice «Recibido»: nunca «Confirmado» sin un hecho
    detrás (la factura, un lote, la entrega).
  * El historial por cédula trae el mismo paso, y cambia cuando el panel actúa.
"""
from decimal import Decimal

import pytest

from apps.content.models import StoreSettings
from apps.orders.models import EventoPedido, Pedido
from apps.orders.seguimiento import (
    CONFIRMADO,
    DESPACHADO,
    EN_PREPARACION,
    EN_REVISION,
    ENTREGADO,
    RECIBIDO,
    paso_del_pedido,
)

pytestmark = pytest.mark.django_db

CEDULA = "1020345678"


def _pedido(presentacion, cantidad=2, **cliente):
    cliente = {"nombre": "Tienda Don José", "autoriza_datos": True, **cliente}
    return {"cliente": cliente, "items": [{"presentacion_id": presentacion.id, "cantidad": cantidad}]}


# ==========================================================================
# LA RESPUESTA DEL REGISTRO
# ==========================================================================
def test_la_respuesta_trae_lo_que_quedo_guardado(api, presentacion):
    respuesta = api.post("/api/orders/", _pedido(presentacion, cantidad=3), format="json")
    assert respuesta.status_code == 201, respuesta.content
    datos = respuesta.json()
    pedido = Pedido.objects.get(pk=datos["pedido_id"])

    assert datos["fecha"] == pedido.fecha_pedido.isoformat()
    assert datos["referencias"] == 1
    assert Decimal(datos["unidades"]) == Decimal("3")
    assert Decimal(str(datos["total"])) == pedido.total_pedido


def test_un_pedido_recien_registrado_solo_esta_recibido(api, presentacion):
    datos = api.post("/api/orders/", _pedido(presentacion), format="json").json()
    assert datos["seguimiento"] == {"paso": 0, "clave": RECIBIDO, "etiqueta": "Recibido"}


def test_un_producto_escrito_a_mano_lo_deja_en_revision(api, categoria, unidad):
    cuerpo = {
        "cliente": {"nombre": "Doña Marta", "autoriza_datos": True},
        "personalizados": [
            {"nombre": "papa criolla", "cantidad": "4", "unidad_id": unidad.id, "categoria_id": categoria.id}
        ],
    }
    datos = api.post("/api/orders/", cuerpo, format="json").json()
    assert datos["seguimiento"]["clave"] == EN_REVISION


# ==========================================================================
# EL HISTORIAL POR CÉDULA SIGUE AL PANEL
# ==========================================================================
@pytest.fixture
def por_cedula(negocio):
    StoreSettings.objects.update_or_create(
        tenant=negocio, defaults={"identificacion_clientes": StoreSettings.IDENTIFICACION_CEDULA}
    )
    return negocio


def _seguimiento_en_historial(api, pedido_id):
    datos = api.post("/api/orders-cliente/historial/", {"cedula": CEDULA}, format="json").json()
    return next(p["seguimiento"] for p in datos["pedidos"] if p["id"] == pedido_id)


def test_el_historial_sigue_lo_que_hace_el_panel(api, por_cedula, presentacion):
    cuerpo = _pedido(
        presentacion,
        cedula=CEDULA,
        telefono="+57 300 123 4567",
        direccion="Cra 12 #45-67",
        acepta_precios=True,
    )
    pedido_id = api.post("/api/orders/", cuerpo, format="json").json()["pedido_id"]
    pedido = Pedido.objects.get(pk=pedido_id)

    assert _seguimiento_en_historial(api, pedido_id)["clave"] == RECIBIDO

    EventoPedido.objects.create(tenant=pedido.tenant, pedido=pedido, tipo="FACTURA", descripcion="Factura")
    assert _seguimiento_en_historial(api, pedido_id)["clave"] == CONFIRMADO

    Pedido.objects.filter(pk=pedido_id).update(estado="ENTREGADO")
    assert _seguimiento_en_historial(api, pedido_id) == {
        "paso": 5,
        "clave": ENTREGADO,
        "etiqueta": "Entregado",
    }


# ==========================================================================
# LA TRADUCCIÓN, CASO POR CASO
# ==========================================================================
@pytest.mark.parametrize(
    "crudo, comercial, logistico, esperado",
    [
        ("PENDIENTE", "RECIBIDO", None, RECIBIDO),
        # Tener fecha programada no es haberlo confirmado.
        ("PENDIENTE", "RECIBIDO", "PENDIENTE_PLANIFICACION", RECIBIDO),
        ("PENDIENTE", "POR_REVISAR", None, EN_REVISION),
        ("EDITADO", "EDITADO", None, EN_REVISION),
        ("PENDIENTE", "IMPRESO", None, CONFIRMADO),
        ("CERRADO", "CERRADO", None, CONFIRMADO),
        ("PENDIENTE", "RECIBIDO", "EN_LOTE", EN_PREPARACION),
        ("PENDIENTE", "IMPRESO", "CONFIRMADO", EN_PREPARACION),
        ("PENDIENTE", "IMPRESO", "EN_RUTA", DESPACHADO),
        ("PENDIENTE", "IMPRESO", "ENTREGADO", ENTREGADO),
        ("ENTREGADO", "RECIBIDO", None, ENTREGADO),
    ],
)
def test_cada_hecho_lleva_a_su_paso(crudo, comercial, logistico, esperado):
    assert paso_del_pedido(crudo, comercial, logistico) == esperado
