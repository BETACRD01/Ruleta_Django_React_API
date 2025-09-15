# backend/roulettes/apps.py

from django.apps import AppConfig


class RoulettesConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'roulettes'
    verbose_name = 'Gestión de Ruletas'