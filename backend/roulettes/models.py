from django.db import models
from django.utils import timezone
from django.core.exceptions import ValidationError
from django.contrib.auth import get_user_model
from participants.models import Participation  # relación con participantes

User = get_user_model()


class RouletteStatus(models.TextChoices):
    ACTIVE = 'active', 'Activa'
    COMPLETED = 'completed', 'Completada'
    CANCELLED = 'cancelled', 'Cancelada'


def prize_image_upload_path(instance, filename):
    return f'roulette_prizes/{instance.roulette_id}/{filename}'


class Roulette(models.Model):
    name = models.CharField(max_length=150)
    description = models.TextField(blank=True, default='')
    status = models.CharField(
        max_length=12,
        choices=RouletteStatus.choices,
        default=RouletteStatus.ACTIVE
    )
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, related_name='roulettes_created'
    )

    # Programación / resultado
    scheduled_date = models.DateTimeField(null=True, blank=True)
    drawn_at = models.DateTimeField(null=True, blank=True)
    drawn_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name='roulettes_drawn'
    )
    # Resultado: participación ganadora
    winner = models.ForeignKey(
        Participation, on_delete=models.SET_NULL, null=True, blank=True, related_name='won_roulettes'
    )
    is_drawn = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Ruleta'
        verbose_name_plural = 'Ruletas'

    def __str__(self):
        return self.name

    # ---- Utilidades de participantes ----
    def get_participants_count(self) -> int:
        return self.participations.count()

    def get_participants_list(self):
        return self.participations.select_related('user').order_by('participant_number')

    # ---- Reglas de sorteo ----
    def clean(self):
        if self.scheduled_date and self.scheduled_date <= timezone.now():
            # se permite programar en el pasado? normal es advertir:
            raise ValidationError({'scheduled_date': 'La fecha programada debe ser posterior a ahora.'})

    @property
    def can_be_drawn_manually(self) -> bool:
        if self.is_drawn or self.status == RouletteStatus.COMPLETED:
            return False
        return self.participations.exists()

    def save(self, *args, **kwargs):
        # Sincronizar flags con ganador
        if self.winner and not self.is_drawn:
            self.is_drawn = True
            if not self.drawn_at:
                self.drawn_at = timezone.now()
            if self.status != RouletteStatus.COMPLETED:
                self.status = RouletteStatus.COMPLETED
        super().save(*args, **kwargs)


class RouletteSettings(models.Model):
    roulette = models.OneToOneField(Roulette, on_delete=models.CASCADE, related_name='settings')
    max_participants = models.PositiveIntegerField(default=0, help_text='0 = sin límite')
    allow_multiple_entries = models.BooleanField(default=False)

    def __str__(self):
        return f'Config {self.roulette.name}'


class DrawHistory(models.Model):
    roulette = models.ForeignKey(Roulette, on_delete=models.CASCADE, related_name='draw_history')
    winner_selected = models.ForeignKey(Participation, on_delete=models.SET_NULL, null=True, related_name='draw_history')
    drawn_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='draws_made')
    draw_type = models.CharField(max_length=20, default='manual')
    drawn_at = models.DateTimeField(default=timezone.now)
    participants_count = models.PositiveIntegerField(default=0)
    random_seed = models.CharField(max_length=64, blank=True, default='')

    class Meta:
        ordering = ['-drawn_at']

    def __str__(self):
        return f'[{self.drawn_at:%Y-%m-%d %H:%M}] {self.roulette.name}'


class RoulettePrize(models.Model):
    roulette = models.ForeignKey(Roulette, on_delete=models.CASCADE, related_name='prizes')
    name = models.CharField(max_length=120)
    description = models.TextField(blank=True, default='')
    image = models.ImageField(upload_to=prize_image_upload_path, blank=True, null=True)
    stock = models.PositiveIntegerField(default=1)
    probability = models.DecimalField(max_digits=5, decimal_places=2, default=0)  # 0..100 (opcional)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.name} ({self.roulette.name})'
