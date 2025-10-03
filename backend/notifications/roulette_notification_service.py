# backend/notifications/roulette_notification_service.py
from dataclasses import dataclass
from typing import Optional, List
from django.conf import settings
from django.contrib.auth import get_user_model
import logging

from .notification_manager import notification_manager
from .channels.base import Priority

logger = logging.getLogger(__name__)
User = get_user_model()


@dataclass
class RouletteNotificationContext:
    """Contexto para notificaciones de ruleta"""
    roulette: any
    admin_user: Optional[any] = None


class RouletteNotificationService:
    """Servicio para envío de notificaciones relacionadas con ruletas"""

    @staticmethod
    def notify_new_roulette_created(roulette, created_by=None, priority: Priority = Priority.NORMAL) -> bool:
        """
        Notifica a administradores cuando se crea una nueva ruleta.
        Usa la plantilla: roulette_created_admin
        """
        try:
            admin_emails = User.objects.filter(
                is_staff=True, is_active=True, email__isnull=False
            ).exclude(email='').values_list('email', flat=True)

            if not admin_emails:
                logger.warning("No hay administradores con email para notificar")
                return False

            frontend_base = getattr(settings, "FRONTEND_BASE_URL", "http://localhost:3000")
            brand_name = getattr(settings, "BRAND_NAME", "HAYU24")

            participation_start = roulette.participation_start.strftime("%d/%m/%Y %H:%M") if getattr(roulette, "participation_start", None) else None
            participation_end = roulette.participation_end.strftime("%d/%m/%Y %H:%M") if getattr(roulette, "participation_end", None) else None
            scheduled_date = roulette.scheduled_date.strftime("%d/%m/%Y %H:%M") if getattr(roulette, "scheduled_date", None) else None

            context = {
                "roulette_id": roulette.id,
                "roulette_name": roulette.name,
                "roulette_description": getattr(roulette, "description", None) or "Sin descripción",
                "roulette_status": roulette.get_status_display() if hasattr(roulette, 'get_status_display') else getattr(roulette, "status", None),

                "participation_start": participation_start,
                "participation_end": participation_end,
                "scheduled_date": scheduled_date,

                "created_by_name": (
                    created_by.get_full_name() if created_by and hasattr(created_by, 'get_full_name')
                    else (created_by.username if created_by else "Sistema")
                ),
                "created_by_email": getattr(created_by, "email", None) if created_by else None,

                "roulette_url": f"{frontend_base}/admin/ruletas/{roulette.id}",
                "admin_dashboard_url": f"{frontend_base}/admin",
                "site_url": frontend_base,

                "support_email": getattr(settings, "DEFAULT_FROM_EMAIL", None),
                "brand_name": brand_name,
            }

            subject = f"Nueva Ruleta Creada: {roulette.name} - {brand_name}"

            success = notification_manager.send(
                channel_name="email",
                recipients=list(admin_emails),
                subject=subject,
                template="roulette_created_admin",  # ← alineado con la plantilla de admins
                context=context,
                priority=priority,
                fallback_channels=[]
            )

            if success:
                logger.info("Notificación a admins OK: %s (ID: %s)", roulette.name, roulette.id)
            else:
                logger.error("Fallo notificación a admins: %s (ID: %s)", roulette.name, roulette.id)

            return success

        except Exception as e:
            logger.error("Error enviando notificación de nueva ruleta a admins: %s", str(e), exc_info=True)
            return False

    @staticmethod
    def notify_roulette_updated(roulette, updated_by=None, changes=None, priority: Priority = Priority.NORMAL) -> bool:
        """
        Notifica cuando se actualiza una ruleta (admins).
        Usa la plantilla: roulette_updated
        """
        try:
            admin_emails = User.objects.filter(
                is_staff=True, is_active=True, email__isnull=False
            ).exclude(email='').values_list('email', flat=True)

            if not admin_emails:
                logger.warning("No hay administradores con email para notificar")
                return False

            frontend_base = getattr(settings, "FRONTEND_BASE_URL", "http://localhost:3000")
            brand_name = getattr(settings, "BRAND_NAME", "HAYU24")

            changes_list = []
            if changes:
                for field, (old_value, new_value) in changes.items():
                    changes_list.append({
                        "field": field,
                        "old_value": str(old_value),
                        "new_value": str(new_value),
                    })

            context = {
                "roulette_id": roulette.id,
                "roulette_name": roulette.name,
                "roulette_url": f"{frontend_base}/admin/ruletas/{roulette.id}",
                "updated_by_name": (
                    updated_by.get_full_name() if updated_by and hasattr(updated_by, 'get_full_name')
                    else (updated_by.username if updated_by else "Sistema")
                ),
                "changes": changes_list,
                "site_url": frontend_base,
                "support_email": getattr(settings, "DEFAULT_FROM_EMAIL", None),
                "brand_name": brand_name,
            }

            subject = f"Ruleta Actualizada: {roulette.name} - {brand_name}"

            success = notification_manager.send(
                channel_name="email",
                recipients=list(admin_emails),
                subject=subject,
                template="roulette_updated",
                context=context,
                priority=priority,
                fallback_channels=[]
            )

            if success:
                logger.info("Notificación de actualización enviada: %s", roulette.name)

            return success

        except Exception as e:
            logger.error("Error enviando notificación de actualización: %s", str(e), exc_info=True)
            return False

    @staticmethod
    def notify_roulette_status_change(roulette, old_status, new_status, priority: Priority = Priority.HIGH) -> bool:
        """
        Notifica a admins cuando cambia el estado de una ruleta.
        Usa la plantilla: roulette_status_changed
        """
        try:
            admin_emails = User.objects.filter(
                is_staff=True, is_active=True, email__isnull=False
            ).exclude(email='').values_list('email', flat=True)

            if not admin_emails:
                return False

            frontend_base = getattr(settings, "FRONTEND_BASE_URL", "http://localhost:3000")
            brand_name = getattr(settings, "BRAND_NAME", "HAYU24")

            context = {
                "roulette_id": roulette.id,
                "roulette_name": roulette.name,
                "old_status": old_status,
                "new_status": new_status,
                "roulette_url": f"{frontend_base}/admin/ruletas/{roulette.id}",
                "site_url": frontend_base,
                "brand_name": brand_name,
            }

            subject = f"Cambio de Estado: {roulette.name} - {brand_name}"

            success = notification_manager.send(
                channel_name="email",
                recipients=list(admin_emails),
                subject=subject,
                template="roulette_status_changed",
                context=context,
                priority=priority,
                fallback_channels=[]
            )

            return success

        except Exception as e:
            logger.error("Error enviando notificación de cambio de estado: %s", str(e), exc_info=True)
            return False

    @staticmethod
    def notify_users_new_roulette(roulette, created_by=None, priority: Priority = Priority.HIGH) -> bool:
        """
        Notifica a TODOS los usuarios registrados (no staff) cuando se crea una nueva ruleta.
        Usa la plantilla: roulette_created
        """
        try:
            # Filtro seguro: solo usa notify_new_roulettes si existe en el modelo User.
            filters = {
                "is_active": True,
                "is_staff": False,
                "email__isnull": False,
            }
            if hasattr(User, "notify_new_roulettes"):
                filters["notify_new_roulettes"] = True  # Opt-in si existe

            qs = User.objects.filter(**filters).exclude(email='')

            user_emails = list(qs.values_list('email', flat=True))
            if not user_emails:
                logger.warning("No hay usuarios registrados para notificar sobre nueva ruleta")
                return False

            logger.info("Preparando notificación de nueva ruleta para %d usuarios", len(user_emails))

            frontend_base = getattr(settings, "FRONTEND_BASE_URL", "http://localhost:3000")
            brand_name = getattr(settings, "BRAND_NAME", "HAYU24")

            participation_end = roulette.participation_end.strftime("%d/%m/%Y %H:%M") if getattr(roulette, "participation_end", None) else None
            scheduled_date = roulette.scheduled_date.strftime("%d/%m/%Y %H:%M") if getattr(roulette, "scheduled_date", None) else None

            context = {
                "roulette_id": roulette.id,
                "roulette_name": roulette.name,
                "roulette_description": getattr(roulette, "description", None) or "¡Nueva oportunidad de ganar premios increíbles!",
                "participation_end": participation_end,
                "scheduled_date": scheduled_date,
                "roulette_url": f"{frontend_base}/ruletas/{roulette.id}/participar",
                "all_roulettes_url": f"{frontend_base}/ruletas",
                "site_url": frontend_base,
                "support_email": getattr(settings, "DEFAULT_FROM_EMAIL", None),
                "brand_name": brand_name,
            }

            subject = f"¡Nueva Ruleta Disponible: {roulette.name}! - {brand_name}"

            success = notification_manager.send(
                channel_name="email",
                recipients=user_emails,
                subject=subject,
                template="roulette_created",   # ← plantilla para usuarios
                context=context,
                priority=priority,
                fallback_channels=[]
            )

            if success:
                logger.info("Notificación a usuarios OK (%d): %s", len(user_emails), roulette.name)
            else:
                logger.error("Falló el envío de notificación a usuarios: %s", roulette.name)

            return success

        except Exception as e:
            logger.error("Error enviando notificación de nueva ruleta a usuarios: %s", str(e), exc_info=True)
            return False


# Función de conveniencia
def notify_new_roulette(roulette, created_by=None) -> bool:
    """Función simple para notificar nueva ruleta"""
    return RouletteNotificationService.notify_new_roulette_created(roulette, created_by)
