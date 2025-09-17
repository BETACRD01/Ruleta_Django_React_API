from django.db import models, transaction
from django.utils import timezone
from django.core.exceptions import ValidationError
from django.contrib.auth import get_user_model
from django.core.validators import MinValueValidator, MaxValueValidator
from django.utils.text import slugify
from participants.models import Participation
import uuid
import hashlib
import logging
import importlib

User = get_user_model()
logger = logging.getLogger(__name__)

# Importación dinámica para CKEditor compatible con Django 5.2.6
def get_rich_text_field():
    """Importa CKEditor dinámicamente o usa TextField como fallback"""
    try:
        # Intentar con django-ckeditor-5 (más moderno y compatible con Django 5.2.6)
        ckeditor_module = importlib.import_module('django_ckeditor_5.fields')
        return ckeditor_module.CKEditor5Field, True
    except ImportError:
        try:
            # Fallback a ckeditor clásico
            ckeditor_module = importlib.import_module('ckeditor_uploader.fields')
            return ckeditor_module.RichTextUploadingField, True
        except ImportError:
            print("⚠️ CKEditor no encontrado. Usando TextField simple.")
            
            class RichTextUploadingField(models.TextField):
                def __init__(self, config_name=None, **kwargs):
                    # Ignorar parámetros específicos de CKEditor
                    kwargs.pop('config_name', None)
                    super().__init__(**kwargs)
            
            return RichTextUploadingField, False

# Obtener el campo apropiado
RichTextUploadingField, CKEDITOR_AVAILABLE = get_rich_text_field()


class RouletteStatus(models.TextChoices):
    DRAFT = 'draft', 'Borrador'
    ACTIVE = 'active', 'Activa'
    SCHEDULED = 'scheduled', 'Programada'
    COMPLETED = 'completed', 'Completada'
    CANCELLED = 'cancelled', 'Cancelada'


class DrawType(models.TextChoices):
    MANUAL = 'manual', 'Manual'
    SCHEDULED = 'scheduled', 'Programado'
    AUTO = 'auto', 'Automático'
    ADMIN = 'admin', 'Admin'


def prize_image_upload_path(instance, filename):
    """Path optimizado para imágenes de premios"""
    ext = filename.split('.')[-1].lower()
    new_filename = f"{uuid.uuid4().hex}.{ext}"
    return f'roulette_prizes/{instance.roulette_id}/{new_filename}'


def roulette_cover_upload_path(instance, filename):
    """Path optimizado para portadas con UUID único"""
    ext = filename.split('.')[-1].lower()
    new_filename = f"{uuid.uuid4().hex}.{ext}"
    return f'roulette_covers/{instance.id or uuid.uuid4().hex}/{new_filename}'


class RouletteQuerySet(models.QuerySet):
    """Custom QuerySet con métodos útiles"""
    
    def active(self):
        return self.filter(status=RouletteStatus.ACTIVE)
    
    def completed(self):
        return self.filter(status=RouletteStatus.COMPLETED)
    
    def drawable(self):
        """Ruletas que pueden ser sorteadas"""
        return self.filter(
            status__in=[RouletteStatus.ACTIVE, RouletteStatus.SCHEDULED],
            is_drawn=False,
            participations__isnull=False
        ).distinct()
    
    def with_participants_count(self):
        """Anota el conteo de participantes"""
        return self.annotate(
            participants_count=models.Count('participations', distinct=True)
        )


class RouletteManager(models.Manager):
    """Manager personalizado"""
    
    def get_queryset(self):
        return RouletteQuerySet(self.model, using=self._db)
    
    def active(self):
        return self.get_queryset().active()
    
    def drawable(self):
        return self.get_queryset().drawable()


class Roulette(models.Model):
    """Modelo principal de Ruleta con todas las funcionalidades requeridas"""
    
    # Información básica
    name = models.CharField(
        max_length=150, 
        db_index=True,
        verbose_name="Título de la Ruleta",
        help_text="Nombre descriptivo de la ruleta"
    )
    
    # Slug para URLs amigables
    slug = models.SlugField(max_length=160, unique=True, blank=True)
    
    # Descripción enriquecida con CKEditor
    description = RichTextUploadingField(
        blank=True,
        default='',
        verbose_name="Descripción",
        help_text='Descripción detallada de la ruleta. Puedes usar negrita, enlaces, imágenes, listas, etc.' + 
                 (' (Editor enriquecido disponible)' if CKEDITOR_AVAILABLE else ' (Texto simple)'),
        config_name='roulette_editor' if CKEDITOR_AVAILABLE else None
    )

    # Imagen de portada
    cover_image = models.ImageField(
        upload_to=roulette_cover_upload_path,
        blank=True,
        null=True,
        verbose_name="Imagen de Portada",
        help_text='Imagen principal que representa la ruleta (recomendado: 800x400px)'
    )

    # Estado de la ruleta
    status = models.CharField(
        max_length=12,
        choices=RouletteStatus.choices,
        default=RouletteStatus.DRAFT,
        db_index=True,
        verbose_name="Estado",
        help_text="Estado actual de la ruleta"
    )
    
    # Creador
    created_by = models.ForeignKey(
        User, 
        on_delete=models.SET_NULL,
        null=True,
        related_name='roulettes_created',
        db_index=True,
        verbose_name="Creado por"
    )

    # Fechas y horarios mejorados
    participation_start = models.DateTimeField(
        null=True, 
        blank=True,
        verbose_name="Inicio de Participación",
        help_text="Fecha y hora desde cuando los usuarios pueden participar"
    )
    
    participation_end = models.DateTimeField(
        null=True, 
        blank=True,
        verbose_name="Fin de Participación", 
        help_text="Fecha y hora límite para participar"
    )
    
    scheduled_date = models.DateTimeField(
        null=True, 
        blank=True, 
        verbose_name="Fecha Programada del Sorteo",
        help_text="Fecha y hora exacta del sorteo automático",
        db_index=True
    )
    
    # Resultado del sorteo
    drawn_at = models.DateTimeField(
        null=True, 
        blank=True, 
        db_index=True,
        verbose_name="Sorteado en"
    )
    drawn_by = models.ForeignKey(
        User, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='roulettes_drawn',
        verbose_name="Sorteado por"
    )
    
    # Participación ganadora
    winner = models.ForeignKey(
        Participation, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='won_roulettes',
        verbose_name="Ganador"
    )
    is_drawn = models.BooleanField(default=False, db_index=True)

    # Metadatos
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Managers
    objects = RouletteManager()

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Ruleta'
        verbose_name_plural = 'Ruletas'
        indexes = [
            models.Index(fields=['status', 'is_drawn']),
            models.Index(fields=['scheduled_date', 'status']),
            models.Index(fields=['participation_start', 'participation_end']),
        ]

    def __str__(self):
        return f"{self.name} ({self.get_status_display()})"

    def save(self, *args, **kwargs):
        # Auto-generar slug si no existe
        if not self.slug:
            base_slug = slugify(self.name)
            slug = base_slug
            counter = 1
            while Roulette.objects.filter(slug=slug).exclude(pk=self.pk).exists():
                slug = f"{base_slug}-{counter}"
                counter += 1
            self.slug = slug
        
        # Lógica de estado automático
        if self.winner and not self.is_drawn:
            self.is_drawn = True
            if not self.drawn_at:
                self.drawn_at = timezone.now()
            if self.status != RouletteStatus.COMPLETED:
                self.status = RouletteStatus.COMPLETED
        
        super().save(*args, **kwargs)

    def clean(self):
        """Validaciones mejoradas"""
        errors = {}
        now = timezone.now()
        
        # Validar fechas de participación
        if self.participation_start and self.participation_end:
            if self.participation_start >= self.participation_end:
                errors['participation_end'] = 'La fecha de fin debe ser posterior al inicio.'
        
        # Validar fecha programada
        if self.scheduled_date:
            if self.scheduled_date <= now:
                errors['scheduled_date'] = 'La fecha programada debe ser futura.'
            
            # La fecha programada debe ser después del fin de participación
            if self.participation_end and self.scheduled_date <= self.participation_end:
                errors['scheduled_date'] = 'El sorteo debe ser después del fin de participación.'
        
        if errors:
            raise ValidationError(errors)

    # Métodos de participantes
    def get_participants_count(self) -> int:
        """Conteo optimizado de participantes"""
        if hasattr(self, '_participants_count'):
            return self._participants_count
        return self.participations.count()

    def get_participants_list(self):
        """Lista optimizada de participantes"""
        return self.participations.select_related('user').order_by('participant_number')

    # Propiedades de estado
    @property
    def can_be_drawn_manually(self) -> bool:
        """Verifica si se puede sortear manualmente"""
        if self.is_drawn or self.status == RouletteStatus.COMPLETED:
            return False
        return self.participations.exists()
    
    @property
    def is_scheduled_ready(self) -> bool:
        """Verifica si está lista para sorteo programado"""
        if not self.scheduled_date:
            return False
        return (
            timezone.now() >= self.scheduled_date and 
            not self.is_drawn and 
            self.status in [RouletteStatus.ACTIVE, RouletteStatus.SCHEDULED]
        )
    
    @property
    def participation_is_open(self) -> bool:
        """Verifica si está abierta la participación"""
        now = timezone.now()
        
        # Verificar estado
        if self.status not in [RouletteStatus.ACTIVE, RouletteStatus.SCHEDULED]:
            return False
        
        # Verificar si ya fue sorteada
        if self.is_drawn:
            return False
        
        # Verificar fechas
        if self.participation_start and now < self.participation_start:
            return False
            
        if self.participation_end and now > self.participation_end:
            return False
            
        return True

    @property
    def participants_count(self) -> int:
        """Alias para get_participants_count()"""
        return self.get_participants_count()

    # Métodos de negocio
    def can_participate(self, user) -> tuple[bool, str]:
        """Verifica si un usuario puede participar"""
        if not self.participation_is_open:
            if self.is_drawn:
                return False, "El sorteo ya fue realizado"
            elif self.status not in [RouletteStatus.ACTIVE, RouletteStatus.SCHEDULED]:
                return False, "La ruleta no está disponible para participación"
            else:
                now = timezone.now()
                if self.participation_start and now < self.participation_start:
                    return False, f"La participación inicia el {self.participation_start.strftime('%d/%m/%Y %H:%M')}"
                elif self.participation_end and now > self.participation_end:
                    return False, "El período de participación ha terminado"
        
        settings = getattr(self, 'settings', None)
        if not settings:
            return False, "Configuración faltante"
        
        current_count = self.participations.count()
        if settings.max_participants > 0 and current_count >= settings.max_participants:
            return False, "Se alcanzó el límite de participantes"
        
        if not settings.allow_multiple_entries:
            if self.participations.filter(user=user).exists():
                return False, "Ya estás participando en esta ruleta"
        
        return True, "OK"

    @transaction.atomic
    def draw_winner(self, drawn_by_user=None, draw_type=DrawType.MANUAL):
        """Método mejorado para sortear ganador"""
        if not self.can_be_drawn_manually:
            raise ValidationError("No se puede realizar el sorteo")
        
        participants = list(self.participations.select_related('user'))
        if not participants:
            raise ValidationError("No hay participantes")
        
        # Generar semilla reproducible
        import random
        seed_data = f"{self.id}-{timezone.now().isoformat()}"
        seed = hashlib.sha256(seed_data.encode()).hexdigest()
        random.seed(seed)
        
        winner_participation = random.choice(participants)
        
        # Actualizar estado
        self.winner = winner_participation
        self.drawn_by = drawn_by_user
        self.drawn_at = timezone.now()
        self.is_drawn = True
        self.status = RouletteStatus.COMPLETED
        self.save()
        
        # Crear historial
        DrawHistory.objects.create(
            roulette=self,
            winner_selected=winner_participation,
            drawn_by=drawn_by_user,
            draw_type=draw_type,
            participants_count=len(participants),
            random_seed=seed
        )
        
        logger.info(f"Ruleta {self.name} sorteada. Ganador: {winner_participation}")
        return winner_participation


class RouletteSettings(models.Model):
    """Configuración detallada de la ruleta"""
    
    roulette = models.OneToOneField(
        Roulette, 
        on_delete=models.CASCADE, 
        related_name='settings'
    )
    
    # Límites de participación
    max_participants = models.PositiveIntegerField(
        default=0, 
        help_text='0 = sin límite',
        validators=[MinValueValidator(0)],
        verbose_name="Máximo de participantes"
    )
    allow_multiple_entries = models.BooleanField(
        default=False,
        verbose_name="Permitir múltiples participaciones",
        help_text="Permite que el mismo usuario participe varias veces"
    )
    
    # Configuración adicional
    auto_draw_when_full = models.BooleanField(
        default=False,
        verbose_name="Sortear automáticamente al llenarse",
        help_text='Ejecutar sorteo automático cuando se alcance el límite de participantes'
    )
    
    # Configuración de cronómetro/temporizador
    show_countdown = models.BooleanField(
        default=True,
        verbose_name="Mostrar cronómetro",
        help_text="Mostrar cuenta regresiva para el sorteo"
    )
    
    # Configuración de notificaciones
    notify_on_participation = models.BooleanField(
        default=True,
        verbose_name="Notificar nuevas participaciones"
    )
    
    notify_on_draw = models.BooleanField(
        default=True,
        verbose_name="Notificar resultado del sorteo"
    )

    def __str__(self):
        return f'Configuración: {self.roulette.name}'
    
    def clean(self):
        """Validaciones de configuración"""
        errors = {}
        
        if self.max_participants < 0:
            errors['max_participants'] = 'No puede ser negativo'
            
        if errors:
            raise ValidationError(errors)


class DrawHistory(models.Model):
    """Historial detallado de sorteos"""
    
    roulette = models.ForeignKey(
        Roulette, 
        on_delete=models.CASCADE, 
        related_name='draw_history'
    )
    winner_selected = models.ForeignKey(
        Participation, 
        on_delete=models.SET_NULL, 
        null=True, 
        related_name='draw_history'
    )
    drawn_by = models.ForeignKey(
        User, 
        on_delete=models.SET_NULL, 
        null=True, 
        related_name='draws_made'
    )
    draw_type = models.CharField(
        max_length=20, 
        choices=DrawType.choices,
        default=DrawType.MANUAL
    )
    drawn_at = models.DateTimeField(default=timezone.now, db_index=True)
    participants_count = models.PositiveIntegerField(default=0)
    random_seed = models.CharField(max_length=64, blank=True, default='')
    
    # Metadatos adicionales para auditoría
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True, default='')

    class Meta:
        ordering = ['-drawn_at']
        verbose_name = 'Historial de Sorteo'
        verbose_name_plural = 'Historial de Sorteos'

    def __str__(self):
        return f'[{self.drawn_at:%Y-%m-%d %H:%M}] {self.roulette.name}'


class RoulettePrize(models.Model):
    """Premios de la ruleta con soporte para múltiples premios e imágenes"""
    
    roulette = models.ForeignKey(
        Roulette, 
        on_delete=models.CASCADE, 
        related_name='prizes'
    )
    name = models.CharField(
        max_length=120, 
        db_index=True,
        verbose_name="Nombre del Premio"
    )
    description = models.TextField(
        blank=True, 
        default='',
        verbose_name="Descripción del Premio",
        help_text="Descripción detallada del premio"
    )
    image = models.ImageField(
        upload_to=prize_image_upload_path, 
        blank=True, 
        null=True,
        verbose_name="Imagen del Premio",
        help_text="Foto del premio (recomendado: 400x400px)"
    )
    
    # Inventario y probabilidades
    stock = models.PositiveIntegerField(
        default=1,
        validators=[MinValueValidator(0)],
        verbose_name="Stock disponible",
        help_text="Cantidad disponible de este premio"
    )
    probability = models.DecimalField(
        max_digits=5, 
        decimal_places=2, 
        default=0,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        help_text='Probabilidad 0-100% (opcional)',
        verbose_name="Probabilidad"
    )
    
    # Orden de visualización
    display_order = models.PositiveIntegerField(
        default=0,
        verbose_name="Orden de visualización",
        help_text="Orden en que se muestra el premio (menor número = primero)"
    )
    
    # Estado del premio
    is_active = models.BooleanField(
        default=True,
        verbose_name="Activo",
        help_text="Si está disponible para ser ganado"
    )
    
    # Metadatos
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['display_order', '-created_at']
        verbose_name = 'Premio de Ruleta'
        verbose_name_plural = 'Premios de Ruleta'
        indexes = [
            models.Index(fields=['roulette', 'is_active']),
            models.Index(fields=['display_order']),
        ]

    def __str__(self):
        return f'{self.name} ({self.roulette.name})'
    
    @property
    def is_available(self) -> bool:
        """Verifica si el premio está disponible"""
        return self.is_active and self.stock > 0