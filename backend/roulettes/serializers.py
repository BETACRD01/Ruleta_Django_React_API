from rest_framework import serializers
from django.utils import timezone
from .models import Roulette, RouletteSettings, DrawHistory, RoulettePrize
from participants.models import Participation


class RouletteSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = RouletteSettings
        fields = ['max_participants', 'allow_multiple_entries']


class RoulettePrizeSerializer(serializers.ModelSerializer):
    class Meta:
        model = RoulettePrize
        fields = ['id', 'name', 'description', 'image', 'stock', 'probability', 'created_at']
        read_only_fields = ['id', 'created_at']

    def validate_stock(self, value):
        if value < 1:
            raise serializers.ValidationError('El stock debe ser al menos 1.')
        return value

    def validate_probability(self, value):
        if value < 0 or value > 100:
            raise serializers.ValidationError('La probabilidad debe estar entre 0 y 100.')
        return value


class RouletteListSerializer(serializers.ModelSerializer):
    participants_count = serializers.IntegerField(source='get_participants_count', read_only=True)
    winner_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Roulette
        fields = [
            'id', 'name', 'description', 'status', 'is_drawn',
            'participants_count', 'winner_name', 'created_by_name',
            'created_at', 'scheduled_date', 'drawn_at'
        ]

    def get_winner_name(self, obj):
        if obj.winner and obj.winner.user:
            return obj.winner.user.get_full_name() or obj.winner.user.username
        return None

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return None


class ParticipationLiteSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()

    class Meta:
        model = Participation
        fields = ['id', 'participant_number', 'is_winner', 'user_name', 'created_at']

    def get_user_name(self, obj):
        return obj.user.get_full_name() or obj.user.username


class RouletteDetailSerializer(serializers.ModelSerializer):
    participants_count = serializers.IntegerField(source='get_participants_count', read_only=True)
    participants = ParticipationLiteSerializer(source='get_participants_list', many=True, read_only=True)
    winner_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    prizes = RoulettePrizeSerializer(many=True, read_only=True)
    settings = RouletteSettingsSerializer(read_only=True)

    class Meta:
        model = Roulette
        fields = [
            'id', 'name', 'description', 'status', 'is_drawn',
            'participants_count', 'participants', 'winner_name',
            'created_by_name', 'created_at', 'scheduled_date',
            'drawn_at', 'prizes', 'settings'
        ]

    def get_winner_name(self, obj):
        if obj.winner and obj.winner.user:
            return obj.winner.user.get_full_name() or obj.winner.user.username
        return None

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return None


class RouletteCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Roulette
        fields = ['name', 'description', 'scheduled_date', 'status']

    def validate_scheduled_date(self, value):
        if value and value <= timezone.now():
            raise serializers.ValidationError('La fecha debe ser futura.')
        return value


class DrawExecuteSerializer(serializers.Serializer):
    roulette_id = serializers.IntegerField()

    def validate(self, attrs):
        rid = attrs['roulette_id']
        try:
            roulette = Roulette.objects.get(id=rid)
        except Roulette.DoesNotExist:
            raise serializers.ValidationError({'roulette_id': 'Ruleta no encontrada'})

        if roulette.is_drawn or roulette.status == 'completed':
            raise serializers.ValidationError('La ruleta ya fue sorteada.')

        if not roulette.participations.exists():
            raise serializers.ValidationError('No hay participantes para sortear.')

        user = self.context['request'].user
        # criterio de admin flexible
        if not (user.is_staff or user.is_superuser or getattr(user, 'user_type', '') == 'admin'):
            raise serializers.ValidationError('No tienes permisos para ejecutar el sorteo.')

        attrs['validated_roulette'] = roulette
        return attrs


class DrawHistorySerializer(serializers.ModelSerializer):
    roulette_name = serializers.CharField(source='roulette.name', read_only=True)
    winner_name = serializers.SerializerMethodField()
    drawn_by_name = serializers.SerializerMethodField()

    class Meta:
        model = DrawHistory
        fields = [
            'id', 'roulette', 'roulette_name', 'winner_selected', 'winner_name',
            'drawn_by', 'drawn_by_name', 'draw_type', 'drawn_at', 'participants_count'
        ]

    def get_winner_name(self, obj):
        if obj.winner_selected and obj.winner_selected.user:
            return obj.winner_selected.user.get_full_name() or obj.winner_selected.user.username
        return None

    def get_drawn_by_name(self, obj):
        if obj.drawn_by:
            return obj.drawn_by.get_full_name() or obj.drawn_by.username
        return None
