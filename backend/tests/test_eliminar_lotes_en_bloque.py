"""
Borrado de lotes de pedidos desde el panel.

Un lote es el registro de que varios pedidos se imprimieron o se entregaron
juntos. Lo que se prueba aquí es que borrarlo sea eso y solo eso: se va la
agrupación y los pedidos siguen en su sitio. Y que el `DestroyModelMixin`
suelto no haya abierto de paso un POST o un PATCH sobre algo que solo escribe
el servidor.
"""
import pytest

from apps.orders.models import LotePedidos, Pedido

pytestmark = pytest.mark.django_db

RUTA = "/api/orders-lotes/"


@pytest.fixture
def pedidos(api, presentacion):
    creados = []
    for i in range(2):
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


@pytest.fixture
def lotes(api_owner, pedidos):
    """Dos lotes de impresión, como los que crea el panel al imprimir en masa."""
    from apps.accounts.models import Usuario

    autor = Usuario.objects.get(email_usuario="duena@ejemplo.test")
    creados = []
    for _ in range(2):
        lote = LotePedidos.objects.create(
            tipo="IMPRESION", usuario=autor, cantidad_pedidos=len(pedidos)
        )
        lote.pedidos.set(pedidos)
        creados.append(lote)
    return creados


def test_borrar_un_lote_no_borra_sus_pedidos(api_owner, lotes, pedidos):
    respuesta = api_owner.delete(f"{RUTA}{lotes[0].id}/")

    assert respuesta.status_code == 204, respuesta.content
    assert not LotePedidos.objects.filter(id=lotes[0].id).exists()
    # Lo que importa: la agrupación se fue, la mercancía vendida no.
    assert Pedido.objects.count() == len(pedidos)


def test_borrado_en_bloque_dice_cuantos_y_deja_los_pedidos(api_owner, lotes, pedidos):
    ids = [l.id for l in lotes]

    respuesta = api_owner.post(f"{RUTA}eliminar/", {"ids": ids}, format="json")

    assert respuesta.status_code == 200, respuesta.content
    assert respuesta.json() == {"success": True, "eliminados": 2}
    assert LotePedidos.objects.count() == 0
    assert Pedido.objects.count() == len(pedidos)


def test_sin_permiso_de_eliminar_no_borra_lotes(api_staff, lotes):
    en_bloque = api_staff.post(
        f"{RUTA}eliminar/", {"ids": [l.id for l in lotes]}, format="json"
    )
    uno = api_staff.delete(f"{RUTA}{lotes[0].id}/")

    assert en_bloque.status_code == 403, en_bloque.content
    assert uno.status_code == 403, uno.content
    assert LotePedidos.objects.count() == 2


def test_el_staff_sigue_pudiendo_consultarlos(api_staff, lotes):
    """Leer no pide el permiso de borrar: la lista es de trabajo diario."""
    respuesta = api_staff.get(RUTA)

    assert respuesta.status_code == 200, respuesta.content


def test_lista_vacia_no_borra_nada(api_owner, lotes):
    respuesta = api_owner.post(f"{RUTA}eliminar/", {"ids": []}, format="json")

    assert respuesta.status_code == 400, respuesta.content
    assert LotePedidos.objects.count() == 2


def test_un_lote_no_se_crea_ni_se_edita_por_la_api(api_owner, lotes):
    """
    El mixin de borrado no debe haber abierto escritura: un lote lo escribe el
    servidor al imprimir o entregar, nunca el panel a mano.
    """
    creado = api_owner.post(RUTA, {"tipo": "IMPRESION"}, format="json")
    editado = api_owner.patch(f"{RUTA}{lotes[0].id}/", {"tipo": "ENTREGA"}, format="json")

    assert creado.status_code == 405, creado.content
    assert editado.status_code == 405, editado.content
