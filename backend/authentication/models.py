# backend/authentication/models.py

from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone
from datetime import timedelta

class User(AbstractUser):
    """
    Usuario personalizado que extiende AbstractUser
    Implementa RF1.2: Roles de Administrador y Usuario
    """
    ROLE_CHOICES = [
        ('admin', 'Administrador'),
        ('user', 'Usuario'),
    ]
    
    email = models.EmailField(unique=True, verbose_name="Correo electrónico")
    role = models.CharField(
        max_length=10, 
        choices=ROLE_CHOICES, 
        default='user',
        verbose_name="Rol"
    )
    is_email_verified = models.BooleanField(default=False, verbose_name="Email verificado")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Fecha de creación")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Última actualización")
    
    # Campo requerido para autenticación por email
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username', 'first_name', 'last_name']
    
    class Meta:
        verbose_name = "Usuario"
        verbose_name_plural = "Usuarios"
        
    def __str__(self):
        return f"{self.email} ({self.get_role_display()})"
    
    def is_admin(self):
        """Verifica si el usuario es administrador"""
        return self.role == 'admin'
    
    def is_regular_user(self):
        """Verifica si el usuario es un usuario regular"""
        return self.role == 'user'


class PasswordResetRequest(models.Model):
    """
    Modelo para manejar solicitudes de restablecimiento de contraseña
    Implementa RF1.4: Recuperación de contraseña con límite de solicitudes
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, verbose_name="Usuario")
    token = models.CharField(max_length=100, unique=True, verbose_name="Token")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Fecha de creación")
    is_used = models.BooleanField(default=False, verbose_name="Usado")
    expires_at = models.DateTimeField(verbose_name="Fecha de expiración")
    
    class Meta:
        verbose_name = "Solicitud de restablecimiento"
        verbose_name_plural = "Solicitudes de restablecimiento"
        ordering = ['-created_at']
    
    def save(self, *args, **kwargs):
        if not self.expires_at:
            # RF1.4.3: Validez de 1 hora
            self.expires_at = timezone.now() + timedelta(hours=1)
        super().save(*args, **kwargs)
    
    def is_expired(self):
        """Verifica si el token ha expirado"""
        return timezone.now() > self.expires_at
    
    def is_valid(self):
        """Verifica si el token es válido (no usado y no expirado)"""
        return not self.is_used and not self.is_expired()
    
    @staticmethod
    def get_daily_requests_count(user):
        """
        RF1.4.5: Cuenta las solicitudes del día actual para un usuario
        Máximo 10 solicitudes por día
        """
        today_start = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
        return PasswordResetRequest.objects.filter(
            user=user,
            created_at__gte=today_start
        ).count()
    
    @staticmethod
    def can_request_reset(user):
        """Verifica si el usuario puede solicitar otro restablecimiento"""
        return PasswordResetRequest.get_daily_requests_count(user) < 10


class UserProfile(models.Model):
    """
    Perfil extendido del usuario para información adicional
    """
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    phone = models.CharField(max_length=15, blank=True, null=True, verbose_name="Teléfono")
    avatar = models.ImageField(
        upload_to='avatars/', 
        blank=True, 
        null=True, 
        verbose_name="Avatar"
    )
    bio = models.TextField(max_length=500, blank=True, verbose_name="Biografía")
    birth_date = models.DateField(blank=True, null=True, verbose_name="Fecha de nacimiento")
    
    class Meta:
        verbose_name = "Perfil de usuario"
        verbose_name_plural = "Perfiles de usuarios"
    
    def __str__(self):
        return f"Perfil de {self.user.email}"