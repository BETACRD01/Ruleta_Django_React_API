# backend/roulettes/views.py
from __future__ import annotations
import logging
from typing import Optional

from django.shortcuts import get_object_or_404
from django.db import transaction
from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes

from authentication.permissions import IsAdminRole  # permiso admin
from .models import (
    Roulette,
    DrawHistory,
    RoulettePrize,
    RouletteSettings,
)
from .serializers import (
    RouletteListSerializer,
    RouletteDetailSerializer,
    RouletteCreateUpdateSerializer,
    DrawExecuteSerializer,
    DrawHistorySerializer,
    RoulettePrizeSerializer,
)
from .utils import execute_roulette_draw, get_roulette_statistics

logger = logging.getLogger(__name__)


# =========================
# Helpers
# =========================

def _compute_target_angle(participants_queryset, winner_id: int, spins: int = 5) -> float:
    """
    Ángulo absoluto (0° = puntero arriba, sentido horario) para caer
    en el centro del sector del ganador. Se basa en el orden visual:
    participant_number asc.
    """
    participants = list(participants_queryset)
    n = len(participants)
    if n <= 0:
        return 0.0

    try:
        idx = next(i for i, p in enumerate(participants) if p.id == winner_id)
    except StopIteration:
        idx = 0

    sector = 360.0 / n
    center = idx * sector + (sector / 2.0)
    return float(spins * 360.0 + center)


def _pick_available_prize(roulette: Roulette) -> Optional[RoulettePrize]:
    """
    Siguiente premio disponible:
      - is_active=True
      - (si existe) stock > 0
      - ordenado por display_order asc, id asc
    """
    qs = RoulettePrize.objects.filter(roulette=roulette, is_active=True).order_by("display_order", "id")
    if hasattr(RoulettePrize, "stock"):
        qs = qs.filter(stock__gt=0)
    return qs.first()


# =========================
# ROULETTES
# =========================

class RouletteListView(generics.ListAPIView):
    """
    GET /roulettes/
    """
    queryset = Roulette.objects.all().select_related('created_by', 'settings', 'winner__user')
    serializer_class = RouletteListSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        else:
            qs = qs.exclude(status='cancelled')
        return qs.order_by('-created_at')


class RouletteCreateView(generics.CreateAPIView):
    """
    POST /roulettes/create/
    """
    serializer_class = RouletteCreateUpdateSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]

    def perform_create(self, serializer):
        """Crear ruleta con usuario actual y asegurar settings por si el signal no corrió aún."""
        instance = serializer.save(created_by=self.request.user)
        if not hasattr(instance, 'settings') or not instance.settings:
            RouletteSettings.objects.create(
                roulette=instance,
                max_participants=0,
                allow_multiple_entries=False,
                auto_draw_when_full=False,
                show_countdown=True,
                notify_on_participation=True,
                notify_on_draw=True
            )
        logger.info(f"Ruleta creada: {instance.name} (ID: {instance.id}) por {self.request.user.username}")


class RouletteDetailView(generics.RetrieveAPIView):
    """
    GET /roulettes/<pk>/
    """
    queryset = Roulette.objects.select_related('created_by', 'settings', 'winner__user').prefetch_related('participations__user')
    serializer_class = RouletteDetailSerializer
    permission_classes = [permissions.IsAuthenticated]


class RouletteUpdateView(generics.UpdateAPIView):
    """
    PUT/PATCH /roulettes/<pk>/update/
    """
    queryset = Roulette.objects.all()
    serializer_class = RouletteCreateUpdateSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]

    def perform_update(self, serializer):
        instance = serializer.save()
        logger.info(f"Ruleta actualizada: {instance.name} (ID: {instance.id}) por {self.request.user.username}")


class RouletteDestroyView(generics.DestroyAPIView):
    """
    DELETE /roulettes/<pk>/delete/?force=1
    - Normal: no elimina sorteadas ni con participantes
    - Force: limpia relacionados y elimina
    """
    queryset = Roulette.objects.all()
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]

    def destroy(self, request, *args, **kwargs):
        roulette = self.get_object()
        force = request.query_params.get('force') in ('1', 'true', 'True')

        if not force:
            if roulette.is_drawn or roulette.status == 'completed':
                return Response(
                    {'success': False, 'message': 'No se puede eliminar una ruleta ya sorteada.'},
                    status=status.HTTP_409_CONFLICT
                )
            if roulette.get_participants_count() > 0:
                return Response(
                    {'success': False, 'message': 'No se puede eliminar una ruleta con participantes.'},
                    status=status.HTTP_409_CONFLICT
                )

        with transaction.atomic():
            name = roulette.name
            # limpiar premios e historial; winner a null para evitar FK colgando
            DrawHistory.objects.filter(roulette=roulette).delete()
            RoulettePrize.objects.filter(roulette=roulette).delete()
            if roulette.winner_id:
                roulette.winner = None
                roulette.save(update_fields=['winner'])
            roulette.delete()
        return Response({'success': True, 'message': f'Ruleta "{name}" eliminada.'}, status=status.HTTP_200_OK)


# =========================
# SORTEO (ACTUALIZADO)
# =========================

class DrawExecuteView(APIView):
    """
    POST /roulettes/draw/execute/
    Body: { "roulette_id": <int> }
    Respuesta: {
      success, message,
      winner: { id, name, email, participant_number },
      prize: { ... } | null,
      angle: <float>,
      total_spins: <int>
    }
    """
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]

    @transaction.atomic
    def post(self, request):
        # Validación con serializer si existe; fallback defensivo si no
        roulette = None
        try:
            ser = DrawExecuteSerializer(data=request.data, context={'request': request})
            ser.is_valid(raise_exception=True)
            roulette = ser.validated_data['validated_roulette']
        except Exception:
            rid = request.data.get("roulette_id")
            if not rid:
                return Response({"success": False, "message": "roulette_id es requerido"}, status=status.HTTP_400_BAD_REQUEST)
            roulette = get_object_or_404(
                Roulette.objects.select_related("settings").prefetch_related("participations__user"),
                pk=rid
            )

        # Ejecutar sorteo central (usa tu lógica actual)
        result = execute_roulette_draw(roulette, request.user, draw_type='manual')
        if not result.get('success'):
            logger.warning(f"Fallo sorteo {roulette.name}: {result.get('message')}")
            return Response({'success': False, 'message': result.get('message')}, status=status.HTTP_400_BAD_REQUEST)

        winner = result['winner']            # Participation
        winner_data = result['winner_data']  # {id, name, email, participant_number}

        # Ángulo determinístico hacia el ganador (orden visual por participant_number)
        participants_qs = roulette.participations.select_related('user').order_by('participant_number')
        total_spins = 5
        angle = _compute_target_angle(participants_qs, winner.id, spins=total_spins)

        # Premio disponible (opcional)
        prize_obj = _pick_available_prize(roulette)
        prize_payload = None
        if prize_obj is not None:
            fields_to_update = []
            if hasattr(prize_obj, "stock") and isinstance(prize_obj.stock, int) and prize_obj.stock > 0:
                prize_obj.stock -= 1
                fields_to_update.append("stock")
            # Solo setear flags si existen en tu modelo
            if hasattr(prize_obj, "is_awarded"):
                try:
                    prize_obj.is_awarded = True
                    fields_to_update.append("is_awarded")
                except Exception:
                    pass
            if hasattr(prize_obj, "awarded_to"):
                try:
                    prize_obj.awarded_to = winner
                    fields_to_update.append("awarded_to")
                except Exception:
                    pass

            if fields_to_update:
                prize_obj.save(update_fields=fields_to_update)
            else:
                prize_obj.save()

            prize_payload = RoulettePrizeSerializer(prize_obj, context={'request': request}).data

        return Response({
            'success': True,
            'message': 'Sorteo ejecutado exitosamente',
            'winner': {
                'id': winner_data.get('id'),
                'name': winner_data.get('name'),
                'email': winner_data.get('email'),
                'participant_number': winner_data.get('participant_number'),
            },
            'prize': prize_payload,
            'angle': angle,
            'total_spins': total_spins,
        }, status=status.HTTP_200_OK)


# =========================
# HISTORIAL
# =========================

class DrawHistoryView(generics.ListAPIView):
    """
    GET /roulettes/draw/history/?roulette_id=<id>
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = DrawHistorySerializer

    def get_queryset(self):
        rid = self.request.query_params.get("roulette_id")
        qs = DrawHistory.objects.select_related('roulette', 'winner_selected__user', 'drawn_by').all()
        if rid:
            qs = qs.filter(roulette_id=rid)
        return qs.order_by('-drawn_at')


# =========================
# ESTADÍSTICAS
# =========================

@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def roulette_stats(request, roulette_id: int):
    """
    GET /roulettes/<roulette_id>/stats/
    """
    roulette = get_object_or_404(Roulette, id=roulette_id)
    stats = get_roulette_statistics(roulette)
    return Response({"success": True, "stats": stats}, status=status.HTTP_200_OK)


# =========================
# PREMIOS (CRUD)
# =========================

class RoulettePrizeListCreateView(generics.ListCreateAPIView):
    """
    GET  /roulettes/<roulette_id>/prizes/
    POST /roulettes/<roulette_id>/prizes/
    """
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]
    serializer_class = RoulettePrizeSerializer

    def get_queryset(self):
        roulette_id = self.kwargs['roulette_id']
        return RoulettePrize.objects.filter(roulette_id=roulette_id).order_by('display_order', 'id')

    def perform_create(self, serializer):
        roulette_id = self.kwargs['roulette_id']
        roulette = get_object_or_404(Roulette, id=roulette_id)
        serializer.save(roulette=roulette)


class RoulettePrizeRetrieveView(generics.RetrieveAPIView):
    """
    GET /roulettes/<roulette_id>/prizes/<pk>/
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = RoulettePrizeSerializer

    def get_queryset(self):
        roulette_id = self.kwargs['roulette_id']
        return RoulettePrize.objects.filter(roulette_id=roulette_id)


class RoulettePrizeUpdateView(generics.UpdateAPIView):
    """
    PUT/PATCH /roulettes/<roulette_id>/prizes/<pk>/update/
    """
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]
    serializer_class = RoulettePrizeSerializer

    def get_queryset(self):
        roulette_id = self.kwargs['roulette_id']
        return RoulettePrize.objects.filter(roulette_id=roulette_id)


class RoulettePrizeDestroyView(generics.DestroyAPIView):
    """
    DELETE /roulettes/<roulette_id>/prizes/<pk>/delete/
    """
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]

    def get_queryset(self):
        roulette_id = self.kwargs['roulette_id']
        return RoulettePrize.objects.filter(roulette_id=roulette_id)
