# backend/authentication/admin.py
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.forms import UserChangeForm, UserCreationForm
from django.utils.html import format_html

from .models import User, UserProfile, PasswordResetRequest


# --------- Inlines ---------
class UserProfileInline(admin.StackedInline):
    model = UserProfile
    can_delete = False
    verbose_name_plural = "Información del Perfil"
    extra = 0
    fields = ("phone", "bio", "birth_date", "avatar", "terms_accepted_at")
    readonly_fields = ("terms_accepted_at",)


# --------- Forms ---------
class CustomUserChangeForm(UserChangeForm):
    class Meta(UserChangeForm.Meta):
        model = User


class CustomUserCreationForm(UserCreationForm):
    class Meta(UserCreationForm.Meta):
        model = User
        fields = ("username", "email", "first_name", "last_name")


# --------- Filtros personalizados ---------
class TermsAcceptedFilter(admin.SimpleListFilter):
    title = "Términos aceptados"
    parameter_name = "terms_accepted"

    def lookups(self, request, model_admin):
        return (
            ("yes", "Sí"),
            ("no", "No"),
        )

    def queryset(self, request, queryset):
        val = self.value()
        if val == "yes":
            return queryset.filter(profile__terms_accepted_at__isnull=False)
        if val == "no":
            return queryset.filter(profile__terms_accepted_at__isnull=True)
        return queryset


# --------- User Admin ---------
@admin.register(User)
class UserAdmin(BaseUserAdmin):
    """RF1.2: Gestión de roles de Administrador y Usuario"""
    form = CustomUserChangeForm
    add_form = CustomUserCreationForm
    inlines = [UserProfileInline]

    list_display = [
        "email",
        "username",
        "get_full_name",
        "role",
        "get_phone",
        "is_active",
        "is_email_verified",
        "notification_status",
        "has_accepted_terms",
        "created_at",
        "last_login",
    ]
    search_fields = ["email", "username", "first_name", "last_name", "profile__phone"]
    list_filter = [
        "role",
        "is_active",
        "is_email_verified",
        "is_staff",
        "is_superuser",
        "notify_new_roulettes",
        "receive_notifications",
        "created_at",
        TermsAcceptedFilter,
    ]
    ordering = ["-created_at"]
    readonly_fields = ["created_at", "updated_at", "last_login", "date_joined"]

    fieldsets = (
        (
            "Información Personal",
            {
                "fields": ("username", "email", "first_name", "last_name"),
            },
        ),
        (
            "Permisos y Rol",
            {
                "fields": ("role", "is_active", "is_staff", "is_superuser", "is_email_verified"),
            },
        ),
        (
            "Preferencias de Notificaciones",
            {
                "fields": ("notify_new_roulettes", "receive_notifications"),
                "classes": ("collapse",),
            },
        ),
        (
            "Grupos y Permisos Específicos",
            {
                "fields": ("groups", "user_permissions"),
                "classes": ("collapse",),
            },
        ),
        (
            "Fechas Importantes",
            {
                "fields": ("last_login", "date_joined", "created_at", "updated_at"),
                "classes": ("collapse",),
            },
        ),
    )
    add_fieldsets = (
        (
            "Información Básica",
            {
                "classes": ("wide",),
                "fields": ("username", "email", "first_name", "last_name", "password1", "password2"),
            },
        ),
        (
            "Configuración Inicial", 
            {
                "fields": ("role", "is_active", "notify_new_roulettes", "receive_notifications")
            }
        ),
    )
    list_display_links = ["email", "username"]
    list_per_page = 25

    def get_full_name(self, obj):
        return f"{obj.first_name} {obj.last_name}".strip() or "Sin nombre"

    get_full_name.short_description = "Nombre Completo"

    def get_phone(self, obj):
        try:
            return obj.profile.phone or format_html('<span style="color: #999;">Sin teléfono</span>')
        except UserProfile.DoesNotExist:
            return format_html('<span style="color: #999;">Sin teléfono</span>')

    get_phone.short_description = "Teléfono"
    
    def notification_status(self, obj):
        """Muestra el estado de las notificaciones del usuario"""
        notifications = []
        if obj.notify_new_roulettes:
            notifications.append("Ruletas")
        if obj.receive_notifications:
            notifications.append("Premios")
        
        if not notifications:
            return format_html('<span style="color: #999;">Ninguna</span>')
        
        return format_html('<span style="color: green;">{}</span>', " | ".join(notifications))
    
    notification_status.short_description = "Notificaciones Activas"

    def has_accepted_terms(self, obj):
        try:
            return obj.profile.terms_accepted_at is not None
        except UserProfile.DoesNotExist:
            return False

    has_accepted_terms.short_description = "Términos Aceptados"
    has_accepted_terms.boolean = True

    def get_queryset(self, request):
        # Optimiza el acceso a profile
        return super().get_queryset(request).select_related("profile")

    actions = [
        "make_admin", 
        "make_user", 
        "verify_email", 
        "unverify_email",
        "enable_all_notifications",
        "disable_roulette_notifications",
    ]

    def make_admin(self, request, queryset):
        updated = queryset.update(role="admin")
        self.message_user(request, f"{updated} usuarios convertidos a administradores.")

    make_admin.short_description = "Convertir en Administrador"

    def make_user(self, request, queryset):
        updated = queryset.update(role="user")
        self.message_user(request, f"{updated} usuarios convertidos a usuarios regulares.")

    make_user.short_description = "Convertir en Usuario Regular"

    def verify_email(self, request, queryset):
        updated = queryset.update(is_email_verified=True)
        self.message_user(request, f"{updated} emails verificados.")

    verify_email.short_description = "Verificar Email"

    def unverify_email(self, request, queryset):
        updated = queryset.update(is_email_verified=False)
        self.message_user(request, f"{updated} emails desverificados.")

    unverify_email.short_description = "Desverificar Email"
    
    def enable_all_notifications(self, request, queryset):
        """Habilita todas las notificaciones para los usuarios seleccionados"""
        updated = queryset.update(
            notify_new_roulettes=True,
            receive_notifications=True
        )
        self.message_user(request, f"Todas las notificaciones habilitadas para {updated} usuarios.")
    
    enable_all_notifications.short_description = "Habilitar todas las notificaciones"
    
    def disable_roulette_notifications(self, request, queryset):
        """Deshabilita notificaciones de nuevas ruletas"""
        updated = queryset.update(notify_new_roulettes=False)
        self.message_user(request, f"Notificaciones de ruletas deshabilitadas para {updated} usuarios.")
    
    disable_roulette_notifications.short_description = "Deshabilitar notificaciones de ruletas"


# --------- UserProfile Admin ---------
@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ["user", "phone", "birth_date", "has_avatar", "terms_accepted_display"]
    search_fields = ["user__email", "user__username", "phone"]
    list_filter = ["birth_date", "terms_accepted_at"]
    readonly_fields = ["user", "terms_accepted_at"]
    raw_id_fields = ("user",)

    fieldsets = (
        ("Usuario", {"fields": ("user",)}),
        ("Información de Contacto", {"fields": ("phone",)}),
        ("Información Personal", {"fields": ("bio", "birth_date", "avatar")}),
        (
            "Términos y Condiciones",
            {"fields": ("terms_accepted_at",), "classes": ("collapse",)},
        ),
    )

    def has_avatar(self, obj):
        return bool(obj.avatar)

    has_avatar.short_description = "Tiene Avatar"
    has_avatar.boolean = True

    def terms_accepted_display(self, obj):
        if obj.terms_accepted_at:
            return format_html(
                '<span style="color: green;">✓</span> {}',
                obj.terms_accepted_at.strftime("%d/%m/%Y %H:%M"),
            )
        return format_html('<span style="color: red;">✗</span> No aceptados')

    terms_accepted_display.short_description = "Términos Aceptados"


# --------- PasswordResetRequest Admin ---------
@admin.register(PasswordResetRequest)
class PasswordResetRequestAdmin(admin.ModelAdmin):
    """RF1.4: Monitoreo de solicitudes de restablecimiento"""
    list_display = [
        "user",
        "user_phone",
        "token_preview",
        "created_at",
        "expires_at",
        "is_used",
        "is_expired_now",
        "days_requests_count",
    ]
    search_fields = ["user__email", "user__username", "user__profile__phone", "token"]
    list_filter = ["is_used", "created_at", "expires_at"]
    readonly_fields = [
        "user",
        "token",
        "created_at",
        "expires_at",
        "is_expired_now",
        "is_valid_now",
        "days_requests_count",
    ]
    ordering = ["-created_at"]
    list_per_page = 50
    actions = ["mark_as_used"]

    def user_phone(self, obj):
        try:
            return obj.user.profile.phone
        except UserProfile.DoesNotExist:
            return format_html('<span style="color: #999;">Sin teléfono</span>')

    user_phone.short_description = "Teléfono del Usuario"

    def token_preview(self, obj):
        t = obj.token or ""
        if len(t) <= 12:
            return t
        return f"{t[:8]}...{t[-4:]}"

    token_preview.short_description = "Token"

    def is_expired_now(self, obj):
        return obj.is_expired()

    is_expired_now.short_description = "Expirado"
    is_expired_now.boolean = True

    def is_valid_now(self, obj):
        return obj.is_valid()

    is_valid_now.short_description = "Válido"
    is_valid_now.boolean = True

    def days_requests_count(self, obj):
        count = PasswordResetRequest.get_daily_requests_count(obj.user)
        if count >= 8:
            return format_html('<span style="color: red;">⚠ {}/10</span>', count)
        elif count >= 5:
            return format_html('<span style="color: orange;">• {}/10</span>', count)
        return f"{count}/10"

    days_requests_count.short_description = "Solicitudes Hoy"

    def get_queryset(self, request):
        return super().get_queryset(request).select_related("user__profile")

    def has_add_permission(self, request):
        return False

    def mark_as_used(self, request, queryset):
        updated = queryset.update(is_used=True)
        self.message_user(request, f"{updated} solicitudes marcadas como usadas.")

    mark_as_used.short_description = "Marcar como Usadas"