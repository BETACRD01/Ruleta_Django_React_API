# participants/views.py

from django.shortcuts import get_object_or_404
from django.db import transaction
from rest_framework import permissions, status, generics
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response

from .models import Participation
from .serializers import (
    ParticipationSerializer,
    ParticipantBasicSerializer,
    ParticipantFullSerializer,
    MyParticipationsSerializer,
)
from roulettes.models import Roulette, RouletteSettings


# ============================================================================
# ENDPOINT: POST /api/participants/participations/participate/
# Descripción: Crear una nueva participación en una ruleta
# ============================================================================

@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
@transaction.atomic
def participate(request):
    """
    Crea una nueva participación del usuario autenticado en una ruleta.
    
    Parámetros esperados:
    - roulette_id (requerido): ID de la ruleta
    - receipt (opcional): Archivo del comprobante (si es requerido por la ruleta)
    
    Respuesta:
    - 201: Participación creada exitosamente
    - 400: Datos faltantes o inválidos
    - 500: Error en el servidor
    """
    
    # PASO 1: Validar que roulette_id esté presente
    roulette_id = request.data.get("roulette_id")
    if not roulette_id:
        return Response(
            {"success": False, "message": "ID de ruleta es requerido"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # PASO 2: Cargar ruleta con settings (optimizado con select_related)
    roulette = get_object_or_404(
        Roulette.objects.select_related('settings'),
        id=roulette_id
    )
    
    # PASO 3: Crear settings si no existen (fallback de seguridad)
    if not hasattr(roulette, 'settings') or not roulette.settings:
        print(f"⚠️ Ruleta {roulette_id} sin settings, creando...")
        RouletteSettings.objects.get_or_create(
            roulette=roulette,
            defaults={
                'max_participants': 0,
                'allow_multiple_entries': False,
                'show_countdown': True,
                'notify_on_participation': True,
                'notify_on_draw': True,
                'winners_target': 0,
                'require_receipt': True,
            }
        )
        roulette.refresh_from_db()
    
    # PASO 4: Obtener configuración de comprobante
    settings_obj = getattr(roulette, 'settings', None)
    require_receipt = True  # Por defecto, conservador
    
    if settings_obj:
        require_receipt = bool(getattr(settings_obj, 'require_receipt', True))
        print(f"🔍 Backend: require_receipt = {require_receipt}")
    else:
        print("⚠️ Backend: No hay settings, usando default=True")

    # PASO 5: Preparar datos para el serializer
    data = request.data.copy()
    data['roulette'] = roulette.id

    # PASO 6: Validar y crear participación
    serializer = ParticipationSerializer(
        data=data,
        context={
            'request': request,
            'roulette': roulette
        }
    )
    
    serializer.is_valid(raise_exception=True)
    
    # 🔴 CORRECCIÓN CRÍTICA: Asignar el usuario autenticado
    try:
        participation = serializer.save(user=request.user)
    except Exception as e:
        # Capturar excepciones de integridad (violaciones de UNIQUE, etc.)
        error_str = str(e)
        
        # Verificar si es violación de restricción única
        if "unique_participation_per_user_and_roulette" in error_str or "ya existe" in error_str:
            return Response(
                {
                    'success': False,
                    'message': 'Ya has participado en esta ruleta. No puedes participar dos veces.',
                    'error_code': 'duplicate_participation'
                },
                status=status.HTTP_409_CONFLICT,
            )
        
        # Para otros errores, registrar y retornar error genérico
        print(f"❌ Error inesperado al guardar participación: {e}")
        raise  # Re-lanzar para que Django lo maneje

    # PASO 7: Responder con la participación creada
    return Response({
        'success': True,
        'message': 'Te has registrado exitosamente',
        'participation': ParticipationSerializer(
            participation, 
            context={'request': request}
        ).data,
        'require_receipt': require_receipt,
    }, status=status.HTTP_201_CREATED)


# ============================================================================
# ENDPOINT: GET /api/participants/participations/my-participations/
# Descripción: Listar participaciones del usuario autenticado
# ============================================================================

class MyParticipationsView(generics.ListAPIView):
    """
    Lista todas las participaciones del usuario autenticado, ordenadas
    por más recientes primero. Incluye información de premios ganados.
    """
    serializer_class = MyParticipationsSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """
        Obtiene participaciones del usuario actual con optimizaciones:
        - select_related: Carga ruleta y premio en una sola query
        - order_by: Más recientes primero
        """
        return (
            Participation.objects.filter(user=self.request.user)
            .select_related(
                "roulette",
                "won_prize",
            )
            .order_by("-created_at")
        )

    def list(self, request, *args, **kwargs):
        """Respuesta personalizada con metadatos"""
        qs = self.get_queryset()
        serializer = self.get_serializer(qs, many=True)
        return Response(
            {
                "success": True,
                "total": qs.count(),
                "results": serializer.data,
            },
            status=status.HTTP_200_OK,
        )


# ============================================================================
# ENDPOINT: GET /api/participants/participations/check-participation/<id>/
# Descripción: Verificar si el usuario ya participa en una ruleta
# ============================================================================

@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def check_participation(request, roulette_id: int):
    """
    Verifica si el usuario ya participa en una ruleta específica.
    También devuelve si se requiere comprobante para participar.
    
    Parámetros:
    - roulette_id (path): ID de la ruleta
    
    Respuesta:
    - is_participating: bool - Si ya participa
    - require_receipt: bool - Si se requiere comprobante
    - participation: object - Datos de la participación (si existe)
    """
    
    # Cargar ruleta con settings
    roulette = get_object_or_404(
        Roulette.objects.select_related('settings'),
        id=roulette_id
    )
    
    # Obtener configuración de comprobante
    settings_obj = getattr(roulette, "settings", None)
    require_receipt = True  # Por defecto
    
    if settings_obj:
        require_receipt = bool(getattr(settings_obj, "require_receipt", True))
    
    # Verificar si ya existe participación del usuario
    participation = (
        Participation.objects
        .select_related("roulette", "won_prize")
        .filter(user=request.user, roulette=roulette)
        .first()
    )

    is_participating = participation is not None
    participation_data = None

    if participation:
        participation_data = MyParticipationsSerializer(
            participation,
            context={"request": request},
        ).data

    return Response(
        {
            "success": True,
            "is_participating": is_participating,
            "has_participated": is_participating,
            "require_receipt": require_receipt,
            "participation": participation_data,
        },
        status=status.HTTP_200_OK,
    )


# ============================================================================
# ENDPOINT: GET /api/participants/participations/roulette/<id>/
# Descripción: Listar participantes de una ruleta
# ============================================================================

class RouletteParticipantsView(generics.ListAPIView):
    """
    Lista todos los participantes de una ruleta específica, ordenados
    por número de participación. Devuelve participantes y ganadores.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """
        Obtiene participantes con optimizaciones de query:
        - select_related: Carga usuario, perfil y premio
        - order_by: Por número de participación
        """
        rid = self.kwargs["roulette_id"]
        self.roulette = get_object_or_404(Roulette, id=rid)
        return (
            Participation.objects.filter(roulette=self.roulette)
            .select_related(
                "user",
                "user__profile",
                "won_prize",
            )
            .order_by("participant_number")
        )

    def get_serializer_class(self):
        """
        Elige el serializer según parámetro 'full_data':
        - full_data=true → ParticipantFullSerializer (con todos los datos)
        - default → ParticipantBasicSerializer (datos esenciales)
        """
        if self.request.query_params.get("full_data") == "true":
            return ParticipantFullSerializer
        return ParticipantBasicSerializer

    def list(self, request, *args, **kwargs):
        """Respuesta personalizada con ganadores y todos los participantes"""
        qs = self.get_queryset()
        winners = qs.filter(is_winner=True)
        all_participants = qs

        serializer_class = self.get_serializer_class()

        winners_data = serializer_class(
            winners, 
            many=True, 
            context={"request": request}
        ).data
        
        participants_data = serializer_class(
            all_participants, 
            many=True, 
            context={"request": request}
        ).data

        return Response(
            {
                "success": True,
                "roulette_id": self.roulette.id,
                "roulette_name": getattr(self.roulette, "name", f"Roulette #{self.roulette.id}"),
                "total_participants": qs.count(),
                "winners_count": winners.count(),
                "participants": participants_data,
                "winners": winners_data,
            },
            status=status.HTTP_200_OK,
        )


# ============================================================================
# ENDPOINT: GET /api/participants/participations/roulette/<id>/winners/
# Descripción: Listar solo los ganadores de una ruleta
# ============================================================================

@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def get_roulette_winners(request, roulette_id: int):
    """
    Devuelve solo los ganadores de una ruleta específica,
    con toda la información completa del participante.
    
    Parámetros:
    - roulette_id (path): ID de la ruleta
    
    Respuesta:
    - winners_count: int - Cantidad de ganadores
    - winners: array - Lista de ganadores con datos completos
    """
    
    roulette = get_object_or_404(Roulette, id=roulette_id)

    winners = (
        Participation.objects.filter(roulette=roulette, is_winner=True)
        .select_related("user", "user__profile", "won_prize")
        .order_by("participant_number")
    )

    serializer = ParticipantFullSerializer(
        winners, 
        many=True, 
        context={"request": request}
    )

    return Response(
        {
            "success": True,
            "roulette_id": roulette.id,
            "roulette_name": getattr(roulette, "name", f"Roulette #{roulette.id}"),
            "winners_count": winners.count(),
            "winners": serializer.data,
        },
        status=status.HTTP_200_OK,
    )