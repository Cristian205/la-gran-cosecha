"""
Las alertas de cada cliente (Clientes → Alertas en el panel).

Las de utilidad son avisos reales de WhatsApp: apagar una tiene que impedir
que se envíe. Las de marketing nacen apagadas, porque promocionar exige que el
cliente lo haya pedido.
"""
import pytest

from apps.mensajeria import servicio
from apps.orders.alertas_cliente import ALERTAS

pytestmark = pytest.mark.django_db


def _url(cliente):
    return f"/api/clients/{cliente.id}/"


def test_las_de_utilidad_nacen_encendidas_y_las_de_marketing_apagadas(api_owner, cliente_negocio):
    alertas = api_owner.get(_url(cliente_negocio)).json()["alertas"]
    assert set(alertas) == {a["codigo"] for a in ALERTAS}
    assert alertas["PEDIDO_RECIBIDO"] is True
    assert alertas["MKT_WA_OFERTAS"] is False


def test_cambiar_una_no_reinicia_las_demas(api_owner, cliente_negocio):
    api_owner.patch(_url(cliente_negocio), {"alertas": {"MKT_WA_OFERTAS": True}}, format="json")
    r = api_owner.patch(_url(cliente_negocio), {"alertas": {"PEDIDO_ENTREGADO": False}}, format="json")
    assert r.status_code == 200, r.data
    assert r.data["alertas"]["MKT_WA_OFERTAS"] is True
    assert r.data["alertas"]["PEDIDO_ENTREGADO"] is False


@pytest.mark.parametrize("alertas", [{"NO_EXISTE": True}, {"PEDIDO_RECIBIDO": "si"}, ["PEDIDO_RECIBIDO"]])
def test_rechaza_lo_que_no_es_una_alerta(api_owner, cliente_negocio, alertas):
    r = api_owner.patch(_url(cliente_negocio), {"alertas": alertas}, format="json")
    assert r.status_code == 400
    assert "alertas" in r.data


def test_el_panel_recibe_el_catalogo(api_owner):
    r = api_owner.get("/api/clients/alertas/")
    assert r.status_code == 200
    assert [a["codigo"] for a in r.json()] == [a["codigo"] for a in ALERTAS]


def test_apagar_un_aviso_impide_enviarlo(negocio, cliente_negocio):
    cliente_negocio.acepta_whatsapp = True
    cliente_negocio.alertas = {"PEDIDO_CONFIRMADO": False}
    cliente_negocio.save()
    assert servicio.puede_escribir_a(negocio, cliente_negocio, "PEDIDO_RECIBIDO") is True
    assert servicio.puede_escribir_a(negocio, cliente_negocio, "PEDIDO_CONFIRMADO") is False


def test_sin_consentimiento_no_sale_nada_aunque_este_encendida(negocio, cliente_negocio):
    assert cliente_negocio.acepta_whatsapp is False
    assert servicio.puede_escribir_a(negocio, cliente_negocio, "PEDIDO_RECIBIDO") is False
