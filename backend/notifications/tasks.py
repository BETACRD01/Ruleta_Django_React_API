# backend/notifications/tasks.py
from celery import shared_task
from django.contrib.auth import get_user_model
from django.conf import settings
from django.utils import timezone
import logging

from .winner_email_service import WinnerNotificationContext, WinnerEmailService
from .models import Notification

logger = logging.getLogger(__name__)
User = get_user_model()

@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_jitter=True
)
def send_winner_notification_delayed(
    self,
    user_id: int,
    roulette_name: str,
    prize_name: str,
    prize_description: str = None,
    prize_image_url: str = None,
    prize_rank: int = None,
    pickup_instructions: str = None,
    roulette_id: int = None,
    prize_id: int = None,
    notify_admins: bool = True
):
    """Tarea Celery para enviar notificación de ganador"""
    
    logger.info(
        f"CELERY TASK EXECUTING - Task ID: {self.request.id}, "
        f"User ID: {user_id}, Attempt: {self.request.retries + 1}"
    )
    
    try:
        # Obtener usuario
        try:
            winner = User.objects.get(id=user_id)
            logger.info(f"User found: {winner.username} ({winner.email})")
        except User.DoesNotExist:
            logger.error(f"User {user_id} not found")
            return {"success": False, "error": "Usuario no encontrado"}
        
        # Validar email
        if not winner.email or not winner.email.strip():
            logger.warning(f"User {user_id} has no email configured")
            return {"success": False, "error": "Usuario sin email"}
        
        # Crear contexto
        context = WinnerNotificationContext(
            winner=winner,
            roulette_name=roulette_name,
            prize_name=prize_name,
            prize_description=prize_description,
            prize_image_url=prize_image_url,
            prize_rank=prize_rank,
            pickup_instructions=pickup_instructions,
            roulette_id=roulette_id,
            prize_id=prize_id
        )
        
        logger.info("Invoking WinnerEmailService.send_winner_notification...")
        
        # Enviar notificación
        result = WinnerEmailService.send_winner_notification(
            context,
            notify_admins=notify_admins
        )
        
        logger.info(f"Send result: {result}")
        
        # Procesar resultado
        if result.get("winner_sent"):
            logger.info(
                f"EMAIL SENT SUCCESSFULLY to {winner.email} at "
                f"{timezone.now().strftime('%H:%M:%S')}"
            )
            
            # Actualizar notificación en BD
            _update_notification_status(
                winner=winner,
                roulette_id=roulette_id,
                success=True,
                recipient_email=winner.email
            )
            
            return {
                "success": True,
                "user_id": user_id,
                "email": winner.email,
                "result": result,
                "sent_at": timezone.now().isoformat()
            }
        else:
            # Manejar error
            errors = result.get("errors", [])
            error_msg = errors[0] if errors else "Error desconocido al enviar email"
            
            logger.error(f"Failed to send email: {error_msg}")
            
            # Actualizar BD con error
            _update_notification_status(
                winner=winner,
                roulette_id=roulette_id,
                success=False,
                error_message=error_msg
            )
            
            # Reintentar si quedan intentos
            if self.request.retries < self.max_retries:
                logger.warning(
                    f"Retrying... ({self.request.retries + 1}/{self.max_retries})"
                )
                raise Exception(f"Send failed: {error_msg}")
            
            return {"success": False, "error": error_msg}
            
    except Exception as e:
        logger.error(
            f"Error in task (user_id={user_id}): {str(e)}", 
            exc_info=True
        )
        
        # Si quedan reintentos, propagar excepción
        if self.request.retries < self.max_retries:
            logger.warning("Retrying after exception...")
            raise
        
        logger.error("Retries exhausted. Aborting.")
        return {"success": False, "error": str(e)}


def _update_notification_status(
    winner,
    roulette_id: int,
    success: bool,
    recipient_email: str = None,
    error_message: str = None
):
    """Helper para actualizar estado de notificación"""
    try:
        notification = Notification.objects.filter(
            user=winner,
            roulette_id=roulette_id,
            notification_type='winner_notification'
        ).order_by('-created_at').first()
        
        if notification:
            notification.email_sent = success
            notification.email_sent_at = timezone.now() if success else None
            notification.email_error = error_message or ''
            notification.email_recipient = recipient_email or winner.email
            notification.save()
            logger.info(f"Notification {notification.id} status updated")
        else:
            logger.warning("Notification not found for status update")
    except Exception as e:
        logger.error(f"Error updating notification status: {str(e)}")


@shared_task(bind=True, max_retries=2)
def send_batch_winner_notifications_delayed(
    self,
    winner_data_list: list,
    delay_seconds: int = None
):
    """Envía múltiples notificaciones con retraso escalonado"""
    if delay_seconds is None:
        delay_seconds = getattr(settings, 'WINNER_NOTIFICATION_DELAY', 300)
    
    logger.info(
        f"BATCH: Starting batch of {len(winner_data_list)} notifications "
        f"with base delay of {delay_seconds}s ({delay_seconds/60:.1f}min)"
    )
    
    results = []
    
    for i, winner_data in enumerate(winner_data_list):
        try:
            # Retraso escalonado
            task_delay = delay_seconds + (i * 30)
            
            logger.info(
                f"BATCH: Scheduling {i+1}/{len(winner_data_list)} "
                f"with {task_delay}s delay for user_id={winner_data.get('user_id')}"
            )
            
            # Programar tarea
            task = send_winner_notification_delayed.apply_async(
                kwargs=winner_data,
                countdown=task_delay
            )
            
            results.append({
                "index": i,
                "task_id": task.id,
                "delay": task_delay,
                "user_id": winner_data.get("user_id")
            })
            
            logger.info(f"BATCH: Task {task.id} scheduled")
            
        except Exception as e:
            logger.error(f"BATCH: Error scheduling task {i}: {str(e)}")
            results.append({
                "index": i,
                "error": str(e),
                "user_id": winner_data.get("user_id")
            })
    
    logger.info(f"BATCH: Complete - {len(results)} tasks scheduled")
    return results