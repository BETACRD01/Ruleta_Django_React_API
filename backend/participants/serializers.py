# participants/serializers.py

from rest_framework import serializers
import logging
import os

from .models import Participation

logger = logging.getLogger(__name__)


# ============================================================================
# UTILIDADES
# ============================================================================

def _abs_url(request, file_field):
    """
    Construye URL absoluta para un FileField/ImageField.
    
    Argumentos:
    - request: objeto HttpRequest (puede ser None)
    - file_field: FileField o ImageField del modelo
    
    Retorna:
    - URL absoluta si existe archivo, None en caso contrario
    """
    if not file_field:
        return None
    try:
        url = file_field.url
    except Exception:
        return None
    if not url:
        return None
    return request.build_absolute_uri(url) if request else url


# ============================================================================
# SERIALIZERS PRINCIPALES
# ============================================================================

class ParticipationSerializer(serializers.ModelSerializer):
    """
    Serializer principal para crear y recuperar participaciones.
    
    Validaciones dinámicas según configuración de ruleta:
    - Si require_receipt=True, comprobante es obligatorio
    - Si require_receipt=False, comprobante es opcional
    
    Campos read_only (solo lectura):
    - user: Siempre el usuario autenticado, asignado por la vista
    - participant_number, created_at, is_winner, won_prize, won_at
    
    Campos writable (escritura):
    - roulette, receipt
    """
    
    # Campos derivados (lectura solamente)
    user_name = serializers.CharField(source="user.get_full_name", read_only=True)
    user_username = serializers.CharField(source="user.username", read_only=True)
    roulette_name = serializers.CharField(source="roulette.name", read_only=True)
    receipt_filename = serializers.CharField(read_only=True)
    receipt_size = serializers.IntegerField(read_only=True)
    receipt_extension = serializers.CharField(read_only=True)
    
    # Campos del premio ganado
    prize_name = serializers.SerializerMethodField()
    prize_image_url = serializers.SerializerMethodField()
    prize_description = serializers.SerializerMethodField()
    won_at = serializers.DateTimeField(read_only=True)

    class Meta:
        model = Participation
        fields = [
            # Identificadores
            "id",
            "user",
            "user_name",
            "user_username",
            "roulette",
            "roulette_name",
            
            # Comprobante
            "receipt",
            "receipt_filename",
            "receipt_size",
            "receipt_extension",
            
            # Participación
            "participant_number",
            "created_at",
            "is_winner",
            
            # Premio ganado
            "won_prize",
            "prize_position",
            "prize_name",
            "prize_image_url",
            "prize_description",
            "won_at",
        ]
        read_only_fields = [
            "user",
            "participant_number",
            "created_at",
            "is_winner",
            "won_prize",
            "prize_position",
            "won_at",
        ]

    def get_prize_name(self, obj):
        """Extrae nombre del premio ganado"""
        return obj.won_prize.name if obj.won_prize else None

    def get_prize_image_url(self, obj):
        """Extrae URL de imagen del premio ganado"""
        if obj.won_prize and obj.won_prize.image:
            return _abs_url(self.context.get("request"), obj.won_prize.image)
        return None

    def get_prize_description(self, obj):
        """Extrae descripción del premio ganado"""
        return obj.won_prize.description if obj.won_prize else None

    def validate_receipt(self, value):
        """
        Valida el campo receipt dinámicamente según configuración de ruleta.
        
        Lógica:
        1. Si require_receipt=True y no hay archivo → Error
        2. Si require_receipt=False → Permitir vacío o con archivo
        
        Este validador es defensivo y loguea todo para debugging.
        """
        logger.info(f"🔍 validate_receipt() - Inicio. value={value}")
        
        # Obtener roulette del contexto (pasado por la vista)
        roulette = self.context.get('roulette')
        logger.info(f"   Roulette del contexto: {roulette}")
        
        # Fallback: si no está en contexto, intentar de initial_data
        if not roulette and hasattr(self, 'initial_data'):
            roulette_id = self.initial_data.get('roulette')
            logger.info(f"   Intentando obtener roulette_id del initial_data: {roulette_id}")
            
            if roulette_id:
                try:
                    from roulettes.models import Roulette
                    roulette = Roulette.objects.select_related('settings').get(pk=roulette_id)
                    self.context['roulette'] = roulette
                    logger.info(f"   ✅ Roulette obtenida de BD: {roulette.name}")
                except Exception as e:
                    logger.warning(f"   ❌ No se pudo obtener ruleta {roulette_id}: {e}")
                    return value
        
        # Si aún no hay roulette, permitir (será validado en modelo.clean())
        if not roulette:
            logger.warning(f"   ⚠️ Sin roulette en contexto - permitir")
            return value
        
        # Obtener settings de la ruleta
        try:
            settings_obj = roulette.settings
        except:
            logger.info(f"   ⚠️ Roulette sin settings, obteniendo de BD...")
            from roulettes.models import RouletteSettings
            try:
                settings_obj, created = RouletteSettings.objects.get_or_create(
                    roulette=roulette,
                    defaults={
                        'max_participants': 0,
                        'allow_multiple_entries': False,
                        'show_countdown': True,
                        'notify_on_participation': True,
                        'notify_on_draw': True,
                        'winners_target': 0,
                        'require_receipt': True,
                    }
                )
                logger.info(f"   ✅ Settings {'creado' if created else 'obtenido'}")
            except Exception as e:
                logger.error(f"   ❌ Error con settings: {e}")
                settings_obj = None
        
        # Obtener configuración (conservador por defecto)
        require_receipt = True
        if settings_obj:
            require_receipt = bool(getattr(settings_obj, 'require_receipt', True))
        
        logger.info(f"   🔍 require_receipt = {require_receipt}")
        logger.info(f"   🔍 value (receipt) = {value}")
        
        # Validar según configuración
        if not value and require_receipt:
            logger.error(f"   ❌ FALLO: Comprobante requerido pero no proporcionado")
            raise serializers.ValidationError(
                "El comprobante es requerido para participar en esta ruleta."
            )
        else:
            logger.info(f"   ✅ ÉXITO: Validación pasada")
        
        logger.info(f"🔍 validate_receipt() - Fin (exitoso)")
        return value


# ============================================================================
# SERIALIZERS PARA LISTAS
# ============================================================================

class ParticipationListSerializer(serializers.ModelSerializer):
    """
    Serializer para listar participaciones (información condensada).
    Incluye estado calculado de la participación.
    """
    user_name = serializers.SerializerMethodField()
    roulette_name = serializers.CharField(source="roulette.name", read_only=True)
    participation_state = serializers.SerializerMethodField()
    roulette_image_url = serializers.SerializerMethodField()

    class Meta:
        model = Participation
        fields = [
            "id",
            "user_name",
            "roulette_name",
            "participant_number",
            "created_at",
            "is_winner",
            "participation_state",
            "roulette_image_url",
        ]

    def get_user_name(self, obj):
        """Obtiene nombre completo del usuario o username"""
        if obj.user.first_name and obj.user.last_name:
            return f"{obj.user.first_name} {obj.user.last_name}"
        return obj.user.username

    def get_roulette_image_url(self, obj):
        """Obtiene URL de imagen de la ruleta"""
        try:
            roulette = obj.roulette
            if roulette and getattr(roulette, "cover_image", None):
                return _abs_url(self.context.get("request"), roulette.cover_image)
            return None
        except Exception:
            return None

    def get_participation_state(self, obj):
        """
        Calcula estado de la participación:
        - 'won': Usuario ganó
        - 'active': Ruleta aún activa
        - 'completed': Ruleta completada o cancelada
        """
        if obj.is_winner:
            return "won"

        roulette = obj.roulette
        if not roulette:
            return "completed"

        if roulette.status == "cancelled":
            return "completed"

        if (
            roulette.status == "completed"
            or getattr(roulette, "is_drawn", False)
            or getattr(roulette, "drawn_at", None)
        ):
            return "completed"

        if roulette.status in ["active", "scheduled"]:
            return "active"

        return "completed"


# ============================================================================
# SERIALIZERS PARA PARTICIPANTES
# ============================================================================

class ParticipantBasicSerializer(serializers.ModelSerializer):
    """
    Serializer básico para mostrar participantes en una ruleta.
    Incluye datos de contacto: nombre, email, teléfono.
    """
    name = serializers.SerializerMethodField()
    email = serializers.SerializerMethodField()
    phone = serializers.SerializerMethodField()
    user_id = serializers.IntegerField(source="user.id", read_only=True)
    first_name = serializers.CharField(source="user.first_name", read_only=True)
    last_name = serializers.CharField(source="user.last_name", read_only=True)
    username = serializers.CharField(source="user.username", read_only=True)

    class Meta:
        model = Participation
        fields = [
            "id",
            "name",
            "participant_number",
            "is_winner",
            "email",
            "phone",
            "user_id",
            "first_name",
            "last_name",
            "username",
            "created_at",
        ]

    def get_name(self, obj):
        """Obtiene nombre completo o username"""
        if obj.user.first_name and obj.user.last_name:
            return f"{obj.user.first_name} {obj.user.last_name}"
        return obj.user.username

    def get_email(self, obj):
        """Obtiene email del usuario"""
        return getattr(obj.user, "email", None)

    def get_phone(self, obj):
        """Obtiene teléfono del perfil del usuario"""
        try:
            profile = getattr(obj.user, "profile", None)
            if profile:
                return getattr(profile, "phone", None)
        except Exception:
            pass
        return None


class ParticipantFullSerializer(serializers.ModelSerializer):
    """
    Serializer completo con toda la información del participante.
    Incluye datos detallados del usuario y perfil.
    """
    name = serializers.SerializerMethodField()
    email = serializers.CharField(source="user.email", read_only=True)
    phone = serializers.SerializerMethodField()
    user_info = serializers.SerializerMethodField()

    class Meta:
        model = Participation
        fields = [
            "id",
            "name",
            "participant_number",
            "is_winner",
            "email",
            "phone",
            "user_info",
            "created_at",
        ]

    def get_name(self, obj):
        """Obtiene nombre completo o username"""
        if obj.user.first_name and obj.user.last_name:
            return f"{obj.user.first_name} {obj.user.last_name}"
        return obj.user.username

    def get_phone(self, obj):
        """Obtiene teléfono del perfil"""
        try:
            return obj.user.profile.phone if hasattr(obj.user, "profile") else None
        except Exception:
            return None

    def get_user_info(self, obj):
        """
        Retorna información completa del usuario incluyendo perfil.
        Estructura anidada con datos de contacto y avatar.
        """
        user = obj.user
        profile_data = {}
        
        try:
            if hasattr(user, "profile"):
                profile = user.profile
                profile_data = {
                    "phone": getattr(profile, "phone", None),
                    "bio": getattr(profile, "bio", None),
                    "birth_date": getattr(profile, "birth_date", None),
                    "avatar": _abs_url(self.context.get("request"), getattr(profile, "avatar", None)),
                    "terms_accepted_at": getattr(profile, "terms_accepted_at", None),
                }
        except Exception:
            pass

        return {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "is_email_verified": getattr(user, "is_email_verified", False),
            "profile": profile_data,
        }


# ============================================================================
# SERIALIZER PARA MIS PARTICIPACIONES
# ============================================================================

class MyParticipationsSerializer(serializers.ModelSerializer):
    """
    Serializer especializado para 'mis participaciones'.
    
    Incluye:
    - Información de la ruleta
    - Estado de la participación (activa/completada/ganada)
    - Detalles del premio ganado (si aplica)
    - Fechas importantes
    
    Este serializer es el más completo para el usuario final.
    """
    
    # Información del usuario
    user_name = serializers.SerializerMethodField()

    # Información de la ruleta
    roulette_id = serializers.IntegerField(source="roulette.id", read_only=True)
    roulette_name = serializers.CharField(source="roulette.name", read_only=True)
    roulette_slug = serializers.CharField(source="roulette.slug", read_only=True)
    roulette_status = serializers.CharField(source="roulette.status", read_only=True)
    roulette_is_drawn = serializers.BooleanField(source="roulette.is_drawn", read_only=True)
    roulette_drawn_at = serializers.DateTimeField(source="roulette.drawn_at", read_only=True)
    roulette_image_url = serializers.SerializerMethodField()

    # Estado calculado
    participation_state = serializers.SerializerMethodField()

    # Premio ganado
    prize_image_url = serializers.SerializerMethodField()
    prize_name = serializers.SerializerMethodField()
    prize_position = serializers.IntegerField(read_only=True)
    prize_description = serializers.SerializerMethodField()

    # Fechas adicionales
    scheduled_date = serializers.DateTimeField(source="roulette.scheduled_date", read_only=True)
    won_at = serializers.DateTimeField(read_only=True)

    class Meta:
        model = Participation
        fields = [
            # Identificadores
            "id",
            "user_name",
            "participant_number",
            "is_winner",
            "created_at",
            
            # Información de la ruleta
            "roulette_id",
            "roulette_name",
            "roulette_slug",
            "roulette_status",
            "roulette_is_drawn",
            "roulette_drawn_at",
            "roulette_image_url",
            "scheduled_date",
            
            # Estado
            "participation_state",
            
            # Premio (si es ganador)
            "prize_image_url",
            "prize_name",
            "prize_position",
            "prize_description",
            "won_at",
        ]

    def get_user_name(self, obj):
        """Obtiene nombre completo del usuario o username"""
        return (
            obj.user.get_full_name() or obj.user.username 
            if obj.user 
            else "Usuario anónimo"
        )

    def get_roulette_image_url(self, obj):
        """Obtiene URL de imagen de la ruleta"""
        try:
            roulette = obj.roulette
            if roulette and getattr(roulette, "cover_image", None):
                return _abs_url(self.context.get("request"), roulette.cover_image)
            return None
        except Exception:
            return None

    def get_participation_state(self, obj):
        """
        Calcula estado actual de la participación.
        Estados posibles: won, active, completed
        """
        if obj.is_winner:
            return "won"

        roulette = obj.roulette
        if not roulette:
            return "completed"

        if roulette.status == "cancelled":
            return "completed"

        if (
            roulette.status == "completed"
            or getattr(roulette, "is_drawn", False)
            or getattr(roulette, "drawn_at", None)
        ):
            return "completed"

        if roulette.status in ["active", "scheduled"]:
            return "active"

        return "completed"

    def get_prize_image_url(self, obj):
        """
        Retorna URL de imagen del premio ganado.
        Solo aplica si es_winner=True y existe won_prize.
        """
        if not obj.is_winner:
            return None

        if obj.won_prize and obj.won_prize.image:
            return _abs_url(self.context.get("request"), obj.won_prize.image)

        return None

    def get_prize_name(self, obj):
        """Retorna nombre del premio ganado"""
        if not obj.is_winner:
            return None

        return obj.won_prize.name if obj.won_prize else None

    def get_prize_description(self, obj):
        """Retorna descripción del premio ganado"""
        if not obj.is_winner:
            return None

        return obj.won_prize.description if obj.won_prize else None