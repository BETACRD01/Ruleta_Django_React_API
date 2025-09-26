# backend/settings.py
# Opción 1: Agregar al inicio de settings.py (después de los imports)
import os
from pathlib import Path
from django.core.management.utils import get_random_secret_key

# AGREGAR ESTAS LÍNEAS PARA CARGAR .env
from dotenv import load_dotenv
load_dotenv()

# También puedes especificar la ruta exacta si no funciona:
# load_dotenv(Path(__file__).resolve().parent.parent / '.env')

BASE_DIR = Path(__file__).resolve().parent.parent

# ──────────────────────────────────────────────────────────────────────────────
# Seguridad / Debug
# ──────────────────────────────────────────────────────────────────────────────
SECRET_KEY = os.getenv(
    "DJANGO_SECRET_KEY",
    get_random_secret_key()  # Genera una clave aleatoria si no existe
)
DEBUG = os.getenv("DJANGO_DEBUG", "1") == "1"

# Hosts permitidos
if DEBUG:
    ALLOWED_HOSTS = [
        "localhost",
        "127.0.0.1",
        "0.0.0.0",
    ]
else:
    ALLOWED_HOSTS = os.getenv("DJANGO_ALLOWED_HOSTS", "").split(",")

# ──────────────────────────────────────────────────────────────────────────────
# Apps
# ──────────────────────────────────────────────────────────────────────────────
DJANGO_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.sites",
]

THIRD_PARTY_APPS = [
    "rest_framework",
    "rest_framework.authtoken",
    "corsheaders",
    "ckeditor",
    "ckeditor_uploader",
]

LOCAL_APPS = [
    "authentication",
    "roulettes",
    "participants",
    "notifications",
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

SITE_ID = int(os.getenv("SITE_ID", "1"))

# ──────────────────────────────────────────────────────────────────────────────
# Middleware
# ──────────────────────────────────────────────────────────────────────────────
MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

# ──────────────────────────────────────────────────────────────────────────────
# URLs / Templates
# ──────────────────────────────────────────────────────────────────────────────
ROOT_URLCONF = "backend.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
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

WSGI_APPLICATION = "backend.wsgi.application"

# ──────────────────────────────────────────────────────────────────────────────
# Base de datos
# ──────────────────────────────────────────────────────────────────────────────
DATABASES = {
    "default": {
        "ENGINE": os.getenv("DB_ENGINE", "django.db.backends.sqlite3"),
        "NAME": os.getenv("DB_NAME", BASE_DIR / "db.sqlite3"),
        # Configuración para PostgreSQL (descomenta si usas Postgres):
        # "ENGINE": "django.db.backends.postgresql",
        # "NAME": os.getenv("POSTGRES_DB", "luckyspin_db"),
        # "USER": os.getenv("POSTGRES_USER", "postgres"),
        # "PASSWORD": os.getenv("POSTGRES_PASSWORD", ""),
        # "HOST": os.getenv("POSTGRES_HOST", "localhost"),
        # "PORT": os.getenv("POSTGRES_PORT", "5432"),
    }
}

# ──────────────────────────────────────────────────────────────────────────────
# Validación de contraseñas
# ──────────────────────────────────────────────────────────────────────────────
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# ──────────────────────────────────────────────────────────────────────────────
# Internacionalización
# ──────────────────────────────────────────────────────────────────────────────
LANGUAGE_CODE = "es-es"
TIME_ZONE = "America/Guayaquil"
USE_I18N = True
USE_TZ = True

# ──────────────────────────────────────────────────────────────────────────────
# Archivos estáticos y media
# ──────────────────────────────────────────────────────────────────────────────
STATIC_URL = "/static/"
STATICFILES_DIRS = [BASE_DIR / "static"] if (BASE_DIR / "static").exists() else []
STATIC_ROOT = BASE_DIR / "staticfiles"

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
AUTH_USER_MODEL = "authentication.User"

# ──────────────────────────────────────────────────────────────────────────────
# CKEditor Configuration
# ──────────────────────────────────────────────────────────────────────────────
CKEDITOR_UPLOAD_PATH = "ckeditor_uploads/"
CKEDITOR_IMAGE_BACKEND = "pillow"
CKEDITOR_ALLOW_NONIMAGE_FILES = False

CKEDITOR_CONFIGS = {
    'default': {
        'skin': 'moono-lisa',
        'toolbar': 'Custom',
        'toolbar_Custom': [
            ['Bold', 'Italic', 'Underline', 'Strike', '-', 'RemoveFormat'],
            ['NumberedList', 'BulletedList', '-', 'Outdent', 'Indent'],
            ['JustifyLeft', 'JustifyCenter', 'JustifyRight', 'JustifyBlock'],
            ['Link', 'Unlink', '-', 'Image', 'Table'],
            ['TextColor', 'BGColor'],
            ['Source', 'Maximize']
        ],
        'height': 300,
        'width': '100%',
        'removePlugins': 'stylesheetparser',
        'allowedContent': True,
        'extraPlugins': 'uploadimage,autogrow',
        'autoGrow_minHeight': 200,
        'autoGrow_maxHeight': 600,
        'removeButtons': '',
    },
    'roulette_editor': {
        'skin': 'moono-lisa',
        'toolbar': 'Minimal',
        'toolbar_Minimal': [
            ['Bold', 'Italic', 'Underline'],
            ['NumberedList', 'BulletedList'],
            ['Link', 'Unlink'],
            ['Image'],
            ['TextColor', 'BGColor'],
            ['RemoveFormat']
        ],
        'height': 200,
        'width': '100%',
        'removePlugins': 'stylesheetparser',
        'allowedContent': True,
        'extraPlugins': 'uploadimage',
    }
}

# ──────────────────────────────────────────────────────────────────────────────
# Django REST Framework
# ──────────────────────────────────────────────────────────────────────────────
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.TokenAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_PARSER_CLASSES": [
        "rest_framework.parsers.JSONParser",
        "rest_framework.parsers.FormParser",
        "rest_framework.parsers.MultiPartParser",
    ],
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
    ] + (["rest_framework.renderers.BrowsableAPIRenderer"] if DEBUG else []),
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle"
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": "100/hour",
        "user": "1000/hour"
    }
}

# ──────────────────────────────────────────────────────────────────────────────
# CORS Configuration
# ──────────────────────────────────────────────────────────────────────────────
CORS_ALLOW_CREDENTIALS = True

# URLs permitidas para CORS
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",  # Vite
    "http://127.0.0.1:5173",
]

# Solo para desarrollo local
CORS_ALLOWED_ORIGIN_REGEXES = [
    r"^http://192\.168\.\d{1,3}\.\d{1,3}:\d+$",  # Red local
    r"^http://10\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d+$",
] if DEBUG else []

CORS_ALLOW_HEADERS = [
    "accept",
    "accept-encoding",
    "authorization",
    "content-type",
    "dnt",
    "origin",
    "user-agent",
    "x-csrftoken",
    "x-requested-with",
    "cache-control",
    "pragma",
]

CORS_ALLOW_METHODS = [
    "DELETE",
    "GET",
    "OPTIONS", 
    "PATCH",
    "POST",
    "PUT"
]

# CSRF Configuration
CSRF_TRUSTED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
] + ([f"https://{host}" for host in os.getenv("DJANGO_ALLOWED_HOSTS", "").split(",") if host and host != "localhost"] if not DEBUG else [])

# En desarrollo, permite configuración más permisiva si es necesario
if DEBUG:
    CORS_ALLOW_ALL_ORIGINS = False

# ──────────────────────────────────────────────────────────────────────────────
# Configuración de Email - CORREGIDA
# ──────────────────────────────────────────────────────────────────────────────
EMAIL_BACKEND = os.getenv(
    "EMAIL_BACKEND", 
    "django.core.mail.backends.smtp.EmailBackend"
)

# Configuración de Gmail desde tu .env
EMAIL_HOST = os.getenv("EMAIL_HOST", "smtp.gmail.com")
EMAIL_PORT = int(os.getenv("EMAIL_PORT", "587"))
EMAIL_USE_TLS = os.getenv("EMAIL_USE_TLS", "1") == "1"
EMAIL_USE_SSL = os.getenv("EMAIL_USE_SSL", "0") == "1"
EMAIL_HOST_USER = os.getenv("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD", "")

# Emails por defecto - ACTUALIZADOS
DEFAULT_FROM_EMAIL = os.getenv("DEFAULT_FROM_EMAIL", "williancerda0@gmail.com")
SERVER_EMAIL = os.getenv("SERVER_EMAIL", DEFAULT_FROM_EMAIL)

# Configuraciones adicionales para Gmail
EMAIL_TIMEOUT = int(os.getenv("EMAIL_TIMEOUT", "60"))  # Aumentado para Gmail
EMAIL_SSL_CERTFILE = None
EMAIL_SSL_KEYFILE = None
EMAIL_USE_LOCALTIME = False

# Configuración específica para evitar problemas de conexión
if DEBUG:
    # En desarrollo, fallback a consola si falla SMTP
    EMAIL_BACKEND = os.getenv("EMAIL_BACKEND", "django.core.mail.backends.smtp.EmailBackend")
    if EMAIL_BACKEND == "django.core.mail.backends.smtp.EmailBackend":
        # Configuración robusta para Gmail
        EMAIL_CONNECTION_TIMEOUT = 60
        EMAIL_RETRY_DELAY = 2
        EMAIL_MAX_RETRIES = 3

# Tiempo de validez del token de reset (24 horas)
PASSWORD_RESET_TIMEOUT = int(os.getenv("PASSWORD_RESET_TIMEOUT", str(60 * 60 * 24)))

# ──────────────────────────────────────────────────────────────────────────────
# Configuración del Frontend
# ──────────────────────────────────────────────────────────────────────────────
FRONTEND_BASE_URL = os.getenv(
    "FRONTEND_BASE_URL",
    "http://localhost:3000" if DEBUG else "https://tu-dominio-frontend.com"
)

# ──────────────────────────────────────────────────────────────────────────────
# Configuración de uploads
# ──────────────────────────────────────────────────────────────────────────────
FILE_UPLOAD_MAX_MEMORY_SIZE = int(os.getenv("FILE_UPLOAD_MAX_MEMORY_SIZE", str(15 * 1024 * 1024)))  # 15 MB
DATA_UPLOAD_MAX_MEMORY_SIZE = int(os.getenv("DATA_UPLOAD_MAX_MEMORY_SIZE", str(30 * 1024 * 1024)))  # 30 MB

# Configuración específica para recibos
ALLOWED_RECEIPT_EXTENSIONS = [".jpg", ".jpeg", ".png", ".pdf"]
MAX_RECEIPT_SIZE = 10 * 1024 * 1024  # 10 MB

# ──────────────────────────────────────────────────────────────────────────────
# Configuración de Logging - CON DEBUG DE EMAIL
# ──────────────────────────────────────────────────────────────────────────────
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "{levelname} {asctime} {module} {process:d} {thread:d} {message}",
            "style": "{",
        },
        "simple": {
            "format": "{levelname} {message}",
            "style": "{",
        },
    },
    "handlers": {
        "file": {
            "level": "INFO",
            "class": "logging.FileHandler",
            "filename": BASE_DIR / "logs" / "django.log",
            "formatter": "verbose",
        },
        "console": {
            "level": "DEBUG" if DEBUG else "INFO",
            "class": "logging.StreamHandler",
            "formatter": "simple",
        },
        "mail_admins": {
            "level": "ERROR",
            "class": "django.utils.log.AdminEmailHandler",
            "formatter": "verbose",
        },
    },
    "loggers": {
        "django": {
            "handlers": ["console", "file"],
            "level": "INFO",
            "propagate": False,
        },
        "django.request": {
            "handlers": ["console", "file", "mail_admins"],
            "level": "ERROR",
            "propagate": False,
        },
        # AGREGADO: Logger específico para emails
        "django.core.mail": {
            "handlers": ["console", "file"],
            "level": "DEBUG" if DEBUG else "INFO",
            "propagate": False,
        },
        "authentication": {
            "handlers": ["console", "file"],
            "level": "DEBUG" if DEBUG else "INFO",
            "propagate": False,
        },
        "roulettes": {
            "handlers": ["console", "file"],
            "level": "DEBUG" if DEBUG else "INFO",
            "propagate": False,
        },
    },
    "root": {
        "handlers": ["console"],
        "level": "INFO",
    },
}

# Crear directorio de logs si no existe
(BASE_DIR / "logs").mkdir(exist_ok=True)

# ──────────────────────────────────────────────────────────────────────────────
# Configuración de producción
# ──────────────────────────────────────────────────────────────────────────────
if not DEBUG:
    # Configuraciones adicionales de seguridad para producción
    SECURE_BROWSER_XSS_FILTER = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    SECURE_HSTS_SECONDS = 31536000  # 1 año
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SECURE_SSL_REDIRECT = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    X_FRAME_OPTIONS = "DENY"
    
    # Configuración de email para producción (más estricta)
    EMAIL_TIMEOUT = 30
    
    # Configuración de archivos estáticos para producción
    # STATIC_ROOT debe configurarse según tu servidor web
    STATIC_ROOT = os.getenv("STATIC_ROOT", BASE_DIR / "staticfiles")
    
    # Configuración de base de datos para producción (PostgreSQL recomendado)
    if os.getenv("DATABASE_URL"):
        import dj_database_url
        DATABASES['default'] = dj_database_url.parse(os.getenv("DATABASE_URL"))
    
    # Configuración de caché con Redis para producción
    if os.getenv("REDIS_URL"):
        CACHES = {
            'default': {
                'BACKEND': 'django.core.cache.backends.redis.RedisCache',
                'LOCATION': os.getenv('REDIS_URL'),
                'TIMEOUT': 300,
                'OPTIONS': {
                    'CLIENT_CLASS': 'django_redis.client.DefaultClient',
                }
            }
        }
    
    # Logging más completo para producción
    if 'syslog' not in LOGGING['handlers']:
        LOGGING['handlers']['syslog'] = {
            'level': 'INFO',
            'class': 'logging.handlers.SysLogHandler',
            'formatter': 'verbose',
            'address': '/dev/log',
        }
        LOGGING['loggers']['django']['handlers'].append('syslog')

else:
    # Configuraciones de desarrollo
    SECURE_BROWSER_XSS_FILTER = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    X_FRAME_OPTIONS = "DENY"
    
    # Para desarrollo local (sin HTTPS)
    SECURE_SSL_REDIRECT = False
    SECURE_PROXY_SSL_HEADER = None
    SESSION_COOKIE_SECURE = False
    CSRF_COOKIE_SECURE = False

# ──────────────────────────────────────────────────────────────────────────────
# Configuraciones adicionales para la aplicación
# ──────────────────────────────────────────────────────────────────────────────

# Configuración de caché (opcional)
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'LOCATION': 'unique-snowflake',
        'TIMEOUT': 300,  # 5 minutos
        'OPTIONS': {
            'MAX_ENTRIES': 1000,
            'CULL_FREQUENCY': 3,
        }
    }
} if DEBUG else {
    'default': {
        'BACKEND': 'django.core.cache.backends.redis.RedisCache',
        'LOCATION': os.getenv('REDIS_URL', 'redis://127.0.0.1:6379/1'),
        'TIMEOUT': 300,
    }
}

# Configuración de sesiones
SESSION_ENGINE = 'django.contrib.sessions.backends.db'
SESSION_COOKIE_AGE = 60 * 60 * 24 * 7  # 1 semana
SESSION_COOKIE_NAME = 'luckyspin_sessionid'
SESSION_COOKIE_HTTPONLY = True
SESSION_SAVE_EVERY_REQUEST = True

# Configuración específica para Lucky Spin
ROULETTE_MAX_PRIZES = int(os.getenv("ROULETTE_MAX_PRIZES", "20"))
ROULETTE_MAX_PARTICIPANTS = int(os.getenv("ROULETTE_MAX_PARTICIPANTS", "1000"))
NOTIFICATION_BATCH_SIZE = int(os.getenv("NOTIFICATION_BATCH_SIZE", "50"))

# Configuración de archivos de imagen
IMAGE_QUALITY = int(os.getenv("IMAGE_QUALITY", "85"))
IMAGE_MAX_WIDTH = int(os.getenv("IMAGE_MAX_WIDTH", "1200"))
IMAGE_MAX_HEIGHT = int(os.getenv("IMAGE_MAX_HEIGHT", "1200"))