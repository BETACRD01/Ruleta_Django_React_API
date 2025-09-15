# participants/signals.py

from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.db import transaction
from .models import Participation
import importlib

# -------- Optional/defensive imports (no rompen si faltan) --------
try:
    from notifications.services import NotificationService
    from notifications.models import Notification, RealTimeMessage
except Exception:  # apps no disponibles o import cycle
    NotificationService = None
    Notification = None
    RealTimeMessage = None


def _get_channels():
    """
    Carga perezosa de Channels para evitar reportMissingImports de Pylance.
    Devuelve (get_channel_layer, async_to_sync) o (None, None) si no está instalado.
    """
    try:
        layers_mod = importlib.import_module("channels.layers")
        asgiref_mod = importlib.import_module("asgiref.sync")
        return layers_mod.get_channel_layer, asgiref_mod.async_to_sync
    except Exception:
        return None, None


def _ws_send(group_name: str, event_type: str, payload: dict) -> None:
    """Envío por WebSocket si Channels está disponible."""
    get_channel_layer, async_to_sync = _get_channels()
    if not (get_channel_layer and async_to_sync):
        return
    layer = get_channel_layer()
    if not layer:
        return
    async_to_sync(layer.group_send)(group_name, {"type": event_type, **payload})


def _notify_participation_confirmed(instance: Participation) -> None:
    """Crea notificación 'participation_confirmed' evitando duplicados."""
    if not NotificationService:
        return
    try:
        # Evitar duplicado si ya se creó en la vista
        if Notification and Notification.objects.filter(
            user=instance.user,
            participation_id=instance.id,
            notification_type="participation_confirmed",
        ).exists():
            return

        roulette_name = getattr(instance.roulette, "name", f"Roulette #{instance.roulette_id}")
        NotificationService.create_participation_confirmation(
            user=instance.user,
            roulette_name=roulette_name,
            roulette_id=instance.roulette_id,
            participation_id=instance.id,
        )
    except Exception:
        # No rompemos el flujo por fallos de notificación
        pass


@receiver(post_save, sender=Participation, dispatch_uid="participants.participation_created")
def participation_created(sender, instance: Participation, created: bool, **kwargs):
    """Señal al crear una nueva participación."""
    if not created:
        return

    def _after_commit():
        # 1) Notificación (si servicios disponibles)
        _notify_participation_confirmed(instance)

        # 2) Registro de mensaje en tiempo real (si modelo existe)
        try:
            if RealTimeMessage:
                RealTimeMessage.objects.create(
                    channel_name=f"roulette_{instance.roulette_id}",
                    message_type="new_participant",
                    content={
                        "participant_id": instance.id,
                        "participant_name": (instance.user.get_full_name() or instance.user.username),
                        "participant_number": instance.participant_number,
                        "total_participants": instance.roulette.participations.count(),
                    },
                    roulette_id=instance.roulette_id,
                )
        except Exception:
            pass

        # 3) Push por WebSocket (si Channels está instalado)
        _ws_send(
            f"roulette_{instance.roulette_id}",
            "new_participant",  # tu consumer debe implementar def new_participant(self, event):
            {
                "participant_id": instance.id,
                "participant_name": (instance.user.get_full_name() or instance.user.username),
                "participant_number": instance.participant_number,
                "total_participants": instance.roulette.participations.count(),
            },
        )

    transaction.on_commit(_after_commit)


@receiver(post_delete, sender=Participation, dispatch_uid="participants.participation_deleted")
def participation_deleted(sender, instance: Participation, **kwargs):
    """Señal al eliminar una participación."""
    def _after_commit():
        rid = getattr(instance, "roulette_id", None)

        # 1) Registro de mensaje en tiempo real (si modelo existe)
        try:
            if RealTimeMessage:
                RealTimeMessage.objects.create(
                    channel_name=f"roulette_{rid}",
                    message_type="participant_deleted",
                    content={
                        "participant_id": instance.id,
                        "participant_number": instance.participant_number,
                    },
                    roulette_id=rid,
                )
        except Exception:
            pass

        # 2) Push por WebSocket
        _ws_send(
            f"roulette_{rid}",
            "participant_deleted",  # tu consumer debe implementar def participant_deleted(self, event):
            {
                "participant_id": instance.id,
                "participant_number": instance.participant_number,
            },
        )

    transaction.on_commit(_after_commit)
