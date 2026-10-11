"""
La autorización de datos (Ley 1581) y el consentimiento de WhatsApp (Meta).

Lo que protege:

1. Que la tienda no deja enviar un pedido sin la autorización de datos, y que
   la guarda con su fecha —es la prueba que la ley pide conservar—.
2. Que a un cliente con cédula que ya autorizó no se le vuelve a pedir, y que
   quien conozca una cédula ajena no puede suscribirla ni darla de baja.
3. Que a un cliente solo le llegan avisos por WhatsApp si los aceptó, y que
   responder «BAJA» los apaga también en su ficha.
"""
import pytest

from apps.content.models import StoreSettings
from apps.mensajeria import servicio
from apps.mensajeria.eventos import EVENTOS
from apps.mensajeria.models import ConfiguracionWhatsApp, MensajeWhatsApp, PlantillaWhatsApp
from apps.orders.models import Cliente, Pedido

pytestmark = pytest.mark.django_db

CEDULA = "1020345678"


@pytest.fixture
def por_cedula(negocio):
    StoreSettings.objects.update_or_create(
        tenant=negocio, defaults={"identificacion_clientes": StoreSettings.IDENTIFICACION_CEDULA}
    )
    return negocio


@pytest.fixture
def whatsapp(negocio):
    config = ConfiguracionWhatsApp.objects.create(activo=True, proveedor="SIMULADO", telefonos_alertas=["3110000000"])
    for codigo, datos in EVENTOS.items():
        PlantillaWhatsApp.objects.create(evento=codigo, meta_nombre=codigo.lower(), cuerpo=datos["texto"])
    return config


def _pedido(presentacion, **cliente):
    return {"cliente": cliente, "items": [{"presentacion_id": presentacion.id, "cantidad": 1}]}


def _primer_pedido(presentacion, **extra):
    return _pedido(
        presentacion,
        cedula=CEDULA,
        nombre="Juan Pérez",
        telefono="3001234567",
        direccion="Cra 12 #45-67",
        acepta_precios=True,
        **extra,
    )


# ==========================================================================
# AUTORIZACIÓN DE DATOS
# ==========================================================================
def test_sin_autorizacion_de_datos_no_hay_pedido(api, presentacion):
    r = api.post("/api/orders/", _pedido(presentacion, nombre="Tienda Don José"), format="json")
    assert r.status_code == 400
    assert "autoriza_datos" in r.json()["cliente"]
    assert not Pedido.objects.exists()


def test_la_autorizacion_se_guarda_con_su_fecha(api, presentacion):
    r = api.post("/api/orders/", _pedido(presentacion, nombre="Tienda Don José", autoriza_datos=True), format="json")
    assert r.status_code == 201
    assert Cliente.objects.get().autorizo_datos_en is not None


def test_por_cedula_no_se_vuelve_a_pedir(api, por_cedula, presentacion):
    assert api.post("/api/orders/", _primer_pedido(presentacion, autoriza_datos=True), format="json").status_code == 201
    r = api.post("/api/orders/", _pedido(presentacion, cedula=CEDULA), format="json")
    assert r.status_code == 201


def test_cliente_de_antes_autoriza_una_vez_sin_repetir_sus_datos(api, por_cedula, presentacion):
    """Ya tenía sus datos completos, pero nunca se le pidió la autorización."""
    from django.utils import timezone

    Cliente.objects.create(
        nombre_cliente="Juan Pérez", documento_cliente=CEDULA, telefono_cliente="3001234567",
        direccion_cliente="Cra 12", acepto_precios_en=timezone.now(),
    )
    consulta = api.post("/api/orders-cliente/consultar/", {"cedula": CEDULA}, format="json").json()
    assert consulta["requiere_datos"] is False
    assert consulta["requiere_autorizacion"] is True

    assert api.post("/api/orders/", _pedido(presentacion, cedula=CEDULA), format="json").status_code == 400
    r = api.post("/api/orders/", _pedido(presentacion, cedula=CEDULA, autoriza_datos=True), format="json")
    assert r.status_code == 201
    assert Cliente.objects.get().autorizo_datos_en is not None


# ==========================================================================
# CONSENTIMIENTO DE WHATSAPP
# ==========================================================================
def test_aceptar_whatsapp_se_guarda_con_su_fecha(api, por_cedula, presentacion):
    api.post("/api/orders/", _primer_pedido(presentacion, autoriza_datos=True, acepta_whatsapp=True), format="json")
    cliente = Cliente.objects.get()
    assert cliente.acepta_whatsapp is True
    assert cliente.whatsapp_decidido_en is not None


def test_una_cedula_ajena_no_cambia_lo_que_el_cliente_decidio(api, por_cedula, presentacion):
    api.post("/api/orders/", _primer_pedido(presentacion, autoriza_datos=True, acepta_whatsapp=False), format="json")
    api.post("/api/orders/", _pedido(presentacion, cedula=CEDULA, acepta_whatsapp=True), format="json")
    assert Cliente.objects.get().acepta_whatsapp is False


def test_sin_consentimiento_el_cliente_no_recibe_avisos_pero_el_negocio_si(
    api, whatsapp, presentacion, django_capture_on_commit_callbacks
):
    with django_capture_on_commit_callbacks(execute=True):
        api.post(
            "/api/orders/",
            _pedido(presentacion, nombre="Sin aviso", telefono="3001234567", autoriza_datos=True),
            format="json",
        )
    assert [m.evento for m in MensajeWhatsApp.objects.all()] == ["ALERTA_PEDIDO_NUEVO"]


def test_con_consentimiento_si_recibe_el_aviso(api, whatsapp, presentacion, django_capture_on_commit_callbacks):
    with django_capture_on_commit_callbacks(execute=True):
        api.post(
            "/api/orders/",
            _pedido(presentacion, nombre="Con aviso", telefono="3001234567", autoriza_datos=True, acepta_whatsapp=True),
            format="json",
        )
    assert MensajeWhatsApp.objects.filter(evento="PEDIDO_RECIBIDO", destino="+573001234567").exists()


def test_el_negocio_puede_no_exigir_consentimiento(api, whatsapp, presentacion, django_capture_on_commit_callbacks):
    whatsapp.exige_consentimiento = False
    whatsapp.save()
    with django_capture_on_commit_callbacks(execute=True):
        api.post(
            "/api/orders/",
            _pedido(presentacion, nombre="Cliente", telefono="3001234567", autoriza_datos=True),
            format="json",
        )
    assert MensajeWhatsApp.objects.filter(evento="PEDIDO_RECIBIDO").exists()


def test_responder_baja_retira_el_consentimiento(negocio):
    cliente = Cliente.objects.create(nombre_cliente="Ana", telefono_cliente="+57 300 123 4567", acepta_whatsapp=True)
    servicio.registrar_respuesta(negocio, "+573001234567", "baja")
    cliente.refresh_from_db()
    assert cliente.acepta_whatsapp is False
    assert cliente.whatsapp_decidido_en is not None


def test_el_equipo_registra_el_consentimiento_desde_el_panel(api_owner, negocio):
    cliente = Cliente.objects.create(nombre_cliente="Ana", telefono_cliente="3001234567")
    r = api_owner.patch(f"/api/clients/{cliente.pk}/", {"acepta_whatsapp": True}, format="json")
    assert r.status_code == 200, r.data
    assert r.data["acepta_whatsapp"] is True
    assert r.data["whatsapp_decidido_en"] is not None
    # La autorización de datos no la puede inventar el panel.
    api_owner.patch(f"/api/clients/{cliente.pk}/", {"autorizo_datos_en": "2026-01-01T00:00:00Z"}, format="json")
    cliente.refresh_from_db()
    assert cliente.autorizo_datos_en is None


def test_crear_un_cliente_con_whatsapp_guarda_la_fecha(api_owner, negocio):
    r = api_owner.post("/api/clients/", {"nombre_cliente": "Luis", "acepta_whatsapp": True}, format="json")
    assert r.status_code == 201, r.data
    assert r.data["whatsapp_decidido_en"] is not None
