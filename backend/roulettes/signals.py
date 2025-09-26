from __future__ import annotations

import logging
from typing import Optional

from django.core.files.storage import default_storage
from django.db.models.signals import post_save, pre_save, pre_delete
from django.dispatch import receiver, Signal

from .models import Roulette, RouletteSettings, RoulettePrize, RouletteStatus

logger = logging.getLogger(__name__)

# ============================================================
# Helpers
# ============================================================

def _safe_delete_storage_path(path: Optional[str], *, label: str) -> None:
    """
    Elimina un archivo del almacenamiento si existe.
    No levanta excepción: loggea y continúa.
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
# Roulette: creación de settings por defecto (SIN auto_draw_when_full)
# ============================================================

@receiver(post_save, sender=Roulette)
def create_roulette_settings(sender, instance: Roulette, created: bool, **kwargs):
    """
    Crea configuración por defecto cuando se crea una ruleta.
    Idempotente gracias a get_or_create.
    """
    if not created:
        return

    settings, created_settings = RouletteSettings.objects.get_or_create(
        roulette=instance,
        defaults={
            "max_participants": 0,
            "allow_multiple_entries": False,
            "show_countdown": True,
            "notify_on_participation": True,
            "notify_on_draw": True,
            "winners_target": 0,  # 0 = automático (por stock de premios)
        },
    )

    logger.info(
        "RouletteSettings %s para ruleta %s (id=%s)",
        "creados" if created_settings else "ya existían",
        instance.name,
        instance.id,
    )

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

    # Cambio de estado
    if old.status != instance.status:
        logger.info(
            "Estado de ruleta '%s' cambió: %s -> %s",
            getattr(instance, "name", instance.pk),
            old.status,
            instance.status,
        )

        if instance.status == RouletteStatus.ACTIVE:
            settings = getattr(instance, "settings", None)
            if settings is None:
                logger.warning("Ruleta '%s' activada sin configuración", instance.name)

        if instance.status == RouletteStatus.COMPLETED and not old.is_drawn:
            logger.info("Ruleta '%s' marcada como COMPLETED (is_drawn aún falso)", instance.name)

    # Ganador asignado
    if old.winner_id is None and instance.winner_id is not None:
        logger.info("Ganador asignado a ruleta '%s' (winner_id=%s)", instance.name, instance.winner_id)

# ============================================================
# RoulettePrize: validaciones y cambios (sin probabilidad)
# ============================================================

@receiver(pre_save, sender=RoulettePrize)
def validate_prize_before_save(sender, instance: RoulettePrize, **kwargs):
    """
    Normaliza stock a rangos válidos.
    (La lógica de probabilidad fue eliminada.)
    """
    if instance.stock is None or instance.stock < 0:
        logger.warning("Stock negativo/no válido en premio '%s' -> normalizando a 0", instance.name)
        instance.stock = 0


@receiver(post_save, sender=RoulettePrize)
def handle_prize_changes(sender, instance: RoulettePrize, created: bool, **kwargs):
    """
    Loggea cambios en premios.
    (Se eliminó el check de suma de probabilidades.)
    """
    logger.info(
        "Premio %s en ruleta '%s': %s (id=%s)",
        "creado" if created else "actualizado",
        instance.roulette.name,
        instance.name,
        instance.id,
    )

# ============================================================
# Borrado de archivos y limpieza
# ============================================================

@receiver(pre_delete, sender=RoulettePrize)
def delete_prize_image(sender, instance: RoulettePrize, **kwargs):
    """
    Elimina imagen del premio antes de borrar el registro (tiene aún la ruta).
    """
    if instance.image:
        _safe_delete_storage_path(getattr(instance.image, "name", None), label="prize-image")


@receiver(pre_delete, sender=Roulette)
def delete_roulette_assets_and_related(sender, instance: Roulette, **kwargs):
    """
    Elimina portada y hace cualquier limpieza necesaria antes de borrar la ruleta.
    - Archivos: portada
    - Historial: si NO está en cascade, bórralo aquí; si ya está en CASCADE, esto no hace daño.
    """
    if instance.cover_image:
        _safe_delete_storage_path(getattr(instance.cover_image, "name", None), label="roulette-cover")

    try:
        deleted, _ = getattr(instance, "draw_history", None) and instance.draw_history.all().delete() or (0, {})
        if deleted:
            logger.info("Eliminados %s registros de historial para ruleta '%s'", deleted, instance.name)
    except Exception as exc:
        logger.error("Error limpiando historial de ruleta '%s': %s", instance.name, exc)

# ============================================================
# Señales personalizadas (evento de negocio)
# ============================================================

roulette_draw_completed = Signal()
roulette_participation_limit_reached = Signal()
roulette_scheduled_date_reached = Signal()


@receiver(roulette_draw_completed)
def handle_draw_completed(sender, roulette: Roulette, winner, draw_type: str, **kwargs):
    """
    Evento: sorteo completado. Ideal para integrar email/push/webhooks.
    """
    logger.info(
        "DRAW_COMPLETED roulette_id=%s winner_id=%s draw_type=%s participants=%s",
        roulette.id,
        getattr(winner, "id", None),
        draw_type,
        getattr(roulette, "participants_count", None) or getattr(roulette, "get_participants_count", lambda: "n/a")(),
    )
    # Aquí podrías: enviar email/push, disparar webhooks, actualizar métricas, etc.

# ============================================================
# Nota para apps.py
# ============================================================

def ready():
    """
    Puedes llamar a este helper desde apps.py si lo prefieres:
        class RoulettesConfig(AppConfig):
            name = "roulettes"
            def ready(self):
                import roulettes.signals  # noqa: F401
    """
    try:
        missing = Roulette.objects.filter(settings__isnull=True).count()
        if missing > 0:
            logger.warning("Hay %s ruletas sin RouletteSettings", missing)
    except Exception as exc:
        logger.error("Error en verificación inicial de ruletas: %s", exc)
