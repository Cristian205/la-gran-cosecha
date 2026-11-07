"""Configuración de Gunicorn. Se carga sola: Gunicorn lee ./gunicorn.conf.py del
directorio de trabajo (/app en la imagen).

Vive en un archivo y no en flags del comando de inicio para no depender de que
la plataforma expanda ${PORT} con un shell: Railway ejecuta el start command
sin shell, y un "--bind 0.0.0.0:${PORT}" literal no arranca.
"""
import os

# Railway y Render inyectan PORT; escuchar en otro puerto o en 127.0.0.1 deja
# el healthcheck sin respuesta ("service unavailable").
bind = f"0.0.0.0:{os.environ.get('PORT', '8000')}"
workers = int(os.environ.get("WEB_CONCURRENCY", "2"))
# Las facturas PDF con WeasyPrint pueden pasar de 30 s.
timeout = int(os.environ.get("GUNICORN_TIMEOUT", "120"))
# Al recibir SIGTERM en un redeploy, margen para terminar lo que esté en curso.
graceful_timeout = 30
accesslog = "-"
errorlog = "-"
loglevel = os.environ.get("GUNICORN_LOG_LEVEL", "info")
