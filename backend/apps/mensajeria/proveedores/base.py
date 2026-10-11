"""
Lo común a los proveedores de WhatsApp.

Cada proveedor sabe hacer UNA cosa: enviar una plantilla a un número y decir
cómo le fue. Qué plantilla, a quién, cuándo reintentar y cuándo pasar al otro
proveedor lo decide `servicio.py`, una sola vez para los dos.

Se usa `urllib` de la biblioteca estándar, como el backend de correo de
Brevo: añadir `requests` o el SDK de Twilio solo para dos POST no compensa.
"""
import json
import logging
from dataclasses import dataclass, field
from urllib import error, request

logger = logging.getLogger(__name__)


@dataclass
class Resultado:
    ok: bool
    id_externo: str = ""
    error: str = ""
    #: ¿Tiene sentido volver a intentarlo más tarde? Un 500 o un límite de
    #: velocidad, sí; un número inexistente o una plantilla sin aprobar, no.
    reintentable: bool = False
    detalle: dict = field(default_factory=dict)


class ProveedorNoConfigurado(Exception):
    """Faltan credenciales o el identificador del remitente."""


def post(url: str, cuerpo: bytes, cabeceras: dict, timeout: float) -> tuple[int, dict]:
    """POST que devuelve (estado HTTP, JSON). Un fallo de red es estado 0."""
    peticion = request.Request(url, data=cuerpo, headers=cabeceras, method="POST")
    try:
        with request.urlopen(peticion, timeout=timeout) as respuesta:
            return respuesta.status, _json(respuesta.read())
    except error.HTTPError as e:
        return e.code, _json(e.read())
    except (error.URLError, TimeoutError, OSError) as e:
        logger.warning("WhatsApp: fallo de red hacia %s: %s", url.split("?")[0], e)
        return 0, {"error": {"message": f"Fallo de red: {e}"}}


def _json(crudo: bytes) -> dict:
    try:
        return json.loads(crudo.decode() or "{}")
    except (ValueError, UnicodeDecodeError):
        return {}


def es_reintentable_http(estado: int) -> bool:
    return estado == 0 or estado == 429 or estado >= 500
