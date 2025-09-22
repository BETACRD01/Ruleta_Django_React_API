# backend/notifications/views.py

from datetime import timedelta

from django.db.models import Q, Count
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response

from .models import (
    Notification, 
    RealTimeMessage, 
    AdminNotificationPreference,
    NotificationTemplate
)
from .serializers import (
    NotificationSerializer,
    NotificationUpdateSerializer,
    NotificationCreateSerializer,
    PublicNotificationSerializer,
    AdminNotificationSerializer,
    RealTimeMessageSerializer,
    NotificationStatsSerializer,
    BulkNotificationMarkReadSerializer,
    AdminNotificationPreferenceSerializer,
    NotificationTemplateSerializer,
    WinnerAnnouncementSerializer,
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
      - priority=urgent|high|normal|low (filtrar por prioridad)
    """
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = NotificationPagination

    def get_queryset(self):
        user = self.request.user
        unread_only = self.request.query_params.get('unread_only', 'false').lower() == 'true'
        roulette_id = self.request.query_params.get('roulette_id')
        priority = self.request.query_params.get('priority')

        # 🔒 Filtro base: privadas del usuario + públicas
        #     Si es staff, solo incluir admin-only ASIGNADAS A ÉL MISMO.
        q_filter = Q(user=user) | Q(is_public=True)
        if user.is_staff:
            q_filter |= Q(is_admin_only=True, user=user)

        qs = Notification.objects.filter(q_filter)

        if unread_only:
            qs = qs.filter(is_read=False)

        if roulette_id:
            try:
                qs = qs.filter(roulette_id=int(roulette_id))
            except ValueError:
                pass

        if priority:
            qs = qs.filter(priority=priority)

        return qs.order_by('-priority', '-created_at')

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)

        if request.query_params.get('include_stats', 'false').lower() == 'true':
            user = request.user
            q_filter = Q(user=user) | Q(is_public=True)
            if user.is_staff:
                q_filter |= Q(is_admin_only=True, user=user)
            
            stats = {
                'total_count': Notification.objects.filter(q_filter).count(),
                'unread_count': Notification.objects.filter(q_filter, is_read=False).count(),
                'urgent_count': Notification.objects.filter(q_filter, priority='urgent', is_read=False).count(),
                'high_priority_count': Notification.objects.filter(q_filter, priority='high', is_read=False).count(),
            }
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
        priority = self.request.query_params.get('priority')
        roulette_id = self.request.query_params.get('roulette_id')
        
        qs = Notification.objects.filter(is_public=True)
        
        if priority:
            qs = qs.filter(priority=priority)
        if roulette_id:
            try:
                qs = qs.filter(roulette_id=int(roulette_id))
            except ValueError:
                pass
        
        return qs.order_by('-priority', '-created_at')


class AdminNotificationListView(generics.ListAPIView):
    """
    GET /api/notifications/admin/
    Lista notificaciones específicas de administrador (del propio staff autenticado)
    """
    serializer_class = AdminNotificationSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = NotificationPagination

    def get_queryset(self):
        user = self.request.user
        if not user.is_staff:
            return Notification.objects.none()
        
        unread_only = self.request.query_params.get('unread_only', 'false').lower() == 'true'
        priority = self.request.query_params.get('priority')
        
        qs = Notification.objects.filter(user=user, is_admin_only=True)
        
        if unread_only:
            qs = qs.filter(is_read=False)
        if priority:
            qs = qs.filter(priority=priority)
            
        return qs.order_by('-priority', '-created_at')


class NotificationDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET/PATCH/DELETE /api/notifications/{id}/
    - PATCH usa NotificationUpdateSerializer
    - DELETE: 🔒 solo permite borrar notificaciones privadas del propio usuario.
             (Ni públicas ni ajenas, aunque seas staff)
    """
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        q_filter = Q(user=user) | Q(is_public=True)
        if user.is_staff:
            q_filter |= Q(is_admin_only=True, user=user)
        return Notification.objects.filter(q_filter)

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
        # 🔒 No permitir borrar públicas NI notificaciones ajenas
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


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def mark_all_notifications_read(request):
    """
    POST /api/notifications/mark-all-read/
    Marca todas las notificaciones no leídas del usuario como leídas
    """
    user = request.user
    q_filter = Q(user=user) | Q(is_public=True)
    if user.is_staff:
        q_filter |= Q(is_admin_only=True, user=user)
    
    count = Notification.objects.filter(q_filter, is_read=False).update(is_read=True)
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
    q_filter = Q(user=user) | Q(is_public=True)
    if user.is_staff:
        q_filter |= Q(is_admin_only=True, user=user)
    
    user_notifications = Notification.objects.filter(q_filter)

    total = user_notifications.count()
    unread = user_notifications.filter(is_read=False).count()
    recent = user_notifications.filter(created_at__gte=timezone.now() - timedelta(days=7)).count()

    notifications_by_type = dict(
        user_notifications.values('notification_type').annotate(count=Count('id')).values_list('notification_type', 'count')
    )
    
    unread_by_priority = dict(
        user_notifications.filter(is_read=False).values('priority').annotate(count=Count('id')).values_list('priority', 'count')
    )

    last = user_notifications.first()
    last_dt = last.created_at if last else None

    data = {
        'total_notifications': total,
        'unread_notifications': unread,
        'recent_notifications': recent,
        'notifications_by_type': notifications_by_type,
        'unread_by_priority': unread_by_priority,
        'last_notification_date': last_dt,
    }
    
    # Agregar estadísticas específicas de admin (solo las suyas)
    if user.is_staff:
        admin_notifications = user_notifications.filter(is_admin_only=True, user=user)
        data['admin_notifications_count'] = admin_notifications.count()
        data['unread_admin_notifications'] = admin_notifications.filter(is_read=False).count()
    
    return Response(data)


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
    accessible = []
    for n in notifications:
        if n.is_public:
            accessible.append(n)
        elif n.user_id == user.id:
            accessible.append(n)
        elif n.is_admin_only and user.is_staff and n.user_id == user.id:
            # admin-only solo del propio admin
            accessible.append(n)

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

    serializer = NotificationCreateSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    try:
        notification = serializer.save()
        return Response(NotificationSerializer(notification).data, status=status.HTTP_201_CREATED)
    except Exception as exc:
        logger.exception('Error creando notificación por webhook')
        return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def create_winner_announcement(request):
    """
    POST /api/notifications/winner-announcement/
    Admin: crear anuncio completo de ganador (público + personal + admin)
    """
    if not request.user.is_staff:
        return Response({'error': 'Permisos insuficientes'}, status=status.HTTP_403_FORBIDDEN)

    serializer = WinnerAnnouncementSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    try:
        from django.contrib.auth import get_user_model
        User = get_user_model()
        
        winner_user = User.objects.get(pk=serializer.validated_data['winner_user_id'])
        
        public_notif, personal_notif, admin_notifs = NotificationService.create_winner_announcement(
            winner_user=winner_user,
            roulette_name=serializer.validated_data['roulette_name'],
            roulette_id=serializer.validated_data['roulette_id'],
            total_participants=serializer.validated_data['total_participants'],
            prize_details=serializer.validated_data.get('prize_details', ''),
        )
        
        return Response({
            'success': True,
            'public_notification': NotificationSerializer(public_notif).data,
            'personal_notification': NotificationSerializer(personal_notif).data,
            'admin_notifications_count': len(admin_notifs),
        }, status=status.HTTP_201_CREATED)
        
    except Exception as exc:
        logger.exception('Error creando anuncio de ganador')
        return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)


# CRUD para preferencias de administrador
class AdminNotificationPreferenceView(generics.RetrieveUpdateAPIView):
    """
    GET/PATCH /api/notifications/admin-preferences/
    Gestionar preferencias de notificaciones de admin
    """
    serializer_class = AdminNotificationPreferenceSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        if not self.request.user.is_staff:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Solo administradores pueden acceder")
        
        obj, created = AdminNotificationPreference.objects.get_or_create(
            user=self.request.user
        )
        return obj


# CRUD para plantillas de notificaciones
class NotificationTemplateListCreateView(generics.ListCreateAPIView):
    """
    GET/POST /api/notifications/templates/
    """
    serializer_class = NotificationTemplateSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        if not self.request.user.is_staff:
            return NotificationTemplate.objects.none()
        return NotificationTemplate.objects.filter(is_active=True)


class NotificationTemplateDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET/PATCH/DELETE /api/notifications/templates/{id}/
    """
    serializer_class = NotificationTemplateSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        if not self.request.user.is_staff:
            return NotificationTemplate.objects.none()
        return NotificationTemplate.objects.all()


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def notification_summary_dashboard(request):
    """
    GET /api/notifications/dashboard/
    Resumen completo para dashboard de administrador
    """
    if not request.user.is_staff:
        return Response({'error': 'Permisos insuficientes'}, status=status.HTTP_403_FORBIDDEN)

    # Estadísticas generales del sistema
    total_notifications = Notification.objects.count()
    unread_notifications = Notification.objects.filter(is_read=False).count()
    recent_winners = Notification.objects.filter(
        notification_type='roulette_winner',
        created_at__gte=timezone.now() - timedelta(days=7)
    ).count()
    
    # Notificaciones por tipo (últimos 30 días)
    notifications_by_type = dict(
        Notification.objects.filter(
            created_at__gte=timezone.now() - timedelta(days=30)
        ).values('notification_type').annotate(
            count=Count('id')
        ).values_list('notification_type', 'count')
    )
    
    # Actividad de notificaciones por día (últimos 7 días)
    daily_activity = []
    for i in range(7):
        day = timezone.now() - timedelta(days=i)
        day_start = day.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        
        day_count = Notification.objects.filter(
            created_at__gte=day_start,
            created_at__lt=day_end
        ).count()
        
        daily_activity.append({
            'date': day_start.strftime('%Y-%m-%d'),
            'count': day_count
        })
    
    # Últimas notificaciones de ganadores
    recent_winner_notifications = Notification.objects.filter(
        notification_type='roulette_winner',
        is_public=True
    ).order_by('-created_at')[:5]
    
    winner_data = []
    for notif in recent_winner_notifications:
        winner_data.append({
            'id': notif.id,
            'winner_name': (notif.extra_data or {}).get('winner_name', ''),
            'roulette_name': (notif.extra_data or {}).get('roulette_name', ''),
            'participants': (notif.extra_data or {}).get('total_participants', 0),
            'created_at': notif.created_at,
        })
    
    return Response({
        'system_stats': {
            'total_notifications': total_notifications,
            'unread_notifications': unread_notifications,
            'recent_winners': recent_winners,
        },
        'notifications_by_type': notifications_by_type,
        'daily_activity': daily_activity,
        'recent_winners': winner_data,
        'generated_at': timezone.now(),
    })
