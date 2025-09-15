# backend/notifications/services.py
from __future__ import annotations

from datetime import timedelta, datetime
from typing import Any, Dict, Iterable, List, Optional, TypedDict, TypeAlias, Literal, Mapping

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone

from .models import Notification, RealTimeMessage  # modelos existentes en tu app

User = get_user_model()

# -------------------------------------------------------------------
# Tipos EXACTOS según models.NotificationType
# -------------------------------------------------------------------
NotificationType: TypeAlias = Literal[
    "participation_confirmed",
    "roulette_winner",
    "roulette_started",
    "roulette_ending_soon",
]

class ExtraData(TypedDict, total=False):
    roulette_id: int
    roulette_name: str
    winner_name: str

class Stats(TypedDict):
    total_notifications: int
    unread_notifications: int
    recent_notifications: int
    notifications_by_type: Dict[str, int]

def _now() -> datetime:
    return timezone.now()

# -------------------------------------------------------------------
# Creación
# -------------------------------------------------------------------
@transaction.atomic
def create_user_notification(
    *,
    user_id: int,
    title: str,
    message: str,
    notification_type: NotificationType = "participation_confirmed",
    roulette_id: Optional[int] = None,
    participation_id: Optional[int] = None,
    is_public: bool = False,
    extra_data: Optional[Mapping[str, Any]] = None,
) -> Notification:
    user = User.objects.get(pk=user_id)
    payload: Dict[str, Any] = dict(extra_data) if extra_data else {}
    return Notification.objects.create(
        user=user,
        title=title,
        message=message,
        notification_type=notification_type,
        is_public=is_public,
        roulette_id=roulette_id,
        participation_id=participation_id,
        extra_data=payload,
    )

@transaction.atomic
def create_public_notification(
    *,
    title: str,
    message: str,
    notification_type: NotificationType = "roulette_started",
    roulette_id: Optional[int] = None,
    participation_id: Optional[int] = None,
    extra_data: Optional[Mapping[str, Any]] = None,
) -> Notification:
    payload: Dict[str, Any] = dict(extra_data) if extra_data else {}
    return Notification.objects.create(
        user=None,
        title=title,
        message=message,
        notification_type=notification_type,
        is_public=True,
        roulette_id=roulette_id,
        participation_id=participation_id,
        extra_data=payload,
    )

# -------------------------------------------------------------------
# Lectura / acciones
# -------------------------------------------------------------------
def get_user_notifications(
    *,
    user_id: int,
    unread_only: bool = False,
    roulette_id: Optional[int] = None,
    limit: Optional[int] = None,
) -> List[Notification]:
    qs = Notification.objects.filter(is_public=False, user_id=user_id).order_by("-created_at")
    if unread_only:
        qs = qs.filter(is_read=False)
    if roulette_id is not None:
        qs = qs.filter(roulette_id=roulette_id)
    if limit is not None:
        qs = qs[:limit]
    return list(qs)

def get_public_notifications(
    *,
    roulette_id: Optional[int] = None,
    limit: Optional[int] = None,
) -> List[Notification]:
    qs = Notification.objects.filter(is_public=True).order_by("-created_at")
    if roulette_id is not None:
        qs = qs.filter(roulette_id=roulette_id)
    if limit is not None:
        qs = qs[:limit]
    return list(qs)

@transaction.atomic
def mark_as_read(user_id: int, notification_ids: Iterable[int]) -> int:
    """
    Marca como leídas (tu modelo no tiene 'read_at', así que no lo usamos).
    """
    ids_list: List[int] = list(notification_ids)
    if not ids_list:
        return 0
    updated = (
        Notification.objects
        .filter(user_id=user_id, id__in=ids_list, is_read=False)
        .update(is_read=True)
    )
    return int(updated)

def get_notification_stats(*, user_id: int) -> Stats:
    from django.db import models

    total = Notification.objects.filter(user_id=user_id, is_public=False).count()
    unread = Notification.objects.filter(user_id=user_id, is_public=False, is_read=False).count()
    recent = Notification.objects.filter(
        user_id=user_id, is_public=False, created_at__gte=_now() - timedelta(minutes=60)
    ).count()

    by_type_pairs = (
        Notification.objects
        .filter(user_id=user_id, is_public=False)
        .values("notification_type")
        .annotate(total=models.Count("id"))
        .values_list("notification_type", "total")
    )
    by_type: Dict[str, int] = {k: int(v) for k, v in by_type_pairs}

    return {
        "total_notifications": int(total),
        "unread_notifications": int(unread),
        "recent_notifications": int(recent),
        "notifications_by_type": by_type,
    }

def cleanup_notifications(*, days: int = 30, include_public: bool = True) -> int:
    """
    Borra notificaciones antiguas. Usa kwarg correcto: created_at__lt=cutoff
    """
    cutoff = _now() - timedelta(days=days)
    qs = Notification.objects.filter(created_at__lt=cutoff)
    if not include_public:
        qs = qs.filter(is_public=False)
    deleted, _ = qs.delete()
    return int(deleted)

# -------------------------------------------------------------------
# Fachadas usadas por las views (compatibles con tus imports)
# -------------------------------------------------------------------
class NotificationService:
    @staticmethod
    def mark_notifications_as_read(*, user, notification_ids: Iterable[int]) -> int:
        return mark_as_read(user_id=user.id, notification_ids=notification_ids)

    @staticmethod
    def get_roulette_notifications(roulette_id: int) -> List[Notification]:
        return list(Notification.objects.filter(roulette_id=roulette_id).order_by("-created_at"))

    @staticmethod
    def create_participation_confirmation(
        *, user, roulette_name: str, roulette_id: int, participation_id: int
    ) -> Notification:
        return create_user_notification(
            user_id=user.id,
            title="¡Participación confirmada!",
            message=f"Te uniste a la ruleta: {roulette_name}",
            notification_type="participation_confirmed",
            roulette_id=roulette_id,
            participation_id=participation_id,
            is_public=False,
            extra_data={"roulette_name": roulette_name},
        )

    @staticmethod
    def create_winner_announcement(
        *, winner_user, roulette_name: str, roulette_id: int, total_participants: int
    ) -> Notification:
        return create_public_notification(
            title="🎉 ¡Tenemos ganador!",
            message=f"{winner_user.username} ganó en {roulette_name} (Participantes: {total_participants})",
            notification_type="roulette_winner",
            roulette_id=roulette_id,
            extra_data={
                "winner_name": winner_user.username,
                "roulette_name": roulette_name,
                "total_participants": total_participants,
            },
        )

class RealTimeService:
    @staticmethod
    def cleanup_old_messages(*, days: int = 7) -> int:
        cutoff = _now() - timedelta(days=days)
        deleted, _ = RealTimeMessage.objects.filter(sent_at__lt=cutoff).delete()
        return int(deleted)
