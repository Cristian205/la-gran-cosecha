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

# Sin esto los mensajes de nuestras apps por debajo de WARNING no llegan a la
# terminal, porque Django solo configura sus propios loggers.
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {"simple": {"format": "%(levelname)s %(name)s: %(message)s"}},
    "handlers": {
        "console": {"class": "logging.StreamHandler", "formatter": "simple"},
    },
    "loggers": {
        "apps": {"handlers": ["console"], "level": "INFO", "propagate": False},
    },
}
