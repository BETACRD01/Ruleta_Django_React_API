import secrets
from django.db import transaction
from django.utils import timezone
from django.core.exceptions import ValidationError
from .models import Roulette, DrawHistory, RouletteStatus
from participants.models import Participation


def validate_roulette_participation(roulette: Roulette, user) -> None:
    """
    Valida si un usuario puede participar en una ruleta.
    Lanza ValidationError si no puede participar.
    """
    if roulette.is_drawn or roulette.status == RouletteStatus.COMPLETED:
        raise ValidationError('La ruleta ya fue sorteada.')
    
    if roulette.status != RouletteStatus.ACTIVE:
        raise ValidationError('La ruleta no está activa.')
    
    # Verificar configuración
    if not hasattr(roulette, 'settings') or not roulette.settings:
        raise ValidationError('Configuración de ruleta faltante.')
    
    settings = roulette.settings
    
    # Verificar límite de participantes
    if settings.max_participants > 0:
        current_count = roulette.get_participants_count()
        if current_count >= settings.max_participants:
            raise ValidationError('Se alcanzó el límite de participantes.')
    
    # Verificar múltiples entradas
    if not settings.allow_multiple_entries:
        if Participation.objects.filter(roulette=roulette, user=user).exists():
            raise ValidationError('Ya participaste en esta ruleta.')
    
    # Verificar fechas de participación (ahora están en el modelo Roulette directamente)
    now = timezone.now()
    if roulette.participation_start and now < roulette.participation_start:
        raise ValidationError(f'La participación inicia el {roulette.participation_start.strftime("%d/%m/%Y %H:%M")}.')
    
    if roulette.participation_end and now > roulette.participation_end:
        raise ValidationError('El período de participación ha terminado.')


@transaction.atomic
def execute_roulette_draw(roulette: Roulette, admin_user, draw_type='manual'):
    """
    Ejecuta el sorteo de una ruleta.
    
    Args:
        roulette: La ruleta a sortear
        admin_user: Usuario que ejecuta el sorteo
        draw_type: Tipo de sorteo ('manual', 'scheduled', 'auto', 'admin')
    
    Returns:
        dict: Resultado del sorteo con 'success', 'message' y datos adicionales
    """
    try:
        # Validaciones previas
        if roulette.is_drawn or roulette.status == RouletteStatus.COMPLETED:
            return {
                'success': False, 
                'message': 'La ruleta ya fue sorteada.',
                'error_code': 'ALREADY_DRAWN'
            }

        # Permitir sorteo en ruletas ACTIVE y SCHEDULED
        if roulette.status not in [RouletteStatus.ACTIVE, RouletteStatus.SCHEDULED]:
            return {
                'success': False, 
                'message': 'La ruleta no está disponible para sorteo.',
                'error_code': 'NOT_AVAILABLE'
            }

        # Obtener participantes
        participants_qs = roulette.participations.select_related('user').order_by('participant_number')
        participants_list = list(participants_qs)
        count = len(participants_list)
        
        if count == 0:
            return {
                'success': False, 
                'message': 'No hay participantes para sortear.',
                'error_code': 'NO_PARTICIPANTS'
            }

        # Generar semilla para reproducibilidad
        seed = secrets.token_hex(16)
        
        # Selección pseudoaleatoria mejorada
        import random
        import hashlib
        
        # Crear semilla basada en datos de la ruleta y timestamp
        seed_data = f"{roulette.id}-{timezone.now().isoformat()}-{seed}"
        hash_seed = hashlib.sha256(seed_data.encode()).hexdigest()
        random.seed(hash_seed[:8])  # Usar solo los primeros 8 caracteres
        
        # Seleccionar ganador
        winner = random.choice(participants_list)

        # Marcar ganador en la participación
        winner.is_winner = True
        if hasattr(winner, 'won_at'):
            winner.won_at = timezone.now()
            winner.save(update_fields=['is_winner', 'won_at'])
        else:
            winner.save(update_fields=['is_winner'])

        # Actualizar ruleta
        roulette.winner = winner
        roulette.drawn_at = timezone.now()
        roulette.drawn_by = admin_user
        roulette.status = RouletteStatus.COMPLETED
        roulette.is_drawn = True
        roulette.save(update_fields=[
            'winner', 'drawn_at', 'drawn_by', 'status', 'is_drawn'
        ])

        # Crear registro en historial
        draw_history = DrawHistory.objects.create(
            roulette=roulette,
            winner_selected=winner,
            drawn_by=admin_user,
            draw_type=draw_type,
            drawn_at=roulette.drawn_at,
            participants_count=count,
            random_seed=hash_seed
        )

        return {
            'success': True,
            'message': 'Sorteo ejecutado exitosamente',
            'winner': winner,
            'winner_data': {
                'id': winner.id,
                'name': winner.user.get_full_name() or winner.user.username,
                'email': winner.user.email,
                'participant_number': winner.participant_number
            },
            'draw_history_id': draw_history.id,
            'participants_count': count,
            'seed': hash_seed
        }

    except Exception as e:
        return {
            'success': False,
            'message': f'Error ejecutando el sorteo: {str(e)}',
            'error_code': 'EXECUTION_ERROR',
            'error_details': str(e)
        }


def can_user_draw_roulette(user, roulette: Roulette):
    """
    Verifica si un usuario puede ejecutar el sorteo de una ruleta.
    
    Returns:
        tuple: (puede_sortear: bool, razon: str)
    """
    # Verificar permisos de usuario
    if not (user.is_staff or user.is_superuser or getattr(user, "user_type", "") == "admin"):
        return False, "No tienes permisos para ejecutar sorteos"
    
    # Verificar estado de la ruleta
    if not roulette.can_be_drawn_manually:
        if roulette.is_drawn:
            return False, "La ruleta ya fue sorteada"
        elif roulette.status not in [RouletteStatus.ACTIVE, RouletteStatus.SCHEDULED]:
            return False, "La ruleta no está disponible para sorteo"
        else:
            return False, "No hay participantes para sortear"
    
    return True, "OK"


def get_roulette_statistics(roulette: Roulette):
    """
    Obtiene estadísticas detalladas de una ruleta.
    
    Returns:
        dict: Estadísticas de la ruleta
    """
    participants = roulette.participations.select_related('user')
    participants_count = participants.count()
    
    # Estadísticas básicas
    stats = {
        'roulette_info': {
            'id': roulette.id,
            'name': roulette.name,
            'slug': roulette.slug,
            'status': roulette.status,
            'is_drawn': roulette.is_drawn,
            'created_at': roulette.created_at,
            'participation_start': roulette.participation_start,
            'participation_end': roulette.participation_end,
            'scheduled_date': roulette.scheduled_date,
            'drawn_at': roulette.drawn_at,
        },
        'participants': {
            'total_count': participants_count,
            'max_allowed': getattr(roulette.settings, 'max_participants', 0) if hasattr(roulette, 'settings') else 0,
            'allow_multiple': getattr(roulette.settings, 'allow_multiple_entries', False) if hasattr(roulette, 'settings') else False,
        },
        'winner_info': None,
        'prizes_info': {
            'total_prizes': roulette.prizes.count(),
            'active_prizes': roulette.prizes.filter(is_active=True).count(),
            'total_stock': sum([prize.stock for prize in roulette.prizes.filter(is_active=True)]),
        }
    }
    
    # Información del ganador si existe
    if roulette.winner:
        stats['winner_info'] = {
            'id': roulette.winner.id,
            'name': roulette.winner.user.get_full_name() or roulette.winner.user.username,
            'email': roulette.winner.user.email,
            'participant_number': roulette.winner.participant_number,
            'won_at': getattr(roulette.winner, 'won_at', roulette.drawn_at),
        }
    
    # Estadísticas de participación por fecha (últimos 30 días)
    if participants_count > 0:
        from datetime import timedelta
        
        thirty_days_ago = timezone.now() - timedelta(days=30)
        recent_participants = participants.filter(created_at__gte=thirty_days_ago)
        
        stats['participation_trends'] = {
            'recent_participants': recent_participants.count(),
            'participation_rate': round((recent_participants.count() / participants_count) * 100, 2) if participants_count > 0 else 0
        }
    
    return stats


def cleanup_old_draw_history(days_old=90):
    """
    Limpia registros antiguos del historial de sorteos.
    
    Args:
        days_old: Días de antigüedad para considerar "viejo"
    
    Returns:
        int: Número de registros eliminados
    """
    from datetime import timedelta
    
    cutoff_date = timezone.now() - timedelta(days=days_old)
    old_records = DrawHistory.objects.filter(drawn_at__lt=cutoff_date)
    count = old_records.count()
    old_records.delete()
    
    return count


def calculate_time_remaining(target_datetime):
    """
    Calcula el tiempo restante hasta una fecha específica.
    
    Args:
        target_datetime: Fecha objetivo
    
    Returns:
        dict: Diccionario con días, horas, minutos y segundos restantes
    """
    if not target_datetime:
        return None
    
    now = timezone.now()
    if now >= target_datetime:
        return {
            'expired': True,
            'total_seconds': 0,
            'days': 0,
            'hours': 0,
            'minutes': 0,
            'seconds': 0
        }
    
    diff = target_datetime - now
    total_seconds = int(diff.total_seconds())
    days = diff.days
    hours = diff.seconds // 3600
    minutes = (diff.seconds % 3600) // 60
    seconds = diff.seconds % 60
    
    return {
        'expired': False,
        'total_seconds': total_seconds,
        'days': days,
        'hours': hours,
        'minutes': minutes,
        'seconds': seconds,
        'formatted': f"{days}d {hours:02d}h {minutes:02d}m {seconds:02d}s" if days > 0 else f"{hours:02d}h {minutes:02d}m {seconds:02d}s"
    }


def get_roulette_countdown_info(roulette: Roulette):
    """
    Obtiene información de cronómetro para una ruleta.
    
    Args:
        roulette: Instancia de Roulette
    
    Returns:
        dict: Información de cronómetros para diferentes eventos
    """
    now = timezone.now()
    countdown_info = {}
    
    # Cronómetro para inicio de participación
    if roulette.participation_start and now < roulette.participation_start:
        countdown_info['participation_start'] = {
            'label': 'Inicio de participación',
            'target_date': roulette.participation_start,
            'countdown': calculate_time_remaining(roulette.participation_start)
        }
    
    # Cronómetro para fin de participación
    if roulette.participation_end and now < roulette.participation_end and roulette.participation_is_open:
        countdown_info['participation_end'] = {
            'label': 'Fin de participación',
            'target_date': roulette.participation_end,
            'countdown': calculate_time_remaining(roulette.participation_end)
        }
    
    # Cronómetro para sorteo programado
    if roulette.scheduled_date and now < roulette.scheduled_date and not roulette.is_drawn:
        countdown_info['scheduled_draw'] = {
            'label': 'Sorteo programado',
            'target_date': roulette.scheduled_date,
            'countdown': calculate_time_remaining(roulette.scheduled_date)
        }
    
    return countdown_info


def auto_draw_scheduled_roulettes():
    """
    Función para ejecutar sorteos automáticos de ruletas programadas.
    Esta función se puede ejecutar periódicamente con Celery o cron.
    
    Returns:
        dict: Resumen de la ejecución
    """
    from django.contrib.auth import get_user_model
    
    User = get_user_model()
    now = timezone.now()
    
    # Buscar ruletas listas para sorteo automático
    scheduled_roulettes = Roulette.objects.filter(
        scheduled_date__lte=now,
        is_drawn=False,
        status__in=[RouletteStatus.ACTIVE, RouletteStatus.SCHEDULED],
        participations__isnull=False
    ).distinct()
    
    results = {
        'processed': 0,
        'successful': 0,
        'failed': 0,
        'details': []
    }
    
    # Usuario del sistema para sorteos automáticos
    try:
        system_user = User.objects.filter(is_superuser=True).first()
    except:
        system_user = None
    
    for roulette in scheduled_roulettes:
        results['processed'] += 1
        
        try:
            result = execute_roulette_draw(
                roulette=roulette,
                admin_user=system_user,
                draw_type='scheduled'
            )
            
            if result['success']:
                results['successful'] += 1
                results['details'].append({
                    'roulette_id': roulette.id,
                    'name': roulette.name,
                    'status': 'success',
                    'winner': result['winner_data']['name']
                })
            else:
                results['failed'] += 1
                results['details'].append({
                    'roulette_id': roulette.id,
                    'name': roulette.name,
                    'status': 'failed',
                    'error': result['message']
                })
                
        except Exception as e:
            results['failed'] += 1
            results['details'].append({
                'roulette_id': roulette.id,
                'name': roulette.name,
                'status': 'error',
                'error': str(e)
            })
    
    return results


def validate_roulette_prizes(roulette: Roulette):
    """
    Valida que los premios de una ruleta estén configurados correctamente.
    
    Args:
        roulette: Instancia de Roulette
    
    Returns:
        dict: Resultado de la validación
    """
    prizes = roulette.prizes.filter(is_active=True)
    issues = []
    warnings = []
    
    if not prizes.exists():
        issues.append("La ruleta no tiene premios activos")
    
    total_probability = sum([prize.probability for prize in prizes if prize.probability > 0])
    if total_probability > 100:
        issues.append(f"La suma de probabilidades ({total_probability}%) excede el 100%")
    elif total_probability > 0 and total_probability < 100:
        warnings.append(f"La suma de probabilidades ({total_probability}%) es menor al 100%")
    
    # Verificar stock
    zero_stock_prizes = prizes.filter(stock=0)
    if zero_stock_prizes.exists():
        warnings.append(f"{zero_stock_prizes.count()} premio(s) sin stock disponible")
    
    return {
        'valid': len(issues) == 0,
        'issues': issues,
        'warnings': warnings,
        'total_prizes': prizes.count(),
        'total_probability': total_probability,
        'total_stock': sum([prize.stock for prize in prizes])
    }