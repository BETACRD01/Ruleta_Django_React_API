from django.shortcuts import get_object_or_404
from django.db import transaction
from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from authentication.permissions import IsAdminRole  # tu permiso de admin
from .models import Roulette, DrawHistory, RoulettePrize
from .serializers import (
    RouletteListSerializer,
    RouletteDetailSerializer,
    RouletteCreateUpdateSerializer,
    DrawExecuteSerializer,
    DrawHistorySerializer,
    RoulettePrizeSerializer,
)
from .utils import execute_roulette_draw


# --------- RUOULETTES ----------
class RouletteListView(generics.ListAPIView):
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
    serializer_class = RouletteCreateUpdateSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]

    def perform_create(self, serializer):
        instance = serializer.save(created_by=self.request.user)
        # crear settings por defecto
        instance.settings = instance.settings if hasattr(instance, 'settings') else None


class RouletteDetailView(generics.RetrieveAPIView):
    queryset = Roulette.objects.select_related('created_by', 'settings', 'winner__user').prefetch_related('participations__user')
    serializer_class = RouletteDetailSerializer
    permission_classes = [permissions.IsAuthenticated]


class RouletteUpdateView(generics.UpdateAPIView):
    queryset = Roulette.objects.all()
    serializer_class = RouletteCreateUpdateSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]


class DrawExecuteView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]

    def post(self, request):
        serializer = DrawExecuteSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        roulette = serializer.validated_data['validated_roulette']

        with transaction.atomic():
            result = execute_roulette_draw(roulette, request.user, draw_type='manual')
            if not result['success']:
                return Response({'success': False, 'message': result['message']}, status=status.HTTP_400_BAD_REQUEST)

            return Response({
                'success': True,
                'message': 'Sorteo ejecutado exitosamente',
                'winner': {
                    'name': result['winner'].user.get_full_name() or result['winner'].user.username,
                    'email': result['winner'].user.email
                }
            }, status=status.HTTP_200_OK)


class DrawHistoryView(generics.ListAPIView):
    serializer_class = DrawHistorySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        roulette_id = self.request.query_params.get('roulette_id')
        qs = DrawHistory.objects.select_related('roulette', 'drawn_by', 'winner_selected__user')
        if roulette_id:
            qs = qs.filter(roulette_id=roulette_id)
        return qs.order_by('-drawn_at')


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def roulette_stats(request, roulette_id):
    roulette = get_object_or_404(Roulette, id=roulette_id)
    data = {
        'roulette_info': {
            'name': roulette.name,
            'status': roulette.status,
            'is_drawn': roulette.is_drawn,
            'created_at': roulette.created_at,
            'scheduled_date': roulette.scheduled_date,
            'drawn_at': roulette.drawn_at,
            'winner_name': roulette.winner.user.get_full_name() if roulette.winner else None,
        },
        'participants': {
            'count': roulette.get_participants_count(),
        }
    }
    return Response(data, status=status.HTTP_200_OK)


# --------- PRIZES ----------
class RoulettePrizeListCreateView(generics.ListCreateAPIView):
    serializer_class = RoulettePrizeSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return RoulettePrize.objects.filter(roulette_id=self.kwargs['roulette_id']).order_by('-created_at')

    def perform_create(self, serializer):
        roulette = get_object_or_404(Roulette, id=self.kwargs['roulette_id'])
        if not (self.request.user.is_staff or self.request.user.is_superuser or getattr(self.request.user, 'user_type', '') == 'admin'):
            raise PermissionError('Solo administradores pueden crear premios.')
        serializer.save(roulette=roulette)


class RoulettePrizeRetrieveView(generics.RetrieveAPIView):
    serializer_class = RoulettePrizeSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return RoulettePrize.objects.filter(roulette_id=self.kwargs['roulette_id'])


class RoulettePrizeUpdateView(generics.UpdateAPIView):
    serializer_class = RoulettePrizeSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]

    def get_queryset(self):
        return RoulettePrize.objects.filter(roulette_id=self.kwargs['roulette_id'])


class RoulettePrizeDestroyView(generics.DestroyAPIView):
    serializer_class = RoulettePrizeSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]

    def get_queryset(self):
        return RoulettePrize.objects.filter(roulette_id=self.kwargs['roulette_id'])
