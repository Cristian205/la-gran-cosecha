"""Configuracion de produccion."""
from .base import *  # noqa: F401,F403
from .base import env

DEBUG = False

# Sin default: en produccion los hosts se declaran explicitamente. Se usa una
# lista vacia como default para que `collectstatic` pueda ejecutarse durante el
# build de la imagen, cuando todavia no hay variables de entorno definidas.
# El filtro descarta cadenas vacias: si la variable se deja en blanco en el
# panel de Render, env.list devuelve [""] y Django rechazaria todas las
# peticiones con DisallowedHost sin decir por que.
ALLOWED_HOSTS = [h.strip() for h in env.list("DJANGO_ALLOWED_HOSTS", default=[]) if h.strip()]

# Render publica el dominio del servicio en RENDER_EXTERNAL_HOSTNAME. Anadirlo
# solo evita el clasico DisallowedHost al desplegar y en cada health check, sin
# tener que acordarse del dominio exacto que asigna Render.
_render_host = env("RENDER_EXTERNAL_HOSTNAME", default="")
if _render_host:
    if _render_host not in ALLOWED_HOSTS:
        ALLOWED_HOSTS.append(_render_host)
    _render_origin = f"https://{_render_host}"
    if _render_origin not in CSRF_TRUSTED_ORIGINS:  # noqa: F405
        CSRF_TRUSTED_ORIGINS.append(_render_origin)  # noqa: F405

# Seguridad HTTPS
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = env.bool("SECURE_SSL_REDIRECT", default=True)

# El health check de Render entra por HTTP interno, sin X-Forwarded-Proto: con
# SECURE_SSL_REDIRECT activo recibiria un 301 y Render daria el deploy por
# fallido. Se exime esa unica ruta, que no expone nada sensible.
SECURE_REDIRECT_EXEMPT = [r"^healthz$"]

SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = env.int("SECURE_HSTS_SECONDS", default=2592000)
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_CONTENT_TYPE_NOSNIFF = True

# Correo del OTP. Render bloquea las conexiones salientes por los puertos de
# SMTP en las instancias free ("Network is unreachable" al abrir el socket),
# asi que con clave de Brevo se envia por su API HTTPS. Sin clave se cae a
# SMTP, que sirve en cualquier otro hosting que si permita la salida.
if BREVO_API_KEY:  # noqa: F405
    EMAIL_BACKEND = "apps.common.email_backends.BrevoAPIBackend"
else:
    EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"

# CORS estricto: solo los origenes declarados por variable de entorno
CORS_ALLOW_ALL_ORIGINS = False
