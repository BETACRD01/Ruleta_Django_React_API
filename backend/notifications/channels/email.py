# backend/notifications/channels/email.py
import logging
import ssl
import smtplib
from typing import List, Optional
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string, TemplateDoesNotExist
from django.conf import settings
from django.core.validators import validate_email
from django.core.exceptions import ValidationError
from .base import NotificationChannel, NotificationMessage

logger = logging.getLogger(__name__)

class EmailChannel(NotificationChannel):
    """Canal de email con manejo de SSL mejorado"""
    
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
            
            # SOLUCIÓN: Enviar usando conexión personalizada
            return self._send_with_custom_connection(
                subject=message.subject,
                txt_content=txt_content,
                html_content=html_content,
                recipients=valid_recipients
            )
            
        except Exception as e:
            logger.error(f"Failed to send email: {str(e)}", exc_info=True)
            return False
    
    def _send_with_custom_connection(self, subject, txt_content, html_content, recipients) -> bool:
        """Envía email usando conexión SMTP manual con SSL personalizado"""
        try:
            # Crear contexto SSL sin verificación en desarrollo
            context = ssl.create_default_context()
            if settings.DEBUG:
                context.check_hostname = False
                context.verify_mode = ssl.CERT_NONE
                logger.debug("SSL verification disabled for development")
            
            # Conectar manualmente al servidor SMTP
            host = getattr(settings, 'EMAIL_HOST', 'smtp-relay.brevo.com')
            port = getattr(settings, 'EMAIL_PORT', 587)
            username = getattr(settings, 'EMAIL_HOST_USER', '')
            password = getattr(settings, 'EMAIL_HOST_PASSWORD', '')
            timeout = getattr(settings, 'EMAIL_TIMEOUT', 60)
            
            # Establecer conexión
            server = smtplib.SMTP(host, port, timeout=timeout)
            server.set_debuglevel(0)  # Cambiar a 1 para debug
            
            # Iniciar TLS con contexto personalizado
            server.starttls(context=context)
            
            # Autenticar
            server.login(username, password)
            
            # Preparar mensaje
            from email.mime.multipart import MIMEMultipart
            from email.mime.text import MIMEText
            
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = self.from_email
            msg['To'] = ', '.join(recipients)
            
            # Agregar contenido
            if txt_content:
                msg.attach(MIMEText(txt_content, 'plain', 'utf-8'))
            if html_content:
                msg.attach(MIMEText(html_content, 'html', 'utf-8'))
            
            # Enviar
            server.send_message(msg)
            server.quit()
            
            logger.info(f"Email sent successfully to {len(recipients)} recipients")
            return True
            
        except smtplib.SMTPAuthenticationError as e:
            logger.error(f"SMTP Authentication failed: {e}")
            return False
        except smtplib.SMTPException as e:
            logger.error(f"SMTP error: {e}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error sending email: {e}", exc_info=True)
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