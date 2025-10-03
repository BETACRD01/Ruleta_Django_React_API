# backend/authentication/models.py

from datetime import timedelta

from django.contrib.auth.models import AbstractUser
from django.core.validators import RegexValidator
from django.db import models
from django.utils import timezone


class User(AbstractUser):
    """
    Usuario personalizado que extiende AbstractUser
    RF1.2: Roles de Administrador y Usuario
    """
    ROLE_CHOICES = [
        ("admin", "Administrador"),
        ("user", "Usuario"),
    ]

    email = models.EmailField(unique=True, verbose_name="Correo electrónico")
    role = models.CharField(
        max_length=10,
        choices=ROLE_CHOICES,
        default="user",
        verbose_name="Rol",
    )
    is_email_verified = models.BooleanField(default=False, verbose_name="Email verificado")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Fecha de creación")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Última actualización")
    
    # Preferencias de notificaciones
    receive_notifications = models.BooleanField(
        default=True,
        verbose_name="Recibir notificaciones",
        help_text="Desmarcar para no recibir emails de premios ganados"
    )
    
    notify_new_roulettes = models.BooleanField(
        default=True,
        verbose_name="Notificar nuevas ruletas",
        help_text="Recibir emails cuando se crean nuevas ruletas disponibles"
    )

    # Autenticación por email
    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username", "first_name", "last_name"]

    class Meta:
        verbose_name = "Usuario"
        verbose_name_plural = "Usuarios"

    def __str__(self) -> str:
        return f"{self.email} ({self.get_role_display()})"

    # Helpers
    def is_admin(self) -> bool:
        return self.role == "admin"

    def is_regular_user(self) -> bool:
        return self.role == "user"
    
    @property
    def has_any_notification_enabled(self) -> bool:
        """Verifica si el usuario tiene al menos una notificación activa"""
        return self.receive_notifications or self.notify_new_roulettes


class PasswordResetRequest(models.Model):
    """
    RF1.4: Recuperación de contraseña con límite de solicitudes
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, verbose_name="Usuario")
    token = models.CharField(max_length=100, unique=True, verbose_name="Token")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Fecha de creación")
    is_used = models.BooleanField(default=False, verbose_name="Usado")
    expires_at = models.DateTimeField(verbose_name="Fecha de expiración")

    class Meta:
        verbose_name = "Solicitud de restablecimiento"
        verbose_name_plural = "Solicitudes de restablecimiento"
        ordering = ["-created_at"]

    def save(self, *args, **kwargs):
        # Validez por defecto: 1 hora
        if not self.expires_at:
            self.expires_at = timezone.now() + timedelta(hours=1)
        super().save(*args, **kwargs)

    def is_expired(self) -> bool:
        return timezone.now() > self.expires_at

    def is_valid(self) -> bool:
        return not self.is_used and not self.is_expired()

    @staticmethod
    def get_daily_requests_count(user) -> int:
        today_start = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
        return PasswordResetRequest.objects.filter(
            user=user,
            created_at__gte=today_start,
        ).count()

    @staticmethod
    def can_request_reset(user) -> bool:
        # Máximo 10 por día
        return PasswordResetRequest.get_daily_requests_count(user) < 10


class UserProfile(models.Model):
    """
    Perfil extendido del usuario
    """

    # Validador Ecuador: +5939XXXXXXXX o 09XXXXXXXX
    phone_validator = RegexValidator(
        regex=r"^\+?[1-9]\d{7,14}$",
        message="Teléfono inválido. Usa formato internacional: +[código país][número], ej. +14155552671.",
    )

    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="profile",
        verbose_name="Usuario",
    )
    phone = models.CharField(
        max_length=13,  # +5939XXXXXXXX (13)
        validators=[phone_validator],
        unique=True,
        verbose_name="Teléfono",
        help_text="Formato válido: +5939XXXXXXXX o 09XXXXXXXX",
        blank=True,
        null=True,
    )
    avatar = models.ImageField(
        upload_to="avatars/",
        blank=True,
        null=True,
        verbose_name="Avatar",
    )
    bio = models.TextField(max_length=500, blank=True, verbose_name="Biografía")
    birth_date = models.DateField(blank=True, null=True, verbose_name="Fecha de nacimiento")

    # Campo opcional para registrar aceptación de TyC.
    terms_accepted_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Términos aceptados",
        help_text="Fecha y hora cuando el usuario aceptó los términos y condiciones",
    )

    class Meta:
        verbose_name = "Perfil de usuario"
        verbose_name_plural = "Perfiles de usuarios"

    def __str__(self) -> str:
        return f"Perfil de {self.user.email}"