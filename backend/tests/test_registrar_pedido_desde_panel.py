"""
Pedidos apuntados desde el panel (`POST /api/orders/registrar/`).

El caso es el del negocio que recibe el pedido por teléfono o WhatsApp y lo
apunta. Lo que se prueba es que ese camino no herede las reglas de la tienda
—que el negocio acepte pedidos online, la cédula, el acuerdo de precios— y que
sí conserve lo que no se puede relajar: permiso, presentación válida, total
calculado por el servidor y mercancía apartada.
"""
import pytest

from apps.orders.models import Cliente, Pedido

pytestmark = pytest.mark.django_db

RUTA = "/api/orders/registrar/"


def test_apunta_un_pedido_para_un_cliente_nuevo(api_owner, presentacion):
    respuesta = api_owner.post(
        RUTA,
        {
            "cliente_nuevo": {
                "nombre": "Doña Marta",
                "telefono": "3001234567",
                "direccion": "Calle 1 # 2-3",
            },
            "items": [{"presentacion_id": presentacion.id, "cantidad": "3"}],
            "observaciones": "Llamó a las 7am",
        },
        format="json",
    )

    assert respuesta.status_code == 201, respuesta.content
    cuerpo = respuesta.json()
    pedido = Pedido.objects.get(pk=cuerpo["pedido_id"])
    assert pedido.estado == "PENDIENTE"
    assert pedido.observaciones == "Llamó a las 7am"
    assert pedido.cliente.nombre_cliente == "Doña Marta"
    # El total lo pone el servidor con el precio del catálogo: 3 × 10000.
    assert pedido.total_pedido == 30000
    # Queda a nombre de quien lo apuntó, no anónimo como el de la tienda.
    assert pedido.usuario is not None


def test_apunta_un_pedido_para_un_cliente_que_ya_existe(
    api_owner, presentacion, cliente_negocio
):
    respuesta = api_owner.post(
        RUTA,
        {
            "cliente_id": cliente_negocio.id,
            "items": [{"presentacion_id": presentacion.id, "cantidad": "1"}],
        },
        format="json",
    )

    assert respuesta.status_code == 201, respuesta.content
    pedido = Pedido.objects.get(pk=respuesta.json()["pedido_id"])
    assert pedido.cliente_id == cliente_negocio.id
    # No duplica el cliente por apuntarle otro pedido.
    assert Cliente.objects.count() == 1


def test_sin_permiso_no_puede_apuntar(api_staff, presentacion):
    respuesta = api_staff.post(
        RUTA,
        {
            "cliente_nuevo": {"nombre": "Quien sea"},
            "items": [{"presentacion_id": presentacion.id, "cantidad": "1"}],
        },
        format="json",
    )

    assert respuesta.status_code == 403, respuesta.content
    assert Pedido.objects.count() == 0


def test_hay_que_decir_de_quien_es_el_pedido(api_owner, presentacion, cliente_negocio):
    """Ni sin cliente ni con los dos: se elige uno de los dos caminos."""
    sin_cliente = api_owner.post(
        RUTA,
        {"items": [{"presentacion_id": presentacion.id, "cantidad": "1"}]},
        format="json",
    )
    con_ambos = api_owner.post(
        RUTA,
        {
            "cliente_id": cliente_negocio.id,
            "cliente_nuevo": {"nombre": "Otro"},
            "items": [{"presentacion_id": presentacion.id, "cantidad": "1"}],
        },
        format="json",
    )

    assert sin_cliente.status_code == 400, sin_cliente.content
    assert con_ambos.status_code == 400, con_ambos.content
    assert Pedido.objects.count() == 0


def test_un_pedido_sin_productos_no_se_apunta(api_owner, cliente_negocio):
    respuesta = api_owner.post(
        RUTA, {"cliente_id": cliente_negocio.id, "items": []}, format="json"
    )

    assert respuesta.status_code == 400, respuesta.content
    assert Pedido.objects.count() == 0


def test_una_presentacion_inactiva_no_se_puede_apuntar(
    api_owner, presentacion, cliente_negocio
):
    """La misma guarda que la tienda: no se vende lo que se desactivó."""
    presentacion.estado_presentacion = False
    presentacion.save(update_fields=["estado_presentacion"])

    respuesta = api_owner.post(
        RUTA,
        {
            "cliente_id": cliente_negocio.id,
            "items": [{"presentacion_id": presentacion.id, "cantidad": "1"}],
        },
        format="json",
    )

    assert respuesta.status_code == 400, respuesta.content
    assert Pedido.objects.count() == 0
