# backend/notifications/serializers.py

from rest_framework import serializers
from .models import (
    Notification, 
    RealTimeMessage, 
    NotificationType, 
    AdminNotificationPreference,
    NotificationTemplate
)
from django.contrib.auth import get_user_model

User = get_user_model()

class NotificationSerializer(serializers.ModelSerializer):
    """
    Serializer principal para notificaciones
    """
    user_name = serializers.CharField(source='user.username', read_only=True)
    notification_type_display = serializers.CharField(
        source='get_notification_type_display', 
        read_only=True
    )
    priority_display = serializers.CharField(
        source='get_priority_display',
        read_only=True
    )
    time_since_created = serializers.SerializerMethodField()
    is_expired = serializers.SerializerMethodField()
    
    class Meta:
        model = Notification
        fields = [
            'id',
            'user',
            'user_name',
            'notification_type',
            'notification_type_display',
            'title',
            'message',
            'is_public',
            'is_read',
            'is_admin_only',
            'priority',
            'priority_display',
            'roulette_id',
            'participation_id',
            'extra_data',
            'created_at',
            'updated_at',
            'expires_at',
            'time_since_created',
            'is_expired',
        ]
        read_only_fields = [
            'id', 
            'user', 
            'user_name',
            'notification_type_display',
            'priority_display',
            'created_at', 
            'updated_at',
            'time_since_created',
            'is_expired'
        ]
    
    def get_time_since_created(self, obj):
        """Calcular tiempo transcurrido desde la creación"""
        from django.utils import timezone
        from django.utils.timesince import timesince
        
        return timesince(obj.created_at, timezone.now())
    
    def get_is_expired(self, obj):
        """Verificar si la notificación ha expirado"""
        if not obj.expires_at:
            return False
        from django.utils import timezone
        return obj.expires_at < timezone.now()

class NotificationCreateSerializer(serializers.ModelSerializer):
    """
    Serializer para crear notificaciones (uso interno/admin)
    """
    class Meta:
        model = Notification
        fields = [
            'user',
            'notification_type',
            'title',
            'message',
            'is_public',
            'is_admin_only',
            'priority',
            'roulette_id',
            'participation_id',
            'extra_data',
            'expires_at',
        ]
    
    def validate_notification_type(self, value):
        """Validar que el tipo de notificación sea válido"""
        if value not in NotificationType.values:
            raise serializers.ValidationError(
                f"Tipo de notificación inválido. Opciones válidas: {NotificationType.values}"
            )
        return value
    
    def validate(self, data):
        """Validaciones adicionales"""
        # Si es notificación pública, no debe tener usuario asignado
        if data.get('is_public') and data.get('user'):
            raise serializers.ValidationError(
                "Las notificaciones públicas no pueden tener un usuario asignado"
            )
        
        # Si no es pública ni de admin, debe tener usuario asignado
        if not data.get('is_public') and not data.get('is_admin_only') and not data.get('user'):
            raise serializers.ValidationError(
                "Las notificaciones privadas deben tener un usuario asignado"
            )
        
        # Validar fecha de expiración
        if data.get('expires_at'):
            from django.utils import timezone
            if data['expires_at'] <= timezone.now():
                raise serializers.ValidationError(
                    "La fecha de expiración debe ser futura"
                )
        
        return data

class NotificationUpdateSerializer(serializers.ModelSerializer):
    """
    Serializer para actualizar notificaciones (principalmente marcar como leída)
    """
    class Meta:
        model = Notification
        fields = ['is_read']

class PublicNotificationSerializer(serializers.ModelSerializer):
    """
    Serializer para notificaciones públicas (información limitada)
    """
    notification_type_display = serializers.CharField(
        source='get_notification_type_display', 
        read_only=True
    )
    priority_display = serializers.CharField(
        source='get_priority_display',
        read_only=True
    )
    time_since_created = serializers.SerializerMethodField()
    winner_name = serializers.SerializerMethodField()
    roulette_name = serializers.SerializerMethodField()
    
    class Meta:
        model = Notification
        fields = [
            'id',
            'notification_type',
            'notification_type_display',
            'title',
            'message',
            'priority',
            'priority_display',
            'roulette_id',
            'extra_data',
            'created_at',
            'time_since_created',
            'winner_name',
            'roulette_name',
        ]
    
    def get_time_since_created(self, obj):
        """Calcular tiempo transcurrido desde la creación"""
        from django.utils import timezone
        from django.utils.timesince import timesince
        
        return timesince(obj.created_at, timezone.now())
    
    def get_winner_name(self, obj):
        """Obtener nombre del ganador desde extra_data"""
        return obj.extra_data.get('winner_name', '')
    
    def get_roulette_name(self, obj):
        """Obtener nombre de la ruleta desde extra_data"""
        return obj.extra_data.get('roulette_name', '')

class AdminNotificationSerializer(serializers.ModelSerializer):
    """
    Serializer para notificaciones de administrador
    """
    notification_type_display = serializers.CharField(
        source='get_notification_type_display', 
        read_only=True
    )
    priority_display = serializers.CharField(
        source='get_priority_display',
        read_only=True
    )
    time_since_created = serializers.SerializerMethodField()
    winner_email = serializers.SerializerMethodField()
    
    class Meta:
        model = Notification
        fields = [
            'id',
            'notification_type',
            'notification_type_display',
            'title',
            'message',
            'priority',
            'priority_display',
            'is_read',
            'roulette_id',
            'extra_data',
            'created_at',
            'time_since_created',
            'winner_email',
        ]
    
    def get_time_since_created(self, obj):
        """Calcular tiempo transcurrido desde la creación"""
        from django.utils import timezone
        from django.utils.timesince import timesince
        
        return timesince(obj.created_at, timezone.now())
    
    def get_winner_email(self, obj):
        """Obtener email del ganador desde extra_data (solo para admin)"""
        return obj.extra_data.get('winner_email', '')

class RealTimeMessageSerializer(serializers.ModelSerializer):
    """
    Serializer para mensajes en tiempo real
    """
    time_since_sent = serializers.SerializerMethodField()
    
    class Meta:
        model = RealTimeMessage
        fields = [
            'id',
            'channel_name',
            'message_type',
            'content',
            'roulette_id',
            'sent_at',
            'time_since_sent',
        ]
        read_only_fields = ['id', 'sent_at', 'time_since_sent']
    
    def get_time_since_sent(self, obj):
        """Calcular tiempo transcurrido desde el envío"""
        from django.utils import timezone
        from django.utils.timesince import timesince
        
        return timesince(obj.sent_at, timezone.now())

class NotificationStatsSerializer(serializers.Serializer):
    """
    Serializer para estadísticas de notificaciones
    """
    total_notifications = serializers.IntegerField()
    unread_notifications = serializers.IntegerField()
    recent_notifications = serializers.IntegerField()
    notifications_by_type = serializers.DictField()
    unread_by_priority = serializers.DictField(required=False)
    admin_notifications_count = serializers.IntegerField(required=False)
    
    def to_representation(self, instance):
        """Personalizar la representación de las estadísticas"""
        data = super().to_representation(instance)
        
        # Agregar información adicional si está disponible
        if hasattr(instance, 'last_notification_date'):
            data['last_notification_date'] = instance.last_notification_date
        
        return data

class BulkNotificationMarkReadSerializer(serializers.Serializer):
    """
    Serializer para marcar múltiples notificaciones como leídas
    """
    notification_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        min_length=1,
        max_length=50,
        help_text="Lista de IDs de notificaciones a marcar como leídas"
    )
    
    def validate_notification_ids(self, value):
        """Validar que los IDs sean únicos"""
        if len(value) != len(set(value)):
            raise serializers.ValidationError("Los IDs de notificaciones deben ser únicos")
        return value

class AdminNotificationPreferenceSerializer(serializers.ModelSerializer):
    """
    Serializer para preferencias de notificaciones de admin
    """
    user_name = serializers.CharField(source='user.username', read_only=True)
    
    class Meta:
        model = AdminNotificationPreference
        fields = [
            'id',
            'user',
            'user_name',
            'notify_on_winner',
            'notify_on_new_participation',
            'notify_on_roulette_created',
            'email_notifications',
            'min_participants_alert',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'user', 'user_name', 'created_at', 'updated_at']

class NotificationTemplateSerializer(serializers.ModelSerializer):
    """
    Serializer para plantillas de notificaciones
    """
    notification_type_display = serializers.CharField(
        source='get_notification_type_display',
        read_only=True
    )
    
    class Meta:
        model = NotificationTemplate
        fields = [
            'id',
            'name',
            'notification_type',
            'notification_type_display',
            'title_template',
            'message_template',
            'is_active',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

class WinnerAnnouncementSerializer(serializers.Serializer):
    """
    Serializer para crear anuncio completo de ganador
    """
    winner_user_id = serializers.IntegerField()
    roulette_name = serializers.CharField(max_length=200)
    roulette_id = serializers.IntegerField()
    total_participants = serializers.IntegerField(min_value=1)
    prize_details = serializers.CharField(max_length=500, required=False, allow_blank=True)
    
    def validate_winner_user_id(self, value):
        """Validar que el usuario ganador existe"""
        try:
            User.objects.get(pk=value)
            return value
        except User.DoesNotExist:
            raise serializers.ValidationError("Usuario ganador no existe")