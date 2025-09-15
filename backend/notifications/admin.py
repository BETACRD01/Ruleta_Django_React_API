# backend/notifications/admin.py

from django.contrib import admin
from django.utils.html import format_html
from .models import Notification, RealTimeMessage, NotificationType

@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    """
    Administración de notificaciones en Django Admin
    """
    list_display = [
        'id',
        'title_truncated',
        'user_display',
        'notification_type',
        'is_public',
        'is_read',
        'roulette_id',
        'created_at_formatted',
    ]
    
    list_filter = [
        'notification_type',
        'is_public',
        'is_read',
        'created_at',
    ]
    
    search_fields = [
        'title',
        'message',
        'user__username',
        'user__email',
    ]
    
    readonly_fields = [
        'created_at',
        'updated_at',
        'notification_type_display',
    ]
    
    fieldsets = [
        ('Información Básica', {
            'fields': ['title', 'message', 'notification_type', 'notification_type_display']
        }),
        ('Usuario y Permisos', {
            'fields': ['user', 'is_public', 'is_read']
        }),
        ('Referencias', {
            'fields': ['roulette_id', 'participation_id']
        }),
        ('Datos Adicionales', {
            'fields': ['extra_data'],
            'classes': ['collapse']
        }),
        ('Metadatos', {
            'fields': ['created_at', 'updated_at'],
            'classes': ['collapse']
        }),
    ]
    
    ordering = ['-created_at']
    date_hierarchy = 'created_at'
    
    def title_truncated(self, obj):
        """Mostrar título truncado"""
        if len(obj.title) > 50:
            return f"{obj.title[:47]}..."
        return obj.title
    title_truncated.short_description = 'Título'
    
    def user_display(self, obj):
        """Mostrar usuario o 'Público'"""
        if obj.user:
            return format_html(
                '<span style="color: blue;">👤 {}</span>',
                obj.user.username
            )
        return format_html(
            '<span style="color: green;">🌐 Público</span>'
        )
    user_display.short_description = 'Destinatario'
    
    def created_at_formatted(self, obj):
        """Formatear fecha de creación"""
        return obj.created_at.strftime('%d/%m/%Y %H:%M')
    created_at_formatted.short_description = 'Creado'
    
    def notification_type_display(self, obj):
        """Mostrar tipo de notificación"""
        return obj.get_notification_type_display()
    notification_type_display.short_description = 'Tipo (Legible)'
    
    def get_queryset(self, request):
        """Optimizar consultas"""
        return super().get_queryset(request).select_related('user')
    
    # Acciones personalizadas
    actions = ['mark_as_read', 'mark_as_unread', 'make_public', 'make_private']
    
    def mark_as_read(self, request, queryset):
        """Marcar notificaciones seleccionadas como leídas"""
        updated = queryset.update(is_read=True)
        self.message_user(request, f'{updated} notificaciones marcadas como leídas.')
    mark_as_read.short_description = "Marcar como leídas"
    
    def mark_as_unread(self, request, queryset):
        """Marcar notificaciones seleccionadas como no leídas"""
        updated = queryset.update(is_read=False)
        self.message_user(request, f'{updated} notificaciones marcadas como no leídas.')
    mark_as_unread.short_description = "Marcar como no leídas"
    
    def make_public(self, request, queryset):
        """Hacer notificaciones públicas"""
        updated = queryset.update(is_public=True, user=None)
        self.message_user(request, f'{updated} notificaciones convertidas a públicas.')
    make_public.short_description = "Hacer públicas"
    
    def make_private(self, request, queryset):
        """Hacer notificaciones privadas (requiere asignar usuario manualmente)"""
        # Solo actualizar las que no tienen usuario asignado
        count = 0
        for notification in queryset.filter(is_public=True, user=None):
            notification.is_public = False
            # Nota: El usuario deberá ser asignado manualmente
            notification.save()
            count += 1
        
        self.message_user(
            request, 
            f'{count} notificaciones convertidas a privadas. '
            'Recuerde asignar usuarios manualmente.'
        )
    make_private.short_description = "Hacer privadas"

@admin.register(RealTimeMessage)
class RealTimeMessageAdmin(admin.ModelAdmin):
    """
    Administración de mensajes en tiempo real
    """
    list_display = [
        'id',
        'channel_name',
        'message_type',
        'roulette_id',
        'content_preview',
        'sent_at_formatted',
    ]
    
    list_filter = [
        'channel_name',
        'message_type',
        'sent_at',
    ]
    
    search_fields = [
        'channel_name',
        'message_type',
        'content',
    ]
    
    readonly_fields = [
        'sent_at',
        'content_formatted',
    ]
    
    fieldsets = [
        ('Información del Mensaje', {
            'fields': ['channel_name', 'message_type', 'roulette_id']
        }),
        ('Contenido', {
            'fields': ['content', 'content_formatted']
        }),
        ('Metadatos', {
            'fields': ['sent_at'],
            'classes': ['collapse']
        }),
    ]
    
    ordering = ['-sent_at']
    date_hierarchy = 'sent_at'
    
    def content_preview(self, obj):
        """Vista previa del contenido"""
        content_str = str(obj.content)
        if len(content_str) > 100:
            return f"{content_str[:97]}..."
        return content_str
    content_preview.short_description = 'Contenido (Vista Previa)'
    
    def sent_at_formatted(self, obj):
        """Formatear fecha de envío"""
        return obj.sent_at.strftime('%d/%m/%Y %H:%M:%S')
    sent_at_formatted.short_description = 'Enviado'
    
    def content_formatted(self, obj):
        """Mostrar contenido formateado"""
        import json
        return format_html(
            '<pre style="white-space: pre-wrap; max-height: 200px; overflow-y: auto;">{}</pre>',
            json.dumps(obj.content, indent=2, ensure_ascii=False)
        )
    content_formatted.short_description = 'Contenido (Formateado)'
    
    # Acciones personalizadas
    actions = ['cleanup_old_messages']
    
    def cleanup_old_messages(self, request, queryset):
        """Limpiar mensajes antiguos seleccionados"""
        deleted_count = queryset.delete()[0]
        self.message_user(request, f'{deleted_count} mensajes eliminados.')
    cleanup_old_messages.short_description = "Eliminar mensajes seleccionados"

# Personalización adicional del admin
admin.site.site_header = "Administración de Ruletas"
admin.site.site_title = "Admin Ruletas"
admin.site.index_title = "Panel de Control"