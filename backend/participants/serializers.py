# participants/serializers.py

from rest_framework import serializers
from django.conf import settings
import os
from .models import Participation


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
        ]
        read_only_fields = ["user", "participant_number", "created_at", "is_winner"]

    def validate_receipt(self, value):
        """Validar el archivo de comprobante"""
        if not value:
            raise serializers.ValidationError("El comprobante es requerido.")

        max_size = getattr(settings, "MAX_RECEIPT_SIZE", 5 * 1024 * 1024)  # 5MB
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

        # 1) Ruleta no sorteada
        if getattr(roulette, "is_drawn", False):
            raise serializers.ValidationError(
                "No se puede participar en una ruleta que ya fue sorteada."
            )

        # 2) Evitar doble participación
        if self.instance is None and user is not None:
            if Participation.objects.filter(user=user, roulette=roulette).exists():
                raise serializers.ValidationError("Ya has participado en esta ruleta.")

        # 3) Límite de participantes
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

    class Meta:
        model = Participation
        fields = [
            "id",
            "user_name",
            "roulette_name",
            "participant_number",
            "created_at",
            "is_winner",
        ]

    def get_user_name(self, obj):
        """Nombre completo si existe; en caso contrario, username"""
        if obj.user.first_name and obj.user.last_name:
            return f"{obj.user.first_name} {obj.user.last_name}"
        return obj.user.username


class ParticipantBasicSerializer(serializers.ModelSerializer):
    """
    Serializer básico para mostrar participantes en la ruleta - CON DATOS DE CONTACTO
    """
    name = serializers.SerializerMethodField()
    email = serializers.SerializerMethodField()
    phone = serializers.SerializerMethodField()
    
    # Campos adicionales útiles para el frontend
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
            "created_at"
        ]

    def get_name(self, obj):
        """Devuelve el nombre "bonito" para el display del participante"""
        if obj.user.first_name and obj.user.last_name:
            return f"{obj.user.first_name} {obj.user.last_name}"
        return obj.user.username

    def get_email(self, obj):
        """Obtiene el email del usuario"""
        return getattr(obj.user, 'email', None)

    def get_phone(self, obj):
        """Obtiene el teléfono del perfil del usuario"""
        try:
            profile = getattr(obj.user, 'profile', None)
            if profile:
                return getattr(profile, 'phone', None)
        except Exception:
            pass
        return None


# Serializer alternativo más completo para cuando necesites más información del ganador
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
        """Nombre completo del participante"""
        if obj.user.first_name and obj.user.last_name:
            return f"{obj.user.first_name} {obj.user.last_name}"
        return obj.user.username

    def get_phone(self, obj):
        """Teléfono del perfil del usuario"""
        try:
            return obj.user.profile.phone if hasattr(obj.user, 'profile') else None
        except Exception:
            return None

    def get_user_info(self, obj):
        """Información completa del usuario"""
        user = obj.user
        profile_data = {}
        
        try:
            if hasattr(user, 'profile'):
                profile = user.profile
                profile_data = {
                    "phone": getattr(profile, 'phone', None),
                    "bio": getattr(profile, 'bio', None),
                    "birth_date": getattr(profile, 'birth_date', None),
                    "avatar": profile.avatar.url if getattr(profile, 'avatar', None) else None,
                    "terms_accepted_at": getattr(profile, 'terms_accepted_at', None),
                }
        except Exception:
            pass

        return {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "is_email_verified": getattr(user, 'is_email_verified', False),
            "profile": profile_data
        }