from __future__ import annotations

from datetime import timedelta, datetime
from typing import Any, Dict, Iterable, List, Optional, TypedDict, TypeAlias, Literal, Mapping, TYPE_CHECKING

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from django.template import Template, Context
from django.core.mail import send_mail
from django.conf import settings

from .models import (
    Notification, 
    RealTimeMessage, 
    AdminNotificationPreference,
    NotificationTemplate
)

import logging

# Importaciones de tipo solo para type checking
if TYPE_CHECKING:
    from django.contrib.auth.models import AbstractUser

User = get_user_model()
logger = logging.getLogger(__name__)

# Tipos exactos según models.NotificationType
NotificationType: TypeAlias = Literal[
    "participation_confirmed",
    "roulette_winner", 
    "roulette_started",
    "roulette_ending_soon",
    "winner_notification",
    "admin_winner_alert",
    "welcome_message",
]

class ExtraData(TypedDict, total=False):
    roulette_id: int
    roulette_name: str
    winner_name: str
    total_participants: int
    prize_details: str

class Stats(TypedDict):
    total_notifications: int
    unread_notifications: int
    recent_notifications: int
    notifications_by_type: Dict[str, int]

def _now() -> datetime:
    return timezone.now()

# -------------------------------------------------------------------
# Funciones de creación base
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
    priority: str = "normal",
    expires_at: Optional[datetime] = None,
    extra_data: Optional[Mapping[str, Any]] = None,
) -> Notification:
    """Crear notificación para usuario específico"""
    user = User.objects.get(pk=user_id)
    payload: Dict[str, Any] = dict(extra_data) if extra_data else {}
    
    notification = Notification.objects.create(
        user=user,
        title=title,
        message=message,
        notification_type=notification_type,
        is_public=is_public,
        priority=priority,
        roulette_id=roulette_id,
        participation_id=participation_id,
        expires_at=expires_at,
        extra_data=payload,
    )
    
    logger.info(f"Notificación creada para usuario {user.username}: {title}")
    return notification

@transaction.atomic
def create_public_notification(
    *,
    title: str,
    message: str,
    notification_type: NotificationType = "roulette_started",
    roulette_id: Optional[int] = None,
    participation_id: Optional[int] = None,
    priority: str = "normal",
    expires_at: Optional[datetime] = None,
    extra_data: Optional[Mapping[str, Any]] = None,
) -> Notification:
    """Crear notificación pública"""
    payload: Dict[str, Any] = dict(extra_data) if extra_data else {}
    
    notification = Notification.objects.create(
        user=None,
        title=title,
        message=message,
        notification_type=notification_type,
        is_public=True,
        priority=priority,
        roulette_id=roulette_id,
        participation_id=participation_id,
        expires_at=expires_at,
        extra_data=payload,
    )
    
    logger.info(f"Notificación pública creada: {title}")
    return notification

@transaction.atomic
def create_admin_notification(
    *,
    title: str,
    message: str,
    notification_type: NotificationType = "admin_winner_alert",
    roulette_id: Optional[int] = None,
    priority: str = "high",
    extra_data: Optional[Mapping[str, Any]] = None,
) -> List[Notification]:
    """Crear notificaciones para administradores"""
    payload: Dict[str, Any] = dict(extra_data) if extra_data else {}
    
    # Obtener todos los administradores activos
    admin_users = User.objects.filter(is_staff=True, is_active=True)
    notifications = []
    
    for admin in admin_users:
        # Verificar preferencias del admin si existen
        try:
            prefs = admin.admin_notification_preferences
            if notification_type == "admin_winner_alert" and not prefs.notify_on_winner:
                continue
            if notification_type == "participation_confirmed" and not prefs.notify_on_new_participation:
                continue
        except AdminNotificationPreference.DoesNotExist:
            # Si no tiene preferencias, usar valores por defecto
            pass
        
        notification = Notification.objects.create(
            user=admin,
            title=title,
            message=message,
            notification_type=notification_type,
            is_admin_only=True,
            priority=priority,
            roulette_id=roulette_id,
            extra_data=payload,
        )
        notifications.append(notification)
        
        # Enviar email si está habilitado
        try:
            if hasattr(admin, 'admin_notification_preferences') and admin.admin_notification_preferences.email_notifications:
                send_admin_email(admin, notification)
        except Exception as e:
            logger.error(f"Error enviando email a admin {admin.username}: {str(e)}")
    
    logger.info(f"Notificaciones de admin creadas para {len(notifications)} administradores")
    return notifications

def send_admin_email(admin_user: "AbstractUser", notification: Notification) -> None:
    """Enviar email de notificación a administrador"""
    try:
        subject = f"[Ruletas Admin] {notification.title}"
        message = f"""
        Hola {admin_user.get_full_name() or admin_user.username},
        
        {notification.message}
        
        Detalles adicionales:
        - Tipo: {notification.get_notification_type_display()}
        - Prioridad: {notification.get_priority_display()}
        - Fecha: {notification.created_at.strftime('%d/%m/%Y %H:%M')}
        
        Accede al panel de administración para más información.
        """
        
        send_mail(
            subject=subject,
            message=message,
            from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@ruletas.com'),
            recipient_list=[admin_user.email],
            fail_silently=True,
        )
    except Exception as e:
        logger.error(f"Error enviando email: {str(e)}")

# -------------------------------------------------------------------
# Funciones usando templates
# -------------------------------------------------------------------
def create_notification_from_template(
    template_name: str,
    context_data: Dict[str, Any],
    user_id: Optional[int] = None,
    is_public: bool = False,
    **kwargs
) -> Notification:
    """Crear notificación usando template"""
    try:
        template = NotificationTemplate.objects.get(name=template_name, is_active=True)
        
        # Procesar templates
        title_template = Template(template.title_template)
        message_template = Template(template.message_template)
        context = Context(context_data)
        
        title = title_template.render(context)
        message = message_template.render(context)
        
        if is_public:
            return create_public_notification(
                title=title,
                message=message,
                notification_type=template.notification_type,
                **kwargs
            )
        elif user_id:
            return create_user_notification(
                user_id=user_id,
                title=title,
                message=message,
                notification_type=template.notification_type,
                **kwargs
            )
        else:
            raise ValueError("Debe especificar user_id o is_public=True")
            
    except NotificationTemplate.DoesNotExist:
        logger.error(f"Template '{template_name}' no encontrado")
        raise

# -------------------------------------------------------------------
# Funciones de lectura
# -------------------------------------------------------------------
def get_user_notifications(
    *,
    user_id: int,
    unread_only: bool = False,
    roulette_id: Optional[int] = None,
    include_admin: bool = False,
    limit: Optional[int] = None,
) -> List[Notification]:
    """Obtener notificaciones del usuario"""
    from django.db.models import Q
    
    # Filtro base: notificaciones del usuario + públicas
    q_filter = Q(user_id=user_id) | Q(is_public=True)
    
    # Incluir notificaciones de admin si el usuario es staff
    if include_admin:
        user = User.objects.get(pk=user_id)
        if user.is_staff:
            q_filter |= Q(is_admin_only=True)
    
    qs = Notification.objects.filter(q_filter).order_by("-created_at")
    
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
    """Obtener notificaciones públicas"""
    qs = Notification.objects.filter(is_public=True).order_by("-created_at")
    if roulette_id is not None:
        qs = qs.filter(roulette_id=roulette_id)
    if limit is not None:
        qs = qs[:limit]
    return list(qs)

def get_admin_notifications(
    *,
    admin_user_id: int,
    unread_only: bool = False,
    limit: Optional[int] = None,
) -> List[Notification]:
    """Obtener notificaciones de administrador"""
    qs = Notification.objects.filter(
        user_id=admin_user_id, 
        is_admin_only=True
    ).order_by("-created_at")
    
    if unread_only:
        qs = qs.filter(is_read=False)
    if limit is not None:
        qs = qs[:limit]
        
    return list(qs)

# -------------------------------------------------------------------
# Acciones sobre notificaciones
# -------------------------------------------------------------------
@transaction.atomic
def mark_as_read(user_id: int, notification_ids: Iterable[int]) -> int:
    """Marcar notificaciones como leídas"""
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
    """Obtener estadísticas de notificaciones para usuario"""
    from django.db import models
    from django.db.models import Q

    user = User.objects.get(pk=user_id)
    
    # Filtro para notificaciones del usuario
    q_filter = Q(user_id=user_id) | Q(is_public=True)
    if user.is_staff:
        q_filter |= Q(is_admin_only=True)

    total = Notification.objects.filter(q_filter).count()
    unread = Notification.objects.filter(q_filter, is_read=False).count()
    recent = Notification.objects.filter(
        q_filter, created_at__gte=_now() - timedelta(hours=24)
    ).count()

    by_type_pairs = (
        Notification.objects
        .filter(q_filter)
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
    """Limpiar notificaciones antiguas"""
    cutoff = _now() - timedelta(days=days)
    qs = Notification.objects.filter(created_at__lt=cutoff, is_read=True)
    if not include_public:
        qs = qs.filter(is_public=False)
    deleted, _ = qs.delete()
    return int(deleted)

# -------------------------------------------------------------------
# Servicio principal (fachada)
# -------------------------------------------------------------------
class NotificationService:
    """Servicio principal de notificaciones"""
    
    @staticmethod
    def mark_notifications_as_read(*, user: "AbstractUser", notification_ids: Iterable[int]) -> int:
        """Marcar notificaciones como leídas"""
        return mark_as_read(user_id=user.id, notification_ids=notification_ids)

    @staticmethod
    def get_roulette_notifications(roulette_id: int) -> List[Notification]:
        """Obtener notificaciones de una ruleta"""
        return list(Notification.objects.filter(roulette_id=roulette_id).order_by("-created_at"))

    @staticmethod
    def create_participation_confirmation(
        *, user: "AbstractUser", roulette_name: str, roulette_id: int, participation_id: int
    ) -> Notification:
        """Crear notificación de participación confirmada"""
        return create_user_notification(
            user_id=user.id,
            title="¡Participación confirmada!",
            message=f"Te uniste exitosamente a la ruleta: {roulette_name}",
            notification_type="participation_confirmed",
            roulette_id=roulette_id,
            participation_id=participation_id,
            extra_data={"roulette_name": roulette_name},
        )

    @staticmethod
    def create_winner_announcement(
        *, winner_user: "AbstractUser", roulette_name: str, roulette_id: int, total_participants: int, prize_details: str = ""
    ) -> tuple[Notification, Notification, List[Notification]]:
        """Crear anuncio completo de ganador: público + personal + admin"""
        
        # 1. Notificación pública
        public_notification = create_public_notification(
            title="🎉 ¡Tenemos ganador!",
            message=f"{winner_user.username} ganó en {roulette_name} con {total_participants} participantes",
            notification_type="roulette_winner",
            roulette_id=roulette_id,
            priority="high",
            extra_data={
                "winner_name": winner_user.username,
                "roulette_name": roulette_name,
                "total_participants": total_participants,
                "prize_details": prize_details,
            },
        )
        
        # 2. Notificación personal al ganador
        personal_notification = create_user_notification(
            user_id=winner_user.id,
            title="🏆 ¡FELICITACIONES! Has ganado",
            message=f"¡Eres el ganador de '{roulette_name}'! {prize_details if prize_details else 'Revisa los detalles del premio.'}",
            notification_type="winner_notification",
            roulette_id=roulette_id,
            priority="urgent",
            extra_data={
                "roulette_name": roulette_name,
                "total_participants": total_participants,
                "prize_details": prize_details,
            },
        )
        
        # 3. Notificaciones para administradores
        admin_notifications = create_admin_notification(
            title=f"🎯 Nuevo ganador: {winner_user.username}",
            message=f"La ruleta '{roulette_name}' tiene ganador. Participantes: {total_participants}. Verifica el proceso de entrega del premio.",
            notification_type="admin_winner_alert",
            roulette_id=roulette_id,
            priority="high",
            extra_data={
                "winner_name": winner_user.username,
                "winner_email": winner_user.email,
                "roulette_name": roulette_name,
                "total_participants": total_participants,
                "prize_details": prize_details,
            },
        )
        
        logger.info(f"Notificaciones completas de ganador creadas para {winner_user.username} en ruleta {roulette_id}")
        return public_notification, personal_notification, admin_notifications

    @staticmethod
    def create_roulette_started_announcement(
        *, roulette_name: str, roulette_id: int, creator_username: str, end_date: datetime = None
    ) -> Notification:
        """Crear anuncio de inicio de ruleta"""
        end_info = f" (Termina: {end_date.strftime('%d/%m/%Y %H:%M')})" if end_date else ""
        
        return create_public_notification(
            title="🎯 Nueva ruleta disponible",
            message=f"'{roulette_name}' está abierta para participar. Creada por {creator_username}{end_info}",
            notification_type="roulette_started",
            roulette_id=roulette_id,
            priority="normal",
            extra_data={
                "roulette_name": roulette_name,
                "creator_username": creator_username,
                "end_date": end_date.isoformat() if end_date else None,
            },
        )

    @staticmethod
    def create_roulette_ending_alert(
        *, roulette_name: str, roulette_id: int, hours_remaining: int
    ) -> Notification:
        """Crear alerta de ruleta próxima a terminar"""
        return create_public_notification(
            title="⏰ Ruleta terminando pronto",
            message=f"La ruleta '{roulette_name}' terminará en {hours_remaining} horas. ¡Última oportunidad para participar!",
            notification_type="roulette_ending_soon",
            roulette_id=roulette_id,
            priority="high",
            extra_data={
                "roulette_name": roulette_name,
                "hours_remaining": hours_remaining,
            },
        )

class RealTimeService:
    """Servicio de mensajes en tiempo real"""
    
    @staticmethod
    def cleanup_old_messages(*, days: int = 7) -> int:
        """Limpiar mensajes antiguos"""
        cutoff = _now() - timedelta(days=days)
        deleted, _ = RealTimeMessage.objects.filter(sent_at__lt=cutoff).delete()
        return int(deleted)
    
    @staticmethod
    def create_realtime_message(
        *, 
        channel_name: str,
        message_type: str,
        content: Dict[str, Any],
        roulette_id: Optional[int] = None
    ) -> RealTimeMessage:
        """Crear mensaje en tiempo real"""
        return RealTimeMessage.objects.create(
            channel_name=channel_name,
            message_type=message_type,
            content=content,
            roulette_id=roulette_id,
        )