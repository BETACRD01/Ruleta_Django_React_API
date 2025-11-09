# backend/notifications/serializers.py

from rest_framework import serializers
from .models import (
    Notification, 
    RealTimeMessage, 
    NotificationType, 
    AdminNotificationPreference,
    NotificationTemplate,
    NotificationReadStatus  # ✅ CORREGIDO: AGREGADO
)
from django.contrib.auth import get_user_model
from django.utils.html import strip_tags
from rest_framework.exceptions import ValidationError

User = get_user_model()

class NotificationSerializer(serializers.ModelSerializer):
    """Serializer principal para notificaciones con sanitizaciÃ³n"""
    user_name = serializers.CharField(source='user.username', read_only=True, allow_null=True)
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
        """Calcular tiempo transcurrido desde la creaciÃ³n"""
        from django.utils import timezone
        from django.utils.timesince import timesince
        
        return timesince(obj.created_at, timezone.now())
    
    def get_is_expired(self, obj):
        """Verificar si la notificaciÃ³n ha expirado"""
        if not obj.expires_at:
            return False
        from django.utils import timezone
        return obj.expires_at < timezone.now()
    
    def to_representation(self, instance):
        """Sanitizar output para prevenir XSS"""
        data = super().to_representation(instance)
        
        # Sanitizar campos de texto (strip tags HTML)
        if data.get('title'):
            data['title'] = strip_tags(data['title'])[:200]
        
        if data.get('message'):
            data['message'] = strip_tags(data['message'])[:5000]
        
        # Limitar tamaÃ±o de extra_data en response
        if data.get('extra_data') and isinstance(data['extra_data'], dict):
            import json
            if len(json.dumps(data['extra_data'])) > 50000:
                data['extra_data'] = {'_truncated': True}
        
        return data

class NotificationCreateSerializer(serializers.ModelSerializer):
    """Serializer para crear notificaciones con validaciÃ³n estricta"""
    
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
    
    def validate_title(self, value):
        """Validar tÃ­tulo"""
        if not value or not value.strip():
            raise ValidationError("El tÃ­tulo no puede estar vacÃ­o")
        
        if len(value) > 200:
            raise ValidationError("El tÃ­tulo no puede exceder 200 caracteres")
        
        # Strip tags para prevenir XSS
        clean_value = strip_tags(value).strip()
        if not clean_value:
            raise ValidationError("El tÃ­tulo no puede contener solo HTML")
        
        return clean_value
    
    def validate_message(self, value):
        """Validar mensaje"""
        if not value or not value.strip():
            raise ValidationError("El mensaje no puede estar vacÃ­o")
        
        if len(value) > 5000:
            raise ValidationError("El mensaje no puede exceder 5000 caracteres")
        
        clean_value = strip_tags(value).strip()
        if not clean_value:
            raise ValidationError("El mensaje no puede contener solo HTML")
        
        return clean_value
    
    def validate_notification_type(self, value):
        """Validar tipo de notificaciÃ³n"""
        valid_types = [choice[0] for choice in NotificationType.choices]
        if value not in valid_types:
            raise ValidationError(
                f"Tipo invÃ¡lido. Opciones: {', '.join(valid_types)}"
            )
        return value
    
    def validate_priority(self, value):
        """Validar prioridad"""
        if value not in ['low', 'normal', 'high', 'urgent']:
            raise ValidationError("Prioridad invÃ¡lida")
        return value
    
    def validate_roulette_id(self, value):
        """Validar roulette_id"""
        if value is not None and value < 1:
            raise ValidationError("roulette_id debe ser positivo")
        return value
    
    def validate_participation_id(self, value):
        """Validar participation_id"""
        if value is not None and value < 1:
            raise ValidationError("participation_id debe ser positivo")
        return value
    
    def validate_extra_data(self, value):
        """Validar extra_data"""
        if value:
            import json
            try:
                serialized = json.dumps(value)
                if len(serialized) > 10000:
                    raise ValidationError("extra_data demasiado grande (max 10KB)")
            except (TypeError, ValueError) as e:
                raise ValidationError(f"extra_data no serializable: {str(e)}")
        
        return value or {}
    
    def validate(self, data):
        """Validaciones cruzadas"""
        # Si es pÃºblica, no debe tener usuario
        if data.get('is_public') and data.get('user'):
            raise ValidationError(
                "Las notificaciones pÃºblicas no pueden tener usuario asignado"
            )
        
        # Si no es pÃºblica ni admin, debe tener usuario
        if not data.get('is_public') and not data.get('is_admin_only'):
            if not data.get('user'):
                raise ValidationError(
                    "Las notificaciones privadas deben tener usuario asignado"
                )
        
        # Admin-only no puede tener usuario asignado
        if data.get('is_admin_only') and data.get('user'):
            raise ValidationError(
                "Las notificaciones admin-only no pueden tener usuario asignado"
            )
        
        # Validar expiraciÃ³n
        if data.get('expires_at'):
            from django.utils import timezone
            if data['expires_at'] <= timezone.now():
                raise ValidationError(
                    "La fecha de expiraciÃ³n debe ser futura"
                )
        
        return data

class NotificationUpdateSerializer(serializers.ModelSerializer):
    """
    Serializer para actualizar notificaciones (principalmente marcar como leÃ­da)
    """
    class Meta:
        model = Notification
        fields = ['is_read']

class PublicNotificationSerializer(serializers.ModelSerializer):
    """
    Serializer para notificaciones pÃºblicas (informaciÃ³n limitada)
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
        """Calcular tiempo transcurrido desde la creaciÃ³n"""
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
    """Serializer admin con query optimizado"""
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
    is_read_by_me = serializers.SerializerMethodField()
    
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
            'is_read_by_me',
            'roulette_id',
            'extra_data',
            'created_at',
            'time_since_created',
            'winner_email',
        ]
    
    def get_time_since_created(self, obj):
        from django.utils import timezone
        from django.utils.timesince import timesince
        return timesince(obj.created_at, timezone.now())
    
    def get_winner_email(self, obj):
        """Email del ganador (sanitizado)"""
        email = obj.extra_data.get('winner_email', '')
        if not email:
            return ''
        
        # Ofuscar parcialmente para logs
        if '@' in email:
            local, domain = email.split('@', 1)
            return f"{local[:2]}***@{domain}"
        return '***'
    
    def get_is_read_by_me(self, obj):
        """
        Verifica si admin actual ha leÃ­do esta notificaciÃ³n.
        OPTIMIZADO: usa annotate en queryset si estÃ¡ disponible.
        """
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        
        # Si viene de annotate en la view, usar ese valor
        if hasattr(obj, 'is_read_by_me'):
            return obj.is_read_by_me
        
        # Fallback: query individual (evitar en producciÃ³n)
        return NotificationReadStatus.objects.filter(
            notification=obj,
            user=request.user
        ).exists()

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
        """Calcular tiempo transcurrido desde el envÃ­o"""
        from django.utils import timezone
        from django.utils.timesince import timesince
        
        return timesince(obj.sent_at, timezone.now())

class NotificationStatsSerializer(serializers.Serializer):
    """
    Serializer para estadÃ­sticas de notificaciones
    """
    total_notifications = serializers.IntegerField()
    unread_notifications = serializers.IntegerField()
    recent_notifications = serializers.IntegerField()
    notifications_by_type = serializers.DictField()
    unread_by_priority = serializers.DictField(required=False)
    admin_notifications_count = serializers.IntegerField(required=False)
    
    def to_representation(self, instance):
        """Personalizar la representaciÃ³n de las estadÃ­sticas"""
        data = super().to_representation(instance)
        
        # Agregar informaciÃ³n adicional si estÃ¡ disponible
        if hasattr(instance, 'last_notification_date'):
            data['last_notification_date'] = instance.last_notification_date
        
        return data

class BulkNotificationMarkReadSerializer(serializers.Serializer):
    """Serializer para marcar mÃºltiples notificaciones con lÃ­mites"""
    notification_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1, max_value=2147483647),
        min_length=1,
        max_length=100,
        help_text="Lista de IDs de notificaciones (max 100)"
    )
    
    def validate_notification_ids(self, value):
        """Validar unicidad y rango"""
        if len(value) != len(set(value)):
            raise ValidationError("Los IDs deben ser Ãºnicos")
        
        # Validar que no haya IDs negativos o 0
        if any(id_val < 1 for id_val in value):
            raise ValidationError("Todos los IDs deben ser positivos")
        
        return list(set(value))


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
    """Serializer para anuncio de ganador con validaciones"""
    winner_user_id = serializers.IntegerField(min_value=1)
    roulette_name = serializers.CharField(min_length=1, max_length=200)
    roulette_id = serializers.IntegerField(min_value=1)
    total_participants = serializers.IntegerField(min_value=1, max_value=1000000)
    prize_details = serializers.CharField(
        max_length=1000,
        required=False, 
        allow_blank=True
    )
    
    def validate_roulette_name(self, value):
        """Sanitizar nombre de ruleta"""
        clean_value = strip_tags(value).strip()
        if not clean_value:
            raise ValidationError("El nombre de la ruleta no puede estar vacÃ­o")
        return clean_value
    
    def validate_prize_details(self, value):
        """Sanitizar detalles del premio"""
        if value:
            clean_value = strip_tags(value).strip()
            return clean_value
        return ''
    
    def validate_winner_user_id(self, value):
        """Validar que el usuario ganador existe y estÃ¡ activo"""
        try:
            user = User.objects.get(pk=value)
            if not user.is_active:
                raise ValidationError("El usuario ganador no estÃ¡ activo")
            return value
        except User.DoesNotExist:
            raise ValidationError("Usuario ganador no existe")