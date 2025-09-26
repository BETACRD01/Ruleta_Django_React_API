# backend/authentication/views.py
from rest_framework import status, generics, permissions
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from rest_framework.authentication import TokenAuthentication, SessionAuthentication
from rest_framework.views import APIView

from django.contrib.auth import login, logout
from django.core.mail import send_mail
from django.conf import settings
from django.template.loader import render_to_string
from django.template import TemplateDoesNotExist
from django.utils.html import strip_tags
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
    ChangePasswordSerializer,
)

logger = logging.getLogger(__name__)


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserRegistrationSerializer
    permission_classes = [permissions.AllowAny]
    authentication_classes = []  # público real

    def create(self, request, *args, **kwargs):
        """
        Si falla: 400 con errores del serializer.
        Si éxito: 201 con representación segura del usuario (sin contraseña).
        """
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            logger.warning(f"Registro inválido: {serializer.errors}")
            return Response({"success": False, "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            user = serializer.save()

            try:
                phone = getattr(user.profile, "phone", None)
            except UserProfile.DoesNotExist:
                phone = None

            logger.info(f"Nuevo usuario registrado: {user.email} con teléfono: {phone or ''}")

            # Correo de bienvenida (no bloqueante)
            self.send_welcome_email(user)

        # Re-serializamos para respuesta (sin campos write_only)
        out = self.get_serializer(instance=user)
        # Opcional: puedes envolver como {"success": True, "user": out.data}
        return Response(out.data, status=status.HTTP_201_CREATED)

    def send_welcome_email(self, user):
        """Intenta enviar HTML; si no hay template, cae a texto plano. No rompe el registro si falla."""
        try:
            subject = "¡Bienvenido al Sistema de Ruletas!"
            ctx = {"user": user, "site_name": "Sistema de Ruletas"}

            try:
                html_message = render_to_string("authentication/welcome_email.html", ctx)
                plain_message = strip_tags(html_message)
            except TemplateDoesNotExist:
                html_message = None
                plain_message = (
                    f"Hola {user.first_name or user.username},\n\n"
                    "¡Bienvenido al Sistema de Ruletas!\n\n"
                    "— Sistema de Ruletas"
                )

            send_mail(
                subject,
                plain_message if not html_message else strip_tags(html_message),
                getattr(settings, "DEFAULT_FROM_EMAIL", "no-reply@ruletas.local"),
                [user.email],
                html_message=html_message,
                fail_silently=True,  # no bloquear el registro si falla
            )
            logger.info(f"Email de bienvenida enviado a: {user.email}")
        except Exception as e:
            logger.error(f"Error enviando email de bienvenida: {e}")


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []  # público real

    def post(self, request):
        serializer = UserLoginSerializer(data=request.data, context={"request": request})
        if serializer.is_valid():
            user = serializer.validated_data["user"]

            token, _ = Token.objects.get_or_create(user=user)
            login(request, user)

            user.last_login = timezone.now()
            user.save(update_fields=["last_login"])

            logger.info(f"Usuario logueado: {user.email}")

            # Agregamos teléfono del perfil si existe (útil para el front)
            phone = None
            try:
                phone = getattr(user.profile, "phone", None)
            except UserProfile.DoesNotExist:
                pass

            resp = {
                "success": True,
                "message": "Inicio de sesión exitoso",
                "token_type": "Token",
                "token": token.key,
                "user": {
                    "id": user.id,
                    "username": user.username,
                    "email": user.email,
                    "first_name": user.first_name,
                    "last_name": user.last_name,
                    "role": user.role,
                    "is_admin": user.is_admin(),
                    "profile": {"phone": phone} if phone else None,
                },
            }

            response = Response(resp, status=status.HTTP_200_OK)
            try:
                response.set_cookie(
                    "authToken",
                    token.key,
                    max_age=60 * 60 * 24 * 7,
                    secure=False,
                    httponly=False,
                    samesite="Lax",
                )
            except Exception:
                pass
            return response

        return Response(
            {"success": False, "message": "Credenciales inválidas", "errors": serializer.errors},
            status=status.HTTP_400_BAD_REQUEST,
        )


class LogoutView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    authentication_classes = [TokenAuthentication, SessionAuthentication]

    def post(self, request):
        try:
            user_email = request.user.email if request.user.is_authenticated else "Usuario anónimo"
            try:
                Token.objects.get(user=request.user).delete()
            except Token.DoesNotExist:
                pass
            logout(request)
            logger.info(f"Usuario deslogueado: {user_email}")
            response = Response({"success": True, "message": "Sesión cerrada exitosamente"}, status=status.HTTP_200_OK)
            response.delete_cookie("authToken")
            return response
        except Exception as e:
            logger.error(f"Error durante logout: {str(e)}")
            return Response(
                {"success": False, "message": "Error al cerrar sesión"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class ProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = UserProfileSerializer
    permission_classes = [permissions.IsAuthenticated]
    authentication_classes = [TokenAuthentication, SessionAuthentication]

    def get_object(self):
        return self.request.user


class ProfileDetailView(generics.RetrieveAPIView):
    serializer_class = UserProfileDetailSerializer
    permission_classes = [permissions.IsAuthenticated]
    authentication_classes = [TokenAuthentication, SessionAuthentication]

    def get_object(self):
        return self.request.user


class PasswordResetRequestView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []  # público real: ignora Authorization inválido

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        # Para no filtrar info, devolvemos 200 aunque traiga errores
        if not serializer.is_valid():
            logger.info("Solicitud de reset con datos inválidos (respuesta genérica 200).")
            return Response(
                {"success": True, "message": "Si el correo existe, te enviaremos instrucciones."},
                status=status.HTTP_200_OK,
            )

        email = serializer.validated_data["email"]
        user = User.objects.filter(email=email).first()

        # Respuesta genérica si no existe
        if not user:
            logger.info(f"Reset solicitado para email no existente: {email}")
            return Response(
                {"success": True, "message": "Si el correo existe, te enviaremos instrucciones."},
                status=status.HTTP_200_OK,
            )

        # Límite diario (doble check sin delatar info)
        if not PasswordResetRequest.can_request_reset(user):
            logger.info(f"Límite diario alcanzado para {email}")
            return Response(
                {"success": True, "message": "Si el correo existe, te enviaremos instrucciones."},
                status=status.HTTP_200_OK,
            )

        # Generar token y registrar solicitud
        token = secrets.token_urlsafe(32)
        reset_request = PasswordResetRequest.objects.create(user=user, token=token)

        if self.send_reset_email(user, token):
            logger.info(f"Solicitud de restablecimiento creada para: {email}")
            return Response(
                {"success": True, "message": "Si el correo existe, te enviaremos instrucciones."},
                status=status.HTTP_200_OK,
            )

        # Si falló el envío, limpiar el registro creado
        reset_request.delete()
        return Response(
            {"success": False, "message": "No pudimos enviar el correo. Inténtalo más tarde."},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    def send_reset_email(self, user, token):
        """Envío con fallback: HTML si hay template, si no, texto plano."""
        try:
            subject = "Restablecimiento de Contraseña - Sistema de Ruletas"
            base = getattr(settings, "FRONTEND_BASE_URL", "http://localhost:3000").rstrip("/")
            reset_url = f"{base}/reset-password?token={token}"
            ctx = {"user": user, "reset_url": reset_url, "site_name": "Sistema de Ruletas"}

            try:
                html_message = render_to_string("authentication/password_reset_email.html", ctx)
            except TemplateDoesNotExist:
                html_message = None

            try:
                plain_message = render_to_string("authentication/password_reset_email.txt", ctx)
            except TemplateDoesNotExist:
                plain_message = (
                    f"Hola {user.first_name or user.username},\n\n"
                    f"Para restablecer tu contraseña, abre este enlace:\n{reset_url}\n\n"
                    "Si no solicitaste esto, ignora este correo.\n"
                    "— Sistema de Ruletas"
                )

            send_mail(
                subject,
                strip_tags(html_message) if html_message else plain_message,
                getattr(settings, "DEFAULT_FROM_EMAIL", "no-reply@ruletas.local"),
                [user.email],
                html_message=html_message,
                fail_silently=False,
            )
            logger.info(f"Email de restablecimiento enviado a: {user.email}")
            return True
        except Exception as e:
            logger.error(f"Error enviando email de restablecimiento: {e}")
            return False


class PasswordResetConfirmView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []  # público real

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        if serializer.is_valid():
            reset_request = serializer.validated_data["reset_request"]
            new_password = serializer.validated_data["new_password"]
            with transaction.atomic():
                user = reset_request.user
                user.set_password(new_password)
                user.save()
                reset_request.is_used = True
                reset_request.save()
                Token.objects.filter(user=user).delete()
                logger.info(f"Contraseña restablecida para: {user.email}")
                return Response(
                    {
                        "success": True,
                        "message": "Contraseña restablecida exitosamente. Puedes iniciar sesión con tu nueva contraseña.",
                    },
                    status=status.HTTP_200_OK,
                )
        return Response({"success": False, "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)


class ChangePasswordView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    authentication_classes = [TokenAuthentication, SessionAuthentication]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={"request": request})
        if serializer.is_valid():
            user = request.user
            new_password = serializer.validated_data["new_password"]
            user.set_password(new_password)
            user.save()
            try:
                Token.objects.get(user=user).delete()
                new_token = Token.objects.create(user=user)
                logger.info(f"Contraseña cambiada para: {user.email}")
                return Response(
                    {"success": True, "message": "Contraseña cambiada exitosamente.", "new_token": new_token.key},
                    status=status.HTTP_200_OK,
                )
            except Token.DoesNotExist:
                return Response({"success": True, "message": "Contraseña cambiada exitosamente."}, status=status.HTTP_200_OK)
        return Response({"success": False, "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
@authentication_classes([TokenAuthentication, SessionAuthentication])
def user_info(request):
    user = request.user
    # añadimos teléfono del perfil si existe
    phone = None
    try:
        phone = getattr(user.profile, "phone", None)
    except UserProfile.DoesNotExist:
        pass

    return Response(
        {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "role": user.role,
            "is_admin": user.is_admin(),
            "is_email_verified": user.is_email_verified,
            "last_login": user.last_login,
            "date_joined": user.date_joined,
            "profile": {"phone": phone} if phone else None,
        }
    )


@api_view(["POST"])
@permission_classes([permissions.AllowAny])
@authentication_classes([])  # público real: evita 401 por Authorization inválido
def validate_reset_token(request):
    token = request.data.get("token")
    if not token:
        return Response({"valid": False, "message": "Token requerido"}, status=status.HTTP_400_BAD_REQUEST)
    try:
        reset_request = PasswordResetRequest.objects.get(token=token)
        if reset_request.is_valid():
            masked = reset_request.user.email
            masked = masked[:3] + "***@" + masked.split("@", 1)[1]
            return Response({"valid": True, "message": "Token válido", "email": masked})
        return Response({"valid": False, "message": "Token expirado o ya utilizado"})
    except PasswordResetRequest.DoesNotExist:
        return Response({"valid": False, "message": "Token inválido"})
