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
    🚫 EXCLUYE notificaciones de ganadores (roulette_winner) para evitar spoilers
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
        # 🚫 EXCLUIR notificaciones de ganadores para usuarios normales
        q_filter = Q(user=user) | (Q(is_public=True) & ~Q(notification_type='roulette_winner'))
        
        if user.is_staff:
            # Admin puede ver sus admin-only Y notificaciones de ganadores
            q_filter |= Q(is_admin_only=True, user=user)
            # Admin SÍ puede ver notificaciones de ganadores en su bandeja
            q_filter = Q(user=user) | Q(is_public=True) | Q(is_admin_only=True, user=user)

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
            
            # Stats también excluyen ganadores para usuarios normales
            if user.is_staff:
                q_filter = Q(user=user) | Q(is_public=True) | Q(is_admin_only=True, user=user)
            else:
                q_filter = Q(user=user) | (Q(is_public=True) & ~Q(notification_type='roulette_winner'))
            
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
    🎯 Lista SOLO notificaciones públicas - INCLUYE notificaciones de ganadores
    Este endpoint es para consumo en homepage/inicio público
    """
    serializer_class = PublicNotificationSerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = NotificationPagination

    def get_queryset(self):
        priority = self.request.query_params.get('priority')
        roulette_id = self.request.query_params.get('roulette_id')
        notification_type = self.request.query_params.get('type')
        
        # ✅ INCLUYE todas las notificaciones públicas (incluidos ganadores)
        qs = Notification.objects.filter(is_public=True)
        
        if priority:
            qs = qs.filter(priority=priority)
        if roulette_id:
            try:
                qs = qs.filter(roulette_id=int(roulette_id))
            except ValueError:
                pass
        if notification_type:
            qs = qs.filter(notification_type=notification_type)
        
        return qs.order_by('-priority', '-created_at')


class WinnerNotificationListView(generics.ListAPIView):
    """
    GET /api/notifications/winners/
    🏆 Endpoint específico para mostrar SOLO notificaciones de ganadores
    Para consumo en homepage, carruseles, etc.
    """
    serializer_class = PublicNotificationSerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = NotificationPagination

    def get_queryset(self):
        roulette_id = self.request.query_params.get('roulette_id')
        days_back = self.request.query_params.get('days', 30)
        
        try:
            days_back = int(days_back)
        except (ValueError, TypeError):
            days_back = 30
        
        # Solo notificaciones de ganadores públicas
        qs = Notification.objects.filter(
            is_public=True,
            notification_type='roulette_winner'
        )
        
        # Filtrar por fecha (últimos X días)
        if days_back > 0:
            cutoff_date = timezone.now() - timedelta(days=days_back)
            qs = qs.filter(created_at__gte=cutoff_date)
        
        if roulette_id:
            try:
                qs = qs.filter(roulette_id=int(roulette_id))
            except ValueError:
                pass
        
        return qs.order_by('-created_at')

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        
        # Agregar metadata útil
        response.data['metadata'] = {
            'total_winners': response.data.get('count', 0),
            'generated_at': timezone.now(),
            'filters_applied': {
                'roulette_id': request.query_params.get('roulette_id'),
                'days_back': request.query_params.get('days', 30),
            }
        }
        
        return response


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
        
        if user.is_staff:
            # Admin ve todo (incluyendo notificaciones de ganadores)
            q_filter = Q(user=user) | Q(is_public=True) | Q(is_admin_only=True, user=user)
        else:
            # Usuario normal NO ve notificaciones de ganadores públicas
            q_filter = Q(user=user) | (Q(is_public=True) & ~Q(notification_type='roulette_winner'))
        
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
    
    if user.is_staff:
        q_filter = Q(user=user) | Q(is_public=True) | Q(is_admin_only=True, user=user)
    else:
        # Usuario normal NO incluye notificaciones de ganadores
        q_filter = Q(user=user) | (Q(is_public=True) & ~Q(notification_type='roulette_winner'))
    
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
    
    if user.is_staff:
        q_filter = Q(user=user) | Q(is_public=True) | Q(is_admin_only=True, user=user)
    else:
        # Usuario normal NO incluye notificaciones de ganadores en stats
        q_filter = Q(user=user) | (Q(is_public=True) & ~Q(notification_type='roulette_winner'))
    
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
            # ✅ Admin ve todo, usuario normal NO ve ganadores
            if user.is_staff or n.notification_type != 'roulette_winner':
                accessible.append(n)
        elif n.user_id == user.id:
            accessible.append(n)
        elif n.is_admin_only and user.is_staff and n.user_id == user.id:
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


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def public_winner_feed(request):
    """
    GET /api/notifications/public/winners/feed/
    🎯 Feed público de ganadores para homepage
    Parámetros:
      - limit: número de ganadores a mostrar (default: 10)
      - days: días hacia atrás (default: 30)
      - roulette_id: filtrar por ruleta específica
    """
    try:
        limit = int(request.query_params.get('limit', 10))
        days_back = int(request.query_params.get('days', 30))
        roulette_id = request.query_params.get('roulette_id')
    except (ValueError, TypeError):
        limit = 10
        days_back = 30
        roulette_id = None
    
    # Validar límites
    limit = max(1, min(limit, 50))  # Entre 1 y 50
    days_back = max(1, min(days_back, 365))  # Entre 1 y 365 días
    
    cutoff_date = timezone.now() - timedelta(days=days_back)
    
    qs = Notification.objects.filter(
        is_public=True,
        notification_type='roulette_winner',
        created_at__gte=cutoff_date
    )
    
    if roulette_id:
        try:
            qs = qs.filter(roulette_id=int(roulette_id))
        except ValueError:
            pass
    
    winners = qs.order_by('-created_at')[:limit]
    
    # Formatear respuesta optimizada para frontend
    winner_feed = []
    for winner in winners:
        extra_data = winner.extra_data or {}
        winner_feed.append({
            'id': winner.id,
            'winner_name': extra_data.get('winner_name', 'Ganador'),
            'roulette_name': extra_data.get('roulette_name', ''),
            'roulette_id': winner.roulette_id,
            'participants': extra_data.get('total_participants', 0),
            'prize_details': extra_data.get('prize_details', ''),
            'created_at': winner.created_at,
            'message': winner.message,
            'priority': winner.priority,
        })
    
    return Response({
        'winners': winner_feed,
        'total_count': len(winner_feed),
        'filters_applied': {
            'limit': limit,
            'days_back': days_back,
            'roulette_id': roulette_id,
        },
        'generated_at': timezone.now(),
    })


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def public_stats(request):
    """
    GET /api/notifications/public/stats/
    📊 Estadísticas públicas del sistema (sin datos sensibles)
    """
    total_winners = Notification.objects.filter(
        notification_type='roulette_winner',
        is_public=True
    ).count()
    
    recent_winners_7d = Notification.objects.filter(
        notification_type='roulette_winner',
        is_public=True,
        created_at__gte=timezone.now() - timedelta(days=7)
    ).count()
    
    recent_winners_30d = Notification.objects.filter(
        notification_type='roulette_winner',
        is_public=True,
        created_at__gte=timezone.now() - timedelta(days=30)
    ).count()
    
    # Contar ganadores por ruleta (top 5)
    top_roulettes = dict(
        Notification.objects.filter(
            notification_type='roulette_winner',
            is_public=True,
            roulette_id__isnull=False
        ).values('roulette_id').annotate(
            winner_count=Count('id')
        ).order_by('-winner_count')[:5].values_list('roulette_id', 'winner_count')
    )
    
    return Response({
        'total_winners_all_time': total_winners,
        'recent_winners_7_days': recent_winners_7d,
        'recent_winners_30_days': recent_winners_30d,
        'top_roulettes_by_winners': top_roulettes,
        'last_updated': timezone.now(),
    })

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
        from django.conf import settings
        User = get_user_model()
        
        winner_user = User.objects.get(pk=serializer.validated_data['winner_user_id'])
        
        logger.warning(f"🎯 [WINNER] Iniciando anuncio para: {winner_user.username} ({winner_user.email})")
        
        # Crear notificaciones en BD
        public_notif, personal_notif, admin_notifs = NotificationService.create_winner_announcement(
            winner_user=winner_user,
            roulette_name=serializer.validated_data['roulette_name'],
            roulette_id=serializer.validated_data['roulette_id'],
            total_participants=serializer.validated_data['total_participants'],
            prize_details=serializer.validated_data.get('prize_details', ''),
        )
        
        logger.info(f"✅ [WINNER] Notificaciones BD creadas - Personal ID: {personal_notif.id}")
        
        # Intentar enviar email con Celery
        email_scheduled = False
        task_info = None
        email_error = None
        
        try:
            from .tasks import send_winner_notification_delayed
            
            # Obtener delay configurado
            delay_seconds = getattr(settings, 'WINNER_NOTIFICATION_DELAY', 300)
            
            logger.warning("=" * 60)
            logger.warning(f"⏰ CONFIGURACIÓN DE DELAY:")
            logger.warning(f"   - Delay: {delay_seconds} segundos")
            logger.warning(f"   - Equivalente: {delay_seconds/60:.1f} minutos")
            logger.warning(f"   - Hora actual: {timezone.now().strftime('%H:%M:%S')}")
            estimated_time = timezone.now() + timedelta(seconds=delay_seconds)
            logger.warning(f"   - Email se enviará aprox: {estimated_time.strftime('%H:%M:%S')}")
            logger.warning("=" * 60)
            
            # Programar tarea
            task = send_winner_notification_delayed.apply_async(
                kwargs={
                    'user_id': winner_user.id,
                    'roulette_name': serializer.validated_data['roulette_name'],
                    'prize_name': serializer.validated_data.get('prize_details', 'Premio ganado'),
                    'roulette_id': serializer.validated_data['roulette_id'],
                    'notify_admins': True,
                },
                countdown=delay_seconds  # Este es el delay
            )
            
            task_info = {
                'task_id': str(task.id),
                'delay_seconds': delay_seconds,
                'delay_minutes': round(delay_seconds / 60, 1),
                'scheduled_for': estimated_time.isoformat(),
                'scheduled_for_readable': estimated_time.strftime('%Y-%m-%d %H:%M:%S'),
            }
            
            logger.warning(f"📧 [WINNER] Tarea Celery programada:")
            logger.warning(f"   - Task ID: {task.id}")
            logger.warning(f"   - Estado: {task.state}")
            logger.warning(f"   - Para: {winner_user.email}")
            
            # Actualizar notificación con info de programación
            personal_notif.email_sent = False
            personal_notif.email_error = f'Programado - se enviará en {delay_seconds/60:.1f} min'
            personal_notif.email_recipient = winner_user.email
            personal_notif.extra_data = personal_notif.extra_data or {}
            personal_notif.extra_data['email_task_id'] = str(task.id)
            personal_notif.extra_data['email_scheduled_at'] = timezone.now().isoformat()
            personal_notif.extra_data['email_delay_seconds'] = delay_seconds
            personal_notif.save()
            
            email_scheduled = True
            logger.info(f"✅ [WINNER] Email programado exitosamente")
            
        except ImportError as e:
            error_msg = 'Celery no está disponible - instalar: pip install celery'
            logger.error(f"❌ [WINNER] {error_msg}")
            logger.error(f"   Error: {str(e)}")
            email_error = error_msg
            personal_notif.email_error = error_msg
            personal_notif.save()
            
        except Exception as e:
            error_msg = f'Error programando email: {str(e)}'
            logger.error(f"❌ [WINNER] {error_msg}")
            logger.exception("Detalles del error:")
            email_error = error_msg
            personal_notif.email_error = error_msg
            personal_notif.save()
        
        # Preparar respuesta
        response_data = {
            'success': True,
            'public_notification': NotificationSerializer(public_notif).data,
            'personal_notification': NotificationSerializer(personal_notif).data,
            'admin_notifications_count': len(admin_notifs),
            'email_scheduled': email_scheduled,
        }
        
        if task_info:
            response_data['email_delay_info'] = task_info
            logger.warning(f"📤 [WINNER] Respuesta enviada al frontend con delay_info")
        
        if email_error:
            response_data['email_error'] = email_error
            logger.error(f"📤 [WINNER] Respuesta con error: {email_error}")
        
        return Response(response_data, status=status.HTTP_201_CREATED)
        
    except User.DoesNotExist:
        logger.error(f"❌ [WINNER] Usuario no encontrado: {serializer.validated_data.get('winner_user_id')}")
        return Response({'error': 'Usuario ganador no encontrado'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as exc:
        logger.exception('❌ [WINNER] Error crítico creando anuncio de ganador')
        return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)


# NUEVO: Endpoint para actualizar estado de email
@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def update_email_status(request, notification_id):
    """
    POST /api/notifications/{notification_id}/email-status/
    Actualizar estado de envío de email
    Body: {
        "status": "sent" | "error",
        "error_message": "..." (opcional),
        "recipient_email": "..." (opcional)
    }
    """
    if not request.user.is_staff:
        return Response({'error': 'Permisos insuficientes'}, status=status.HTTP_403_FORBIDDEN)
    
    try:
        notification = Notification.objects.get(id=notification_id)
    except Notification.DoesNotExist:
        return Response({'error': 'Notificación no encontrada'}, status=status.HTTP_404_NOT_FOUND)
    
    email_status = request.data.get('status')
    
    logger.info(f"📧 [EMAIL STATUS] Actualizando notificación {notification_id} a estado: {email_status}")
    
    if email_status == 'sent':
        notification.email_sent = True
        notification.email_sent_at = timezone.now()
        notification.email_error = ''
        if request.data.get('recipient_email'):
            notification.email_recipient = request.data.get('recipient_email')
        logger.info(f"✅ [EMAIL STATUS] Marcado como enviado a {notification.email_recipient}")
    elif email_status == 'error':
        notification.email_sent = False
        notification.email_error = request.data.get('error_message', 'Error desconocido')
        if request.data.get('recipient_email'):
            notification.email_recipient = request.data.get('recipient_email')
        logger.error(f"❌ [EMAIL STATUS] Marcado como error: {notification.email_error}")
    else:
        return Response({'error': 'Estado inválido'}, status=status.HTTP_400_BAD_REQUEST)
    
    notification.save()
    
    serializer = AdminNotificationSerializer(notification)
    return Response({
        'success': True,
        'notification': serializer.data
    })