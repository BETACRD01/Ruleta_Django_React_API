# backend/notifications/views.py

from datetime import timedelta

from django.db.models import Q, Count
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response

from .models import Notification, RealTimeMessage
from .serializers import (
    NotificationSerializer,
    NotificationUpdateSerializer,
    PublicNotificationSerializer,
    RealTimeMessageSerializer,
    NotificationStatsSerializer,
    BulkNotificationMarkReadSerializer,
)
from .services import NotificationService, RealTimeService

import logging
logger = logging.getLogger(__name__)


class NotificationPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


class UserNotificationListView(generics.ListAPIView):
    """
    GET /api/notifications/user/
    Lista notificaciones del usuario autenticado + las públicas.
    Parámetros opcionales:
      - unread_only=true (solo no leídas)
      - roulette_id=<id> (filtrar por ruleta)
      - include_stats=true (adjunta stats {total_count, unread_count})
    """
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = NotificationPagination

    def get_queryset(self):
        user = self.request.user
        unread_only = self.request.query_params.get('unread_only', 'false').lower() == 'true'
        roulette_id = self.request.query_params.get('roulette_id')

        qs = Notification.objects.filter(Q(user=user) | Q(is_public=True))

        if unread_only:
            qs = qs.filter(is_read=False)

        if roulette_id:
            try:
                qs = qs.filter(roulette_id=int(roulette_id))
            except ValueError:
                pass

        return qs.order_by('-created_at')

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)

        if request.query_params.get('include_stats', 'false').lower() == 'true':
            user = request.user
            stats = {
                'total_count': Notification.objects.filter(Q(user=user) | Q(is_public=True)).count(),
                'unread_count': Notification.objects.filter(Q(user=user) | Q(is_public=True), is_read=False).count(),
            }
            # La paginación de DRF devuelve dict; es seguro extenderlo
            response.data['stats'] = stats

        return response


class PublicNotificationListView(generics.ListAPIView):
    """
    GET /api/notifications/public/
    Lista solo notificaciones públicas.
    """
    serializer_class = PublicNotificationSerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = NotificationPagination

    def get_queryset(self):
        return Notification.objects.filter(is_public=True).order_by('-created_at')


class NotificationDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET/PATCH/DELETE /api/notifications/{id}/
    - PATCH usa NotificationUpdateSerializer
    - DELETE solo permite borrar notificaciones privadas del propio usuario.
    """
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        return Notification.objects.filter(Q(user=user) | Q(is_public=True))

    def get_serializer_class(self):
        if self.request.method == 'PATCH':
            return NotificationUpdateSerializer
        return NotificationSerializer

    def perform_update(self, serializer):
        notification = serializer.save()
        if serializer.validated_data.get('is_read') and notification.user:
            logger.info(f"Notificación {notification.id} marcada como leída por {notification.user.username}")

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        # No permitir borrar públicas ni notificaciones de otros
        if instance.is_public or instance.user_id != request.user.id:
            return Response({'error': 'No puedes eliminar esta notificación.'},
                            status=status.HTTP_403_FORBIDDEN)
        self.perform_destroy(instance)
        return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def mark_notifications_read(request):
    """
    POST /api/notifications/mark-read/
    Body: {"notification_ids": [1,2,3]}
    """
    serializer = BulkNotificationMarkReadSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    count = NotificationService.mark_notifications_as_read(
        user=request.user,
        notification_ids=serializer.validated_data['notification_ids'],
    )
    return Response({'success': True, 'updated_count': count}, status=status.HTTP_200_OK)


@api_view(['DELETE'])
@permission_classes([permissions.IsAuthenticated])
def delete_read_notifications(request):
    """
    DELETE /api/notifications/delete-read/
    Borra todas las notificaciones LEÍDAS del usuario autenticado.
    """
    deleted, _ = Notification.objects.filter(user=request.user, is_read=True).delete()
    return Response({'success': True, 'deleted': deleted}, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def notification_stats(request):
    """
    GET /api/notifications/stats/
    Estadísticas del usuario autenticado.
    """
    user = request.user
    user_notifications = Notification.objects.filter(Q(user=user) | Q(is_public=True))

    total = user_notifications.count()
    unread = user_notifications.filter(is_read=False).count()
    recent = user_notifications.filter(created_at__gte=timezone.now() - timedelta(days=7)).count()

    notifications_by_type = dict(
        user_notifications.values('notification_type').annotate(count=Count('id')).values_list('notification_type', 'count')
    )

    last = user_notifications.first()
    last_dt = last.created_at if last else None

    data = {
        'total_notifications': total,
        'unread_notifications': unread,
        'recent_notifications': recent,
        'notifications_by_type': notifications_by_type,
        'last_notification_date': last_dt,
    }
    return Response(NotificationStatsSerializer(data).data)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def roulette_notifications(request, roulette_id):
    """
    GET /api/notifications/roulette/{roulette_id}/
    """
    try:
        roulette_id = int(roulette_id)
    except ValueError:
        return Response({'error': 'ID de ruleta inválido'}, status=status.HTTP_400_BAD_REQUEST)

    notifications = NotificationService.get_roulette_notifications(roulette_id)

    # Filtrar por permisos
    user = request.user
    accessible = [n for n in notifications if (n.is_public or n.user_id == user.id)]

    serializer = NotificationSerializer(accessible, many=True)
    return Response({
        'roulette_id': roulette_id,
        'notifications': serializer.data,
        'total_count': len(accessible),
    })


class RealTimeMessageListView(generics.ListAPIView):
    """
    GET /api/notifications/realtime/
    """
    serializer_class = RealTimeMessageSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = NotificationPagination

    def get_queryset(self):
        channel_name = self.request.query_params.get('channel')
        roulette_id = self.request.query_params.get('roulette_id')

        qs = RealTimeMessage.objects.all()
        if channel_name:
            qs = qs.filter(channel_name=channel_name)
        if roulette_id:
            try:
                qs = qs.filter(roulette_id=int(roulette_id))
            except ValueError:
                pass
        return qs.order_by('-sent_at')


@api_view(['DELETE'])
@permission_classes([permissions.IsAuthenticated])
def delete_old_notifications(request):
    """
    DELETE /api/notifications/cleanup/
    Admin: limpia notificaciones leídas antiguas y mensajes realtime.
    """
    if not request.user.is_staff:
        return Response({'error': 'Permisos insuficientes'}, status=status.HTTP_403_FORBIDDEN)

    days = int(request.query_params.get('days', 30))
    cutoff = timezone.now() - timedelta(days=days)

    deleted_notifications = Notification.objects.filter(is_read=True, created_at__lt=cutoff).delete()[0]
    deleted_rt = RealTimeService.cleanup_old_messages(days=7)

    return Response({
        'success': True,
        'deleted_notifications': deleted_notifications,
        'deleted_realtime_messages': deleted_rt,
        'cutoff_date': cutoff,
    })


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def create_notification_webhook(request):
    """
    POST /api/notifications/webhook/
    Admin: crea notificaciones por integración.
    """
    if not request.user.is_staff:
        return Response({'error': 'Permisos insuficientes'}, status=status.HTTP_403_FORBIDDEN)

    required = ['notification_type', 'title', 'message']
    missing = [f for f in required if f not in request.data]
    if missing:
        return Response({'error': f'Campos requeridos faltantes: {", ".join(missing)}'},
                        status=status.HTTP_400_BAD_REQUEST)

    # Simplificado: delega en el servicio según sea pública o privada
    try:
        if request.data.get('is_public'):
            Notification.objects.create(
                notification_type=request.data['notification_type'],
                title=request.data['title'],
                message=request.data['message'],
                is_public=True,
                roulette_id=request.data.get('roulette_id'),
                extra_data=request.data.get('extra_data', {}),
            )
        else:
            user_id = request.data.get('user_id')
            if not user_id:
                return Response({'error': 'user_id es requerido para notificaciones privadas'},
                                status=status.HTTP_400_BAD_REQUEST)
            NotificationService.create_for_user(
                user_id=user_id,
                notification_type=request.data['notification_type'],
                title=request.data['title'],
                message=request.data['message'],
                roulette_id=request.data.get('roulette_id'),
                extra_data=request.data.get('extra_data', {}),
            )
        return Response({'success': True}, status=status.HTTP_201_CREATED)
    except Exception as exc:
        logger.exception('Error creando notificación por webhook')
        return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
