from rest_framework import serializers
from django.utils import timezone
from django.db import models
from django.contrib.auth import get_user_model

from .models import (
    Roulette,
    RouletteSettings,
    DrawHistory,
    RoulettePrize,
    RouletteStatus,
)
from participants.models import Participation

User = get_user_model()


# ====== Settings ======
class RouletteSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = RouletteSettings
        fields = [
            "max_participants",
            "allow_multiple_entries",
            "auto_draw_when_full",
            "show_countdown",
            "notify_on_participation",
            "notify_on_draw",
        ]


# ====== Prizes ======
class RoulettePrizeSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()
    is_available = serializers.ReadOnlyField()

    class Meta:
        model = RoulettePrize
        fields = [
            "id",
            "name",
            "description",
            "image",
            "image_url",
            "stock",
            "probability",
            "display_order",
            "is_active",
            "is_available",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_image_url(self, obj):
        if obj.image:
            request = self.context.get("request")
            return request.build_absolute_uri(obj.image.url) if request else obj.image.url
        return None

    def validate_stock(self, value):
        if value < 0:
            raise serializers.ValidationError("El stock no puede ser negativo.")
        return value

    def validate_probability(self, value):
        if value is not None and (value < 0 or value > 100):
            raise serializers.ValidationError("La probabilidad debe estar entre 0 y 100.")
        return value

    def validate_display_order(self, value):
        if value < 0:
            raise serializers.ValidationError("El orden de visualización no puede ser negativo.")
        return value


# ====== Participations (lite) ======
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

    def get_user_name(self, obj):
        return obj.user.get_full_name() or obj.user.username

    def get_user_avatar(self, obj):
        if hasattr(obj.user, "avatar") and obj.user.avatar:
            request = self.context.get("request")
            return request.build_absolute_uri(obj.user.avatar.url) if request else obj.user.avatar.url
        return None


# ====== User Info ======
class UserInfoSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "first_name", "last_name", "email"]


# ====== Roulette List ======
class RouletteListSerializer(serializers.ModelSerializer):
    participants_count = serializers.IntegerField(source="get_participants_count", read_only=True)
    winner_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    cover_image_url = serializers.SerializerMethodField()
    can_participate = serializers.SerializerMethodField()
    prizes_count = serializers.SerializerMethodField()
    participation_is_open = serializers.ReadOnlyField()
    time_remaining = serializers.SerializerMethodField()

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
        ]

    def get_winner_name(self, obj):
        if obj.winner and obj.winner.user:
            return obj.winner.user.get_full_name() or obj.winner.user.username
        return None

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return None

    def get_cover_image_url(self, obj):
        if obj.cover_image:
            request = self.context.get("request")
            return request.build_absolute_uri(obj.cover_image.url) if request else obj.cover_image.url
        return None

    def get_prizes_count(self, obj):
        return obj.prizes.filter(is_active=True).count()

    def get_can_participate(self, obj):
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            can_participate, reason = obj.can_participate(request.user)
            return {"allowed": can_participate, "reason": reason}
        return {"allowed": False, "reason": "No autenticado"}

    def get_time_remaining(self, obj):
        now = timezone.now()
        result = {}

        if obj.participation_start and now < obj.participation_start:
            diff = obj.participation_start - now
            result["until_participation_start"] = {
                "total_seconds": int(diff.total_seconds()),
                "days": diff.days,
                "hours": diff.seconds // 3600,
                "minutes": (diff.seconds % 3600) // 60,
            }

        if obj.participation_end and now < obj.participation_end:
            diff = obj.participation_end - now
            result["until_participation_end"] = {
                "total_seconds": int(diff.total_seconds()),
                "days": diff.days,
                "hours": diff.seconds // 3600,
                "minutes": (diff.seconds % 3600) // 60,
            }

        if obj.scheduled_date and now < obj.scheduled_date:
            diff = obj.scheduled_date - now
            result["until_draw"] = {
                "total_seconds": int(diff.total_seconds()),
                "days": diff.days,
                "hours": diff.seconds // 3600,
                "minutes": (diff.seconds % 3600) // 60,
            }

        return result if result else None


# ====== Roulette Detail ======
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
        ]

    def get_winner_name(self, obj):
        if obj.winner and obj.winner.user:
            return obj.winner.user.get_full_name() or obj.winner.user.username
        return None

    def get_winner_detail(self, obj):
        if obj.winner:
            return ParticipationLiteSerializer(obj.winner, context=self.context).data
        return None

    def get_cover_image_url(self, obj):
        if obj.cover_image:
            request = self.context.get("request")
            return request.build_absolute_uri(obj.cover_image.url) if request else obj.cover_image.url
        return None

    def get_can_participate(self, obj):
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            can_participate, reason = obj.can_participate(request.user)
            return {"allowed": can_participate, "reason": reason}
        return {"allowed": False, "reason": "No autenticado"}

    def get_time_remaining(self, obj):
        now = timezone.now()
        result = {}

        if obj.participation_start and now < obj.participation_start:
            diff = obj.participation_start - now
            result["until_participation_start"] = {
                "total_seconds": int(diff.total_seconds()),
                "days": diff.days,
                "hours": diff.seconds // 3600,
                "minutes": (diff.seconds % 3600) // 60,
            }

        if obj.participation_end and now < obj.participation_end:
            diff = obj.participation_end - now
            result["until_participation_end"] = {
                "total_seconds": int(diff.total_seconds()),
                "days": diff.days,
                "hours": diff.seconds // 3600,
                "minutes": (diff.seconds % 3600) // 60,
            }

        if obj.scheduled_date and now < obj.scheduled_date:
            diff = obj.scheduled_date - now
            result["until_draw"] = {
                "total_seconds": int(diff.total_seconds()),
                "days": diff.days,
                "hours": diff.seconds // 3600,
                "minutes": (diff.seconds % 3600) // 60,
            }

        return result if result else None

    def get_statistics(self, obj):
        return {
            "total_prizes": obj.prizes.count(),
            "active_prizes": obj.prizes.filter(is_active=True).count(),
            "total_stock": obj.prizes.aggregate(total=models.Sum("stock"))["total"] or 0,
            "draw_history_count": obj.draw_history.count(),
        }


# ====== Create / Update (CORREGIDO) ======
class RouletteCreateUpdateSerializer(serializers.ModelSerializer):
    # CORREGIDO: name NO requerido en updates; se valida en create
    name = serializers.CharField(required=False, allow_blank=False)
    cover_delete = serializers.BooleanField(write_only=True, required=False, default=False)
    settings = RouletteSettingsSerializer(required=False)
    
    # CORREGIDO: Agregar cover_image_url como read-only para respuesta
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
            "cover_image_url",  # AGREGADO para respuesta
            "cover_delete",
            "settings",
        ]

    def get_cover_image_url(self, obj):
        """Retorna la URL completa de la imagen de portada"""
        if obj.cover_image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.cover_image.url)
            return obj.cover_image.url
        return None

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

        # CORREGIDO: Limpiar campos de fecha vacíos
        for field in ["participation_start", "participation_end", "scheduled_date"]:
            if field in attrs and (attrs[field] == "" or attrs[field] is None):
                attrs[field] = None

        return attrs

    def create(self, validated_data):
        # Asegurar name requerido SOLO en creación
        if not validated_data.get("name"):
            raise serializers.ValidationError({"name": "Este campo es requerido al crear."})

        # CORREGIDO: No procesar cover_delete en creación (no hay imagen previa)
        cover_delete = validated_data.pop("cover_delete", False)
        settings_data = validated_data.pop("settings", None)

        # Limpiar campos de fecha None
        for field in ["participation_start", "participation_end", "scheduled_date"]:
            if field in validated_data and not validated_data[field]:
                validated_data[field] = None

        instance = Roulette.objects.create(**validated_data)

        # Crear configuración por defecto
        if not hasattr(instance, "settings") or not instance.settings:
            default_settings = {
                "max_participants": 0,
                "allow_multiple_entries": False,
                "auto_draw_when_full": False,
                "show_countdown": True,
                "notify_on_participation": True,
                "notify_on_draw": True,
            }
            if settings_data:
                default_settings.update(settings_data)
            RouletteSettings.objects.create(roulette=instance, **default_settings)
        elif settings_data:
            for key, value in settings_data.items():
                setattr(instance.settings, key, value)
            instance.settings.save()

        return instance

    def update(self, instance, validated_data):
        cover_delete = validated_data.pop("cover_delete", False)
        settings_data = validated_data.pop("settings", None)

        # Limpiar campos de fecha
        for field in ["participation_start", "participation_end", "scheduled_date"]:
            if field in validated_data:
                if not validated_data[field] or validated_data[field] == "":
                    validated_data[field] = None

        # CORREGIDO: Manejo mejorado de cover_delete
        if cover_delete and hasattr(instance, 'cover_image') and instance.cover_image:
            # Eliminar archivo físico
            try:
                instance.cover_image.delete(save=False)
            except Exception as e:
                # Log pero no fallar por esto
                import logging
                logger = logging.getLogger(__name__)
                logger.warning(f"No se pudo eliminar imagen física: {e}")
            
            # Limpiar campo en la base de datos
            validated_data["cover_image"] = None

        # CORREGIDO: Solo actualizar imagen si se proporciona una nueva
        # Si no hay 'cover_image' en validated_data, preservar la existente
        if 'cover_image' not in validated_data and not cover_delete:
            # No tocar la imagen existente
            pass

        # Actualizar settings
        if settings_data:
            if hasattr(instance, "settings") and instance.settings:
                for key, value in settings_data.items():
                    setattr(instance.settings, key, value)
                instance.settings.save()
            else:
                RouletteSettings.objects.create(roulette=instance, **settings_data)

        # Actualizar campos del modelo
        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        instance.save()
        
        # Refrescar desde BD para obtener URLs actualizadas
        instance.refresh_from_db()
        return instance


# ====== Draw Execute ======
class DrawExecuteSerializer(serializers.Serializer):
    roulette_id = serializers.IntegerField()

    def validate(self, attrs):
        rid = attrs["roulette_id"]

        try:
            roulette = Roulette.objects.get(pk=rid)
        except Roulette.DoesNotExist:
            raise serializers.ValidationError({"roulette_id": "Ruleta no encontrada"})

        if roulette.is_drawn or roulette.status == RouletteStatus.COMPLETED:
            raise serializers.ValidationError("La ruleta ya fue sorteada.")

        if not roulette.participations.exists():
            raise serializers.ValidationError("No hay participantes para sortear.")

        user = self.context["request"].user
        if not (user.is_staff or user.is_superuser or getattr(user, "user_type", "") == "admin"):
            raise serializers.ValidationError("No tienes permisos para ejecutar el sorteo.")

        attrs["validated_roulette"] = roulette
        return attrs


# ====== Draw History ======
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

    def get_winner_name(self, obj):
        if obj.winner_selected and obj.winner_selected.user:
            return obj.winner_selected.user.get_full_name() or obj.winner_selected.user.username
        return None

    def get_winner_detail(self, obj):
        if obj.winner_selected:
            return ParticipationLiteSerializer(obj.winner_selected, context=self.context).data
        return None

    def get_drawn_by_name(self, obj):
        if obj.drawn_by:
            return obj.drawn_by.get_full_name() or obj.drawn_by.username
        return None


# ====== Prize Create/Update ======
class RoulettePrizeCreateUpdateSerializer(serializers.ModelSerializer):
    # CORREGIDO: Agregar image_url para respuesta
    image_url = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = RoulettePrize
        fields = [
            "name",
            "description",
            "image",
            "image_url",  # AGREGADO
            "stock",
            "probability",
            "display_order",
            "is_active",
        ]

    def get_image_url(self, obj):
        """Retorna la URL completa de la imagen del premio"""
        if obj.image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url
        return None

    def validate(self, attrs):
        display_order = attrs.get("display_order")
        if display_order is not None:
            roulette = self.context.get("roulette")
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
        instance = RoulettePrize.objects.create(**validated_data)
        instance.refresh_from_db()
        return instance

    def update(self, instance, validated_data):
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        instance.refresh_from_db()
        return instance


# ====== Statistics ======
class RouletteStatsSerializer(serializers.Serializer):
    """Serializer para estadísticas de ruleta"""
    roulette_info = serializers.DictField()
    participants = serializers.DictField()
    winner_info = serializers.DictField(allow_null=True)
    prizes_info = serializers.DictField()
    participation_trends = serializers.DictField(required=False)