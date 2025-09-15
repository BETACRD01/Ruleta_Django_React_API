# backend/authentication/admin.py
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.forms import UserChangeForm, UserCreationForm

from .models import User, UserProfile, PasswordResetRequest


class UserProfileInline(admin.StackedInline):
    model = UserProfile
    can_delete = False
    verbose_name_plural = 'Información del Perfil'
    extra = 0


class CustomUserChangeForm(UserChangeForm):
    class Meta(UserChangeForm.Meta):
        model = User


class CustomUserCreationForm(UserCreationForm):
    class Meta(UserCreationForm.Meta):
        model = User
        fields = ('username', 'email', 'first_name', 'last_name')


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    """RF1.2: Gestión de roles de Administrador y Usuario"""
    form = CustomUserChangeForm
    add_form = CustomUserCreationForm
    inlines = [UserProfileInline]

    list_display = [
        'email', 'username', 'get_full_name', 'role',
        'is_active', 'is_email_verified', 'created_at', 'last_login'
    ]
    search_fields = ['email', 'username', 'first_name', 'last_name']
    list_filter = [
        'role', 'is_active', 'is_email_verified',
        'is_staff', 'is_superuser', 'created_at'
    ]
    ordering = ['-created_at']
    readonly_fields = ['created_at', 'updated_at', 'last_login', 'date_joined']

    fieldsets = (
        ('Información Personal', {
            'fields': ('username', 'email', 'first_name', 'last_name')
        }),
        ('Permisos y Role', {
            'fields': ('role', 'is_active', 'is_staff', 'is_superuser', 'is_email_verified')
        }),
        ('Grupos y Permisos Específicos', {
            'fields': ('groups', 'user_permissions'),
            'classes': ('collapse',)
        }),
        ('Fechas Importantes', {
            'fields': ('last_login', 'date_joined', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    add_fieldsets = (
        ('Información Básica', {
            'classes': ('wide',),
            'fields': ('username', 'email', 'first_name', 'last_name', 'password1', 'password2'),
        }),
        ('Configuración Inicial', {'fields': ('role', 'is_active')}),
    )
    list_display_links = ['email', 'username']
    list_per_page = 25

    def get_full_name(self, obj):
        return f"{obj.first_name} {obj.last_name}".strip() or "Sin nombre"
    get_full_name.short_description = 'Nombre Completo'

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('profile')

    actions = ['make_admin', 'make_user', 'verify_email', 'unverify_email']

    def make_admin(self, request, queryset):
        updated = queryset.update(role='admin')
        self.message_user(request, f'{updated} usuarios convertidos a administradores.')
    make_admin.short_description = 'Convertir en Administrador'

    def make_user(self, request, queryset):
        updated = queryset.update(role='user')
        self.message_user(request, f'{updated} usuarios convertidos a usuarios regulares.')
    make_user.short_description = 'Convertir en Usuario Regular'

    def verify_email(self, request, queryset):
        updated = queryset.update(is_email_verified=True)
        self.message_user(request, f'{updated} emails verificados.')
    verify_email.short_description = 'Verificar Email'

    def unverify_email(self, request, queryset):
        updated = queryset.update(is_email_verified=False)
        self.message_user(request, f'{updated} emails desverificados.')
    unverify_email.short_description = 'Desverificar Email'


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ['user', 'phone', 'birth_date', 'has_avatar']
    search_fields = ['user__email', 'user__username', 'phone']
    list_filter = ['birth_date']
    readonly_fields = ['user']

    def has_avatar(self, obj):
        return bool(obj.avatar)
    has_avatar.short_description = 'Tiene Avatar'
    has_avatar.boolean = True


@admin.register(PasswordResetRequest)
class PasswordResetRequestAdmin(admin.ModelAdmin):
    """RF1.4: Monitoreo de solicitudes de restablecimiento"""
    list_display = [
        'user', 'token_preview', 'created_at', 'expires_at',
        'is_used', 'is_expired_now', 'days_requests_count'
    ]
    search_fields = ['user__email', 'user__username', 'token']
    list_filter = ['is_used', 'created_at', 'expires_at']
    readonly_fields = [
        'user', 'token', 'created_at', 'expires_at',
        'is_expired_now', 'is_valid_now', 'days_requests_count'
    ]
    ordering = ['-created_at']
    list_per_page = 50
    actions = ['mark_as_used']

    def token_preview(self, obj):
        return f"{obj.token[:8]}...{obj.token[-4:]}"
    token_preview.short_description = 'Token'

    def is_expired_now(self, obj):
        return obj.is_expired()
    is_expired_now.short_description = 'Expirado'
    is_expired_now.boolean = True

    def is_valid_now(self, obj):
        return obj.is_valid()
    is_valid_now.short_description = 'Válido'
    is_valid_now.boolean = True

    def days_requests_count(self, obj):
        count = PasswordResetRequest.get_daily_requests_count(obj.user)
        if count >= 8:
            return f"⚠ {count}/10"
        elif count >= 5:
            return f"• {count}/10"
        return f"{count}/10"
    days_requests_count.short_description = 'Solicitudes Hoy'

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('user')

    def has_add_permission(self, request):
        return False

    def mark_as_used(self, request, queryset):
        updated = queryset.update(is_used=True)
        self.message_user(request, f'{updated} solicitudes marcadas como usadas.')
    mark_as_used.short_description = 'Marcar como Usadas'
