"""Endpoints de salud: el del healthcheck de la plataforma y el de diagnóstico.

Hay dos a propósito, porque responden preguntas distintas:

``/healthz``     ¿El proceso está vivo y sirviendo HTTP? Lo consulta Railway
                 (y antes Render) para dar por bueno un despliegue. NO toca la
                 base de datos ni nada externo: si Supabase tiene un mal minuto,
                 la plataforma no debe matar ni revertir contenedores sanos.

``/healthz/db``  ¿Llega a Supabase y qué almacenamiento de archivos está activo?
                 Es para una persona que diagnostica desde el navegador.
"""
import logging

from django.conf import settings
from django.core.files.storage import default_storage
from django.db import connection
from django.http import JsonResponse

logger = logging.getLogger(__name__)

RUTAS_HEALTHZ = frozenset({"/healthz", "/healthz/"})


class HealthzMiddleware:
    """Responde ``/healthz`` antes que cualquier otro middleware.

    Tiene que ir PRIMERO en ``MIDDLEWARE``. Por debajo hay tres cosas que
    tumbaban el healthcheck sin que el proceso estuviera mal:

    - ``CommonMiddleware`` valida el ``Host``. Railway consulta con
      ``Host: healthcheck.railway.app``, que no está (ni debe estar por
      obligación) en ``ALLOWED_HOSTS``: la respuesta era un 400.
    - ``SecurityMiddleware`` redirige a HTTPS; la sonda entra por HTTP interno.
    - ``TenantMiddleware`` resuelve el negocio por el host y declara el tenant
      en PostgreSQL: dos consultas a Supabase en cada sonda. Sin BD, un 500.

    Saltarse la validación del host aquí es seguro: la respuesta es un JSON
    fijo que no construye URLs ni lee nada de la petición.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.path in RUTAS_HEALTHZ and request.method in ("GET", "HEAD"):
            return JsonResponse({"status": "ok"})
        return self.get_response(request)


def healthz_db(_request):
    """Responde 200 si la base de datos contesta; 503 si no.

    Informa también de qué backend de archivos está activo. Sin esto, saber si
    una imagen rota viene de código sin desplegar o de una variable que falta
    obliga a ir adivinando desde el panel.
    """
    datos = {
        "status": "ok",
        "database": "ok",
        "storage": "r2" if getattr(settings, "USE_R2", False) else "local",
        # Qué credenciales de R2 llegaron al contenedor. Solo si están las
        # cuatro se activa R2; nunca se expone el valor, solo si está o no.
        "r2_config": {
            "account_id": bool(getattr(settings, "R2_ACCOUNT_ID", "")),
            "access_key": bool(getattr(settings, "R2_ACCESS_KEY_ID", "")),
            "secret_key": bool(getattr(settings, "R2_SECRET_ACCESS_KEY", "")),
            "bucket": bool(getattr(settings, "R2_BUCKET_NAME", "")),
            "public_url": bool(getattr(settings, "R2_PUBLIC_URL", "")),
        },
        "storage_backend": type(default_storage).__name__,
    }

    try:
        with connection.cursor() as cur:
            cur.execute("SELECT 1")
            cur.fetchone()
    except Exception as exc:  # noqa: BLE001 - cualquier fallo es "no sano"
        # El mensaje del driver lleva host y usuario de Supabase: va al log del
        # servidor, no a una respuesta pública. Fuera solo sale el tipo.
        logger.error("healthz/db: la base de datos no responde: %s", exc)
        datos["status"] = "error"
        datos["database"] = type(exc).__name__
        return JsonResponse(datos, status=503)

    return JsonResponse(datos)
