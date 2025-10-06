# backend/authentication/signals.py
from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import User, UserProfile


@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    """
    Crea automáticamente un UserProfile cuando se crea un User.
    Usa get_or_create para evitar duplicados y race conditions.
    """
    if created:
        UserProfile.objects.get_or_create(user=instance)