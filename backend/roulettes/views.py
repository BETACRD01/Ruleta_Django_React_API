from django.shortcuts import get_object_or_404
from django.db import transaction
from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
import logging

from authentication.permissions import IsAdminRole  # tu permiso de admin
from .models import Roulette, DrawHistory, RoulettePrize, RouletteSettings
from .serializers import (
    RouletteListSerializer,
    RouletteDetailSerializer,
    RouletteCreateUpdateSerializer,
    DrawExecuteSerializer,
    DrawHistorySerializer,
    RoulettePrizeSerializer,
)
from .utils import execute_roulette_draw

logger = logging.getLogger(__name__)


# --------- ROULETTES ----------
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
        """Crear ruleta con usuario actual y configuración automática"""
        try:
            instance = serializer.save(created_by=self.request.user)
            
            # Asegurar que existe configuración (por si el signal falló)
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
                
            logger.info(f"Ruleta creada exitosamente: {instance.name} (ID: {instance.id}) por {self.request.user.username}")
            
        except Exception as e:
            logger.error(f"Error creando ruleta: {str(e)}")
            raise

    def create(self, request, *args, **kwargs):
        """Override para mejor manejo de errores"""
        try:
            response = super().create(request, *args, **kwargs)
            return response
        except Exception as e:
            logger.error(f"Error en RouletteCreateView: {str(e)}")
            return Response({
                'success': False,
                'message': f'Error al crear la ruleta: {str(e)}',
                'details': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)


class RouletteDetailView(generics.RetrieveAPIView):
    queryset = Roulette.objects.select_related('created_by', 'settings', 'winner__user').prefetch_related('participations__user')
    serializer_class = RouletteDetailSerializer
    permission_classes = [permissions.IsAuthenticated]


class RouletteUpdateView(generics.UpdateAPIView):
    queryset = Roulette.objects.all()
    serializer_class = RouletteCreateUpdateSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]

    def perform_update(self, serializer):
        """Actualizar ruleta con logging"""
        try:
            instance = serializer.save()
            logger.info(f"Ruleta actualizada: {instance.name} (ID: {instance.id}) por {self.request.user.username}")
        except Exception as e:
            logger.error(f"Error actualizando ruleta {serializer.instance.id}: {str(e)}")
            raise

    def update(self, request, *args, **kwargs):
        """Override para mejor manejo de errores en actualización"""
        try:
            # Obtener la instancia antes de la actualización
            instance = self.get_object()
            logger.info(f"Iniciando actualización de ruleta: {instance.name} (ID: {instance.id})")
            
            # Llamar al método padre
            response = super().update(request, *args, **kwargs)
            
            logger.info(f"Ruleta {instance.name} actualizada exitosamente")
            return response
            
        except Exception as e:
            logger.error(f"Error en RouletteUpdateView: {str(e)}")
            return Response({
                'success': False,
                'message': f'Error al actualizar la ruleta: {str(e)}',
                'details': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)

    def partial_update(self, request, *args, **kwargs):
        """PATCH method con mejor manejo de errores"""
        try:
            instance = self.get_object()
            logger.info(f"Iniciando actualización parcial de ruleta: {instance.name} (ID: {instance.id})")
            
            response = super().partial_update(request, *args, **kwargs)
            
            logger.info(f"Ruleta {instance.name} actualizada parcialmente")
            return response
            
        except Exception as e:
            logger.error(f"Error en partial_update: {str(e)}")
            return Response({
                'success': False,
                'message': f'Error al actualizar la ruleta: {str(e)}',
                'details': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)


class RouletteDestroyView(generics.DestroyAPIView):
    """
    Vista para eliminar ruletas.
    - Normal: solo NO sorteadas y sin participantes.
    - Con ?force=1 (admin): elimina aunque esté sorteada/completada y limpia relacionados.
    """
    queryset = Roulette.objects.all()
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]

    def destroy(self, request, *args, **kwargs):
        roulette = self.get_object()
        force = request.query_params.get('force') in ('1', 'true', 'True')

        logger.info(f"Intento de eliminación de ruleta: {roulette.name} (ID: {roulette.id}) - Force: {force}")

        # Reglas normales si NO es force
        if not force:
            if roulette.is_drawn or roulette.status == 'completed':
                return Response({
                    'success': False,
                    'message': f'No se puede eliminar la ruleta "{roulette.name}" porque ya fue completada/sorteada.'
                }, status=status.HTTP_409_CONFLICT)

            participants_count = roulette.get_participants_count()
            if participants_count > 0:
                return Response({
                    'success': False,
                    'message': f'No se puede eliminar la ruleta "{roulette.name}" porque tiene {participants_count} participante(s) registrado(s).'
                }, status=status.HTTP_409_CONFLICT)

        try:
            with transaction.atomic():
                roulette_name = roulette.name

                # Limpiar relacionados
                DrawHistory.objects.filter(roulette=roulette).delete()
                RoulettePrize.objects.filter(roulette=roulette).delete()

                # Evitar FK winner colgando
                if roulette.winner_id:
                    roulette.winner = None
                    roulette.save(update_fields=['winner'])

                roulette.delete()
                
                logger.info(f"Ruleta eliminada exitosamente: {roulette_name}")
                
                return Response({
                    'success': True,
                    'message': f'Ruleta "{roulette_name}" eliminada correctamente.'
                }, status=status.HTTP_200_OK)
                
        except Exception as e:
            logger.error(f"Error eliminando ruleta {roulette.name}: {str(e)}")
            return Response({
                'success': False,
                'message': f'Error eliminando ruleta: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class DrawExecuteView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]

    def post(self, request):
        serializer = DrawExecuteSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        roulette = serializer.validated_data['validated_roulette']

        try:
            with transaction.atomic():
                result = execute_roulette_draw(roulette, request.user, draw_type='manual')
                
                if not result['success']:
                    logger.warning(f"Fallo en sorteo de ruleta {roulette.name}: {result['message']}")
                    return Response({
                        'success': False, 
                        'message': result['message']
                    }, status=status.HTTP_400_BAD_REQUEST)

                logger.info(f"Sorteo ejecutado exitosamente en ruleta {roulette.name} por {request.user.username}")
                
                return Response({
                    'success': True,
                    'message': 'Sorteo ejecutado exitosamente',
                    'winner': {
                        'name': result['winner'].user.get_full_name() or result['winner'].user.username,
                        'email': result['winner'].user.email
                    }
                }, status=status.HTTP_200_OK)
                
        except Exception as e:
            logger.error(f"Error ejecutando sorteo en ruleta {roulette.name}: {str(e)}")
            return Response({
                'success': False,
                'message': f'Error ejecutando el sorteo: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


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
            # Puedes usar también IsAdminRole, pero aquí ya validamos manualmente
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