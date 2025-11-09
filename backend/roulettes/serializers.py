from __future__ import annotations

import json
import logging
from typing import Any, Dict, Optional

from django.contrib.auth import get_user_model
from django.db import models
from django.utils import timezone
from rest_framework import serializers

from .models import (
    Roulette,
    RouletteSettings,
    DrawHistory,
    RoulettePrize,
    RouletteStatus,
)
from participants.models import Participation

User = get_user_model()
logger = logging.getLogger(__name__)

# ============================================================================
#                         HELPERS
# ============================================================================
def _abs_url(request, f) -> Optional[str]:
    """Devuelve URL absoluta si hay request; si no, la relativa del FileField."""
    if not f:
        return None
    try:
        url = f.url
    except Exception:
        return None
    return request.build_absolute_uri(url) if request else url


# ============================================================================
#                    ROULETTE SETTINGS - SERIALIZERS
# ============================================================================
class RouletteSettingsSerializer(serializers.ModelSerializer):
    """Serializer para lectura de configuración de ruleta (read-only)"""
    class Meta:
        model = RouletteSettings
        fields = [
            "max_participants",
            "allow_multiple_entries",
            "show_countdown",
            "notify_on_participation",
            "notify_on_draw",
            "winners_target",
            "require_receipt",
        ]


class RouletteSettingsWriteSerializer(serializers.Serializer):
    """Serializer para escribir/actualizar configuración de ruleta"""
    max_participants = serializers.IntegerField(required=False, min_value=0)
    allow_multiple_entries = serializers.BooleanField(required=False)
    show_countdown = serializers.BooleanField(required=False)
    notify_on_participation = serializers.BooleanField(required=False)
    notify_on_draw = serializers.BooleanField(required=False)
    winners_target = serializers.IntegerField(required=False, min_value=0)
    require_receipt = serializers.BooleanField(required=False)
    
    def validate_require_receipt(self, value):
        """Validar explícitamente el campo require_receipt"""
        if isinstance(value, str):
            return value.lower() in ('true', '1', 'yes', 'on')
        return bool(value)


# ============================================================================
#                    ROULETTE MAIN SERIALIZERS
# ============================================================================
class RouletteSerializer(serializers.ModelSerializer):
    """Serializer principal de ruleta (lectura)"""
    settings = RouletteSettingsSerializer(read_only=True)
    participants_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Roulette
        fields = [
            "id",
            "name",
            "description",
            "status",
            "cover_image",
            "participation_start",
            "participation_end",
            "scheduled_date",
            "is_drawn",
            "created_at",
            "updated_at",
            "participants_count",
            "settings",
        ]
        read_only_fields = [
            "id",
            "is_drawn",
            "created_at",
            "updated_at",
            "settings",
        ]

    def get_participants_count(self, obj):
        return obj.participations.filter(user__is_active=True).count()


# ============================================================================
#                    PRIZES SERIALIZERS
# ============================================================================
class RoulettePrizeSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()
    is_available = serializers.ReadOnlyField()
    position = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()

    class Meta:
        model = RoulettePrize
        fields = [
            "id",
            "name",
            "description",
            "image",
            "image_url",
            "stock",
            "display_order",
            "position",
            "is_active",
            "is_available",
            "status",
            "created_at",
            "updated_at",
        ]
    read_only_fields = ["id", "created_at", "updated_at", "position", "status"]

    def get_image_url(self, obj) -> Optional[str]:
        return _abs_url(self.context.get("request"), obj.image)

    def get_position(self, obj) -> Optional[int]:
        try:
            return int(obj.display_order)
        except Exception:
            return None

    def get_status(self, obj) -> str:
        return "sorteado" if not getattr(obj, "is_available", False) else "pendiente"

    def validate_stock(self, value: int) -> int:
        if value < 0:
            raise serializers.ValidationError("El stock no puede ser negativo.")
        return value

    def validate_display_order(self, value: int) -> int:
        if value < 0:
            raise serializers.ValidationError("El orden de visualización no puede ser negativo.")
        return value


# ============================================================================
#                    PARTICIPATIONS SERIALIZERS
# ============================================================================
class ParticipationLiteSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()
    user_avatar = serializers.SerializerMethodField()

    class Meta:
        model = Participation
        fields = [
            "id",
            "participant_number",
            "is_winner",
            "user_name",
            "user_avatar",
            "created_at",
        ]

    def get_user_name(self, obj) -> str:
        return obj.user.get_full_name() or obj.user.username

    def get_user_avatar(self, obj) -> Optional[str]:
        avatar = getattr(obj.user, "avatar", None)
        return _abs_url(self.context.get("request"), avatar)


# ============================================================================
#                    USER INFO SERIALIZER
# ============================================================================
class UserInfoSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "first_name", "last_name", "email"]


# ============================================================================
#                    ROULETTE LIST SERIALIZER
# ============================================================================
class RouletteListSerializer(serializers.ModelSerializer):
    participants_count = serializers.IntegerField(source="get_participants_count", read_only=True)
    winner_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    cover_image_url = serializers.SerializerMethodField()
    can_participate = serializers.SerializerMethodField()
    prizes_count = serializers.SerializerMethodField()
    participation_is_open = serializers.ReadOnlyField()
    time_remaining = serializers.SerializerMethodField()
    winners_count = serializers.SerializerMethodField()
    winners_target = serializers.SerializerMethodField()

    class Meta:
        model = Roulette
        fields = [
            "id",
            "name",
            "slug",
            "description",
            "status",
            "is_drawn",
            "participants_count",
            "prizes_count",
            "winner_name",
            "created_by_name",
            "created_at",
            "participation_start",
            "participation_end",
            "scheduled_date",
            "drawn_at",
            "cover_image",
            "cover_image_url",
            "can_participate",
            "participation_is_open",
            "time_remaining",
            "winners_count",
            "winners_target",
        ]

    def get_winner_name(self, obj) -> Optional[str]:
        if obj.winner and obj.winner.user:
            return obj.winner.user.get_full_name() or obj.winner.user.username
        return None

    def get_created_by_name(self, obj) -> Optional[str]:
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return None

    def get_cover_image_url(self, obj) -> Optional[str]:
        return _abs_url(self.context.get("request"), obj.cover_image)

    def get_prizes_count(self, obj) -> int:
        return obj.prizes.filter(is_active=True, stock__gt=0).count()

    def get_can_participate(self, obj) -> Dict[str, Any]:
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            allowed, reason = obj.can_participate(request.user)
            return {"allowed": allowed, "reason": reason}
        return {"allowed": False, "reason": "No autenticado"}

    def _diff_dict(self, dt):
        return {
            "total_seconds": int(dt.total_seconds()),
            "days": dt.days,
            "hours": dt.seconds // 3600,
            "minutes": (dt.seconds % 3600) // 60,
        }

    def get_time_remaining(self, obj) -> Optional[Dict[str, Any]]:
        now = timezone.now()
        result: Dict[str, Any] = {}

        if obj.participation_start and now < obj.participation_start:
            result["until_participation_start"] = self._diff_dict(obj.participation_start - now)

        if obj.participation_end and now < obj.participation_end:
            result["until_participation_end"] = self._diff_dict(obj.participation_end - now)

        if obj.scheduled_date and now < obj.scheduled_date:
            result["until_draw"] = self._diff_dict(obj.scheduled_date - now)

        return result or None

    def get_winners_count(self, obj) -> int:
        count = obj.participations.filter(is_winner=True).count()
        if obj.winner_id and not obj.participations.filter(pk=obj.winner_id, is_winner=True).exists():
            count += 1
        return count

    def get_winners_target(self, obj) -> int:
        return obj.winners_target_effective()


# ============================================================================
#                    ROULETTE DETAIL SERIALIZER
# ============================================================================
class RouletteDetailSerializer(serializers.ModelSerializer):
    participants_count = serializers.IntegerField(source="get_participants_count", read_only=True)
    participants = ParticipationLiteSerializer(source="get_participants_list", many=True, read_only=True)
    winner_name = serializers.SerializerMethodField()
    winner_detail = serializers.SerializerMethodField()
    created_by = UserInfoSerializer(read_only=True)
    prizes = RoulettePrizeSerializer(many=True, read_only=True)
    settings = RouletteSettingsSerializer(read_only=True)
    cover_image_url = serializers.SerializerMethodField()
    can_participate = serializers.SerializerMethodField()
    participation_is_open = serializers.ReadOnlyField()
    time_remaining = serializers.SerializerMethodField()
    statistics = serializers.SerializerMethodField()
    winners_count = serializers.SerializerMethodField()
    winners_target = serializers.SerializerMethodField()

    class Meta:
        model = Roulette
        fields = [
            "id",
            "name",
            "slug",
            "description",
            "status",
            "is_drawn",
            "participants_count",
            "participants",
            "winner_name",
            "winner_detail",
            "created_by",
            "created_at",
            "updated_at",
            "participation_start",
            "participation_end",
            "scheduled_date",
            "drawn_at",
            "drawn_by",
            "prizes",
            "settings",
            "cover_image",
            "cover_image_url",
            "can_participate",
            "participation_is_open",
            "time_remaining",
            "statistics",
            "winners_count",
            "winners_target",
        ]

    def get_winner_name(self, obj) -> Optional[str]:
        if obj.winner and obj.winner.user:
            return obj.winner.user.get_full_name() or obj.winner.user.username
        return None

    def get_winner_detail(self, obj) -> Optional[Dict[str, Any]]:
        if obj.winner:
            return ParticipationLiteSerializer(obj.winner, context=self.context).data
        return None

    def get_cover_image_url(self, obj) -> Optional[str]:
        return _abs_url(self.context.get("request"), obj.cover_image)

    def get_can_participate(self, obj) -> Dict[str, Any]:
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            allowed, reason = obj.can_participate(request.user)
            return {"allowed": allowed, "reason": reason}
        return {"allowed": False, "reason": "No autenticado"}

    def _diff_dict(self, dt):
        return {
            "total_seconds": int(dt.total_seconds()),
            "days": dt.days,
            "hours": dt.seconds // 3600,
            "minutes": (dt.seconds % 3600) // 60,
        }

    def get_time_remaining(self, obj) -> Optional[Dict[str, Any]]:
        now = timezone.now()
        result: Dict[str, Any] = {}

        if obj.participation_start and now < obj.participation_start:
            result["until_participation_start"] = self._diff_dict(obj.participation_start - now)

        if obj.participation_end and now < obj.participation_end:
            result["until_participation_end"] = self._diff_dict(obj.participation_end - now)

        if obj.scheduled_date and now < obj.scheduled_date:
            result["until_draw"] = self._diff_dict(obj.scheduled_date - now)

        return result or None

    def get_statistics(self, obj) -> Dict[str, Any]:
        return {
            "total_prizes": obj.prizes.count(),
            "active_prizes": obj.prizes.filter(is_active=True).count(),
            "available_awards": obj.available_awards_count(),
            "total_stock": obj.prizes.aggregate(total=models.Sum("stock"))["total"] or 0,
            "draw_history_count": obj.draw_history.count(),
        }

    def get_winners_count(self, obj) -> int:
        count = obj.participations.filter(is_winner=True).count()
        if obj.winner_id and not obj.participations.filter(pk=obj.winner_id, is_winner=True).exists():
            count += 1
        return count

    def get_winners_target(self, obj) -> int:
        return obj.winners_target_effective()


# ============================================================================
#                ROULETTE CREATE/UPDATE SERIALIZER - ✅ CORREGIDO v3
# ============================================================================
class RouletteCreateUpdateSerializer(serializers.ModelSerializer):
    """
    ✅ CORREGIDO v3: Crea/actualiza ruletas con settings como JSON string
    Maneja FormData + archivos + settings parseados correctamente
    """
    settings = RouletteSettingsWriteSerializer(required=False, allow_null=True)
    
    class Meta:
        model = Roulette
        fields = [
            "id",
            "name",
            "description",
            "status",
            "cover_image",
            "participation_start",
            "participation_end",
            "scheduled_date",
            "settings",
        ]
        read_only_fields = ["id"]

    def to_internal_value(self, data):
        """
        ✅ OVERRIDE: Extrae settings como JSON string de FormData
        En FormData, settings llega como string JSON en request.POST
        """
        settings_data = data.get('settings')
        logger.info(f"✅ to_internal_value() - settings de data.get(): {settings_data}")
        
        # Buscar en request.POST si no viene en data
        if not settings_data and self.context.get('request'):
            try:
                request = self.context['request']
                settings_str = request.POST.get('settings')
                if settings_str:
                    logger.info(f"✅ to_internal_value() - encontrado en request.POST: {settings_str}")
                    settings_data = settings_str
                else:
                    logger.warning(f"⚠️ settings NO encontrado en request.POST")
            except Exception as e:
                logger.warning(f"⚠️ Error accediendo a request.POST: {e}")
        
        # Procesar con el serializer estándar
        ret = super().to_internal_value(data)
        
        # Agregar settings si se encontró
        if settings_data:
            logger.info(f"✅ to_internal_value() - Agregando settings: {settings_data}")
            ret['settings'] = settings_data
        
        logger.info(f"✅ to_internal_value() - ret final: {ret.get('settings', 'SIN SETTINGS')}")
        return ret

    def validate(self, data):
        """
        ✅ Validación adicional para settings desde FormData
        """
        logger.info(f"✅ validate() - settings recibido: {data.get('settings', 'SIN SETTINGS')}")
        
        if 'settings' not in data:
            try:
                request = self.context.get('request')
                if request:
                    settings_data = request.data.get('settings')
                    if settings_data:
                        logger.info(f"✅ validate() - restaurando de request.data: {settings_data}")
                        data['settings'] = settings_data
            except Exception as e:
                logger.warning(f"⚠️ validate() - Error: {e}")
        
        return data

    def _normalize_dates(self, validated_data):
        """Normalizar fechas None"""
        for field in ["participation_start", "participation_end", "scheduled_date"]:
            if field in validated_data and not validated_data[field]:
                validated_data[field] = None
        return validated_data

    def _ensure_settings(self, roulette, settings_data=None):
        """
        ✅ CORREGIDO v3: Crea/actualiza RouletteSettings de forma segura
        - Parsea JSON string si es necesario
        - Valida booleanos correctamente
        - Evita duplicados con update_or_create
        """
        # Estado base seguro
        defaults = {
            'max_participants': 0,
            'allow_multiple_entries': False,
            'show_countdown': True,
            'notify_on_participation': True,
            'notify_on_draw': True,
            'winners_target': 0,
            'require_receipt': True,
        }

        logger.info(f"🔧 _ensure_settings() - Iniciando para roulette {roulette.id}")
        logger.info(f"   settings_data: {settings_data}")
        logger.info(f"   tipo: {type(settings_data)}")
        
        # ✅ PASO 1: Si settings_data es STRING JSON, parsearlo a DICCIONARIO
        if isinstance(settings_data, str):
            logger.info(f"   📝 Parseando JSON string...")
            try:
                settings_data = json.loads(settings_data)
                logger.info(f"   ✅ Parseado correctamente: {settings_data}")
            except json.JSONDecodeError as e:
                logger.error(f"   ❌ Error en JSON: {e}")
                settings_data = None
        
        # ✅ PASO 2: Procesar diccionario si existe
        if isinstance(settings_data, dict) and settings_data:
            logger.info(f"   ✅ Procesando diccionario")
            
            # Booleanos
            bool_fields = ['allow_multiple_entries', 'show_countdown', 
                          'notify_on_participation', 'notify_on_draw', 'require_receipt']
            
            for bool_field in bool_fields:
                if bool_field in settings_data:
                    raw_value = settings_data[bool_field]
                    new_value = bool(raw_value)
                    defaults[bool_field] = new_value
                    logger.info(f"      ✅ {bool_field}: {repr(raw_value)} → {new_value}")
            
            # Numéricos
            for num_field in ['max_participants', 'winners_target']:
                if num_field in settings_data:
                    try:
                        new_value = int(settings_data[num_field])
                        defaults[num_field] = new_value
                        logger.info(f"      ✅ {num_field}: {new_value}")
                    except (ValueError, TypeError) as e:
                        logger.warning(f"      ⚠️ {num_field} error: {e}")
        
        logger.info(f"   ✅ Defaults finales: {defaults}")
        
        # ✅ PASO 3: Guardar en BD
        try:
            settings_obj, created = RouletteSettings.objects.update_or_create(
                roulette=roulette,
                defaults=defaults
            )
            
            action = "CREADO" if created else "ACTUALIZADO"
            logger.info(f"   ✅ Settings {action} exitosamente")
            logger.info(f"      require_receipt en BD: {settings_obj.require_receipt}")
            
            return settings_obj
            
        except Exception as e:
            logger.error(f"   ❌ Error guardando: {e}", exc_info=True)
            raise

    def create(self, validated_data):
        """✅ Crea ruleta y settings de forma segura"""
        # Extraer settings
        settings_data = validated_data.pop("settings", None)
        logger.info(f"✅ create() - settings extraído: {settings_data} (tipo: {type(settings_data)})")
        
        # Normalizar fechas
        validated_data = self._normalize_dates(validated_data)
        
        # Crear ruleta
        roulette = Roulette.objects.create(**validated_data)
        logger.info(f"✅ Ruleta creada: {roulette.id}")
        
        # Crear settings (parsea JSON si es necesario)
        self._ensure_settings(roulette, settings_data)
        
        roulette.refresh_from_db()
        return roulette

    def update(self, instance, validated_data):
        """✅ Actualiza ruleta y settings de forma segura"""
        cover_delete = validated_data.pop("cover_delete", False)
        settings_data = validated_data.pop("settings", None)
        logger.info(f"✅ update() - settings extraído: {settings_data} (tipo: {type(settings_data)})")
        
        # Normalizar fechas
        validated_data = self._normalize_dates(validated_data)
        
        # Manejo de imagen
        if cover_delete and getattr(instance, "cover_image", None):
            try:
                instance.cover_image.delete(save=False)
            except Exception as e:
                logger.warning(f"No se pudo eliminar imagen: {e}")
            validated_data["cover_image"] = None
        
        # Actualizar campos
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        logger.info(f"✅ Ruleta actualizada: {instance.id}")
        
        # Actualizar settings (parsea JSON si es necesario)
        self._ensure_settings(instance, settings_data)
        
        instance.refresh_from_db()
        return instance


# ============================================================================
#                    DRAW EXECUTE SERIALIZER
# ============================================================================
class DrawExecuteSerializer(serializers.Serializer):
    roulette_id = serializers.IntegerField()
    count = serializers.IntegerField(required=False, min_value=1, default=1)

    def validate(self, attrs):
        rid = attrs["roulette_id"]
        count = attrs.get("count", 1)

        try:
            roulette = Roulette.objects.get(pk=rid)
        except Roulette.DoesNotExist:
            raise serializers.ValidationError({"roulette_id": "Ruleta no encontrada"})

        if roulette.is_drawn or roulette.status == RouletteStatus.COMPLETED:
            raise serializers.ValidationError("La ruleta ya fue sorteada.")

        total_participants = roulette.participations.count()
        if total_participants == 0:
            raise serializers.ValidationError("No hay participantes para sortear.")

        eligibles = roulette.participations.filter(is_winner=False).count()
        if eligibles == 0:
            raise serializers.ValidationError("No quedan participantes elegibles para ganar.")

        settings = getattr(roulette, "settings", None)
        target = int(getattr(settings, "winners_target", 0) or 0)

        already = roulette.participations.filter(is_winner=True).count()
        if roulette.winner_id and not roulette.participations.filter(pk=roulette.winner_id, is_winner=True).exists():
            already += 1

        available_stock = max(roulette.available_awards_count(), 0)
        if available_stock <= 0:
            raise serializers.ValidationError("No quedan premios disponibles.")

        if target > 0:
            if already >= target and available_stock <= 0:
                raise serializers.ValidationError("Se alcanzó la meta de ganadores y no quedan más premios.")
            attrs["count"] = min(count, available_stock, eligibles)
        else:
            attrs["count"] = min(count, available_stock, eligibles)

        request = self.context.get("request")
        user = getattr(request, "user", None)
        if user is None or not user.is_authenticated:
            raise serializers.ValidationError("Autenticación requerida para ejecutar el sorteo.")
        if not (user.is_staff or getattr(user, "is_superuser", False) or getattr(user, "user_type", "") == "admin"):
            raise serializers.ValidationError("No tienes permisos para ejecutar el sorteo.")

        attrs["validated_roulette"] = roulette
        return attrs


# ============================================================================
#                    DRAW HISTORY SERIALIZER
# ============================================================================
class DrawHistorySerializer(serializers.ModelSerializer):
    roulette_name = serializers.CharField(source="roulette.name", read_only=True)
    roulette_slug = serializers.CharField(source="roulette.slug", read_only=True)
    winner_name = serializers.SerializerMethodField()
    winner_detail = serializers.SerializerMethodField()
    drawn_by_name = serializers.SerializerMethodField()

    class Meta:
        model = DrawHistory
        fields = [
            "id",
            "roulette",
            "roulette_name",
            "roulette_slug",
            "winner_selected",
            "winner_name",
            "winner_detail",
            "drawn_by",
            "drawn_by_name",
            "draw_type",
            "drawn_at",
            "participants_count",
            "random_seed",
        ]

    def get_winner_name(self, obj) -> Optional[str]:
        if obj.winner_selected and obj.winner_selected.user:
            return obj.winner_selected.user.get_full_name() or obj.winner_selected.user.username
        return None

    def get_winner_detail(self, obj) -> Optional[Dict[str, Any]]:
        if obj.winner_selected:
            return ParticipationLiteSerializer(obj.winner_selected, context=self.context).data
        return None

    def get_drawn_by_name(self, obj) -> Optional[str]:
        if obj.drawn_by:
            return obj.drawn_by.get_full_name() or obj.drawn_by.username
        return None


# ============================================================================
#                PRIZE CREATE/UPDATE SERIALIZER
# ============================================================================
class RoulettePrizeCreateUpdateSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField(read_only=True)
    position = serializers.IntegerField(required=False, allow_null=True, write_only=True)

    class Meta:
        model = RoulettePrize
        fields = [
            "name",
            "description",
            "image",
            "image_url",
            "stock",
            "display_order",
            "position",
            "is_active",
        ]

    def get_image_url(self, obj) -> Optional[str]:
        return _abs_url(self.context.get("request"), obj.image)

    def validate(self, attrs):
        if "position" in attrs and attrs["position"] is not None:
            pos = attrs.pop("position")
            attrs["display_order"] = int(pos)

        display_order = attrs.get("display_order")
        roulette = self.context.get("roulette")

        if display_order is not None:
            if display_order < 0:
                raise serializers.ValidationError(
                    {"display_order": "El orden de visualización no puede ser negativo."}
                )
            if roulette:
                existing = RoulettePrize.objects.filter(
                    roulette=roulette, display_order=display_order
                ).exclude(pk=self.instance.pk if self.instance else None)
                if existing.exists():
                    raise serializers.ValidationError(
                        {"display_order": "Ya existe un premio con este orden de visualización."}
                    )

        return attrs

    def create(self, validated_data):
        roulette = self.context.get("roulette")
        if roulette:
            validated_data["roulette"] = roulette
        instance = RoulettePrize.objects.create(**validated_data)
        instance.refresh_from_db()
        return instance

    def update(self, instance, validated_data):
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        instance.refresh_from_db()
        return instance


# ============================================================================
#                ROULETTE STATS SERIALIZER
# ============================================================================
class RouletteStatsSerializer(serializers.Serializer):
    """
    Serializer de solo lectura que devuelve estadísticas
    Instancia con un objeto Roulette
    """
    roulette_info = serializers.DictField(read_only=True)
    participants = serializers.DictField(read_only=True)
    winner_info = serializers.DictField(allow_null=True, read_only=True)
    prizes_info = serializers.DictField(read_only=True)
    participation_trends = serializers.DictField(required=False, read_only=True)

    def to_representation(self, instance: Roulette) -> Dict[str, Any]:
        roulette_info = {
            "id": instance.id,
            "name": instance.name,
            "slug": instance.slug,
            "status": instance.status,
            "is_drawn": instance.is_drawn,
            "winners_target": instance.winners_target_effective(),
            "scheduled_date": instance.scheduled_date,
            "participation_start": instance.participation_start,
            "participation_end": instance.participation_end,
        }

        total_participants = instance.participations.count()
        winners_count = instance.participations.filter(is_winner=True).count()
        if instance.winner_id and not instance.participations.filter(pk=instance.winner_id, is_winner=True).exists():
            winners_count += 1

        participants = {
            "total": total_participants,
            "winners": winners_count,
            "eligible": max(total_participants - winners_count, 0),
        }

        winner_info = None
        if instance.winner:
            winner_info = ParticipationLiteSerializer(instance.winner, context=self.context).data

        prizes_qs = instance.prizes.all()
        prizes_info = {
            "total": prizes_qs.count(),
            "active": prizes_qs.filter(is_active=True).count(),
            "available_awards": instance.available_awards_count(),
            "total_stock": prizes_qs.aggregate(total=models.Sum("stock"))["total"] or 0,
        }

        participation_trends = {}

        return {
            "roulette_info": roulette_info,
            "participants": participants,
            "winner_info": winner_info,
            "prizes_info": prizes_info,
            "participation_trends": participation_trends,
        }