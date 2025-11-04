# backend/notifications/channels/email.py
import logging
import ssl
import smtplib
from typing import List, Optional
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from django.template.loader import render_to_string, TemplateDoesNotExist
from django.conf import settings
from django.core.validators import validate_email
from django.core.exceptions import ValidationError
from .base import NotificationChannel, NotificationMessage

logger = logging.getLogger(__name__)

class EmailChannel(NotificationChannel):
    """Canal de email con manejo seguro de conexiones y SSL"""
    
    def __init__(self, from_email: Optional[str] = None):
        self.from_email = from_email or getattr(settings, "DEFAULT_FROM_EMAIL", None)
    
    @property
    def name(self) -> str:
        return "email"
    
    def send(self, message: NotificationMessage) -> bool:
        """Envía email con validaciones completas"""
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
            txt_content = self._render_template(
                f"emails/{message.template}.txt", 
                message.context
            )
            html_content = self._render_template(
                f"emails/{message.template}.html", 
                message.context
            )
            
            # Validar que exista al menos texto plano
            if not txt_content:
                logger.error(
                    f"Missing required .txt template for {message.template}"
                )
                return False
            
            logger.info(
                f"Templates rendered: txt=True html={bool(html_content)}"
            )
            
            # Enviar con conexión segura
            return self._send_with_custom_connection(
                subject=message.subject,
                txt_content=txt_content,
                html_content=html_content,
                recipients=valid_recipients
            )
            
        except Exception as e:
            logger.error(f"Failed to send email: {str(e)}", exc_info=True)
            return False
    
    def _send_with_custom_connection(
        self, 
        subject: str, 
        txt_content: str, 
        html_content: Optional[str], 
        recipients: List[str]
    ) -> bool:
        """Envía email usando conexión SMTP con cleanup automático"""
        try:
            # Configurar SSL según entorno
            context = self._get_ssl_context()
            
            # Obtener configuración
            host = getattr(settings, 'EMAIL_HOST', 'smtp.gmail.com')
            port = getattr(settings, 'EMAIL_PORT', 587)
            username = getattr(settings, 'EMAIL_HOST_USER', '')
            password = getattr(settings, 'EMAIL_HOST_PASSWORD', '')
            timeout = getattr(settings, 'EMAIL_TIMEOUT', 60)
            
            # Usar context manager para cleanup automático
            with smtplib.SMTP(host, port, timeout=timeout) as server:
                # Debug solo en desarrollo
                server.set_debuglevel(1 if settings.DEBUG else 0)
                
                # Iniciar TLS
                server.starttls(context=context)
                
                # Autenticar
                server.login(username, password)
                
                # Preparar mensaje
                msg = self._prepare_message(
                    subject, 
                    txt_content, 
                    html_content, 
                    recipients
                )
                
                # Enviar
                server.send_message(msg)
                
            logger.info(f"Email sent successfully to {len(recipients)} recipients")
            return True
            
        except smtplib.SMTPAuthenticationError as e:
            logger.error(f"SMTP authentication failed: {e}")
            return False
        except smtplib.SMTPException as e:
            logger.error(f"SMTP error: {e}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error sending email: {e}", exc_info=True)
            return False
    
    def _get_ssl_context(self) -> ssl.SSLContext:
        """Configura contexto SSL según entorno"""
        context = ssl.create_default_context()
        
        # Protección extra: bloquear SSL inseguro en producción
        use_insecure = getattr(settings, 'EMAIL_USE_INSECURE_SSL', False)
        
        if not settings.DEBUG and use_insecure:
            logger.critical(
                "SECURITY ERROR: Attempting to use insecure SSL in production"
            )
            raise RuntimeError(
                "Insecure SSL is not allowed in production environment"
            )
        
        # Solo deshabilitar SSL en desarrollo
        if use_insecure:
            context.check_hostname = False
            context.verify_mode = ssl.CERT_NONE
            logger.warning(
                "SSL verification DISABLED - development mode only"
            )
        else:
            logger.debug("SSL verification enabled")
        
        return context
    
    def _prepare_message(
        self, 
        subject: str, 
        txt_content: str, 
        html_content: Optional[str], 
        recipients: List[str]
    ) -> MIMEMultipart:
        """Prepara mensaje MIME"""
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = self.from_email
        msg['To'] = ', '.join(recipients)
        
        # Agregar texto plano (siempre presente)
        msg.attach(MIMEText(txt_content, 'plain', 'utf-8'))
        
        # Agregar HTML si existe
        if html_content:
            msg.attach(MIMEText(html_content, 'html', 'utf-8'))
        
        return msg
    
    def is_available(self) -> bool:
        """Verifica configuración de email"""
        has_host = bool(getattr(settings, 'EMAIL_HOST', None))
        has_from = bool(self.from_email)
        
        if not has_host:
            logger.error("EMAIL_HOST not configured")
        if not has_from:
            logger.error("DEFAULT_FROM_EMAIL not configured")
        
        return has_host and has_from
    
    def _filter_valid_emails(self, emails: List[str]) -> List[str]:
        """Filtra y valida emails"""
        valid_emails = []
        for email in emails:
            if not email or not email.strip():
                continue
            
            try:
                validate_email(email.strip())
                valid_emails.append(email.strip())
            except ValidationError:
                logger.warning(f"Invalid email address: {email}")
        
        return valid_emails
    
    def _render_template(
        self, 
        template_name: str, 
        context: dict
    ) -> Optional[str]:
        """Renderiza template con manejo de errores"""
        try:
            return render_to_string(template_name, context)
        except TemplateDoesNotExist:
            logger.debug(f"Template not found: {template_name}")
            return None
        except Exception as e:
            logger.error(
                f"Error rendering template {template_name}: {str(e)}"
            )
            return None