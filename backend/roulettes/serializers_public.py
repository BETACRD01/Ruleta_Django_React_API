from __future__ import annotations

from typing import Any, Dict, Optional
from django.utils import timezone
from rest_framework import serializers

from .models import DrawHistory, Roulette, RouletteStatus


class PublicDrawHistorySerializer(serializers.ModelSerializer):
    """
    Serializer PÚBLICO para el historial de sorteos.
    Solo expone información segura y pública de los ganadores.
    """
    roulette_name = serializers.SerializerMethodField()
    winner_name = serializers.SerializerMethodField()
    draw_date = serializers.SerializerMethodField()
    participants_count = serializers.IntegerField(read_only=True)
    
    class Meta:
        model = DrawHistory
        fields = [
            "id",
            "roulette_name", 
            "winner_name",
            "draw_date",
            "participants_count",
            "draw_type",
        ]
        
    def get_roulette_name(self, obj) -> str:
        """Obtiene el nombre de la ruleta de forma segura."""
        if hasattr(obj, 'roulette') and obj.roulette:
            return getattr(obj.roulette, 'name', '') or f"Ruleta #{obj.roulette.id}"
        return "Ruleta no disponible"
        
    def get_winner_name(self, obj) -> str:
        """
        Obtiene el nombre del ganador de forma segura.
        Solo expone nombre completo o username, nunca email u otra info sensible.
        """
        try:
            if hasattr(obj, 'winner_selected') and obj.winner_selected:
                user = obj.winner_selected.user
                if user:
                    # Priorizar nombre completo
                    full_name = user.get_full_name() if hasattr(user, 'get_full_name') else None
                    if full_name and full_name.strip():
                        return full_name.strip()
                    
                    # Fallback a username
                    username = getattr(user, 'username', '')
                    if username:
                        return username
                        
            return "Usuario anónimo"
            
        except Exception:
            return "Usuario anónimo"
    
    def get_draw_date(self, obj) -> Optional[str]:
        """Obtiene la fecha del sorteo en formato ISO."""
        try:
            if hasattr(obj, 'drawn_at') and obj.drawn_at:
                return obj.drawn_at.isoformat()
            return None
        except Exception:
            return None


class PublicRouletteListSerializer(serializers.ModelSerializer):
    """
    Serializer PÚBLICO para listar ruletas.
    Solo expone información básica y segura.
    """
    name = serializers.CharField(read_only=True)
    status_display = serializers.SerializerMethodField()
    participants_count = serializers.SerializerMethodField()
    prizes_count = serializers.SerializerMethodField()
    time_remaining = serializers.SerializerMethodField()
    participation_is_open = serializers.SerializerMethodField()
    cover_image_url = serializers.SerializerMethodField()
    
    class Meta:
        model = Roulette
        fields = [
            "id",
            "name", 
            "slug",
            "description",
            "status",
            "status_display",
            "participants_count",
            "prizes_count", 
            "participation_start",
            "participation_end",
            "scheduled_date",
            "time_remaining",
            "participation_is_open",
            "cover_image_url",
            "created_at",
        ]
        
    def get_status_display(self, obj) -> str:
        """Obtiene el display del status de forma segura."""
        try:
            return obj.get_status_display() if hasattr(obj, 'get_status_display') else obj.status
        except Exception:
            return "Estado no disponible"
    
    def get_participants_count(self, obj) -> int:
        """Cuenta los participantes de forma segura."""
        try:
            if hasattr(obj, 'get_participants_count'):
                return obj.get_participants_count()
            elif hasattr(obj, 'participations'):
                return obj.participations.count()
            return 0
        except Exception:
            return 0
    
    def get_prizes_count(self, obj) -> int:
        """Cuenta los premios disponibles de forma segura."""
        try:
            if hasattr(obj, 'prizes'):
                return obj.prizes.filter(is_active=True, stock__gt=0).count()
            return 0
        except Exception:
            return 0
    
    def get_participation_is_open(self, obj) -> bool:
        """Verifica si la participación está abierta."""
        try:
            # Verificar estado
            if obj.status not in [RouletteStatus.ACTIVE, RouletteStatus.SCHEDULED]:
                return False
            
            if getattr(obj, 'is_drawn', False):
                return False
                
            now = timezone.now()
            
            # Verificar fecha de inicio
            if obj.participation_start and now < obj.participation_start:
                return False
                
            # Verificar fecha de fin
            if obj.participation_end and now > obj.participation_end:
                return False
                
            return True
            
        except Exception:
            return False
    
    def get_time_remaining(self, obj) -> Optional[Dict[str, Any]]:
        """Calcula tiempo restante para diferentes eventos."""
        try:
            now = timezone.now()
            result = {}
            
            # Tiempo hasta inicio de participación
            if obj.participation_start and now < obj.participation_start:
                diff = obj.participation_start - now
                result["until_participation_start"] = {
                    "total_seconds": int(diff.total_seconds()),
                    "days": diff.days,
                    "hours": diff.seconds // 3600,
                    "minutes": (diff.seconds % 3600) // 60,
                }
            
            # Tiempo hasta fin de participación
            if obj.participation_end and now < obj.participation_end:
                diff = obj.participation_end - now
                result["until_participation_end"] = {
                    "total_seconds": int(diff.total_seconds()),
                    "days": diff.days,
                    "hours": diff.seconds // 3600,
                    "minutes": (diff.seconds % 3600) // 60,
                }
            
            # Tiempo hasta sorteo programado
            if obj.scheduled_date and now < obj.scheduled_date and not getattr(obj, 'is_drawn', False):
                diff = obj.scheduled_date - now
                result["until_draw"] = {
                    "total_seconds": int(diff.total_seconds()),
                    "days": diff.days,
                    "hours": diff.seconds // 3600,
                    "minutes": (diff.seconds % 3600) // 60,
                }
                
            return result if result else None
            
        except Exception:
            return None
    
    def get_cover_image_url(self, obj) -> Optional[str]:
        """Obtiene URL de imagen de portada de forma segura."""
        try:
            if hasattr(obj, 'cover_image') and obj.cover_image:
                request = self.context.get('request')
                if request and hasattr(obj.cover_image, 'url'):
                    return request.build_absolute_uri(obj.cover_image.url)
                elif hasattr(obj.cover_image, 'url'):
                    return obj.cover_image.url
            return None
        except Exception:
            return None


class PublicRouletteDetailSerializer(serializers.ModelSerializer):
    """
    Serializer PÚBLICO para detalle de ruleta.
    Incluye más información pero mantiene la seguridad.
    """
    name = serializers.CharField(read_only=True)
    status_display = serializers.SerializerMethodField()
    participants_count = serializers.SerializerMethodField()
    prizes = serializers.SerializerMethodField()
    settings = serializers.SerializerMethodField()
    time_remaining = serializers.SerializerMethodField()
    participation_is_open = serializers.SerializerMethodField()
    cover_image_url = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    
    class Meta:
        model = Roulette
        fields = [
            "id",
            "name",
            "slug", 
            "description",
            "status",
            "status_display",
            "participants_count",
            "prizes",
            "settings",
            "participation_start",
            "participation_end", 
            "scheduled_date",
            "time_remaining",
            "participation_is_open",
            "cover_image_url",
            "created_by_name",
            "created_at",
        ]
    
    def get_status_display(self, obj) -> str:
        try:
            return obj.get_status_display() if hasattr(obj, 'get_status_display') else obj.status
        except Exception:
            return "Estado no disponible"
    
    def get_participants_count(self, obj) -> int:
        try:
            if hasattr(obj, 'get_participants_count'):
                return obj.get_participants_count()
            elif hasattr(obj, 'participations'):
                return obj.participations.count()
            return 0
        except Exception:
            return 0
    
    def get_prizes(self, obj) -> list:
        """Obtiene información básica de premios sin datos sensibles."""
        try:
            if hasattr(obj, 'prizes'):
                prizes_data = []
                for prize in obj.prizes.filter(is_active=True).order_by('display_order'):
                    prize_info = {
                        "id": prize.id,
                        "name": prize.name,
                        "description": prize.description or "",
                        "is_available": getattr(prize, 'stock', 1) > 0,
                        "display_order": prize.display_order,
                    }
                    
                    # Imagen del premio
                    if hasattr(prize, 'image') and prize.image:
                        try:
                            request = self.context.get('request')
                            if request and hasattr(prize.image, 'url'):
                                prize_info["image_url"] = request.build_absolute_uri(prize.image.url)
                            elif hasattr(prize.image, 'url'):
                                prize_info["image_url"] = prize.image.url
                        except Exception:
                            prize_info["image_url"] = None
                    else:
                        prize_info["image_url"] = None
                    
                    prizes_data.append(prize_info)
                
                return prizes_data
            return []
        except Exception:
            return []
    
    def get_settings(self, obj) -> Dict[str, Any]:
        """Obtiene configuraciones públicas de la ruleta."""
        try:
            if hasattr(obj, 'settings') and obj.settings:
                settings = obj.settings
                return {
                    "max_participants": getattr(settings, 'max_participants', 0),
                    "allow_multiple_entries": getattr(settings, 'allow_multiple_entries', False),
                    "show_countdown": getattr(settings, 'show_countdown', True),
                }
            return {
                "max_participants": 0,
                "allow_multiple_entries": False, 
                "show_countdown": True,
            }
        except Exception:
            return {
                "max_participants": 0,
                "allow_multiple_entries": False,
                "show_countdown": True,
            }
    
    def get_participation_is_open(self, obj) -> bool:
        try:
            if obj.status not in [RouletteStatus.ACTIVE, RouletteStatus.SCHEDULED]:
                return False
            
            if getattr(obj, 'is_drawn', False):
                return False
                
            now = timezone.now()
            
            if obj.participation_start and now < obj.participation_start:
                return False
                
            if obj.participation_end and now > obj.participation_end:
                return False
                
            return True
        except Exception:
            return False
    
    def get_time_remaining(self, obj) -> Optional[Dict[str, Any]]:
        try:
            now = timezone.now()
            result = {}
            
            if obj.participation_start and now < obj.participation_start:
                diff = obj.participation_start - now
                result["until_participation_start"] = {
                    "total_seconds": int(diff.total_seconds()),
                    "days": diff.days,
                    "hours": diff.seconds // 3600,
                    "minutes": (diff.seconds % 3600) // 60,
                }
            
            if obj.participation_end and now < obj.participation_end:
                diff = obj.participation_end - now
                result["until_participation_end"] = {
                    "total_seconds": int(diff.total_seconds()),
                    "days": diff.days,
                    "hours": diff.seconds // 3600,
                    "minutes": (diff.seconds % 3600) // 60,
                }
            
            if obj.scheduled_date and now < obj.scheduled_date and not getattr(obj, 'is_drawn', False):
                diff = obj.scheduled_date - now
                result["until_draw"] = {
                    "total_seconds": int(diff.total_seconds()),
                    "days": diff.days,
                    "hours": diff.seconds // 3600,
                    "minutes": (diff.seconds % 3600) // 60,
                }
                
            return result if result else None
        except Exception:
            return None
    
    def get_cover_image_url(self, obj) -> Optional[str]:
        try:
            if hasattr(obj, 'cover_image') and obj.cover_image:
                request = self.context.get('request')
                if request and hasattr(obj.cover_image, 'url'):
                    return request.build_absolute_uri(obj.cover_image.url)
                elif hasattr(obj.cover_image, 'url'):
                    return obj.cover_image.url
            return None
        except Exception:
            return None
    
    def get_created_by_name(self, obj) -> Optional[str]:
        """Obtiene el nombre del creador si está disponible públicamente."""
        try:
            if hasattr(obj, 'created_by') and obj.created_by:
                user = obj.created_by
                full_name = user.get_full_name() if hasattr(user, 'get_full_name') else None
                if full_name and full_name.strip():
                    return full_name.strip()
                return getattr(user, 'username', 'Usuario anónimo')
            return 'Usuario anónimo'
        except Exception:
            return 'Usuario anónimo'


class PublicMetricsSerializer(serializers.Serializer):
    """
    Serializer para métricas públicas del sistema.
    """
    roulettes_total = serializers.IntegerField(read_only=True)
    active_roulettes = serializers.IntegerField(read_only=True)
    winners_total = serializers.IntegerField(read_only=True)
    participants_total = serializers.IntegerField(read_only=True, required=False)
    server_time = serializers.DateTimeField(read_only=True)
    
    def validate(self, attrs):
        # Asegurar que todos los valores sean no negativos
        for field_name, value in attrs.items():
            if field_name != 'server_time' and isinstance(value, int) and value < 0:
                attrs[field_name] = 0
        return attrs