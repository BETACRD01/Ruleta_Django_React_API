# backend/notifications/urls.py

from django.urls import path
from . import views

app_name = 'notifications'

urlpatterns = [
    # Notificaciones del usuario
    path('user/', views.UserNotificationListView.as_view(), name='user-notifications'),

    # Notificaciones públicas
    path('public/', views.PublicNotificationListView.as_view(), name='public-notifications'),

    # Notificaciones de administrador
    path('admin/', views.AdminNotificationListView.as_view(), name='admin-notifications'),

    # Detalle / actualización / eliminación de una notificación
    path('<int:pk>/', views.NotificationDetailView.as_view(), name='notification-detail'),

    # Acciones sobre notificaciones
    path('mark-read/', views.mark_notifications_read, name='mark-notifications-read'),
    path('mark-all-read/', views.mark_all_notifications_read, name='mark-all-notifications-read'),
    path('delete-read/', views.delete_read_notifications, name='delete-read-notifications'),

    # Estadísticas
    path('stats/', views.notification_stats, name='notification-stats'),
    path('dashboard/', views.notification_summary_dashboard, name='notification-dashboard'),

    # Notificaciones por ruleta
    path('roulette/<int:roulette_id>/', views.roulette_notifications, name='roulette-notifications'),

    # Mensajes en tiempo real
    path('realtime/', views.RealTimeMessageListView.as_view(), name='realtime-messages'),

    # Funciones administrativas
    path('cleanup/', views.delete_old_notifications, name='cleanup-notifications'),
    path('webhook/', views.create_notification_webhook, name='notification-webhook'),
    path('winner-announcement/', views.create_winner_announcement, name='winner-announcement'),

    # Preferencias de administrador
    path('admin-preferences/', views.AdminNotificationPreferenceView.as_view(), name='admin-preferences'),

    # Plantillas de notificaciones
    path('templates/', views.NotificationTemplateListCreateView.as_view(), name='notification-templates'),
    path('templates/<int:pk>/', views.NotificationTemplateDetailView.as_view(), name='notification-template-detail'),
]