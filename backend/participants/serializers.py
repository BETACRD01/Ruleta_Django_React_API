# participants/serializers.py

from rest_framework import serializers
from django.conf import settings
import os
from .models import Participation


class ParticipationSerializer(serializers.ModelSerializer):
    """
    Serializer principal para crear/listar una participación.
    - El frontend envía 'receipt' (archivo) y 'roulette' (id) si se usa este serializer directamente.
      En tu flujo actual, el endpoint de participar usa un serializer separado con 'roulette_id',
      y luego devuelve este serializer para la respuesta (lo ideal).
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

    # ----------------------- Validaciones de archivo -----------------------

    def validate_receipt(self, value):
        """
        Validar el archivo de comprobante:
        - Presencia
        - Tamaño máximo (por defecto 5MB)
        - Extensión permitida (por defecto .jpg, .jpeg, .png, .pdf)
        """
        if not value:
            raise serializers.ValidationError("El comprobante es requerido.")

        max_size = getattr(settings, "MAX_RECEIPT_SIZE", 5 * 1024 * 1024)  # 5MB
        try:
            size = value.size
        except Exception:
            # Por compatibilidad con algunos storages
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

    # ----------------------- Validaciones de modelo -----------------------

    def validate(self, attrs):
        """
        Validaciones de dominio:
        - Ruleta no sorteada.
        - Evitar doble participación del mismo usuario en la misma ruleta.
        - Respetar límite de participantes (si el modelo de ruleta lo define).
        """
        request = self.context.get("request")
        user = getattr(request, "user", None)

        # Cuando se usa este serializer para crear, esperamos 'roulette' como PK.
        roulette = attrs.get("roulette") or getattr(self.instance, "roulette", None)
        if roulette is None:
            # Si tu flujo usa un serializer aparte (p.ej. ParticipateSerializer con roulette_id),
            # es normal que aquí no venga 'roulette' en la solicitud de creación.
            # En ese caso, este serializer se usa para devolver/representar.
            return attrs

        # 1) Ruleta no sorteada
        if getattr(roulette, "is_drawn", False):
            raise serializers.ValidationError(
                "No se puede participar en una ruleta que ya fue sorteada."
            )

        # 2) Evitar doble participación del mismo usuario en la misma ruleta
        #    (al crear; y al actualizar, no marque duplicado si es la misma instancia).
        if self.instance is None and user is not None:
            if Participation.objects.filter(user=user, roulette=roulette).exists():
                raise serializers.ValidationError("Ya has participado en esta ruleta.")

        # 3) Límite de participantes si existe en el modelo de ruleta
        max_participants = getattr(roulette, "max_participants", None)
        if max_participants:
            current_participants = roulette.participations.count()
            if self.instance is None and current_participants >= max_participants:
                raise serializers.ValidationError(
                    "Se ha alcanzado el límite máximo de participantes para esta ruleta."
                )

        return attrs

    # ----------------------- Hooks de creación/actualización -----------------------

    def create(self, validated_data):
        """
        Asegurar que el usuario autenticado se asigne aunque 'user' sea read_only.
        """
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if user is None or not user.is_authenticated:
            raise serializers.ValidationError("Autenticación requerida para participar.")
        validated_data["user"] = user
        return super().create(validated_data)

    def update(self, instance, validated_data):
        """
        Evitar cambios de 'user' y 'roulette' en updates.
        """
        validated_data.pop("user", None)
        validated_data.pop("roulette", None)
        return super().update(instance, validated_data)


class ParticipationListSerializer(serializers.ModelSerializer):
    """
    Serializer para listar participaciones (información básica).
    Usado, por ejemplo, en “mis participaciones” o listados.
    """
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
        """
        Nombre completo si existe; en caso contrario, username.
        """
        if obj.user.first_name and obj.user.last_name:
            return f"{obj.user.first_name} {obj.user.last_name}"
        return obj.user.username


class ParticipantBasicSerializer(serializers.ModelSerializer):
    """
    Serializer básico para mostrar participantes en la ruleta (p. ej. UI del sorteo).
    """
    name = serializers.SerializerMethodField()

    class Meta:
        model = Participation
        fields = ["id", "name", "participant_number", "is_winner"]

    def get_name(self, obj):
        """
        Devuelve el nombre “bonito” para el display del participante.
        """
        if obj.user.first_name and obj.user.last_name:
            return f"{obj.user.first_name} {obj.user.last_name}"
        return obj.user.username
