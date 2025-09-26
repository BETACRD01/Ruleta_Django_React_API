from __future__ import annotations

import hashlib
import random
import secrets
from typing import Any, Dict, Optional, Tuple

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Count, Sum
from django.utils import timezone

from .models import (
    DrawHistory,
    Roulette,
    RouletteStatus,
    RoulettePrize,
    RouletteSettings,
)
from participants.models import Participation

# Servicio de notificaciones (defensivo)
try:
    from notifications.services import NotificationService  # type: ignore
except Exception:
    NotificationService = None  # type: ignore


# ============================================================
# Validaciones de participación
# ============================================================

def validate_roulette_participation(roulette: Roulette, user) -> None:
    if roulette.is_drawn or roulette.status == RouletteStatus.COMPLETED:
        raise ValidationError("La ruleta ya fue sorteada.")
    if roulette.status != RouletteStatus.ACTIVE:
        raise ValidationError("La ruleta no está activa.")

    settings = getattr(roulette, "settings", None)
    if settings is None:
        raise ValidationError("Configuración de ruleta faltante.")

    if settings.max_participants and settings.max_participants > 0:
        try:
            current_count = roulette.get_participants_count()
        except AttributeError:
            current_count = Participation.objects.filter(
                roulette_id=roulette.id
            ).only("id").count()
        if current_count >= settings.max_participants:
            raise ValidationError("Se alcanzó el límite de participantes.")

    if not settings.allow_multiple_entries:
        if Participation.objects.filter(
            roulette_id=roulette.id, user_id=user.id
        ).only("id").exists():
            raise ValidationError("Ya participaste en esta ruleta.")

    now = timezone.now()
    if roulette.participation_start and now < roulette.participation_start:
        raise ValidationError(
            f'La participación inicia el {roulette.participation_start.strftime("%d/%m/%Y %H:%M")}.'
        )
    if roulette.participation_end and now > roulette.participation_end:
        raise ValidationError("El período de participación ha terminado.")


# ============================================================
# Ejecución del sorteo (sin cierre anticipado)
# ============================================================

@transaction.atomic
def execute_roulette_draw(roulette: Roulette, admin_user, draw_type: str = "manual") -> Dict[str, Any]:
    """
    Ejecuta un sorteo:
    - Selecciona un participante que todavía NO ha ganado.
    - Asigna un premio disponible (stock>0, activo) y descuenta stock.
    - Notifica (si está habilitado).
    - NO cierra anticipado: el cierre se decide en reconcile_completion() según
      meta fija o stock restante.
    """
    roulette = (
        Roulette.objects.select_for_update()
        .only("id", "status", "is_drawn", "name", "drawn_at", "drawn_by_id", "winner_id")
        .get(pk=roulette.pk)
    )

    if roulette.is_drawn or roulette.status == RouletteStatus.COMPLETED:
        return {"success": False, "message": "La ruleta ya fue sorteada.", "error_code": "ALREADY_DRAWN"}

    if roulette.status not in (RouletteStatus.ACTIVE, RouletteStatus.SCHEDULED):
        return {"success": False, "message": "La ruleta no está disponible para sorteo.", "error_code": "NOT_AVAILABLE"}

    participants_qs = (
        Participation.objects.select_for_update()
        .select_related("user")
        .filter(roulette_id=roulette.id, is_winner=False)
        .order_by("participant_number")
    )
    participants_list = list(participants_qs)
    count = len(participants_list)

    if count == 0:
        roulette.reconcile_completion(by_user=admin_user)
        return {"success": False, "message": "No quedan participantes elegibles para ganar.", "error_code": "NO_ELIGIBLES"}

    now_iso = timezone.now().isoformat()
    nonce = secrets.token_hex(8)
    seed_data = f"{roulette.id}|{count}|{now_iso}|{nonce}"
    hash_seed = hashlib.sha256(seed_data.encode("utf-8")).hexdigest()

    rnd = random.Random(int(hash_seed[:16], 16))
    winner = rnd.choice(participants_list)

    winner.is_winner = True
    if hasattr(winner, "won_at"):
        winner.won_at = timezone.now()
        winner.save(update_fields=["is_winner", "won_at"])
    else:
        winner.save(update_fields=["is_winner"])

    if not roulette.winner_id:
        roulette.winner = winner

    prize: Optional[RoulettePrize] = (
        RoulettePrize.objects.select_for_update()
        .filter(roulette=roulette, is_active=True, stock__gt=0)
        .order_by("display_order", "id")
        .first()
    )

    if prize:
        new_stock = int(prize.stock) - 1
        prize.stock = new_stock if new_stock >= 0 else 0
        if prize.stock <= 0 and prize.is_active:
            prize.is_active = False
        prize.save(update_fields=["stock", "is_active"])

    roulette.drawn_by = admin_user
    roulette.drawn_at = roulette.drawn_at or timezone.now()

    # Si estaba programada, activarla mientras se pueda seguir sorteando
    settings = getattr(roulette, "settings", None)
    winners_now = roulette.participations.filter(is_winner=True).count()
    if roulette.winner_id and not roulette.participations.filter(pk=roulette.winner_id, is_winner=True).exists():
        winners_now += 1

    if roulette.status == RouletteStatus.SCHEDULED:
        should_activate = False
        if settings and settings.winners_target and settings.winners_target > 0:
            should_activate = winners_now < settings.winners_target
        else:
            should_activate = roulette.available_awards_count() > 0
        if should_activate:
            roulette.status = RouletteStatus.ACTIVE

    roulette.save(update_fields=["winner", "drawn_at", "drawn_by", "status", "is_drawn"])

    draw_history = DrawHistory.objects.create(
        roulette=roulette,
        winner_selected=winner,
        drawn_by=admin_user,
        draw_type=draw_type,
        drawn_at=roulette.drawn_at,
        participants_count=roulette.participations.count(),
        random_seed=hash_seed,
    )

    # Notificaciones
    try:
        notify_flag = True
        if settings:
            notify_flag = bool(settings.notify_on_draw)
        if notify_flag and NotificationService:
            prize_details = ""
            if prize:
                desc = (prize.description or "").strip()
                prize_details = f"Premio: {prize.name}" + (f". {desc}" if desc else "")
            NotificationService.create_winner_announcement(
                winner_user=winner.user,
                roulette_name=roulette.name,
                roulette_id=roulette.id,
                total_participants=draw_history.participants_count,
                prize_details=prize_details,
            )
    except Exception:
        import logging
        logging.getLogger(__name__).warning("Fallo al enviar notificaciones de ganador", exc_info=True)

    roulette.reconcile_completion(by_user=admin_user)

    return {
        "success": True,
        "message": "Sorteo ejecutado exitosamente",
        "winner": winner,
        "winner_data": {
            "id": winner.id,
            "name": winner.user.get_full_name() or winner.user.username,
            "email": winner.user.email,
            "participant_number": winner.participant_number,
        },
        "prize": prize,
        "draw_history": draw_history,
        "draw_history_id": draw_history.id,
        "participants_count": roulette.participations.count(),
        "seed": hash_seed,
        "roulette": {"id": roulette.id, "name": roulette.name, "is_drawn": roulette.is_drawn, "status": roulette.status},
    }


# ============================================================
# Permisos / Stats / Limpieza / Countdown / Auto-draw / Validación premios
# (sin cambios funcionales relevantes a la corrección)
# ============================================================

def can_user_draw_roulette(user, roulette: Roulette) -> Tuple[bool, str]:
    if not (getattr(user, "is_staff", False) or getattr(user, "is_superuser", False) or getattr(user, "user_type", "") == "admin"):
        return False, "No tienes permisos para ejecutar sorteos"

    can_be_drawn_manually = getattr(roulette, "can_be_drawn_manually", None)
    if callable(can_be_drawn_manually):
        allowed = roulette.can_be_drawn_manually()
    else:
        allowed = bool(can_be_drawn_manually)

    if not allowed:
        if roulette.is_drawn:
            return False, "La ruleta ya fue sorteada"
        if roulette.status not in (RouletteStatus.ACTIVE, RouletteStatus.SCHEDULED):
            return False, "La ruleta no está disponible para sorteo"
        return False, "No hay participantes para sortear"

    return True, "OK"


def get_roulette_statistics(roulette: Roulette) -> Dict[str, Any]:
    participants_qs = Participation.objects.filter(roulette_id=roulette.id)
    participants_count = participants_qs.only("id").count()

    prizes_qs = roulette.prizes
    agg = prizes_qs.filter(is_active=True).aggregate(
        total_stock=Sum("stock"),
        active_prizes=Count("id"),
    )
    total_stock = agg.get("total_stock") or 0
    active_prizes = agg.get("active_prizes") or 0

    stats: Dict[str, Any] = {
        "roulette_info": {
            "id": roulette.id,
            "name": roulette.name,
            "slug": roulette.slug,
            "status": roulette.status,
            "is_drawn": roulette.is_drawn,
            "created_at": roulette.created_at,
            "participation_start": roulette.participation_start,
            "participation_end": roulette.participation_end,
            "scheduled_date": roulette.scheduled_date,
            "drawn_at": roulette.drawn_at,
        },
        "participants": {
            "total_count": participants_count,
            "max_allowed": getattr(getattr(roulette, "settings", None), "max_participants", 0),
            "allow_multiple": getattr(getattr(roulette, "settings", None), "allow_multiple_entries", False),
        },
        "winner_info": None,
        "prizes_info": {
            "total_prizes": prizes_qs.only("id").count(),
            "active_prizes": active_prizes,
            "total_stock": int(total_stock),
        },
    }

    if roulette.winner_id:
        w = roulette.winner
        stats["winner_info"] = {
            "id": w.id,
            "name": w.user.get_full_name() or w.user.username,
            "email": w.user.email,
            "participant_number": w.participant_number,
            "won_at": getattr(w, "won_at", roulette.drawn_at),
        }

    if participants_count:
        from datetime import timedelta

        since = timezone.now() - timedelta(days=30)
        recent_count = participants_qs.filter(created_at__gte=since).only("id").count()
        stats["participation_trends"] = {
            "recent_participants": recent_count,
            "participation_rate": round((recent_count / participants_count) * 100, 2) if participants_count else 0.0,
        }

    return stats


def cleanup_old_draw_history(days_old: int = 90) -> int:
    from datetime import timedelta

    cutoff = timezone.now() - timedelta(days=days_old)
    qs = DrawHistory.objects.filter(drawn_at__lt=cutoff)
    deleted, _ = qs.delete()
    return int(deleted)


def calculate_time_remaining(target_datetime) -> Optional[Dict[str, Any]]:
    if not target_datetime:
        return None

    now = timezone.now()
    if now >= target_datetime:
        return {"expired": True, "total_seconds": 0, "days": 0, "hours": 0, "minutes": 0, "seconds": 0}

    diff = target_datetime - now
    total_seconds = int(diff.total_seconds())

    days, rem = divmod(total_seconds, 86400)
    hours, rem = divmod(rem, 3600)
    minutes, seconds = divmod(rem, 60)

    formatted = f"{days}d {hours:02d}h {minutes:02d}m {seconds:02d}s" if days > 0 else f"{hours:02d}h {minutes:02d}m {seconds:02d}s"

    return {
        "expired": False,
        "total_seconds": total_seconds,
        "days": days,
        "hours": hours,
        "minutes": minutes,
        "seconds": seconds,
        "formatted": formatted,
    }


def get_roulette_countdown_info(roulette: Roulette) -> Dict[str, Any]:
    now = timezone.now()
    info: Dict[str, Any] = {}

    if roulette.participation_start and now < roulette.participation_start:
        info["participation_start"] = {
            "label": "Inicio de participación",
            "target_date": roulette.participation_start,
            "countdown": calculate_time_remaining(roulette.participation_start),
        }

    if roulette.participation_end and now < roulette.participation_end and getattr(roulette, "participation_is_open", False):
        info["participation_end"] = {
            "label": "Fin de participación",
            "target_date": roulette.participation_end,
            "countdown": calculate_time_remaining(roulette.participation_end),
        }

    if roulette.scheduled_date and now < roulette.scheduled_date and not roulette.is_drawn:
        info["scheduled_draw"] = {
            "label": "Sorteo programado",
            "target_date": roulette.scheduled_date,
            "countdown": calculate_time_remaining(roulette.scheduled_date),
        }

    return info


def auto_draw_scheduled_roulettes() -> Dict[str, Any]:
    from django.contrib.auth import get_user_model

    User = get_user_model()
    now = timezone.now()

    scheduled_qs = (
        Roulette.objects.filter(
            scheduled_date__lte=now,
            is_drawn=False,
            status__in=(RouletteStatus.ACTIVE, RouletteStatus.SCHEDULED),
        )
        .annotate(pcount=Count("participations"))
        .filter(pcount__gt=0)
        .only("id", "name", "status", "is_drawn", "scheduled_date")
    )

    results: Dict[str, Any] = {"processed": 0, "successful": 0, "failed": 0, "details": []}

    system_user = User.objects.filter(is_superuser=True).only("id").first()

    for r in scheduled_qs:
        results["processed"] += 1
        try:
            res = execute_roulette_draw(roulette=r, admin_user=system_user, draw_type="scheduled")
            if res.get("success"):
                results["successful"] += 1
                results["details"].append(
                    {"roulette_id": r.id, "name": r.name, "status": "success", "winner": res["winner_data"]["name"]}
                )
            else:
                results["failed"] += 1
                results["details"].append(
                    {"roulette_id": r.id, "name": r.name, "status": "failed", "error": res.get("message")}
                )
        except Exception as exc:
            results["failed"] += 1
            results["details"].append({"roulette_id": r.id, "name": r.name, "status": "error", "error": str(exc)})

    return results


def validate_roulette_prizes(roulette: Roulette) -> Dict[str, Any]:
    prizes_qs = roulette.prizes.filter(is_active=True)
    counts = prizes_qs.aggregate(
        total_prizes=Count("id"),
        total_stock=Sum("stock"),
    )
    total_prizes = counts.get("total_prizes") or 0
    total_stock = int(counts.get("total_stock") or 0)

    issues = []
    warnings = []

    if total_prizes == 0:
        issues.append("La ruleta no tiene premios activos")

    zero_stock_count = prizes_qs.filter(stock=0).only("id").count()
    if zero_stock_count > 0:
        warnings.append(f"{zero_stock_count} premio(s) sin stock disponible")

    return {
        "valid": len(issues) == 0,
        "issues": issues,
        "warnings": warnings,
        "total_prizes": total_prizes,
        "total_stock": total_stock,
    }
