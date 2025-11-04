# backend/authentication/views.py
from rest_framework import status, generics, permissions
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from rest_framework.authentication import TokenAuthentication, SessionAuthentication
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.views import APIView

from django.core.signing import TimestampSigner, BadSignature
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

from dj_rest_auth.registration.views import SocialLoginView
from allauth.socialaccount.providers.google.views import GoogleOAuth2Adapter
from allauth.socialaccount.providers.oauth2.client import OAuth2Client
from django.conf import settings

import secrets
import logging
from django.core.cache import cache

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
                    secure=getattr(settings, 'SESSION_COOKIE_SECURE', False),
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
        """Override para logging mejorado y gestión segura de avatares"""
        partial = kwargs.pop('partial', True)
        instance = self.get_object()
        
        # Guardar referencia al avatar anterior ANTES de actualizar
        old_avatar = None
        try:
            if 'avatar' in request.data and hasattr(instance, 'profile') and instance.profile.avatar:
                old_avatar = instance.profile.avatar
        except UserProfile.DoesNotExist:
            pass
        
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        
        if not serializer.is_valid():
            logger.warning(f"Error validando perfil de {instance.email}: {serializer.errors}")
            return Response({
                "success": False,
                "errors": serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            # Actualizar en transacción
            with transaction.atomic():
                self.perform_update(serializer)
            
            # Solo eliminar archivo antiguo si la actualización fue exitosa
            if old_avatar and 'avatar' in request.data:
                try:
                    old_avatar.delete(save=False)
                except Exception as e:
                    logger.warning(f"No se pudo eliminar avatar antiguo: {e}")
            
            logger.info(f"Perfil actualizado: {instance.email}")
            return Response(serializer.data, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error actualizando perfil de {instance.email}: {e}", exc_info=True)
            return Response({
                "success": False,
                "errors": {"detail": "Error al actualizar el perfil"}
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
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
    Retorna únicamente si el token es válido.
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
            return Response({
                "valid": True, 
                "message": "Token válido"
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
# VISTAS DE GESTIÓN DE NOTIFICACIONES (CON TOKENS FIRMADOS)
# ============================================================================

@csrf_exempt
@require_http_methods(["GET", "POST"])
def unsubscribe_notifications(request, signed_token):
    """
    Permite a los usuarios darse de baja de notificaciones por email.
    Usa tokens firmados para seguridad (válidos por 30 días).
    
    GET: Muestra página de confirmación
    POST: Procesa la baja
    """
    try:
        # Validar token firmado
        signer = TimestampSigner()
        user_id = signer.unsign(signed_token, max_age=2592000)  # 30 días
        user = User.objects.get(id=user_id)
        
        if request.method == "POST":
            user.receive_notifications = False
            user.save(update_fields=['receive_notifications'])
            
            logger.info(f"Usuario dado de baja de notificaciones: user_id={user.id}, email={user.email}")
            
            return JsonResponse({
                "success": True,
                "message": "Te has dado de baja exitosamente de las notificaciones por email",
                "is_subscribed": False
            })
        
        # GET: Mostrar página de confirmación
        # Generar nuevo token para resubscribe
        resubscribe_token = signer.sign(str(user.id))
        resubscribe_url = request.build_absolute_uri(
            f"/api/auth/resubscribe/{resubscribe_token}/"
        )
        
        context = {
            "user": user,
            "email": user.email,
            "first_name": user.first_name or user.username,
            "is_subscribed": user.receive_notifications,
            "signed_token": signed_token,
            "resubscribe_url": resubscribe_url,
        }
        return render(request, "emails/unsubscribe.html", context)
        
    except BadSignature:
        logger.error(f"Token de baja inválido o expirado: {signed_token[:20]}...")
        return HttpResponse(
            "Link de baja inválido o expirado (válido por 30 días). "
            "Por favor solicita un nuevo link desde tu perfil.",
            status=400
        )
    except User.DoesNotExist:
        logger.error(f"Usuario no encontrado para token de baja")
        return HttpResponse("Usuario no encontrado", status=404)
    except Exception as e:
        logger.error(f"Error en unsubscribe: {e}", exc_info=True)
        return HttpResponse("Error procesando solicitud", status=500)


@csrf_exempt
@require_http_methods(["GET", "POST"])
def resubscribe_notifications(request, signed_token):
    """
    Permite a los usuarios volver a suscribirse a notificaciones.
    Usa tokens firmados para seguridad (válidos por 30 días).
    
    GET: Muestra página de confirmación
    POST: Procesa la suscripción
    """
    try:
        # Validar token firmado
        signer = TimestampSigner()
        user_id = signer.unsign(signed_token, max_age=2592000)  # 30 días
        user = User.objects.get(id=user_id)
        
        if request.method == "POST":
            user.receive_notifications = True
            user.save(update_fields=['receive_notifications'])
            
            logger.info(f"Usuario re-suscrito a notificaciones: user_id={user.id}, email={user.email}")
            
            return JsonResponse({
                "success": True,
                "message": "¡Notificaciones reactivadas! Volverás a recibir emails cuando ganes premios.",
                "is_subscribed": True
            })
        
        # GET: Mostrar página de confirmación
        # Generar nuevo token para unsubscribe
        unsubscribe_token = signer.sign(str(user.id))
        unsubscribe_url = request.build_absolute_uri(
            f"/api/auth/unsubscribe/{unsubscribe_token}/"
        )
        
        context = {
            "user": user,
            "email": user.email,
            "first_name": user.first_name or user.username,
            "is_subscribed": user.receive_notifications,
            "signed_token": signed_token,
            "unsubscribe_url": unsubscribe_url,
        }
        return render(request, "emails/resubscribe.html", context)
        
    except BadSignature:
        logger.error(f"Token de suscripción inválido o expirado: {signed_token[:20]}...")
        return HttpResponse(
            "Link de suscripción inválido o expirado (válido por 30 días). "
            "Por favor solicita un nuevo link desde tu perfil.",
            status=400
        )
    except User.DoesNotExist:
        logger.error(f"Usuario no encontrado para token de suscripción")
        return HttpResponse("Usuario no encontrado", status=404)
    except Exception as e:
        logger.error(f"Error en resubscribe: {e}", exc_info=True)
        return HttpResponse("Error procesando solicitud", status=500)
    
# authentication/views.py

@api_view(["POST"])
@permission_classes([permissions.AllowAny])
@authentication_classes([])
def check_email_exists(request):
    email = request.data.get("email", "").strip().lower()
    ip = request.META.get('REMOTE_ADDR')
    
    # Rate limit: máximo 10 consultas por IP cada 5 minutos
    cache_key = f"email_check_{ip}"
    attempts = cache.get(cache_key, 0)
    
    if attempts >= 10:
        logger.warning(f"Rate limit excedido para IP {ip} en check_email")
        return Response(
            {"error": "Demasiadas consultas. Intenta en unos minutos."},
            status=status.HTTP_429_TOO_MANY_REQUESTS
        )
    
    cache.set(cache_key, attempts + 1, 300)  # 5 minutos
    
    exists = User.objects.filter(email__iexact=email).exists()
    
    return Response({
        "exists": exists,
        "message": "Email encontrado" if exists else "Email no registrado"
    })
# autentificacion GoogleOAuth2A
class GoogleLogin(SocialLoginView):
    """
    Vista para manejar login con Google
    """
    adapter_class = GoogleOAuth2Adapter
    callback_url = settings.GOOGLE_OAUTH_CALLBACK_URL  # URL del frontend
    client_class = OAuth2Client

# ============================================================================
# GOOGLE OAUTH LOGIN (Para @react-oauth/google)
# ============================================================================

import requests as http_requests

@api_view(['POST'])
@permission_classes([permissions.AllowAny])
@authentication_classes([])
def google_oauth_login(request):
    """
    Endpoint para autenticación con Google OAuth usando access_token.
    Compatible con @react-oauth/google del frontend.
    """
    try:
        access_token = request.data.get('access_token')
        
        if not access_token:
            return Response({
                'success': False,
                'error': 'No se proporcionó el token de acceso'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Obtener información del usuario desde Google
        try:
            user_info_response = http_requests.get(
                'https://www.googleapis.com/oauth2/v3/userinfo',
                headers={'Authorization': f'Bearer {access_token}'},
                timeout=10
            )
            user_info_response.raise_for_status()
        except http_requests.RequestException as e:
            logger.error(f"Error validando token de Google: {str(e)}")
            return Response({
                'success': False,
                'error': 'Token de Google inválido o expirado'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        user_info = user_info_response.json()
        
        # Extraer datos del usuario
        email = user_info.get('email')
        first_name = user_info.get('given_name', '')
        last_name = user_info.get('family_name', '')
        
        if not email:
            return Response({
                'success': False,
                'error': 'No se pudo obtener el email del usuario'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Verificar email verificado
        if not user_info.get('email_verified', False):
            return Response({
                'success': False,
                'error': 'El email de Google no está verificado'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Buscar o crear usuario
        with transaction.atomic():
            user, created = User.objects.get_or_create(
                email=email,
                defaults={
                    'username': email.split('@')[0],
                    'first_name': first_name,
                    'last_name': last_name,
                    'is_active': True,
                    'is_email_verified': True,
                }
            )
            
            # Actualizar datos si el usuario ya existía
            if not created:
                if first_name:
                    user.first_name = first_name
                if last_name:
                    user.last_name = last_name
                user.is_email_verified = True
                user.save()
            else:
                # Enviar email de bienvenida para nuevos usuarios
                try:
                    send_welcome_email(user)
                    logger.info(f"Email de bienvenida enviado: {email}")
                except Exception as e:
                    logger.error(f"Error enviando email de bienvenida: {e}")
            
            # Crear o recuperar token
            token, _ = Token.objects.get_or_create(user=user)
            
            # Actualizar last_login
            user.last_login = timezone.now()
            user.save(update_fields=['last_login'])
            
            logger.info(f"Login con Google exitoso: {email} (nuevo={created})")
            
            # Obtener teléfono del perfil
            phone = None
            try:
                phone = getattr(user.profile, 'phone', None)
            except UserProfile.DoesNotExist:
                pass
            
            return Response({
                'success': True,
                'message': 'Inicio de sesión exitoso',
                'tokens': {
                    'access': token.key,
                    'refresh': token.key,
                },
                'user': {
                    'id': user.id,
                    'email': user.email,
                    'username': user.username,
                    'first_name': user.first_name,
                    'last_name': user.last_name,
                    'role': user.role,
                    'is_admin': user.is_admin(),
                    'profile': {'phone': phone} if phone else None,
                }
            }, status=status.HTTP_200_OK)
            
    except Exception as e:
        logger.error(f"Error en Google OAuth: {str(e)}", exc_info=True)
        return Response({
            'success': False,
            'error': 'Error interno del servidor'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)