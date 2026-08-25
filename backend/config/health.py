"""Endpoint de salud para el health check de Render."""
from django.db import connection
from django.http import JsonResponse


def healthz(_request):
    """Responde 200 si el proceso vive y la base de datos contesta.

    Render consulta esta ruta para decidir si el despliegue fue bien y si el
    servicio sigue sano. Se comprueba la BD a proposito: un contenedor que
    arranca pero no alcanza Supabase no sirve de nada, y es mejor que el
    despliegue falle a que quede en linea devolviendo errores 500.
    """
    try:
        with connection.cursor() as cur:
            cur.execute("SELECT 1")
            cur.fetchone()
    except Exception as exc:  # noqa: BLE001 - cualquier fallo es "no sano"
        return JsonResponse({"status": "error", "database": str(exc)}, status=503)
    return JsonResponse({"status": "ok", "database": "ok"})
