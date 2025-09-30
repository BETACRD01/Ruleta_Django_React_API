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
    """
    Tarea Celery para enviar notificación de ganador con retraso
    """
    
    logger.warning("=" * 70)
    logger.warning(f"⏰ [CELERY TASK] TAREA EJECUTÁNDOSE AHORA")
    logger.warning(f"   - Task ID: {self.request.id}")
    logger.warning(f"   - Hora actual: {timezone.now().strftime('%Y-%m-%d %H:%M:%S')}")
    logger.warning(f"   - Usuario ID: {user_id}")
    logger.warning(f"   - Intento: {self.request.retries + 1}/{self.max_retries + 1}")
    logger.warning("=" * 70)
    
    try:
        # Obtener usuario
        try:
            winner = User.objects.get(id=user_id)
            logger.info(f"✅ [CELERY] Usuario encontrado: {winner.username} ({winner.email})")
        except User.DoesNotExist:
            logger.error(f"❌ [CELERY] Usuario {user_id} no encontrado")
            return {"success": False, "error": "Usuario no encontrado"}
        
        # Validar email
        if not winner.email or not winner.email.strip():
            logger.warning(f"⚠️  [CELERY] Usuario {user_id} sin email configurado")
            return {"success": False, "error": "Usuario sin email"}
        
        logger.info(f"📧 [CELERY] Preparando email para: {winner.email}")
        
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
        
        logger.info(f"📤 [CELERY] Invocando WinnerEmailService.send_winner_notification...")
        
        # Enviar notificación
        result = WinnerEmailService.send_winner_notification(
            context,
            notify_admins=notify_admins
        )
        
        logger.warning(f"📬 [CELERY] Resultado del envío: {result}")
        
        if result.get("winner_sent"):
            logger.warning("=" * 70)
            logger.warning(f"✅ [CELERY] EMAIL ENVIADO EXITOSAMENTE")
            logger.warning(f"   - Destinatario: {winner.email}")
            logger.warning(f"   - Hora de envío: {timezone.now().strftime('%H:%M:%S')}")
            logger.warning(f"   - Task ID: {self.request.id}")
            logger.warning("=" * 70)
            
            # Actualizar notificación en BD
            try:
                notification = Notification.objects.filter(
                    user=winner,
                    roulette_id=roulette_id,
                    notification_type='winner_notification'
                ).order_by('-created_at').first()
                
                if notification:
                    notification.email_sent = True
                    notification.email_sent_at = timezone.now()
                    notification.email_error = ''
                    notification.email_recipient = winner.email
                    notification.save()
                    logger.info(f"✅ [CELERY] Estado actualizado en BD - Notificación ID: {notification.id}")
                else:
                    logger.warning(f"⚠️  [CELERY] No se encontró notificación para actualizar")
            except Exception as e:
                logger.error(f"❌ [CELERY] Error actualizando BD: {str(e)}")
            
            return {
                "success": True,
                "user_id": user_id,
                "email": winner.email,
                "result": result,
                "sent_at": timezone.now().isoformat()
            }
        else:
            error_msg = result.get("errors", ["Error desconocido"])[0]
            logger.error(f"❌ [CELERY] Fallo al enviar: {error_msg}")
            
            # Actualizar BD con error
            try:
                notification = Notification.objects.filter(
                    user=winner,
                    roulette_id=roulette_id,
                    notification_type='winner_notification'
                ).order_by('-created_at').first()
                
                if notification:
                    notification.email_sent = False
                    notification.email_error = error_msg
                    notification.save()
                    logger.info(f"✅ [CELERY] Error registrado en BD")
            except Exception as e:
                logger.error(f"❌ [CELERY] Error actualizando BD con error: {str(e)}")
            
            # Reintentar si quedan intentos
            if self.request.retries < self.max_retries:
                logger.warning(f"🔄 [CELERY] Reintentando... ({self.request.retries + 1}/{self.max_retries})")
                raise Exception(f"Fallo en envío: {error_msg}")
            
            return {"success": False, "error": error_msg}
            
    except Exception as e:
        logger.error(f"❌ [CELERY] Error en tarea (user_id={user_id}): {str(e)}")
        logger.exception("Detalles completos del error:")
        
        # Si quedan reintentos, propagar excepción
        if self.request.retries < self.max_retries:
            logger.warning(f"🔄 [CELERY] Reintentando después de error...")
            raise
        
        logger.error(f"❌ [CELERY] Reintentos agotados. Abortando.")
        return {"success": False, "error": str(e)}


@shared_task(bind=True, max_retries=2)
def send_batch_winner_notifications_delayed(
    self,
    winner_data_list: list,
    delay_seconds: int = None
):
    """
    Envía múltiples notificaciones con retraso escalonado
    """
    if delay_seconds is None:
        delay_seconds = getattr(settings, 'WINNER_NOTIFICATION_DELAY', 300)
    
    logger.warning(f"📦 [BATCH] Iniciando lote de {len(winner_data_list)} notificaciones")
    logger.warning(f"   - Delay base: {delay_seconds} segundos ({delay_seconds/60:.1f} min)")
    
    results = []
    
    for i, winner_data in enumerate(winner_data_list):
        try:
            # Retraso escalonado: delay_base + (i * 30 segundos)
            task_delay = delay_seconds + (i * 30)
            
            logger.info(
                f"📧 [BATCH] Programando {i+1}/{len(winner_data_list)} "
                f"con delay de {task_delay}s para user_id={winner_data.get('user_id')}"
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
            
            logger.info(f"✅ [BATCH] Task {task.id} programado")
            
        except Exception as e:
            logger.error(f"❌ [BATCH] Error programando tarea {i}: {str(e)}")
            results.append({
                "index": i,
                "error": str(e),
                "user_id": winner_data.get("user_id")
            })
    
    logger.warning(f"✅ [BATCH] Lote completo: {len(results)} tareas programadas")
    return results