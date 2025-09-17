from django.urls import path
from . import views

app_name = 'roulettes'

urlpatterns = [
    # Lista y creación de ruletas
    path('', views.RouletteListView.as_view(), name='list'),
    path('create/', views.RouletteCreateView.as_view(), name='create'),

    # Detalle, actualización y eliminación
    path('<int:pk>/', views.RouletteDetailView.as_view(), name='detail'),
    path('<int:pk>/update/', views.RouletteUpdateView.as_view(), name='update'),
    path('<int:pk>/delete/', views.RouletteDestroyView.as_view(), name='delete'),
    
    # Sorteo y estadísticas
    path('draw/execute/', views.DrawExecuteView.as_view(), name='draw-execute'),
    path('draw/history/', views.DrawHistoryView.as_view(), name='draw-history'),
    path('<int:roulette_id>/stats/', views.roulette_stats, name='stats'),
    
    # Premios
    path('<int:roulette_id>/prizes/', views.RoulettePrizeListCreateView.as_view(), name='prizes-list'),
    path('<int:roulette_id>/prizes/<int:pk>/', views.RoulettePrizeRetrieveView.as_view(), name='prizes-detail'),
    path('<int:roulette_id>/prizes/<int:pk>/update/', views.RoulettePrizeUpdateView.as_view(), name='prizes-update'),
    path('<int:roulette_id>/prizes/<int:pk>/delete/', views.RoulettePrizeDestroyView.as_view(), name='prizes-delete'),
]