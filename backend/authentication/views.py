# backend/authentication/views.py
from rest_framework import status, generics, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from rest_framework.views import APIView
from django.contrib.auth import login, logout
from django.core.mail import send_mail
from django.conf import settings
from django.template.loader import render_to_string
from django.utils.html import strip_tags
from django.shortcuts import get_object_or_404
from django.db import transaction
from django.utils import timezone

import secrets
import logging

from .models import User, PasswordResetRequest, UserProfile
from .serializers import (
    UserRegistrationSerializer,
    UserLoginSerializer,
    UserProfileSerializer,
    UserProfileDetailSerializer,
    PasswordResetRequestSerializer,
    PasswordResetConfirmSerializer,
    ChangePasswordSerializer
)

logger = logging.getLogger(__name__)


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserRegistrationSerializer
    permission_classes = [permissions.AllowAny]

    def perform_create(self, serializer):
        with transaction.atomic():
            user = serializer.save()
            logger.info(f"Nuevo usuario registrado: {user.email}")
            self.send_welcome_email(user)

    def send_welcome_email(self, user):
        try:
            subject = '¡Bienvenido al Sistema de Ruletas!'
            html_message = render_to_string('authentication/welcome_email.html', {
                'user': user,
                'site_name': 'Sistema de Ruletas'
            })
            plain_message = strip_tags(html_message)
            send_mail(
                subject,
                plain_message,
                getattr(settings, "DEFAULT_FROM_EMAIL", "no-reply@ruletas.local"),
                [user.email],
                html_message=html_message,
                fail_silently=True
            )
            logger.info(f"Email de bienvenida enviado a: {user.email}")
        except Exception as e:
            logger.error(f"Error enviando email de bienvenida: {e}")


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = UserLoginSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            user = serializer.validated_data['user']
            token, _ = Token.objects.get_or_create(user=user)
            user.last_login = timezone.now()
            user.save(update_fields=['last_login'])
            login(request, user)
            logger.info(f"Usuario logueado: {user.email}")
            return Response({
                'success': True,
                'message': 'Inicio de sesión exitoso',
                'token': token.key,
                'user': {
                    'id': user.id,
                    'username': user.username,
                    'email': user.email,
                    'first_name': user.first_name,
                    'last_name': user.last_name,
                    'role': user.role,
                    'is_admin': user.is_admin(),
                }
            }, status=status.HTTP_200_OK)

        return Response({'success': False, 'message': 'Credenciales inválidas', 'errors': serializer.errors},
                        status=status.HTTP_400_BAD_REQUEST)


class LogoutView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        try:
            user_email = request.user.email if request.user.is_authenticated else 'Usuario anónimo'
            try:
                Token.objects.get(user=request.user).delete()
            except Token.DoesNotExist:
                pass
            logout(request)
            logger.info(f"Usuario deslogueado: {user_email}")
            return Response({'success': True, 'message': 'Sesión cerrada exitosamente'}, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Error durante logout: {str(e)}")
            return Response({'success': False, 'message': 'Error al cerrar sesión'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = UserProfileSerializer
    permission_classes = [permissions.IsAuthenticated]
    def get_object(self):
        return self.request.user


class ProfileDetailView(generics.RetrieveAPIView):
    serializer_class = UserProfileDetailSerializer
    permission_classes = [permissions.IsAuthenticated]
    def get_object(self):
        return self.request.user


class PasswordResetRequestView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        if serializer.is_valid():
            email = serializer.validated_data['email']
            try:
                user = User.objects.get(email=email)
            except User.DoesNotExist:
                return Response({'success': True, 'message': 'Se ha enviado un correo con instrucciones para restablecer tu contraseña.'},
                                status=status.HTTP_200_OK)
            token = secrets.token_urlsafe(32)
            reset_request = PasswordResetRequest.objects.create(user=user, token=token)
            if self.send_reset_email(user, token):
                logger.info(f"Solicitud de restablecimiento creada para: {email}")
                return Response({'success': True, 'message': 'Se ha enviado un correo con instrucciones para restablecer tu contraseña.'},
                                status=status.HTTP_200_OK)
            reset_request.delete()
            return Response({'success': False, 'message': 'Error al enviar el correo. Inténtalo más tarde.'},
                            status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response({'success': False, 'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

    def send_reset_email(self, user, token):
        try:
            subject = 'Restablecimiento de Contraseña - Sistema de Ruletas'
            reset_url = f"http://localhost:3000/reset-password?token={token}"
            html_message = render_to_string('authentication/password_reset_email.html', {
                'user': user, 'reset_url': reset_url, 'site_name': 'Sistema de Ruletas'
            })
            plain_message = strip_tags(html_message)
            send_mail(
                subject,
                plain_message,
                getattr(settings, "DEFAULT_FROM_EMAIL", "no-reply@ruletas.local"),
                [user.email],
                html_message=html_message,
                fail_silently=False
            )
            logger.info(f"Email de restablecimiento enviado a: {user.email}")
            return True
        except Exception as e:
            logger.error(f"Error enviando email de restablecimiento: {e}")
            return False


class PasswordResetConfirmView(APIView):
    permission_classes = [permissions.AllowAny]
    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        if serializer.is_valid():
            reset_request = serializer.validated_data['reset_request']
            new_password = serializer.validated_data['new_password']
            with transaction.atomic():
                user = reset_request.user
                user.set_password(new_password)
                user.save()
                reset_request.is_used = True
                reset_request.save()
                Token.objects.filter(user=user).delete()
                logger.info(f"Contraseña restablecida para: {user.email}")
                return Response({'success': True, 'message': 'Contraseña restablecida exitosamente. Puedes iniciar sesión con tu nueva contraseña.'},
                                status=status.HTTP_200_OK)
        return Response({'success': False, 'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)


class ChangePasswordView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            user = request.user
            new_password = serializer.validated_data['new_password']
            user.set_password(new_password)
            user.save()
            try:
                Token.objects.get(user=user).delete()
                new_token = Token.objects.create(user=user)
                logger.info(f"Contraseña cambiada para: {user.email}")
                return Response({'success': True, 'message': 'Contraseña cambiada exitosamente.', 'new_token': new_token.key},
                                status=status.HTTP_200_OK)
            except Token.DoesNotExist:
                return Response({'success': True, 'message': 'Contraseña cambiada exitosamente.'},
                                status=status.HTTP_200_OK)
        return Response({'success': False, 'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def user_info(request):
    user = request.user
    return Response({
        'id': user.id,
        'username': user.username,
        'email': user.email,
        'first_name': user.first_name,
        'last_name': user.last_name,
        'role': user.role,
        'is_admin': user.is_admin(),
        'is_email_verified': user.is_email_verified,
        'last_login': user.last_login,
        'date_joined': user.date_joined,
    })


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def validate_reset_token(request):
    token = request.data.get('token')
    if not token:
        return Response({'valid': False, 'message': 'Token requerido'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        reset_request = PasswordResetRequest.objects.get(token=token)
        if reset_request.is_valid():
            return Response({'valid': True, 'message': 'Token válido',
                             'email': reset_request.user.email[:3] + '***@' + reset_request.user.email.split('@')[1]})
        return Response({'valid': False, 'message': 'Token expirado o ya utilizado'})
    except PasswordResetRequest.DoesNotExist:
        return Response({'valid': False, 'message': 'Token inválido'})
