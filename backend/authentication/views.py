# backend/authentication/views.py
from rest_framework import status, generics, permissions
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from rest_framework.authentication import TokenAuthentication, SessionAuthentication
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.views import APIView

from django.contrib.auth import login, logout
from django.core.mail import send_mail
from django.conf import settings
from django.template.loader import render_to_string
from django.template import TemplateDoesNotExist
from django.utils.html import strip_tags
from django.db import transaction
from django.utils import timezone
from django.shortcuts import render
from django.http import JsonResponse, HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.utils.http import urlsafe_base64_decode
from django.utils.encoding import force_str

import secrets
import logging

from .models import User, PasswordResetRequest, UserProfile
from .serializers import (
    UserRegistrationSerializer,
    UserLoginSerializer,
    UserProfileSerializer,
    UserProfileUpdateSerializer,
    UserProfileDetailSerializer,
    PasswordResetRequestSerializer,
    PasswordResetConfirmSerializer,
    ChangePasswordSerializer,
)

# IMPORTAR SERVICIOS DE NOTIFICACIONES
from notifications.welcome_email_service import send_welcome_email
from notifications.password_reset_service import send_password_reset_email, send_password_change_confirmation

logger = logging.getLogger(__name__)


# ============================================================================
# VISTAS DE AUTENTICACIÓN
# ============================================================================

class RegisterView(generics.CreateAPIView):
    """
    Vista para registro de nuevos usuarios.
    Envía email de bienvenida automáticamente.
    """
    queryset = User.objects.all()
    serializer_class = UserRegistrationSerializer
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        
        if not serializer.is_valid():
            logger.warning(f"Registro inválido: {serializer.errors}")
            return Response(
                {"success": False, "errors": serializer.errors}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        with transaction.atomic():
            user = serializer.save()

            try:
                phone = getattr(user.profile, "phone", None)
            except UserProfile.DoesNotExist:
                phone = None

            logger.info(f"Nuevo usuario registrado: {user.email} con teléfono: {phone or 'N/A'}")
            
            # ============================================================
            # ENVIAR EMAIL DE BIENVENIDA
            # ============================================================
            try:
                email_sent = send_welcome_email(user)
                if email_sent:
                    logger.info(f"Email de bienvenida enviado exitosamente a: {user.email}")
                else:
                    logger.warning(f"No se pudo enviar email de bienvenida a: {user.email}")
            except Exception as e:
                # No fallar el registro si el email falla
                logger.error(f"Error enviando email de bienvenida: {e}", exc_info=True)

        out = self.get_serializer(instance=user)
        return Response(out.data, status=status.HTTP_201_CREATED)


class LoginView(APIView):
    """
    Vista para inicio de sesión.
    Retorna token de autenticación y datos del usuario.
    """
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        serializer = UserLoginSerializer(data=request.data, context={"request": request})
        
        if serializer.is_valid():
            user = serializer.validated_data["user"]

            # Crear o recuperar token
            token, _ = Token.objects.get_or_create(user=user)
            login(request, user)

            # Actualizar last_login
            user.last_login = timezone.now()
            user.save(update_fields=["last_login"])

            logger.info(f"Usuario logueado: {user.email}")

            # Obtener teléfono del perfil si existe
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
            
            # Establecer cookie de autenticación
            try:
                response.set_cookie(
                    "authToken",
                    token.key,
                    max_age=60 * 60 * 24 * 7,  # 7 días
                    secure=False,  # Cambiar a True en producción con HTTPS
                    httponly=False,
                    samesite="Lax",
                )
            except Exception as e:
                logger.warning(f"No se pudo establecer cookie: {e}")
                
            return response

        return Response(
            {
                "success": False, 
                "message": "Credenciales inválidas", 
                "errors": serializer.errors
            },
            status=status.HTTP_400_BAD_REQUEST,
        )


class LogoutView(APIView):
    """
    Vista para cerrar sesión.
    Elimina el token y la sesión del usuario.
    """
    permission_classes = [permissions.IsAuthenticated]
    authentication_classes = [TokenAuthentication, SessionAuthentication]

    def post(self, request):
        try:
            user_email = request.user.email if request.user.is_authenticated else "Usuario anónimo"
            
            # Eliminar token
            try:
                Token.objects.get(user=request.user).delete()
            except Token.DoesNotExist:
                pass
            
            # Cerrar sesión
            logout(request)
            logger.info(f"Usuario deslogueado: {user_email}")
            
            response = Response(
                {"success": True, "message": "Sesión cerrada exitosamente"}, 
                status=status.HTTP_200_OK
            )
            response.delete_cookie("authToken")
            return response
            
        except Exception as e:
            logger.error(f"Error durante logout: {str(e)}", exc_info=True)
            return Response(
                {"success": False, "message": "Error al cerrar sesión"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


# ============================================================================
# VISTAS DE PERFIL
# ============================================================================

class ProfileView(generics.RetrieveUpdateAPIView):
    """
    Vista para obtener y actualizar el perfil del usuario.
    Soporta multipart/form-data para subir avatar.
    """
    permission_classes = [permissions.IsAuthenticated]
    authentication_classes = [TokenAuthentication, SessionAuthentication]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_object(self):
        return self.request.user

    def get_serializer_class(self):
        if self.request.method in ['PUT', 'PATCH']:
            return UserProfileUpdateSerializer
        return UserProfileSerializer
    
    def update(self, request, *args, **kwargs):
        """Override para logging mejorado"""
        partial = kwargs.pop('partial', True)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        
        if not serializer.is_valid():
            logger.warning(f"Error validando perfil de {instance.email}: {serializer.errors}")
            return Response({
                "success": False,
                "errors": serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)
        
        self.perform_update(serializer)
        logger.info(f"Perfil actualizado: {instance.email}")
        
        return Response(serializer.data, status=status.HTTP_200_OK)
    
    def partial_update(self, request, *args, **kwargs):
        """PATCH request"""
        kwargs['partial'] = True
        return self.update(request, *args, **kwargs)


class ProfileDetailView(generics.RetrieveAPIView):
    """
    Vista para obtener información detallada del perfil del usuario autenticado.
    """
    serializer_class = UserProfileDetailSerializer
    permission_classes = [permissions.IsAuthenticated]
    authentication_classes = [TokenAuthentication, SessionAuthentication]

    def get_object(self):
        return self.request.user


# ============================================================================
# VISTAS DE RESTABLECIMIENTO DE CONTRASEÑA
# ============================================================================

class PasswordResetRequestView(APIView):
    """
    Vista para solicitar restablecimiento de contraseña.
    Envía email con link de reset si el usuario existe.
    Siempre retorna 200 OK para prevenir enumeración de usuarios.
    """
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        
        if not serializer.is_valid():
            logger.info("Solicitud de reset con datos inválidos (respuesta genérica 200)")
            return Response(
                {"success": True, "message": "Si el correo existe, te enviaremos instrucciones."},
                status=status.HTTP_200_OK,
            )

        email = serializer.validated_data["email"]
        user = User.objects.filter(email=email).first()

        if not user:
            logger.info("Reset solicitado para email no existente")
            return Response(
                {"success": True, "message": "Si el correo existe, te enviaremos instrucciones."},
                status=status.HTTP_200_OK,
            )

        if not PasswordResetRequest.can_request_reset(user):
            logger.info(f"Límite diario alcanzado para usuario: {user.id}")
            return Response(
                {"success": True, "message": "Si el correo existe, te enviaremos instrucciones."},
                status=status.HTTP_200_OK,
            )

        # Generar token seguro
        token = secrets.token_urlsafe(32)
        
        # Crear registro de reset
        reset_request = PasswordResetRequest.objects.create(user=user, token=token)

        # ============================================================
        # USAR EL SERVICIO DE EMAIL DE RESTABLECIMIENTO
        # ============================================================
        try:
            email_sent = send_password_reset_email(user, token)
            
            if email_sent:
                logger.info(f"Email de restablecimiento enviado exitosamente: user_id={user.id}")
                return Response(
                    {"success": True, "message": "Si el correo existe, te enviaremos instrucciones."},
                    status=status.HTTP_200_OK,
                )
            else:
                logger.error(f"Fallo al enviar email de restablecimiento: user_id={user.id}")
                # No eliminar reset_request - el usuario puede intentar de nuevo
                return Response(
                    {"success": True, "message": "Si el correo existe, te enviaremos instrucciones."},
                    status=status.HTTP_200_OK,
                )
        except Exception as e:
            logger.error(f"Excepción enviando email de restablecimiento: {e}", exc_info=True)
            # Mantener el reset_request por si el problema es temporal
            return Response(
                {"success": True, "message": "Si el correo existe, te enviaremos instrucciones."},
                status=status.HTTP_200_OK,
            )


class PasswordResetConfirmView(APIView):
    """
    Vista para confirmar restablecimiento de contraseña.
    Valida el token y actualiza la contraseña del usuario.
    """
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        
        if serializer.is_valid():
            reset_request = serializer.validated_data["reset_request"]
            new_password = serializer.validated_data["new_password"]
            
            with transaction.atomic():
                user = reset_request.user
                user.set_password(new_password)
                user.save()
                
                # Marcar como usado
                reset_request.is_used = True
                reset_request.save()
                
                # Invalidar todos los tokens existentes
                Token.objects.filter(user=user).delete()
                
                logger.info(f"Contraseña restablecida exitosamente: user_id={user.id}")
                
                # ============================================================
                # ENVIAR EMAIL DE CONFIRMACIÓN
                # ============================================================
                try:
                    send_password_change_confirmation(user)
                    logger.info(f"Email de confirmación de cambio enviado: user_id={user.id}")
                except Exception as e:
                    # No fallar si el email de confirmación falla
                    logger.error(f"Error enviando confirmación de cambio: {e}", exc_info=True)
                
                return Response(
                    {
                        "success": True,
                        "message": "Contraseña restablecida exitosamente. Puedes iniciar sesión con tu nueva contraseña.",
                    },
                    status=status.HTTP_200_OK,
                )
        
        return Response(
            {"success": False, "errors": serializer.errors}, 
            status=status.HTTP_400_BAD_REQUEST
        )


class ChangePasswordView(APIView):
    """
    Vista para cambio de contraseña de usuarios autenticados.
    Requiere la contraseña actual y genera un nuevo token.
    """
    permission_classes = [permissions.IsAuthenticated]
    authentication_classes = [TokenAuthentication, SessionAuthentication]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={"request": request})
        
        if serializer.is_valid():
            user = request.user
            new_password = serializer.validated_data["new_password"]
            
            # Cambiar contraseña
            user.set_password(new_password)
            user.save()
            
            try:
                # Invalidar token antiguo y crear uno nuevo
                Token.objects.get(user=user).delete()
                new_token = Token.objects.create(user=user)
                
                logger.info(f"Contraseña cambiada exitosamente: user_id={user.id}")
                
                # ============================================================
                # ENVIAR EMAIL DE CONFIRMACIÓN
                # ============================================================
                try:
                    send_password_change_confirmation(user)
                    logger.info(f"Confirmación de cambio de contraseña enviada: user_id={user.id}")
                except Exception as e:
                    logger.error(f"Error enviando confirmación de cambio: {e}", exc_info=True)
                
                return Response(
                    {
                        "success": True, 
                        "message": "Contraseña cambiada exitosamente.",
                        "new_token": new_token.key
                    },
                    status=status.HTTP_200_OK,
                )
            except Token.DoesNotExist:
                return Response(
                    {"success": True, "message": "Contraseña cambiada exitosamente."}, 
                    status=status.HTTP_200_OK
                )
        
        return Response(
            {"success": False, "errors": serializer.errors}, 
            status=status.HTTP_400_BAD_REQUEST
        )


# ============================================================================
# API VIEWS AUXILIARES
# ============================================================================

@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
@authentication_classes([TokenAuthentication, SessionAuthentication])
def user_info(request):
    """
    Retorna información completa del usuario autenticado.
    """
    user = request.user
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
@authentication_classes([])
def validate_reset_token(request):
    """
    Valida un token de restablecimiento de contraseña.
    Retorna si es válido y el email enmascarado del usuario.
    """
    token = request.data.get("token")
    
    if not token:
        return Response(
            {"valid": False, "message": "Token requerido"}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        reset_request = PasswordResetRequest.objects.get(token=token)
        
        if reset_request.is_valid():
            # Enmascarar email para privacidad
            email = reset_request.user.email
            masked = email[:3] + "***@" + email.split("@", 1)[1]
            
            return Response({
                "valid": True, 
                "message": "Token válido", 
                "email": masked
            })
        
        return Response({
            "valid": False, 
            "message": "Token expirado o ya utilizado"
        })
        
    except PasswordResetRequest.DoesNotExist:
        return Response({
            "valid": False, 
            "message": "Token inválido"
        })


# ============================================================================
# VISTAS DE GESTIÓN DE NOTIFICACIONES
# ============================================================================

@csrf_exempt
@require_http_methods(["GET", "POST"])
def unsubscribe_notifications(request, user_id_b64):
    """
    Permite a los usuarios darse de baja de notificaciones por email.
    GET: Muestra página de confirmación
    POST: Procesa la baja
    """
    try:
        user_id = force_str(urlsafe_base64_decode(user_id_b64))
        user = User.objects.get(id=user_id)
        
        if request.method == "POST":
            user.receive_notifications = False
            user.save(update_fields=['receive_notifications'])
            
            logger.info(f"Usuario dado de baja de notificaciones: user_id={user.id}")
            
            return JsonResponse({
                "success": True,
                "message": "Te has dado de baja exitosamente de las notificaciones por email",
                "is_subscribed": False
            })
        
        # GET: Mostrar página de confirmación
        # Construir URL de resubscribe
        resubscribe_url = request.build_absolute_uri(
            request.path.replace('/unsubscribe/', '/resubscribe/')
        )
        
        context = {
            "user": user,
            "email": user.email,
            "first_name": user.first_name or user.username,
            "is_subscribed": user.receive_notifications,  # Detecta si está suscrito
            "user_id_b64": user_id_b64,
            "resubscribe_url": resubscribe_url,  # URL para reactivar
        }
        return render(request, "emails/unsubscribe.html", context)
        
    except (TypeError, ValueError, OverflowError, User.DoesNotExist) as e:
        logger.error(f"Link de baja inválido: {e}")
        return HttpResponse("Link de baja inválido o expirado", status=400)


@csrf_exempt
@require_http_methods(["GET", "POST"])
def resubscribe_notifications(request, user_id_b64):
    """
    Permite a los usuarios volver a suscribirse a notificaciones.
    GET: Muestra página de confirmación
    POST: Procesa la suscripción
    """
    try:
        user_id = force_str(urlsafe_base64_decode(user_id_b64))
        user = User.objects.get(id=user_id)
        
        if request.method == "POST":
            user.receive_notifications = True
            user.save(update_fields=['receive_notifications'])
            
            logger.info(f"Usuario re-suscrito a notificaciones: user_id={user.id}")
            
            return JsonResponse({
                "success": True,
                "message": "¡Notificaciones reactivadas! Volverás a recibir emails cuando ganes premios.",
                "is_subscribed": True
            })
        
        # GET: Mostrar página de confirmación
        # Construir URL de unsubscribe
        unsubscribe_url = request.build_absolute_uri(
            request.path.replace('/resubscribe/', '/unsubscribe/')
        )
        
        context = {
            "user": user,
            "email": user.email,
            "first_name": user.first_name or user.username,
            "is_subscribed": user.receive_notifications,  # Detecta si está suscrito
            "user_id_b64": user_id_b64,
            "unsubscribe_url": unsubscribe_url,  # URL para desactivar
        }
        return render(request, "emails/resubscribe.html", context)
        
    except (TypeError, ValueError, OverflowError, User.DoesNotExist) as e:
        logger.error(f"Link de suscripción inválido: {e}")
        return HttpResponse("Link de suscripción inválido o expirado", status=400)