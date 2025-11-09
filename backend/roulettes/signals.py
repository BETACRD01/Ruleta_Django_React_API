# backend/roulettes/signals.py
from __future__ import annotations

import logging
from typing import Optional

from django.core.files.storage import default_storage
from django.db.models.signals import post_save, pre_save, pre_delete
from django.dispatch import receiver, Signal
from django.db import transaction

from .models import Roulette, RouletteSettings, RoulettePrize, RouletteStatus

logger = logging.getLogger(__name__)

# ============================================================
# Helpers
# ============================================================

def _safe_delete_storage_path(path: Optional[str], *, label: str) -> None:
    """
    Elimina un archivo del almacenamiento si existe.
    No levanta excepción: loguea y continúa.
    """
    if not path:
        return
    try:
        if default_storage.exists(path):
            default_storage.delete(path)
            logger.info("Archivo eliminado (%s): %s", label, path)
    except Exception as exc:
        logger.error("Error eliminando archivo (%s) %s: %s", label, path, exc)

# ============================================================
# Roulette: creación de settings por defecto
# ============================================================

@receiver(post_save, sender=Roulette)
def create_roulette_settings(sender, instance: Roulette, created: bool, **kwargs):
    """
    Crea configuración por defecto cuando se crea una ruleta.
    Idempotente gracias a get_or_create.
    """
    if not created:
        return

    try:
        settings, created_settings = RouletteSettings.objects.get_or_create(
            roulette=instance,
            defaults={
                "max_participants": 0,
                "allow_multiple_entries": False,
                "show_countdown": True,
                "notify_on_participation": True,
                "notify_on_draw": True,
                "winners_target": 0,
                "require_receipt": True,
            },
        )

        logger.info(
            "RouletteSettings %s para ruleta %s (id=%s)",
            "creados" if created_settings else "ya existían",
            instance.name,
            instance.id,
        )
    except Exception as exc:
        logger.error(
            "Error creando RouletteSettings para ruleta %s (id=%s): %s",
            instance.name,
            instance.id,
            exc,
            exc_info=True
        )

# ============================================================
# Roulette: notificaciones asincrónicas
# ============================================================

@receiver(post_save, sender=Roulette)
def schedule_roulette_notifications(sender, instance: Roulette, created: bool, **kwargs):
    """
    Programa el envío de notificaciones de forma ASINCRÓNA usando Celery.
    Se ejecuta después de que la transacción se complete exitosamente.
    """
    if not created:
        return
    
    def send_notifications():
        try:
            from roulettes.tasks import send_roulette_creation_notifications
            
            # Programar tarea de Celery
            task = send_roulette_creation_notifications.delay(
                roulette_id=instance.id,
                created_by_id=instance.created_by.id if instance.created_by else None
            )
            
            logger.info(
                "Tarea de notificaciones programada para ruleta '%s' (id=%s, task_id=%s)",
                instance.name,
                instance.id,
                task.id
            )
            
        except ImportError:
            logger.error(
                "Celery no disponible - notificaciones NO enviadas para ruleta '%s' (id=%s)",
                instance.name,
                instance.id
            )
        except Exception as e:
            logger.error(
                "Error crítico programando notificaciones para ruleta '%s' (id=%s): %s",
                instance.name,
                instance.id,
                str(e),
                exc_info=True
            )
    
    # Ejecutar después de que el commit sea exitoso
    transaction.on_commit(send_notifications)

# ============================================================
# Roulette: validaciones y cambios de estado
# ============================================================

@receiver(pre_save, sender=Roulette)
def handle_roulette_status_changes(sender, instance: Roulette, **kwargs):
    """
    Maneja cambios de estado y checks rápidos antes de guardar.
    Minimiza la carga consultando solo los campos necesarios.
    """
    if not instance.pk:
        return

    try:
        old = Roulette.objects.only("status", "winner_id", "is_drawn", "name").get(pk=instance.pk)
    except Roulette.DoesNotExist:
        return
    except Exception as exc:
        logger.error("Error obteniendo ruleta anterior (id=%s): %s", instance.pk, exc)
        return

    # Logging de cambios de estado
    if old.status != instance.status:
        logger.info(
            "Estado de ruleta '%s' (id=%s) cambió: %s -> %s",
            getattr(instance, "name", instance.pk),
            instance.pk,
            old.status,
            instance.status,
        )

        # Validar que hay configuración al activar
        if instance.status == RouletteStatus.ACTIVE:
            settings = getattr(instance, "settings", None)
            if settings is None:
                logger.warning(
                    "Ruleta '%s' (id=%s) activada sin configuración - se creará automáticamente",
                    instance.name,
                    instance.pk
                )

        # Advertencia si se marca como completada sin sortear
        if instance.status == RouletteStatus.COMPLETED and not old.is_drawn:
            logger.warning(
                "Ruleta '%s' (id=%s) marcada como COMPLETED pero is_drawn=False",
                instance.name,
                instance.pk
            )

    # Logging de asignación de ganador
    if old.winner_id is None and instance.winner_id is not None:
        logger.info(
            "Ganador asignado a ruleta '%s' (id=%s, winner_id=%s)",
            instance.name,
            instance.pk,
            instance.winner_id
        )

# ============================================================
# RoulettePrize: validaciones y cambios
# ============================================================

@receiver(pre_save, sender=RoulettePrize)
def validate_prize_before_save(sender, instance: RoulettePrize, **kwargs):
    """
    Normaliza stock a rangos válidos.
    """
    if instance.stock is None or instance.stock < 0:
        logger.warning(
            "Stock negativo/no válido en premio '%s' (id=%s) -> normalizando a 0",
            instance.name,
            instance.pk or "nuevo"
        )
        instance.stock = 0


@receiver(post_save, sender=RoulettePrize)
def handle_prize_changes(sender, instance: RoulettePrize, created: bool, **kwargs):
    """
    Loguea cambios en premios.
    """
    logger.info(
        "Premio %s en ruleta '%s' (id=%s): %s",
        "creado" if created else "actualizado",
        instance.roulette.name,
        instance.id,
        instance.name,
    )
    
    # Advertencia si se crea premio sin stock
    if created and instance.stock == 0:
        logger.warning(
            "Premio '%s' (id=%s) creado con stock=0 - no estará disponible para sorteos",
            instance.name,
            instance.id
        )

# ============================================================
# Borrado de archivos y limpieza
# ============================================================

@receiver(pre_delete, sender=RoulettePrize)
def delete_prize_image(sender, instance: RoulettePrize, **kwargs):
    """
    Elimina imagen del premio antes de borrar el registro.
    """
    if instance.image:
        _safe_delete_storage_path(getattr(instance.image, "name", None), label="prize-image")
        logger.info(
            "Imagen del premio '%s' (id=%s) eliminada del almacenamiento",
            instance.name,
            instance.id
        )


@receiver(pre_delete, sender=Roulette)
def delete_roulette_assets_and_related(sender, instance: Roulette, **kwargs):
    """
    Elimina portada y hace limpieza antes de borrar la ruleta.
    """
    # Eliminar imagen de portada
    if instance.cover_image:
        _safe_delete_storage_path(getattr(instance.cover_image, "name", None), label="roulette-cover")
        logger.info(
            "Portada de ruleta '%s' (id=%s) eliminada del almacenamiento",
            instance.name,
            instance.id
        )

    # Limpiar historial de sorteos
    try:
        deleted, _ = getattr(instance, "draw_history", None) and instance.draw_history.all().delete() or (0, {})
        if deleted:
            logger.info(
                "Eliminados %s registros de historial para ruleta '%s' (id=%s)",
                deleted,
                instance.name,
                instance.id
            )
    except Exception as exc:
        logger.error(
            "Error limpiando historial de ruleta '%s' (id=%s): %s",
            instance.name,
            instance.id,
            exc,
            exc_info=True
        )

# ============================================================
# Señales personalizadas
# ============================================================

roulette_draw_completed = Signal()
roulette_participation_limit_reached = Signal()
roulette_scheduled_date_reached = Signal()


@receiver(roulette_draw_completed)
def handle_draw_completed(sender, roulette: Roulette, winner, draw_type: str, **kwargs):
    """
    Evento: sorteo completado.
    Se dispara cuando se completa un sorteo exitosamente.
    """
    try:
        winner_id = getattr(winner, "id", None)
        winner_name = getattr(getattr(winner, "user", None), "username", "desconocido")
        
        logger.info(
            "DRAW_COMPLETED: ruleta_id=%s ruleta='%s' winner_id=%s winner='%s' draw_type=%s",
            roulette.id,
            roulette.name,
            winner_id,
            winner_name,
            draw_type,
        )
    except Exception as exc:
        logger.error(
            "Error en handler de draw_completed para ruleta_id=%s: %s",
            roulette.id,
            exc,
            exc_info=True
        )


@receiver(roulette_participation_limit_reached)
def handle_participation_limit_reached(sender, roulette: Roulette, **kwargs):
    """
    Evento: límite de participantes alcanzado.
    """
    try:
        logger.info(
            "PARTICIPATION_LIMIT_REACHED: ruleta_id=%s ruleta='%s'",
            roulette.id,
            roulette.name,
        )
    except Exception as exc:
        logger.error(
            "Error en handler de participation_limit_reached: %s",
            exc,
            exc_info=True
        )


@receiver(roulette_scheduled_date_reached)
def handle_scheduled_date_reached(sender, roulette: Roulette, **kwargs):
    """
    Evento: fecha programada alcanzada.
    """
    try:
        logger.info(
            "SCHEDULED_DATE_REACHED: ruleta_id=%s ruleta='%s' scheduled_date=%s",
            roulette.id,
            roulette.name,
            roulette.scheduled_date,
        )
    except Exception as exc:
        logger.error(
            "Error en handler de scheduled_date_reached: %s",
            exc,
            exc_info=True
        )

# ============================================================
# Verificación inicial
# ============================================================

def ready():
    """
    Verifica integridad al iniciar.
    Llamado desde apps.py en el método ready().
    """
    try:
        missing = Roulette.objects.filter(settings__isnull=True).count()
        if missing > 0:
            logger.warning(
                "Encontradas %s ruletas sin RouletteSettings al iniciar - se crearán automáticamente al acceder",
                missing
            )
    except Exception as exc:
        # Es normal que falle si las tablas aún no existen (primera migración)
        logger.debug("Error en verificación inicial de ruletas (puede ser normal): %s", exc)