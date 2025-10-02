# backend/notifications/winner_email_service.py
from dataclasses import dataclass
from typing import Optional, List
from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.contrib.auth import get_user_model
import logging

from .notification_manager import notification_manager
from .channels.base import Priority

logger = logging.getLogger(__name__)

def _get_rank_metadata(rank: Optional[int]) -> dict:
    """Retorna metadatos del rango/posición del premio"""
    rank_configs = {
        1: {"label": "1° puesto", "emoji": "🥇", "color": "#F59E0B"},
        2: {"label": "2° puesto", "emoji": "🥈", "color": "#9CA3AF"},
        3: {"label": "3° puesto", "emoji": "🥉", "color": "#D97706"},
    }
    
    if rank in rank_configs:
        return rank_configs[rank]
    
    return {
        "label": f"{rank}° puesto" if rank else "Premio",
        "emoji": "🎁",
        "color": "#3B82F6"
    }

@dataclass
class WinnerNotificationContext:
    """Contexto para notificaciones de ganadores"""
    winner: AbstractUser
    roulette_name: str
    prize_name: str
    prize_description: Optional[str] = None
    prize_image_url: Optional[str] = None
    prize_rank: Optional[int] = None
    pickup_instructions: Optional[str] = None
    site_url: Optional[str] = None
    roulette_id: Optional[int] = None
    prize_id: Optional[int] = None

class WinnerEmailService:
    """Servicio especializado para envío de emails de ganadores"""

    @staticmethod
    def send_winner_notification(
        context: WinnerNotificationContext, 
        notify_admins: bool = True,
        priority: Priority = Priority.HIGH
    ) -> dict:
        """
        Envía notificaciones de ganador
        
        Returns:
            dict: Resultado del envío con estadísticas
        """
        results = {
            "winner_sent": False,
            "admin_notifications_sent": 0,
            "errors": []
        }
        
        try:
            # Preparar contexto base
            email_context = WinnerEmailService._build_email_context(context)
            
            # Enviar al ganador
            results["winner_sent"] = WinnerEmailService._send_winner_email(
                context, email_context, priority
            )
            
            # Enviar a administradores si está habilitado
            if notify_admins:
                results["admin_notifications_sent"] = WinnerEmailService._send_admin_notifications(
                    context, email_context, priority
                )
            
            logger.info(
                f"Winner notification sent. Winner: {results['winner_sent']}, "
                f"Admins: {results['admin_notifications_sent']}"
            )
            
        except Exception as e:
            error_msg = f"Error sending winner notification: {str(e)}"
            logger.error(error_msg)
            results["errors"].append(error_msg)
        
        return results
    
    @staticmethod
    def _build_email_context(context: WinnerNotificationContext) -> dict:
        """Construye el contexto para los templates de email"""
        # URL base del frontend
        frontend_base = (
            context.site_url or 
            getattr(settings, "FRONTEND_BASE_URL", None) or 
            "http://localhost:3000"
        )
        
        # Metadatos del rango
        rank_meta = _get_rank_metadata(context.prize_rank)
        
        # URLs útiles
        prize_url = f"{frontend_base}/mis-premios"
        roulette_url = f"{frontend_base}/roulette/{context.roulette_id}" if context.roulette_id else None
        
        # CORRECCIÓN: Usar BRAND_NAME de settings
        brand_name = getattr(settings, "BRAND_NAME", "HAYU 24")
        
        # URL para darse de baja (opcional - solo si implementas la funcionalidad)
        unsubscribe_url = None
        if hasattr(context.winner, 'id'):
            # Generar token seguro para unsubscribe
            from django.utils.http import urlsafe_base64_encode
            from django.utils.encoding import force_bytes
            user_id_b64 = urlsafe_base64_encode(force_bytes(context.winner.id))
            unsubscribe_url = f"{frontend_base}/unsubscribe/{user_id_b64}"
        
        return {
            # Información del usuario
            "user_first_name": getattr(context.winner, "first_name", "") or None,
            "user_full_name": (
                getattr(context.winner, "get_full_name", lambda: "")() or 
                context.winner.username
            ),
            "user_email": getattr(context.winner, "email", "") or "",
            
            # Información de la roulette y premio
            "roulette_name": context.roulette_name,
            "prize_name": context.prize_name,
            "prize_description": context.prize_description,
            "prize_image_url": context.prize_image_url,
            
            # Información de rango
            "prize_rank_label": rank_meta["label"],
            "prize_rank_emoji": rank_meta["emoji"],
            "prize_rank_color": rank_meta["color"],
            
            # Instrucciones y enlaces
            "pickup_instructions": context.pickup_instructions,
            "prize_url": prize_url,
            "roulette_url": roulette_url,
            "unsubscribe_url": unsubscribe_url,  # NUEVO
            
            # Configuración del sitio - CORREGIDO
            "support_email": getattr(settings, "DEFAULT_FROM_EMAIL", None),
            "brand_logo": f"{frontend_base}/static/email/logo.png",
            "brand_name": brand_name,  # USAR VARIABLE
            "site_url": frontend_base,
        }
    
    @staticmethod
    def _send_winner_email(
        context: WinnerNotificationContext,
        email_context: dict,
        priority: Priority
    ) -> bool:
        """Envía email al ganador"""
        winner_email = getattr(context.winner, "email", None)
        if not winner_email:
            logger.warning(f"Winner {context.winner.username} has no email address")
            return False
        
        # Verificar si el usuario quiere recibir notificaciones
        if hasattr(context.winner, 'receive_notifications') and not context.winner.receive_notifications:
            logger.info(f"Winner {context.winner.username} has opted out of notifications")
            return False
        
        subject = f"🎉 ¡Has ganado {context.prize_name}!"
        
        return notification_manager.send(
            channel_name="email",
            recipients=[winner_email],
            subject=subject,
            template="winner_notification",
            context=email_context,
            priority=priority,
            fallback_channels=[]
        )
    
    @staticmethod
    def _send_admin_notifications(
        context: WinnerNotificationContext,
        base_context: dict,
        priority: Priority
    ) -> int:
        """Envía notificaciones a administradores"""
        try:
            User = get_user_model()
            admins = User.objects.filter(
                is_active=True,
                is_staff=True
            ).exclude(email="").exclude(email__isnull=True)
            
            sent_count = 0
            subject = f"🏆 Nuevo Ganador: {context.prize_name} - {context.roulette_name}"
            
            for admin in admins:
                try:
                    # Contexto específico para cada admin
                    admin_context = {
                        **base_context,
                        "admin_name": (
                            getattr(admin, "get_full_name", lambda: "")() or 
                            admin.username
                        ),
                        "admin_email": admin.email,
                    }
                    
                    success = notification_manager.send(
                        channel_name="email",
                        recipients=[admin.email],
                        subject=subject,
                        template="admin_winner_notification",
                        context=admin_context,
                        priority=priority
                    )
                    
                    if success:
                        sent_count += 1
                    else:
                        logger.warning(f"Failed to send admin notification to {admin.email}")
                        
                except Exception as e:
                    logger.error(f"Error sending admin notification to {admin.email}: {str(e)}")
            
            return sent_count
            
        except Exception as e:
            logger.error(f"Error getting admins for notification: {str(e)}")
            return 0
    
    @staticmethod
    def send_batch_winner_notifications(
        contexts: List[WinnerNotificationContext],
        notify_admins: bool = True,
        priority: Priority = Priority.HIGH
    ) -> dict:
        """
        Envía notificaciones a múltiples ganadores
        
        Returns:
            dict: Estadísticas agregadas del envío
        """
        batch_results = {
            "total_winners": len(contexts),
            "winners_notified": 0,
            "admin_notifications_sent": 0,
            "errors": []
        }
        
        for i, context in enumerate(contexts, 1):
            try:
                logger.info(f"Sending winner notification {i}/{len(contexts)}")
                
                result = WinnerEmailService.send_winner_notification(
                    context, 
                    notify_admins=(notify_admins and i == 1),
                    priority=priority
                )
                
                if result["winner_sent"]:
                    batch_results["winners_notified"] += 1
                
                batch_results["admin_notifications_sent"] += result["admin_notifications_sent"]
                batch_results["errors"].extend(result["errors"])
                
            except Exception as e:
                error_msg = f"Error processing winner {i}: {str(e)}"
                logger.error(error_msg)
                batch_results["errors"].append(error_msg)
        
        logger.info(
            f"Batch notification complete. "
            f"{batch_results['winners_notified']}/{batch_results['total_winners']} winners notified"
        )
        
        return batch_results


def send_winner_email(
    winner: AbstractUser,
    roulette_name: str,
    prize_name: str,
    prize_description: Optional[str] = None,
    prize_image_url: Optional[str] = None,
    prize_rank: Optional[int] = None,
    pickup_instructions: Optional[str] = None,
    notify_admins: bool = True,
    **kwargs
) -> dict:
    """Función de conveniencia para enviar notificación de ganador"""
    context = WinnerNotificationContext(
        winner=winner,
        roulette_name=roulette_name,
        prize_name=prize_name,
        prize_description=prize_description,
        prize_image_url=prize_image_url,
        prize_rank=prize_rank,
        pickup_instructions=pickup_instructions,
        **kwargs
    )
    
    return WinnerEmailService.send_winner_notification(
        context, 
        notify_admins=notify_admins
    )