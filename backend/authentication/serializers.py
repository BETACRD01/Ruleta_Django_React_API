# backend/authentication/serializers.py
from __future__ import annotations

import re
from typing import Optional

from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from .models import User, UserProfile, PasswordResetRequest

# ================== Teléfonos (con código de país) ==================
try:
    import phonenumbers
    from phonenumbers.phonenumberutil import NumberParseException
except Exception:
    phonenumbers = None
    NumberParseException = Exception


def _default_region_from_settings() -> str:
    region = getattr(settings, "DEFAULT_PHONE_REGION", "EC")
    if not isinstance(region, str) or len(region) != 2:
        return "EC"
    return region.upper()


def _format_e164_or_none(raw: str, region: Optional[str] = None) -> Optional[str]:
    if not phonenumbers:
        s = re.sub(r"[^\d+]", "", raw or "")
        return s if s.startswith("+") and len(s) >= 8 else None

    raw = (raw or "").strip()
    try:
        if raw.startswith("+"):
            parsed = phonenumbers.parse(raw, None)
        else:
            parsed = phonenumbers.parse(raw, region or _default_region_from_settings())
        if not phonenumbers.is_possible_number(parsed) or not phonenumbers.is_valid_number(parsed):
            return None
        return phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)
    except NumberParseException:
        return None


# ================== SERIALIZERS ==================

class UserRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True,
        validators=[validate_password],
        style={"input_type": "password"},
    )
    password_confirm = serializers.CharField(
        write_only=True,
        style={"input_type": "password"},
    )
    phone = serializers.CharField(
        max_length=20,
        required=True,
        write_only=True,
        help_text="Incluye el código de país. Ej: +5939XXXXXXXX o +521234567890",
    )
    accept_terms = serializers.BooleanField(
        write_only=True,
        required=True,
        help_text="Debe aceptar los términos y condiciones",
    )

    class Meta:
        model = User
        fields = [
            "username",
            "email",
            "first_name",
            "last_name",
            "password",
            "password_confirm",
            "phone",
            "accept_terms",
        ]
        extra_kwargs = {
            "email": {"required": True},
            "first_name": {"required": True},
            "last_name": {"required": True},
        }

    def validate_email(self, value):
        email = (value or "").strip().lower()
        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError("Este correo electrónico ya está registrado.")
        return email

    def validate_username(self, value):
        v = (value or "").strip()
        if not re.match(r"^[a-zA-Z0-9_]+$", v):
            raise serializers.ValidationError("El nombre de usuario solo puede contener letras, números y guiones bajos.")
        if User.objects.filter(username__iexact=v).exists():
            raise serializers.ValidationError("Este nombre de usuario ya está en uso.")
        return v

    def validate_phone(self, value):
        raw = (value or "").strip()

        if not raw.startswith("+"):
            suggested = _format_e164_or_none(raw, _default_region_from_settings())
            if suggested:
                raise serializers.ValidationError(
                    f"Incluye el código de país. Sugerencia: {suggested}"
                )
            raise serializers.ValidationError(
                "Incluye el código de país en formato internacional (E.164). Ej: +5939XXXXXXXX"
            )

        normalized = _format_e164_or_none(raw, None)
        if not normalized:
            raise serializers.ValidationError("Número de teléfono inválido. Usa formato +<código><número> en E.164.")

        if UserProfile.objects.filter(phone=normalized).exists():
            raise serializers.ValidationError("Este número de teléfono ya está registrado.")

        return normalized

    def validate_accept_terms(self, value):
        if not value:
            raise serializers.ValidationError("Debe aceptar los términos y condiciones para registrarse.")
        return value

    def validate(self, attrs):
        if attrs.get("password") != attrs.get("password_confirm"):
            raise serializers.ValidationError({"password_confirm": "Las contraseñas no coinciden."})
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        validated_data.pop("password_confirm", None)
        phone = validated_data.pop("phone")
        accept_terms = validated_data.pop("accept_terms", False)
        password = validated_data.pop("password")

        email = (validated_data.get("email") or "").lower().strip()
        username = (validated_data.get("username") or "").strip()
        validated_data["email"] = email
        validated_data["username"] = username

        user = User.objects.create_user(password=password, **validated_data)

        profile, _ = UserProfile.objects.get_or_create(user=user)

        update_fields = []
        if phone and profile.phone != phone:
            profile.phone = phone
            update_fields.append("phone")
        if accept_terms and profile.terms_accepted_at is None:
            profile.terms_accepted_at = timezone.now()
            update_fields.append("terms_accepted_at")
        if update_fields:
            profile.save(update_fields=update_fields)

        return user

    def to_representation(self, instance: User):
        data = {
            "id": instance.id,
            "username": instance.username,
            "email": instance.email,
            "first_name": instance.first_name,
            "last_name": instance.last_name,
            "role": instance.role,
            "is_email_verified": instance.is_email_verified,
            "created_at": instance.created_at,
        }
        profile = getattr(instance, "profile", None)
        if profile:
            data["profile"] = {
                "phone": profile.phone,
                "terms_accepted_at": profile.terms_accepted_at,
            }
        else:
            data["profile"] = None
        return data


class UserLoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(style={"input_type": "password"})

    def validate(self, attrs):
        email = (attrs.get("email") or "").strip().lower()
        password = attrs.get("password")

        if not (email and password):
            raise serializers.ValidationError("Debe proporcionar email y contraseña.")

        if not User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError("Credenciales inválidas.")

        user = authenticate(self.context.get("request"), username=email, password=password)
        if not user:
            raise serializers.ValidationError("Credenciales inválidas.")
        if not user.is_active:
            raise serializers.ValidationError("Cuenta desactivada.")

        attrs["user"] = user
        return attrs


class UserProfileSerializer(serializers.ModelSerializer):
    role_display = serializers.CharField(source="get_role_display", read_only=True)
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "role",
            "role_display",
            "full_name",
            "is_email_verified",
            "created_at",
            "last_login",
        ]
        read_only_fields = ["id", "email", "role", "created_at", "last_login"]

    def get_full_name(self, obj):
        return f"{obj.first_name} {obj.last_name}".strip()


class UserProfileUpdateSerializer(serializers.Serializer):
    """Serializer para actualizar perfil completo incluyendo avatar y datos de UserProfile"""
    # Campos de User
    username = serializers.CharField(required=False, max_length=150)
    first_name = serializers.CharField(required=False, max_length=150)
    last_name = serializers.CharField(required=False, max_length=150)
    
    # Campos de UserProfile
    avatar = serializers.ImageField(required=False, allow_null=True)
    phone = serializers.CharField(required=False, allow_blank=True, max_length=20)
    bio = serializers.CharField(required=False, allow_blank=True, max_length=500)
    birth_date = serializers.DateField(required=False, allow_null=True)

    def validate_username(self, value):
        user = self.context['request'].user
        if value and User.objects.exclude(id=user.id).filter(username__iexact=value).exists():
            raise serializers.ValidationError("Este nombre de usuario ya está en uso.")
        return value

    def validate_phone(self, value):
        if not value:
            return value
        
        user = self.context['request'].user
        raw = value.strip()
        
        if not raw.startswith("+"):
            suggested = _format_e164_or_none(raw, _default_region_from_settings())
            if suggested:
                raise serializers.ValidationError(
                    f"Incluye el código de país. Sugerencia: {suggested}"
                )
            raise serializers.ValidationError(
                "Incluye el código de país en formato internacional (E.164). Ej: +5939XXXXXXXX"
            )
        
        normalized = _format_e164_or_none(raw, None)
        if not normalized:
            raise serializers.ValidationError("Número de teléfono inválido.")
        
        if UserProfile.objects.exclude(user=user).filter(phone=normalized).exists():
            raise serializers.ValidationError("Este número de teléfono ya está registrado.")
        
        return normalized

    def update(self, instance, validated_data):
        # Actualizar campos de User
        if 'username' in validated_data:
            instance.username = validated_data['username']
        if 'first_name' in validated_data:
            instance.first_name = validated_data['first_name']
        if 'last_name' in validated_data:
            instance.last_name = validated_data['last_name']
        instance.save()

        # Actualizar o crear perfil
        profile, _ = UserProfile.objects.get_or_create(user=instance)
        
        # Avatar
        if 'avatar' in validated_data:
            profile.avatar = validated_data['avatar']
        
        # Phone
        if 'phone' in validated_data:
            profile.phone = validated_data['phone']
        
        # Bio
        if 'bio' in validated_data:
            profile.bio = validated_data['bio']
        
        # Birth date
        if 'birth_date' in validated_data:
            profile.birth_date = validated_data['birth_date']
        
        profile.save()
        return instance

    def to_representation(self, instance):
        data = {
            "id": instance.id,
            "username": instance.username,
            "email": instance.email,
            "first_name": instance.first_name,
            "last_name": instance.last_name,
            "role": instance.role,
            "is_email_verified": instance.is_email_verified,
            "created_at": instance.created_at,
        }
        
        profile = getattr(instance, "profile", None)
        if profile:
            data["profile"] = {
                "phone": profile.phone,
                "bio": profile.bio,
                "birth_date": profile.birth_date,
                "avatar": instance.profile.avatar.url if profile.avatar else None,
                "terms_accepted_at": profile.terms_accepted_at,
            }
        else:
            data["profile"] = None
        
        return data


class UserProfileDetailSerializer(serializers.ModelSerializer):
    profile = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "role",
            "is_email_verified",
            "created_at",
            "profile",
        ]

    def get_profile(self, obj):
        profile = getattr(obj, "profile", None)
        if not profile:
            return None
        return {
            "phone": profile.phone,
            "bio": profile.bio,
            "birth_date": profile.birth_date,
            "avatar": profile.avatar.url if profile.avatar else None,
            "terms_accepted_at": profile.terms_accepted_at,
        }


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        return (value or "").strip().lower()


class PasswordResetConfirmSerializer(serializers.Serializer):
    token = serializers.CharField()
    new_password = serializers.CharField(validators=[validate_password], style={"input_type": "password"})
    confirm_password = serializers.CharField(style={"input_type": "password"})

    def validate(self, attrs):
        token = attrs.get("token")
        new_password = attrs.get("new_password")
        confirm_password = attrs.get("confirm_password")

        if new_password != confirm_password:
            raise serializers.ValidationError({"confirm_password": "Las contraseñas no coinciden."})

        try:
            reset_request = PasswordResetRequest.objects.get(token=token)
        except PasswordResetRequest.DoesNotExist:
            raise serializers.ValidationError({"token": "Token inválido."})

        if not reset_request.is_valid():
            raise serializers.ValidationError({"token": "Token expirado o ya utilizado."})

        attrs["reset_request"] = reset_request
        return attrs


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(style={"input_type": "password"})
    new_password = serializers.CharField(validators=[validate_password], style={"input_type": "password"})
    confirm_password = serializers.CharField(style={"input_type": "password"})

    def validate_current_password(self, value):
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("Contraseña actual incorrecta.")
        return value

    def validate(self, attrs):
        if attrs["new_password"] != attrs["confirm_password"]:
            raise serializers.ValidationError({"confirm_password": "Las contraseñas no coinciden."})
        return attrs