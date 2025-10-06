from django.contrib import admin
from django.utils.html import format_html
from django.db.models import Count, Q, Prefetch
from django.urls import reverse
from django.contrib import messages
from django.db import transaction
from .models import (
    Notification,
    RealTimeMessage,
    NotificationType,
    AdminNotificationPreference,
    NotificationTemplate,
    NotificationReadStatus,
)


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    """Administración de notificaciones en Django Admin"""
    list_display = [
        "id",
        "title_truncated",
        "user_display",
        "notification_type",
        "priority_display",
        "is_public",
        "is_read",
        "is_admin_only",
        "read_count_display",
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
        "read_statuses_display",
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
        ("Estados de Lectura (Admin)", {"fields": ["read_statuses_display"], "classes": ["collapse"]}),
        ("Metadatos", {"fields": ["created_at", "updated_at"], "classes": ["collapse"]}),
    ]

    ordering = ["-priority", "-created_at"]
    date_hierarchy = "created_at"
    list_per_page = 25

    def get_queryset(self, request):
        """Optimizar consultas con prefetch selectivo y count agregado"""
        qs = super().get_queryset(request).select_related('user')
        
        # CORREGIDO: Prefetch sin slice - el ordenamiento y limit se manejan después
        read_status_prefetch = Prefetch(
            'read_statuses',
            queryset=NotificationReadStatus.objects.select_related('user').order_by('-read_at')
            # REMOVIDO: [:50] - esto causaba el error
        )
        
        # Agregar count en la query para evitar N+1
        qs = qs.annotate(
            _read_status_count=Count(
                'read_statuses',
                filter=Q(is_admin_only=True),
                distinct=True
            )
        ).prefetch_related(read_status_prefetch)
        
        return qs

    def title_truncated(self, obj):
        """Mostrar título truncado"""
        if len(obj.title) > 50:
            return f"{obj.title[:47]}..."
        return obj.title
    title_truncated.short_description = "Título"

    def user_display(self, obj):
        """Mostrar usuario o tipo de notificación"""
        if obj.is_public:
            return "🌐 Público"
        elif obj.is_admin_only:
            return "⚡ Admin"
        elif obj.user:
            return f"👤 {obj.user.username}"
        return "Sin asignar"
    user_display.short_description = "Destinatario"

    def priority_display(self, obj):
        """Mostrar prioridad"""
        icons = {
            "urgent": "🚨",
            "high": "⚠️",
            "normal": "ℹ️",
            "low": "💬",
        }
        return f"{icons.get(obj.priority, '')} {obj.get_priority_display()}"
    priority_display.short_description = "Prioridad"

    def priority_display_colored(self, obj):
        """Versión para readonly fields"""
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

    def read_count_display(self, obj):
        """Muestra cuántos admins han leído esta notificación"""
        if not obj.is_admin_only:
            return ""
        
        # Usar el count pre-calculado si está disponible
        count = getattr(obj, '_read_status_count', None)
        if count is None:
            count = obj.read_statuses.count()
        
        return f"📖 {count}" if count > 0 else "📭"
    read_count_display.short_description = "Leído"

    def read_statuses_display(self, obj):
        """Muestra lista de admins que han leído esta notificación"""
        if not obj.is_admin_only:
            return "N/A (solo para notificaciones admin-only)"
        
        # CORREGIDO: Obtener todos y luego limitar en Python
        # Esto evita el error de slice + filter
        all_statuses = list(obj.read_statuses.all())
        statuses = all_statuses[:50]  # Limitar en Python, no en DB
        
        if not statuses:
            return "Nadie ha leído esta notificación aún"
        
        html_parts = ["<ul style='margin: 0; padding-left: 20px;'>"]
        for status in statuses:
            read_time = status.read_at.strftime("%d/%m/%Y %H:%M")
            
            # Ofuscar email parcialmente para seguridad
            email = status.user.email
            if '@' in email:
                local, domain = email.split('@', 1)
                safe_email = f"{local[:3]}***@{domain}"
            else:
                safe_email = "***"
            
            html_parts.append(
                f"<li><strong>{status.user.username}</strong> "
                f"({safe_email}) - {read_time}</li>"
            )
        
        if len(all_statuses) > 50:
            html_parts.append("<li><em>... y más</em></li>")
        
        html_parts.append("</ul>")
        
        return format_html(''.join(html_parts))
    read_statuses_display.short_description = "Admins que han leído"

    # Acciones personalizadas
    actions = [
        "mark_as_read",
        "mark_as_unread",
        "make_public",
        "make_private",
        "set_high_priority",
        "set_normal_priority",
        "clear_read_statuses",
    ]

    @transaction.atomic
    def mark_as_read(self, request, queryset):
        """Marcar notificaciones como leídas (maneja admin-only correctamente)"""
        # Separar notificaciones por tipo
        admin_only = queryset.filter(is_admin_only=True, user__isnull=True)
        normal = queryset.exclude(Q(is_admin_only=True) & Q(user__isnull=True))
        
        # Marcar notificaciones normales
        updated = normal.update(is_read=True)
        
        # Para admin-only, crear read_status para el admin actual
        if admin_only.exists() and request.user.is_staff:
            from .services import bulk_mark_admin_notifications_read
            admin_updated = bulk_mark_admin_notifications_read(
                request.user.id,
                list(admin_only.values_list('id', flat=True))
            )
            updated += admin_updated
        
        self.message_user(
            request, 
            f"{updated} notificaciones marcadas como leídas.",
            level=messages.SUCCESS
        )
    mark_as_read.short_description = "Marcar como leídas"

    @transaction.atomic
    def mark_as_unread(self, request, queryset):
        """Marcar notificaciones como no leídas"""
        # Solo aplica a notificaciones normales
        normal = queryset.exclude(Q(is_admin_only=True) & Q(user__isnull=True))
        updated = normal.update(is_read=False)
        
        self.message_user(
            request, 
            f"{updated} notificaciones marcadas como no leídas.",
            level=messages.SUCCESS
        )
    mark_as_unread.short_description = "Marcar como no leídas"

    @transaction.atomic
    def make_public(self, request, queryset):
        """Hacer notificaciones públicas"""
        updated = queryset.update(is_public=True, is_admin_only=False, user=None)
        self.message_user(
            request, 
            f"{updated} notificaciones convertidas a públicas.",
            level=messages.SUCCESS
        )
    make_public.short_description = "Hacer públicas"

    @transaction.atomic
    def make_private(self, request, queryset):
        """Hacer notificaciones privadas"""
        updated = queryset.filter(is_public=True).update(is_public=False)
        self.message_user(
            request,
            f"{updated} notificaciones convertidas a privadas. "
            f"Recuerde asignar usuarios manualmente.",
            level=messages.WARNING
        )
    make_private.short_description = "Hacer privadas"

    @transaction.atomic
    def set_high_priority(self, request, queryset):
        """Establecer prioridad alta"""
        updated = queryset.update(priority="high")
        self.message_user(
            request, 
            f"{updated} notificaciones marcadas como prioridad alta.",
            level=messages.SUCCESS
        )
    set_high_priority.short_description = "Prioridad alta"

    @transaction.atomic
    def set_normal_priority(self, request, queryset):
        """Establecer prioridad normal"""
        updated = queryset.update(priority="normal")
        self.message_user(
            request, 
            f"{updated} notificaciones marcadas como prioridad normal.",
            level=messages.SUCCESS
        )
    set_normal_priority.short_description = "Prioridad normal"

    @transaction.atomic
    def clear_read_statuses(self, request, queryset):
        """Limpiar estados de lectura en batch (optimizado)"""
        admin_notifications = queryset.filter(is_admin_only=True)
        notification_ids = list(admin_notifications.values_list('id', flat=True))
        
        if not notification_ids:
            self.message_user(
                request, 
                "No hay notificaciones admin-only seleccionadas.",
                level=messages.WARNING
            )
            return
        
        # DELETE masivo en una sola query
        total_deleted, _ = NotificationReadStatus.objects.filter(
            notification_id__in=notification_ids
        ).delete()
        
        self.message_user(
            request, 
            f"{total_deleted} estados de lectura eliminados "
            f"de {len(notification_ids)} notificaciones.",
            level=messages.SUCCESS
        )
    clear_read_statuses.short_description = "Limpiar estados de lectura"


@admin.register(NotificationReadStatus)
class NotificationReadStatusAdmin(admin.ModelAdmin):
    """Administración de estados de lectura"""
    list_display = ['id', 'notification_link', 'user_name', 'user_email_safe', 'read_at_formatted']
    list_filter = ['read_at', 'user']
    search_fields = ['notification__title', 'user__username', 'user__email']
    readonly_fields = ['notification', 'user', 'read_at']
    date_hierarchy = 'read_at'
    list_per_page = 50
    
    def has_add_permission(self, request):
        """No permitir creación manual desde admin"""
        return False
    
    def notification_link(self, obj):
        """Link a la notificación"""
        url = reverse('admin:notifications_notification_change', args=[obj.notification.id])
        return format_html('<a href="{}">{}</a>', url, obj.notification.title[:50])
    notification_link.short_description = 'Notificación'
    
    def user_name(self, obj):
        return obj.user.username
    user_name.short_description = 'Admin'
    
    def user_email_safe(self, obj):
        """Email parcialmente ofuscado"""
        email = obj.user.email
        if '@' in email:
            local, domain = email.split('@', 1)
            return f"{local[:3]}***@{domain}"
        return "***"
    user_email_safe.short_description = 'Email'
    
    def read_at_formatted(self, obj):
        return obj.read_at.strftime("%d/%m/%Y %H:%M:%S")
    read_at_formatted.short_description = 'Leído en'


@admin.register(RealTimeMessage)
class RealTimeMessageAdmin(admin.ModelAdmin):
    """Administración de mensajes en tiempo real"""
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

    actions = ["cleanup_old_messages"]

    @transaction.atomic
    def cleanup_old_messages(self, request, queryset):
        """Limpiar mensajes antiguos seleccionados"""
        deleted_count, _ = queryset.delete()
        self.message_user(
            request, 
            f"{deleted_count} mensajes eliminados.",
            level=messages.SUCCESS
        )
    cleanup_old_messages.short_description = "Eliminar mensajes seleccionados"


@admin.register(AdminNotificationPreference)
class AdminNotificationPreferenceAdmin(admin.ModelAdmin):
    """Administración de preferencias de notificaciones para admins"""
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
    """Administración de plantillas de notificaciones"""
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
        ("Plantillas", {
            "fields": ["title_template", "message_template"],
            "description": "Use variables Django template: {{ variable_name }}"
        }),
        ("Metadatos", {"fields": ["created_at", "updated_at"], "classes": ["collapse"]}),
    ]

    def notification_type_display(self, obj):
        """Mostrar tipo de notificación legible"""
        return obj.get_notification_type_display()
    notification_type_display.short_description = "Tipo (Legible)"


# Configuración adicional del admin
admin.site.site_header = "Administración de Ruletas - Notificaciones"
admin.site.site_title = "Admin Ruletas"
admin.site.index_title = "Panel de Control"