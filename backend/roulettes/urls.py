from django.urls import path
from . import views

app_name = 'roulettes'

urlpatterns = [
    # Lista y creación
    path('', views.RouletteListView.as_view(), name='list'),                         # GET /api/roulettes/
    path('create/', views.RouletteCreateView.as_view(), name='create'),              # POST /api/roulettes/create/

    # Detalle y actualización
    path('<int:pk>/', views.RouletteDetailView.as_view(), name='detail'),            # GET /api/roulettes/<id>/
    path('<int:pk>/update/', views.RouletteUpdateView.as_view(), name='update'),     # PUT/PATCH /api/roulettes/<id>/update/

    # Sorteo y estadísticas
    path('draw/execute/', views.DrawExecuteView.as_view(), name='draw-execute'),     # POST /api/roulettes/draw/execute/
    path('draw/history/', views.DrawHistoryView.as_view(), name='draw-history'),     # GET /api/roulettes/draw/history/
    path('<int:roulette_id>/stats/', views.roulette_stats, name='stats'),            # GET /api/roulettes/<id>/stats/

    # Premios anidados (compatibles con tu API del frontend)
    path('<int:roulette_id>/prizes/', views.RoulettePrizeListCreateView.as_view(), name='prizes-list-create'),                 # LIST/ADD
    path('<int:roulette_id>/prizes/<int:pk>/', views.RoulettePrizeRetrieveView.as_view(), name='prizes-detail'),               # ITEM
    path('<int:roulette_id>/prizes/<int:pk>/update/', views.RoulettePrizeUpdateView.as_view(), name='prizes-update'),         # UPDATE
    path('<int:roulette_id>/prizes/<int:pk>/delete/', views.RoulettePrizeDestroyView.as_view(), name='prizes-delete'),        # DELETE
]
