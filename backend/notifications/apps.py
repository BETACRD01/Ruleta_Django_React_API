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
    verbose_name = 'Sistema de Notificaciones'
    
    def ready(self):
        """
        Configuración que se ejecuta cuando la app está lista
        """
        # Importar señales para que se registren
        try:
            from . import signals
            print(f"✓ Señales de {self.name} registradas correctamente")
        except ImportError as e:
            print(f"✗ Error importando señales de {self.name}: {e}")
        
        # Configurar logging específico para notifications
        self._configure_logging()
        
        # Verificar configuraciones requeridas
        self._check_configurations()
        
        print(f"✓ Aplicación {self.verbose_name} iniciada correctamente")
    
    def _configure_logging(self):
        """Configurar sistema de logging para la aplicación"""
        import logging
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
            
            # Handler para archivo (si se configura)
            try:
                from django.conf import settings
                if hasattr(settings, 'LOGGING_DIR'):
                    file_handler = logging.FileHandler(
                        f"{settings.LOGGING_DIR}/notifications.log"
                    )
                    file_formatter = logging.Formatter(
                        '%(asctime)s - %(name)s - %(levelname)s - %(funcName)s:%(lineno)d - %(message)s'
                    )
                    file_handler.setFormatter(file_formatter)
                    logger.addHandler(file_handler)
            except Exception as e:
                print(f"Warning: No se pudo configurar logging a archivo: {e}")
            
            logger.addHandler(console_handler)
            logger.setLevel(logging.INFO)
            
            # Logger específico para errores críticos
            critical_logger = logging.getLogger('notifications.critical')
            critical_logger.setLevel(logging.ERROR)
    
    def _check_configurations(self):
        """Verificar configuraciones necesarias"""
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
            print(f"Warning: Configuraciones de email faltantes: {missing_email_configs}")
            print("Las notificaciones por email no funcionarán correctamente")
        
        # Verificar configuración de caché (para optimizaciones)
        if not hasattr(settings, 'CACHES'):
            print("Warning: No hay configuración de CACHES. Considera usar Redis/Memcached para mejor rendimiento")
        
        # Verificar configuración de timezone
        if not hasattr(settings, 'TIME_ZONE'):
            print("Warning: TIME_ZONE no configurado. Se usará UTC por defecto")
        
        # Verificar configuración de base de datos para índices
        if hasattr(settings, 'DATABASES'):
            default_db = settings.DATABASES.get('default', {})
            db_engine = default_db.get('ENGINE', '')
            
            if 'postgresql' in db_engine:
                print("✓ PostgreSQL detectado - Índices JSON optimizados disponibles")
            elif 'mysql' in db_engine:
                print("✓ MySQL detectado - Considera usar PostgreSQL para mejor soporte JSON")
            elif 'sqlite' in db_engine:
                print("⚠ SQLite detectado - No recomendado para producción con alto volumen")
    
    def _setup_default_templates(self):
        """Crear plantillas por defecto si no existen"""
        from .models import NotificationTemplate, NotificationType
        
        default_templates = [
            {
                'name': 'welcome_user',
                'notification_type': NotificationType.WELCOME_MESSAGE,
                'title_template': '¡Bienvenido/a {{ username }}!',
                'message_template': 'Hola {{ username }}, bienvenido/a al sistema de ruletas. ¡Que tengas suerte!'
            },
            {
                'name': 'participation_confirmed',
                'notification_type': NotificationType.PARTICIPATION_CONFIRMED,
                'title_template': 'Participación confirmada',
                'message_template': 'Tu participación en "{{ roulette_name }}" ha sido confirmada exitosamente.'
            },
            {
                'name': 'winner_announcement',
                'notification_type': NotificationType.ROULETTE_WINNER,
                'title_template': '🎉 ¡Tenemos ganador!',
                'message_template': '{{ winner_name }} ganó en {{ roulette_name }} con {{ total_participants }} participantes.'
            },
            {
                'name': 'personal_winner',
                'notification_type': NotificationType.WINNER_NOTIFICATION,
                'title_template': '🏆 ¡FELICITACIONES!',
                'message_template': '¡Eres el ganador de "{{ roulette_name }}"! {{ prize_details }}'
            },
            {
                'name': 'admin_winner_alert',
                'notification_type': NotificationType.ADMIN_WINNER_ALERT,
                'title_template': '🎯 Nuevo ganador: {{ winner_name }}',
                'message_template': 'La ruleta "{{ roulette_name }}" tiene ganador. Participantes: {{ total_participants }}. Verifica el proceso de entrega.'
            },
            {
                'name': 'roulette_started',
                'notification_type': NotificationType.ROULETTE_STARTED,
                'title_template': '🎯 Nueva ruleta disponible',
                'message_template': '"{{ roulette_name }}" está abierta para participar. Creada por {{ creator_username }}.'
            },
            {
                'name': 'roulette_ending',
                'notification_type': NotificationType.ROULETTE_ENDING_SOON,
                'title_template': '⏰ Ruleta terminando pronto',
                'message_template': 'La ruleta "{{ roulette_name }}" terminará en {{ hours_remaining }} horas. ¡Última oportunidad!'
            }
        ]
        
        created_count = 0
        for template_data in default_templates:
            template, created = NotificationTemplate.objects.get_or_create(
                name=template_data['name'],
                defaults=template_data
            )
            if created:
                created_count += 1
        
        if created_count > 0:
            print(f"✓ {created_count} plantillas por defecto creadas")

# Función para ser llamada desde manage.py o scripts de inicialización
def setup_notifications_app():
    """
    Configuración adicional que puede ser llamada manualmente
    """
    from django.core.management import call_command
    
    print("Configurando aplicación de notificaciones...")
    
    # Crear migraciones si es necesario
    try:
        call_command('makemigrations', 'notifications', verbosity=0)
        print("✓ Migraciones verificadas")
    except Exception as e:
        print(f"Warning: Error verificando migraciones: {e}")
    
    # Aplicar migraciones
    try:
        call_command('migrate', 'notifications', verbosity=0)
        print("✓ Migraciones aplicadas")
    except Exception as e:
        print(f"Error: No se pudieron aplicar migraciones: {e}")
        return False
    
    # Crear plantillas por defecto
    try:
        config = NotificationsConfig('notifications', None)
        config._setup_default_templates()
    except Exception as e:
        print(f"Warning: Error creando plantillas por defecto: {e}")
    
    print("✓ Configuración de notificaciones completada")
    return True