from __future__ import annotations

import hashlib
import importlib
import logging
import uuid
from typing import List, Tuple, Type, Optional

from django.contrib.auth import get_user_model
from django.contrib.auth.models import AbstractUser
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models, transaction
from django.db.models import F, Case, When
from django.utils import timezone
from django.utils.text import slugify
from django.conf import settings

from participants.models import Participation

User = get_user_model()
logger = logging.getLogger(__name__)


# ============================================================
# Helper para construir URLs absolutas de imágenes
# ============================================================

def _build_absolute_image_url(image_field) -> Optional[str]:
    """Construye URL absoluta para imágenes de premios"""
    if not image_field:
        return None
    
    try:
        relative_url = image_field.url
        
        if relative_url.startswith(('http://', 'https://')):
            return relative_url
        
        base_url = getattr(settings, 'MEDIA_URL_BASE', 'http://localhost:8000')
        base_url = base_url.rstrip('/')
        
        return f"{base_url}{relative_url}"
    except Exception as e:
        logger.warning(f"Error construyendo URL de imagen: {e}")
        return None


# ============================================================
# Helper para asignación atómica de premios (SIN DUPLICACIÓN)
# ============================================================

def _assign_prize_atomically(roulette, iteration: int = 0) -> Optional['RoulettePrize']:
    """
    Asigna un premio disponible de forma atómica.
    Previene race conditions en sorteos concurrentes.
    """
    prize = (
        roulette.prizes.select_for_update(nowait=False)
        .filter(is_active=True, stock__gt=0)
        .order_by("display_order", "id")
        .first()
    )

    if not prize:
        logger.warning(f"No hay premios disponibles (ruleta {roulette.id}, iter {iteration})")
        return None

    # Verificar stock después del lock
    prize.refresh_from_db()
    if prize.stock <= 0:
        logger.warning(f"Premio {prize.id} sin stock después del lock (iter {iteration})")
        return None

    # Actualización atómica usando F() expressions
    from .models import RoulettePrize  # Import local para evitar circular
    updated_rows = RoulettePrize.objects.filter(
        id=prize.id,
        stock__gt=0
    ).update(
        stock=F('stock') - 1,
        is_active=Case(
            When(stock=1, then=False),
            default=F('is_active')
        )
    )
    
    if updated_rows == 0:
        logger.warning(f"Race condition en premio {prize.id} (iter {iteration})")
        return None

    prize.refresh_from_db()
    logger.info(f"Premio {prize.id} asignado. Stock: {prize.stock}")
    
    return prize


# ============================================================
# Helper para notificaciones (SIN DUPLICACIÓN)
# ============================================================

def _schedule_winner_notifications(
    roulette,
    winner_participation: Participation,
    prize: Optional['RoulettePrize'],
    iteration: int = 0,
    is_first_winner: bool = True
):
    """
    Crea notificaciones en BD y programa envío por email.
    Centraliza toda la lógica de notificaciones.
    """
    winner_user = winner_participation.user
    
    # Crear notificaciones en base de datos
    try:
        from notifications.services import NotificationService
        
        logger.info(f"Creando notificaciones para ganador #{iteration+1}: {winner_user.username}")
        
        public_notif, personal_notif, admin_notifs = NotificationService.create_winner_announcement(
            winner_user=winner_user,
            roulette_name=roulette.name,
            roulette_id=roulette.id,
            total_participants=roulette.participations.count(),
            prize_details=prize.name if prize else "Premio especial"
        )
        
        logger.info(
            f"Notificaciones #{iteration+1}: publica={public_notif.id}, "
            f"personal={personal_notif.id}, admins={len(admin_notifs)}"
        )
        
    except Exception as e:
        logger.error(f"Error creando notificaciones #{iteration+1}: {e}", exc_info=True)

    # Programar envío de email con Celery
    try:
        settings_obj = getattr(roulette, "settings", None)
        notify_flag = bool(settings_obj.notify_on_draw) if settings_obj else True
        winner_email = getattr(winner_user, 'email', None)
        
        if not winner_email or not winner_email.strip():
            logger.warning(f"Ganador #{iteration+1} sin email configurado")
            return
        
        if not notify_flag:
            logger.info(f"Notificaciones deshabilitadas para ganador #{iteration+1}")
            return
        
        from notifications.tasks import send_winner_notification_delayed
        
        base_delay = getattr(settings, 'WINNER_NOTIFICATION_DELAY', 300)
        delay_seconds = base_delay + (iteration * 30)  # Escalonar envíos
        
        logger.info(f"Programando email ganador #{iteration+1} (+{delay_seconds}s)")
        
        task_data = {
            "user_id": winner_user.id,
            "roulette_name": roulette.name,
            "prize_name": prize.name if prize else "Premio especial",
            "prize_description": prize.description if prize else None,
            "prize_image_url": _build_absolute_image_url(prize.image) if prize and prize.image else None,
            "prize_rank": getattr(prize, 'display_order', None) if prize else None,
            "pickup_instructions": getattr(prize, 'pickup_instructions', None) if prize else None,
            "roulette_id": roulette.id,
            "prize_id": prize.id if prize else None,
            "notify_admins": is_first_winner  # Solo notificar admins en el primero
        }
        
        task = send_winner_notification_delayed.apply_async(
            kwargs=task_data,
            countdown=delay_seconds
        )
        
        logger.info(f"Tarea programada: {task.id}")
            
    except Exception as e:
        logger.error(f"Error programando email #{iteration+1}: {e}", exc_info=True)


# ========= RichText dinámico (CKEditor si está disponible) =========
def get_rich_text_field() -> Tuple[Type[models.Field], bool]:
    try:
        ck5 = importlib.import_module("django_ckeditor_5.fields")
        return ck5.CKEditor5Field, True
    except ImportError:
        try:
            ckclassic = importlib.import_module("ckeditor_uploader.fields")
            return ckclassic.RichTextUploadingField, True
        except ImportError:
            logger.warning("CKEditor no encontrado: usando TextField como fallback.")

            class RichTextUploadingField(models.TextField):
                def __init__(self, config_name=None, **kwargs):
                    kwargs.pop("config_name", None)
                    super().__init__(**kwargs)

            return RichTextUploadingField, False


RichTextUploadingField, CKEDITOR_AVAILABLE = get_rich_text_field()


# ========= Choices =========
class RouletteStatus(models.TextChoices):
    DRAFT = "draft", "Borrador"
    ACTIVE = "active", "Activa"
    SCHEDULED = "scheduled", "Programada"
    COMPLETED = "completed", "Completada"
    CANCELLED = "cancelled", "Cancelada"


class DrawType(models.TextChoices):
    MANUAL = "manual", "Manual"
    SCHEDULED = "scheduled", "Programado"
    AUTO = "auto", "Automático"
    ADMIN = "admin", "Admin"


# ========= Helpers de paths =========
def prize_image_upload_path(instance: "RoulettePrize", filename: str) -> str:
    ext = filename.rsplit(".", 1)[-1].lower()
    return f"roulette_prizes/{instance.roulette_id}/{uuid.uuid4().hex}.{ext}"


def roulette_cover_upload_path(instance: "Roulette", filename: str) -> str:
    ext = filename.rsplit(".", 1)[-1].lower()
    base = instance.id or uuid.uuid4().hex
    return f"roulette_covers/{base}/{uuid.uuid4().hex}.{ext}"


# ========= QuerySet/Manager =========
class RouletteQuerySet(models.QuerySet):
    def active(self):
        return self.filter(status=RouletteStatus.ACTIVE)

    def completed(self):
        return self.filter(status=RouletteStatus.COMPLETED)

    def drawable(self):
        return (
            self.filter(
                status__in=[RouletteStatus.ACTIVE, RouletteStatus.SCHEDULED],
                is_drawn=False,
                participations__isnull=False,
            ).distinct()
        )

    def with_participants_count(self):
        return self.annotate(participants_count=models.Count("participations", distinct=True))


class RouletteManager(models.Manager):
    def get_queryset(self):
        return RouletteQuerySet(self.model, using=self._db)

    def active(self):
        return self.get_queryset().active()

    def drawable(self):
        return self.get_queryset().drawable()


# ========= Modelos =========
class Roulette(models.Model):
    """Modelo principal de ruleta"""

    name = models.CharField(max_length=150, db_index=True, verbose_name="Título de la Ruleta")
    slug = models.SlugField(max_length=160, unique=True, blank=True)

    description = RichTextUploadingField(
        blank=True,
        default="",
        verbose_name="Descripción",
        help_text=(
            "Descripción detallada de la ruleta. Puedes usar negrita, enlaces, imágenes, listas, etc."
            + (" (Editor enriquecido disponible)" if CKEDITOR_AVAILABLE else " (Texto simple)")
        ),
        config_name="roulette_editor" if CKEDITOR_AVAILABLE else None,
    )

    cover_image = models.ImageField(
        upload_to=roulette_cover_upload_path, blank=True, null=True, verbose_name="Imagen de Portada"
    )

    status = models.CharField(
        max_length=12, choices=RouletteStatus.choices, default=RouletteStatus.DRAFT, db_index=True
    )

    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, related_name="roulettes_created", db_index=True
    )

    participation_start = models.DateTimeField(null=True, blank=True)
    participation_end = models.DateTimeField(null=True, blank=True)
    scheduled_date = models.DateTimeField(null=True, blank=True, db_index=True)

    drawn_at = models.DateTimeField(null=True, blank=True, db_index=True)
    drawn_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="roulettes_drawn")
    winner = models.ForeignKey(
        Participation, on_delete=models.SET_NULL, null=True, blank=True, related_name="won_roulettes"
    )
    is_drawn = models.BooleanField(default=False, db_index=True)

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = RouletteManager()

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "is_drawn"]),
            models.Index(fields=["scheduled_date", "status"]),
            models.Index(fields=["participation_start", "participation_end"]),
        ]

    def __str__(self) -> str:
        return f"{self.name} ({self.get_status_display()})"

    def clean(self):
        errors = {}
        now = timezone.now()

        if self.participation_start and self.participation_end:
            if self.participation_start >= self.participation_end:
                errors["participation_end"] = "La fecha de fin debe ser posterior al inicio."

        if self.scheduled_date:
            if self.scheduled_date <= now:
                errors["scheduled_date"] = "La fecha programada debe ser futura."
            if self.participation_end and self.scheduled_date <= self.participation_end:
                errors["scheduled_date"] = "El sorteo debe ser después del fin de participación."

        if errors:
            raise ValidationError(errors)

    def available_awards_count(self) -> int:
        return (
            self.prizes.filter(is_active=True, stock__gt=0)
            .aggregate(total=models.Sum("stock"))["total"]
            or 0
        )

    def winners_target_effective(self) -> int:
        settings_obj = getattr(self, "settings", None)
        if not settings_obj:
            return 1
        if settings_obj.winners_target == 0:
            return max(self.available_awards_count(), 1)
        return max(settings_obj.winners_target, 1)

    def winners_count(self) -> int:
        qs = self.participations.filter(is_winner=True)
        count = qs.count()
        if self.winner_id and not qs.filter(pk=self.winner_id).exists():
            count += 1
        return count

    def has_remaining_winners(self) -> bool:
        settings_obj = getattr(self, "settings", None)
        if settings_obj and settings_obj.winners_target and settings_obj.winners_target > 0:
            return self.winners_count() < max(settings_obj.winners_target, 1)
        return self.available_awards_count() > 0

    def can_still_draw(self) -> bool:
        eligibles = self.participations.filter(is_winner=False).exists()
        awards_left = self.available_awards_count() > 0
        return eligibles and awards_left and self.has_remaining_winners()

    @transaction.atomic
    def mark_completed(self, by_user=None):
        changed = False
        if self.status != RouletteStatus.COMPLETED:
            self.status = RouletteStatus.COMPLETED
            changed = True
        if not self.is_drawn:
            self.is_drawn = True
            changed = True
        if self.drawn_at is None:
            self.drawn_at = timezone.now()
            changed = True
        if by_user and (self.drawn_by_id is None):
            self.drawn_by = by_user
            changed = True
        if changed:
            self.save(update_fields=["status", "is_drawn", "drawn_at", "drawn_by"])

    @transaction.atomic
    def reconcile_completion(self, by_user=None):
        eligible_count = self.participations.filter(is_winner=False).count()
        if eligible_count == 0:
            self.mark_completed(by_user=by_user)
            return

        available_awards = self.available_awards_count()
        if available_awards <= 0:
            self.mark_completed(by_user=by_user)
            return

        settings_obj = getattr(self, "settings", None)
        if settings_obj and settings_obj.winners_target and settings_obj.winners_target > 0:
            if self.winners_count() >= max(settings_obj.winners_target, 1) and available_awards <= 0:
                self.mark_completed(by_user=by_user)
                return

    def save(self, *args, **kwargs):
        if not self.slug:
            base_slug = slugify(self.name)
            slug = base_slug
            counter = 1
            while Roulette.objects.filter(slug=slug).exclude(pk=self.pk).exists():
                slug = f"{base_slug}-{counter}"
                counter += 1
            self.slug = slug

        if self.pk:
            try:
                eligibles = self.participations.filter(is_winner=False).exists()
            except Exception:
                eligibles = False

            available = self.available_awards_count()

            must_close = False
            if not eligibles or available <= 0:
                must_close = True
            else:
                settings_obj = getattr(self, "settings", None)
                target = int(getattr(settings_obj, "winners_target", 0) or 0)
                if target > 0 and self.winners_count() >= max(target, 1) and available <= 0:
                    must_close = True

            if must_close:
                if not self.is_drawn:
                    self.is_drawn = True
                    self.drawn_at = self.drawn_at or timezone.now()
                if self.status != RouletteStatus.COMPLETED:
                    self.status = RouletteStatus.COMPLETED

        super().save(*args, **kwargs)

    def get_participants_count(self) -> int:
        if "participants_count" in self.__dict__:
            try:
                return int(self.__dict__["participants_count"])
            except (TypeError, ValueError):
                pass
        return self.participations.count()

    def get_participants_list(self):
        return self.participations.select_related("user").order_by("participant_number")

    def can_be_drawn_manually_method(self) -> bool:
        if self.is_drawn or self.status == RouletteStatus.COMPLETED:
            return False
        if not self.participations.exists():
            return False
        if not self.participations.filter(is_winner=False).exists():
            return False
        if self.available_awards_count() <= 0:
            return False
        return True

    @property
    def can_be_drawn_manually(self) -> bool:
        return self.can_be_drawn_manually_method()

    @property
    def is_scheduled_ready(self) -> bool:
        return bool(
            self.scheduled_date
            and timezone.now() >= self.scheduled_date
            and not self.is_drawn
            and self.status in [RouletteStatus.ACTIVE, RouletteStatus.SCHEDULED]
        )

    @property
    def participation_is_open(self) -> bool:
        now = timezone.now()
        if self.status not in [RouletteStatus.ACTIVE, RouletteStatus.SCHEDULED]:
            return False
        if self.is_drawn:
            return False
        if self.participation_start and now < self.participation_start:
            return False
        if self.participation_end and now > self.participation_end:
            return False
        return True

    @property
    def participants_count(self) -> int:
        return self.get_participants_count()

    def can_participate(self, user: AbstractUser) -> tuple[bool, str]:
        if not self.participation_is_open:
            if self.is_drawn:
                return False, "El sorteo ya fue realizado"
            if self.status not in [RouletteStatus.ACTIVE, RouletteStatus.SCHEDULED]:
                return False, "La ruleta no está disponible para participación"

            now = timezone.now()
            if self.participation_start and now < self.participation_start:
                return False, f"La participación inicia el {self.participation_start:%d/%m/%Y %H:%M}"
            if self.participation_end and now > self.participation_end:
                return False, "El período de participación ha terminado"

        settings_obj = getattr(self, "settings", None)
        if not settings_obj:
            return False, "Configuración faltante"

        current_count = self.participations.count()
        if settings_obj.max_participants > 0 and current_count >= settings_obj.max_participants:
            return False, "Se alcanzó el límite de participantes"

        if not settings_obj.allow_multiple_entries and self.participations.filter(user=user).exists():
            return False, "Ya estás participando en esta ruleta"

        return True, "OK"

    @transaction.atomic
    def draw_winner(self, drawn_by_user: AbstractUser | None = None, draw_type: str = DrawType.MANUAL):
        """Sortea UN ganador usando función helper centralizada"""
        if self.is_drawn:
            raise ValidationError("No se puede realizar el sorteo: la ruleta ya fue completada.")
        if not self.participations.exists():
            raise ValidationError("No hay participantes")

        candidates = list(self.participations.select_related("user").filter(is_winner=False))
        if not candidates:
            raise ValidationError("No quedan participantes elegibles para ganar.")

        import random
        seed_data = f"{self.id}-{timezone.now().isoformat()}"
        seed = hashlib.sha256(seed_data.encode()).hexdigest()
        random.seed(seed)

        winner_participation = random.choice(candidates)

        # Asignación atómica usando helper (SIN DUPLICACIÓN)
        prize = _assign_prize_atomically(self, iteration=0)

        winner_participation.is_winner = True
        winner_participation.won_at = timezone.now()
        winner_participation.won_prize = prize
        winner_participation.prize_position = prize.display_order if prize else None
        winner_participation.save(update_fields=["is_winner", "won_at", "won_prize", "prize_position"])

        if not self.winner_id:
            self.winner = winner_participation

        self.drawn_by = drawn_by_user
        self.save()

        DrawHistory.objects.create(
            roulette=self,
            winner_selected=winner_participation,
            drawn_by=drawn_by_user,
            draw_type=draw_type,
            participants_count=self.participations.count(),
            random_seed=seed,
        )

        # Notificaciones usando helper centralizado (SIN DUPLICACIÓN)
        _schedule_winner_notifications(
            roulette=self,
            winner_participation=winner_participation,
            prize=prize,
            iteration=0,
            is_first_winner=True
        )

        logger.info("Ruleta %s: ganador seleccionado", self.name)
        return winner_participation

    @transaction.atomic
    def draw_winners(self, n: int, drawn_by_user: AbstractUser | None = None, draw_type: str = DrawType.MANUAL) -> List[Participation]:
        """Sortea MÚLTIPLES ganadores usando función helper centralizada"""
        if n <= 0:
            return []

        if self.is_drawn:
            raise ValidationError("No se puede realizar el sorteo: la ruleta ya fue completada.")

        total_candidates_qs = self.participations.select_related("user").filter(is_winner=False)
        total_candidates = total_candidates_qs.count()
        if total_candidates == 0:
            raise ValidationError("No quedan participantes elegibles para ganar.")

        picks = min(n, total_candidates, max(self.available_awards_count(), 0))

        import random
        seed_base = hashlib.sha256(f"{self.id}-{timezone.now().isoformat()}".encode()).hexdigest()
        random.seed(seed_base)

        winners: List[Participation] = []
        pool = list(total_candidates_qs)

        for i in range(min(picks, len(pool))):
            seed_i = hashlib.sha256(f"{seed_base}-{i}".encode()).hexdigest()
            random.seed(seed_i)

            choice = random.choice(pool)
            pool.remove(choice)

            # Asignación atómica usando helper (SIN DUPLICACIÓN)
            prize = _assign_prize_atomically(self, iteration=i)

            choice.is_winner = True
            choice.won_at = timezone.now()
            choice.won_prize = prize
            choice.prize_position = prize.display_order if prize else None
            choice.save(update_fields=["is_winner", "won_at", "won_prize", "prize_position"])

            if not self.winner_id:
                self.winner = choice

            DrawHistory.objects.create(
                roulette=self,
                winner_selected=choice,
                drawn_by=drawn_by_user,
                draw_type=draw_type,
                participants_count=self.participations.count(),
                random_seed=seed_i,
            )

            # Notificaciones usando helper centralizado (SIN DUPLICACIÓN)
            _schedule_winner_notifications(
                roulette=self,
                winner_participation=choice,
                prize=prize,
                iteration=i,
                is_first_winner=(i == 0)
            )

            winners.append(choice)

        self.drawn_by = drawn_by_user
        self.save()
        logger.info("Ruleta %s: %d ganadores seleccionados", self.name, len(winners))
        return winners


class RouletteSettings(models.Model):
    roulette = models.OneToOneField(Roulette, on_delete=models.CASCADE, related_name="settings")
    max_participants = models.PositiveIntegerField(default=0, validators=[MinValueValidator(0)])
    allow_multiple_entries = models.BooleanField(default=False)
    show_countdown = models.BooleanField(default=True)
    notify_on_participation = models.BooleanField(default=True)
    notify_on_draw = models.BooleanField(default=True)
    winners_target = models.PositiveIntegerField(default=0, validators=[MinValueValidator(0)])

    def __str__(self) -> str:
        return f"Configuración: {self.roulette.name}"

    def clean(self):
        if self.max_participants < 0:
            raise ValidationError({"max_participants": "No puede ser negativo"})


class DrawHistory(models.Model):
    roulette = models.ForeignKey(Roulette, on_delete=models.CASCADE, related_name="draw_history")
    winner_selected = models.ForeignKey(
        Participation, on_delete=models.SET_NULL, null=True, related_name="draw_history"
    )
    drawn_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name="draws_made")
    draw_type = models.CharField(max_length=20, choices=DrawType.choices, default=DrawType.MANUAL)
    drawn_at = models.DateTimeField(default=timezone.now, db_index=True)
    participants_count = models.PositiveIntegerField(default=0)
    random_seed = models.CharField(max_length=64, blank=True, default="")
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["-drawn_at"]

    def __str__(self) -> str:
        return f"[{self.drawn_at:%Y-%m-%d %H:%M}] {self.roulette.name}"


class RoulettePrize(models.Model):
    roulette = models.ForeignKey(Roulette, on_delete=models.CASCADE, related_name="prizes")
    name = models.CharField(max_length=120, db_index=True)
    description = models.TextField(blank=True, default="")
    image = models.ImageField(upload_to=prize_image_upload_path, blank=True, null=True)
    
    pickup_instructions = models.TextField(
        blank=True, 
        default="",
        verbose_name="Instrucciones de retiro",
        help_text="Información sobre cómo y dónde retirar el premio"
    )
    
    stock = models.PositiveIntegerField(default=1, validators=[MinValueValidator(0)])
    display_order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["display_order", "-created_at"]
        indexes = [
            models.Index(fields=["roulette", "is_active"]),
            models.Index(fields=["display_order"]),
        ]

    def __str__(self) -> str:
        return f"{self.name} ({self.roulette.name})"

    @property
    def is_available(self) -> bool:
        return bool(self.is_active and self.stock > 0)