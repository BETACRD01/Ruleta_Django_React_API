# backend/roulettes/views.py
from __future__ import annotations

import logging
from typing import Optional

from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.parsers import JSONParser, MultiPartParser, FormParser

from authentication.permissions import IsAdminRole
from participants.models import Participation
from .models import (
    Roulette,
    DrawHistory,
    RoulettePrize,
    RouletteSettings,
    RouletteStatus,
)
from .serializers import (
    RouletteListSerializer,
    RouletteDetailSerializer,
    RouletteCreateUpdateSerializer,
    DrawExecuteSerializer,
    DrawHistorySerializer,
    RoulettePrizeSerializer,
    RoulettePrizeCreateUpdateSerializer,
    ParticipationLiteSerializer,
)
from .utils import execute_roulette_draw, get_roulette_statistics

logger = logging.getLogger(__name__)


# =========================
# Helpers
# =========================

def _compute_target_angle(participants_queryset, winner_id: int, spins: int = 5) -> float:
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
    qs = RoulettePrize.objects.filter(roulette=roulette, is_active=True).order_by("display_order", "id")
    if hasattr(RoulettePrize, "stock"):
        qs = qs.filter(stock__gt=0)
    return qs.first()


def _normalize_draw_result_for_json(result: dict, request) -> dict:
    """
    Normaliza el resultado del sorteo para JSON:
    - winner, draw_history a sus serializers.
    - prize serializado COMPLETO (incluye image_url/stock).
    - roulette reducido.
    """
    if not isinstance(result, dict):
        return {"success": False, "message": "Formato de resultado inválido."}

    out = dict(result)

    winner_obj = out.get("winner")
    if isinstance(winner_obj, Participation):
        out["winner"] = ParticipationLiteSerializer(winner_obj, context={"request": request}).data

    hist_obj = out.get("draw_history")
    if isinstance(hist_obj, DrawHistory):
        out["draw_history"] = DrawHistorySerializer(hist_obj, context={"request": request}).data

    roul_obj = out.get("roulette")
    if isinstance(roul_obj, Roulette):
        out["roulette"] = {
            "id": roul_obj.id,
            "name": roul_obj.name,
            "is_drawn": roul_obj.is_drawn,
            "status": roul_obj.status,
        }

    prize_obj = out.get("prize")
    if isinstance(prize_obj, RoulettePrize):
        try:
            prize_obj.refresh_from_db()
        except Exception:
            pass
        try:
            if hasattr(prize_obj, "stock") and prize_obj.stock <= 0 and prize_obj.is_active:
                prize_obj.is_active = False
                prize_obj.save(update_fields=["is_active"])
        except Exception:
            logger.warning("No se pudo forzar is_active=False en premio agotado", exc_info=True)

        out["prize"] = RoulettePrizeSerializer(prize_obj, context={"request": request}).data

    return out


# =========================
# ROULETTES
# =========================

class RouletteListView(generics.ListAPIView):
    queryset = Roulette.objects.all().select_related("created_by", "settings", "winner__user")
    serializer_class = RouletteListSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)
        else:
            qs = qs.exclude(status=RouletteStatus.CANCELLED)
        return qs.order_by("-created_at")


class RouletteCreateView(generics.CreateAPIView):
    serializer_class = RouletteCreateUpdateSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def perform_create(self, serializer):
        instance = serializer.save(created_by=self.request.user)
        if not hasattr(instance, "settings") or not instance.settings:
            RouletteSettings.objects.create(
                roulette=instance,
                max_participants=0,
                allow_multiple_entries=False,
                show_countdown=True,
                notify_on_participation=True,
                notify_on_draw=True,
                winners_target=0,  # auto por stock
            )
        logger.info("Ruleta creada: %s (ID: %s) por %s", instance.name, instance.id, self.request.user.username)


class RouletteDetailView(generics.RetrieveAPIView):
    queryset = Roulette.objects.select_related("created_by", "settings", "winner__user").prefetch_related(
        "participations__user", "prizes"
    )
    serializer_class = RouletteDetailSerializer
    permission_classes = [permissions.IsAuthenticated]


class RouletteUpdateView(generics.UpdateAPIView):
    queryset = Roulette.objects.all()
    serializer_class = RouletteCreateUpdateSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def perform_update(self, serializer):
        instance = serializer.save()
        logger.info("Ruleta actualizada: %s (ID: %s) por %s", instance.name, instance.id, self.request.user.username)


class RouletteDestroyView(generics.DestroyAPIView):
    queryset = Roulette.objects.all()
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]

    def destroy(self, request, *args, **kwargs):
        roulette = self.get_object()
        force = request.query_params.get("force") in ("1", "true", "True")

        if not force:
            if roulette.is_drawn or roulette.status == RouletteStatus.COMPLETED:
                return Response(
                    {"success": False, "message": "No se puede eliminar una ruleta ya sorteada."},
                    status=status.HTTP_409_CONFLICT,
                )
            if roulette.get_participants_count() > 0:
                return Response(
                    {"success": False, "message": "No se puede eliminar una ruleta con participantes."},
                    status=status.HTTP_409_CONFLICT,
                )

        with transaction.atomic():
            name = roulette.name
            DrawHistory.objects.filter(roulette=roulette).delete()
            RoulettePrize.objects.filter(roulette=roulette).delete()
            if roulette.winner_id:
                roulette.winner = None
                roulette.save(update_fields=["winner"])
            roulette.delete()

        return Response({"success": True, "message": f'Ruleta "{name}" eliminada.'}, status=status.HTTP_200_OK)


# =========================
# SORTEO
# =========================

class DrawExecuteView(APIView):
    """
    POST /roulettes/draw/execute/
    Body: { "roulette_id": <int>, "count": <int opcional> }
    """
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]
    parser_classes = [JSONParser]

    def post(self, request, *args, **kwargs):
        ser = DrawExecuteSerializer(data=request.data, context={"request": request})
        ser.is_valid(raise_exception=True)
        roulette = get_object_or_404(Roulette, pk=ser.validated_data["roulette_id"])

        n = int(ser.validated_data.get("count") or 1)

        if n == 1:
            result = execute_roulette_draw(roulette, request.user, draw_type="admin")
            payload = _normalize_draw_result_for_json(result, request)

            roulette.refresh_from_db()
            payload.setdefault("is_drawn", roulette.is_drawn)
            payload.setdefault("success", bool(result.get("success", False)))

            if not payload.get("success"):
                return Response(payload, status=status.HTTP_400_BAD_REQUEST)
            return Response(payload, status=status.HTTP_200_OK)

        try:
            winners = roulette.draw_winners(n, drawn_by_user=request.user)
        except Exception as e:
            logger.exception("Error en draw_winners: %s", e)
            return Response({"success": False, "message": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        data = {
            "success": True,
            "message": f"{len(winners)} ganador(es) seleccionados",
            "winners": [
                {
                    "id": w.id,
                    "user": w.user.get_full_name() or w.user.username,
                    "email": w.user.email,
                    "participant_number": w.participant_number,
                }
                for w in winners
            ],
            "is_drawn": roulette.is_drawn,
        }
        return Response(data, status=status.HTTP_200_OK)


class DrawHistoryView(generics.ListAPIView):
    serializer_class = DrawHistorySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        rid = self.request.query_params.get("roulette_id")
        qs = DrawHistory.objects.select_related("roulette", "winner_selected__user", "drawn_by")
        if rid:
            qs = qs.filter(roulette_id=rid)
        return qs.order_by("-drawn_at")


# =========================
# ESTADÍSTICAS
# =========================

@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def roulette_stats(request, roulette_id: int):
    r = get_object_or_404(Roulette.objects.select_related("settings", "winner__user"), pk=roulette_id)
    stats = get_roulette_statistics(r)
    return Response(stats, status=status.HTTP_200_OK)


# =========================
# PREMIOS (CRUD)
# =========================

class _PrizeBase:
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def _roulette(self):
        rid = self.kwargs.get("roulette_id")
        return get_object_or_404(Roulette, pk=rid)

    def get_queryset(self):
        rid = self.kwargs.get("roulette_id")
        return RoulettePrize.objects.filter(roulette_id=rid).order_by("display_order", "id")

    def get_permissions(self):
        if self.request.method in ("GET", "HEAD", "OPTIONS"):
            return [permissions.IsAuthenticated()]
        return [permissions.IsAuthenticated(), IsAdminRole()]

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["request"] = self.request
        try:
            ctx["roulette"] = self._roulette()
        except Exception:
            ctx["roulette"] = None
        return ctx


class RoulettePrizeListCreateView(_PrizeBase, generics.ListCreateAPIView):
    """
    GET  /api/roulettes/<roulette_id>/prizes/
    POST /api/roulettes/<roulette_id>/prizes/
    """
    def get_serializer_class(self):
        # Lectura
        if self.request.method in ("GET", "HEAD", "OPTIONS"):
            return RoulettePrizeSerializer
        # Escritura (crear)
        return RoulettePrizeCreateUpdateSerializer

    def perform_create(self, serializer):
        roulette = self._roulette()
        position = serializer.validated_data.get("display_order", None)
        if position is None:
            last = (
                RoulettePrize.objects.filter(roulette=roulette)
                .order_by("-display_order")
                .values_list("display_order", flat=True)
                .first()
            )
            serializer.validated_data["display_order"] = (last or 0) + 1
        serializer.save(roulette=roulette)


class RoulettePrizeRetrieveView(_PrizeBase, generics.RetrieveAPIView):
    serializer_class = RoulettePrizeSerializer
    lookup_field = "pk"


class RoulettePrizeUpdateView(_PrizeBase, generics.UpdateAPIView):
    serializer_class = RoulettePrizeCreateUpdateSerializer
    lookup_field = "pk"


class RoulettePrizeDestroyView(_PrizeBase, generics.DestroyAPIView):
    lookup_field = "pk"
