import secrets
from django.db import transaction
from django.utils import timezone
from django.core.exceptions import ValidationError
from .models import Roulette, DrawHistory
from participants.models import Participation


def validate_roulette_participation(roulette: Roulette, user) -> None:
    if roulette.is_drawn or roulette.status == 'completed':
        raise ValidationError('La ruleta ya fue sorteada.')
    if roulette.settings and roulette.settings.max_participants:
        if roulette.get_participants_count() >= roulette.settings.max_participants:
            raise ValidationError('Se alcanzó el límite de participantes.')
    if not (roulette.settings and roulette.settings.allow_multiple_entries):
        if Participation.objects.filter(roulette=roulette, user=user).exists():
            raise ValidationError('Ya participaste en esta ruleta.')


@transaction.atomic
def execute_roulette_draw(roulette: Roulette, admin_user, draw_type='manual') -> dict:
    """
    Selecciona ganador al azar entre las participaciones de la ruleta.
    Marca la participación ganadora, registra historial y actualiza ruleta.
    """
    if roulette.is_drawn or roulette.status == 'completed':
        return {'success': False, 'message': 'La ruleta ya fue sorteada.'}

    participants_qs = roulette.participations.select_related('user').order_by('participant_number')
    count = participants_qs.count()
    if count == 0:
        return {'success': False, 'message': 'No hay participantes.'}

    # Selección pseudoaleatoria
    seed = secrets.token_hex(8)
    winner = participants_qs.order_by('?').first()

    # Marcar ganador y ruleta
    winner.is_winner = True
    winner.save(update_fields=['is_winner'])

    roulette.winner = winner
    roulette.drawn_at = timezone.now()
    roulette.drawn_by = admin_user
    roulette.status = 'completed'
    roulette.is_drawn = True
    roulette.save()

    # Historial
    DrawHistory.objects.create(
        roulette=roulette,
        winner_selected=winner,
        drawn_by=admin_user,
        draw_type=draw_type,
        drawn_at=roulette.drawn_at,
        participants_count=count,
        random_seed=seed
    )

    return {'success': True, 'winner': winner, 'seed': seed}
