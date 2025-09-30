# participants/models.py

from django.db import models, transaction
from django.contrib.auth import get_user_model
from django.core.validators import FileExtensionValidator
from django.core.exceptions import ValidationError
from django.utils.translation import gettext_lazy as _
import os

User = get_user_model()


def receipt_upload_path(instance, filename):
    """
    Ruta de guardado del comprobante.
    Estructura: receipts/<user_id>/<roulette_id>/<filename>
    """
    user_id = instance.user_id or "unknown_user"
    roulette_id = instance.roulette_id or "unknown_roulette"
    # Evitar rutas raras
    filename = os.path.basename(filename)
    return f"receipts/{user_id}/{roulette_id}/{filename}"


class Participation(models.Model):
    """
    Participación de un usuario en una ruleta.

    Compatibilidad con el front:
    - Campos usados por UI/APIs: id, user, roulette, receipt, participant_number,
      created_at, is_winner, won_prize, prize_position.
    - El serializer puede exponer "user_name" derivado del usuario (p.ej. get_full_name).
    """

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="participations",
        verbose_name=_("Usuario"),
    )
    roulette = models.ForeignKey(
        "roulettes.Roulette",
        on_delete=models.CASCADE,
        related_name="participations",
        verbose_name=_("Ruleta"),
    )
    receipt = models.FileField(
        upload_to=receipt_upload_path,
        validators=[
            FileExtensionValidator(allowed_extensions=["jpg", "jpeg", "png", "pdf"])
        ],
        verbose_name=_("Comprobante"),
        help_text=_("Formatos permitidos: JPG, JPEG, PNG, PDF"),
    )
    participant_number = models.PositiveIntegerField(
        verbose_name=_("Número de Participante"),
        help_text=_("Número secuencial del participante dentro de esta ruleta"),
        editable=False,
        db_index=True,
    )
    created_at = models.DateTimeField(
        auto_now_add=True, verbose_name=_("Fecha de Participación"), db_index=True
    )
    is_winner = models.BooleanField(
        default=False,
        verbose_name=_("Es Ganador"),
        help_text=_("Indica si esta participación resultó ganadora"),
        db_index=True,
    )

    # CAMPOS PARA EL PREMIO GANADO
    won_prize = models.ForeignKey(
        "roulettes.RoulettePrize",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="won_participations",
        verbose_name=_("Premio Ganado"),
        help_text=_("Premio específico que ganó este participante")
    )
    
    prize_position = models.PositiveIntegerField(
        null=True,
        blank=True,
        verbose_name=_("Posición del Premio"),
        help_text=_("Posición del premio ganado (1°, 2°, 3°, etc.)")
    )

    won_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name=_("Fecha de Victoria"),
        help_text=_("Momento exacto en que ganó el sorteo")
    )

    class Meta:
        verbose_name = _("Participación")
        verbose_name_plural = _("Participaciones")
        ordering = ["participant_number"]
        indexes = [
            models.Index(fields=["roulette", "created_at"]),
            models.Index(fields=["user", "created_at"]),
            models.Index(fields=["roulette", "is_winner"]),
            models.Index(fields=["won_prize"]),
            models.Index(fields=["won_at"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "roulette"],
                name="unique_participation_per_user_and_roulette",
            ),
            models.UniqueConstraint(
                fields=["roulette", "participant_number"],
                name="unique_participant_number_per_roulette",
            ),
        ]

    def __str__(self):
        display_user = getattr(self.user, "get_full_name", lambda: "")() or self.user.username
        roulette_name = getattr(self.roulette, "name", str(self.roulette))
        winner_str = " ⭐ GANADOR" if self.is_winner else ""
        return f"{display_user} - {roulette_name} (#{self.participant_number}){winner_str}"

    def clean(self):
        """
        Validaciones de dominio simples.
        """
        if hasattr(self.roulette, "is_drawn") and self.roulette.is_drawn:
            raise ValidationError(
                {"roulette": _("La ruleta ya fue sorteada; no se aceptan nuevas participaciones.")}
            )

    def save(self, *args, **kwargs):
        """
        Asigna participant_number de forma segura evitando condiciones de carrera.
        """
        if self._state.adding and not self.participant_number:
            self.full_clean()

            with transaction.atomic():
                last = (
                    Participation.objects.select_for_update()
                    .filter(roulette=self.roulette)
                    .order_by("-participant_number")
                    .first()
                )
                self.participant_number = (last.participant_number + 1) if last else 1

        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        """
        Elimina el archivo usando la API de almacenamiento de Django (compatible con S3, etc.).
        """
        stored_file = self.receipt
        super().delete(*args, **kwargs)
        if stored_file:
            stored_file.delete(save=False)

    # --------- Helpers de archivo ---------
    @property
    def receipt_filename(self):
        """Nombre del archivo del comprobante"""
        return os.path.basename(self.receipt.name) if self.receipt else None

    @property
    def receipt_size(self):
        """Tamaño del archivo (bytes)"""
        try:
            return self.receipt.size if self.receipt else 0
        except Exception:
            return 0

    @property
    def receipt_extension(self):
        """Extensión del archivo (e.g. .pdf)"""
        return os.path.splitext(self.receipt.name)[1].lower() if self.receipt else None

    @property
    def is_from_drawn_roulette(self):
        """True si la ruleta ya fue sorteada"""
        return bool(getattr(self.roulette, "is_drawn", False))

    # --------- Helpers de premio ---------
    @property
    def prize_name(self):
        """Nombre del premio ganado"""
        return self.won_prize.name if self.won_prize else None

    @property
    def prize_description(self):
        """Descripción del premio ganado"""
        return self.won_prize.description if self.won_prize else None

    @property
    def prize_image_url(self):
        """URL de la imagen del premio (path relativo)"""
        if self.won_prize and self.won_prize.image:
            try:
                return self.won_prize.image.url
            except Exception:
                return None
        return None