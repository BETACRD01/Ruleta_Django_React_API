# backend/notifications/password_reset_service.py
from dataclasses import dataclass
from typing import Optional
from django.conf import settings
from django.contrib.auth import get_user_model
import logging

from .notification_manager import notification_manager
from .channels.base import Priority

logger = logging.getLogger(__name__)

@dataclass
class PasswordResetContext:
    """Contexto para email de restablecimiento de contraseña"""
    user: any
    token: str
    reset_url: Optional[str] = None
    expiry_hours: int = 24

class PasswordResetService:
    """Servicio para envío de emails de restablecimiento de contraseña"""

    @staticmethod
    def send_reset_email(user, token: str, priority: Priority = Priority.HIGH) -> bool:
        """
        Envía email de restablecimiento de contraseña
        
        Args:
            user: Usuario que solicita el reset
            token: Token único generado para el reset
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
            brand_name = getattr(settings, "BRAND_NAME", "HAYU24")
            
            # Construir URL de reset
            reset_url = f"{frontend_base}/reset-password?token={token}"
            
            # Tiempo de expiración del token (en horas)
            expiry_seconds = getattr(settings, "PASSWORD_RESET_TIMEOUT", 86400)
            expiry_hours = expiry_seconds // 3600
            
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
                
                # Información del reset
                "reset_url": reset_url,
                "token": token,
                "expiry_hours": expiry_hours,
                
                # Enlaces útiles
                "login_url": f"{frontend_base}/login",
                "site_url": frontend_base,
                
                # Configuración del sitio
                "support_email": getattr(settings, "DEFAULT_FROM_EMAIL", None),
                "brand_logo": f"{frontend_base}/static/email/logo.png",
                "brand_name": brand_name,
            }
            
            subject = f"Restablecer Contraseña - {brand_name}"
            
            success = notification_manager.send(
                channel_name="email",
                recipients=[user_email],
                subject=subject,
                template="password_reset",
                context=context,
                priority=priority,
                fallback_channels=[]
            )
            
            if success:
                logger.info(f"Password reset email sent successfully to {user_email}")
            else:
                logger.error(f"Failed to send password reset email to {user_email}")
            
            return success
            
        except Exception as e:
            logger.error(f"Error sending password reset email: {str(e)}", exc_info=True)
            return False

    @staticmethod
    def send_reset_confirmation(user, priority: Priority = Priority.NORMAL) -> bool:
        """
        Envía email de confirmación después de cambiar la contraseña
        
        Args:
            user: Usuario que cambió la contraseña
            priority: Prioridad del email
            
        Returns:
            bool: True si se envió exitosamente
        """
        try:
            user_email = getattr(user, "email", None)
            if not user_email:
                logger.warning(f"User {user.username} has no email address")
                return False
            
            frontend_base = getattr(settings, "FRONTEND_BASE_URL", "http://localhost:3000")
            brand_name = getattr(settings, "BRAND_NAME", "HAYU24")
            
            context = {
                "user_first_name": getattr(user, "first_name", "") or user.username,
                "user_email": user_email,
                "login_url": f"{frontend_base}/login",
                "support_email": getattr(settings, "DEFAULT_FROM_EMAIL", None),
                "brand_name": brand_name,
                "site_url": frontend_base,
            }
            
            subject = f"Contraseña Actualizada - {brand_name}"
            
            success = notification_manager.send(
                channel_name="email",
                recipients=[user_email],
                subject=subject,
                template="password_reset_confirmation",
                context=context,
                priority=priority,
                fallback_channels=[]
            )
            
            if success:
                logger.info(f"Password reset confirmation sent to {user_email}")
            
            return success
            
        except Exception as e:
            logger.error(f"Error sending reset confirmation: {str(e)}")
            return False


# Funciones de conveniencia
def send_password_reset_email(user, token: str) -> bool:
    """Función simple para enviar email de reset"""
    return PasswordResetService.send_reset_email(user, token)

def send_password_change_confirmation(user) -> bool:
    """Función simple para enviar confirmación de cambio"""
    return PasswordResetService.send_reset_confirmation(user)