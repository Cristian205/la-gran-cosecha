"""
Configuración base compartida por todos los entornos.
Los valores sensibles y específicos de entorno se leen de variables de entorno
(.env) mediante django-environ. Ver .env.example.
"""
from datetime import timedelta
from pathlib import Path

import environ

# BASE_DIR apunta a backend/
BASE_DIR = Path(__file__).resolve().parent.parent.parent

env = environ.Env(
    DEBUG=(bool, False),
)

# Lee un archivo .env ubicado en backend/.env si existe
environ.Env.read_env(BASE_DIR / ".env")

# ==========================================================================
# SEGURIDAD
# ==========================================================================
SECRET_KEY = env("DJANGO_SECRET_KEY", default="unsafe-dev-key-change-me")
DEBUG = env.bool("DJANGO_DEBUG", default=False)
ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS", default=["localhost", "127.0.0.1"])

# ==========================================================================
# APLICACIONES
# ==========================================================================
DJANGO_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.humanize",
]

THIRD_PARTY_APPS = [
    "rest_framework",
    "rest_framework_simplejwt",
    "corsheaders",
    "django_filters",
]

LOCAL_APPS = [
    "apps.common",
    "apps.tenancy",
    "apps.billing",
    "apps.business",
    "apps.accounts",
    "apps.catalog",
    "apps.inventory",
    "apps.orders",
    "apps.pos",
    "apps.reservations",
    "apps.contact",
    "apps.content",
    "apps.storefront",
    "apps.notifications",
    "apps.media",
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

# ==========================================================================
# MIDDLEWARE
# ==========================================================================
MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "apps.tenancy.middleware.TenantMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "apps.accounts.middleware.ForzarCambioPasswordMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

# ==========================================================================
# BASE DE DATOS (PostgreSQL)
# ==========================================================================
DATABASES = {
    "default": env.db("DATABASE_URL")
}
DATABASES["default"]["CONN_MAX_AGE"] = env.int("DB_CONN_MAX_AGE", default=0)

# El pooler de Supabase en transaction mode (puerto 6543) reparte la MISMA
# conexión de servidor entre peticiones distintas, así que no puede sostener ni
# conexiones persistentes ni cursores del lado del servidor: los dos dependen
# de un estado que ya no le pertenece a nadie. Se corrige aquí en vez de en el
# .env porque olvidarlo no da un error claro, da resultados que se mezclan.
if str(DATABASES["default"].get("PORT")) == "6543":
    DATABASES["default"]["CONN_MAX_AGE"] = 0
    DATABASES["default"]["DISABLE_SERVER_SIDE_CURSORS"] = True

# ==========================================================================
# MODELO DE USUARIO PERSONALIZADO
# ==========================================================================
AUTH_USER_MODEL = "accounts.Usuario"

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
        "OPTIONS": {"min_length": 8},
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]

# ==========================================================================
# INTERNACIONALIZACIÓN
# ==========================================================================
LANGUAGE_CODE = "es-co"
TIME_ZONE = "America/Bogota"
USE_I18N = True
USE_TZ = True

# ==========================================================================
# ARCHIVOS ESTÁTICOS Y MEDIA
# ==========================================================================
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

MEDIA_URL = "/media/"
MEDIA_ROOT = env("MEDIA_ROOT", default=str(BASE_DIR / "media"))

# WhiteNoise: sirve estáticos comprimidos en producción sin depender de nginx.
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"
    },
}

# --------------------------------------------------------------------------
# Cloudflare R2 para los archivos subidos (media)
# --------------------------------------------------------------------------
# R2 habla el protocolo de S3, asi que se usa el backend S3 de django-storages.
# Solo se activa si estan las cuatro credenciales: sin ellas todo sigue
# guardandose en disco local, que es lo que se quiere en desarrollo.
R2_ACCOUNT_ID = env("R2_ACCOUNT_ID", default="")
R2_ACCESS_KEY_ID = env("R2_ACCESS_KEY_ID", default="")
R2_SECRET_ACCESS_KEY = env("R2_SECRET_ACCESS_KEY", default="")
R2_BUCKET_NAME = env("R2_BUCKET_NAME", default="")
# Dominio publico del bucket: el subdominio r2.dev que activa Cloudflare, o un
# dominio propio conectado al bucket. Sin el hay que firmar cada URL.
R2_PUBLIC_URL = env("R2_PUBLIC_URL", default="")
# Prefijo dentro del bucket. Mantiene las claves como media/categorias/foo.jpg,
# igual que las rutas que ya hay guardadas en la base de datos.
R2_LOCATION = env("R2_LOCATION", default="media")

USE_R2 = all([R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME])

if USE_R2:
    from botocore.config import Config as _BotoConfig

    _r2_dominio = R2_PUBLIC_URL.replace("https://", "").replace("http://", "").rstrip("/")

    STORAGES["default"] = {
        "BACKEND": "storages.backends.s3.S3Storage",
        "OPTIONS": {
            "bucket_name": R2_BUCKET_NAME,
            "access_key": R2_ACCESS_KEY_ID,
            "secret_key": R2_SECRET_ACCESS_KEY,
            "endpoint_url": f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
            # R2 no tiene regiones al estilo AWS, pero boto3 exige uno.
            "region_name": "auto",
            "location": R2_LOCATION,
            # R2 no implementa las ACL de S3: mandar una da error. El acceso
            # publico se concede en el panel de Cloudflare, no por objeto.
            "default_acl": None,
            "querystring_auth": not bool(_r2_dominio),
            "custom_domain": _r2_dominio or None,
            # Sin esto un archivo con nombre repetido pisaria al anterior.
            "file_overwrite": False,
            "client_config": _BotoConfig(
                signature_version="s3v4",
                # boto3 >= 1.36 anade checksums CRC32 que R2 rechaza con
                # "not implemented". Se calculan solo cuando el API los exige.
                request_checksum_calculation="when_required",
                response_checksum_validation="when_required",
            ),
        },
    }

    # Con dominio publico las URLs las construye el propio storage; MEDIA_URL
    # se deja coherente para el codigo que aun lo consulte.
    if _r2_dominio:
        MEDIA_URL = f"https://{_r2_dominio}/{R2_LOCATION}/"

# ==========================================================================
# MULTIEMPRESA (TENANCY)
# ==========================================================================
# Permite elegir el negocio con la cabecera X-Tenant. Solo para desarrollo y
# tests: sin la comprobacion de pertenencia que trae la fase 4, en produccion
# seria un cambio de negocio a voluntad. Ver apps/tenancy/middleware.py.
TENANCY_ACEPTA_CABECERA = env.bool("TENANCY_ACEPTA_CABECERA", default=False)

# Clave compartida con el servidor de la tienda (Next.js). Ese servidor
# renderiza la pagina del visitante y pide el catalogo del negocio que toca,
# pero llama desde su propio host, asi que el Host no lo identifica. La clave
# distingue esa llamada de servidor a servidor de cualquiera hecha desde un
# navegador. Vacia = desactivada. NUNCA debe llegar al cliente.
TENANCY_CLAVE_SERVIDOR = env("TENANCY_CLAVE_SERVIDOR", default="")

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ==========================================================================
# DJANGO REST FRAMEWORK
# ==========================================================================
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_PAGINATION_CLASS": "apps.common.pagination.DefaultPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_FILTER_BACKENDS": (
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ),
}

# ==========================================================================
# SIMPLE JWT
# ==========================================================================
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(
        minutes=env.int("JWT_ACCESS_MINUTES", default=30)
    ),
    "REFRESH_TOKEN_LIFETIME": timedelta(
        days=env.int("JWT_REFRESH_DAYS", default=1)
    ),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": False,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
}

# ==========================================================================
# CORS
# ==========================================================================
def origenes(nombre, defecto):
    """
    Una lista de orígenes leída del entorno, normalizada.

    `env.list` parte por comas y no toca nada más, así que
    `A, https://b.com/` da un espacio delante del segundo y una barra al final.
    Las dos cosas son inválidas para `django-cors-headers`, que lo comprueba en
    el arranque —`corsheaders.E014`— y tumba el despliegue entero antes de
    servir la primera petición.

    Y eso es lo que pasó: el backend llevaba días sin desplegarse por una barra
    de más en una variable de Render, mientras se buscaba el fallo en la tienda.
    El síntoma no se parecía en nada a la causa.

    Un origen es esquema + host + puerto y nada más. Se recorta lo que sobra en
    vez de rechazarlo: quien pega una URL desde la barra del navegador la pega
    con la barra final, y esa es la forma normal de escribirla.
    """
    limpios = []
    for bruto in env.list(nombre, default=defecto):
        origen = bruto.strip().rstrip("/")
        if origen and origen not in limpios:
            limpios.append(origen)
    return limpios


#: La tienda NO necesita estar aquí. Sus llamadas salen del servidor de Next,
#: no del navegador, así que no hay origen que comprobar; lo que la acredita es
#: `TENANCY_CLAVE_SERVIDOR`. Los que van aquí son los paneles.
CORS_ALLOWED_ORIGINS = origenes(
    "CORS_ALLOWED_ORIGINS",
    [
        "http://localhost:5173",  # storefront (Vite)
        "http://localhost:5174",  # admin-panel (Vite)
    ],
)
CSRF_TRUSTED_ORIGINS = origenes(
    "CSRF_TRUSTED_ORIGINS",
    ["http://localhost:5173", "http://localhost:5174"],
)

# ==========================================================================
# CORREO (OTP administrativo)
# ==========================================================================
EMAIL_BACKEND = env(
    "EMAIL_BACKEND",
    default="django.core.mail.backends.console.EmailBackend",
)
EMAIL_HOST = env("EMAIL_HOST", default="smtp.gmail.com")
EMAIL_PORT = env.int("EMAIL_PORT", default=587)
EMAIL_USE_TLS = env.bool("EMAIL_USE_TLS", default=True)
EMAIL_HOST_USER = env("EMAIL_HOST_USER", default="")
EMAIL_HOST_PASSWORD = env("EMAIL_HOST_PASSWORD", default="")
DEFAULT_FROM_EMAIL = env(
    "DEFAULT_FROM_EMAIL",
    default="Seguridad Crynex <no-reply@crynex.local>",
)
EMAIL_TIMEOUT = 15

# Clave de la API de Brevo. Si esta puesta, produccion envia por HTTPS en vez
# de SMTP (ver prod.py): Render bloquea los puertos SMTP salientes.
BREVO_API_KEY = env("BREVO_API_KEY", default="")

# ==========================================================================
# PARÁMETROS DE NEGOCIO / OTP
# ==========================================================================
OTP_EXPIRY_MINUTES = env.int("OTP_EXPIRY_MINUTES", default=10)
# Firma del ticket pre-auth entre paso 1 (password) y paso 2 (OTP)
OTP_TICKET_SALT = "accounts.otp.ticket"
