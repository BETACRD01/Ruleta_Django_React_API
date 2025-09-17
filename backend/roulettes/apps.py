# backend/roulettes/apps.py

from django.apps import AppConfig


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
            # Importar signals para que se registren automáticamente
            import roulettes.signals
            
            # Opcional: ejecutar verificaciones de integridad inicial
            self._run_startup_checks()
            
        except ImportError as e:
            # En caso de que haya problemas con las importaciones
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Error importando signals de roulettes: {e}")
    
    def _run_startup_checks(self):
        """
        Ejecuta verificaciones opcionales al iniciar la aplicación.
        """
        try:
            # Solo ejecutar si Django ya está completamente inicializado
            from django.db import connection
            if connection.introspection.table_names():
                # Verificar ruletas sin configuración (opcional)
                from .models import Roulette
                roulettes_without_settings = Roulette.objects.filter(settings__isnull=True).count()
                
                if roulettes_without_settings > 0:
                    import logging
                    logger = logging.getLogger(__name__)
                    logger.info(f"Encontradas {roulettes_without_settings} ruletas sin configuración al iniciar")
        except Exception:
            # Ignorar errores en startup checks (pueden ocurrir durante migraciones)
            pass