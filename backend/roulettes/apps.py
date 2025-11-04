# backend/roulettes/apps.py

from django.apps import AppConfig
import sys


class RoulettesConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'roulettes'
    verbose_name = 'Gestión de Ruletas'
    
    def ready(self):
        """
        Se ejecuta cuando la aplicación está lista.
        Importa las señales para que se registren correctamente.
        """
        try:
            # ✅ CRÍTICO: Importar signals
            import roulettes.signals
            
            # Solo ejecutar checks si NO estamos en comandos de migración
            if not self._is_migration_command():
                self._run_startup_checks()
            
        except ImportError as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Error importando signals de roulettes: {e}")
    
    def _is_migration_command(self):
        """
        Detecta si estamos ejecutando un comando relacionado con migraciones.
        Retorna True si es makemigrations, migrate, showmigrations, etc.
        """
        migration_commands = [
            'makemigrations',
            'migrate',
            'showmigrations',
            'sqlmigrate',
            'squashmigrations',
        ]
        return any(cmd in sys.argv for cmd in migration_commands)
    
    def _run_startup_checks(self):
        """Verificaciones opcionales al iniciar"""
        try:
            from django.db import connection
            
            # Verificar que haya tablas antes de consultar
            if not connection.introspection.table_names():
                return
            
            from .models import Roulette
            roulettes_without_settings = Roulette.objects.filter(settings__isnull=True).count()
            
            if roulettes_without_settings > 0:
                import logging
                logger = logging.getLogger(__name__)
                logger.info(f"Encontradas {roulettes_without_settings} ruletas sin configuración al iniciar")
                
        except Exception as e:
            # Silenciosamente ignorar errores en startup checks
            # para no romper el arranque de la aplicación
            pass