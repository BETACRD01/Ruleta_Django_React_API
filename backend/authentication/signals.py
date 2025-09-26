# backend/authentication/signals.py
from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import User, UserProfile


@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    """
    Crea automáticamente un UserProfile cuando se crea un User
    Solo si no fue creado desde el RegisterView (que ya lo crea)
    """
    if created:
        # Verificar si ya existe el profile
        if not hasattr(instance, 'profile'):
            try:
                UserProfile.objects.create(
                    user=instance,
                    phone='',  # Se llenará posteriormente
                )
            except Exception:
                # Si falla, no romper la creación del usuario
                pass


@receiver(post_save, sender=User)
def save_user_profile(sender, instance, **kwargs):
    """
    Guarda el profile cuando se actualiza el usuario
    """
    try:
        if hasattr(instance, 'profile'):
            instance.profile.save()
    except UserProfile.DoesNotExist:
        # Si no existe profile, crearlo
        try:
            UserProfile.objects.create(
                user=instance,
                phone='',
            )
        except Exception:
            pass