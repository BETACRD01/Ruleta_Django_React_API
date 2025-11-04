# backend/notifications/channels/base.py
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional
from dataclasses import dataclass
from enum import Enum

class Priority(Enum):
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"

@dataclass
class NotificationMessage:
    """Mensaje base para notificaciones"""
    recipients: List[str]
    subject: str
    template: str
    context: Dict[str, Any]
    priority: Priority = Priority.NORMAL
    metadata: Optional[Dict[str, Any]] = None

class NotificationChannel(ABC):
    """Canal base para envío de notificaciones"""
    
    @abstractmethod
    def send(self, message: NotificationMessage) -> bool:
        """Envía la notificación. Retorna True si fue exitoso."""
        pass
    
    @abstractmethod
    def is_available(self) -> bool:
        """Verifica si el canal está disponible"""
        pass
    
    @property
    @abstractmethod
    def name(self) -> str:
        """Nombre del canal"""
        pass