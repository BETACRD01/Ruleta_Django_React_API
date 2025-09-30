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
    ParticipantFullSerializer,
    MyParticipationsSerializer,
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

    data = request.data.copy()
    data["roulette"] = roulette.id

    serializer = ParticipationSerializer(data=data, context={"request": request})
    serializer.is_valid(raise_exception=True)
    participation = serializer.save()

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
    Usa MyParticipationsSerializer con select_related optimizado.
    """
    serializer_class = MyParticipationsSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return (
            Participation.objects.filter(user=self.request.user)
            .select_related(
                "roulette",
                "won_prize",  # ✅ CRÍTICO: Traer datos del premio
            )
            .order_by("-created_at")
        )

    def list(self, request, *args, **kwargs):
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


class RouletteParticipantsView(generics.ListAPIView):
    """
    GET /participants/participations/roulette/<id>/
    Devuelve participantes de una ruleta (ordenados por número).
    """
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        rid = self.kwargs["roulette_id"]
        self.roulette = get_object_or_404(Roulette, id=rid)
        return (
            Participation.objects.filter(roulette=self.roulette)
            .select_related(
                "user",
                "user__profile",
                "won_prize",  # ✅ También aquí por si hay ganadores
            )
            .order_by("participant_number")
        )

    def get_serializer_class(self):
        if self.request.query_params.get("full_data") == "true":
            return ParticipantFullSerializer
        return ParticipantBasicSerializer

    def list(self, request, *args, **kwargs):
        qs = self.get_queryset()
        winners = qs.filter(is_winner=True)
        all_participants = qs

        serializer_class = self.get_serializer_class()

        winners_data = serializer_class(winners, many=True, context={"request": request}).data
        participants_data = serializer_class(all_participants, many=True, context={"request": request}).data

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


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def check_participation(request, roulette_id: int):
    """
    GET /participants/participations/check-participation/<id>/
    Verifica si el usuario ya participó en una ruleta.
    """
    roulette = get_object_or_404(Roulette, id=roulette_id)
    participation = (
        Participation.objects
        .select_related("roulette", "won_prize")  # ✅ También aquí
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
            "participation": participation_data,
        },
        status=status.HTTP_200_OK,
    )


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def get_roulette_winners(request, roulette_id: int):
    """
    GET /participants/participations/roulette/<id>/winners/
    Devuelve solo los ganadores de una ruleta.
    """
    roulette = get_object_or_404(Roulette, id=roulette_id)

    winners = (
        Participation.objects.filter(roulette=roulette, is_winner=True)
        .select_related("user", "user__profile", "won_prize")  # ✅ Y aquí
        .order_by("participant_number")
    )

    serializer = ParticipantFullSerializer(winners, many=True, context={"request": request})

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