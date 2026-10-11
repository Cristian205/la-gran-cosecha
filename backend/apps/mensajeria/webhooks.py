"""
Lo que Meta y Twilio nos cuentan después de enviar: entregado, leído,
fallido, y las respuestas de los clientes (para atender las bajas).

Son endpoints PÚBLICOS —los llama Meta o Twilio, no un usuario—, así que lo
único que los protege es la firma. Sin el secreto configurado se rechaza todo:
un webhook sin verificar dejaría a cualquiera marcar mensajes como leídos o
dar de baja números ajenos.

No dependen del negocio de la petición: llegan al dominio del backend, no al
de una tienda. El negocio se deduce del número remitente o del mensaje.
"""
import base64
import hashlib
import hmac
import json
import logging

from django.conf import settings
from django.http import HttpResponse, HttpResponseForbidden, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from . import servicio
from .models import ConfiguracionWhatsApp
from .telefonos import normalizar_e164

logger = logging.getLogger(__name__)


# ==========================================================================
# META
# ==========================================================================
def firma_meta_valida(cuerpo: bytes, cabecera: str) -> bool:
    secreto = getattr(settings, "META_APP_SECRET", "")
    if not secreto or not cabecera.startswith("sha256="):
        return False
    esperada = hmac.new(secreto.encode(), cuerpo, hashlib.sha256).hexdigest()
    return hmac.compare_digest(esperada, cabecera.removeprefix("sha256="))


@csrf_exempt
@require_http_methods(["GET", "POST"])
def webhook_meta(request):
    if request.method == "GET":
        # La verificación que Meta hace al registrar la URL del webhook.
        token = getattr(settings, "META_WEBHOOK_VERIFY_TOKEN", "")
        if (
            token
            and request.GET.get("hub.mode") == "subscribe"
            and hmac.compare_digest(request.GET.get("hub.verify_token", ""), token)
        ):
            return HttpResponse(request.GET.get("hub.challenge", ""), content_type="text/plain")
        return HttpResponseForbidden("Token de verificación inválido.")

    if not firma_meta_valida(request.body, request.headers.get("X-Hub-Signature-256", "")):
        return HttpResponseForbidden("Firma inválida.")

    try:
        datos = json.loads(request.body or b"{}")
    except ValueError:
        return JsonResponse({"ok": False}, status=400)

    for entrada in datos.get("entry", []):
        for cambio in entrada.get("changes", []):
            valor = cambio.get("value", {})
            for estado in valor.get("statuses", []):
                errores = estado.get("errors") or [{}]
                detalle = errores[0].get("title") or errores[0].get("message") or ""
                if errores[0].get("code"):
                    detalle = f"Meta {errores[0]['code']}: {detalle}"
                servicio.actualizar_estado(estado.get("id", ""), estado.get("status", ""), detalle)

            telefono_negocio = valor.get("metadata", {}).get("phone_number_id", "")
            mensajes = valor.get("messages", [])
            if mensajes and telefono_negocio:
                config = ConfiguracionWhatsApp.all_tenants.filter(meta_phone_number_id=telefono_negocio).first()
                for mensaje in mensajes:
                    texto = (mensaje.get("text") or {}).get("body", "")
                    if not texto and mensaje.get("button"):
                        texto = mensaje["button"].get("text", "")
                    servicio.registrar_respuesta(config and config.tenant, mensaje.get("from", ""), texto)

    # Meta reintenta todo lo que no reciba un 200; responder rápido y siempre 200
    # a lo bien firmado evita una tormenta de reenvíos por un dato que no se entendió.
    return JsonResponse({"ok": True})


# ==========================================================================
# TWILIO
# ==========================================================================
def firma_twilio_valida(url: str, parametros: dict, cabecera: str) -> bool:
    token = getattr(settings, "TWILIO_AUTH_TOKEN", "")
    if not token or not cabecera:
        return False
    contenido = url + "".join(f"{k}{parametros[k]}" for k in sorted(parametros))
    esperada = base64.b64encode(hmac.new(token.encode(), contenido.encode(), hashlib.sha1).digest()).decode()
    return hmac.compare_digest(esperada, cabecera)


def _url_publica(request) -> str:
    """
    La URL tal como la llamó Twilio, que es la que firmó. Detrás de un proxy
    (Render) `build_absolute_uri` puede devolver http en vez de https; por eso
    se puede fijar la base con TWILIO_WEBHOOK_BASE_URL.
    """
    base = getattr(settings, "TWILIO_WEBHOOK_BASE_URL", "").rstrip("/")
    return f"{base}{request.get_full_path()}" if base else request.build_absolute_uri()


@csrf_exempt
@require_http_methods(["POST"])
def webhook_twilio(request):
    parametros = {k: request.POST.get(k, "") for k in request.POST}
    if not firma_twilio_valida(_url_publica(request), parametros, request.headers.get("X-Twilio-Signature", "")):
        return HttpResponseForbidden("Firma inválida.")

    if parametros.get("MessageStatus") and parametros.get("MessageStatus") != "received":
        detalle = ""
        if parametros.get("ErrorCode"):
            detalle = f"Twilio {parametros['ErrorCode']}: {parametros.get('ErrorMessage', '')}".strip()
        servicio.actualizar_estado(parametros.get("MessageSid", ""), parametros["MessageStatus"], detalle)
    elif parametros.get("Body") is not None and parametros.get("From"):
        remitente = normalizar_e164(parametros.get("To", ""))
        config = next(
            (
                c
                for c in ConfiguracionWhatsApp.all_tenants.exclude(twilio_remitente="")
                if normalizar_e164(c.twilio_remitente) == remitente
            ),
            None,
        )
        servicio.registrar_respuesta(config and config.tenant, parametros["From"], parametros.get("Body", ""))

    # TwiML vacío: no se contesta nada automáticamente.
    return HttpResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', content_type="text/xml")
