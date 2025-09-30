# backend/notifications/channels/email.py
import logging
from typing import List, Optional
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string, TemplateDoesNotExist
from django.conf import settings
from django.core.validators import validate_email
from django.core.exceptions import ValidationError
from .base import NotificationChannel, NotificationMessage

logger = logging.getLogger(__name__)

class EmailChannel(NotificationChannel):
    """Canal de email con manejo de errores y fallbacks"""
    
    def __init__(self, from_email: Optional[str] = None):
        self.from_email = from_email or getattr(settings, "DEFAULT_FROM_EMAIL", None)
    
    @property
    def name(self) -> str:
        return "email"
    
    def send(self, message: NotificationMessage) -> bool:
        try:
            if not self.is_available():
                logger.error("Email channel is not available")
                return False
            
            # Filtrar emails válidos
            valid_recipients = self._filter_valid_emails(message.recipients)
            if not valid_recipients:
                logger.warning("No valid email recipients found")
                return False
            
            # Renderizar templates
            txt_content = self._render_template(f"emails/{message.template}.txt", message.context)
            html_content = self._render_template(f"emails/{message.template}.html", message.context)
            
            if not txt_content and not html_content:
                logger.error(f"No templates found for {message.template}")
                return False
            
            # Crear mensaje
            email_msg = EmailMultiAlternatives(
                subject=message.subject,
                body=txt_content or "Este mensaje requiere HTML",
                from_email=self.from_email,
                to=valid_recipients,
            )
            
            if html_content:
                email_msg.attach_alternative(html_content, "text/html")
            
            # Enviar
            email_msg.send(fail_silently=False)
            logger.info(f"Email sent successfully to {len(valid_recipients)} recipients")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send email: {str(e)}")
            return False
    
    def is_available(self) -> bool:
        """Verifica configuración de email"""
        return bool(
            getattr(settings, 'EMAIL_HOST', None) and 
            self.from_email
        )
    
    def _filter_valid_emails(self, emails: List[str]) -> List[str]:
        """Filtra emails válidos"""
        valid_emails = []
        for email in emails:
            if email and email.strip():
                try:
                    validate_email(email.strip())
                    valid_emails.append(email.strip())
                except ValidationError:
                    logger.warning(f"Invalid email address: {email}")
        return valid_emails
    
    def _render_template(self, template_name: str, context: dict) -> Optional[str]:
        """Renderiza template con manejo de errores"""
        try:
            return render_to_string(template_name, context)
        except TemplateDoesNotExist:
            logger.debug(f"Template not found: {template_name}")
            return None
        except Exception as e:
            logger.error(f"Error rendering template {template_name}: {str(e)}")
            return None