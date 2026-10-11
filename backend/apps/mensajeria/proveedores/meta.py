"""
WhatsApp Cloud API de Meta.

    POST https://graph.facebook.com/<versión>/<phone_number_id>/messages
    Authorization: Bearer <token de usuario del sistema>

Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-message-templates
"""
import json

from django.conf import settings

from .base import ProveedorNoConfigurado, Resultado, es_reintentable_http, post

#: Errores de Meta que se resuelven solos con esperar (límites de velocidad,
#: caídas temporales). El resto —número no válido, plantilla inexistente o
#: sin aprobar, parámetros que no cuadran— no mejora reintentando.
CODIGOS_REINTENTABLES = {4, 80007, 130429, 131000, 131016, 131048, 131056, 133004}


class Meta:
    nombre = "META"

    def __init__(self, config):
        self.token = getattr(settings, "META_WHATSAPP_TOKEN", "")
        self.version = getattr(settings, "META_GRAPH_VERSION", "v21.0")
        self.timeout = getattr(settings, "WHATSAPP_TIMEOUT", 10)
        self.phone_number_id = config.meta_phone_number_id

    def disponible(self) -> bool:
        return bool(self.token and self.phone_number_id)

    def enviar(self, destino: str, plantilla, variables: list[str]) -> Resultado:
        if not self.disponible():
            raise ProveedorNoConfigurado("Falta META_WHATSAPP_TOKEN o el Phone number ID del negocio.")
        if not plantilla.meta_nombre:
            return Resultado(ok=False, error=f"La plantilla de {plantilla.evento} no tiene nombre en Meta.")

        cuerpo = {
            "messaging_product": "whatsapp",
            "to": destino.lstrip("+"),
            "type": "template",
            "template": {
                "name": plantilla.meta_nombre,
                "language": {"code": plantilla.meta_idioma or "es"},
            },
        }
        if variables:
            cuerpo["template"]["components"] = [
                {
                    "type": "body",
                    # Meta rechaza parámetros vacíos o con saltos de línea.
                    "parameters": [{"type": "text", "text": _limpio(v)} for v in variables],
                }
            ]

        estado, datos = post(
            f"https://graph.facebook.com/{self.version}/{self.phone_number_id}/messages",
            json.dumps(cuerpo).encode(),
            {"Authorization": f"Bearer {self.token}", "Content-Type": "application/json"},
            self.timeout,
        )
        if 200 <= estado < 300 and datos.get("messages"):
            return Resultado(ok=True, id_externo=datos["messages"][0].get("id", ""), detalle=datos)

        fallo = datos.get("error", {}) if isinstance(datos, dict) else {}
        codigo = fallo.get("code")
        mensaje = fallo.get("error_user_msg") or fallo.get("message") or f"HTTP {estado}"
        return Resultado(
            ok=False,
            error=f"Meta {codigo or estado}: {mensaje}",
            reintentable=es_reintentable_http(estado) or codigo in CODIGOS_REINTENTABLES,
            detalle=datos,
        )


def _limpio(valor) -> str:
    texto = " ".join(str(valor if valor not in (None, "") else "-").split())
    return texto[:1000]
