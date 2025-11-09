# participants/models.py

from django.db import models, transaction
from django.contrib.auth import get_user_model
from django.core.validators import FileExtensionValidator
from django.core.exceptions import ValidationError
from django.utils.translation import gettext_lazy as _
import logging
import os

User = get_user_model()
logger = logging.getLogger(__name__)
# ============================================================================
# FUNCIONES AUXILIARES
# ============================================================================

def receipt_upload_path(instance, filename):
    """
    Define la ruta de almacenamiento del comprobante.
    
    Estructura: receipts/<user_id>/<roulette_id>/<filename>
    
    Esto permite:
    - Organizar archivos por usuario y ruleta
    - Evitar conflictos de nombres
    - Facilitar limpieza de archivos antiguos
    """
    user_id = instance.user_id or "unknown_user"
    roulette_id = instance.roulette_id or "unknown_roulette"
    filename = os.path.basename(filename)  # Evitar rutas raras
    return f"receipts/{user_id}/{roulette_id}/{filename}"


# ============================================================================
# MODELO PRINCIPAL
# ============================================================================

class Participation(models.Model):
    """
    Representa la participación de un usuario en una ruleta.
    
    Responsabilidades:
    - Vincular usuario con ruleta
    - Asignar número de participante (secuencial)
    - Almacenar comprobante si es requerido
    - Registrar premios ganados
    - Mantener estado de ganador
    
    Restricciones:
    - Un usuario solo puede participar una vez por ruleta (UNIQUE)
    - Números de participante son únicos por ruleta
    """

    # ========================================================================
    # CAMPOS DE RELACIÓN
    # ========================================================================

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="participations",
        verbose_name=_("Usuario"),
        help_text=_("Usuario que participa en la ruleta"),
    )
    
    roulette = models.ForeignKey(
        "roulettes.Roulette",
        on_delete=models.CASCADE,
        related_name="participations",
        verbose_name=_("Ruleta"),
        help_text=_("Ruleta en la que participa"),
    )

    # ========================================================================
    # CAMPOS DE PARTICIPACIÓN
    # ========================================================================

    receipt = models.FileField(
        upload_to=receipt_upload_path,
        validators=[
            FileExtensionValidator(allowed_extensions=["jpg", "jpeg", "png", "pdf"])
        ],
        verbose_name=_("Comprobante"),
        help_text=_("Formatos permitidos: JPG, JPEG, PNG, PDF"),
        blank=True,
        null=True,
    )
    
    participant_number = models.PositiveIntegerField(
        verbose_name=_("Número de Participante"),
        help_text=_("Número secuencial único dentro de esta ruleta"),
        editable=False,
        db_index=True,
    )
    
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name=_("Fecha de Participación"),
        db_index=True,
        help_text=_("Momento exacto en que se registró la participación"),
    )

    # ========================================================================
    # CAMPOS DE RESULTADO
    # ========================================================================

    is_winner = models.BooleanField(
        default=False,
        verbose_name=_("Es Ganador"),
        help_text=_("Indica si esta participación resultó ganadora en el sorteo"),
        db_index=True,
    )

    won_prize = models.ForeignKey(
        "roulettes.RoulettePrize",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="won_participations",
        verbose_name=_("Premio Ganado"),
        help_text=_("Premio específico que ganó este participante"),
    )

    prize_position = models.PositiveIntegerField(
        null=True,
        blank=True,
        verbose_name=_("Posición del Premio"),
        help_text=_("Posición del premio (1°, 2°, 3°, etc.)"),
    )

    won_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name=_("Fecha de Victoria"),
        help_text=_("Momento exacto en que se ejecutó el sorteo"),
    )

    # ========================================================================
    # METADATOS
    # ========================================================================

    class Meta:
        verbose_name = _("Participación")
        verbose_name_plural = _("Participaciones")
        ordering = ["participant_number"]
        
        # Índices para optimizar queries frecuentes
        indexes = [
            models.Index(fields=["roulette", "created_at"]),
            models.Index(fields=["user", "created_at"]),
            models.Index(fields=["roulette", "is_winner"]),
            models.Index(fields=["won_prize"]),
            models.Index(fields=["won_at"]),
            models.Index(fields=["user", "roulette"]),
        ]
        
        # Restricciones de integridad
        constraints = [
            # Un usuario solo participa una vez por ruleta
            models.UniqueConstraint(
                fields=["user", "roulette"],
                name="unique_participation_per_user_and_roulette",
            ),
            # Números de participante únicos por ruleta
            models.UniqueConstraint(
                fields=["roulette", "participant_number"],
                name="unique_participant_number_per_roulette",
            ),
        ]

    def __str__(self):
        """Representación legible del modelo"""
        display_user = (
            getattr(self.user, "get_full_name", lambda: "")() 
            or self.user.username
        )
        roulette_name = getattr(self.roulette, "name", str(self.roulette))
        winner_str = " ⭐ GANADOR" if self.is_winner else ""
        return f"{display_user} - {roulette_name} (#{self.participant_number}){winner_str}"

    # ========================================================================
    # VALIDACIONES
    # ========================================================================

    def clean(self):
        """
        Validaciones de dominio del modelo.
        Ejecutado antes de guardar para garantizar integridad de datos.
        
        Valida:
        1. Ruleta no esté sorteada
        2. Comprobante requerido según configuración
        """
        
        # Validación 1: Ruleta no debe estar sorteada
        if hasattr(self.roulette, "is_drawn") and self.roulette.is_drawn:
            raise ValidationError(
                {"roulette": _("La ruleta ya fue sorteada; no se aceptan nuevas participaciones.")}
            )

        # Validación 2: Comprobante según configuración de ruleta
        if self.roulette:
            from roulettes.models import RouletteSettings
            
            try:
                settings = self.roulette.settings
            except RouletteSettings.DoesNotExist:
                # Crear settings con defaults si no existen
                logger.warning(f"Ruleta {self.roulette.id} sin settings, creando...")
                settings, _ = RouletteSettings.objects.get_or_create(
                    roulette=self.roulette,
                    defaults={
                        'max_participants': 0,
                        'allow_multiple_entries': False,
                        'show_countdown': True,
                        'notify_on_participation': True,
                        'notify_on_draw': True,
                        'winners_target': 0,
                        'require_receipt': True,
                    }
                )
            
            # Obtener configuración
            require_receipt = bool(getattr(settings, 'require_receipt', True))
            
            logger.info(
                f"🔍 Validación Participation: require_receipt={require_receipt}, "
                f"has_receipt={bool(self.receipt)}"
            )
            
            # Exigir comprobante solo si require_receipt=True
            if require_receipt and not self.receipt:
                raise ValidationError({
                    'receipt': _('El comprobante es requerido para participar en esta ruleta.')
                })
            
            # Registrar si comprobante no es requerido
            if not require_receipt and not self.receipt:
                logger.info("✅ Comprobante no requerido - participación permitida sin archivo")

    # ========================================================================
    # MÉTODOS DE GUARDADO Y ELIMINACIÓN
    # ========================================================================

    def save(self, *args, **kwargs):
        """
        Guarda la participación con lógica adicional.
        
        Responsabilidades:
        1. Validar antes de guardar (full_clean)
        2. Asignar participant_number de forma segura
        3. Guardar en base de datos
        """
        
        # PASO 1: Validar antes de guardar
        self.full_clean()

        # PASO 2: Asignar participant_number si es nuevo registro
        if self._state.adding and not self.participant_number:
            with transaction.atomic():
                # Bloquear para evitar condición de carrera
                last = (
                    Participation.objects
                    .select_for_update()
                    .filter(roulette=self.roulette)
                    .order_by("-participant_number")
                    .first()
                )
                # Incrementar número o comenzar en 1
                self.participant_number = (
                    (last.participant_number + 1) if last else 1
                )

        # PASO 3: Guardar en base de datos
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        """
        Elimina la participación y su archivo asociado.
        Django no elimina archivos automáticamente.
        """
        stored_file = self.receipt
        super().delete(*args, **kwargs)
        if stored_file:
            stored_file.delete(save=False)

    # ========================================================================
    # PROPIEDADES DERIVADAS (read-only)
    # ========================================================================

    @property
    def receipt_filename(self):
        """Nombre del archivo del comprobante"""
        return os.path.basename(self.receipt.name) if self.receipt else None

    @property
    def receipt_size(self):
        """Tamaño del archivo en bytes"""
        try:
            return self.receipt.size if self.receipt else 0
        except Exception:
            return 0

    @property
    def receipt_extension(self):
        """Extensión del archivo (e.g., .pdf, .jpg)"""
        return os.path.splitext(self.receipt.name)[1].lower() if self.receipt else None

    @property
    def is_from_drawn_roulette(self):
        """True si la ruleta ya fue sorteada"""
        return bool(getattr(self.roulette, "is_drawn", False))

    @property
    def prize_name(self):
        """Nombre del premio ganado (si aplica)"""
        return self.won_prize.name if self.won_prize else None

    @property
    def prize_description(self):
        """Descripción del premio ganado (si aplica)"""
        return self.won_prize.description if self.won_prize else None

    @property
    def prize_image_url(self):
        """URL de la imagen del premio ganado (si aplica)"""
        if self.won_prize and self.won_prize.image:
            try:
                return self.won_prize.image.url
            except Exception:
                return None
        return None