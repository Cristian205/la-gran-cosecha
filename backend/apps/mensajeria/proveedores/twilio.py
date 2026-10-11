"""
WhatsApp a través de Twilio: la alternativa cuando Meta falla o mientras el
número del negocio está en revisión en Meta.

    POST https://api.twilio.com/2010-04-01/Accounts/<SID>/Messages.json
    Basic auth <SID>:<Auth Token>, formulario con From, To, ContentSid,
    ContentVariables y StatusCallback.

Docs: https://www.twilio.com/docs/whatsapp/tutorial/send-whatsapp-notification-messages-templates
"""
import base64
import json
from urllib.parse import urlencode

from django.conf import settings

from .base import ProveedorNoConfigurado, Resultado, es_reintentable_http, post

#: 20429 = demasiadas peticiones; 30001/30008 = cola o error desconocido del
#: operador. Lo demás (número inválido, plantilla rechazada) no se reintenta.
CODIGOS_REINTENTABLES = {20429, 20500, 20503, 30001, 30008}


def con_prefijo(numero: str) -> str:
    numero = numero.strip()
    return numero if numero.startswith("whatsapp:") else f"whatsapp:{numero}"


class Twilio:
    nombre = "TWILIO"

    def __init__(self, config):
        self.sid = getattr(settings, "TWILIO_ACCOUNT_SID", "")
        self.token = getattr(settings, "TWILIO_AUTH_TOKEN", "")
        self.timeout = getattr(settings, "WHATSAPP_TIMEOUT", 10)
        self.callback = getattr(settings, "TWILIO_STATUS_CALLBACK_URL", "")
        self.remitente = config.twilio_remitente

    def disponible(self) -> bool:
        return bool(self.sid and self.token and self.remitente)

    def enviar(self, destino: str, plantilla, variables: list[str]) -> Resultado:
        if not self.disponible():
            raise ProveedorNoConfigurado("Falta TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN o el remitente del negocio.")
        if not plantilla.twilio_content_sid:
            return Resultado(ok=False, error=f"La plantilla de {plantilla.evento} no tiene ContentSid en Twilio.")

        campos = {
            "From": con_prefijo(self.remitente),
            "To": con_prefijo(destino),
            "ContentSid": plantilla.twilio_content_sid,
            "ContentVariables": json.dumps({str(i): str(v) for i, v in enumerate(variables, start=1)}),
        }
        if self.callback:
            campos["StatusCallback"] = self.callback

        credencial = base64.b64encode(f"{self.sid}:{self.token}".encode()).decode()
        estado, datos = post(
            f"https://api.twilio.com/2010-04-01/Accounts/{self.sid}/Messages.json",
            urlencode(campos).encode(),
            {"Authorization": f"Basic {credencial}", "Content-Type": "application/x-www-form-urlencoded"},
            self.timeout,
        )
        if 200 <= estado < 300 and datos.get("sid"):
            return Resultado(ok=True, id_externo=datos["sid"], detalle=datos)

        codigo = datos.get("code")
        mensaje = datos.get("message") or f"HTTP {estado}"
        return Resultado(
            ok=False,
            error=f"Twilio {codigo or estado}: {mensaje}",
            reintentable=es_reintentable_http(estado) or codigo in CODIGOS_REINTENTABLES,
            detalle=datos,
        )
