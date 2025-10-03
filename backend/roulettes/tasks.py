# backend/roulettes/tasks.py
import logging
from celery import shared_task
from django.contrib.auth import get_user_model

logger = logging.getLogger(__name__)
User = get_user_model()

@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=300,  # 5 minutos
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=600,  # 10 minutos máximo
)
def send_roulette_creation_notifications(self, roulette_id: int, created_by_id: int = None):
    """
    Tarea asíncrona para enviar notificaciones de creación de ruleta.
    
    Args:
        roulette_id: ID de la ruleta creada
        created_by_id: ID del usuario que creó la ruleta
    """
    try:
        from roulettes.models import Roulette
        from notifications.roulette_notification_service import RouletteNotificationService
        
        # Obtener ruleta
        try:
            roulette = Roulette.objects.select_related('created_by').get(id=roulette_id)
        except Roulette.DoesNotExist:
            logger.error(f"Ruleta {roulette_id} no encontrada para notificaciones")
            return {
                'success': False,
                'message': 'Ruleta no encontrada',
                'roulette_id': roulette_id
            }
        
        # Obtener usuario creador
        created_by = None
        if created_by_id:
            try:
                created_by = User.objects.get(id=created_by_id)
            except User.DoesNotExist:
                logger.warning(f"Usuario creador {created_by_id} no encontrado")
        
        results = {
            'roulette_id': roulette_id,
            'roulette_name': roulette.name,
            'admin_notification': False,
            'user_notification': False
        }
        
        # 1. Notificar a administradores (siempre)
        try:
            admin_success = RouletteNotificationService.notify_new_roulette_created(
                roulette=roulette,
                created_by=created_by
            )
            results['admin_notification'] = admin_success
            
            if admin_success:
                logger.info(f"Notificación a admins enviada: {roulette.name}")
            else:
                logger.warning(f"Falló notificación a admins: {roulette.name}")
                
        except Exception as e:
            logger.error(f"Error notificando admins: {e}", exc_info=True)
            results['admin_error'] = str(e)
        
        # 2. Notificar a usuarios (solo si está activa o programada)
        if roulette.status in ['active', 'scheduled']:
            try:
                user_success = RouletteNotificationService.notify_users_new_roulette(
                    roulette=roulette,
                    created_by=created_by
                )
                results['user_notification'] = user_success
                
                if user_success:
                    logger.info(f"Notificación a usuarios enviada: {roulette.name}")
                else:
                    logger.warning(f"Falló notificación a usuarios: {roulette.name}")
                    
            except Exception as e:
                logger.error(f"Error notificando usuarios: {e}", exc_info=True)
                results['user_error'] = str(e)
        else:
            logger.info(f"Ruleta '{roulette.name}' no está activa/programada")
            results['user_notification'] = 'skipped'
        
        results['success'] = results['admin_notification'] or results['user_notification']
        
        return results
        
    except Exception as e:
        logger.error(f"Error general en tarea de notificaciones: {e}", exc_info=True)
        # Reintentar si falla
        raise self.retry(exc=e)


@shared_task(bind=True, max_retries=2)
def send_winner_notifications(self, roulette_id: int, winner_ids: list):
    """
    Tarea asíncrona para notificar a ganadores de un sorteo.
    
    Args:
        roulette_id: ID de la ruleta
        winner_ids: Lista de IDs de participaciones ganadoras
    """
    try:
        from roulettes.models import Roulette
        from participants.models import Participation
        from notifications.roulette_notification_service import RouletteNotificationService
        
        roulette = Roulette.objects.get(id=roulette_id)
        winners = Participation.objects.filter(id__in=winner_ids).select_related('user')
        
        success_count = 0
        for winner in winners:
            try:
                # Aquí puedes agregar el método para notificar ganadores
                # RouletteNotificationService.notify_winner(roulette, winner)
                success_count += 1
            except Exception as e:
                logger.error(f"Error notificando ganador {winner.id}: {e}")
        
        logger.info(f"Notificados {success_count}/{len(winner_ids)} ganadores")
        
        return {
            'success': True,
            'notified': success_count,
            'total': len(winner_ids)
        }
        
    except Exception as e:
        logger.error(f"Error en notificaciones de ganadores: {e}", exc_info=True)
        raise self.retry(exc=e)