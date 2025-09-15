# participants/admin.py

from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from django.contrib.admin.utils import quote
from .models import Participation


def _admin_change_url(instance):
    """
    Devuelve la URL de cambio en admin para cualquier instancia de modelo,
    sin hardcodear 'app_label_model_change'.
    """
    opts = instance._meta
    return reverse(f"admin:{opts.app_label}_{opts.model_name}_change", args=[quote(instance.pk)])


@admin.register(Participation)
class ParticipationAdmin(admin.ModelAdmin):
    """
    Administración de participaciones
    """
    list_display = [
        "participant_number",
        "user_display",
        "roulette_display",
        "receipt_display",
        "created_at",
        "is_winner_display",
    ]

    list_filter = [
        "created_at",
        "is_winner",
        "roulette",
        # Solo funciona si el modelo Roulette tiene 'is_drawn'
        "roulette__is_drawn",
    ]

    search_fields = [
        "user__username",
        "user__first_name",
        "user__last_name",
        "user__email",
        "roulette__name",
    ]

    readonly_fields = [
        "participant_number",
        "created_at",
        "receipt_preview",
    ]

    list_per_page = 20
    date_hierarchy = "created_at"
    ordering = ["-created_at"]

    # Mejor UX y performance
    autocomplete_fields = ["user", "roulette"]
    list_select_related = ["user", "roulette"]

    fieldsets = (
        ("Información de Participación", {
            "fields": (
                "user",
                "roulette",
                "participant_number",
                "created_at",
            )
        }),
        ("Comprobante", {
            "fields": (
                "receipt",
                "receipt_preview",
            )
        }),
        ("Estado", {
            "fields": (
                "is_winner",
            )
        }),
    )

    def user_display(self, obj):
        """Mostrar información del usuario con link a su change en admin."""
        user_name = obj.user.get_full_name() or obj.user.username
        try:
            user_link = _admin_change_url(obj.user)
            return format_html('<a href="{}">{}</a>', user_link, user_name)
        except Exception:
            return user_name
    user_display.short_description = "Usuario"
    user_display.admin_order_field = "user__username"

    def roulette_display(self, obj):
        """Mostrar información de la ruleta con link a su change en admin."""
        name = getattr(obj.roulette, "name", str(obj.roulette))
        status = "🎲 Sorteada" if getattr(obj.roulette, "is_drawn", False) else "🟢 Activa"
        try:
            roulette_link = _admin_change_url(obj.roulette)
            return format_html('<a href="{}">{}</a> {}', roulette_link, name, status)
        except Exception:
            return f"{name} {status}"
    roulette_display.short_description = "Ruleta"
    roulette_display.admin_order_field = "roulette__name"

    def receipt_display(self, obj):
        """Mostrar información del comprobante (link + tamaño)."""
        if not obj.receipt:
            return "Sin archivo"
        # tamaño amigable con fallback
        try:
            size_bytes = obj.receipt.size
            if size_bytes < 1024 * 1024:
                file_size = f"{size_bytes / 1024:.1f} KB"
            else:
                file_size = f"{size_bytes / (1024 * 1024):.1f} MB"
        except Exception:
            file_size = "—"
        try:
            return format_html(
                '<a href="{}" target="_blank">{}</a><br><small>{}</small>',
                obj.receipt.url,
                obj.receipt_filename or "archivo",
                file_size,
            )
        except Exception:
            # Por si el storage no puede generar URL
            return obj.receipt_filename or "archivo"
    receipt_display.short_description = "Comprobante"

    def receipt_preview(self, obj):
        """Mostrar preview del comprobante (img o link a PDF)."""
        if not obj.receipt:
            return "Sin archivo"
        ext = (obj.receipt_extension or "").lower()
        try:
            if ext in [".jpg", ".jpeg", ".png"]:
                return format_html(
                    '<img src="{}" style="max-width:200px; max-height:200px;" />',
                    obj.receipt.url
                )
            # fallback PDF/otros
            return format_html('<a href="{}" target="_blank">📄 Ver archivo</a>', obj.receipt.url)
        except Exception:
            return "Archivo no disponible"
    receipt_preview.short_description = "Preview"

    def is_winner_display(self, obj):
        """Mostrar estado de ganador."""
        if obj.is_winner:
            return format_html('<span style="color:gold; font-weight:bold;">🏆 GANADOR</span>')
        return format_html('<span style="color:#666;">-</span>')
    is_winner_display.short_description = "Ganador"
    is_winner_display.admin_order_field = "is_winner"

    def get_queryset(self, request):
        """Optimizar consultas."""
        qs = super().get_queryset(request)
        return qs.select_related("user", "roulette")

    def has_delete_permission(self, request, obj=None):
        """Solo permitir eliminar si la ruleta no ha sido sorteada."""
        if obj is not None:
            # Si existe la relación y expone is_drawn, bloqueamos
            if getattr(obj.roulette, "is_drawn", False):
                return False
        return super().has_delete_permission(request, obj)

    actions = ["mark_as_winner", "unmark_as_winner"]

    def mark_as_winner(self, request, queryset):
        """Marcar participaciones como ganadoras."""
        updated = queryset.update(is_winner=True)
        self.message_user(request, f"{updated} participación(es) marcadas como ganadoras.")
    mark_as_winner.short_description = "Marcar como ganador"

    def unmark_as_winner(self, request, queryset):
        """Desmarcar participaciones como ganadoras."""
        updated = queryset.update(is_winner=False)
        self.message_user(request, f"{updated} participación(es) desmarcadas como ganadoras.")
    unmark_as_winner.short_description = "Desmarcar como ganador"
