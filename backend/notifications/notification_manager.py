# backend/notifications/notification_manager.py
import logging
from typing import List, Dict, Any, Optional
from django.conf import settings
from .channels.base import NotificationChannel, NotificationMessage, Priority
from .channels.email import EmailChannel

logger = logging.getLogger(__name__)

class NotificationManager:
    """Manager principal de notificaciones con múltiples canales y fallbacks"""
    
    def __init__(self):
        self.channels: Dict[str, NotificationChannel] = {}
        self._register_default_channels()
    
    def _register_default_channels(self):
        """Registra canales por defecto"""
        self.register_channel(EmailChannel())
    
    def register_channel(self, channel: NotificationChannel):
        """Registra un canal de notificación"""
        self.channels[channel.name] = channel
        logger.info(f"Channel '{channel.name}' registered")
    
    def send(
        self, 
        channel_name: str,
        recipients: List[str],
        subject: str,
        template: str,
        context: Dict[str, Any],
        priority: Priority = Priority.NORMAL,
        fallback_channels: Optional[List[str]] = None
    ) -> bool:
        """
        Envía notificación con fallback automático
        
        Args:
            channel_name: Nombre del canal principal
            recipients: Lista de destinatarios
            subject: Asunto del mensaje
            template: Nombre del template
            context: Contexto para el template
            priority: Prioridad del mensaje
            fallback_channels: Canales de respaldo si falla el principal
            
        Returns:
            bool: True si se envió exitosamente
        """
        message = NotificationMessage(
            recipients=recipients,
            subject=subject,
            template=template,
            context=context,
            priority=priority
        )
        
        # Intentar canal principal
        if self._send_via_channel(channel_name, message):
            return True
        
        # Intentar canales de fallback
        if fallback_channels:
            for fallback in fallback_channels:
                if self._send_via_channel(fallback, message):
                    logger.info(f"Message sent via fallback channel: {fallback}")
                    return True
        
        logger.error("Failed to send notification via all channels")
        return False
    
    def send_batch(
        self,
        channel_name: str,
        messages: List[NotificationMessage],
        fallback_channels: Optional[List[str]] = None
    ) -> Dict[str, int]:
        """
        Envía múltiples notificaciones en lote
        
        Returns:
            dict: Estadísticas de envío
        """
        stats = {
            "total": len(messages),
            "sent": 0,
            "failed": 0
        }
        
        for message in messages:
            success = self.send(
                channel_name=channel_name,
                recipients=message.recipients,
                subject=message.subject,
                template=message.template,
                context=message.context,
                priority=message.priority,
                fallback_channels=fallback_channels
            )
            
            if success:
                stats["sent"] += 1
            else:
                stats["failed"] += 1
        
        logger.info(f"Batch send complete: {stats['sent']}/{stats['total']} sent")
        return stats
    
    def _send_via_channel(self, channel_name: str, message: NotificationMessage) -> bool:
        """Envía mensaje por un canal específico"""
        channel = self.channels.get(channel_name)
        if not channel:
            logger.error(f"Channel '{channel_name}' not found")
            return False
        
        if not channel.is_available():
            logger.warning(f"Channel '{channel_name}' is not available")
            return False
        
        return channel.send(message)
    
    def get_available_channels(self) -> List[str]:
        """Retorna lista de canales disponibles"""
        return [
            name for name, channel in self.channels.items() 
            if channel.is_available()
        ]
    
    def health_check(self) -> Dict[str, bool]:
        """Verifica estado de todos los canales"""
        return {
            name: channel.is_available() 
            for name, channel in self.channels.items()
        }
    
    def get_channel_stats(self) -> Dict[str, Dict[str, Any]]:
        """Obtiene estadísticas de los canales"""
        stats = {}
        for name, channel in self.channels.items():
            stats[name] = {
                "name": channel.name,
                "available": channel.is_available(),
                "type": channel.__class__.__name__
            }
        return stats

# Instancia global
notification_manager = NotificationManager()