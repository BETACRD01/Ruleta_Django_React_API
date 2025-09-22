from django import forms
from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from django.utils.safestring import mark_safe
from django.contrib.admin import SimpleListFilter
from django.utils.timezone import localtime
import importlib

from .models import (
    Roulette,
    RouletteSettings,
    DrawHistory,
    RoulettePrize,
    RouletteStatus,
)
from .utils import execute_roulette_draw

# Importación dinámica de CKEditor compatible con Django 5.2.6
def get_ckeditor_widget():
    try:
        # Intentar con django-ckeditor-5 (más moderno)
        ckeditor_module = importlib.import_module('django_ckeditor_5.widgets')
        return ckeditor_module.CKEditor5Widget, True
    except ImportError:
        try:
            # Fallback a ckeditor clásico
            ckeditor_module = importlib.import_module('ckeditor_uploader.widgets')
            return ckeditor_module.CKEditorUploadingWidget, True
        except ImportError:
            return forms.Textarea, False

CKEditorWidget, CKEDITOR_AVAILABLE = get_ckeditor_widget()


# ---------------- Custom Filters ---------------- #

class ParticipationFilter(SimpleListFilter):
    title = 'Participantes'
    parameter_name = 'has_participants'

    def lookups(self, request, model_admin):
        return (
            ('yes', 'Con participantes'),
            ('no', 'Sin participantes'),
        )

    def queryset(self, request, queryset):
        if self.value() == 'yes':
            return queryset.filter(participations__isnull=False).distinct()
        if self.value() == 'no':
            return queryset.filter(participations__isnull=True)


class DrawStatusFilter(SimpleListFilter):
    title = 'Estado del Sorteo'
    parameter_name = 'draw_status'

    def lookups(self, request, model_admin):
        return (
            ('drawn', 'Ya sorteadas'),
            ('pending', 'Pendientes de sorteo'),
            ('ready', 'Listas para sortear'),
        )

    def queryset(self, request, queryset):
        if self.value() == 'drawn':
            return queryset.filter(is_drawn=True)
        if self.value() == 'pending':
            return queryset.filter(is_drawn=False, status=RouletteStatus.ACTIVE)
        if self.value() == 'ready':
            return queryset.filter(
                is_drawn=False,
                status=RouletteStatus.ACTIVE,
                participations__isnull=False
            ).distinct()


# ---------------- Forms ---------------- #

class RouletteAdminForm(forms.ModelForm):
    """Formulario mejorado con validaciones y widgets personalizados
       (usa DateTimeField + DateTimeInput; NO SplitDateTime)"""

    # Descripción con CKEditor (o textarea si no está disponible)
    if CKEDITOR_AVAILABLE:
        description = forms.CharField(
            required=False,
            widget=CKEditorWidget(
                config_name="roulette_editor" if 'django_ckeditor_5' in str(CKEditorWidget) else "default"
            ),
            help_text="Descripción detallada con formato enriquecido: <b>negrita</b>, <i>cursiva</i>, enlaces, imágenes, listas, etc."
        )
    else:
        description = forms.CharField(
            required=False,
            widget=forms.Textarea(attrs={'rows': 8, 'cols': 100}),
            help_text="Descripción de la ruleta (Editor básico - instala django-ckeditor-5 para editor enriquecido)"
        )

    # Fechas mejoradas: un solo input tipo datetime-local con ayuda clara
    participation_start = forms.DateTimeField(
        required=False,
        widget=forms.DateTimeInput(
            attrs={
                'type': 'datetime-local', 
                'class': 'vDateTimeInput optional-field',
                'placeholder': 'Opcional - Dejar vacío para permitir participación inmediata',
                'style': 'border-left: 4px solid #28a745;'  # Verde para indicar opcional
            }
        ),
        input_formats=['%Y-%m-%dT%H:%M', '%Y-%m-%d %H:%M', '%Y-%m-%d %H:%M:%S'],
        help_text="""
        <div style='background: #e8f5e8; padding: 8px; border-radius: 4px; margin-top: 5px;'>
            <strong>📅 CAMPO OPCIONAL</strong><br>
            • <strong>Vacío:</strong> Los usuarios pueden participar inmediatamente después de que la ruleta esté activa<br>
            • <strong>Con fecha:</strong> Los usuarios solo pueden participar desde esta fecha
        </div>
        """
    )
    
    participation_end = forms.DateTimeField(
        required=False,
        widget=forms.DateTimeInput(
            attrs={
                'type': 'datetime-local', 
                'class': 'vDateTimeInput optional-field',
                'placeholder': 'Opcional - Dejar vacío para no tener límite de tiempo',
                'style': 'border-left: 4px solid #28a745;'  # Verde para indicar opcional
            }
        ),
        input_formats=['%Y-%m-%dT%H:%M', '%Y-%m-%d %H:%M', '%Y-%m-%d %H:%M:%S'],
        help_text="""
        <div style='background: #e8f5e8; padding: 8px; border-radius: 4px; margin-top: 5px;'>
            <strong>⏰ CAMPO OPCIONAL</strong><br>
            • <strong>Vacío:</strong> Los usuarios pueden participar sin límite de tiempo (hasta sorteo manual)<br>
            • <strong>Con fecha:</strong> Los usuarios no podrán participar después de esta fecha
        </div>
        """
    )
    
    scheduled_date = forms.DateTimeField(
        required=False,
        widget=forms.DateTimeInput(
            attrs={
                'type': 'datetime-local', 
                'class': 'vDateTimeInput optional-field',
                'placeholder': 'Opcional - Solo para sorteos automáticos programados',
                'style': 'border-left: 4px solid #17a2b8;'  # Azul para diferenciarlo
            }
        ),
        input_formats=['%Y-%m-%dT%H:%M', '%Y-%m-%d %H:%M', '%Y-%m-%d %H:%M:%S'],
        help_text="""
        <div style='background: #e1f5fe; padding: 8px; border-radius: 4px; margin-top: 5px;'>
            <strong>🎲 CAMPO OPCIONAL</strong><br>
            • <strong>Vacío:</strong> Solo sorteo manual (ejecutado por administrador)<br>
            • <strong>Con fecha:</strong> Sorteo automático a la fecha/hora especificada<br>
            • <em>Nota:</em> Debe ser posterior al fin de participación si está definido
        </div>
        """
    )

    class Meta:
        model = Roulette
        fields = "__all__"
        widgets = {
            'participation_start': forms.DateTimeInput(attrs={'type': 'datetime-local', 'class': 'vDateTimeInput'}),
            'participation_end': forms.DateTimeInput(attrs={'type': 'datetime-local', 'class': 'vDateTimeInput'}),
            'scheduled_date': forms.DateTimeInput(attrs={'type': 'datetime-local', 'class': 'vDateTimeInput'}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        # Pre-formatear valores iniciales para <input type="datetime-local">
        def _fmt_dt(value):
            if not value:
                return None
            try:
                return localtime(value).strftime('%Y-%m-%dT%H:%M')
            except Exception:
                return None

        instance = kwargs.get('instance') or getattr(self, 'instance', None)
        if instance:
            if instance.participation_start:
                self.initial['participation_start'] = _fmt_dt(instance.participation_start)
            if instance.participation_end:
                self.initial['participation_end'] = _fmt_dt(instance.participation_end)
            if instance.scheduled_date:
                self.initial['scheduled_date'] = _fmt_dt(instance.scheduled_date)

        # Asegurar required=False explícitamente
        for field_name in ['participation_start', 'participation_end', 'scheduled_date']:
            if field_name in self.fields:
                self.fields[field_name].required = False
                # Agregar label con indicador de opcional
                current_label = self.fields[field_name].label or field_name.replace('_', ' ').title()
                self.fields[field_name].label = f"{current_label} (Opcional)"

    # Normalizar campos vacíos a None
    def clean_participation_start(self):
        value = self.cleaned_data.get('participation_start')
        return value if value else None

    def clean_participation_end(self):
        value = self.cleaned_data.get('participation_end')
        return value if value else None

    def clean_scheduled_date(self):
        value = self.cleaned_data.get('scheduled_date')
        return value if value else None

    def clean(self):
        cleaned_data = super().clean()
        participation_start = cleaned_data.get('participation_start')
        participation_end = cleaned_data.get('participation_end')
        scheduled_date = cleaned_data.get('scheduled_date')

        # Solo validar fechas si están presentes
        if participation_start and participation_end and participation_start >= participation_end:
            self.add_error('participation_end', 'La fecha de fin debe ser posterior al inicio de participación.')

        if scheduled_date:
            # Validar que sea fecha futura solo si estamos creando
            from django.utils import timezone
            if not self.instance.pk and scheduled_date <= timezone.now():
                self.add_error('scheduled_date', 'La fecha programada debe ser futura.')
            
            # Validar que sea posterior al fin de participación
            if participation_end and scheduled_date <= participation_end:
                self.add_error('scheduled_date', 'El sorteo debe ser posterior al fin de participación.')

        return cleaned_data


class RouletteSettingsAdminForm(forms.ModelForm):
    """Formulario para configuración de ruleta"""
    class Meta:
        model = RouletteSettings
        fields = '__all__'
        widgets = {
            'max_participants': forms.NumberInput(attrs={'min': '0', 'step': '1'}),
        }


class RoulettePrizeAdminForm(forms.ModelForm):
    """Formulario para premios con validaciones"""
    class Meta:
        model = RoulettePrize
        fields = '__all__'
        widgets = {
            'description': forms.Textarea(attrs={'rows': 4, 'cols': 80}),
            'probability': forms.NumberInput(attrs={'min': '0', 'max': '100', 'step': '0.01'}),
            'stock': forms.NumberInput(attrs={'min': '0', 'step': '1'}),
            'display_order': forms.NumberInput(attrs={'min': '0', 'step': '1'}),
        }


# ---------------- Inlines ---------------- #

class RouletteSettingsInline(admin.StackedInline):
    model = RouletteSettings
    form = RouletteSettingsAdminForm
    can_delete = False
    verbose_name = "Configuración de la Ruleta"
    verbose_name_plural = "Configuración"
    extra = 0

    fieldsets = (
        ('Participantes', {
            'fields': ('max_participants', 'allow_multiple_entries'),
            'description': 'Configura límites y reglas de participación'
        }),
        ('Automatización', {
            'fields': ('auto_draw_when_full', 'show_countdown'),
            'description': 'Opciones de sorteo automático y cronómetros'
        }),
        ('Notificaciones', {
            'fields': ('notify_on_participation', 'notify_on_draw'),
            'classes': ('collapse',),
            'description': 'Configurar notificaciones del sistema'
        }),
    )


class RoulettePrizeInline(admin.TabularInline):
    model = RoulettePrize
    form = RoulettePrizeAdminForm
    extra = 0
    fields = ("display_order", "name", "description", "stock", "probability", "is_active", "image_preview")
    readonly_fields = ("image_preview",)
    ordering = ['display_order', '-created_at']

    def image_preview(self, obj):
        if obj.image:
            return mark_safe(
                f'<img src="{obj.image.url}" style="max-width:60px; max-height:60px; object-fit:cover; border-radius:4px;" />'
            )
        return mark_safe('<span style="color:#999;">Sin imagen</span>')
    image_preview.short_description = "Vista previa"


# ---------------- Admin: Roulette ---------------- #

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
        "drawn_at"
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
    )
    inlines = [RouletteSettingsInline, RoulettePrizeInline]
    ordering = ("-created_at",)
    date_hierarchy = 'created_at'

    fieldsets = (
        ('Información Básica', {
            'fields': ('name', 'slug', 'description', 'status'),
            'description': 'Datos principales de la ruleta'
        }),
        ('Imagen de Portada', {
            'fields': ('cover_image', 'cover_image_preview_large'),
            'classes': ('collapse',),
            'description': 'Imagen principal que se mostrará en la ruleta'
        }),
        ('📅 Configuración de Fechas y Horarios (Todas Opcionales)', {
            'fields': ('participation_start', 'participation_end', 'scheduled_date', 'date_configuration_summary'),
            'description': '''
            <div style='background: #f8f9fa; padding: 12px; border-radius: 6px; border: 1px solid #dee2e6;'>
                <h4 style='color: #495057; margin-top: 0;'>💡 Guía Rápida de Configuración</h4>
                <ul style='margin: 0; color: #6c757d;'>
                    <li><strong>Sin fechas:</strong> Participación libre + sorteo manual</li>
                    <li><strong>Solo fin:</strong> Participación hasta fecha límite + sorteo manual</li>
                    <li><strong>Inicio + fin:</strong> Participación en período específico + sorteo manual</li>
                    <li><strong>Con sorteo programado:</strong> Sorteo automático en fecha/hora exacta</li>
                </ul>
            </div>
            '''
        }),
        ('Creación', {
            'fields': ('created_by', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
        ('Resultado del Sorteo', {
            'fields': ('winner', 'winner_link', 'drawn_at', 'drawn_by', 'is_drawn'),
            'classes': ('collapse',)
        }),
        ('Estadísticas', {
            'fields': ('participants_count_detail',),
            'classes': ('collapse',)
        }),
    )

    # ---- Métodos de visualización mejorados ----
    def status_badge(self, obj):
        colors = {
            'draft': '#6c757d',
            'active': '#28a745',
            'scheduled': '#007bff',
            'completed': '#17a2b8',
            'cancelled': '#dc3545'
        }
        color = colors.get(obj.status, '#6c757d')
        return format_html(
            '<span style="color:{}; font-weight:bold; padding:2px 6px; border-radius:3px; background-color:{}22;">{}</span>',
            color, color, obj.get_status_display()
        )
    status_badge.short_description = "Estado"

    def cover_image_preview(self, obj):
        if obj.cover_image:
            return mark_safe(
                f'<img src="{obj.cover_image.url}" style="width:40px; height:40px; object-fit:cover; border-radius:4px;" />'
            )
        return mark_safe('<span style="color:#999;">Sin portada</span>')
    cover_image_preview.short_description = "Portada"

    def cover_image_preview_large(self, obj):
        if obj.cover_image:
            return mark_safe(
                f'<img src="{obj.cover_image.url}" style="max-width:300px; max-height:200px; object-fit:cover; border-radius:8px; box-shadow:0 2px 8px rgba(0,0,0,0.1);" />'
            )
        return "Sin imagen de portada"
    cover_image_preview_large.short_description = "Vista previa de portada"

    def participation_period_display(self, obj):
        """Display mejorado del período de participación"""
        if not obj.participation_start and not obj.participation_end:
            return mark_safe('<span style="color:#28a745; font-weight:bold;">📅 Sin límites</span>')
        
        parts = []
        if obj.participation_start:
            start = obj.participation_start.strftime('%d/%m/%Y %H:%M')
            parts.append(f"Desde: {start}")
        else:
            parts.append("Desde: inmediato")
            
        if obj.participation_end:
            end = obj.participation_end.strftime('%d/%m/%Y %H:%M')
            parts.append(f"Hasta: {end}")
        else:
            parts.append("Hasta: sin límite")
            
        return format_html('<small>{}</small>', ' | '.join(parts))
    participation_period_display.short_description = "Período de Participación"

    def scheduled_date_display(self, obj):
        """Display del sorteo programado"""
        if not obj.scheduled_date:
            return mark_safe('<span style="color:#6c757d;">Manual</span>')
        
        scheduled = obj.scheduled_date.strftime('%d/%m/%Y %H:%M')
        if obj.is_drawn:
            return format_html('<span style="color:#17a2b8;">🎲 {}</span>', scheduled)
        else:
            return format_html('<span style="color:#007bff; font-weight:bold;">🎲 {}</span>', scheduled)
    scheduled_date_display.short_description = "Sorteo Programado"

    def date_configuration_summary(self, obj):
        """Resumen de la configuración de fechas"""
        html = "<div style='background: #f8f9fa; padding: 10px; border-radius: 4px; font-family: monospace;'>"
        html += "<strong>Configuración Actual:</strong><br><br>"
        
        # Participación
        html += "🎯 <strong>Participación:</strong><br>"
        if not obj.participation_start and not obj.participation_end:
            html += "&nbsp;&nbsp;• Sin restricciones de tiempo<br>"
        else:
            if obj.participation_start:
                html += f"&nbsp;&nbsp;• Inicio: {obj.participation_start.strftime('%d/%m/%Y %H:%M')}<br>"
            else:
                html += "&nbsp;&nbsp;• Inicio: Inmediato<br>"
                
            if obj.participation_end:
                html += f"&nbsp;&nbsp;• Fin: {obj.participation_end.strftime('%d/%m/%Y %H:%M')}<br>"
            else:
                html += "&nbsp;&nbsp;• Fin: Sin límite<br>"
        
        html += "<br>🎲 <strong>Sorteo:</strong><br>"
        if obj.scheduled_date:
            html += f"&nbsp;&nbsp;• Automático: {obj.scheduled_date.strftime('%d/%m/%Y %H:%M')}<br>"
        else:
            html += "&nbsp;&nbsp;• Manual (ejecutado por administrador)<br>"
            
        html += "</div>"
        return mark_safe(html)
    date_configuration_summary.short_description = "Resumen de Configuración"

    def participants_count(self, obj):
        count = obj.get_participants_count()
        max_count = getattr(getattr(obj, "settings", None), "max_participants", 0) or "∞"

        if isinstance(max_count, int) and max_count > 0:
            percentage = (count / max_count) * 100
            color = '#28a745' if percentage < 80 else '#ffc107' if percentage < 100 else '#dc3545'
            return format_html('<span style="color:{}; font-weight:bold;">{}/{}</span>', color, count, max_count)
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
        total = obj.prizes.count()
        active = obj.prizes.filter(is_active=True).count()

        if total == 0:
            return mark_safe('<span style="color:#999;">Sin premios</span>')

        color = '#28a745' if active == total else '#ffc107' if active > 0 else '#dc3545'
        return format_html('<span style="color:{};">🎁 {} ({} activos)</span>', color, total, active)
    prizes_count.short_description = "Premios"

    def winner_info(self, obj):
        if obj.winner:
            user = obj.winner.user
            name = user.get_full_name() or user.username
            return format_html('<span style="color:#28a745; font-weight:bold;">🏆 {}</span>', name)
        if obj.is_drawn:
            return format_html('<span style="color:#dc3545;">Sorteada sin ganador</span>')
        return mark_safe('<span style="color:#999;">Pendiente</span>')
    winner_info.short_description = "Ganador"

    def winner_link(self, obj):
        if obj.winner:
            try:
                url = reverse("admin:participants_participation_change", args=[obj.winner.id])
                return mark_safe(f'<a href="{url}">Ver participación ganadora</a>')
            except Exception:
                return "Ver participación (error en URL)"
        return "Sin ganador"
    winner_link.short_description = "Enlace al ganador"

    # ---- Acciones personalizadas ----
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
            self.message_user(request, f"✅ Sorteo ejecutado en {executed} ruleta(s).")

        if errors:
            error_msg = "❌ Errores encontrados:\n" + "\n".join(errors[:5])
            if len(errors) > 5:
                error_msg += f"\n... y {len(errors) - 5} errores más"
            self.message_user(request, error_msg, level='ERROR')
    admin_execute_draw.short_description = "🎲 Ejecutar sorteo manual"

    def mark_as_active(self, request, queryset):
        count = queryset.filter(status__in=['draft', 'scheduled']).update(status='active')
        self.message_user(request, f"✅ {count} ruleta(s) marcada(s) como activa(s).")
    mark_as_active.short_description = "✅ Marcar como activa"

    def mark_as_cancelled(self, request, queryset):
        count = queryset.exclude(status='completed').update(status='cancelled')
        self.message_user(request, f"❌ {count} ruleta(s) cancelada(s).")
    mark_as_cancelled.short_description = "❌ Cancelar ruletas"

    # ---- Personalización adicional ----
    class Media:
        css = {
            'all': ('/static/admin/css/custom_roulette_admin.css',)
        }
        js = ('/static/admin/js/roulette_admin.js',)


# ---------------- Admin: RouletteSettings ---------------- #

@admin.register(RouletteSettings)
class RouletteSettingsAdmin(admin.ModelAdmin):
    form = RouletteSettingsAdminForm
    list_display = (
        "roulette",
        "max_participants",
        "allow_multiple_entries",
        "auto_draw_when_full",
        "show_countdown"
    )
    list_select_related = ("roulette",)
    list_filter = ("allow_multiple_entries", "auto_draw_when_full", "show_countdown")
    search_fields = ("roulette__name",)
    ordering = ("-roulette__created_at",)

    fieldsets = (
        ('Configuración de Participantes', {
            'fields': ('roulette', 'max_participants', 'allow_multiple_entries')
        }),
        ('Automatización', {
            'fields': ('auto_draw_when_full', 'show_countdown')
        }),
        ('Notificaciones', {
            'fields': ('notify_on_participation', 'notify_on_draw')
        }),
    )


# ---------------- Admin: RoulettePrize ---------------- #

@admin.register(RoulettePrize)
class RoulettePrizeAdmin(admin.ModelAdmin):
    form = RoulettePrizeAdminForm
    list_display = (
        "name",
        "roulette",
        "image_preview",
        "stock",
        "probability",
        "display_order",
        "is_active",
        "updated_at"
    )
    list_select_related = ("roulette",)
    list_filter = ("roulette", "is_active", "created_at")
    search_fields = ("name", "roulette__name", "description")
    readonly_fields = ("created_at", "updated_at", "image_preview_large")
    ordering = ('roulette', 'display_order', '-created_at')

    fieldsets = (
        ('Información del Premio', {
            'fields': ('roulette', 'name', 'description', 'display_order')
        }),
        ('Imagen', {
            'fields': ('image', 'image_preview_large')
        }),
        ('Configuración', {
            'fields': ('stock', 'probability', 'is_active')
        }),
        ('Metadatos', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

    def image_preview(self, obj):
        if obj.image:
            return mark_safe(
                f'<img src="{obj.image.url}" style="width:50px; height:50px; object-fit:cover; border-radius:4px;" />'
            )
        return mark_safe('<span style="color:#999;">Sin imagen</span>')
    image_preview.short_description = "Imagen"

    def image_preview_large(self, obj):
        if obj.image:
            return mark_safe(
                f'<img src="{obj.image.url}" style="max-width:200px; max-height:200px; object-fit:cover; border-radius:8px;" />'
            )
        return "Sin imagen"
    image_preview_large.short_description = "Vista previa"


# ---------------- Admin: DrawHistory ---------------- #

@admin.register(DrawHistory)
class DrawHistoryAdmin(admin.ModelAdmin):
    list_display = (
        "roulette",
        "winner_name",
        "drawn_by",
        "draw_type",
        "drawn_at",
        "participants_count"
    )
    list_select_related = ("roulette", "drawn_by", "winner_selected__user")
    search_fields = ("roulette__name", "winner_selected__user__username", "drawn_by__username")
    list_filter = ("draw_type", "drawn_at")
    ordering = ("-drawn_at",)
    readonly_fields = ("random_seed", "ip_address", "user_agent")
    date_hierarchy = 'drawn_at'

    fieldsets = (
        ('Información del Sorteo', {
            'fields': ('roulette', 'winner_selected', 'drawn_by', 'draw_type', 'drawn_at')
        }),
        ('Estadísticas', {
            'fields': ('participants_count', 'random_seed')
        }),
        ('Metadatos de Auditoría', {
            'fields': ('ip_address', 'user_agent'),
            'classes': ('collapse',)
        }),
    )

    def winner_name(self, obj):
        if obj.winner_selected and obj.winner_selected.user:
            return obj.winner_selected.user.get_full_name() or obj.winner_selected.user.username
        return "Sin ganador"
    winner_name.short_description = "Ganador"


# ---------------- Configuración adicional del admin ---------------- #

# Personalización del CSS para los campos opcionales
admin_custom_css = """
<style>
.optional-field {
    background-color: #f8fff8 !important;
}

.field-participation_start .help,
.field-participation_end .help,
.field-scheduled_date .help {
    font-size: 12px !important;
    line-height: 1.4 !important;
}

.field-participation_start label:after,
.field-participation_end label:after,
.field-scheduled_date label:after {
    content: " ✓";
    color: #28a745;
    font-weight: bold;
}

.fieldset h2 {
    border-bottom: 2px solid #dee2e6;
    padding-bottom: 8px;
}

.help {
    margin-top: 8px !important;
}
</style>
"""

# JavaScript adicional para mejorar la experiencia
admin_custom_js = """
<script>
document.addEventListener('DOMContentLoaded', function() {
    // Agregar tooltips a campos opcionales
    const optionalFields = document.querySelectorAll('.optional-field');
    optionalFields.forEach(field => {
        field.title = 'Campo opcional - puede dejarse vacío';
    });
    
    // Validación en tiempo real para fechas
    const participationStart = document.querySelector('input[name="participation_start"]');
    const participationEnd = document.querySelector('input[name="participation_end"]');
    const scheduledDate = document.querySelector('input[name="scheduled_date"]');
    
    function validateDates() {
        const startVal = participationStart.value;
        const endVal = participationEnd.value;
        const scheduledVal = scheduledDate.value;
        
        // Limpiar errores previos
        document.querySelectorAll('.date-error').forEach(el => el.remove());
        
        if (startVal && endVal && startVal >= endVal) {
            showDateError(participationEnd, 'La fecha de fin debe ser posterior al inicio');
        }
        
        if (scheduledVal && endVal && scheduledVal <= endVal) {
            showDateError(scheduledDate, 'El sorteo debe ser posterior al fin de participación');
        }
    }
    
    function showDateError(field, message) {
        const error = document.createElement('div');
        error.className = 'date-error';
        error.style.color = '#dc3545';
        error.style.fontSize = '12px';
        error.style.marginTop = '4px';
        error.textContent = message;
        field.parentNode.appendChild(error);
    }
    
    if (participationStart) participationStart.addEventListener('change', validateDates);
    if (participationEnd) participationEnd.addEventListener('change', validateDates);
    if (scheduledDate) scheduledDate.addEventListener('change', validateDates);
});
</script>
"""

# Inyectar CSS y JS personalizados
def add_custom_admin_media():
    """Función para agregar CSS y JS personalizados al admin"""
    from django.contrib import admin
    from django.utils.safestring import mark_safe
    
    # Agregar al final de cada página del admin de ruletas
    admin.site.add_css = admin_custom_css
    admin.site.add_js = admin_custom_js

admin.site.site_header = "Administración de Ruletas"
admin.site.site_title = "Ruletas Admin"
admin.site.index_title = "Panel de Control - Sistema de Ruletas"

# Agregar descripción personalizada al índice del admin
admin.site.index_template = 'admin/custom_index.html'  # Opcional: crear template personalizado