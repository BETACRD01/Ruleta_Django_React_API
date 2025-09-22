# backend/urls.py
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.http import JsonResponse

def api_info(request):
    return JsonResponse({
        "message": "LuckySpin API está funcionando",
        "endpoints": {
            "admin": "/admin/",
            "auth": "/api/auth/",
            "roulettes": "/api/roulettes/",
            "participants": "/api/participants/",
            "notifications": "/api/notifications/",
        }
    })

urlpatterns = [
    path("admin/", admin.site.urls),
    path("", api_info, name="api-root"),

    # AGREGAR ESTA LÍNEA - URLs de CKEditor
    path("ckeditor/", include("ckeditor_uploader.urls")),

    # API (coinciden con tu frontend: API_URL + /auth/... etc)
    path("api/auth/", include("authentication.urls")),
    path("api/roulettes/", include("roulettes.urls")),
    path("api/participants/", include("participants.urls")),
    path("api/notifications/", include("notifications.urls")),
]

# Media en desarrollo
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)