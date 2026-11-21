"""
Borrado en bloque de pedidos desde el panel (`POST /api/orders/eliminar/`).

Lo que se prueba es lo que hace peligroso a un borrado masivo: que exija el
permiso de eliminar y no el de crear —es un POST, y ahí es fácil colarse—, que
no alcance pedidos de otro negocio, y que sea todo o nada, para que el panel no
avise de una cantidad que no ocurrió.
"""
import pytest

from apps.orders.models import Pedido

pytestmark = pytest.mark.django_db

RUTA = "/api/orders/eliminar/"


@pytest.fixture
def pedidos(api, presentacion):
    """Tres pedidos hechos como los hace la tienda."""
    creados = []
    for i in range(3):
        respuesta = api.post(
            "/api/orders/",
            {
                "cliente": {
                    "nombre": f"Cliente {i}",
                    "direccion": "Calle 1 # 2-3",
                    "autoriza_datos": True,
                },
                "items": [{"presentacion_id": presentacion.id, "cantidad": "1"}],
            },
            format="json",
        )
        assert respuesta.status_code == 201, respuesta.content
        creados.append(Pedido.objects.get(pk=respuesta.json()["pedido_id"]))
    return creados


def test_borra_los_seleccionados_y_dice_cuantos(api_owner, pedidos):
    elegidos = [pedidos[0].id, pedidos[1].id]

    respuesta = api_owner.post(RUTA, {"ids": elegidos}, format="json")

    assert respuesta.status_code == 200, respuesta.content
    # La cuenta que devuelve es la que el panel le muestra al usuario: tiene
    # que ser la real, no la longitud de lo que se pidió.
    assert respuesta.json() == {"success": True, "eliminados": 2}
    assert not Pedido.objects.filter(id__in=elegidos).exists()
    assert Pedido.objects.filter(id=pedidos[2].id).exists()


def test_sin_permiso_de_eliminar_no_borra_nada(api_staff, pedidos):
    """El analista no tiene concedido `orders.delete_pedido`."""
    respuesta = api_staff.post(RUTA, {"ids": [p.id for p in pedidos]}, format="json")

    assert respuesta.status_code == 403, respuesta.content
    assert Pedido.objects.count() == 3


def test_lista_vacia_no_borra_nada(api_owner, pedidos):
    respuesta = api_owner.post(RUTA, {"ids": []}, format="json")

    assert respuesta.status_code == 400, respuesta.content
    assert Pedido.objects.count() == 3


def test_ids_inexistentes_responden_400(api_owner, pedidos):
    respuesta = api_owner.post(RUTA, {"ids": [999_999]}, format="json")

    assert respuesta.status_code == 400, respuesta.content
    assert Pedido.objects.count() == 3


def test_ids_no_numericos_no_tumban_la_peticion(api_owner, pedidos):
    respuesta = api_owner.post(RUTA, {"ids": ["; DROP TABLE", None]}, format="json")

    assert respuesta.status_code == 400, respuesta.content
    assert Pedido.objects.count() == 3


def test_mezclar_un_id_ajeno_borra_solo_lo_propio(api_owner, pedidos):
    """
    Un id que no es del negocio se ignora: el queryset de la vista ya está
    acotado al tenant de la petición. Lo propio sí se borra.
    """
    respuesta = api_owner.post(
        RUTA, {"ids": [pedidos[0].id, 999_999]}, format="json"
    )

    assert respuesta.status_code == 200, respuesta.content
    assert respuesta.json()["eliminados"] == 1
    assert Pedido.objects.count() == 2
