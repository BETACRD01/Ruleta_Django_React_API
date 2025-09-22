# participants/urls.py
from django.urls import path
from . import views

app_name = "participants"

urlpatterns = [
    path("participations/participate/", views.participate, name="participate"),
    path("participations/my-participations/", views.MyParticipationsView.as_view(), name="my-participations"),
    path("participations/roulette/<int:roulette_id>/", views.RouletteParticipantsView.as_view(), name="roulette-participants"),
    path("participations/check-participation/<int:roulette_id>/", views.check_participation, name="check-participation"),
]
