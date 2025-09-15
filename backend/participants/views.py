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
    ParticipationListSerializer,
    ParticipantBasicSerializer,
)
from roulettes.models import Roulette


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
@transaction.atomic
def participate(request):
    """
    POST /participants/participations/participate/
    Espera: roulette_id (int), receipt (file opcional)
    """
    roulette_id = request.data.get("roulette_id")
    if not roulette_id:
        return Response(
            {"success": False, "message": "ID de ruleta es requerido"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    roulette = get_object_or_404(Roulette, id=roulette_id)

    # Adaptamos datos al ParticipationSerializer, que espera 'roulette' (PK)
    data = request.data.copy()
    data["roulette"] = roulette.id

    serializer = ParticipationSerializer(data=data, context={"request": request})
    serializer.is_valid(raise_exception=True)
    participation = serializer.save()  # asigna user autenticado en create()

    # La notificación de confirmación puede ser creada por señales (si las tienes activas).
    return Response(
        {
            "success": True,
            "message": f'Te has registrado exitosamente en la ruleta "{getattr(roulette, "name", roulette.id)}"',
            "participation": ParticipationSerializer(participation, context={"request": request}).data,
        },
        status=status.HTTP_201_CREATED,
    )


class MyParticipationsView(generics.ListAPIView):
    """
    GET /participants/participations/my-participations/
    Lista las participaciones del usuario autenticado (más recientes primero).
    """
    serializer_class = ParticipationListSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return (
            Participation.objects.filter(user=self.request.user)
            .select_related("roulette")
            .order_by("-created_at")
        )

    def list(self, request, *args, **kwargs):
        qs = self.get_queryset()
        serializer = self.get_serializer(qs, many=True)
        return Response(
            {"success": True, "total": qs.count(), "participations": serializer.data},
            status=status.HTTP_200_OK,
        )


class RouletteParticipantsView(generics.ListAPIView):
    """
    GET /participants/participations/roulette/<id>/
    Devuelve participantes de una ruleta (ordenados por número).
    """
    serializer_class = ParticipantBasicSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        rid = self.kwargs["roulette_id"]
        self.roulette = get_object_or_404(Roulette, id=rid)
        return (
            Participation.objects.filter(roulette=self.roulette)
            .select_related("user")
            .order_by("participant_number")
        )

    def list(self, request, *args, **kwargs):
        qs = self.get_queryset()
        serializer = self.get_serializer(qs, many=True)
        return Response(
            {
                "success": True,
                "roulette_id": self.roulette.id,
                "roulette_name": getattr(self.roulette, "name", f"Roulette #{self.roulette.id}"),
                "total_participants": qs.count(),
                "participants": serializer.data,
            },
            status=status.HTTP_200_OK,
        )


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def check_participation(request, roulette_id: int):
    """
    GET /participants/participations/check-participation/<id>/
    Verifica si el usuario ya participó en una ruleta.
    Devuelve ambas claves por compatibilidad: 'is_participating' y 'has_participated'.
    """
    roulette = get_object_or_404(Roulette, id=roulette_id)
    participation = Participation.objects.filter(user=request.user, roulette=roulette).first()
    is_participating = participation is not None
    return Response(
        {
            "success": True,
            "is_participating": is_participating,  # usado por algunos clientes
            "has_participated": is_participating,  # alias de compatibilidad
            "participation": ParticipationListSerializer(participation).data if participation else None,
        },
        status=status.HTTP_200_OK,
    )
