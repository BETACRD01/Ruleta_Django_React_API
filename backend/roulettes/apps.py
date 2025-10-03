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
            # ✅ CRÍTICO: Importar signals
            import roulettes.signals
            
            # Opcional: ejecutar verificaciones
            self._run_startup_checks()
            
        except ImportError as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Error importando signals de roulettes: {e}")
    
    def _run_startup_checks(self):
        """Verificaciones opcionales al iniciar"""
        try:
            from django.db import connection
            if connection.introspection.table_names():
                from .models import Roulette
                roulettes_without_settings = Roulette.objects.filter(settings__isnull=True).count()
                
                if roulettes_without_settings > 0:
                    import logging
                    logger = logging.getLogger(__name__)
                    logger.info(f"Encontradas {roulettes_without_settings} ruletas sin configuración al iniciar")
        except Exception:
            pass