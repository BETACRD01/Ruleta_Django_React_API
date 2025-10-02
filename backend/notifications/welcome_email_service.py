# backend/notifications/welcome_email_service.py
from dataclasses import dataclass
from typing import Optional
from django.conf import settings
from django.contrib.auth import get_user_model
import logging

from .notification_manager import notification_manager
from .channels.base import Priority

logger = logging.getLogger(__name__)

@dataclass
class WelcomeEmailContext:
    """Contexto para email de confirmación de registro"""
    user: any
    site_url: Optional[str] = None

class WelcomeEmailService:
    """Servicio para envío de emails de confirmación de registro"""

    @staticmethod
    def send_welcome_email(user, priority: Priority = Priority.NORMAL) -> bool:
        """
        Envía email de confirmación de registro a nuevo usuario
        
        Args:
            user: Usuario recién registrado
            priority: Prioridad del email
            
        Returns:
            bool: True si se envió exitosamente
        """
        try:
            user_email = getattr(user, "email", None)
            if not user_email:
                logger.warning(f"User {user.username} has no email address")
                return False
            
            # URL base del frontend
            frontend_base = getattr(settings, "FRONTEND_BASE_URL", "http://localhost:3000")
            brand_name = getattr(settings, "BRAND_NAME", "HAYU 24")
            
            # Contexto para el template
            context = {
                # Información del usuario
                "user_first_name": getattr(user, "first_name", "") or user.username,
                "user_full_name": (
                    getattr(user, "get_full_name", lambda: "")() or 
                    user.username
                ),
                "user_email": user_email,
                "username": user.username,
                
                # Enlaces útiles
                "login_url": f"{frontend_base}/login",
                "profile_url": f"{frontend_base}/perfil",
                "roulettes_url": f"{frontend_base}/ruletas",
                "site_url": frontend_base,
                
                # Configuración del sitio
                "support_email": getattr(settings, "DEFAULT_FROM_EMAIL", None),
                "brand_logo": f"{frontend_base}/static/email/logo.png",
                "brand_name": brand_name,
            }
            
            # ASUNTO CORREGIDO - Notificación de cuenta creada
            subject = f"Cuenta Creada Exitosamente - {brand_name}"
            
            success = notification_manager.send(
                channel_name="email",
                recipients=[user_email],
                subject=subject,
                template="welcome_email",
                context=context,
                priority=priority,
                fallback_channels=[]
            )
            
            if success:
                logger.info(f"Registration confirmation email sent successfully to {user_email}")
            else:
                logger.error(f"Failed to send registration confirmation email to {user_email}")
            
            return success
            
        except Exception as e:
            logger.error(f"Error sending registration confirmation email: {str(e)}", exc_info=True)
            return False


# Función de conveniencia
def send_welcome_email(user) -> bool:
    """Función simple para enviar email de confirmación de registro"""
    return WelcomeEmailService.send_welcome_email(user)