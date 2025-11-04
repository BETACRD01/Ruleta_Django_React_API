from __future__ import annotations

from datetime import timedelta, datetime
from typing import Any, Dict, Iterable, List, Optional, TypedDict, TypeAlias, Literal, Mapping, TYPE_CHECKING, Tuple

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from django.template import Template, Context
from django.conf import settings
from django.core.signing import Signer, BadSignature

from django.utils.html import escape
from django.core.validators import validate_email
from django.core.exceptions import ValidationError as DjangoValidationError

from .models import (
    Notification, 
    RealTimeMessage, 
    AdminNotificationPreference,
    NotificationTemplate
)

import logging


if TYPE_CHECKING:
    from django.contrib.auth.models import AbstractUser

User = get_user_model()
logger = logging.getLogger(__name__)

# ============================================================================
# TYPE DEFINITIONS
# ============================================================================

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

class AdminEmailResult(TypedDict):
    notification_id: int
    emails_sent: int
    emails_failed: int
    admin_ids_notified: List[int]

# ============================================================================
# UTILITIES
# ============================================================================

def _now() -> datetime:
    """Wrapper para timezone.now() - facilita testing"""
    return timezone.now()

def _get_signer() -> Signer:
    """Retorna signer seguro para tokens de unsubscribe"""
    salt = getattr(settings, 'NOTIFICATION_UNSUBSCRIBE_SALT', 'notifications-unsubscribe')
    return Signer(salt=salt)

def create_unsubscribe_token(user_id: int) -> str:
    """Crea token seguro para unsubscribe"""
    signer = _get_signer()
    return signer.sign(str(user_id))

def verify_unsubscribe_token(token: str) -> Optional[int]:
    """Verifica token de unsubscribe y retorna user_id"""
    signer = _get_signer()
    try:
        user_id_str = signer.unsign(token)
        return int(user_id_str)
    except (BadSignature, ValueError):
        logger.warning(f"Invalid unsubscribe token attempted: {token[:20]}...")
        return None

# ============================================================================
# CORE NOTIFICATION CREATION
# ============================================================================

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
    """
    Crear notificación para usuario específico con validación.
    """
    # Validar datos
    validate_notification_data(title, message, priority)
    
    # Validar IDs si se proporcionan
    if roulette_id is not None and roulette_id < 1:
        raise ValueError(f"Invalid roulette_id: {roulette_id}")
    
    if participation_id is not None and participation_id < 1:
        raise ValueError(f"Invalid participation_id: {participation_id}")
    
    user = User.objects.get(pk=user_id)
    payload: Dict[str, Any] = dict(extra_data) if extra_data else {}
    
    # Limitar tamaño de extra_data
    import json
    if len(json.dumps(payload)) > 10000:
        raise ValueError("extra_data too large (max 10KB)")
    
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
    
    logger.info(
        f"User notification created: ID={notification.id}, "
        f"user={user.username}, type={notification_type}"
    )
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
    """
    Crear notificación pública con validación.
    """
    # Validar datos
    validate_notification_data(title, message, priority)
    
    if roulette_id is not None and roulette_id < 1:
        raise ValueError(f"Invalid roulette_id: {roulette_id}")
    
    payload: Dict[str, Any] = dict(extra_data) if extra_data else {}
    
    # Limitar tamaño de extra_data
    import json
    if len(json.dumps(payload)) > 10000:
        raise ValueError("extra_data too large (max 10KB)")
    
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
    
    logger.info(
        f"Public notification created: ID={notification.id}, "
        f"type={notification_type}, title='{title[:50]}'"
    )
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
    send_emails: bool = True,
) -> AdminEmailResult:
    """
    Crea notificación global para TODOS los admins + envía emails opcionales.
    
    ARQUITECTURA:
    - Crea UNA notificación en BD sin user_id (is_admin_only=True)
    - Admins la ven en queries con Q(is_admin_only=True)
    - Opcionalmente envía emails individuales según preferencias
    
    Args:
        title: Título de la notificación
        message: Contenido del mensaje
        notification_type: Tipo de notificación admin
        roulette_id: ID de ruleta relacionada
        priority: Prioridad (default: high)
        extra_data: Datos adicionales
        send_emails: Si enviar emails individuales a admins
        
    Returns:
        AdminEmailResult con estadísticas de envío
    """
    payload: Dict[str, Any] = dict(extra_data) if extra_data else {}
    
    # Crear UNA notificación global
    notification = Notification.objects.create(
        user=None,  # Global - sin user específico
        title=title,
        message=message,
        notification_type=notification_type,
        is_admin_only=True,  # Flag para filtros admin
        is_public=False,
        priority=priority,
        roulette_id=roulette_id,
        extra_data=payload,
    )
    
    logger.info(
        f"Admin notification created: ID={notification.id}, "
        f"type={notification_type}, will_send_emails={send_emails}"
    )
    
    # Resultado inicial
    result: AdminEmailResult = {
        "notification_id": notification.id,
        "emails_sent": 0,
        "emails_failed": 0,
        "admin_ids_notified": [],
    }
    
    # Enviar emails si está habilitado
    if send_emails:
        email_result = _send_admin_emails(notification, notification_type)
        result["emails_sent"] = email_result["sent"]
        result["emails_failed"] = email_result["failed"]
        result["admin_ids_notified"] = email_result["admin_ids"]
    
    return result


def _send_admin_emails(
    notification: Notification, 
    notification_type: str
) -> Dict[str, Any]:
    """
    Envía emails a admins con validación de emails y rate limiting.
    """
    from .notification_manager import notification_manager
    from .channels.base import Priority as EmailPriority
    
    admin_users = User.objects.filter(
        is_staff=True, 
        is_active=True,
        email__isnull=False
    ).exclude(email='')[:100]  # Límite de seguridad
    
    stats = {"sent": 0, "failed": 0, "admin_ids": []}
    
    for admin in admin_users:
        try:
            # Validar email antes de enviar
            try:
                validate_email(admin.email)
            except DjangoValidationError:
                logger.warning(f"Invalid email for admin {admin.username}: {admin.email}")
                stats["failed"] += 1
                continue
            
            should_send = _should_send_admin_email(admin, notification_type)
            
            if not should_send:
                logger.debug(f"Skipping email for admin {admin.username} (preferences)")
                continue
            
            # Preparar contexto con sanitización
            frontend_base = getattr(settings, "FRONTEND_BASE_URL", "http://localhost:3000")
            brand_name = getattr(settings, "BRAND_NAME", "HAYU24")
            
            # Sanitizar datos de notificación
            context = {
                "admin_name": escape(admin.get_full_name() or admin.username),
                "admin_email": admin.email,
                "notification_title": escape(notification.title[:200]),  # Limitar longitud
                "notification_message": escape(notification.message[:1000]),
                "notification_type_display": notification.get_notification_type_display(),
                "priority_display": notification.get_priority_display(),
                "created_at": notification.created_at.strftime('%d/%m/%Y %H:%M'),
                "extra_data": notification.extra_data,
                "admin_dashboard_url": f"{frontend_base}/admin",
                "notification_url": f"{frontend_base}/admin/notifications/{notification.id}",
                "brand_name": escape(brand_name),
                "site_url": frontend_base,
            }
            
            subject = f"[{brand_name}] {notification.title[:100]}"  # Limitar asunto
            
            success = notification_manager.send(
                channel_name="email",
                recipients=[admin.email],
                subject=subject,
                template="admin_notification",
                context=context,
                priority=EmailPriority.HIGH,
                fallback_channels=[]
            )
            
            if success:
                stats["sent"] += 1
                stats["admin_ids"].append(admin.id)
                logger.info(f"Admin email sent to {admin.email}")
            else:
                stats["failed"] += 1
                logger.warning(f"Failed to send admin email to {admin.email}")
                
        except Exception as e:
            stats["failed"] += 1
            logger.error(
                f"Error sending admin email to {admin.username}: {str(e)[:200]}",
                exc_info=False  # No exponer stack trace completo
            )
    
    logger.info(
        f"Admin email batch complete: {stats['sent']} sent, "
        f"{stats['failed']} failed"
    )
    return stats



def _should_send_admin_email(admin: "AbstractUser", notification_type: str) -> bool:
    """
    Determina si enviar email a admin según preferencias.
    
    Returns:
        bool: True si debe enviarse el email
    """
    try:
        prefs = admin.admin_notification_preferences
        
        # Si tiene email_notifications deshabilitado, no enviar
        if not prefs.email_notifications:
            return False
        
        # Verificar preferencias específicas por tipo
        type_checks = {
            "admin_winner_alert": prefs.notify_on_winner,
            "participation_confirmed": prefs.notify_on_new_participation,
            "roulette_started": prefs.notify_on_roulette_created,
        }
        
        return type_checks.get(notification_type, True)
        
    except AdminNotificationPreference.DoesNotExist:
        # Sin preferencias: solo enviar para alertas críticas
        return notification_type == "admin_winner_alert"


# ============================================================================
# TEMPLATE-BASED NOTIFICATIONS
# ============================================================================

def create_notification_from_template(
    template_name: str,
    context_data: Dict[str, Any],
    user_id: Optional[int] = None,
    is_public: bool = False,
    **kwargs
) -> Notification:
    """
    Crear notificación usando template de BD con protección XSS.
    """
    try:
        template = NotificationTemplate.objects.get(
            name=template_name, 
            is_active=True
        )
    except NotificationTemplate.DoesNotExist:
        logger.error(f"Template '{template_name}' not found or inactive")
        raise
    
    # Sanitizar context_data para prevenir XSS
    sanitized_context = {
        key: escape(str(value)) if isinstance(value, str) else value
        for key, value in context_data.items()
    }
    
    # Renderizar con autoescape activado
    title_template = Template(template.title_template)
    message_template = Template(template.message_template)
    context = Context(sanitized_context, autoescape=True)
    
    title = title_template.render(context)
    message = message_template.render(context)
    
    # Crear según tipo
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
        raise ValueError("Must specify either user_id or is_public=True")


# ============================================================================
# QUERY FUNCTIONS
# ============================================================================

def get_user_notifications(
    *,
    user_id: int,
    unread_only: bool = False,
    roulette_id: Optional[int] = None,
    include_admin: bool = False,
    limit: Optional[int] = None,
) -> List[Notification]:
    """
    Obtener notificaciones del usuario con filtros optimizados.
    
    NOTA: Para admins, include_admin=True incluye notificaciones admin-only GLOBALES.
    
    Args:
        user_id: ID del usuario
        unread_only: Filtrar solo no leídas
        roulette_id: Filtrar por ruleta específica
        include_admin: Si incluir notificaciones admin (solo para staff)
        limit: Límite de resultados
        
    Returns:
        List[Notification]: Notificaciones ordenadas por fecha descendente
    """
    from django.db.models import Q
    
    user = User.objects.get(pk=user_id)
    
    # Filtro base: notificaciones propias + públicas
    q_filter = Q(user_id=user_id) | Q(is_public=True)
    
    # Admins ven notificaciones admin-only GLOBALES
    if include_admin and user.is_staff:
        q_filter |= Q(is_admin_only=True, user__isnull=True)
    
    # Query optimizado con select_related
    qs = (
        Notification.objects
        .filter(q_filter)
        .select_related('user')
        .order_by("-created_at")
    )
    
    # Filtros adicionales
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
    notification_type: Optional[str] = None,
    limit: Optional[int] = None,
) -> List[Notification]:
    """
    Obtener notificaciones públicas con filtros opcionales.
    
    Args:
        roulette_id: Filtrar por ruleta específica
        notification_type: Filtrar por tipo de notificación
        limit: Límite de resultados
        
    Returns:
        List[Notification]: Notificaciones públicas ordenadas
    """
    qs = Notification.objects.filter(is_public=True)
    
    if roulette_id is not None:
        qs = qs.filter(roulette_id=roulette_id)
    
    if notification_type:
        qs = qs.filter(notification_type=notification_type)
    
    qs = qs.order_by("-created_at")
    
    if limit is not None:
        qs = qs[:limit]
    
    return list(qs)


def get_admin_notifications(
    *,
    unread_only: bool = False,
    limit: Optional[int] = None,
) -> List[Notification]:
    """
    Obtener TODAS las notificaciones admin-only globales.
    
    CAMBIO: Ya no filtra por admin_user_id, retorna todas las admin-only.
    
    Args:
        unread_only: Filtrar solo no leídas
        limit: Límite de resultados
        
    Returns:
        List[Notification]: Notificaciones admin globales
    """
    qs = Notification.objects.filter(
        is_admin_only=True,
        user__isnull=True  # Solo globales, no personales
    ).order_by("-created_at")
    
    if unread_only:
        qs = qs.filter(is_read=False)
    
    if limit is not None:
        qs = qs[:limit]
    
    return list(qs)


# ============================================================================
# NOTIFICATION ACTIONS
# ============================================================================
@transaction.atomic
def mark_as_read(user_id: int, notification_ids: Iterable[int]) -> int:
    ids_list: List[int] = list(notification_ids)
    if not ids_list:
        return 0
    
    # ✅ CORRECTO: Lock y luego actualización manual
    notifications = list(
        Notification.objects
        .select_for_update()
        .filter(user_id=user_id, id__in=ids_list, is_read=False)
    )
    
    count = 0
    now = _now()
    for notification in notifications:
        notification.is_read = True
        notification.updated_at = now
        count += 1
    
    if count > 0:
        Notification.objects.bulk_update(
            notifications, 
            ['is_read', 'updated_at'],
            batch_size=100
        )
        logger.info(f"Marked {count} notifications as read for user_id={user_id}")
    
    return count

@transaction.atomic
def bulk_delete_read_notifications(user_id: int, older_than_days: int = 30) -> int:
    """
    Eliminar notificaciones leídas antiguas del usuario.
    
    Args:
        user_id: ID del usuario
        older_than_days: Eliminar notificaciones más antiguas que X días
        
    Returns:
        int: Cantidad de notificaciones eliminadas
    """
    cutoff = _now() - timedelta(days=older_than_days)
    
    deleted, _ = Notification.objects.filter(
        user_id=user_id,
        is_read=True,
        created_at__lt=cutoff
    ).delete()
    
    if deleted > 0:
        logger.info(
            f"Deleted {deleted} read notifications for user_id={user_id} "
            f"older than {older_than_days} days"
        )
    
    return deleted


# ============================================================================
# SERVICE FACADE
# ============================================================================

class NotificationService:
    """
    Fachada principal del servicio de notificaciones.
    Proporciona interfaz limpia para operaciones comunes.
    """
    
    @staticmethod
    def mark_notifications_as_read(
        *, 
        user: "AbstractUser", 
        notification_ids: Iterable[int]
    ) -> int:
        """Marcar notificaciones como leídas"""
        return mark_as_read(user_id=user.id, notification_ids=notification_ids)
    
    @staticmethod
    def get_roulette_notifications(roulette_id: int) -> List[Notification]:
        """Obtener todas las notificaciones de una ruleta"""
        return list(
            Notification.objects
            .filter(roulette_id=roulette_id)
            .select_related('user')
            .order_by("-created_at")
        )
    
    @staticmethod
    def create_participation_confirmation(
        *, 
        user: "AbstractUser", 
        roulette_name: str, 
        roulette_id: int, 
        participation_id: int
    ) -> Notification:
        """Crear notificación de participación confirmada"""
        return create_user_notification(
            user_id=user.id,
            title="Participación confirmada",
            message=f"Te uniste exitosamente a la ruleta: {roulette_name}",
            notification_type="participation_confirmed",
            roulette_id=roulette_id,
            participation_id=participation_id,
            extra_data={"roulette_name": roulette_name},
        )
    
    @staticmethod
    def create_winner_announcement(
        *, 
        winner_user: "AbstractUser", 
        roulette_name: str, 
        roulette_id: int, 
        total_participants: int, 
        prize_details: str = ""
    ) -> Tuple[Notification, Notification, AdminEmailResult]:
        """
        Crear anuncio completo de ganador: público + personal + admin.
        
        Returns:
            Tuple con:
            - Notification pública
            - Notification personal al ganador
            - AdminEmailResult con stats de emails a admins
        """
        
        # 1. Notificación pública
        public_notification = create_public_notification(
            title="Tenemos ganador",
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
            title="FELICITACIONES - Has ganado",
            message=f"Eres el ganador de '{roulette_name}'. {prize_details or 'Revisa los detalles del premio.'}",
            notification_type="winner_notification",
            roulette_id=roulette_id,
            priority="urgent",
            extra_data={
                "roulette_name": roulette_name,
                "total_participants": total_participants,
                "prize_details": prize_details,
            },
        )
        
        # 3. Notificación admin + emails
        admin_result = create_admin_notification(
            title=f"Nuevo ganador: {winner_user.username}",
            message=f"La ruleta '{roulette_name}' tiene ganador. Participantes: {total_participants}. Verifica el proceso de entrega.",
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
            send_emails=True,
        )
        
        logger.info(
            f"Winner announcement created: roulette_id={roulette_id}, "
            f"winner={winner_user.username}, "
            f"admin_emails_sent={admin_result['emails_sent']}"
        )
        
        return public_notification, personal_notification, admin_result
    
    @staticmethod
    def create_roulette_started_announcement(
        *, 
        roulette_name: str, 
        roulette_id: int, 
        creator_username: str, 
        end_date: Optional[datetime] = None
    ) -> Notification:
        """Crear anuncio público de inicio de ruleta"""
        end_info = ""
        if end_date:
            end_info = f" (Termina: {end_date.strftime('%d/%m/%Y %H:%M')})"
        
        return create_public_notification(
            title="Nueva ruleta disponible",
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
        *, 
        roulette_name: str, 
        roulette_id: int, 
        hours_remaining: int
    ) -> Notification:
        """Crear alerta de ruleta próxima a terminar"""
        return create_public_notification(
            title="Ruleta terminando pronto",
            message=f"La ruleta '{roulette_name}' terminará en {hours_remaining} horas. Última oportunidad para participar.",
            notification_type="roulette_ending_soon",
            roulette_id=roulette_id,
            priority="high",
            extra_data={
                "roulette_name": roulette_name,
                "hours_remaining": hours_remaining,
            },
        )


# ============================================================================
# REALTIME SERVICE
# ============================================================================

class RealTimeService:
    """Servicio para mensajes en tiempo real (WebSocket/SSE)"""
    
    @staticmethod
    def cleanup_old_messages(*, days: int = 7) -> int:
        """
        Limpiar mensajes en tiempo real antiguos.
        
        Args:
            days: Eliminar mensajes más antiguos que X días
            
        Returns:
            int: Cantidad de mensajes eliminados
        """
        cutoff = _now() - timedelta(days=days)
        deleted, _ = RealTimeMessage.objects.filter(sent_at__lt=cutoff).delete()
        
        if deleted > 0:
            logger.info(f"Cleaned up {deleted} realtime messages older than {days} days")
        
        return int(deleted)
    
    @staticmethod
    @transaction.atomic
    def create_realtime_message(
        *, 
        channel_name: str,
        message_type: str,
        content: Dict[str, Any],
        roulette_id: Optional[int] = None
    ) -> RealTimeMessage:
        """
        Crear mensaje en tiempo real.
        
        Args:
            channel_name: Nombre del canal WebSocket
            message_type: Tipo de mensaje (ej: 'winner_selected', 'roulette_update')
            content: Contenido JSON del mensaje
            roulette_id: ID de ruleta relacionada
            
        Returns:
            RealTimeMessage: Instancia creada
        """
        message = RealTimeMessage.objects.create(
            channel_name=channel_name,
            message_type=message_type,
            content=content,
            roulette_id=roulette_id,
        )
        
        logger.debug(
            f"Realtime message created: channel={channel_name}, "
            f"type={message_type}, id={message.id}"
        )
        
        return message
    

    # AGREGAR AL FINAL DE backend/notifications/services.py

# ============================================================================
# ADMIN READ STATUS MANAGEMENT
# ============================================================================

def mark_admin_notification_as_read(
    admin_user_id: int,
    notification_id: int
) -> bool:
    """
    Marca una notificación admin-only como leída para un admin específico.
    
    Args:
        admin_user_id: ID del admin que lee la notificación
        notification_id: ID de la notificación
        
    Returns:
        bool: True si se marcó exitosamente
    """
    from .models import NotificationReadStatus
    
    try:
        user = User.objects.get(pk=admin_user_id, is_staff=True)
        notification = Notification.objects.get(
            pk=notification_id,
            is_admin_only=True
        )
        
        # Crear o actualizar estado de lectura
        _, created = NotificationReadStatus.objects.get_or_create(
            notification=notification,
            user=user
        )
        
        if created:
            logger.info(
                f"Admin {user.username} marked notification {notification_id} as read"
            )
        
        return True
        
    except (User.DoesNotExist, Notification.DoesNotExist) as e:
        logger.error(f"Error marking admin notification as read: {str(e)}")
        return False


def get_unread_admin_notifications_count(admin_user_id: int) -> int:
    """
    Cuenta notificaciones admin-only no leídas por este admin.
    
    Args:
        admin_user_id: ID del admin
        
    Returns:
        int: Cantidad de notificaciones no leídas
    """
    from django.db.models import Exists, OuterRef
    from .models import NotificationReadStatus
    
    try:
        user = User.objects.get(pk=admin_user_id, is_staff=True)
    except User.DoesNotExist:
        logger.error(f"User {admin_user_id} not found or not staff")
        return 0
    
    # Subquery para verificar si existe un read status para este admin
    read_status_exists = NotificationReadStatus.objects.filter(
        notification=OuterRef('pk'),
        user=user
    )
    
    # Contar notificaciones admin que NO tienen read status para este admin
    count = Notification.objects.filter(
        is_admin_only=True,
        user__isnull=True
    ).exclude(
        Exists(read_status_exists)
    ).count()
    
    return count


def get_admin_notifications_with_read_status(
    admin_user_id: int,
    unread_only: bool = False,
    limit: Optional[int] = None
) -> List[Dict[str, Any]]:
    """
    Obtiene notificaciones admin con estado de lectura del admin específico.
    
    Returns:
        List de dicts con: {notification: Notification, is_read: bool}
    """
    from django.db.models import Exists, OuterRef
    from .models import NotificationReadStatus
    
    try:
        user = User.objects.get(pk=admin_user_id, is_staff=True)
    except User.DoesNotExist:
        logger.error(f"User {admin_user_id} not found or not staff")
        return []
    
    # Subquery para verificar estado de lectura
    read_status_exists = NotificationReadStatus.objects.filter(
        notification=OuterRef('pk'),
        user=user
    )
    
    qs = (
        Notification.objects
        .filter(is_admin_only=True, user__isnull=True)
        .annotate(is_read_by_user=Exists(read_status_exists))
        .order_by('-created_at')
    )
    
    if unread_only:
        qs = qs.exclude(is_read_by_user=True)
    
    if limit:
        qs = qs[:limit]
    
    # Convertir a lista de dicts
    results = []
    for notification in qs:
        results.append({
            'notification': notification,
            'is_read': notification.is_read_by_user
        })
    
    return results

@transaction.atomic
def bulk_mark_admin_notifications_read(
    admin_user_id: int,
    notification_ids: Iterable[int]
) -> int:
    """
    Marca múltiples notificaciones admin como leídas (transaccional).
    """
    from .models import NotificationReadStatus
    
    try:
        user = User.objects.select_for_update().get(
            pk=admin_user_id, 
            is_staff=True
        )
    except User.DoesNotExist:
        logger.error(f"User {admin_user_id} not found or not staff")
        return 0
    
    ids_list = list(notification_ids)
    if not ids_list:
        return 0
    
    # Validar cantidad para prevenir abusos
    if len(ids_list) > 1000:
        logger.warning(
            f"Bulk mark attempted with {len(ids_list)} notifications. "
            f"Limiting to 1000."
        )
        ids_list = ids_list[:1000]
    
    # Obtener notificaciones válidas con lock
    notifications = Notification.objects.select_for_update().filter(
        pk__in=ids_list,
        is_admin_only=True,
        user__isnull=True
    )
    
    # Bulk create optimizado
    read_statuses = []
    existing_ids = set(
        NotificationReadStatus.objects.filter(
            notification__in=notifications,
            user=user
        ).values_list('notification_id', flat=True)
    )
    
    for notification in notifications:
        if notification.id not in existing_ids:
            read_statuses.append(
                NotificationReadStatus(
                    notification=notification,
                    user=user
                )
            )
    
    if read_statuses:
        NotificationReadStatus.objects.bulk_create(
            read_statuses,
            ignore_conflicts=True
        )
    
    count = len(read_statuses)
    
    if count > 0:
        logger.info(
            f"Admin {user.username} marked {count} notifications as read"
        )
    
    return count
# AGREGAR nueva función de validación:
def validate_notification_data(
    title: str,
    message: str,
    priority: str = "normal"
) -> None:
    """
    Valida datos de notificación antes de crear.
    
    Raises:
        ValueError: Si los datos son inválidos
    """
    if not title or len(title) > 200:
        raise ValueError("Title must be between 1 and 200 characters")
    
    if not message or len(message) > 5000:
        raise ValueError("Message must be between 1 and 5000 characters")
    
    if priority not in ['low', 'normal', 'high', 'urgent']:
        raise ValueError(f"Invalid priority: {priority}")
