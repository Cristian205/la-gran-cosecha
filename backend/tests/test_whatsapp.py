"""
WhatsApp de La Gran Cosecha (apps.mensajeria).

Lo que protege:

1. Que las situaciones del negocio generan el aviso correcto, a la persona
   correcta, una sola vez —también la entrega por lotes, que no dispara
   señales—.
2. Que si Meta falla se usa Twilio, que lo pasajero se reintenta y lo
   definitivo no, y que un fallo de WhatsApp nunca tumba el pedido.
3. Que se respetan las bajas y el interruptor del negocio.
4. Que los webhooks solo aceptan lo que Meta y Twilio firmaron.

Ningún test sale a la red: los proveedores se sustituyen.
"""
import base64
import hashlib
import hmac
import json
from urllib.parse import urlencode

import pytest

from apps.mensajeria import servicio
from apps.mensajeria.eventos import EVENTOS
from apps.mensajeria.models import ConfiguracionWhatsApp, ExclusionWhatsApp, MensajeWhatsApp, PlantillaWhatsApp
from apps.mensajeria.proveedores import PROVEEDORES, Resultado
from apps.mensajeria.telefonos import normalizar_e164
from apps.orders.models import Cliente, Pedido

pytestmark = pytest.mark.django_db

Estado = MensajeWhatsApp.Estado


# ==========================================================================
# FIXTURES
# ==========================================================================
@pytest.fixture
def whatsapp(negocio):
    """WhatsApp encendido en modo simulado, con plantillas y un número de alertas."""
    config = ConfiguracionWhatsApp.objects.create(
        activo=True,
        proveedor="SIMULADO",
        telefonos_alertas=["+573110000000"],
    )
    for codigo, datos in EVENTOS.items():
        PlantillaWhatsApp.objects.create(
            evento=codigo, meta_nombre=codigo.lower(), twilio_content_sid=f"HX{codigo[:6]}", cuerpo=datos["texto"]
        )
    return config


@pytest.fixture
def cliente_wa(negocio):
    return Cliente.objects.create(
        nombre_cliente="María Pérez", telefono_cliente="+57 300 123 4567", acepta_whatsapp=True
    )


class Falso:
    """Un proveedor que responde lo que se le diga y anota lo que recibió."""

    respuestas: dict = {}
    llamadas: list = []

    def __init__(self, config, nombre):
        self.nombre = nombre

    def disponible(self):
        return True

    def enviar(self, destino, plantilla, variables):
        Falso.llamadas.append((self.nombre, destino, plantilla.evento, list(variables)))
        return Falso.respuestas.get(self.nombre, Resultado(ok=True, id_externo=f"{self.nombre}-1"))


@pytest.fixture
def proveedores_falsos(monkeypatch):
    Falso.respuestas = {}
    Falso.llamadas = []
    for nombre in ("META", "TWILIO"):
        monkeypatch.setitem(PROVEEDORES, nombre, lambda config, n=nombre: Falso(config, n))
    return Falso


def mensajes(**filtros):
    return list(MensajeWhatsApp.objects.filter(**filtros).order_by("id"))


# ==========================================================================
# TELÉFONOS
# ==========================================================================
@pytest.mark.parametrize(
    "bruto, esperado",
    [
        ("3001234567", "+573001234567"),
        ("+57 300 123 4567", "+573001234567"),
        ("(300) 123-4567", "+573001234567"),
        ("573001234567", "+573001234567"),
        ("whatsapp:+14155238886", "+14155238886"),
        ("0057 3001234567", "+573001234567"),
        ("12345", ""),
        ("", ""),
        (None, ""),
    ],
)
def test_normalizar_telefono(bruto, esperado):
    assert normalizar_e164(bruto) == esperado


# ==========================================================================
# DISPARADORES
# ==========================================================================
def test_pedido_nuevo_avisa_al_cliente_y_al_negocio(whatsapp, cliente_wa, django_capture_on_commit_callbacks):
    with django_capture_on_commit_callbacks(execute=True):
        pedido = Pedido.objects.create(cliente=cliente_wa, estado="PENDIENTE", total_pedido=85000)

    cliente = mensajes(evento="PEDIDO_RECIBIDO")
    assert len(cliente) == 1
    assert cliente[0].destino == "+573001234567"
    assert cliente[0].estado == Estado.ENVIADO
    assert cliente[0].variables[:3] == ["María", str(pedido.pk), "$85.000"]
    assert "#%d" % pedido.pk in cliente[0].texto

    alerta = mensajes(evento="ALERTA_PEDIDO_NUEVO")
    assert [m.destino for m in alerta] == ["+573110000000"]


def test_cambios_de_estado_avisan_una_sola_vez(whatsapp, cliente_wa, django_capture_on_commit_callbacks):
    with django_capture_on_commit_callbacks(execute=True):
        pedido = Pedido.objects.create(cliente=cliente_wa, estado="PENDIENTE")
    for estado in ("EDITADO", "CERRADO", "CERRADO", "ENTREGADO"):
        pedido = Pedido.objects.get(pk=pedido.pk)
        with django_capture_on_commit_callbacks(execute=True):
            pedido.estado = estado
            pedido.save()

    eventos = [m.evento for m in mensajes(destino="+573001234567")]
    assert eventos == ["PEDIDO_RECIBIDO", "PEDIDO_AJUSTADO", "PEDIDO_CONFIRMADO", "PEDIDO_ENTREGADO"]


def test_entrega_por_lotes_avisa_aunque_use_update(whatsapp, cliente_wa, api_owner, django_capture_on_commit_callbacks):
    with django_capture_on_commit_callbacks(execute=True):
        pedido = Pedido.objects.create(cliente=cliente_wa, estado="CERRADO")
    with django_capture_on_commit_callbacks(execute=True):
        r = api_owner.post("/api/orders/entregar/", {"ids": [pedido.pk]}, format="json")
    assert r.status_code == 200, r.data
    assert len(mensajes(evento="PEDIDO_ENTREGADO")) == 1

    # Pulsar otra vez no repite el aviso.
    with django_capture_on_commit_callbacks(execute=True):
        api_owner.post("/api/orders/entregar/", {"ids": [pedido.pk]}, format="json")
    assert len(mensajes(evento="PEDIDO_ENTREGADO")) == 1


def test_whatsapp_apagado_no_encola_nada(whatsapp, cliente_wa, django_capture_on_commit_callbacks):
    whatsapp.activo = False
    whatsapp.save()
    with django_capture_on_commit_callbacks(execute=True):
        Pedido.objects.create(cliente=cliente_wa, estado="PENDIENTE")
    assert MensajeWhatsApp.objects.count() == 0


def test_evento_apagado_no_se_envia(whatsapp, cliente_wa, django_capture_on_commit_callbacks):
    whatsapp.eventos_apagados = ["ALERTA_PEDIDO_NUEVO"]
    whatsapp.save()
    with django_capture_on_commit_callbacks(execute=True):
        Pedido.objects.create(cliente=cliente_wa, estado="PENDIENTE")
    assert [m.evento for m in mensajes()] == ["PEDIDO_RECIBIDO"]


def test_sin_plantilla_queda_omitido_y_se_ve_por_que(whatsapp, cliente_wa, django_capture_on_commit_callbacks):
    PlantillaWhatsApp.objects.filter(evento="PEDIDO_RECIBIDO").delete()
    with django_capture_on_commit_callbacks(execute=True):
        Pedido.objects.create(cliente=cliente_wa, estado="PENDIENTE")
    mensaje = mensajes(evento="PEDIDO_RECIBIDO")[0]
    assert mensaje.estado == Estado.OMITIDO
    assert "plantilla" in mensaje.error


def test_un_fallo_al_preparar_el_aviso_no_tumba_el_pedido(whatsapp, cliente_wa, monkeypatch, django_capture_on_commit_callbacks):
    def explota(*args, **kwargs):
        raise RuntimeError("Meta caído")

    monkeypatch.setattr(servicio, "encolar", explota)
    with django_capture_on_commit_callbacks(execute=True):
        pedido = Pedido.objects.create(cliente=cliente_wa, estado="PENDIENTE")
    assert Pedido.objects.filter(pk=pedido.pk).exists()


# ==========================================================================
# ENVÍO, RESPALDO Y REINTENTOS
# ==========================================================================
def _encolar(negocio, captura):
    with captura(execute=True):
        return servicio.encolar(negocio, "ALERTA_GENERAL", "3001234567", {"titulo": "Hola", "detalle": "x"})


def test_si_meta_falla_se_usa_twilio(whatsapp, negocio, proveedores_falsos, django_capture_on_commit_callbacks):
    whatsapp.proveedor = "META"
    whatsapp.save()
    proveedores_falsos.respuestas["META"] = Resultado(ok=False, error="Meta 131000: caído", reintentable=True)

    mensaje = _encolar(negocio, django_capture_on_commit_callbacks)
    mensaje.refresh_from_db()

    assert mensaje.estado == Estado.ENVIADO
    assert mensaje.proveedor == "TWILIO"
    assert [i["proveedor"] for i in mensaje.intentos] == ["META", "TWILIO"]


def test_sin_respaldo_no_se_usa_el_otro(whatsapp, negocio, proveedores_falsos, django_capture_on_commit_callbacks):
    whatsapp.proveedor = "META"
    whatsapp.respaldo_activo = False
    whatsapp.save()
    proveedores_falsos.respuestas["META"] = Resultado(ok=False, error="número inválido")

    mensaje = _encolar(negocio, django_capture_on_commit_callbacks)
    mensaje.refresh_from_db()
    assert mensaje.estado == Estado.FALLIDO
    assert [c[0] for c in proveedores_falsos.llamadas] == ["META"]


def test_fallo_pasajero_se_reprograma_y_el_definitivo_no(whatsapp, negocio, proveedores_falsos, django_capture_on_commit_callbacks):
    whatsapp.proveedor = "META"
    whatsapp.save()
    pasajero = Resultado(ok=False, error="429", reintentable=True)
    proveedores_falsos.respuestas.update(META=pasajero, TWILIO=pasajero)

    mensaje = _encolar(negocio, django_capture_on_commit_callbacks)
    mensaje.refresh_from_db()
    assert mensaje.estado == Estado.PENDIENTE
    assert mensaje.proximo_intento is not None

    definitivo = Resultado(ok=False, error="plantilla no aprobada")
    proveedores_falsos.respuestas.update(META=definitivo, TWILIO=definitivo)
    MensajeWhatsApp.objects.filter(pk=mensaje.pk).update(proximo_intento=None)
    assert servicio.procesar_pendientes() == 0
    mensaje.refresh_from_db()
    assert mensaje.estado == Estado.FALLIDO
    assert mensaje.error == "plantilla no aprobada"


def test_la_misma_clave_no_se_envia_dos_veces(whatsapp, negocio, django_capture_on_commit_callbacks):
    with django_capture_on_commit_callbacks(execute=True):
        primero = servicio.encolar(negocio, "ALERTA_GENERAL", "3001234567", ["a", "b"], clave="x:1")
        segundo = servicio.encolar(negocio, "ALERTA_GENERAL", "3001234567", ["a", "b"], clave="x:1")
    assert primero is not None and segundo is None


def test_alerta_libre_para_cualquier_situacion(whatsapp, negocio, django_capture_on_commit_callbacks):
    with django_capture_on_commit_callbacks(execute=True):
        enviados = servicio.alertar(negocio, "Stock bajo", "Quedan 3 bultos de papa")
    assert len(enviados) == 1
    assert enviados[0].texto == "Stock bajo: Quedan 3 bultos de papa"


# ==========================================================================
# BAJAS
# ==========================================================================
def test_responder_baja_excluye_el_numero(whatsapp, negocio, django_capture_on_commit_callbacks):
    assert servicio.registrar_respuesta(negocio, "whatsapp:+573001234567", "  BAJA ")
    assert ExclusionWhatsApp.objects.filter(telefono="+573001234567").exists()
    assert _encolar(negocio, django_capture_on_commit_callbacks) is None


# ==========================================================================
# PROVEEDOR META: lo que se manda de verdad
# ==========================================================================
def test_meta_arma_la_plantilla_con_sus_variables(whatsapp, negocio, monkeypatch, settings):
    from apps.mensajeria.proveedores import meta

    settings.META_WHATSAPP_TOKEN = "token"
    whatsapp.meta_phone_number_id = "1234567890"
    capturado = {}

    def falso_post(url, cuerpo, cabeceras, timeout):
        capturado.update(url=url, cuerpo=json.loads(cuerpo), auth=cabeceras["Authorization"])
        return 200, {"messages": [{"id": "wamid.ABC"}]}

    monkeypatch.setattr(meta, "post", falso_post)
    plantilla = PlantillaWhatsApp.objects.get(evento="PEDIDO_CONFIRMADO")
    resultado = meta.Meta(whatsapp).enviar("+573001234567", plantilla, ["María", "42", "$85.000"])

    assert resultado.ok and resultado.id_externo == "wamid.ABC"
    assert capturado["url"].endswith("/1234567890/messages")
    assert capturado["auth"] == "Bearer token"
    assert capturado["cuerpo"]["to"] == "573001234567"
    assert capturado["cuerpo"]["template"]["name"] == "pedido_confirmado"
    textos = [p["text"] for p in capturado["cuerpo"]["template"]["components"][0]["parameters"]]
    assert textos == ["María", "42", "$85.000"]


# ==========================================================================
# WEBHOOKS
# ==========================================================================
def _mensaje_enviado(negocio, id_externo):
    return MensajeWhatsApp.objects.create(
        evento="ALERTA_GENERAL", destino="+573001234567", estado=Estado.ENVIADO, id_externo=id_externo
    )


def test_webhook_meta_verificacion(api, settings):
    settings.META_WEBHOOK_VERIFY_TOKEN = "secreto"
    r = api.get("/api/webhooks/whatsapp/meta/", {"hub.mode": "subscribe", "hub.verify_token": "secreto", "hub.challenge": "123"})
    assert r.status_code == 200 and r.content == b"123"
    r = api.get("/api/webhooks/whatsapp/meta/", {"hub.mode": "subscribe", "hub.verify_token": "otro", "hub.challenge": "123"})
    assert r.status_code == 403


def test_webhook_meta_actualiza_estado_solo_con_firma(api, negocio, settings):
    settings.META_APP_SECRET = "app-secret"
    mensaje = _mensaje_enviado(negocio, "wamid.XYZ")
    cuerpo = json.dumps(
        {"entry": [{"changes": [{"value": {"statuses": [{"id": "wamid.XYZ", "status": "read"}]}}]}]}
    ).encode()

    r = api.post("/api/webhooks/whatsapp/meta/", cuerpo, content_type="application/json", HTTP_X_HUB_SIGNATURE_256="sha256=falsa")
    assert r.status_code == 403

    firma = "sha256=" + hmac.new(b"app-secret", cuerpo, hashlib.sha256).hexdigest()
    r = api.post("/api/webhooks/whatsapp/meta/", cuerpo, content_type="application/json", HTTP_X_HUB_SIGNATURE_256=firma)
    assert r.status_code == 200
    mensaje.refresh_from_db()
    assert mensaje.estado == Estado.LEIDO


def test_webhook_twilio_actualiza_estado_solo_con_firma(api, negocio, settings):
    settings.TWILIO_AUTH_TOKEN = "auth-token"
    settings.TWILIO_WEBHOOK_BASE_URL = "https://api.ejemplo.test"
    mensaje = _mensaje_enviado(negocio, "SM123")
    datos = {"MessageSid": "SM123", "MessageStatus": "delivered"}
    url = "https://api.ejemplo.test/api/webhooks/whatsapp/twilio/"
    firma = base64.b64encode(
        hmac.new(b"auth-token", (url + "".join(f"{k}{datos[k]}" for k in sorted(datos))).encode(), hashlib.sha1).digest()
    ).decode()

    falsa = api.post("/api/webhooks/whatsapp/twilio/", urlencode(datos), content_type="application/x-www-form-urlencoded", HTTP_X_TWILIO_SIGNATURE="x")
    assert falsa.status_code == 403
    r = api.post("/api/webhooks/whatsapp/twilio/", urlencode(datos), content_type="application/x-www-form-urlencoded", HTTP_X_TWILIO_SIGNATURE=firma)
    assert r.status_code == 200
    mensaje.refresh_from_db()
    assert mensaje.estado == Estado.ENTREGADO


def test_un_estado_atrasado_no_retrocede(negocio):
    mensaje = MensajeWhatsApp.objects.create(evento="ALERTA_GENERAL", destino="+573001234567", estado=Estado.LEIDO, id_externo="w1")
    assert servicio.actualizar_estado("w1", "delivered") is False
    mensaje.refresh_from_db()
    assert mensaje.estado == Estado.LEIDO


# ==========================================================================
# API DEL PANEL
# ==========================================================================
def test_configuracion_desde_el_panel(api_owner, api, negocio):
    assert api.get("/api/whatsapp/configuracion/").status_code in (401, 403)

    r = api_owner.patch(
        "/api/whatsapp/configuracion/",
        {"activo": True, "proveedor": "META", "telefonos_alertas": ["300 111 2222"]},
        format="json",
    )
    assert r.status_code == 200, r.data
    assert r.data["telefonos_alertas"] == ["+573001112222"]
    assert r.data["credenciales_plataforma"] == {"meta": False, "meta_webhook": False, "twilio": False}
    assert {e["codigo"] for e in r.data["eventos"]} == set(EVENTOS)

    r = api_owner.patch("/api/whatsapp/configuracion/", {"telefonos_alertas": ["123"]}, format="json")
    assert r.status_code == 400


def test_crear_plantillas_sugeridas_y_probar(api_owner, negocio, django_capture_on_commit_callbacks):
    api_owner.patch("/api/whatsapp/configuracion/", {"activo": True, "proveedor": "SIMULADO"}, format="json")
    r = api_owner.post("/api/whatsapp/plantillas/sugeridas/")
    assert r.status_code == 201
    assert len(r.data) == len(EVENTOS)

    with django_capture_on_commit_callbacks(execute=True):
        r = api_owner.post("/api/whatsapp/probar/", {"evento": "PEDIDO_CONFIRMADO", "telefono": "3001234567"}, format="json")
    assert r.status_code == 201, r.data
    assert MensajeWhatsApp.objects.get().estado == Estado.ENVIADO
