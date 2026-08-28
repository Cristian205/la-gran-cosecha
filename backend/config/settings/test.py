"""
Configuración para la suite de tests.

Existe por una razón de seguridad concreta: `base.py` lee `backend/.env`, y ese
archivo apunta a la base de datos de **producción en Supabase**. Sin este módulo,
un `pytest` con los settings de dev intentaría crear `test_postgres` contra la
instancia real. Aquí la base de datos se define DESPUÉS de importar base, así que
lo que venga del .env queda pisado sin excepción.

Por defecto se usa SQLite en memoria: arranca sin instalar nada y hace la suite
utilizable desde el primer día. Para las pruebas que necesitan PostgreSQL de
verdad — la de Row-Level Security de la fase 3, que es la que verifica que la
base de datos aísla aunque el ORM falle — se define TEST_DATABASE_URL:

    TEST_DATABASE_URL=postgres://usuario:clave@localhost:5432/lgc_test pytest
"""
from .base import *  # noqa: F401,F403
from .base import env

DEBUG = False

# --------------------------------------------------------------------------
# Base de datos
# --------------------------------------------------------------------------
_url_test = env("TEST_DATABASE_URL", default="")

if _url_test:
    DATABASES = {"default": env.db_url_config(_url_test)}
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": ":memory:",
        }
    }

# Sin esto Django reutiliza el CONN_MAX_AGE de base.py y deja conexiones
# colgando entre tests.
DATABASES["default"]["CONN_MAX_AGE"] = 0

# `USA_POSTGRES_EN_TESTS` lo consultan los tests que no pueden correr en SQLite
# (RLS, constraints diferidos) para saltarse solos en vez de fallar en falso.
USA_POSTGRES_EN_TESTS = bool(_url_test)

# --------------------------------------------------------------------------
# Velocidad y aislamiento del entorno
# --------------------------------------------------------------------------
# El hasher por defecto de Django es deliberadamente lento; en una suite con
# decenas de usuarios de prueba domina el tiempo total.
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]

# Ningún correo sale de verdad: los tests del flujo OTP leen mail.outbox.
EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"

# Los archivos de prueba nunca deben acabar en Cloudflare R2 ni en media/.
USE_R2 = False
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.InMemoryStorage"},
    "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
}

# WhiteNoise con el storage comprimido exige un manifest de collectstatic que en
# tests no existe; el de arriba lo evita.

ALLOWED_HOSTS = ["*"]

# La suite y el desarrollo local eligen el negocio por cabecera.
TENANCY_ACEPTA_CABECERA = True

# App de soporte con un modelo que hereda de ModeloConTenant, para poder probar
# el manager con ambito antes de que ningun modelo de negocio lo use (fase 2).
INSTALLED_APPS = INSTALLED_APPS + ["tests.soporte"]  # noqa: F405
CORS_ALLOW_ALL_ORIGINS = True

# Los tests de aislamiento crean muchos objetos y comprueban listados enteros;
# una página de 20 los partiría y daría falsos verdes.
REST_FRAMEWORK = {**REST_FRAMEWORK, "PAGE_SIZE": 200}  # noqa: F405
