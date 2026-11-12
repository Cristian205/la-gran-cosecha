"""
Las credenciales de las integraciones guardadas desde el panel.

Qué hace este módulo y qué no:

- Cifra cada valor con Fernet (AES-128-CBC + HMAC) antes de tocar la base de
  datos. La clave sale de `INTEGRACIONES_CLAVE` y, si no existe, se deriva de
  `SECRET_KEY`. Si se cambia `SECRET_KEY` sin definir antes `INTEGRACIONES_CLAVE`,
  los valores guardados dejan de poder leerse y hay que volver a escribirlos:
  se tratan como no definidos, no como un error.
- Nunca devuelve un valor por la API. Solo `aplicar_a_settings` los descifra,
  dentro del servidor, para dejarlos donde el código ya los lee (`settings`).
- Manda lo guardado en el panel; si no hay nada, la variable de entorno. Quitar
  un valor del panel devuelve el control al entorno.

Los procesos del servidor se enteran de un cambio con `sincronizar()`, que
`IntegracionesMiddleware` llama como mucho una vez por minuto.
"""
import base64
import hashlib
import logging
import time

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings
from django.db import DatabaseError

logger = logging.getLogger(__name__)

#: Cuánto tarda un proceso en notar un cambio hecho desde otro.
INTERVALO_SEGUNDOS = 60

_ultima_revision = 0.0
_ultima_marca = None


def _fernet() -> Fernet:
    base = getattr(settings, "INTEGRACIONES_CLAVE", "") or settings.SECRET_KEY
    clave = base64.urlsafe_b64encode(hashlib.sha256(base.encode("utf-8")).digest())
    return Fernet(clave)


def cifrar(valor: str) -> str:
    return _fernet().encrypt(valor.encode("utf-8")).decode("ascii")


def descifrar(token: str) -> str | None:
    try:
        return _fernet().decrypt(token.encode("ascii")).decode("utf-8")
    except (InvalidToken, ValueError):
        return None


def _ajustes_derivados(nombre: str) -> None:
    """Lo que depende de una variable y no se lee tal cual de `settings`."""
    if nombre == "BREVO_API_KEY" and getattr(settings, "BREVO_API_KEY", ""):
        # Mismo criterio que `config/settings/prod.py`: con clave, correo por la API.
        settings.EMAIL_BACKEND = "apps.common.email_backends.BrevoAPIBackend"


def aplicar_a_settings() -> list[str]:
    """
    Pone en `settings` los valores guardados en el panel. Devuelve sus claves.

    Los de R2 no se «calientan»: el almacenamiento se construye al primer uso
    y cambiarlo en caliente dejaría archivos nuevos y viejos en sitios
    distintos. Se aplican por completo al reiniciar el servicio.
    """
    from .models import ConfiguracionIntegracion  # noqa: PLC0415

    aplicadas = []
    for fila in ConfiguracionIntegracion.objects.all():
        valor = descifrar(fila.valor_cifrado)
        if valor is None:
            logger.warning("integraciones: no se pudo descifrar %s (¿cambió SECRET_KEY?)", fila.clave)
            continue
        setattr(settings, fila.clave, valor)
        _ajustes_derivados(fila.clave)
        aplicadas.append(fila.clave)
    return aplicadas


def sincronizar(forzar: bool = False) -> None:
    """Reaplica la configuración si cambió desde la última vez que se miró."""
    global _ultima_revision, _ultima_marca
    ahora = time.monotonic()
    if not forzar and ahora - _ultima_revision < INTERVALO_SEGUNDOS:
        return
    _ultima_revision = ahora
    try:
        from django.db.models import Count, Max  # noqa: PLC0415

        from .models import ConfiguracionIntegracion  # noqa: PLC0415

        marca = ConfiguracionIntegracion.objects.aggregate(n=Count("id"), f=Max("fecha_actualizacion"))
        marca = (marca["n"], marca["f"])
        if forzar or marca != _ultima_marca:
            aplicar_a_settings()
            _ultima_marca = marca
    except DatabaseError:
        # Antes de migrar la tabla no existe: no es un error de la petición.
        logger.debug("integraciones: la tabla de configuración todavía no está disponible")


class IntegracionesMiddleware:
    """Mantiene `settings` al día con lo guardado en el panel (una consulta por minuto)."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        sincronizar()
        return self.get_response(request)
