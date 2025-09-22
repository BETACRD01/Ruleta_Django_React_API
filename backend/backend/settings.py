# backend/settings.py
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

# ──────────────────────────────────────────────────────────────────────────────
# Seguridad / Debug
# ──────────────────────────────────────────────────────────────────────────────
SECRET_KEY = os.getenv(
    "DJANGO_SECRET_KEY",
    "django-insecure-$36c+h%#sne8*e%#*wk$kyevmjl18wzhz-ey_5@bmq&!=_#l4t"
)
DEBUG = os.getenv("DJANGO_DEBUG", "1") == "1"

# En desarrollo, acepta cualquier host (incluye túneles)
# En producción, lista explícitamente tus dominios.
if DEBUG:
    ALLOWED_HOSTS = [
        "*",
        "localhost",
        "127.0.0.1",
        "0.0.0.0",
        "l398g94m-8000.brs.devtunnels.ms",  # Tu túnel Django específico
        "l398g94m-3000.brs.devtunnels.ms",  # Tu túnel React específico
        "*.brs.devtunnels.ms",  # Permite cualquier subdominio del túnel
        "*.ngrok.io",           # Por si usas ngrok también
        "*.ngrok-free.app",     # Nuevos dominios de ngrok
    ]
else:
    ALLOWED_HOSTS = os.getenv("DJANGO_ALLOWED_HOSTS", "localhost").split(",")

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
    "django.contrib.sites",  # para generar enlaces con dominio correcto
]

THIRD_PARTY_APPS = [
    "rest_framework",
    "rest_framework.authtoken",
    "corsheaders",
    "ckeditor",          # ← CKEditor base
    "ckeditor_uploader", # ← CKEditor con subida de archivos
    # "channels",  # ← habilita si vas a usar WebSockets
]

LOCAL_APPS = [
    "authentication",
    "roulettes",
    "participants",
    "notifications",
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

# Sites framework (Admin → Sites → configura tu dominio)
SITE_ID = int(os.getenv("SITE_ID", "1"))

# ──────────────────────────────────────────────────────────────────────────────
# Middleware (CORS lo primero)
# ──────────────────────────────────────────────────────────────────────────────
MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    # Si usas SessionAuthentication + browsable API, reactiva CSRF:
    # "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

# ──────────────────────────────────────────────────────────────────────────────
# URLs / WSGI / ASGI
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
# Si activas Channels:
# ASGI_APPLICATION = "backend.asgi.application"

# ──────────────────────────────────────────────────────────────────────────────
# Base de datos
# ──────────────────────────────────────────────────────────────────────────────
DATABASES = {
    "default": {
        "ENGINE": os.getenv("DB_ENGINE", "django.db.backends.sqlite3"),
        "NAME": os.getenv("DB_NAME", BASE_DIR / "db.sqlite3"),
        # Si usas Postgres:
        # "ENGINE": "django.db.backends.postgresql",
        # "NAME": os.getenv("POSTGRES_DB","mydb"),
        # "USER": os.getenv("POSTGRES_USER","user"),
        # "PASSWORD": os.getenv("POSTGRES_PASSWORD","pass"),
        # "HOST": os.getenv("POSTGRES_HOST","localhost"),
        # "PORT": os.getenv("POSTGRES_PORT","5432"),
    }
}

# ──────────────────────────────────────────────────────────────────────────────
# Passwords
# ──────────────────────────────────────────────────────────────────────────────
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# ──────────────────────────────────────────────────────────────────────────────
# I18N / TZ
# ──────────────────────────────────────────────────────────────────────────────
LANGUAGE_CODE = "es-es"
TIME_ZONE = "America/Guayaquil"
USE_I18N = True
USE_TZ = True  # DB guarda en UTC; presentación en tu TZ

# ──────────────────────────────────────────────────────────────────────────────
# Static / Media
# ──────────────────────────────────────────────────────────────────────────────
STATIC_URL = "/static/"
# No fallar si la carpeta no existe en dev:
STATICFILES_DIRS = [BASE_DIR / "static"] if (BASE_DIR / "static").exists() else []
STATIC_ROOT = BASE_DIR / "staticfiles"

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
AUTH_USER_MODEL = "authentication.User"

# ──────────────────────────────────────────────────────────────────────────────
# CKEditor Configuration
# ──────────────────────────────────────────────────────────────────────────────
# Directorio donde CKEditor guardará archivos subidos
CKEDITOR_UPLOAD_PATH = "ckeditor_uploads/"

# Backend para procesar imágenes (requiere Pillow)
CKEDITOR_IMAGE_BACKEND = "pillow"

# Restricciones de archivos
CKEDITOR_ALLOW_NONIMAGE_FILES = False  # Solo imágenes por defecto

# Configuraciones del editor
CKEDITOR_CONFIGS = {
    'default': {
        'skin': 'moono-lisa',
        'toolbar_Basic': [
            ['Source', '-', 'Bold', 'Italic']
        ],
        'toolbar_YourCustomToolbarConfig': [
            {'name': 'document', 'items': ['Source', '-', 'Save', 'NewPage', 'Preview', 'Print', '-', 'Templates']},
            {'name': 'clipboard', 'items': ['Cut', 'Copy', 'Paste', 'PasteText', 'PasteFromWord', '-', 'Undo', 'Redo']},
            {'name': 'editing', 'items': ['Find', 'Replace', '-', 'SelectAll']},
            '/',
            {'name': 'basicstyles',
             'items': ['Bold', 'Italic', 'Underline', 'Strike', 'Subscript', 'Superscript', '-', 'RemoveFormat']},
            {'name': 'paragraph',
             'items': ['NumberedList', 'BulletedList', '-', 'Outdent', 'Indent', '-', 'Blockquote', 'CreateDiv', '-',
                       'JustifyLeft', 'JustifyCenter', 'JustifyRight', 'JustifyBlock', '-', 'BidiLtr', 'BidiRtl',
                       'Language']},
            {'name': 'links', 'items': ['Link', 'Unlink', 'Anchor']},
            {'name': 'insert',
             'items': ['Image', 'Flash', 'Table', 'HorizontalRule', 'Smiley', 'SpecialChar', 'PageBreak', 'Iframe']},
            '/',
            {'name': 'styles', 'items': ['Styles', 'Format', 'Font', 'FontSize']},
            {'name': 'colors', 'items': ['TextColor', 'BGColor']},
            {'name': 'tools', 'items': ['Maximize', 'ShowBlocks']},
            {'name': 'about', 'items': ['About']},
            '/',  # put this to force next toolbar on new line
            {'name': 'yourcustomtools', 'items': [
                # put the name of your editor.ui.addButton here
                'Preview',
                'Maximize',
            ]},
        ],
        'toolbar': 'YourCustomToolbarConfig',  # put selected toolbar config here
        'toolbarGroups': [{ 'name': 'document', 'groups': [ 'mode', 'document', 'doctools' ] }],
        'height': 291,
        'width': '100%',
        'filebrowserWindowHeight': 725,
        'filebrowserWindowWidth': 940,
        'toolbarCanCollapse': True,
        'mathJaxLib': '//cdn.mathjax.org/mathjax/2.2-latest/MathJax.js?config=TeX-AMS_HTML',
        'tabSpaces': 4,
        'extraPlugins': ','.join([
            'uploadimage', # the upload image feature
            # your extra plugins here
            'div',
            'autolink',
            'autoembed',
            'embedsemantic',
            'autogrow',
            'devtools',
            'widget',
            'lineutils',
            'clipboard',
            'dialog',
            'dialogui',
            'elementspath'
        ]),
    },
    # Configuración simplificada para ruletas
    'roulette_editor': {
        'toolbar': 'Custom',
        'toolbar_Custom': [
            ['Bold', 'Italic', 'Underline', 'Strike'],
            ['NumberedList', 'BulletedList'],
            ['Link', 'Unlink'],
            ['Image', 'Table'],
            ['TextColor', 'BGColor'],
            ['Source', 'RemoveFormat']
        ],
        'height': 300,
        'width': '100%',
        'removePlugins': 'stylesheetparser',
        'allowedContent': True,
        'extraPlugins': 'uploadimage',
    }
}

# ──────────────────────────────────────────────────────────────────────────────
# DRF
# ──────────────────────────────────────────────────────────────────────────────
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        # Front usa TokenAuth por header → evita CSRF
        "rest_framework.authentication.TokenAuthentication",
        # Para usar browsable API con sesiones, habilita también:
        # "rest_framework.authentication.SessionAuthentication",
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
        # En desarrollo puedes habilitar la UI browsable:
        # "rest_framework.renderers.BrowsableAPIRenderer",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
}

# ──────────────────────────────────────────────────────────────────────────────
# CORS (configuración completa para túneles y desarrollo)
# ──────────────────────────────────────────────────────────────────────────────
CORS_ALLOW_CREDENTIALS = True

# URLs específicas permitidas
CORS_ALLOWED_ORIGINS = [
    # Desarrollo local
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8080",
    "http://127.0.0.1:8080",
    "http://localhost:5173",  # Vite dev server
    "http://127.0.0.1:5173",
    
    # Túneles BrowserStack (HTTPS)
    "https://l398g94m-3000.brs.devtunnels.ms",  # React frontend
    "https://l398g94m-8000.brs.devtunnels.ms",  # Django backend (si necesario)
    
    # Si cambias de túnel, agrega las nuevas URLs aquí
]

# Permite conexiones desde red local y túneles usando regex
CORS_ALLOWED_ORIGIN_REGEXES = [
    # Red local IPv4
    r"^http://192\.168\.\d{1,3}\.\d{1,3}:\d+$",
    r"^http://10\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d+$",
    r"^http://172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}:\d+$",
    
    # Túneles BrowserStack
    r"^https://.*\.brs\.devtunnels\.ms$",
    
    # Túneles ngrok (por si los usas)
    r"^https://.*\.ngrok\.io$",
    r"^https://.*\.ngrok-free\.app$",
]

# Headers permitidos
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

# Métodos HTTP permitidos
CORS_ALLOW_METHODS = [
    "DELETE",
    "GET", 
    "OPTIONS",
    "PATCH",
    "POST",
    "PUT"
]

# Para túneles HTTPS, configura CSRF trusted origins
CSRF_TRUSTED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://l398g94m-3000.brs.devtunnels.ms",
    "https://l398g94m-8000.brs.devtunnels.ms",
    # Agrega más si cambias de túnel
]

# En desarrollo, permite todos los orígenes (SOLO para desarrollo)
if DEBUG:
    CORS_ALLOW_ALL_ORIGINS = False  # Cambia a True si tienes problemas
    
# ──────────────────────────────────────────────────────────────────────────────
# Seguridad (dev)
# ──────────────────────────────────────────────────────────────────────────────
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"

# Para túneles HTTPS en desarrollo, desactiva algunas validaciones
if DEBUG:
    SECURE_SSL_REDIRECT = False
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

# ──────────────────────────────────────────────────────────────────────────────
# Frontend base (para construir enlaces que se envían por correo)
# ──────────────────────────────────────────────────────────────────────────────
# Prioriza variable de entorno, luego túnel, luego localhost
FRONTEND_BASE_URL = os.getenv(
    "FRONTEND_BASE_URL", 
    "https://l398g94m-3000.brs.devtunnels.ms"  # Tu túnel React
)

# ──────────────────────────────────────────────────────────────────────────────
# Email (SMTP real por red)
# ──────────────────────────────────────────────────────────────────────────────
# Por defecto: SMTP. Si estás en dev y no configuraste SMTP, puedes forzar consola con:
# EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend
EMAIL_BACKEND = os.getenv(
    "EMAIL_BACKEND",
    "django.core.mail.backends.smtp.EmailBackend"
)

# Host/puerto y credenciales:
EMAIL_HOST = os.getenv("EMAIL_HOST", "127.0.0.1")        # p.ej. smtp.gmail.com, smtp.mailtrap.io, o IP de Mailpit
EMAIL_PORT = int(os.getenv("EMAIL_PORT", "1025"))        # 587 TLS, 465 SSL, 1025 Mailpit en LAN
EMAIL_HOST_USER = os.getenv("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD", "")

# TLS/SSL (no actives ambos a la vez)
EMAIL_USE_TLS = os.getenv("EMAIL_USE_TLS", "0") == "1"   # para 587
EMAIL_USE_SSL = os.getenv("EMAIL_USE_SSL", "0") == "1"   # para 465

DEFAULT_FROM_EMAIL = os.getenv("DEFAULT_FROM_EMAIL", "no-reply@ruletas.local")
SERVER_EMAIL = os.getenv("SERVER_EMAIL", DEFAULT_FROM_EMAIL)

# Timeout razonable para conexiones SMTP
EMAIL_TIMEOUT = int(os.getenv("EMAIL_TIMEOUT", "30"))

# Tiempo de validez del token de reset (en segundos): 24 horas
PASSWORD_RESET_TIMEOUT = int(os.getenv("PASSWORD_RESET_TIMEOUT", str(60 * 60 * 24)))

# ──────────────────────────────────────────────────────────────────────────────
# Uploads
# ──────────────────────────────────────────────────────────────────────────────
# Tamaños razonables para ruletas con portada + premios (varias imágenes)
FILE_UPLOAD_MAX_MEMORY_SIZE = int(os.getenv("FILE_UPLOAD_MAX_MEMORY_SIZE", 15 * 1024 * 1024))  # 15 MB
DATA_UPLOAD_MAX_MEMORY_SIZE = int(os.getenv("DATA_UPLOAD_MAX_MEMORY_SIZE", 30 * 1024 * 1024))  # 30 MB

# Reglas de recibos (participaciones)
ALLOWED_RECEIPT_EXTENSIONS = [".jpg", ".jpeg", ".png", ".pdf"]
MAX_RECEIPT_SIZE = 10 * 1024 * 1024  # 10 MB

# ──────────────────────────────────────────────────────────────────────────────
# Logging
# ──────────────────────────────────────────────────────────────────────────────
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {"format": "{levelname} {asctime} {module} {process:d} {thread:d} {message}", "style": "{"},
        "simple": {"format": "{levelname} {message}", "style": "{"},
    },
    "handlers": {
        "file": {
            "level": "INFO",
            "class": "logging.FileHandler",
            "filename": BASE_DIR / "django.log",
            "formatter": "verbose",
        },
        "console": {"level": "DEBUG", "class": "logging.StreamHandler", "formatter": "simple"},
    },
    "root": {"handlers": ["console", "file"], "level": "INFO"},
}