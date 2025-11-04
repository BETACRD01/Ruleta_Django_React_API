# backend/notifications/apps.py

from django.apps import AppConfig
import logging

class NotificationsConfig(AppConfig):
    """
    Configuración de la aplicación notifications
    RF5.1: Confirmación de participación
    RF5.2: Notificación pública de ganadores
    RNF4.3: Tiempo real
    """
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'notifications'
    verbose_name = 'Sistema de Notificaciones'
    
    def ready(self):
        """
        Configuración que se ejecuta cuando la app está lista
        CORREGIDO: Sin acceso a BD durante inicialización
        """
        # Importar señales para que se registren (NO ejecuta queries)
        try:
            from . import signals  # noqa
            print(f"✓ Señales de {self.name} registradas correctamente")
        except ImportError as e:
            print(f"✗ Error importando señales de {self.name}: {e}")
        
        # Configurar logging específico para notifications
        self._configure_logging()
        
        # Verificar configuraciones requeridas (SIN acceso a BD)
        self._check_configurations()
        
        # Registrar inicialización de templates DESPUÉS de migraciones
        from django.db.models.signals import post_migrate
        from django.dispatch import receiver
        
        @receiver(post_migrate)
        def setup_default_data(sender, **kwargs):
            """Se ejecuta DESPUÉS de migraciones, cuando es seguro acceder a BD"""
            if sender.name == 'notifications':
                try:
                    self._setup_notification_channels()
                    self._setup_default_templates()
                except Exception as e:
                    print(f"⚠️ Error configurando datos iniciales: {e}")
        
        print(f"✓ Aplicación {self.verbose_name} iniciada correctamente")
    
    def _configure_logging(self):
        """Configurar sistema de logging para la aplicación"""
        import sys
        
        # Configurar logger específico para notificaciones
        logger = logging.getLogger('notifications')
        
        if not logger.handlers:
            # Handler para consola
            console_handler = logging.StreamHandler(sys.stdout)
            console_formatter = logging.Formatter(
                '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
            )
            console_handler.setFormatter(console_formatter)
            console_handler.setLevel(logging.INFO)
            
            logger.addHandler(console_handler)
            logger.setLevel(logging.INFO)
            
            # Logger específico para errores críticos
            critical_logger = logging.getLogger('notifications.critical')
            critical_logger.setLevel(logging.ERROR)
    
    def _check_configurations(self):
        """
        Verificar configuraciones necesarias
        SIN ACCESO A BASE DE DATOS
        """
        from django.conf import settings
        
        # Verificar configuración de email (para notificaciones de admin)
        required_email_settings = [
            'EMAIL_BACKEND',
            'DEFAULT_FROM_EMAIL',
        ]
        
        missing_email_configs = []
        for setting in required_email_settings:
            if not hasattr(settings, setting):
                missing_email_configs.append(setting)
        
        if missing_email_configs:
            print(f"⚠️ Configuraciones de email faltantes: {missing_email_configs}")
        
        # Verificar configuración de caché (para optimizaciones)
        if not hasattr(settings, 'CACHES'):
            print("⚠️ No hay configuración de CACHES")
        
        # Verificar configuración de base de datos para índices
        if hasattr(settings, 'DATABASES'):
            default_db = settings.DATABASES.get('default', {})
            db_engine = default_db.get('ENGINE', '')
            
            if 'postgresql' in db_engine:
                print("✓ PostgreSQL detectado - Índices JSON optimizados disponibles")
            elif 'sqlite' in db_engine:
                print("⚠️ SQLite detectado - No recomendado para producción")
    
    def _setup_notification_channels(self):
        """
        Crear canales de notificación por defecto
        Solo se ejecuta DESPUÉS de migraciones
        """
        try:
            from .models import NotificationChannel
            
            channels = [
                {'code': 'email', 'name': 'Email', 'is_active': True},
                {'code': 'web', 'name': 'Notificación Web', 'is_active': True},
                {'code': 'push', 'name': 'Push Notification', 'is_active': False},
            ]
            
            created = 0
            for channel_data in channels:
                _, created_flag = NotificationChannel.objects.get_or_create(
                    code=channel_data['code'],
                    defaults=channel_data
                )
                if created_flag:
                    created += 1
            
            if created > 0:
                logger = logging.getLogger('notifications')
                logger.info(f"Channel 'email' registered")
                
        except Exception as e:
            print(f"⚠️ Error configurando canales: {e}")
    
    def _setup_default_templates(self):
        """
        Crear plantillas por defecto si no existen
        Solo se ejecuta DESPUÉS de migraciones
        """
        try:
            from .models import NotificationTemplate, NotificationType
            
            default_templates = [
                {
                    'name': 'participation_confirmed',
                    'notification_type': NotificationType.PARTICIPATION_CONFIRMED,
                    'title_template': 'Participación confirmada',
                    'message_template': 'Tu participación en "{{ roulette_name }}" ha sido confirmada.'
                },
                {
                    'name': 'winner_announcement',
                    'notification_type': NotificationType.ROULETTE_WINNER,
                    'title_template': '🎉 ¡Tenemos ganador!',
                    'message_template': '{{ winner_name }} ganó en {{ roulette_name }}.'
                },
                {
                    'name': 'personal_winner',
                    'notification_type': NotificationType.WINNER_NOTIFICATION,
                    'title_template': '🏆 ¡FELICITACIONES!',
                    'message_template': '¡Eres el ganador de "{{ roulette_name }}"!'
                },
            ]
            
            created_count = 0
            for template_data in default_templates:
                _, created = NotificationTemplate.objects.get_or_create(
                    name=template_data['name'],
                    defaults=template_data
                )
                if created:
                    created_count += 1
            
            if created_count > 0:
                print(f"✓ {created_count} plantillas creadas")
                
        except Exception as e:
            print(f"⚠️ Error creando plantillas: {e}")