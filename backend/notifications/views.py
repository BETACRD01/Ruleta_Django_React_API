from datetime import timedelta
from django.db import transaction
from django.db.models import Q, Count, Exists, OuterRef
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle, AnonRateThrottle
from django.conf import settings

from .models import (
    Notification, 
    RealTimeMessage, 
    AdminNotificationPreference,
    NotificationTemplate,
    NotificationReadStatus,
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
from .services import (
    NotificationService, 
    RealTimeService,
    mark_admin_notification_as_read,
    get_unread_admin_notifications_count,
    bulk_mark_admin_notifications_read,
)

import logging
logger = logging.getLogger(__name__)


class NotificationPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


class NotificationRateThrottle(UserRateThrottle):
    rate = '10000/hour'


class PublicNotificationThrottle(AnonRateThrottle):
    rate = '50/hour'


class UserNotificationListView(generics.ListAPIView):
    """Lista notificaciones del usuario autenticado"""
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = NotificationPagination
    throttle_classes = [NotificationRateThrottle]

    def get_queryset(self):
        user = self.request.user
        params = self.request.query_params

        unread_only = str(params.get('unread_only', 'false')).lower() == 'true'
        roulette_id = params.get('roulette_id')
        priority = params.get('priority')

        # Subquery para saber si YO (usuario actual) la he leído
        read_status_exists = NotificationReadStatus.objects.filter(
            notification=OuterRef('pk'),
            user=user
        )

        # Filtros base según tipo de usuario
        if user.is_staff:
            base_q = (
                Q(user=user) |
                Q(is_admin_only=True, user__isnull=True) |
                (Q(is_public=True) & ~Q(notification_type='roulette_winner'))
            )
        else:
            base_q = (
                Q(user=user) |
                (Q(is_public=True) & ~Q(notification_type='roulette_winner'))
            )

        qs = (
            Notification.objects
            .filter(base_q)
            .annotate(is_read_by_me=Exists(read_status_exists))
            .select_related('user')
        )

        # Filtros adicionales
        if roulette_id:
            try:
                qs = qs.filter(roulette_id=int(roulette_id))
            except ValueError:
                pass

        if priority and priority in ['low', 'normal', 'high', 'urgent']:
            qs = qs.filter(priority=priority)

        # Solo no leídas
        if unread_only:
            if user.is_staff:
                # Para staff: (asignadas no leídas) OR (admin-only globales no leídas por mí)
                qs = qs.filter(
                    Q(user=user, is_read=False) |
                    (Q(is_admin_only=True, user__isnull=True) & Q(is_read_by_me=False))
                )
            else:
                # Para no-staff: solo asignadas con is_read False
                qs = qs.filter(Q(user=user, is_read=False))

        return qs.order_by('-priority', '-created_at')
    
    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)

        if request.query_params.get('include_stats', 'false').lower() == 'true':
            user = request.user

            # Alineamos los filtros de stats con los del queryset principal
            if user.is_staff:
                read_status_exists = NotificationReadStatus.objects.filter(
                    notification=OuterRef('pk'),
                    user=user
                )
                q_filter = (
                    Q(user=user) |
                    Q(is_admin_only=True, user__isnull=True) |
                    (Q(is_public=True) & ~Q(notification_type='roulette_winner'))
                )

                # Con annotate para contar no leídas de forma consistente
                base_qs = Notification.objects.filter(q_filter).annotate(
                    is_read_by_me=Exists(read_status_exists)
                )

                total_count = base_qs.count()
                unread_count = base_qs.filter(
                    Q(user=user, is_read=False) |
                    (Q(is_admin_only=True, user__isnull=True) & Q(is_read_by_me=False))
                ).count()
                urgent_count = base_qs.filter(
                    Q(priority='urgent') &
                    (
                        Q(user=user, is_read=False) |
                        (Q(is_admin_only=True, user__isnull=True) & Q(is_read_by_me=False))
                    )
                ).count()

                stats = {
                    'total_count': total_count,
                    'unread_count': unread_count,
                    'urgent_count': urgent_count,
                }
            else:
                q_filter = (
                    Q(user=user) |
                    (Q(is_public=True) & ~Q(notification_type='roulette_winner'))
                )
                base_qs = Notification.objects.filter(q_filter)

                stats = {
                    'total_count': base_qs.count(),
                    'unread_count': base_qs.filter(is_read=False).count(),
                    'urgent_count': base_qs.filter(priority='urgent', is_read=False).count(),
                }
            
            response.data['stats'] = stats

        return response


class AdminNotificationListView(generics.ListAPIView):
    """Lista notificaciones admin con estado de lectura individual"""
    serializer_class = AdminNotificationSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = NotificationPagination

    def get_queryset(self):
        user = self.request.user
        if not user.is_staff:
            return Notification.objects.none()
        
        unread_only = self.request.query_params.get('unread_only', 'false').lower() == 'true'
        
        read_status_exists = NotificationReadStatus.objects.filter(
            notification=OuterRef('pk'),
            user=user
        )
        
        qs = (
            Notification.objects
            .filter(is_admin_only=True, user__isnull=True)
            .annotate(is_read_by_me=Exists(read_status_exists))
            .order_by('-priority', '-created_at')
        )
        
        if unread_only:
            qs = qs.filter(is_read_by_me=False)
        
        return qs
    
    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context


class PublicNotificationListView(generics.ListAPIView):
    """Lista notificaciones públicas"""
    serializer_class = PublicNotificationSerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = NotificationPagination
    throttle_classes = [PublicNotificationThrottle]

    def get_queryset(self):
        priority = self.request.query_params.get('priority')
        roulette_id = self.request.query_params.get('roulette_id')
        notification_type = self.request.query_params.get('type')
        
        qs = Notification.objects.filter(is_public=True)
        
        if priority and priority in ['low', 'normal', 'high', 'urgent']:
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
    """Lista solo notificaciones de ganadores"""
    serializer_class = PublicNotificationSerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = NotificationPagination
    throttle_classes = [PublicNotificationThrottle]

    def get_queryset(self):
        roulette_id = self.request.query_params.get('roulette_id')
        days_back = self.request.query_params.get('days', 30)
        
        try:
            days_back = int(days_back)
            days_back = max(1, min(days_back, 365))
        except (ValueError, TypeError):
            days_back = 30
        
        qs = Notification.objects.filter(
            is_public=True,
            notification_type='roulette_winner'
        )
        
        if days_back > 0:
            cutoff_date = timezone.now() - timedelta(days=days_back)
            qs = qs.filter(created_at__gte=cutoff_date)
        
        if roulette_id:
            try:
                qs = qs.filter(roulette_id=int(roulette_id))
            except ValueError:
                pass
        
        return qs.order_by('-created_at')


class NotificationDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Detalle de notificación"""
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user

        read_status_exists = NotificationReadStatus.objects.filter(
            notification=OuterRef('pk'),
            user=user
        )
        
        if user.is_staff:
            q_filter = (
                Q(user=user) |
                Q(is_public=True) |
                Q(is_admin_only=True, user__isnull=True)
            )
        else:
            q_filter = Q(user=user) | (Q(is_public=True) & ~Q(notification_type='roulette_winner'))
        
        return (
            Notification.objects
            .filter(q_filter)
            .annotate(is_read_by_me=Exists(read_status_exists))
        )

    def get_serializer_class(self):
        if self.request.method == 'PATCH':
            return NotificationUpdateSerializer
        return NotificationSerializer

    def perform_update(self, serializer):
        notification = serializer.save()
        if serializer.validated_data.get('is_read') and notification.user:
            logger.info(f"Notificación {notification.id} marcada como leída")

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        
        # Validación explícita de permisos
        if instance.is_public:
            return Response(
                {'error': 'No puedes eliminar notificaciones públicas.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        if instance.is_admin_only and not request.user.is_staff:
            return Response(
                {'error': 'No puedes eliminar notificaciones admin.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        if instance.user_id and instance.user_id != request.user.id:
            return Response(
                {'error': 'No puedes eliminar notificaciones de otros usuarios.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        self.perform_destroy(instance)
        return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
@transaction.atomic
def mark_notifications_read(request):
    """Marca notificaciones como leídas (transaccional)"""
    serializer = BulkNotificationMarkReadSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    user = request.user
    notification_ids = serializer.validated_data['notification_ids']
    
    count = 0
    
    # Separar notificaciones admin de normales
    admin_notifications = Notification.objects.filter(
        id__in=notification_ids,
        is_admin_only=True,
        user__isnull=True
    )
    
    normal_notifications = Notification.objects.filter(
        id__in=notification_ids,
        user=user
    )
    
    # Marcar admin notifications (solo si es staff)
    if user.is_staff and admin_notifications.exists():
        admin_count = bulk_mark_admin_notifications_read(
            user.id, 
            list(admin_notifications.values_list('id', flat=True))
        )
        count += admin_count
    
    # Marcar notificaciones normales
    updated = normal_notifications.filter(is_read=False).update(is_read=True)
    count += updated
    
    return Response({'success': True, 'updated_count': count}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
@transaction.atomic
def mark_all_notifications_read(request):
    """Marca todas las notificaciones como leídas (transaccional)"""
    user = request.user
    count = 0
    
    if user.is_staff:
        # Marcar notificaciones admin-only globales
        admin_notifications = Notification.objects.filter(
            is_admin_only=True,
            user__isnull=True
        )
        admin_count = bulk_mark_admin_notifications_read(
            user.id,
            list(admin_notifications.values_list('id', flat=True))
        )
        count += admin_count
    
    # Marcar notificaciones propias
    updated = Notification.objects.filter(user=user, is_read=False).update(is_read=True)
    count += updated
    
    return Response({'success': True, 'updated_count': count}, status=status.HTTP_200_OK)


@api_view(['DELETE'])
@permission_classes([permissions.IsAuthenticated])
@transaction.atomic
def delete_read_notifications(request):
    """Elimina notificaciones leídas del usuario"""
    deleted, _ = Notification.objects.filter(user=request.user, is_read=True).delete()
    return Response({'success': True, 'deleted': deleted}, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def notification_stats(request):
    """Estadísticas del usuario"""
    user = request.user
    
    if user.is_staff:
        read_status_exists = NotificationReadStatus.objects.filter(
            notification=OuterRef('pk'),
            user=user
        )
        
        q_filter = (
            Q(user=user) |
            Q(is_admin_only=True, user__isnull=True) |
            (Q(is_public=True) & ~Q(notification_type='roulette_winner'))
        )
        
        user_notifications = Notification.objects.filter(q_filter).annotate(
            is_read_by_me=Exists(read_status_exists)
        )
        
        total = user_notifications.count()
        unread = user_notifications.filter(
            Q(user=user, is_read=False) |
            (Q(is_admin_only=True, user__isnull=True) & Q(is_read_by_me=False))
        ).count()
        recent = user_notifications.filter(
            created_at__gte=timezone.now() - timedelta(days=7)
        ).count()
        
    else:
        q_filter = Q(user=user) | (Q(is_public=True) & ~Q(notification_type='roulette_winner'))
        user_notifications = Notification.objects.filter(q_filter)
        
        total = user_notifications.count()
        unread = user_notifications.filter(is_read=False).count()
        recent = user_notifications.filter(
            created_at__gte=timezone.now() - timedelta(days=7)
        ).count()
    
    notifications_by_type = dict(
        user_notifications.values('notification_type')
        .annotate(count=Count('id'))
        .values_list('notification_type', 'count')
    )
    
    data = {
        'total_notifications': total,
        'unread_notifications': unread,
        'recent_notifications': recent,
        'notifications_by_type': notifications_by_type,
    }
    
    if user.is_staff:
        admin_unread = get_unread_admin_notifications_count(user.id)
        data['admin_notifications_unread'] = admin_unread
    
    return Response(data)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def roulette_notifications(request, roulette_id):
    """Notificaciones de una ruleta específica"""
    try:
        roulette_id = int(roulette_id)
        if roulette_id < 1:
            raise ValueError
    except (ValueError, TypeError):
        return Response(
            {'error': 'ID de ruleta inválido'}, 
            status=status.HTTP_400_BAD_REQUEST
        )

    user = request.user

    read_status_exists = NotificationReadStatus.objects.filter(
        notification=OuterRef('pk'),
        user=user
    )
    
    # Query optimizada con filtros
    if user.is_staff:
        q_filter = (
            Q(user=user, roulette_id=roulette_id) |
            Q(is_public=True, roulette_id=roulette_id) |
            Q(is_admin_only=True, user__isnull=True, roulette_id=roulette_id)
        )
    else:
        q_filter = (
            Q(user=user, roulette_id=roulette_id) |
            (Q(is_public=True, roulette_id=roulette_id) & ~Q(notification_type='roulette_winner'))
        )
    
    notifications = (
        Notification.objects
        .filter(q_filter)
        .annotate(is_read_by_me=Exists(read_status_exists))
        .select_related('user')
        .order_by('-priority', '-created_at')[:100]
    )
    serializer = NotificationSerializer(notifications, many=True, context={'request': request})
    
    return Response({
        'roulette_id': roulette_id,
        'notifications': serializer.data,
        'total_count': len(serializer.data),
    })


class RealTimeMessageListView(generics.ListAPIView):
    """Mensajes en tiempo real"""
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
@transaction.atomic
def delete_old_notifications(request):
    """Limpia notificaciones antiguas (admin only, transaccional)"""
    if not request.user.is_staff:
        return Response(
            {'error': 'Permisos insuficientes'}, 
            status=status.HTTP_403_FORBIDDEN
        )

    try:
        days = int(request.query_params.get('days', 30))
        days = max(1, min(days, 365))
    except (ValueError, TypeError):
        days = 30
    
    cutoff = timezone.now() - timedelta(days=days)

    deleted_notifications, _ = Notification.objects.filter(
        is_read=True, 
        created_at__lt=cutoff
    ).delete()
    
    deleted_rt = RealTimeService.cleanup_old_messages(days=7)

    return Response({
        'success': True,
        'deleted_notifications': deleted_notifications,
        'deleted_realtime_messages': deleted_rt,
        'cutoff_date': cutoff,
    })


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
@transaction.atomic
def create_notification_webhook(request):
    """Crea notificación vía webhook (admin only)"""
    if not request.user.is_staff:
        return Response(
            {'error': 'Permisos insuficientes'}, 
            status=status.HTTP_403_FORBIDDEN
        )

    serializer = NotificationCreateSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    try:
        notification = serializer.save()
        return Response(
            NotificationSerializer(notification, context={'request': request}).data, 
            status=status.HTTP_201_CREATED
        )
    except Exception as exc:
        logger.error(f'Error creando notificación por webhook: {str(exc)}', exc_info=True)
        return Response(
            {'error': 'Error interno del servidor'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


class AdminNotificationPreferenceView(generics.RetrieveUpdateAPIView):
    """Preferencias de notificaciones de admin"""
    serializer_class = AdminNotificationPreferenceSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        if not self.request.user.is_staff:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Solo administradores")
        
        obj, _ = AdminNotificationPreference.objects.get_or_create(
            user=self.request.user
        )
        return obj


class NotificationTemplateListCreateView(generics.ListCreateAPIView):
    """Lista y crea templates"""
    serializer_class = NotificationTemplateSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        if not self.request.user.is_staff:
            return NotificationTemplate.objects.none()
        return NotificationTemplate.objects.filter(is_active=True)


class NotificationTemplateDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Detalle de template"""
    serializer_class = NotificationTemplateSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        if not self.request.user.is_staff:
            return NotificationTemplate.objects.none()
        return NotificationTemplate.objects.all()


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def notification_summary_dashboard(request):
    """Dashboard completo para administrador"""
    if not request.user.is_staff:
        return Response(
            {'error': 'Permisos insuficientes'}, 
            status=status.HTTP_403_FORBIDDEN
        )

    total_notifications = Notification.objects.count()
    unread_notifications = Notification.objects.filter(is_read=False).count()
    recent_winners = Notification.objects.filter(
        notification_type='roulette_winner',
        created_at__gte=timezone.now() - timedelta(days=7)
    ).count()
    
    notifications_by_type = dict(
        Notification.objects.filter(
            created_at__gte=timezone.now() - timedelta(days=30)
        ).values('notification_type').annotate(
            count=Count('id')
        ).values_list('notification_type', 'count')
    )
    
    return Response({
        'system_stats': {
            'total_notifications': total_notifications,
            'unread_notifications': unread_notifications,
            'recent_winners': recent_winners,
        },
        'notifications_by_type': notifications_by_type,
        'generated_at': timezone.now(),
    })


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
@throttle_classes([PublicNotificationThrottle])
def public_winner_feed(request):
    """Feed público de ganadores (con rate limiting)"""
    try:
        limit = int(request.query_params.get('limit', 10))
        days_back = int(request.query_params.get('days', 30))
    except (ValueError, TypeError):
        limit = 10
        days_back = 30
    
    limit = max(1, min(limit, 50))
    days_back = max(1, min(days_back, 365))
    
    cutoff_date = timezone.now() - timedelta(days=days_back)
    
    winners = Notification.objects.filter(
        is_public=True,
        notification_type='roulette_winner',
        created_at__gte=cutoff_date
    ).order_by('-created_at')[:limit]
    
    winner_feed = []
    for winner in winners:
        extra_data = winner.extra_data or {}
        winner_feed.append({
            'id': winner.id,
            'winner_name': extra_data.get('winner_name', 'Ganador'),
            'roulette_name': extra_data.get('roulette_name', ''),
            'created_at': winner.created_at,
        })
    
    return Response({
        'winners': winner_feed,
        'total_count': len(winner_feed),
    })


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
@throttle_classes([PublicNotificationThrottle])
def public_stats(request):
    """Estadísticas públicas (con rate limiting)"""
    total_winners = Notification.objects.filter(
        notification_type='roulette_winner',
        is_public=True
    ).count()
    
    return Response({
        'total_winners_all_time': total_winners,
        'last_updated': timezone.now(),
    })


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
@transaction.atomic
def create_winner_announcement(request):
    """Crear anuncio de ganador"""
    if not request.user.is_staff:
        return Response(
            {'error': 'Permisos insuficientes'}, 
            status=status.HTTP_403_FORBIDDEN
        )

    serializer = WinnerAnnouncementSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    try:
        from django.contrib.auth import get_user_model
        User = get_user_model()
        
        winner_user = User.objects.get(pk=serializer.validated_data['winner_user_id'])
        
        public_notif, personal_notif, admin_result = (
            NotificationService.create_winner_announcement(
                winner_user=winner_user,
                roulette_name=serializer.validated_data['roulette_name'],
                roulette_id=serializer.validated_data['roulette_id'],
                total_participants=serializer.validated_data['total_participants'],
                prize_details=serializer.validated_data.get('prize_details', ''),
            )
        )
        
        return Response({
            'success': True,
            'public_notification': NotificationSerializer(public_notif, context={'request': request}).data,
            'personal_notification': NotificationSerializer(personal_notif, context={'request': request}).data,
            'admin_result': admin_result,
        }, status=status.HTTP_201_CREATED)
        
    except User.DoesNotExist:
        return Response(
            {'error': 'Usuario no encontrado'}, 
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as exc:
        logger.error(f'Error creando anuncio de ganador: {str(exc)}', exc_info=True)
        return Response(
            {'error': 'Error interno del servidor'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
@transaction.atomic
def update_email_status(request, notification_id):
    """Actualiza estado de envío de email"""
    if not request.user.is_staff:
        return Response(
            {'error': 'Permisos insuficientes'}, 
            status=status.HTTP_403_FORBIDDEN
        )
    
    try:
        notification = Notification.objects.get(id=notification_id)
    except Notification.DoesNotExist:
        return Response(
            {'error': 'Notificación no encontrada'}, 
            status=status.HTTP_404_NOT_FOUND
        )
    
    email_status = request.data.get('status')
    
    if email_status == 'sent':
        notification.email_sent = True
        notification.email_sent_at = timezone.now()
        notification.email_error = ''
    elif email_status == 'error':
        notification.email_sent = False
        error_message = request.data.get('error_message', 'Error desconocido')
        notification.email_error = error_message[:500]  # Limitar longitud
    else:
        return Response(
            {'error': 'Estado inválido. Use "sent" o "error"'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    notification.save()
    
    return Response({'success': True})
