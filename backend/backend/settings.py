# backend/settings.py
import os
from pathlib import Path
from django.core.management.utils import get_random_secret_key

# AGREGAR ESTAS LÍNEAS PARA CARGAR .env
from dotenv import load_dotenv
load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

# ──────────────────────────────────────────────────────────────────────────────
# Seguridad / Debug
# ──────────────────────────────────────────────────────────────────────────────
SECRET_KEY = os.getenv(
    "DJANGO_SECRET_KEY",
    "django-insecure-dev-key-k8x@9m#p2w$v4n5q7r&t9y*u3i6o0p-a1s2d3f4g5h6j7"
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
    "django_celery_beat",
    "django_celery_results",
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
        "USER": os.getenv("DB_USER", ""),
        "PASSWORD": os.getenv("DB_PASSWORD", ""),
        "HOST": os.getenv("DB_HOST", "localhost"),
        "PORT": os.getenv("DB_PORT", "5432"),
    }
}

# ──────────────────────────────────────────────────────────────────────────────
# Validación de contraseñas - SIMPLIFICADA
# ──────────────────────────────────────────────────────────────────────────────
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
        'OPTIONS': {
            'min_length': 6,  # Mínimo 6 caracteres
        }
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
        # Solo evita contraseñas muy obvias como "123456", "password"
    },
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

CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

CORS_ALLOWED_ORIGIN_REGEXES = [
    r"^http://192\.168\.\d{1,3}\.\d{1,3}:\d+$",
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

CORS_ALLOW_METHODS = ["DELETE", "GET", "OPTIONS", "PATCH", "POST", "PUT"]

CSRF_TRUSTED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
] + ([f"https://{host}" for host in os.getenv("DJANGO_ALLOWED_HOSTS", "").split(",") if host and host != "localhost"] if not DEBUG else [])

if DEBUG:
    CORS_ALLOW_ALL_ORIGINS = False

# ──────────────────────────────────────────────────────────────────────────────
# Configuración de Email - LEE TODO DESDE .env
# ──────────────────────────────────────────────────────────────────────────────
# NOTA: 
# - Desarrollo local: EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend
# - Producción: EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
# - Todo se controla desde el archivo .env
# ──────────────────────────────────────────────────────────────────────────────

EMAIL_BACKEND = os.getenv("EMAIL_BACKEND", "django.core.mail.backends.console.EmailBackend")

# Solo configurar SMTP si no es console backend
if EMAIL_BACKEND != "django.core.mail.backends.console.EmailBackend":
    EMAIL_HOST = os.getenv("EMAIL_HOST", "smtp-relay.brevo.com")
    EMAIL_PORT = int(os.getenv("EMAIL_PORT", "587"))
    EMAIL_USE_TLS = os.getenv("EMAIL_USE_TLS", "1") == "1"
    EMAIL_USE_SSL = os.getenv("EMAIL_USE_SSL", "0") == "1"
    EMAIL_HOST_USER = os.getenv("EMAIL_HOST_USER", "")
    EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD", "")
    EMAIL_TIMEOUT = int(os.getenv("EMAIL_TIMEOUT", "60"))
    EMAIL_SSL_CERTFILE = None
    EMAIL_SSL_KEYFILE = None
    EMAIL_USE_LOCALTIME = False
    
    if DEBUG:
        EMAIL_CONNECTION_TIMEOUT = 60
        EMAIL_RETRY_DELAY = 2
        EMAIL_MAX_RETRIES = 3

DEFAULT_FROM_EMAIL = os.getenv("DEFAULT_FROM_EMAIL", "williancerda0@gmail.com")
SERVER_EMAIL = os.getenv("SERVER_EMAIL", DEFAULT_FROM_EMAIL)
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
FILE_UPLOAD_MAX_MEMORY_SIZE = int(os.getenv("FILE_UPLOAD_MAX_MEMORY_SIZE", str(15 * 1024 * 1024)))
DATA_UPLOAD_MAX_MEMORY_SIZE = int(os.getenv("DATA_UPLOAD_MAX_MEMORY_SIZE", str(30 * 1024 * 1024)))

ALLOWED_RECEIPT_EXTENSIONS = [".jpg", ".jpeg", ".png", ".pdf"]
MAX_RECEIPT_SIZE = 10 * 1024 * 1024

# ──────────────────────────────────────────────────────────────────────────────
# Configuración de Logging
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

(BASE_DIR / "logs").mkdir(exist_ok=True)

# ──────────────────────────────────────────────────────────────────────────────
# Configuración de producción
# ──────────────────────────────────────────────────────────────────────────────
if not DEBUG:
    SECURE_BROWSER_XSS_FILTER = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SECURE_SSL_REDIRECT = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    X_FRAME_OPTIONS = "DENY"
    EMAIL_TIMEOUT = 30
    STATIC_ROOT = os.getenv("STATIC_ROOT", BASE_DIR / "staticfiles")
    
    if os.getenv("DATABASE_URL"):
        import dj_database_url
        DATABASES['default'] = dj_database_url.parse(os.getenv("DATABASE_URL"))
    
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
    
    if 'syslog' not in LOGGING['handlers']:
        LOGGING['handlers']['syslog'] = {
            'level': 'INFO',
            'class': 'logging.handlers.SysLogHandler',
            'formatter': 'verbose',
            'address': '/dev/log',
        }
        LOGGING['loggers']['django']['handlers'].append('syslog')
else:
    SECURE_BROWSER_XSS_FILTER = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    X_FRAME_OPTIONS = "DENY"
    SECURE_SSL_REDIRECT = False
    SECURE_PROXY_SSL_HEADER = None
    SESSION_COOKIE_SECURE = False
    CSRF_COOKIE_SECURE = False

# ──────────────────────────────────────────────────────────────────────────────
# Configuraciones adicionales
# ──────────────────────────────────────────────────────────────────────────────
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'LOCATION': 'unique-snowflake',
        'TIMEOUT': 300,
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

SESSION_ENGINE = 'django.contrib.sessions.backends.db'
SESSION_COOKIE_AGE = 60 * 60 * 24 * 7
SESSION_COOKIE_NAME = 'luckyspin_sessionid'
SESSION_COOKIE_HTTPONLY = True
SESSION_SAVE_EVERY_REQUEST = True

ROULETTE_MAX_PRIZES = int(os.getenv("ROULETTE_MAX_PRIZES", "20"))
ROULETTE_MAX_PARTICIPANTS = int(os.getenv("ROULETTE_MAX_PARTICIPANTS", "1000"))
NOTIFICATION_BATCH_SIZE = int(os.getenv("NOTIFICATION_BATCH_SIZE", "50"))

IMAGE_QUALITY = int(os.getenv("IMAGE_QUALITY", "85"))
IMAGE_MAX_WIDTH = int(os.getenv("IMAGE_MAX_WIDTH", "1200"))
IMAGE_MAX_HEIGHT = int(os.getenv("IMAGE_MAX_HEIGHT", "1200"))

# ============================================================================
# CELERY CONFIGURATION
# ============================================================================
ENVIRONMENT = os.getenv('ENVIRONMENT', 'development')

if ENVIRONMENT == 'production':
    # Producción: usar Redis Cloud con SSL
    redis_url = os.getenv('REDIS_CLOUD_URL')
    print("Modo PRODUCCION: usando Redis Cloud")
else:
    # Desarrollo: usar Redis Local (Docker)
    redis_url = os.getenv('CELERY_BROKER_URL', 'redis://localhost:6379/0')
    print(f"Modo DESARROLLO: usando {redis_url}")

# Configurar URLs de Celery
CELERY_BROKER_URL = redis_url
CELERY_RESULT_BACKEND = redis_url

# Configuración de serialización
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = TIME_ZONE
CELERY_ENABLE_UTC = True

# Configuración de reintentos
CELERY_TASK_ACKS_LATE = True
CELERY_TASK_REJECT_ON_WORKER_LOST = True
CELERY_WORKER_PREFETCH_MULTIPLIER = 1

# Tiempo máximo de ejecución de tareas
CELERY_TASK_TIME_LIMIT = 300  # 5 minutos
CELERY_TASK_SOFT_TIME_LIMIT = 240  # 4 minutos

# Configuración de resultados
CELERY_RESULT_EXPIRES = 3600  # 1 hora
CELERY_RESULT_EXTENDED = True

# Configuración específica para notificaciones
WINNER_NOTIFICATION_DELAY = int(os.getenv('WINNER_NOTIFICATION_DELAY', '300'))

# Configuración de la marca
BRAND_NAME = os.getenv("BRAND_NAME", "LuckySpin")
MEDIA_URL_BASE = os.getenv("MEDIA_URL_BASE", "http://localhost:8000")