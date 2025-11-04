# admin.py
from __future__ import annotations

import importlib

from django import forms
from django.contrib import admin
from django.contrib.admin import SimpleListFilter
from django.urls import reverse
from django.utils.html import format_html
from django.utils.safestring import mark_safe
from django.utils.timezone import localtime, now as timezone_now

from .models import (
    Roulette,
    RouletteSettings,
    DrawHistory,
    RoulettePrize,
    RouletteStatus,
)
from .utils import execute_roulette_draw


# ================= CKEditor dinámico ================= #
def get_ckeditor_widget():
    """Devuelve (WidgetClass, disponible: bool) para CKEditor."""
    try:
        ckeditor_module = importlib.import_module("django_ckeditor_5.widgets")
        return ckeditor_module.CKEditor5Widget, True
    except ImportError:
        try:
            ckeditor_module = importlib.import_module("ckeditor_uploader.widgets")
            return ckeditor_module.CKEditorUploadingWidget, True
        except ImportError:
            return forms.Textarea, False


CKEditorWidget, CKEDITOR_AVAILABLE = get_ckeditor_widget()


# ================= Filtros custom ================= #
class ParticipationFilter(SimpleListFilter):
    title = "Participantes"
    parameter_name = "has_participants"

    def lookups(self, request, model_admin):
        return (("yes", "Con participantes"), ("no", "Sin participantes"))

    def queryset(self, request, queryset):
        if self.value() == "yes":
            return queryset.filter(participations__isnull=False).distinct()
        if self.value() == "no":
            return queryset.filter(participations__isnull=True)


class DrawStatusFilter(SimpleListFilter):
    title = "Estado del Sorteo"
    parameter_name = "draw_status"

    def lookups(self, request, model_admin):
        return (
            ("drawn", "Ya sorteadas"),
            ("pending", "Pendientes de sorteo"),
            ("ready", "Listas para sortear"),
        )

    def queryset(self, request, queryset):
        if self.value() == "drawn":
            return queryset.filter(is_drawn=True)
        if self.value() == "pending":
            return queryset.filter(is_drawn=False, status=RouletteStatus.ACTIVE)
        if self.value() == "ready":
            return (
                queryset.filter(
                    is_drawn=False,
                    status=RouletteStatus.ACTIVE,
                    participations__isnull=False,
                )
                .distinct()
            )


# ================= Forms ================= #
class RouletteAdminForm(forms.ModelForm):
    """
    Form con validaciones y widgets claros (datetime-local).
    Modo 100% manual (sin ejecución automática).
    """

    if CKEDITOR_AVAILABLE:
        description = forms.CharField(
            required=False,
            widget=CKEditorWidget(
                config_name="roulette_editor" if "django_ckeditor_5" in str(CKEditorWidget) else "default"
            ),
            help_text=mark_safe(
                "Descripción con formato enriquecido: <b>negrita</b>, <i>cursiva</i>, enlaces, imágenes, listas…"
            ),
        )
    else:
        description = forms.CharField(
            required=False,
            widget=forms.Textarea(attrs={"rows": 8, "cols": 100}),
            help_text="Descripción de la ruleta (instala django-ckeditor-5 para editor enriquecido)",
        )

    participation_start = forms.DateTimeField(
        required=False,
        widget=forms.DateTimeInput(
            attrs={
                "type": "datetime-local",
                "class": "vDateTimeInput optional-field",
                "placeholder": "Dejar vacío = participación inmediata",
                "style": "border-left: 4px solid #28a745;",
            }
        ),
        input_formats=["%Y-%m-%dT%H:%M", "%Y-%m-%d %H:%M", "%Y-%m-%d %H:%M:%S"],
        help_text=mark_safe(
            """
            <div style='background:#e8f5e8;padding:8px;border-radius:4px;margin-top:5px;'>
                <strong>INICIO DE PARTICIPACIÓN</strong><br>
                • <strong>Vacío:</strong> participación inmediata al activar<br>
                • <strong>Con fecha:</strong> participación desde esa fecha/hora<br>
                • Ejemplo: 25/10/2025 00:00 = abre a medianoche del día 25
            </div>
            """
        ),
    )

    participation_end = forms.DateTimeField(
        required=False,
        widget=forms.DateTimeInput(
            attrs={
                "type": "datetime-local",
                "class": "vDateTimeInput optional-field",
                "placeholder": "Dejar vacío = sin límite de tiempo",
                "style": "border-left: 4px solid #dc3545;",
            }
        ),
        input_formats=["%Y-%m-%dT%H:%M", "%Y-%m-%d %H:%M", "%Y-%m-%d %H:%M:%S"],
        help_text=mark_safe(
            """
            <div style='background:#ffe8e8;padding:8px;border-radius:4px;margin-top:5px;'>
                <strong>FIN DE PARTICIPACIÓN (CIERRE)</strong><br>
                • <strong>Vacío:</strong> sin límite, hasta sorteo manual<br>
                • <strong>Con fecha:</strong> se cierra participación después de esta fecha<br>
                • Ejemplo: 30/10/2025 23:59 = cierra antes de medianoche del día 30
            </div>
            """
        ),
    )

    scheduled_date = forms.DateTimeField(
        required=False,
        widget=forms.DateTimeInput(
            attrs={
                "type": "datetime-local",
                "class": "vDateTimeInput optional-field",
                "placeholder": "¿Qué día sortearás?",
                "style": "border-left: 4px solid #ffc107;",
            }
        ),
        input_formats=["%Y-%m-%dT%H:%M", "%Y-%m-%d %H:%M", "%Y-%m-%d %H:%M:%S"],
        help_text=mark_safe(
            """
            <div style='background:#fff8e8;padding:8px;border-radius:4px;margin-top:5px;'>
                <strong>FECHA DEL SORTEO</strong><br>
                • Cuándo ejecutarás el sorteo manualmente<br>
                • Debe ser DESPUÉS del fin de participación<br>
                • <strong>NO es automático:</strong> debes ejecutarlo con el botón<br>
                • Ejemplo: 31/10/2025 20:00 = sorteas ese día a las 8pm
            </div>
            """
        ),
    )

    class Meta:
        model = Roulette
        fields = "__all__"
        widgets = {
            "participation_start": forms.DateTimeInput(attrs={"type": "datetime-local", "class": "vDateTimeInput"}),
            "participation_end": forms.DateTimeInput(attrs={"type": "datetime-local", "class": "vDateTimeInput"}),
            "scheduled_date": forms.DateTimeInput(attrs={"type": "datetime-local", "class": "vDateTimeInput"}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        def _fmt_dt(value):
            if not value:
                return None
            try:
                return localtime(value).strftime("%Y-%m-%dT%H:%M")
            except Exception:
                return None

        instance = kwargs.get("instance") or getattr(self, "instance", None)
        if instance:
            if instance.participation_start:
                self.initial["participation_start"] = _fmt_dt(instance.participation_start)
            if instance.participation_end:
                self.initial["participation_end"] = _fmt_dt(instance.participation_end)
            if instance.scheduled_date:
                self.initial["scheduled_date"] = _fmt_dt(instance.scheduled_date)

        for field_name in ["participation_start", "participation_end", "scheduled_date"]:
            if field_name in self.fields:
                self.fields[field_name].required = False
                current_label = self.fields[field_name].label or field_name.replace("_", " ").title()
                self.fields[field_name].label = f"{current_label} (Opcional)"

    def clean_participation_start(self):
        v = self.cleaned_data.get("participation_start")
        return v or None

    def clean_participation_end(self):
        v = self.cleaned_data.get("participation_end")
        return v or None

    def clean_scheduled_date(self):
        v = self.cleaned_data.get("scheduled_date")
        return v or None
    
    def clean(self):
        cleaned = super().clean()
        start = cleaned.get("participation_start")
        end = cleaned.get("participation_end")
        sched = cleaned.get("scheduled_date")
        now = timezone_now()
         
        # Fin debe ser posterior a inicio
        if start and end:
            if start >= end:
                self.add_error(
                    "participation_end", 
                    "La fecha de fin debe ser posterior a la fecha de inicio."
                )
        
        # Sorteo debe ser después de fin de participación
        if sched:
            if end and sched <= end:
                self.add_error(
                    "scheduled_date",
                    "La fecha del sorteo debe ser posterior al fin de participación."
                )
            if not end:
                self.add_error(
                    "scheduled_date",
                    "Debes especificar una fecha de fin de participación antes de programar el sorteo."
                )
        
        return cleaned


class RouletteSettingsAdminForm(forms.ModelForm):
    """Formulario de configuración de ruleta (incluye winners_target)."""

    class Meta:
        model = RouletteSettings
        fields = "__all__"
        widgets = {
            "max_participants": forms.NumberInput(attrs={"min": "0", "step": "1"}),
            "winners_target": forms.NumberInput(attrs={"min": "0", "step": "1"}),
        }


class RoulettePrizeAdminForm(forms.ModelForm):
    """Formulario de premios con campo de instrucciones de retiro."""

    class Meta:
        model = RoulettePrize
        fields = "__all__"
        widgets = {
            "description": forms.Textarea(attrs={"rows": 4, "cols": 80}),
            "pickup_instructions": forms.Textarea(attrs={"rows": 3, "cols": 80}),
            "stock": forms.NumberInput(attrs={"min": "0", "step": "1"}),
            "display_order": forms.NumberInput(attrs={"min": "0", "step": "1"}),
        }


# ================= Inlines ================= #
class RouletteSettingsInline(admin.StackedInline):
    model = RouletteSettings
    form = RouletteSettingsAdminForm
    can_delete = False
    verbose_name = "Configuración de la Ruleta"
    verbose_name_plural = "Configuración"
    extra = 0
    max_num = 1

    fieldsets = (
        (
            "Participantes",
            {
                "fields": ("max_participants", "allow_multiple_entries", "winners_target"),
                "description": "Límites, múltiples entradas y cantidad de ganadores objetivo (0 = automático por premios disponibles).",
            },
        ),
        (
            "Interfaz",
            {
                "fields": ("show_countdown",),
                "description": "Opciones visuales (cronómetro).",
            },
        ),
        (
            "Notificaciones",
            {
                "fields": ("notify_on_participation", "notify_on_draw"),
                "classes": ("collapse",),
                "description": "Configurar notificaciones del sistema",
            },
        ),
    )

    def has_add_permission(self, request, obj=None):
        if obj is None:
            return False
        return not hasattr(obj, "settings")

    def has_change_permission(self, request, obj=None):
        return True


class RoulettePrizeInline(admin.TabularInline):
    model = RoulettePrize
    form = RoulettePrizeAdminForm
    extra = 0
    fields = ("display_order", "name", "description", "pickup_instructions", "stock", "is_active", "image_preview")
    readonly_fields = ("image_preview",)
    ordering = ["display_order", "-created_at"]

    def image_preview(self, obj):
        if obj.image:
            return mark_safe(
                f'<img src="{obj.image.url}" style="max-width:60px; max-height:60px; object-fit:cover; border-radius:4px;" />'
            )
        return mark_safe('<span style="color:#999;">Sin imagen</span>')

    image_preview.short_description = "Vista previa"


# ================= Admin: Roulette ================= #
@admin.register(Roulette)
class RouletteAdmin(admin.ModelAdmin):
    form = RouletteAdminForm

    list_display = (
        "name",
        "status_badge",
        "cover_image_preview",
        "created_by",
        "participation_period_display",
        "scheduled_date_display",
        "participants_count",
        "prizes_count",
        "winners_progress",
        "winner_info",
        "created_at",
    )
    search_fields = ("name", "description", "created_by__username", "created_by__email")
    list_filter = (
        "status",
        DrawStatusFilter,
        ParticipationFilter,
        "created_at",
        "scheduled_date",
        "drawn_at",
    )
    readonly_fields = (
        "slug",
        "created_at",
        "updated_at",
        "drawn_at",
        "participants_count_detail",
        "winner_link",
        "drawn_by",
        "cover_image_preview_large",
        "date_configuration_summary",
        "winners_progress_readonly",
    )
    inlines = [RouletteSettingsInline, RoulettePrizeInline]
    ordering = ("-created_at",)
    date_hierarchy = "created_at"

    fieldsets = (
        ("Información Básica", {"fields": ("name", "slug", "description", "status"), "description": "Datos principales"}),
        (
            "Imagen de Portada",
            {"fields": ("cover_image", "cover_image_preview_large"), "classes": ("collapse",), "description": "Imagen principal"},
        ),
        (
            "Configuración de Fechas",
            {
                "fields": ("participation_start", "participation_end", "scheduled_date", "date_configuration_summary"),
                "description": mark_safe(
                    """
                    <div style='background:#f0f8ff;padding:15px;border-radius:6px;border:2px solid #4a90e2;'>
                        <h3 style='margin-top:0;color:#2c5282;'>Ejemplo de Configuración</h3>
                        
                        <div style='background:white;padding:10px;border-radius:4px;margin:10px 0;'>
                            <strong>Escenario 1: Sorteo Inmediato</strong>
                            <ul style='margin:5px 0;'>
                                <li><strong>Inicio:</strong> (vacío) → Participación empieza AL ACTIVAR</li>
                                <li><strong>Fin:</strong> (vacío) → Sin límite de tiempo</li>
                                <li><strong>Sorteo:</strong> (vacío) → Sorteas cuando quieras</li>
                            </ul>
                        </div>
                        
                        <div style='background:white;padding:10px;border-radius:4px;margin:10px 0;'>
                            <strong>Escenario 2: Sorteo Programado</strong>
                            <ul style='margin:5px 0;'>
                                <li><strong>Inicio:</strong> 25/10/2025 00:00 → Abre a medianoche del 25</li>
                                <li><strong>Fin:</strong> 30/10/2025 23:59 → Cierra el 30 a las 11:59pm</li>
                                <li><strong>Sorteo:</strong> 31/10/2025 20:00 → El 31 a las 8pm ejecutas sorteo</li>
                            </ul>
                        </div>
                        
                        <p style='color:#e53e3e;font-weight:bold;margin-bottom:0;'>
                            IMPORTANTE: El sorteo NO es automático. Debes ejecutarlo manualmente desde 
                            la lista de ruletas usando la acción "Ejecutar sorteo manual"
                        </p>
                    </div>
                    """
                ),
            },
        ),
        ("Creación", {"fields": ("created_by", "created_at", "updated_at"), "classes": ("collapse",)}),
        (
            "Resultado del Sorteo",
            {"fields": ("winner", "winner_link", "drawn_at", "drawn_by", "is_drawn", "winners_progress_readonly"), "classes": ("collapse",)},
        ),
        ("Estadísticas", {"fields": ("participants_count_detail",), "classes": ("collapse",)}),
    )

    def get_inline_instances(self, request, obj=None):
        inline_instances = []
        for inline_class in self.inlines:
            if inline_class is RouletteSettingsInline and obj is None:
                continue
            inline = inline_class(self.model, self.admin_site)
            inline_instances.append(inline)
        return inline_instances

    # ---- Visualizaciones ----
    def status_badge(self, obj):
        colors = {
            "draft": "#6c757d",
            "active": "#28a745",
            "scheduled": "#007bff",
            "completed": "#17a2b8",
            "cancelled": "#dc3545",
        }
        color = colors.get(obj.status, "#6c757d")
        return format_html(
            '<span style="color:{};font-weight:bold;padding:2px 6px;border-radius:3px;background-color:{}22;">{}</span>',
            color,
            color,
            obj.get_status_display(),
        )

    status_badge.short_description = "Estado"

    def cover_image_preview(self, obj):
        if obj.cover_image:
            return mark_safe(
                f'<img src="{obj.cover_image.url}" style="width:40px;height:40px;object-fit:cover;border-radius:4px;" />'
            )
        return mark_safe('<span style="color:#999;">Sin portada</span>')

    cover_image_preview.short_description = "Portada"

    def cover_image_preview_large(self, obj):
        if obj.cover_image:
            return mark_safe(
                f'<img src="{obj.cover_image.url}" style="max-width:300px;max-height:200px;object-fit:cover;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.1);" />'
            )
        return "Sin imagen de portada"

    cover_image_preview_large.short_description = "Vista previa de portada"

    def participation_period_display(self, obj):
        if not obj.participation_start and not obj.participation_end:
            return mark_safe('<span style="color:#28a745;font-weight:bold;">Sin límites</span>')

        parts = []
        if obj.participation_start:
            parts.append(f"Desde: {obj.participation_start.strftime('%d/%m/%Y %H:%M')}")
        else:
            parts.append("Desde: inmediato")

        if obj.participation_end:
            parts.append(f"Hasta: {obj.participation_end.strftime('%d/%m/%Y %H:%M')}")
        else:
            parts.append("Hasta: sin límite")

        return format_html("<small>{}</small>", " | ".join(parts))

    participation_period_display.short_description = "Período de participación"

    def scheduled_date_display(self, obj):
        if not obj.scheduled_date:
            return mark_safe('<span style="color:#6c757d;">—</span>')
        scheduled = obj.scheduled_date.strftime("%d/%m/%Y %H:%M")
        if obj.is_drawn:
            return format_html('<span style="color:#17a2b8;">Realizado: {}</span>', scheduled)
        return format_html('<span style="color:#007bff;font-weight:bold;">Programado: {}</span>', scheduled)

    scheduled_date_display.short_description = "Fecha del sorteo"

    def date_configuration_summary(self, obj):
        html = "<div style='background:#f8f9fa;padding:10px;border-radius:4px;font-family:monospace;'>"
        html += "<strong>Configuración Actual:</strong><br><br>"
        html += "<strong>Participación:</strong><br>"
        if not obj.participation_start and not obj.participation_end:
            html += "&nbsp;&nbsp;• Sin restricciones de tiempo<br>"
        else:
            html += f"&nbsp;&nbsp;• Inicio: {obj.participation_start.strftime('%d/%m/%Y %H:%M') if obj.participation_start else 'Inmediato'}<br>"
            html += f"&nbsp;&nbsp;• Fin: {obj.participation_end.strftime('%d/%m/%Y %H:%M') if obj.participation_end else 'Sin límite'}<br>"

        html += "<br><strong>Sorteo:</strong><br>"
        html += (
            f"&nbsp;&nbsp;• Fecha programada: {obj.scheduled_date.strftime('%d/%m/%Y %H:%M')}<br>"
            if obj.scheduled_date
            else "&nbsp;&nbsp;• Manual (ejecutado por administrador)<br>"
        )
        html += "</div>"
        return mark_safe(html)

    date_configuration_summary.short_description = "Resumen de configuración"

    def participants_count(self, obj):
        count = obj.get_participants_count()
        max_count = getattr(getattr(obj, "settings", None), "max_participants", 0) or "∞"
        if isinstance(max_count, int) and max_count > 0:
            percentage = (count / max_count) * 100 if max_count else 0
            color = "#28a745" if percentage < 80 else "#ffc107" if percentage < 100 else "#dc3545"
            return format_html('<span style="color:{};font-weight:bold;">{}/{}</span>', color, count, max_count)
        return format_html('<span style="color:#17a2b8;">{}</span>', count)

    participants_count.short_description = "Participantes"

    def participants_count_detail(self, obj):
        count = obj.get_participants_count()
        settings = getattr(obj, "settings", None)
        max_count = getattr(settings, "max_participants", 0) if settings else 0

        info = f"Total de participantes: {count}"
        if max_count > 0:
            percentage = (count / max_count) * 100
            info += f"\nLímite máximo: {max_count}"
            info += f"\nPorcentaje ocupado: {percentage:.1f}%"
        else:
            info += "\nSin límite de participantes"
        return info

    participants_count_detail.short_description = "Detalle de participantes"

    def prizes_count(self, obj):
        total = obj.prizes.filter(is_active=True, stock__gt=0).count()
        if total == 0:
            return mark_safe('<span style="color:#999;">Sin premios disponibles</span>')
        return format_html('<span style="color:#28a745;">{}</span>', total)

    prizes_count.short_description = "Premios disponibles"

    def _winners_pair(self, obj):
        """(ganadores_actuales, objetivo_efectivo) con compat del campo legacy 'winner'."""
        winners = obj.participations.filter(is_winner=True).count()
        if obj.winner_id and not obj.participations.filter(pk=obj.winner_id, is_winner=True).exists():
            winners += 1
        target = obj.winners_target_effective()
        return winners, target

    def winners_progress(self, obj):
        winners, target = self._winners_pair(obj)
        color = "#28a745" if winners >= target else "#007bff"
        return format_html('<span style="color:{};font-weight:bold;">{}/{}</span>', color, winners, target)

    winners_progress.short_description = "Ganadores"

    def winners_progress_readonly(self, obj):
        winners, target = self._winners_pair(obj)
        rows = [
            f"<strong>Ganadores actuales:</strong> {winners}",
            f"<strong>Objetivo de ganadores:</strong> {target} {'(auto)' if getattr(getattr(obj,'settings',None),'winners_target',0)==0 else ''}",
            f"<strong>Faltan:</strong> {max(target - winners, 0)}",
            f"<strong>Premios disponibles (cuentan para objetivo auto):</strong> {obj.available_awards_count()}",
        ]
        return mark_safe("<br>".join(rows))

    winners_progress_readonly.short_description = "Progreso de ganadores"

    def winner_info(self, obj):
        if obj.winner:
            user = obj.winner.user
            name = user.get_full_name() or user.username
            return format_html('<span style="color:#28a745;font-weight:bold;">{}</span>', name)
        if obj.is_drawn:
            return format_html('<span style="color:#dc3545;">Sorteada</span>')
        return mark_safe('<span style="color:#999;">Pendiente</span>')

    winner_info.short_description = "Ganador (legacy)"

    def winner_link(self, obj):
        if obj.winner:
            try:
                url = reverse("admin:participants_participation_change", args=[obj.winner.id])
                return mark_safe(f'<a href="{url}">Ver participación ganadora</a>')
            except Exception:
                return "Ver participación (error en URL)"
        return "Sin ganador"

    winner_link.short_description = "Enlace al ganador"

    # ---- Acciones ----
    actions = ["admin_execute_draw", "mark_as_active", "mark_as_cancelled"]

    def admin_execute_draw(self, request, queryset):
        executed = 0
        errors = []

        for roulette in queryset:
            if not roulette.can_be_drawn_manually:
                errors.append(f"'{roulette.name}': No se puede sortear")
                continue

            try:
                result = execute_roulette_draw(roulette, request.user, draw_type="admin")
                if result.get("success"):
                    executed += 1
                else:
                    errors.append(f"'{roulette.name}': {result.get('message', 'Error desconocido')}")
            except Exception as e:
                errors.append(f"'{roulette.name}': {str(e)}")

        if executed > 0:
            self.message_user(request, f"Sorteo ejecutado en {executed} ruleta(s).")

        if errors:
            error_msg = "Errores encontrados:\n" + "\n".join(errors[:5])
            if len(errors) > 5:
                error_msg += f"\n... y {len(errors) - 5} errores más"
            self.message_user(request, error_msg, level="ERROR")

    admin_execute_draw.short_description = "Ejecutar sorteo manual"

    def mark_as_active(self, request, queryset):
        count = queryset.filter(status__in=["draft", "scheduled"]).update(status="active")
        self.message_user(request, f"{count} ruleta(s) marcada(s) como activa(s).")

    mark_as_active.short_description = "Marcar como activa"

    def mark_as_cancelled(self, request, queryset):
        count = queryset.exclude(status="completed").update(status="cancelled")
        self.message_user(request, f"{count} ruleta(s) cancelada(s).")

    mark_as_cancelled.short_description = "Cancelar ruletas"

    class Media:
        css = {"all": ("/static/admin/css/custom_roulette_admin.css",)}
        js = ("/static/admin/js/roulette_admin.js",)


# ================= Admin: RouletteSettings ================= #
@admin.register(RouletteSettings)
class RouletteSettingsAdmin(admin.ModelAdmin):
    form = RouletteSettingsAdminForm
    list_display = (
        "roulette",
        "max_participants",
        "allow_multiple_entries",
        "winners_target",
        "show_countdown",
        "notify_on_draw",
    )
    list_select_related = ("roulette",)
    list_filter = (
        "allow_multiple_entries",
        "show_countdown",
        "notify_on_draw",
    )
    search_fields = ("roulette__name",)
    ordering = ("-roulette__created_at",)

    fieldsets = (
        ("Configuración de Participantes", {"fields": ("roulette", "max_participants", "allow_multiple_entries", "winners_target")}),
        ("Interfaz", {"fields": ("show_countdown",)}),
        ("Notificaciones", {"fields": ("notify_on_participation", "notify_on_draw")}),
    )


# ================= Admin: RoulettePrize ================= #
@admin.register(RoulettePrize)
class RoulettePrizeAdmin(admin.ModelAdmin):
    form = RoulettePrizeAdminForm
    list_display = (
        "name",
        "roulette",
        "image_preview",
        "stock",
        "display_order",
        "is_active",
        "has_pickup_instructions",
        "updated_at",
    )
    list_select_related = ("roulette",)
    list_filter = ("roulette", "is_active", "created_at")
    search_fields = ("name", "roulette__name", "description", "pickup_instructions")
    readonly_fields = ("created_at", "updated_at", "image_preview_large")
    ordering = ("roulette", "display_order", "-created_at")

    fieldsets = (
        ("Información del Premio", {"fields": ("roulette", "name", "description", "display_order")}),
        ("Imagen", {"fields": ("image", "image_preview_large")}),
        (
            "Instrucciones de Retiro",
            {
                "fields": ("pickup_instructions",),
                "description": "Información sobre cómo y dónde el ganador puede retirar este premio",
            },
        ),
        ("Configuración", {"fields": ("stock", "is_active")}),
        ("Metadatos", {"fields": ("created_at", "updated_at"), "classes": ("collapse",)}),
    )

    def image_preview(self, obj):
        if obj.image:
            return mark_safe(
                f'<img src="{obj.image.url}" style="width:50px;height:50px;object-fit:cover;border-radius:4px;" />'
            )
        return mark_safe('<span style="color:#999;">Sin imagen</span>')

    image_preview.short_description = "Imagen"

    def image_preview_large(self, obj):
        if obj.image:
            return mark_safe(
                f'<img src="{obj.image.url}" style="max-width:200px;max-height:200px;object-fit:cover;border-radius:8px;" />'
            )
        return "Sin imagen"

    image_preview_large.short_description = "Vista previa"

    def has_pickup_instructions(self, obj):
        if obj.pickup_instructions and obj.pickup_instructions.strip():
            return mark_safe('<span style="color:#28a745;">Sí</span>')
        return mark_safe('<span style="color:#999;">—</span>')

    has_pickup_instructions.short_description = "Instrucciones"


# ================= Admin: DrawHistory ================= #
@admin.register(DrawHistory)
class DrawHistoryAdmin(admin.ModelAdmin):
    list_display = ("roulette", "winner_name", "drawn_by", "draw_type", "drawn_at", "participants_count")
    list_select_related = ("roulette", "drawn_by", "winner_selected__user")
    search_fields = ("roulette__name", "winner_selected__user__username", "drawn_by__username")
    list_filter = ("draw_type", "drawn_at")
    ordering = ("-drawn_at",)
    readonly_fields = ("random_seed", "ip_address", "user_agent")
    date_hierarchy = "drawn_at"

    fieldsets = (
        ("Información del Sorteo", {"fields": ("roulette", "winner_selected", "drawn_by", "draw_type", "drawn_at")}),
        ("Estadísticas", {"fields": ("participants_count", "random_seed")}),
        ("Metadatos de Auditoría", {"fields": ("ip_address", "user_agent"), "classes": ("collapse",)}),
    )

    def winner_name(self, obj):
        if obj.winner_selected and obj.winner_selected.user:
            return obj.winner_selected.user.get_full_name() or obj.winner_selected.user.username
        return "Sin ganador"

    winner_name.short_description = "Ganador"


# ================= Branding Admin Site ================= #
admin.site.site_header = "Administración de Ruletas"
admin.site.site_title = "Ruletas Admin"
admin.site.index_title = "Panel de Control - Sistema de Ruletas"