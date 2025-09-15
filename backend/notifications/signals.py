# backend/notifications/signals.py

from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.contrib.auth import get_user_model
from .models import Notification, NotificationType
import logging

User = get_user_model()
logger = logging.getLogger(__name__)

@receiver(post_save, sender=Notification)
def notification_created(sender, instance, created, **kwargs):
    """
    Señal que se ejecuta cuando se crea una nueva notificación
    RF5.1: Confirmación de participación 
    RF5.2: Notificación pública del ganador
    """
    if created:
        logger.info(
            f"Nueva notificación creada: {instance.notification_type} - "
            f"{'Pública' if instance.is_public else f'Usuario: {instance.user.username if instance.user else None}'}"
        )
        
        # Aquí se podría integrar con WebSockets para notificaciones en tiempo real
        # o envío de emails, push notifications, etc.
        
        # Ejemplo de log específico por tipo de notificación
        if instance.notification_type == NotificationType.PARTICIPATION_CONFIRMED:
            logger.info(f"Participación confirmada para usuario {instance.user.username if instance.user else 'N/A'}")
        
        elif instance.notification_type == NotificationType.ROULETTE_WINNER:
            if instance.is_public:
                logger.info(f"Anuncio público de ganador: {instance.extra_data.get('winner_name', 'N/A')}")
            else:
                logger.info(f"Notificación personal de ganador para {instance.user.username if instance.user else 'N/A'}")

@receiver(post_save, sender=Notification)
def notification_read_status_changed(sender, instance, created, **kwargs):
    """
    Señal para cuando cambia el estado de lectura de una notificación
    """
    if not created and instance.is_read:
        # La notificación fue marcada como leída
        logger.debug(f"Notificación {instance.id} marcada como leída")
        
        # Aquí se podría actualizar estadísticas, métricas, etc.

# Señales para integración futura con otras apps
@receiver(post_save, sender=User)
def user_created_welcome_notification(sender, instance, created, **kwargs):
    """
    Crear notificación de bienvenida para nuevos usuarios
    """
    if created:
        try:
            welcome_notification = Notification.objects.create(
                user=instance,
                notification_type=NotificationType.PARTICIPATION_CONFIRMED,  # Usar el tipo más apropiado
                title="¡Bienvenido/a al sistema de ruletas!",
                message=f"Hola {instance.username}, ¡bienvenido/a! Ya puedes participar en las ruletas disponibles.",
                is_public=False,
                extra_data={
                    'welcome_message': True,
                    'user_registration_date': instance.date_joined.isoformat() if hasattr(instance, 'date_joined') else None,
                }
            )
            
            logger.info(f"Notificación de bienvenida creada para usuario {instance.username}")
            
        except Exception as e:
            logger.error(f"Error creando notificación de bienvenida para {instance.username}: {str(e)}")

# Señal para limpiar notificaciones cuando se elimina un usuario
@receiver(post_delete, sender=User)
def cleanup_user_notifications(sender, instance, **kwargs):
    """
    Limpiar notificaciones cuando se elimina un usuario
    """
    try:
        # Eliminar notificaciones personales del usuario
        deleted_count = Notification.objects.filter(user=instance).delete()[0]
        
        logger.info(f"Eliminadas {deleted_count} notificaciones del usuario {instance.username}")
        
    except Exception as e:
        logger.error(f"Error eliminando notificaciones del usuario {instance.username}: {str(e)}")

# Función para conectar señales personalizadas desde otras apps
def connect_roulette_signals():
    """
    Función para conectar señales relacionadas con ruletas
    Debe ser llamada desde las apps de roulettes y participants
    """
    # Esta función será importada y usada por otras apps
    # para enviar notificaciones cuando ocurran eventos específicos
    
    def create_participation_notification(sender, instance, created, **kwargs):
        """Crear notificación cuando se confirma una participación"""
        if created:
            from .services import NotificationService
            
            try:
                # Asumir que instance tiene los campos necesarios
                NotificationService.create_participation_confirmation(
                    user=instance.user,
                    roulette_name=instance.roulette.name,  # Asumiendo relación
                    roulette_id=instance.roulette.id,
                    participation_id=instance.id
                )
            except Exception as e:
                logger.error(f"Error creando notificación de participación: {str(e)}")
    
    def create_winner_notification(sender, instance, **kwargs):
        """Crear notificación cuando se selecciona un ganador"""
        try:
            from .services import NotificationService
            
            # Asumir que instance es una ruleta con ganador
            if hasattr(instance, 'winner') and instance.winner:
                NotificationService.create_winner_announcement(
                    winner_user=instance.winner,
                    roulette_name=instance.name,
                    roulette_id=instance.id,
                    total_participants=instance.participants.count()
                )
        except Exception as e:
            logger.error(f"Error creando notificación de ganador: {str(e)}")
    
    # Retornar las funciones para que puedan ser conectadas por otras apps
    return {
        'participation_created': create_participation_notification,
        'winner_selected': create_winner_notification,
    }