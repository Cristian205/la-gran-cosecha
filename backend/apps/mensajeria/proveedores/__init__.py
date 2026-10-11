"""Los proveedores de WhatsApp, por el nombre que guarda la configuración."""
import logging
import uuid

from .base import ProveedorNoConfigurado, Resultado
from .meta import Meta
from .twilio import Twilio

logger = logging.getLogger(__name__)


class Simulado:
    """
    No envía nada: registra el mensaje como enviado. Sirve para desarrollo y
    para revisar los textos y los disparadores antes de tener las cuentas de
    Meta o Twilio aprobadas.
    """

    nombre = "SIMULADO"

    def __init__(self, config):
        pass

    def disponible(self) -> bool:
        return True

    def enviar(self, destino, plantilla, variables) -> Resultado:
        logger.info("WhatsApp simulado → %s [%s] %s", destino, plantilla.evento, variables)
        return Resultado(ok=True, id_externo=f"simulado-{uuid.uuid4().hex[:12]}")


PROVEEDORES = {"META": Meta, "TWILIO": Twilio, "SIMULADO": Simulado}

#: El respaldo de cada proveedor. El simulado no tiene: si se eligió es para no enviar.
RESPALDO = {"META": "TWILIO", "TWILIO": "META"}

__all__ = ["PROVEEDORES", "RESPALDO", "ProveedorNoConfigurado", "Resultado"]
