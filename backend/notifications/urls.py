# backend/notifications/urls.py

from django.urls import path
from . import views

app_name = 'notifications'

urlpatterns = [
    # Notificaciones del usuario
    path('user/', views.UserNotificationListView.as_view(), name='user-notifications'),

    # Notificaciones públicas
    path('public/', views.PublicNotificationListView.as_view(), name='public-notifications'),

    # Detalle / actualización / eliminación de una notificación
    path('<int:pk>/', views.NotificationDetailView.as_view(), name='notification-detail'),

    # Marcar múltiples como leídas
    path('mark-read/', views.mark_notifications_read, name='mark-notifications-read'),

    # NUEVO: Eliminar todas las leídas del usuario actual
    path('delete-read/', views.delete_read_notifications, name='delete-read-notifications'),

    # Estadísticas
    path('stats/', views.notification_stats, name='notification-stats'),

    # Notificaciones por ruleta
    path('roulette/<int:roulette_id>/', views.roulette_notifications, name='roulette-notifications'),

    # Mensajes en tiempo real
    path('realtime/', views.RealTimeMessageListView.as_view(), name='realtime-messages'),

    # Limpieza (admin)
    path('cleanup/', views.delete_old_notifications, name='cleanup-notifications'),

    # Webhook (admin)
    path('webhook/', views.create_notification_webhook, name='notification-webhook'),
]
