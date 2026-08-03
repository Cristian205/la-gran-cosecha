"""Configuración de desarrollo."""
from .base import *  # noqa: F401,F403
from .base import env

DEBUG = env.bool("DJANGO_DEBUG", default=True)

ALLOWED_HOSTS = ["*"]

# En desarrollo permitimos cualquier origen local para agilizar el trabajo
CORS_ALLOW_ALL_ORIGINS = True

# Por defecto, en dev el correo se imprime en consola (no se envía de verdad)
EMAIL_BACKEND = env(
    "EMAIL_BACKEND",
    default="django.core.mail.backends.console.EmailBackend",
)
