from django.db.models.signals import post_save, post_delete, pre_save
from django.dispatch import receiver
from django.core.files.storage import default_storage
from django.utils import timezone
import logging

from .models import Roulette, RouletteSettings, RoulettePrize, RouletteStatus
from participants.models import Participation

logger = logging.getLogger(__name__)


@receiver(post_save, sender=Roulette)
def create_roulette_settings(sender, instance, created, **kwargs):
    """
    Crear configuración por defecto cuando se crea una nueva ruleta.
    """
    if created:
        settings, created_settings = RouletteSettings.objects.get_or_create(
            roulette=instance,
            defaults={
                'max_participants': 0,
                'allow_multiple_entries': False,
                'auto_draw_when_full': False,
                'show_countdown': True,
                'notify_on_participation': True,
                'notify_on_draw': True,
            }
        )
        
        if created_settings:
            logger.info(f"Configuración creada para ruleta: {instance.name} (ID: {instance.id})")
        else:
            logger.info(f"Configuración ya existía para ruleta: {instance.name} (ID: {instance.id})")


@receiver(pre_save, sender=Roulette)
def handle_roulette_status_changes(sender, instance, **kwargs):
    """
    Manejar cambios de estado de la ruleta y validaciones antes de guardar.
    """
    if instance.pk:  # Solo si la ruleta ya existe
        try:
            old_instance = Roulette.objects.get(pk=instance.pk)
            
            # Detectar cambio de estado
            if old_instance.status != instance.status:
                logger.info(f"Ruleta {instance.name} cambió de estado: {old_instance.status} -> {instance.status}")
                
                # Si se activa una ruleta, verificar que tenga configuración
                if instance.status == RouletteStatus.ACTIVE:
                    if not hasattr(instance, 'settings') or not instance.settings:
                        logger.warning(f"Ruleta {instance.name} activada sin configuración")
                
                # Si se completa, registrar en log
                if instance.status == RouletteStatus.COMPLETED and not old_instance.is_drawn:
                    logger.info(f"Ruleta {instance.name} marcada como completada")
            
            # Detectar si se asigna ganador
            if not old_instance.winner and instance.winner:
                logger.info(f"Ganador asignado a ruleta {instance.name}: {instance.winner.user.username}")
                
        except Roulette.DoesNotExist:
            pass  # Nueva instancia, no hacer nada


@receiver(post_save, sender=Participation)
def handle_new_participation(sender, instance, created, **kwargs):
    """
    Manejar nueva participación y verificar sorteo automático.
    """
    if created:
        roulette = instance.roulette
        logger.info(f"Nueva participación en {roulette.name}: {instance.user.username}")
        
        # Verificar si se debe hacer sorteo automático al completarse
        if hasattr(roulette, 'settings') and roulette.settings:
            settings = roulette.settings
            
            if settings.auto_draw_when_full and settings.max_participants > 0:
                current_count = roulette.get_participants_count()
                
                if current_count >= settings.max_participants:
                    logger.info(f"Ruleta {roulette.name} alcanzó el límite. Iniciando sorteo automático.")
                    
                    # Importar aquí para evitar circular imports
                    from .utils import execute_roulette_draw
                    
                    try:
                        # Usar el creador de la ruleta como usuario del sorteo
                        admin_user = roulette.created_by
                        result = execute_roulette_draw(roulette, admin_user, draw_type='auto')
                        
                        if result['success']:
                            logger.info(f"Sorteo automático exitoso para {roulette.name}. Ganador: {result['winner_data']['name']}")
                        else:
                            logger.error(f"Error en sorteo automático de {roulette.name}: {result['message']}")
                            
                    except Exception as e:
                        logger.error(f"Excepción en sorteo automático de {roulette.name}: {str(e)}")


@receiver(post_delete, sender=RoulettePrize)
def delete_prize_image(sender, instance, **kwargs):
    """
    Eliminar imagen del premio cuando se elimina el registro.
    """
    if instance.image:
        try:
            if default_storage.exists(instance.image.name):
                default_storage.delete(instance.image.name)
                logger.info(f"Imagen de premio eliminada: {instance.image.name}")
        except Exception as e:
            logger.error(f"Error eliminando imagen de premio {instance.image.name}: {e}")


@receiver(post_delete, sender=Roulette)
def delete_roulette_cover(sender, instance, **kwargs):
    """
    Eliminar imagen de portada cuando se elimina la ruleta.
    """
    if instance.cover_image:
        try:
            if default_storage.exists(instance.cover_image.name):
                default_storage.delete(instance.cover_image.name)
                logger.info(f"Portada de ruleta eliminada: {instance.cover_image.name}")
        except Exception as e:
            logger.error(f"Error eliminando portada {instance.cover_image.name}: {e}")


@receiver(post_delete, sender=Roulette)
def cleanup_roulette_data(sender, instance, **kwargs):
    """
    Limpiar datos relacionados cuando se elimina una ruleta.
    """
    try:
        # Limpiar historial de sorteos
        deleted_history = instance.draw_history.all().delete()
        if deleted_history[0] > 0:
            logger.info(f"Eliminados {deleted_history[0]} registros de historial para ruleta: {instance.name}")
        
        # Las participaciones y premios se eliminan automáticamente por CASCADE
        logger.info(f"Limpieza completa para ruleta eliminada: {instance.name}")
        
    except Exception as e:
        logger.error(f"Error en limpieza de datos para ruleta {instance.name}: {e}")


@receiver(post_save, sender=RoulettePrize)
def handle_prize_changes(sender, instance, created, **kwargs):
    """
    Manejar cambios en los premios de la ruleta.
    """
    action = "creado" if created else "actualizado"
    logger.info(f"Premio {action} en ruleta {instance.roulette.name}: {instance.name}")
    
    # Validar probabilidades si se actualiza
    if not created:
        roulette = instance.roulette
        total_probability = sum([
            prize.probability for prize in roulette.prizes.filter(is_active=True) 
            if prize.probability > 0
        ])
        
        if total_probability > 100:
            logger.warning(f"Ruleta {roulette.name}: Suma de probabilidades excede 100% ({total_probability}%)")


@receiver(pre_save, sender=RoulettePrize)
def validate_prize_before_save(sender, instance, **kwargs):
    """
    Validar premio antes de guardarlo.
    """
    # Validar stock
    if instance.stock < 0:
        logger.warning(f"Intento de guardar premio {instance.name} con stock negativo: {instance.stock}")
        instance.stock = 0
    
    # Validar probabilidad
    if instance.probability < 0:
        logger.warning(f"Intento de guardar premio {instance.name} con probabilidad negativa: {instance.probability}")
        instance.probability = 0
    elif instance.probability > 100:
        logger.warning(f"Intento de guardar premio {instance.name} con probabilidad > 100%: {instance.probability}")
        instance.probability = 100


# Señal personalizada para notificaciones (opcional)
from django.dispatch import Signal

# Definir señales personalizadas
roulette_draw_completed = Signal()
roulette_participation_limit_reached = Signal()
roulette_scheduled_date_reached = Signal()


@receiver(roulette_draw_completed)
def handle_draw_completed(sender, roulette, winner, draw_type, **kwargs):
    """
    Manejar evento de sorteo completado.
    Aquí puedes agregar lógica para enviar emails, notificaciones push, etc.
    """
    logger.info(f"Señal de sorteo completado recibida para {roulette.name}. Ganador: {winner.user.username}")
    
    # Aquí puedes agregar:
    # - Envío de emails al ganador
    # - Notificaciones push
    # - Webhooks a sistemas externos
    # - Actualización de estadísticas
    
    # Ejemplo de log estructurado
    logger.info(
        f"DRAW_COMPLETED: roulette_id={roulette.id}, "
        f"winner_id={winner.id}, draw_type={draw_type}, "
        f"participants_count={roulette.get_participants_count()}"
    )


def connect_signals():
    """
    Función para conectar señales manualmente si es necesario.
    Normalmente Django las conecta automáticamente.
    """
    logger.info("Señales de roulettes conectadas")


# Función para apps.py
def ready():
    """
    Función que se llama cuando la app está lista.
    Agrega esto en apps.py:
    
    def ready(self):
        import roulettes.signals
    """
    logger.info("Sistema de señales de ruletas inicializado")
    
    # Opcional: realizar verificaciones de integridad al iniciar
    try:
        from .models import Roulette
        roulettes_without_settings = Roulette.objects.filter(settings__isnull=True).count()
        if roulettes_without_settings > 0:
            logger.warning(f"Encontradas {roulettes_without_settings} ruletas sin configuración")
    except Exception as e:
        logger.error(f"Error en verificación inicial de ruletas: {e}")