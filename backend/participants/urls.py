# backend/participants/urls.py
from django.urls import path
from . import views

app_name = "participants"

urlpatterns = [
    # POST: Crear participación
    path("participations/participate/", views.participate, name="participate"),
    
    # GET: Mis participaciones
    path("participations/my-participations/", views.MyParticipationsView.as_view(), name="my-participations"),
    
    # GET: Participantes de una ruleta
    path("participations/roulette/<int:roulette_id>/", views.RouletteParticipantsView.as_view(), name="roulette-participants"),
    
    # GET: Ganadores de una ruleta
    path("participations/roulette/<int:roulette_id>/winners/", views.get_roulette_winners, name="roulette-winners"),
    
    # GET: Verificar si participé en una ruleta
    path("participations/roulette/<int:roulette_id>/check/", views.check_participation, name="check-participation"),
]