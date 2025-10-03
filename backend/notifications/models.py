# backend/notifications/models.py

from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()

class NotificationType(models.TextChoices):
    """Tipos de notificaciones disponibles"""
    PARTICIPATION_CONFIRMED = 'participation_confirmed', 'Participación Confirmada'
    ROULETTE_WINNER = 'roulette_winner', 'Ganador de Ruleta'
    ROULETTE_STARTED = 'roulette_started', 'Sorteo Iniciado'
    ROULETTE_ENDING_SOON = 'roulette_ending_soon', 'Sorteo Próximo a Terminar'
    WINNER_NOTIFICATION = 'winner_notification', 'Notificación Personal de Victoria'
    ADMIN_WINNER_ALERT = 'admin_winner_alert', 'Alerta de Ganador (Admin)'
    WELCOME_MESSAGE = 'welcome_message', 'Mensaje de Bienvenida'

class Notification(models.Model):
    """
    Modelo para almacenar notificaciones del sistema
    RF5.1: Confirmación de participación
    RF5.2: Notificación pública del ganador
    """
    user = models.ForeignKey(
        User, 
        on_delete=models.CASCADE, 
        related_name='notifications',
        null=True, 
        blank=True,
        help_text="Usuario destinatario (null para notificaciones públicas)"
    )
    notification_type = models.CharField(
        max_length=30,
        choices=NotificationType.choices,
        help_text="Tipo de notificación"
    )
    title = models.CharField(
        max_length=200,
        help_text="Título de la notificación"
    )
    message = models.TextField(
        help_text="Contenido del mensaje"
    )
    is_public = models.BooleanField(
        default=False,
        help_text="Si es True, la notificación es visible para todos los usuarios"
    )
    is_read = models.BooleanField(
        default=False,
        help_text="Indica si la notificación ha sido leída"
    )
    is_admin_only = models.BooleanField(
        default=False,
        help_text="Si es True, solo visible para administradores"
    )
    priority = models.CharField(
        max_length=10,
        choices=[
            ('low', 'Baja'),
            ('normal', 'Normal'),
            ('high', 'Alta'),
            ('urgent', 'Urgente'),
        ],
        default='normal',
        help_text="Prioridad de la notificación"
    )
    
    # Campos relacionados para contexto
    roulette_id = models.PositiveIntegerField(
        null=True, 
        blank=True,
        help_text="ID de la ruleta relacionada"
    )
    participation_id = models.PositiveIntegerField(
        null=True, 
        blank=True,
        help_text="ID de la participación relacionada"
    )
    
    # Metadatos adicionales en JSON
    extra_data = models.JSONField(
        default=dict,
        blank=True,
        help_text="Datos adicionales de la notificación"
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    expires_at = models.DateTimeField(
        null=True, 
        blank=True,
        help_text="Fecha de expiración de la notificación"
    )
    
    email_sent = models.BooleanField(
        default=False,
        help_text="Indica si se envió email de esta notificación"
    )
    email_sent_at = models.DateTimeField(
        null=True, 
        blank=True,
        help_text="Fecha y hora de envío del email"
    )
    email_error = models.TextField(
        blank=True, 
        default='',
        help_text="Mensaje de error si el envío falló"
    )
    email_recipient = models.EmailField(
        blank=True, 
        default='',
        help_text="Email del destinatario"
    )
    
    class Meta:
        db_table = 'notifications'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'is_read']),
            models.Index(fields=['notification_type', 'created_at']),
            models.Index(fields=['is_public', 'created_at']),
            models.Index(fields=['is_admin_only', 'created_at']),
            models.Index(fields=['roulette_id']),
            models.Index(fields=['priority', 'is_read']),
            models.Index(fields=['email_sent', 'created_at']),
        ]
    
    def __str__(self) -> str:
        recipient = f"Para: {self.user.username}" if self.user else "Público"
        if self.is_admin_only:
            recipient = "Admin"
        return f"{self.title} - {recipient}"
    
    def mark_as_read(self) -> None:
        """Marcar notificación como leída"""
        if not self.is_read:
            self.is_read = True
            self.save(update_fields=['is_read', 'updated_at'])

class AdminNotificationPreference(models.Model):
    """
    Configuración de notificaciones para administradores
    """
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='admin_notification_preferences'
    )
    notify_on_winner = models.BooleanField(
        default=True,
        help_text="Recibir notificación cuando hay un ganador"
    )
    notify_on_new_participation = models.BooleanField(
        default=False,
        help_text="Recibir notificación en cada nueva participación"
    )
    notify_on_roulette_created = models.BooleanField(
        default=True,
        help_text="Recibir notificación cuando se crea una nueva ruleta"
    )
    email_notifications = models.BooleanField(
        default=False,
        help_text="Enviar también por email"
    )
    min_participants_alert = models.PositiveIntegerField(
        default=10,
        help_text="Alertar solo si la ruleta tiene este mínimo de participantes"
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'admin_notification_preferences'

class RealTimeMessage(models.Model):
    """
    Modelo para mensajes en tiempo real
    RNF4.3: Mostrar sorteo en tiempo real
    """
    channel_name = models.CharField(
        max_length=100,
        help_text="Nombre del canal WebSocket"
    )
    message_type = models.CharField(
        max_length=50,
        help_text="Tipo de mensaje en tiempo real"
    )
    content = models.JSONField(
        help_text="Contenido del mensaje"
    )
    roulette_id = models.PositiveIntegerField(
        null=True, 
        blank=True,
        help_text="ID de la ruleta relacionada"
    )
    sent_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'realtime_messages'
        ordering = ['-sent_at']
        indexes = [
            models.Index(fields=['channel_name', 'sent_at']),
            models.Index(fields=['roulette_id', 'sent_at']),
        ]
    
    def __str__(self) -> str:
        return f"{self.message_type} - Canal: {self.channel_name}"

class NotificationTemplate(models.Model):
    """
    Plantillas para notificaciones reutilizables
    """
    name = models.CharField(max_length=100, unique=True)
    notification_type = models.CharField(
        max_length=30,
        choices=NotificationType.choices
    )
    title_template = models.CharField(max_length=200)
    message_template = models.TextField()
    is_active = models.BooleanField(default=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'notification_templates'
    
    def __str__(self) -> str:
        return f"Template: {self.name}"
