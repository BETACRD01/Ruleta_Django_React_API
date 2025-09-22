# backend/authentication/serializers.py
from rest_framework import serializers
from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from .models import User, UserProfile, PasswordResetRequest
import re


class UserRegistrationSerializer(serializers.ModelSerializer):
    """RF1.1: Registro de usuarios"""
    password = serializers.CharField(write_only=True, validators=[validate_password], style={'input_type': 'password'})
    password_confirm = serializers.CharField(write_only=True, style={'input_type': 'password'})

    class Meta:
        model = User
        fields = ['username', 'email', 'first_name', 'last_name', 'password', 'password_confirm']
        extra_kwargs = {'email': {'required': True}, 'first_name': {'required': True}, 'last_name': {'required': True}}

    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("Este correo electrónico ya está registrado.")
        return value

    def validate_username(self, value):
        if not re.match(r'^[a-zA-Z0-9_]+$', value):
            raise serializers.ValidationError("El nombre de usuario solo puede contener letras, números y guiones bajos.")
        return value

    def validate(self, attrs):
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError({'password_confirm': 'Las contraseñas no coinciden.'})
        return attrs

    def create(self, validated_data):
        validated_data.pop('password_confirm')
        password = validated_data.pop('password')
        user = User.create_user(password=password, **validated_data) if hasattr(User, 'create_user') else User.objects.create_user(password=password, **validated_data)
        UserProfile.objects.create(user=user)
        return user


class UserLoginSerializer(serializers.Serializer):
    """RF1.1: Inicio de sesión"""
    email = serializers.EmailField()
    password = serializers.CharField(style={'input_type': 'password'})

    def validate(self, attrs):
        email = attrs.get('email')
        password = attrs.get('password')

        if not (email and password):
            raise serializers.ValidationError('Debe proporcionar email y contraseña.')

        # Uniformar error si el usuario no existe
        try:
            User.objects.get(email=email)
        except User.DoesNotExist:
            raise serializers.ValidationError('Credenciales inválidas.')

        # Autenticar. Asumimos USERNAME_FIELD='email'
        user = authenticate(self.context.get('request'), username=email, password=password)
        if not user:
            raise serializers.ValidationError('Credenciales inválidas.')
        if not user.is_active:
            raise serializers.ValidationError('Cuenta desactivada.')

        attrs['user'] = user
        return attrs


class UserProfileSerializer(serializers.ModelSerializer):
    role_display = serializers.CharField(source='get_role_display', read_only=True)
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'role', 'role_display', 'full_name', 'is_email_verified',
            'created_at', 'last_login'
        ]
        read_only_fields = ['id', 'email', 'role', 'created_at', 'last_login']

    def get_full_name(self, obj):
        return f"{obj.first_name} {obj.last_name}".strip()


class UserProfileDetailSerializer(serializers.ModelSerializer):
    profile = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'role', 'is_email_verified', 'created_at', 'profile']

    def get_profile(self, obj):
        try:
            profile = obj.profile
            return {
                'phone': profile.phone,
                'bio': profile.bio,
                'birth_date': profile.birth_date,
                'avatar': profile.avatar.url if profile.avatar else None
            }
        except UserProfile.DoesNotExist:
            return None


class PasswordResetRequestSerializer(serializers.Serializer):
    """
    RF1.4.1: Solicitud de restablecimiento
    → Solo normaliza el email. No filtra existencia ni límite (para no delatar información).
    """
    email = serializers.EmailField()

    def validate_email(self, value):
        return value.strip().lower()


class PasswordResetConfirmSerializer(serializers.Serializer):
    """RF1.4.4: Nueva contraseña con políticas de seguridad"""
    token = serializers.CharField()
    new_password = serializers.CharField(validators=[validate_password], style={'input_type': 'password'})
    confirm_password = serializers.CharField(style={'input_type': 'password'})

    def validate(self, attrs):
        token = attrs.get('token')
        new_password = attrs.get('new_password')
        confirm_password = attrs.get('confirm_password')

        if new_password != confirm_password:
            raise serializers.ValidationError({'confirm_password': 'Las contraseñas no coinciden.'})

        try:
            reset_request = PasswordResetRequest.objects.get(token=token)
        except PasswordResetRequest.DoesNotExist:
            raise serializers.ValidationError({'token': 'Token inválido.'})

        if not reset_request.is_valid():
            raise serializers.ValidationError({'token': 'Token expirado o ya utilizado.'})

        attrs['reset_request'] = reset_request
        return attrs


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(style={'input_type': 'password'})
    new_password = serializers.CharField(validators=[validate_password], style={'input_type': 'password'})
    confirm_password = serializers.CharField(style={'input_type': 'password'})

    def validate_current_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError('Contraseña actual incorrecta.')
        return value

    def validate(self, attrs):
        if attrs['new_password'] != attrs['confirm_password']:
            raise serializers.ValidationError({'confirm_password': 'Las contraseñas no coinciden.'})
        return attrs
