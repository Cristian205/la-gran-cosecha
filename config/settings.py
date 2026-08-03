import os
from pathlib import Path

# 1. RUTAS BASE
BASE_DIR = Path(__file__).resolve().parent.parent

# 2. SEGURIDAD
SECRET_KEY = 'django-insecure-=3lqwdjc!mn!r8((i@!^+$+699%b04bq3e6rye7p0(-^m7lb#7'
DEBUG = True 
ALLOWED_HOSTS = ['*']

# 3. APLICACIONES
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'django.contrib.humanize',
    
    # Tu App
    'apps.ui', 
]

# 4. MIDDLEWARE (El orden es vital: Sessions antes que Auth)
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

# 5. MOTOR DE PLANTILLAS
TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

# 6. BASE DE DATOS (PostgreSQL)
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': 'la_gran_cosecha',
        'USER': 'postgres',
        'PASSWORD': 'postgresql12',
        'HOST': 'localhost',
        'PORT': '5432',
        'CONN_MAX_AGE': 600,
    }
}

# 7. MODELO DE USUARIO PERSONALIZADO
# Apunta al modelo que definiste en apps/ui/models.py
AUTH_USER_MODEL = 'ui.Usuario' 

# 8. CONFIGURACIÓN DE SESIONES (SOLUCIÓN AL ERROR DE EXPIRACIÓN)
# Forzamos a Django a ser "agresivo" guardando la sesión para que el 2FA no falle
SESSION_ENGINE = 'django.contrib.sessions.backends.db'
SESSION_COOKIE_AGE = 1200             # 20 minutos de vida
SESSION_SAVE_EVERY_REQUEST = True     # CRÍTICO: Guarda la sesión en cada respuesta
SESSION_EXPIRE_AT_BROWSER_CLOSE = False # Mantiene la sesión viva entre pasos del login
SESSION_COOKIE_HTTPONLY = True        # Seguridad contra scripts maliciosos
SESSION_COOKIE_SAMESITE = 'Lax'       # Permite que la cookie fluya en el login
SESSION_COOKIE_SECURE = False         # False porque estás en desarrollo (HTTP)
CSRF_COOKIE_SAMESITE = 'Lax'
CSRF_TRUSTED_ORIGINS = ['http://localhost:8000', 'http://127.0.0.1:8000']

# 9. INTERNACIONALIZACIÓN
LANGUAGE_CODE = 'es-co'
TIME_ZONE = 'America/Bogota'
USE_I18N = True
USE_TZ = True

# 10. ARCHIVOS ESTÁTICOS
STATIC_URL = '/static/'
STATICFILES_DIRS = [BASE_DIR / "static"]
STATIC_ROOT = BASE_DIR / "staticfiles"

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media' 

# 11. CONFIGURACIÓN DE CORREO (GMAIL SMTP)
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = 'smtp.gmail.com'
EMAIL_PORT = 587
EMAIL_USE_TLS = True
EMAIL_HOST_USER = 'cdrg0782@gmail.com'
EMAIL_HOST_PASSWORD = 'qkxf ciju lqhd urzw' # Tu Contraseña de Aplicación
DEFAULT_FROM_EMAIL = 'Seguridad La Gran Cosecha <danicrg05@gmail.com>'
EMAIL_TIMEOUT = 10

# 12. OTROS
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
LOGIN_URL = '/login/'
LOGIN_REDIRECT_URL = '/dashboard/'
LOGOUT_REDIRECT_URL = '/login/'