# backend/notifications/apps.py

from django.apps import AppConfig

class NotificationsConfig(AppConfig):
    """
    Configuración de la aplicación notifications
    RF5.1: Confirmación de participación
    RF5.2: Notificación pública de ganadores
    RNF4.3: Tiempo real
    """
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'notifications'
    verbose_name = 'Notificaciones'
    
    def ready(self):
        """
        Configuración que se ejecuta cuando la app está lista
        """
        # Importar señales si las hay
        try:
            import notifications.signals
        except ImportError:
            pass
        
        # Configurar logging específico para notifications
        import logging
        
        # Configurar logger específico para notificaciones
        logger = logging.getLogger('notifications')
        if not logger.handlers:
            # Solo agregar handler si no existe uno
            handler = logging.StreamHandler()
            formatter = logging.Formatter(
                '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
            )
            handler.setFormatter(formatter)
            logger.addHandler(handler)
            logger.setLevel(logging.INFO)