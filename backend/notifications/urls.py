# backend/notifications/urls.py

from django.urls import path
from . import views

app_name = 'notifications'

urlpatterns = [
    # =====================================
    # NOTIFICACIONES PARA USUARIOS AUTENTICADOS
    # =====================================
    
    # Notificaciones del usuario (SIN ganadores para usuarios normales)
    path('user/', views.UserNotificationListView.as_view(), name='user-notifications'),

    # Notificaciones de administrador (específicas del admin autenticado)
    path('admin/', views.AdminNotificationListView.as_view(), name='admin-notifications'),

    # Detalle / actualización / eliminación de una notificación
    path('<int:pk>/', views.NotificationDetailView.as_view(), name='notification-detail'),

    # =====================================
    # NOTIFICACIONES PÚBLICAS (para homepage/inicio)
    # =====================================
    
    # Todas las notificaciones públicas (INCLUYE ganadores)
    path('public/', views.PublicNotificationListView.as_view(), name='public-notifications'),

    # Solo notificaciones de ganadores (para carruseles, feeds, etc)
    path('winners/', views.WinnerNotificationListView.as_view(), name='winner-notifications'),
    
    # Feed de ganadores optimizado para homepage
    path('public/winners/feed/', views.public_winner_feed, name='public-winner-feed'),
    
    # Estadísticas públicas del sistema
    path('public/stats/', views.public_stats, name='public-stats'),


 

    # =====================================
    # ACCIONES SOBRE NOTIFICACIONES
    # =====================================
    
    # Marcar notificaciones como leídas
    path('mark-read/', views.mark_notifications_read, name='mark-notifications-read'),
    path('mark-all-read/', views.mark_all_notifications_read, name='mark-all-notifications-read'),
    
    # Eliminar notificaciones leídas
    path('delete-read/', views.delete_read_notifications, name='delete-read-notifications'),

    # =====================================
    # ESTADÍSTICAS Y DASHBOARD
    # =====================================
    
    # Estadísticas personales del usuario
    path('stats/', views.notification_stats, name='notification-stats'),
    
    # Dashboard completo para administradores
    path('dashboard/', views.notification_summary_dashboard, name='notification-dashboard'),

    # =====================================
    # NOTIFICACIONES POR CONTEXTO
    # =====================================
    
    # Notificaciones relacionadas a una ruleta específica
    path('roulette/<int:roulette_id>/', views.roulette_notifications, name='roulette-notifications'),

    # =====================================
    # MENSAJES EN TIEMPO REAL
    # =====================================
    
    # Mensajes WebSocket/tiempo real
    path('realtime/', views.RealTimeMessageListView.as_view(), name='realtime-messages'),

    # =====================================
    # FUNCIONES ADMINISTRATIVAS
    # =====================================
    
    # Limpieza de notificaciones antiguas
    path('cleanup/', views.delete_old_notifications, name='cleanup-notifications'),
    
    # Crear notificaciones vía webhook/API
    path('webhook/', views.create_notification_webhook, name='notification-webhook'),
    
    # Crear anuncio completo de ganador
    path('winner-announcement/', views.create_winner_announcement, name='winner-announcement'),

    # =====================================
    # CONFIGURACIÓN Y PLANTILLAS
    # =====================================
    
    # Preferencias de notificaciones de admin
    path('admin-preferences/', views.AdminNotificationPreferenceView.as_view(), name='admin-preferences'),

    # Plantillas de notificaciones (CRUD)
    path('templates/', views.NotificationTemplateListCreateView.as_view(), name='notification-templates'),
    path('templates/<int:pk>/', views.NotificationTemplateDetailView.as_view(), name='notification-template-detail'),
]