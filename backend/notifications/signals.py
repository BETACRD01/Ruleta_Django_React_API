# backend/notifications/signals.py

from django.db.models.signals import post_save, post_delete, pre_save
from django.dispatch import receiver, Signal
from django.contrib.auth import get_user_model
from django.utils import timezone
from .models import Notification, NotificationType, AdminNotificationPreference
from .services import NotificationService
import logging

User = get_user_model()
logger = logging.getLogger(__name__)

# Señales personalizadas para eventos de ruletas
roulette_created = Signal()
roulette_winner_selected = Signal()
roulette_participation_confirmed = Signal()
roulette_ending_soon = Signal()

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
            f"ID: {instance.id} - "
            f"{'Pública' if instance.is_public else 'Admin' if instance.is_admin_only else f'Usuario: {instance.user.username if instance.user else None}'}"
        )
        
        # Logging específico por tipo de notificación
        if instance.notification_type == NotificationType.PARTICIPATION_CONFIRMED:
            logger.info(f"Participación confirmada para usuario {instance.user.username if instance.user else 'N/A'}")
        
        elif instance.notification_type == NotificationType.ROULETTE_WINNER:
            if instance.is_public:
                winner_name = instance.extra_data.get('winner_name', 'N/A')
                roulette_name = instance.extra_data.get('roulette_name', 'N/A')
                logger.info(f"Anuncio público de ganador: {winner_name} en {roulette_name}")
            else:
                logger.info(f"Notificación personal de ganador para {instance.user.username if instance.user else 'N/A'}")
        
        elif instance.notification_type == NotificationType.WINNER_NOTIFICATION:
            logger.info(f"Notificación personal de victoria para {instance.user.username if instance.user else 'N/A'}")
        
        elif instance.notification_type == NotificationType.ADMIN_WINNER_ALERT:
            winner_name = instance.extra_data.get('winner_name', 'N/A')
            logger.info(f"Alerta de admin para ganador: {winner_name}")

@receiver(post_save, sender=Notification)
def notification_read_status_changed(sender, instance, created, **kwargs):
    """
    Señal para cuando cambia el estado de lectura de una notificación
    """
    if not created and instance.is_read:
        logger.debug(f"Notificación {instance.id} marcada como leída")

@receiver(pre_save, sender=Notification)
def notification_pre_save(sender, instance, **kwargs):
    """
    Señal antes de guardar notificación - validaciones adicionales
    """
    # Verificar si la notificación ha expirado
    if instance.expires_at and instance.expires_at <= timezone.now():
        logger.warning(f"Notificación {instance.id} ha expirado pero se está guardando")
    
    # Log de cambios importantes
    if instance.pk:  # Si ya existe
        try:
            old_instance = Notification.objects.get(pk=instance.pk)
            if old_instance.is_read != instance.is_read and instance.is_read:
                logger.info(f"Notificación {instance.id} será marcada como leída")
        except Notification.DoesNotExist:
            pass

@receiver(post_save, sender=User)
def user_created_welcome_notification(sender, instance, created, **kwargs):
    """
    Crear notificación de bienvenida para nuevos usuarios
    """
    if created:
        try:
            welcome_notification = Notification.objects.create(
                user=instance,
                notification_type=NotificationType.WELCOME_MESSAGE,
                title="¡Bienvenido/a al sistema de ruletas!",
                message=f"Hola {instance.username}, ¡bienvenido/a! Ya puedes participar en las ruletas disponibles. Explora el sistema y ¡que tengas suerte!",
                is_public=False,
                priority='normal',
                extra_data={
                    'welcome_message': True,
                    'user_registration_date': instance.date_joined.isoformat() if hasattr(instance, 'date_joined') else timezone.now().isoformat(),
                    'first_login_tips': True,
                }
            )
            
            logger.info(f"Notificación de bienvenida creada para usuario {instance.username}")
            
            # Crear preferencias de admin si el usuario es staff
            if instance.is_staff:
                AdminNotificationPreference.objects.get_or_create(
                    user=instance,
                    defaults={
                        'notify_on_winner': True,
                        'notify_on_new_participation': False,
                        'notify_on_roulette_created': True,
                        'email_notifications': False,
                        'min_participants_alert': 10,
                    }
                )
                logger.info(f"Preferencias de admin creadas para {instance.username}")
            
        except Exception as e:
            logger.error(f"Error creando notificación de bienvenida para {instance.username}: {str(e)}")

@receiver(post_delete, sender=User)
def cleanup_user_notifications(sender, instance, **kwargs):
    """
    Limpiar notificaciones cuando se elimina un usuario
    """
    try:
        # Eliminar notificaciones personales del usuario
        deleted_count = Notification.objects.filter(user=instance).delete()[0]
        
        # Eliminar preferencias de admin si existen
        try:
            AdminNotificationPreference.objects.get(user=instance).delete()
        except AdminNotificationPreference.DoesNotExist:
            pass
        
        logger.info(f"Eliminadas {deleted_count} notificaciones del usuario {instance.username}")
        
    except Exception as e:
        logger.error(f"Error eliminando notificaciones del usuario {instance.username}: {str(e)}")

# Conectores para señales de otras aplicaciones

@receiver(roulette_created)
def handle_roulette_created(sender, **kwargs):
    """
    Manejar creación de nueva ruleta
    """
    try:
        roulette_name = kwargs.get('roulette_name', 'Nueva ruleta')
        roulette_id = kwargs.get('roulette_id')
        creator_username = kwargs.get('creator_username', 'Sistema')
        end_date = kwargs.get('end_date')
        
        NotificationService.create_roulette_started_announcement(
            roulette_name=roulette_name,
            roulette_id=roulette_id,
            creator_username=creator_username,
            end_date=end_date
        )
        
        logger.info(f"Notificación de nueva ruleta creada: {roulette_name}")
        
    except Exception as e:
        logger.error(f"Error manejando creación de ruleta: {str(e)}")

@receiver(roulette_winner_selected)
def handle_roulette_winner_selected(sender, **kwargs):
    """
    Manejar selección de ganador de ruleta
    """
    try:
        winner_user = kwargs.get('winner_user')
        roulette_name = kwargs.get('roulette_name', 'Ruleta')
        roulette_id = kwargs.get('roulette_id')
        total_participants = kwargs.get('total_participants', 0)
        prize_details = kwargs.get('prize_details', '')
        
        if not winner_user:
            logger.error("No se proporcionó winner_user en la señal")
            return
        
        # Crear todas las notificaciones de ganador
        public_notif, personal_notif, admin_notifs = NotificationService.create_winner_announcement(
            winner_user=winner_user,
            roulette_name=roulette_name,
            roulette_id=roulette_id,
            total_participants=total_participants,
            prize_details=prize_details
        )
        
        logger.info(f"Notificaciones de ganador creadas para {winner_user.username} en ruleta {roulette_id}")
        
    except Exception as e:
        logger.error(f"Error manejando selección de ganador: {str(e)}")

@receiver(roulette_participation_confirmed)
def handle_roulette_participation_confirmed(sender, **kwargs):
    """
    Manejar confirmación de participación en ruleta
    """
    try:
        user = kwargs.get('user')
        roulette_name = kwargs.get('roulette_name', 'Ruleta')
        roulette_id = kwargs.get('roulette_id')
        participation_id = kwargs.get('participation_id')
        
        if not user:
            logger.error("No se proporcionó user en la señal de participación")
            return
        
        NotificationService.create_participation_confirmation(
            user=user,
            roulette_name=roulette_name,
            roulette_id=roulette_id,
            participation_id=participation_id
        )
        
        logger.info(f"Notificación de participación confirmada para {user.username} en ruleta {roulette_id}")
        
    except Exception as e:
        logger.error(f"Error manejando confirmación de participación: {str(e)}")

@receiver(roulette_ending_soon)
def handle_roulette_ending_soon(sender, **kwargs):
    """
    Manejar alerta de ruleta próxima a terminar
    """
    try:
        roulette_name = kwargs.get('roulette_name', 'Ruleta')
        roulette_id = kwargs.get('roulette_id')
        hours_remaining = kwargs.get('hours_remaining', 0)
        
        NotificationService.create_roulette_ending_alert(
            roulette_name=roulette_name,
            roulette_id=roulette_id,
            hours_remaining=hours_remaining
        )
        
        logger.info(f"Alerta de ruleta terminando pronto: {roulette_name} ({hours_remaining}h restantes)")
        
    except Exception as e:
        logger.error(f"Error manejando alerta de ruleta terminando: {str(e)}")

# Función para conectar señales desde otras aplicaciones
def connect_roulette_signals():
    """
    Función para ser llamada desde otras apps para conectar sus señales
    """
    def create_participation_notification(sender, instance, created, **kwargs):
        """Crear notificación cuando se confirma una participación"""
        if created:
            try:
                # Emitir señal personalizada
                roulette_participation_confirmed.send(
                    sender=sender,
                    user=instance.user,
                    roulette_name=instance.roulette.name,
                    roulette_id=instance.roulette.id,
                    participation_id=instance.id
                )
            except Exception as e:
                logger.error(f"Error enviando señal de participación: {str(e)}")
    
    def create_winner_notification(sender, instance, **kwargs):
        """Crear notificación cuando se selecciona un ganador"""
        try:
            if hasattr(instance, 'winner') and instance.winner:
                # Emitir señal personalizada
                roulette_winner_selected.send(
                    sender=sender,
                    winner_user=instance.winner,
                    roulette_name=instance.name,
                    roulette_id=instance.id,
                    total_participants=instance.participants.count() if hasattr(instance, 'participants') else 0,
                    prize_details=getattr(instance, 'prize_description', '')
                )
        except Exception as e:
            logger.error(f"Error enviando señal de ganador: {str(e)}")
    
    def create_roulette_created_notification(sender, instance, created, **kwargs):
        """Crear notificación cuando se crea una nueva ruleta"""
        if created:
            try:
                # Emitir señal personalizada
                roulette_created.send(
                    sender=sender,
                    roulette_name=instance.name,
                    roulette_id=instance.id,
                    creator_username=instance.creator.username if hasattr(instance, 'creator') else 'Sistema',
                    end_date=getattr(instance, 'end_date', None)
                )
            except Exception as e:
                logger.error(f"Error enviando señal de ruleta creada: {str(e)}")
    
    # Retornar las funciones para que puedan ser conectadas por otras apps
    return {
        'participation_created': create_participation_notification,
        'winner_selected': create_winner_notification,
        'roulette_created': create_roulette_created_notification,
    }

# Función para configurar notificaciones automáticas
def setup_periodic_notifications():
    """
    Configurar tareas periódicas para notificaciones automáticas
    Esta función debe ser llamada desde una tarea programada (ej: celery)
    """
    from datetime import datetime, timedelta
    
    # Simular verificación de ruletas próximas a terminar
    # En implementación real, consultaría la base de datos de ruletas
    try:
        # Ejemplo: buscar ruletas que terminen en las próximas 2 horas
        # y que no hayan enviado alerta reciente
        
        logger.info("Verificando ruletas próximas a terminar...")
        
        # Aquí iría la lógica real de consulta a la base de datos
        # Por ahora solo log informativo
        
    except Exception as e:
        logger.error(f"Error en verificación periódica: {str(e)}")

# Limpieza automática de notificaciones expiradas
@receiver(post_save, sender=Notification)
def cleanup_expired_notifications(sender, instance, created, **kwargs):
    """
    Limpiar notificaciones expiradas periódicamente
    """
    if created:  # Solo ejecutar en nuevas notificaciones para no sobrecargar
        try:
            from django.db.models import Q
            
            # Eliminar notificaciones expiradas y leídas
            expired_count = Notification.objects.filter(
                Q(expires_at__lt=timezone.now()) & Q(is_read=True)
            ).delete()[0]
            
            if expired_count > 0:
                logger.info(f"Limpieza automática: {expired_count} notificaciones expiradas eliminadas")
                
        except Exception as e:
            logger.error(f"Error en limpieza automática: {str(e)}")

# Métricas y monitoreo
def log_notification_metrics():
    """
    Registrar métricas de notificaciones para monitoreo
    """
    try:
        total_notifications = Notification.objects.count()
        unread_notifications = Notification.objects.filter(is_read=False).count()
        today_notifications = Notification.objects.filter(
            created_at__date=timezone.now().date()
        ).count()
        
        logger.info(
            f"Métricas de notificaciones - "
            f"Total: {total_notifications}, "
            f"No leídas: {unread_notifications}, "
            f"Hoy: {today_notifications}"
        )
        
    except Exception as e:
        logger.error(f"Error registrando métricas: {str(e)}")