# backend/notifications/admin.py

from django.contrib import admin
from django.utils.html import format_html
from django.db.models import Count
from django.urls import path
from django.http import HttpResponseRedirect
from django.contrib import messages
from .models import (
    Notification,
    RealTimeMessage,
    NotificationType,
    AdminNotificationPreference,
    NotificationTemplate,
)


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    """
    Administración de notificaciones en Django Admin
    """
    list_display = [
        "id",
        "title_truncated",
        "user_display",
        "notification_type",
        "priority_display",
        "is_public",
        "is_read",
        "is_admin_only",
        "roulette_id",
        "created_at_formatted",
    ]

    list_filter = [
        "notification_type",
        "priority",
        "is_public",
        "is_read",
        "is_admin_only",
        "created_at",
    ]

    search_fields = [
        "title",
        "message",
        "user__username",
        "user__email",
        "extra_data",
    ]

    readonly_fields = [
        "created_at",
        "updated_at",
        "notification_type_display",
        "priority_display_colored",
    ]

    fieldsets = [
        (
            "Información Básica",
            {"fields": ["title", "message", "notification_type", "notification_type_display"]},
        ),
        ("Usuario y Permisos", {"fields": ["user", "is_public", "is_admin_only", "is_read"]}),
        ("Prioridad y Expiración", {"fields": ["priority", "priority_display_colored", "expires_at"]}),
        ("Referencias", {"fields": ["roulette_id", "participation_id"]}),
        ("Datos Adicionales", {"fields": ["extra_data"], "classes": ["collapse"]}),
        ("Metadatos", {"fields": ["created_at", "updated_at"], "classes": ["collapse"]}),
    ]

    ordering = ["-priority", "-created_at"]
    date_hierarchy = "created_at"
    list_per_page = 25

    def get_urls(self):
        urls = super().get_urls()
        my_urls = [
            path(
                "create-winner-announcement/",
                self.admin_site.admin_view(self.create_winner_announcement),
                name="create-winner-announcement",
            ),
        ]
        return my_urls + urls

    def title_truncated(self, obj):
        """Mostrar título truncado"""
        if len(obj.title) > 50:
            return f"{obj.title[:47]}..."
        return obj.title

    title_truncated.short_description = "Título"

    def user_display(self, obj):
        """
        Mostrar usuario o tipo de notificación SIN colores.
        (Se mantienen los íconos para contexto, pero sin estilos CSS).
        """
        if obj.is_public:
            return "🌍 Público"
        elif obj.is_admin_only:
            return "⚡ Admin"
        elif obj.user:
            return f"👤 {obj.user.username}"
        return "Sin asignar"

    user_display.short_description = "Destinatario"

    def priority_display(self, obj):
        """
        Mostrar prioridad SIN colores.
        """
        icons = {
            "urgent": "🚨",
            "high": "⚠️",
            "normal": "ℹ️",
            "low": "💬",
        }
        return f"{icons.get(obj.priority, '')} {obj.get_priority_display()}"

    priority_display.short_description = "Prioridad"

    def priority_display_colored(self, obj):
        """
        Versión para readonly fields (misma salida, sin colores).
        """
        return self.priority_display(obj)

    priority_display_colored.short_description = "Prioridad (Visual)"

    def created_at_formatted(self, obj):
        """Formatear fecha de creación"""
        return obj.created_at.strftime("%d/%m/%Y %H:%M")

    created_at_formatted.short_description = "Creado"

    def notification_type_display(self, obj):
        """Mostrar tipo de notificación"""
        return obj.get_notification_type_display()

    notification_type_display.short_description = "Tipo (Legible)"

    def get_queryset(self, request):
        """Optimizar consultas"""
        return super().get_queryset(request).select_related("user")

    # Acciones personalizadas
    actions = [
        "mark_as_read",
        "mark_as_unread",
        "make_public",
        "make_private",
        "set_high_priority",
        "set_normal_priority",
    ]

    def mark_as_read(self, request, queryset):
        """Marcar notificaciones seleccionadas como leídas"""
        updated = queryset.update(is_read=True)
        self.message_user(request, f"{updated} notificaciones marcadas como leídas.")

    mark_as_read.short_description = "Marcar como leídas"

    def mark_as_unread(self, request, queryset):
        """Marcar notificaciones seleccionadas como no leídas"""
        updated = queryset.update(is_read=False)
        self.message_user(request, f"{updated} notificaciones marcadas como no leídas.")

    mark_as_unread.short_description = "Marcar como no leídas"

    def make_public(self, request, queryset):
        """Hacer notificaciones públicas"""
        updated = queryset.update(is_public=True, is_admin_only=False, user=None)
        self.message_user(request, f"{updated} notificaciones convertidas a públicas.")

    make_public.short_description = "Hacer públicas"

    def make_private(self, request, queryset):
        """Hacer notificaciones privadas"""
        updated = queryset.filter(is_public=True).update(is_public=False)
        self.message_user(
            request,
            f"{updated} notificaciones convertidas a privadas. Recuerde asignar usuarios manualmente.",
        )

    make_private.short_description = "Hacer privadas"

    def set_high_priority(self, request, queryset):
        """Establecer prioridad alta"""
        updated = queryset.update(priority="high")
        self.message_user(request, f"{updated} notificaciones marcadas como prioridad alta.")

    set_high_priority.short_description = "Prioridad alta"

    def set_normal_priority(self, request, queryset):
        """Establecer prioridad normal"""
        updated = queryset.update(priority="normal")
        self.message_user(request, f"{updated} notificaciones marcadas como prioridad normal.")

    set_normal_priority.short_description = "Prioridad normal"

    def create_winner_announcement(self, request):
        """Vista personalizada para crear anuncio de ganador"""
        if request.method == "POST":
            messages.success(request, "Funcionalidad de anuncio de ganador disponible via API")
        return HttpResponseRedirect("../")


@admin.register(RealTimeMessage)
class RealTimeMessageAdmin(admin.ModelAdmin):
    """
    Administración de mensajes en tiempo real
    """
    list_display = [
        "id",
        "channel_name",
        "message_type",
        "roulette_id",
        "content_preview",
        "sent_at_formatted",
    ]

    list_filter = [
        "channel_name",
        "message_type",
        "sent_at",
    ]

    search_fields = [
        "channel_name",
        "message_type",
        "content",
    ]

    readonly_fields = [
        "sent_at",
        "content_formatted",
    ]

    fieldsets = [
        ("Información del Mensaje", {"fields": ["channel_name", "message_type", "roulette_id"]}),
        ("Contenido", {"fields": ["content", "content_formatted"]}),
        ("Metadatos", {"fields": ["sent_at"], "classes": ["collapse"]}),
    ]

    ordering = ["-sent_at"]
    date_hierarchy = "sent_at"
    list_per_page = 30

    def content_preview(self, obj):
        """Vista previa del contenido"""
        content_str = str(obj.content)
        if len(content_str) > 100:
            return f"{content_str[:97]}..."
        return content_str

    content_preview.short_description = "Contenido (Vista Previa)"

    def sent_at_formatted(self, obj):
        """Formatear fecha de envío"""
        return obj.sent_at.strftime("%d/%m/%Y %H:%M:%S")

    sent_at_formatted.short_description = "Enviado"

    def content_formatted(self, obj):
        """Mostrar contenido formateado"""
        import json

        return format_html(
            '<pre style="white-space: pre-wrap; max-height: 200px; overflow-y: auto;">{}</pre>',
            json.dumps(obj.content, indent=2, ensure_ascii=False),
        )

    content_formatted.short_description = "Contenido (Formateado)"

    # Acciones personalizadas
    actions = ["cleanup_old_messages"]

    def cleanup_old_messages(self, request, queryset):
        """Limpiar mensajes antiguos seleccionados"""
        deleted_count = queryset.delete()[0]
        self.message_user(request, f"{deleted_count} mensajes eliminados.")

    cleanup_old_messages.short_description = "Eliminar mensajes seleccionados"


@admin.register(AdminNotificationPreference)
class AdminNotificationPreferenceAdmin(admin.ModelAdmin):
    """
    Administración de preferencias de notificaciones para admins
    """
    list_display = [
        "user",
        "notify_on_winner",
        "notify_on_new_participation",
        "notify_on_roulette_created",
        "email_notifications",
        "min_participants_alert",
        "updated_at",
    ]

    list_filter = [
        "notify_on_winner",
        "notify_on_new_participation",
        "notify_on_roulette_created",
        "email_notifications",
    ]

    search_fields = ["user__username", "user__email"]

    readonly_fields = ["created_at", "updated_at"]

    fieldsets = [
        ("Usuario", {"fields": ["user"]}),
        (
            "Preferencias de Notificación",
            {
                "fields": [
                    "notify_on_winner",
                    "notify_on_new_participation",
                    "notify_on_roulette_created",
                    "min_participants_alert",
                ]
            },
        ),
        ("Configuración de Envío", {"fields": ["email_notifications"]}),
        ("Metadatos", {"fields": ["created_at", "updated_at"], "classes": ["collapse"]}),
    ]


@admin.register(NotificationTemplate)
class NotificationTemplateAdmin(admin.ModelAdmin):
    """
    Administración de plantillas de notificaciones
    """
    list_display = [
        "name",
        "notification_type",
        "notification_type_display",
        "is_active",
        "updated_at",
    ]

    list_filter = [
        "notification_type",
        "is_active",
        "created_at",
    ]

    search_fields = ["name", "title_template", "message_template"]

    readonly_fields = ["created_at", "updated_at"]

    fieldsets = [
        ("Información Básica", {"fields": ["name", "notification_type", "is_active"]}),
        ("Plantillas", {"fields": ["title_template", "message_template"], "description": "Use variables Django template: {{ variable_name }}"}),
        ("Metadatos", {"fields": ["created_at", "updated_at"], "classes": ["collapse"]}),
    ]

    def notification_type_display(self, obj):
        """Mostrar tipo de notificación legible"""
        return obj.get_notification_type_display()

    notification_type_display.short_description = "Tipo (Legible)"


# Personalización adicional del admin
class NotificationAdminSite(admin.AdminSite):
    site_header = "Administración de Notificaciones - Ruletas"
    site_title = "Admin Notificaciones"
    index_title = "Panel de Control de Notificaciones"

    def index(self, request, extra_context=None):
        """Personalizar página de inicio del admin"""
        extra_context = extra_context or {}

        # Estadísticas rápidas
        extra_context["stats"] = {
            "total_notifications": Notification.objects.count(),
            "unread_notifications": Notification.objects.filter(is_read=False).count(),
            "recent_winners": Notification.objects.filter(
                notification_type=NotificationType.ROULETTE_WINNER
            ).count(),
            "admin_notifications": Notification.objects.filter(is_admin_only=True).count(),
        }

        return super().index(request, extra_context)


# Configuración adicional
admin.site.site_header = "Administración de Ruletas - Notificaciones"
admin.site.site_title = "Admin Ruletas"
admin.site.index_title = "Panel de Control"
