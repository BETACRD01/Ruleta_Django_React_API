from django.urls import path

from . import views  # tus vistas PRIVADAS existentes
from .views_public import (  # nuevas vistas PÚBLICAS
    PublicDrawHistoryView,
    PublicRouletteListView,
    PublicRouletteDetailView,  # <- AGREGAR ESTA
    PublicMetricsView,
)

app_name = "roulettes"

urlpatterns = [
    # ========= PÚBLICO (no requiere token) =========
    path("public/draw/history/", PublicDrawHistoryView.as_view(), name="public-draw-history"),
    path("public/roulettes/", PublicRouletteListView.as_view(), name="public-roulettes"),
    path("public/roulette/<int:pk>/", PublicRouletteDetailView.as_view(), name="public-roulette-detail"),  # <- AGREGAR
    path("public/metrics/", PublicMetricsView.as_view(), name="public-metrics"),

    # ========= PRIVADO (ya existentes) =========
    path("", views.RouletteListView.as_view(), name="list"),
    path("create/", views.RouletteCreateView.as_view(), name="create"),
    path("<int:pk>/", views.RouletteDetailView.as_view(), name="detail"),
    path("<int:pk>/update/", views.RouletteUpdateView.as_view(), name="update"),
    path("<int:pk>/delete/", views.RouletteDestroyView.as_view(), name="delete"),

    path("draw/execute/", views.DrawExecuteView.as_view(), name="draw-execute"),
    path("draw/history/", views.DrawHistoryView.as_view(), name="draw-history"),

    path("<int:roulette_id>/stats/", views.roulette_stats, name="stats"),
    path("<int:roulette_id>/prizes/", views.RoulettePrizeListCreateView.as_view(), name="prizes-list"),
    path("<int:roulette_id>/prizes/<int:pk>/", views.RoulettePrizeRetrieveView.as_view(), name="prizes-detail"),
    path("<int:roulette_id>/prizes/<int:pk>/update/", views.RoulettePrizeUpdateView.as_view(), name="prizes-update"),
    path("<int:roulette_id>/prizes/<int:pk>/delete/", views.RoulettePrizeDestroyView.as_view(), name="prizes-delete"),
]