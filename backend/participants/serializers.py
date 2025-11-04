# participants/serializers.py
from rest_framework import serializers
from django.conf import settings
import os
from .models import Participation


def _abs_url(request, file_field):
    """Construye URL absoluta para un FileField/ImageField."""
    if not file_field:
        return None
    try:
        url = file_field.url
    except Exception:
        return None
    if not url:
        return None
    return request.build_absolute_uri(url) if request else url


class ParticipationSerializer(serializers.ModelSerializer):
    """
    Serializer principal para crear/listar una participación.
    """
    user_name = serializers.CharField(source="user.get_full_name", read_only=True)
    user_username = serializers.CharField(source="user.username", read_only=True)
    roulette_name = serializers.CharField(source="roulette.name", read_only=True)
    receipt_filename = serializers.CharField(read_only=True)
    receipt_size = serializers.IntegerField(read_only=True)
    receipt_extension = serializers.CharField(read_only=True)

    # Campos del premio ganado
    prize_name = serializers.SerializerMethodField()
    prize_image_url = serializers.SerializerMethodField()
    prize_description = serializers.SerializerMethodField()
    won_at = serializers.DateTimeField(read_only=True)

    class Meta:
        model = Participation
        fields = [
            "id",
            "user",
            "user_name",
            "user_username",
            "roulette",
            "roulette_name",
            "receipt",
            "receipt_filename",
            "receipt_size",
            "receipt_extension",
            "participant_number",
            "created_at",
            "is_winner",
            "won_prize",
            "prize_position",
            "prize_name",
            "prize_image_url",
            "prize_description",
            "won_at",
        ]
        read_only_fields = [
            "user",
            "participant_number",
            "created_at",
            "is_winner",
            "won_prize",
            "prize_position",
            "won_at",
        ]

    def get_prize_name(self, obj):
        if obj.won_prize:
            return obj.won_prize.name
        return None

    def get_prize_image_url(self, obj):
        if obj.won_prize and obj.won_prize.image:
            return _abs_url(self.context.get("request"), obj.won_prize.image)
        return None

    def get_prize_description(self, obj):
        if obj.won_prize:
            return obj.won_prize.description
        return None

    def validate_receipt(self, value):
        """Validar el archivo de comprobante"""
        if not value:
            raise serializers.ValidationError("El comprobante es requerido.")

        max_size = getattr(settings, "MAX_RECEIPT_SIZE", 5 * 1024 * 1024)
        try:
            size = value.size
        except Exception:
            size = 0

        if size and size > max_size:
            raise serializers.ValidationError(
                f"El archivo es muy grande. Tamaño máximo permitido: {max_size // (1024*1024)}MB"
            )

        allowed_extensions = getattr(
            settings, "ALLOWED_RECEIPT_EXTENSIONS", [".jpg", ".jpeg", ".png", ".pdf"]
        )
        ext = os.path.splitext(value.name)[1].lower()
        if ext not in allowed_extensions:
            raise serializers.ValidationError(
                f"Extensión de archivo no permitida. Extensiones permitidas: {', '.join(allowed_extensions)}"
            )

        return value

    def validate(self, attrs):
        """Validaciones de dominio"""
        request = self.context.get("request")
        user = getattr(request, "user", None)

        roulette = attrs.get("roulette") or getattr(self.instance, "roulette", None)
        if roulette is None:
            return attrs

        if getattr(roulette, "is_drawn", False):
            raise serializers.ValidationError(
                "No se puede participar en una ruleta que ya fue sorteada."
            )

        if self.instance is None and user is not None:
            if Participation.objects.filter(user=user, roulette=roulette).exists():
                raise serializers.ValidationError("Ya has participado en esta ruleta.")

        max_participants = getattr(roulette, "max_participants", None)
        if max_participants:
            current_participants = roulette.participations.count()
            if self.instance is None and current_participants >= max_participants:
                raise serializers.ValidationError(
                    "Se ha alcanzado el límite máximo de participantes para esta ruleta."
                )

        return attrs

    def create(self, validated_data):
        """Asegurar que el usuario autenticado se asigne"""
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if user is None or not user.is_authenticated:
            raise serializers.ValidationError("Autenticación requerida para participar.")
        validated_data["user"] = user
        return super().create(validated_data)

    def update(self, instance, validated_data):
        """Evitar cambios de 'user' y 'roulette' en updates"""
        validated_data.pop("user", None)
        validated_data.pop("roulette", None)
        return super().update(instance, validated_data)


class ParticipationListSerializer(serializers.ModelSerializer):
    """Serializer para listar participaciones (información básica)"""
    user_name = serializers.SerializerMethodField()
    roulette_name = serializers.CharField(source="roulette.name", read_only=True)
    participation_state = serializers.SerializerMethodField()
    roulette_image_url = serializers.SerializerMethodField()

    class Meta:
        model = Participation
        fields = [
            "id",
            "user_name",
            "roulette_name",
            "participant_number",
            "created_at",
            "is_winner",
            "participation_state",
            "roulette_image_url",
        ]

    def get_user_name(self, obj):
        if obj.user.first_name and obj.user.last_name:
            return f"{obj.user.first_name} {obj.user.last_name}"
        return obj.user.username

    def get_roulette_image_url(self, obj):
        try:
            roulette = obj.roulette
            if roulette and getattr(roulette, "cover_image", None):
                return _abs_url(self.context.get("request"), roulette.cover_image)
            return None
        except Exception:
            return None

    def get_participation_state(self, obj):
        if obj.is_winner:
            return "won"

        roulette = obj.roulette
        if not roulette:
            return "completed"

        if roulette.status == "cancelled":
            return "completed"

        if (
            roulette.status == "completed"
            or getattr(roulette, "is_drawn", False)
            or getattr(roulette, "drawn_at", None)
        ):
            return "completed"

        if roulette.status in ["active", "scheduled"]:
            return "active"

        return "completed"


class ParticipantBasicSerializer(serializers.ModelSerializer):
    """
    Serializer básico para mostrar participantes en la ruleta - CON DATOS DE CONTACTO
    """
    name = serializers.SerializerMethodField()
    email = serializers.SerializerMethodField()
    phone = serializers.SerializerMethodField()
    user_id = serializers.IntegerField(source="user.id", read_only=True)
    first_name = serializers.CharField(source="user.first_name", read_only=True)
    last_name = serializers.CharField(source="user.last_name", read_only=True)
    username = serializers.CharField(source="user.username", read_only=True)

    class Meta:
        model = Participation
        fields = [
            "id",
            "name",
            "participant_number",
            "is_winner",
            "email",
            "phone",
            "user_id",
            "first_name",
            "last_name",
            "username",
            "created_at",
        ]

    def get_name(self, obj):
        if obj.user.first_name and obj.user.last_name:
            return f"{obj.user.first_name} {obj.user.last_name}"
        return obj.user.username

    def get_email(self, obj):
        return getattr(obj.user, "email", None)

    def get_phone(self, obj):
        try:
            profile = getattr(obj.user, "profile", None)
            if profile:
                return getattr(profile, "phone", None)
        except Exception:
            pass
        return None


class ParticipantFullSerializer(serializers.ModelSerializer):
    """
    Serializer completo con toda la información del participante incluyendo datos del usuario
    """
    name = serializers.SerializerMethodField()
    email = serializers.CharField(source="user.email", read_only=True)
    phone = serializers.SerializerMethodField()
    user_info = serializers.SerializerMethodField()

    class Meta:
        model = Participation
        fields = [
            "id",
            "name",
            "participant_number",
            "is_winner",
            "email",
            "phone",
            "user_info",
            "created_at",
        ]

    def get_name(self, obj):
        if obj.user.first_name and obj.user.last_name:
            return f"{obj.user.first_name} {obj.user.last_name}"
        return obj.user.username

    def get_phone(self, obj):
        try:
            return obj.user.profile.phone if hasattr(obj.user, "profile") else None
        except Exception:
            return None

    def get_user_info(self, obj):
        user = obj.user
        profile_data = {}
        try:
            if hasattr(user, "profile"):
                profile = user.profile
                profile_data = {
                    "phone": getattr(profile, "phone", None),
                    "bio": getattr(profile, "bio", None),
                    "birth_date": getattr(profile, "birth_date", None),
                    "avatar": _abs_url(self.context.get("request"), getattr(profile, "avatar", None)),
                    "terms_accepted_at": getattr(profile, "terms_accepted_at", None),
                }
        except Exception:
            pass

        return {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "is_email_verified": getattr(user, "is_email_verified", False),
            "profile": profile_data,
        }


class MyParticipationsSerializer(serializers.ModelSerializer):
    """
    Serializer específico para 'mis participaciones'
    Incluye imagen del premio GANADO correctamente asignado.
    """
    # Info usuario
    user_name = serializers.SerializerMethodField()

    # Info ruleta
    roulette_id = serializers.IntegerField(source="roulette.id", read_only=True)
    roulette_name = serializers.CharField(source="roulette.name", read_only=True)
    roulette_slug = serializers.CharField(source="roulette.slug", read_only=True)
    roulette_status = serializers.CharField(source="roulette.status", read_only=True)
    roulette_is_drawn = serializers.BooleanField(source="roulette.is_drawn", read_only=True)
    roulette_drawn_at = serializers.DateTimeField(source="roulette.drawn_at", read_only=True)
    roulette_image_url = serializers.SerializerMethodField()

    # Estado calculado
    participation_state = serializers.SerializerMethodField()

    # Premio ganado - ✅ CAMPOS CORRECTOS
    prize_image_url = serializers.SerializerMethodField()
    prize_name = serializers.SerializerMethodField()
    prize_position = serializers.IntegerField(read_only=True)
    prize_description = serializers.SerializerMethodField()

    # Fechas adicionales
    scheduled_date = serializers.DateTimeField(source="roulette.scheduled_date", read_only=True)
    won_at = serializers.DateTimeField(read_only=True)

    class Meta:
        model = Participation
        fields = [
            "id",
            "user_name",
            "participant_number",
            "is_winner",
            "created_at",
            # Ruleta
            "roulette_id",
            "roulette_name",
            "roulette_slug",
            "roulette_status",
            "roulette_is_drawn",
            "roulette_drawn_at",
            "roulette_image_url",
            "scheduled_date",
            # Estado calculado
            "participation_state",
            # Premio - ✅ EXPUESTOS AL FRONTEND
            "prize_image_url",
            "prize_name",
            "prize_position",
            "prize_description",
            "won_at",
        ]

    def get_user_name(self, obj):
        return obj.user.get_full_name() or obj.user.username if obj.user else "Usuario anónimo"

    def get_roulette_image_url(self, obj):
        try:
            roulette = obj.roulette
            if roulette and getattr(roulette, "cover_image", None):
                return _abs_url(self.context.get("request"), roulette.cover_image)
            return None
        except Exception:
            return None

    def get_participation_state(self, obj):
        if obj.is_winner:
            return "won"

        roulette = obj.roulette
        if not roulette:
            return "completed"

        if roulette.status == "cancelled":
            return "completed"

        if (
            roulette.status == "completed"
            or getattr(roulette, "is_drawn", False)
            or getattr(roulette, "drawn_at", None)
        ):
            return "completed"

        if roulette.status in ["active", "scheduled"]:
            return "active"

        return "completed"

    def get_prize_image_url(self, obj):
        """
        ✅ CORRECCIÓN: Devuelve la imagen del premio ganado específico.
        Sin fallbacks innecesarios.
        """
        if not obj.is_winner:
            return None

        # Premio asignado directamente en la participación
        if obj.won_prize and obj.won_prize.image:
            return _abs_url(self.context.get("request"), obj.won_prize.image)

        return None

    def get_prize_name(self, obj):
        """Nombre del premio ganado"""
        if not obj.is_winner:
            return None

        if obj.won_prize:
            return obj.won_prize.name

        return None

    def get_prize_description(self, obj):
        """Descripción del premio ganado"""
        if not obj.is_winner:
            return None

        if obj.won_prize:
            return obj.won_prize.description

        return None
