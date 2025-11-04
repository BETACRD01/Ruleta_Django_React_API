# participants/apps.py

from django.apps import AppConfig

class ParticipantsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "participants"
    verbose_name = "Participaciones"

    def ready(self):
        # Importa señales al iniciar la app
        from . import signals  # noqa: F401
