from __future__ import annotations

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


# =========================
# Helpers
# =========================
def _abs_url(request, f) -> Optional[str]:
    """Devuelve URL absoluta si hay request; si no, la relativa del FileField."""
    if not f:
        return None
    try:
        url = f.url
    except Exception:
        return None
    return request.build_absolute_uri(url) if request else url


# =========================
# Roulette Settings
# =========================
class RouletteSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = RouletteSettings
        fields = [
            "max_participants",
            "allow_multiple_entries",
            # eliminado: "auto_draw_when_full"
            "show_countdown",
            "notify_on_participation",
            "notify_on_draw",
            "winners_target",  # 0 = auto (premios disponibles), >0 = fijo
        ]

    def validate_winners_target(self, value: int) -> int:
        if value < 0:
            raise serializers.ValidationError("winners_target no puede ser negativo")
        return value


# =========================
# Prizes (SIN probabilidad)
# =========================
class RoulettePrizeSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()
    is_available = serializers.ReadOnlyField()
    # Exponer "position" como alias legible de display_order
    position = serializers.SerializerMethodField()
    # Estado legible para la UI
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
        # Consideramos “sorteado” si ya no está disponible (stock==0 ó inactivo)
        return "sorteado" if not getattr(obj, "is_available", False) else "pendiente"

    def validate_stock(self, value: int) -> int:
        if value < 0:
            raise serializers.ValidationError("El stock no puede ser negativo.")
        return value

    def validate_display_order(self, value: int) -> int:
        if value < 0:
            raise serializers.ValidationError("El orden de visualización no puede ser negativo.")
        return value


# =========================
# Participations (lite)
# =========================
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


# =========================
# User Info
# =========================
class UserInfoSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "first_name", "last_name", "email"]


# =========================
# Roulette List
# =========================
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
        # Premios que realmente “cuentan” (activos y con stock > 0)
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
        # Si hay winner_id “principal” no marcado en participations, contarlo también
        if obj.winner_id and not obj.participations.filter(pk=obj.winner_id, is_winner=True).exists():
            count += 1
        return count

    def get_winners_target(self, obj) -> int:
        return obj.winners_target_effective()


# =========================
# Roulette Detail
# =========================
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
            "available_awards": obj.available_awards_count(),  # premios que cuentan para winners
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


# =========================
# Create / Update
# =========================
class RouletteCreateUpdateSerializer(serializers.ModelSerializer):
    # 'name' requerido solo en create; opcional en update
    name = serializers.CharField(required=False, allow_blank=False)
    cover_delete = serializers.BooleanField(write_only=True, required=False, default=False)
    settings = RouletteSettingsSerializer(required=False)
    cover_image_url = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Roulette
        fields = [
            "name",
            "description",
            "participation_start",
            "participation_end",
            "scheduled_date",
            "status",
            "cover_image",
            "cover_image_url",
            "cover_delete",
            "settings",
        ]

    def get_cover_image_url(self, obj) -> Optional[str]:
        return _abs_url(self.context.get("request"), obj.cover_image)

    def validate(self, attrs):
        participation_start = attrs.get("participation_start")
        participation_end = attrs.get("participation_end")
        scheduled_date = attrs.get("scheduled_date")
        now = timezone.now()

        instance = getattr(self, "instance", None)
        is_editing = instance is not None

        if participation_start and participation_end:
            if participation_start >= participation_end:
                raise serializers.ValidationError(
                    {"participation_end": "La fecha de fin debe ser posterior al inicio."}
                )

        if scheduled_date:
            if not is_editing and scheduled_date <= now:
                raise serializers.ValidationError(
                    {"scheduled_date": "La fecha programada debe ser futura para nuevas ruletas."}
                )
            if participation_end and scheduled_date <= participation_end:
                raise serializers.ValidationError(
                    {"scheduled_date": "El sorteo debe ser posterior al fin de participación."}
                )

        # Normalizar campos vacíos -> None
        for field in ["participation_start", "participation_end", "scheduled_date"]:
            if field in attrs and (attrs[field] == "" or attrs[field] is None):
                attrs[field] = None

        return attrs

    def _apply_settings(self, instance: Roulette, settings_data: Optional[Dict[str, Any]]):
        """
        Crea/actualiza settings de manera segura.
        winners_target: 0 = automático (premios disponibles).
        """
        if settings_data is None:
            if not hasattr(instance, "settings") or not instance.settings:
                RouletteSettings.objects.create(
                    roulette=instance,
                    max_participants=0,
                    allow_multiple_entries=False,
                    # eliminado: auto_draw_when_full
                    show_countdown=True,
                    notify_on_participation=True,
                    notify_on_draw=True,
                    winners_target=0,  # AUTO por defecto
                )
            return

        if hasattr(instance, "settings") and instance.settings:
            for key, value in settings_data.items():
                setattr(instance.settings, key, value)
            instance.settings.save()
        else:
            RouletteSettings.objects.create(roulette=instance, **settings_data)

    def create(self, validated_data):
        # Asegurar que name sea requerido SOLO en creación
        if not validated_data.get("name"):
            raise serializers.ValidationError({"name": "Este campo es requerido al crear."})

        validated_data.pop("cover_delete", False)  # no aplica en create
        settings_data = validated_data.pop("settings", None)

        # Normalizar fechas None
        for f in ["participation_start", "participation_end", "scheduled_date"]:
            if f in validated_data and not validated_data[f]:
                validated_data[f] = None

        instance = Roulette.objects.create(**validated_data)

        # Crear/actualizar settings
        self._apply_settings(instance, settings_data)

        instance.refresh_from_db()
        return instance

    def update(self, instance, validated_data):
        cover_delete = validated_data.pop("cover_delete", False)
        settings_data = validated_data.pop("settings", None)

        # Normalizar fechas
        for f in ["participation_start", "participation_end", "scheduled_date"]:
            if f in validated_data and not validated_data[f]:
                validated_data[f] = None

        # Manejo de imagen de portada
        if cover_delete and getattr(instance, "cover_image", None):
            try:
                instance.cover_image.delete(save=False)
            except Exception as e:
                import logging
                logging.getLogger(__name__).warning(f"No se pudo eliminar imagen física: {e}")
            validated_data["cover_image"] = None

        # Settings (incluye winners_target)
        self._apply_settings(instance, settings_data)

        # Actualizar campos de ruleta
        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        instance.save()
        instance.refresh_from_db()
        return instance


# =========================
# Draw Execute
# =========================
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

        # Verificar elegibles (no ganadores)
        eligibles = roulette.participations.filter(is_winner=False).count()
        if eligibles == 0:
            raise serializers.ValidationError("No quedan participantes elegibles para ganar.")

        # LÓGICA DE BLOQUEO:
        # - Meta fija (>0): bloquear al alcanzar meta (winners_count >= target)
        # - Automático (0): NO usar winners_target_effective; solo exigir stock > 0
        settings = getattr(roulette, "settings", None)
        target = int(getattr(settings, "winners_target", 0) or 0)

        already = roulette.participations.filter(is_winner=True).count()
        if roulette.winner_id and not roulette.participations.filter(pk=roulette.winner_id, is_winner=True).exists():
            already += 1

        if target > 0:
            remaining_to_target = max(target - already, 0)
            if remaining_to_target == 0:
                raise serializers.ValidationError("Ya se alcanzó la cantidad de ganadores objetivo.")
            # Ajustar count para no exceder la meta
            attrs["count"] = min(count, remaining_to_target, eligibles)
        else:
            # Automático por stock: solo verificar stock disponible
            available_stock = max(roulette.available_awards_count(), 0)
            if available_stock <= 0:
                raise serializers.ValidationError("No quedan premios disponibles.")
            # Ajustar count a stock y elegibles
            attrs["count"] = min(count, available_stock, eligibles)

        # Permisos (defensivo para evitar KeyError 'request')
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if user is None or not user.is_authenticated:
            raise serializers.ValidationError("Autenticación requerida para ejecutar el sorteo.")
        if not (user.is_staff or getattr(user, "is_superuser", False) or getattr(user, "user_type", "") == "admin"):
            raise serializers.ValidationError("No tienes permisos para ejecutar el sorteo.")

        attrs["validated_roulette"] = roulette
        return attrs


# =========================
# Draw History
# =========================
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


# =========================
# Prize Create/Update (SIN probabilidad)
# =========================
class RoulettePrizeCreateUpdateSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField(read_only=True)
    # aceptar "position" como alias de display_order en entrada
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
            "position",  # write-only, alias
            "is_active",
        ]

    def get_image_url(self, obj) -> Optional[str]:
        return _abs_url(self.context.get("request"), obj.image)

    def validate(self, attrs):
        # Mapear position -> display_order si llegó
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


# =========================
# Roulette Stats (utilitario)
# =========================
class RouletteStatsSerializer(serializers.Serializer):
    """
    Serializer de solo lectura que devuelve un paquete de estadísticas.
    Puedes instanciarlo con un objeto Roulette y hará los cálculos en
    to_representation(). No requiere campos de entrada.
    """

    roulette_info = serializers.DictField(read_only=True)
    participants = serializers.DictField(read_only=True)
    winner_info = serializers.DictField(allow_null=True, read_only=True)
    prizes_info = serializers.DictField(read_only=True)
    participation_trends = serializers.DictField(required=False, read_only=True)

    def to_representation(self, instance: Roulette) -> Dict[str, Any]:
        # Info básica de la ruleta
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

        # Participantes
        total_participants = instance.participations.count()
        winners_count = instance.participations.filter(is_winner=True).count()
        # Si existe winner_id “principal” fuera del flag, contarlo
        if instance.winner_id and not instance.participations.filter(pk=instance.winner_id, is_winner=True).exists():
            winners_count += 1

        participants = {
            "total": total_participants,
            "winners": winners_count,
            "eligible": max(total_participants - winners_count, 0),
        }

        # Ganador “principal”
        winner_info = None
        if instance.winner:
            winner_info = ParticipationLiteSerializer(instance.winner, context=self.context).data

        # Premios
        prizes_qs = instance.prizes.all()
        prizes_info = {
            "total": prizes_qs.count(),
            "active": prizes_qs.filter(is_active=True).count(),
            "available_awards": instance.available_awards_count(),
            "total_stock": prizes_qs.aggregate(total=models.Sum("stock"))["total"] or 0,
        }

        # Tendencias / placeholder (si en el futuro agregas series de tiempo)
        participation_trends = {}

        return {
            "roulette_info": roulette_info,
            "participants": participants,
            "winner_info": winner_info,
            "prizes_info": prizes_info,
            "participation_trends": participation_trends,
        }
    

