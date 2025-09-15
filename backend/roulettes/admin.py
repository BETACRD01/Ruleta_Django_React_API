from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from django.utils.safestring import mark_safe

from .models import (
    Roulette,
    RouletteSettings,
    DrawHistory,
    RoulettePrize,
)
from .utils import execute_roulette_draw


# ---------------- Inlines ---------------- #

class RouletteSettingsInline(admin.StackedInline):
    model = RouletteSettings
    can_delete = False
    verbose_name = "Configuración"
    verbose_name_plural = "Configuración"
    extra = 0


class RoulettePrizeInline(admin.TabularInline):
    model = RoulettePrize
    extra = 0
    fields = ("name", "stock", "probability", "image_preview")
    readonly_fields = ("image_preview",)

    def image_preview(self, obj):
        if obj.image:
            return mark_safe(f'<img src="{obj.image.url}" style="max-width:80px; max-height:80px;" />')
        return "-"

    image_preview.short_description = "Imagen"


# ---------------- Admin: Roulette ---------------- #

@admin.register(Roulette)
class RouletteAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "status_badge",
        "created_by",
        "scheduled_date",
        "participants_count",
        "winner_info",
        "created_at",
    )
    search_fields = ("name", "description", "created_by__username", "created_by__email")
    list_filter = ("status", "created_at", "scheduled_date", "drawn_at")
    readonly_fields = (
        "created_at",
        "updated_at",
        "drawn_at",
        "participants_count",
        "winner_link",
        "drawn_by",
    )
    inlines = [RouletteSettingsInline, RoulettePrizeInline]
    ordering = ("-created_at",)

    # ---- helpers visuales ----
    def status_badge(self, obj):
        colors = {"active": "green", "completed": "blue", "cancelled": "red"}
        color = colors.get(obj.status, "gray")
        return format_html(
            '<span style="color:{}; font-weight:bold;">{}</span>',
            color,
            obj.get_status_display(),
        )

    status_badge.short_description = "Estado"

    def participants_count(self, obj):
        count = obj.get_participants_count()
        # Mostrar el posible límite si existe configuración
        max_count = getattr(getattr(obj, "settings", None), "max_participants", 0) or "∞"
        return f"{count}/{max_count}"

    participants_count.short_description = "Participantes"

    def winner_info(self, obj):
        if obj.winner:
            user = obj.winner.user
            name = user.get_full_name() or user.username
            return format_html('<span style="color:green;">🏆 {}</span>', name)
        if obj.is_drawn:
            return format_html('<span style="color:#a00;">Sorteada (sin ganador)</span>')
        return "-"

    winner_info.short_description = "Ganador"

    def winner_link(self, obj):
        if obj.winner:
            url = reverse("admin:participants_participation_change", args=[obj.winner.id])
            return mark_safe(f'<a href="{url}">Ver participación</a>')
        return "-"

    winner_link.short_description = "Detalle ganador"

    # ---- acciones (opcional) ----
    actions = ["admin_execute_draw"]

    def admin_execute_draw(self, request, queryset):
        """
        Ejecutar sorteo manual desde admin para las ruletas seleccionadas.
        """
        executed = 0
        for roulette in queryset:
            if not roulette.can_be_drawn_manually:
                continue
            result = execute_roulette_draw(roulette, request.user, draw_type="admin")
            if result.get("success"):
                executed += 1
        self.message_user(request, f"Sorteo ejecutado en {executed} ruleta(s).")

    admin_execute_draw.short_description = "Ejecutar sorteo (manual)"


# ---------------- Admin: RouletteSettings ---------------- #

@admin.register(RouletteSettings)
class RouletteSettingsAdmin(admin.ModelAdmin):
    """
    ¡Corregido! Solo usar campos que existen en el modelo:
    - max_participants
    - allow_multiple_entries
    """
    list_display = ("roulette", "max_participants", "allow_multiple_entries")
    list_select_related = ("roulette",)
    list_filter = ("allow_multiple_entries",)
    search_fields = ("roulette__name",)
    ordering = ("-roulette__created_at",)


# ---------------- Admin: RoulettePrize ---------------- #

@admin.register(RoulettePrize)
class RoulettePrizeAdmin(admin.ModelAdmin):
    list_display = ("name", "roulette", "stock", "probability", "image_thumb", "updated_at")
    list_select_related = ("roulette",)
    list_filter = ("roulette",)
    search_fields = ("name", "roulette__name")
    readonly_fields = ("created_at", "updated_at", "image_thumb")

    def image_thumb(self, obj):
        if obj.image:
            return mark_safe(f'<img src="{obj.image.url}" style="max-width:80px; max-height:80px;" />')
        return "-"

    image_thumb.short_description = "Imagen"


# ---------------- Admin: DrawHistory ---------------- #

@admin.register(DrawHistory)
class DrawHistoryAdmin(admin.ModelAdmin):
    list_display = ("roulette", "winner_name", "drawn_by", "draw_type", "drawn_at", "participants_count")
    list_select_related = ("roulette", "drawn_by", "winner_selected__user")
    search_fields = ("roulette__name", "winner_selected__user__username", "drawn_by__username")
    list_filter = ("draw_type", "drawn_at")
    ordering = ("-drawn_at",)

    def winner_name(self, obj):
        if obj.winner_selected and obj.winner_selected.user:
            return obj.winner_selected.user.get_full_name() or obj.winner_selected.user.username
        return "-"

    winner_name.short_description = "Ganador"
