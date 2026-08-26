"""Endpoint de salud para el health check de Render."""
from django.conf import settings
from django.core.files.storage import default_storage
from django.db import connection
from django.http import JsonResponse


def healthz(_request):
    """Responde 200 si el proceso vive y la base de datos contesta.

    Render consulta esta ruta para decidir si el despliegue fue bien y si el
    servicio sigue sano. Se comprueba la BD a proposito: un contenedor que
    arranca pero no alcanza Supabase no sirve de nada, y es mejor que el
    despliegue falle a que quede en linea devolviendo errores 500.

    Informa tambien de que backend de archivos esta activo. Sin esto, saber si
    una imagen rota viene de codigo sin desplegar o de una variable que falta
    obliga a ir adivinando desde el panel.
    """
    datos = {
        "status": "ok",
        "database": "ok",
        "storage": "r2" if getattr(settings, "USE_R2", False) else "local",
        # Que credenciales de R2 llegaron al contenedor. Solo si estan las
        # cuatro se activa R2; nunca se expone el valor, solo si esta o no.
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
        datos["status"] = "error"
        datos["database"] = str(exc)
        return JsonResponse(datos, status=503)

    return JsonResponse(datos)
