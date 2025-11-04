from __future__ import annotations

import logging
from typing import Any, Dict

from django.db.models import Count, Q
from django.utils import timezone
from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.http import Http404
from rest_framework import generics, permissions, pagination, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import DrawHistory, Roulette, RouletteStatus
from .serializers_public import (
    PublicDrawHistorySerializer,
    PublicRouletteListSerializer,
    PublicRouletteDetailSerializer,
    PublicMetricsSerializer,
)
from participants.models import Participation

logger = logging.getLogger(__name__)


class PublicPagination(pagination.PageNumberPagination):
    """
    Paginación personalizada para endpoints públicos.
    Límites conservadores para evitar sobrecarga.
    """
    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 50
    
    def get_paginated_response(self, data):
        return Response({
            'results': data,
            'pagination': {
                'count': self.page.paginator.count,
                'next': self.get_next_link(),
                'previous': self.get_previous_link(),
                'current_page': self.page.number,
                'total_pages': self.page.paginator.num_pages,
                'page_size': self.page_size,
            }
        })


class PublicDrawHistoryView(generics.ListAPIView):
    """
    Historial público de sorteos ganadores.
    
    GET /api/roulettes/public/draw/history/
    
    Parámetros:
    - page: número de página
    - page_size: tamaño de página (máx 50)
    - roulette_id: filtrar por ID de ruleta (opcional)
    """
    serializer_class = PublicDrawHistorySerializer
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    pagination_class = PublicPagination
    
    def get_queryset(self):
        try:
            # Query optimizada con select_related para evitar N+1
            queryset = (
                DrawHistory.objects
                .select_related(
                    'roulette',
                    'winner_selected',
                    'winner_selected__user',
                )
                .filter(
                    # Solo mostrar sorteos de ruletas públicamente visibles
                    roulette__status__in=[
                        RouletteStatus.ACTIVE, 
                        RouletteStatus.SCHEDULED,
                        RouletteStatus.COMPLETED
                    ],
                    # Excluir ruletas canceladas o borradores
                    roulette__isnull=False,
                    winner_selected__isnull=False,
                )
                .order_by('-drawn_at', '-id')
            )
            
            # Filtro opcional por ruleta
            roulette_id = self.request.query_params.get('roulette_id')
            if roulette_id:
                try:
                    roulette_id = int(roulette_id)
                    queryset = queryset.filter(roulette_id=roulette_id)
                except (ValueError, TypeError):
                    logger.warning(f"ID de ruleta inválido en historial público: {roulette_id}")
            
            return queryset
            
        except Exception as e:
            logger.error(f"Error obteniendo historial público: {e}")
            return DrawHistory.objects.none()
    
    def list(self, request, *args, **kwargs):
        try:
            return super().list(request, *args, **kwargs)
        except Exception as e:
            logger.error(f"Error en lista de historial público: {e}")
            return Response(
                {
                    'error': 'Error interno del servidor',
                    'results': [],
                    'pagination': {
                        'count': 0,
                        'next': None,
                        'previous': None,
                        'current_page': 1,
                        'total_pages': 0,
                        'page_size': self.pagination_class.page_size,
                    }
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class PublicRouletteListView(generics.ListAPIView):
    """
    Lista pública de ruletas activas.
    
    GET /api/roulettes/public/roulettes/
    
    Parámetros:
    - page: número de página
    - page_size: tamaño de página (máx 50)
    - status: filtrar por estado (active, scheduled)
    - search: búsqueda por nombre (opcional)
    """
    serializer_class = PublicRouletteListSerializer
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    pagination_class = PublicPagination
    
    def get_queryset(self):
        try:
            # Query base optimizada
            queryset = (
                Roulette.objects
                .select_related('created_by', 'settings', 'winner__user')
                .prefetch_related('prizes', 'participations')
                .filter(
                    # Solo ruletas públicamente visibles
                    status__in=[RouletteStatus.ACTIVE, RouletteStatus.SCHEDULED],
                )
                .order_by('-created_at')
            )
            
            # Filtro por estado específico
            status_filter = self.request.query_params.get('status')
            if status_filter and status_filter in [RouletteStatus.ACTIVE, RouletteStatus.SCHEDULED]:
                queryset = queryset.filter(status=status_filter)
            
            # Búsqueda por nombre
            search = self.request.query_params.get('search')
            if search and len(search.strip()) >= 2:  # Mínimo 2 caracteres
                search_term = search.strip()[:100]  # Limitar longitud
                queryset = queryset.filter(
                    Q(name__icontains=search_term) | 
                    Q(description__icontains=search_term)
                )
            
            return queryset
            
        except Exception as e:
            logger.error(f"Error obteniendo lista pública de ruletas: {e}")
            return Roulette.objects.none()
    
    def list(self, request, *args, **kwargs):
        try:
            return super().list(request, *args, **kwargs)
        except Exception as e:
            logger.error(f"Error en lista pública de ruletas: {e}")
            return Response(
                {
                    'error': 'Error interno del servidor',
                    'results': [],
                    'pagination': {
                        'count': 0,
                        'next': None,
                        'previous': None,
                        'current_page': 1,
                        'total_pages': 0,
                        'page_size': self.pagination_class.page_size,
                    }
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class PublicRouletteDetailView(generics.RetrieveAPIView):
    """
    Detalle público de una ruleta específica.
    
    GET /api/roulettes/public/roulette/{id}/
    
    Incluye información completa: premios, configuración, cronómetros, etc.
    """
    serializer_class = PublicRouletteDetailSerializer
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    lookup_field = 'pk'
    
    def get_queryset(self):
        # Solo ruletas públicamente visibles
        return (
            Roulette.objects
            .select_related('created_by', 'settings', 'winner__user')
            .prefetch_related(
                'prizes',
                'participations__user'
            )
            .filter(
                status__in=[
                    RouletteStatus.ACTIVE, 
                    RouletteStatus.SCHEDULED,
                    RouletteStatus.COMPLETED  # Permitir ver completadas para historial
                ]
            )
        )
    
    def retrieve(self, request, *args, **kwargs):
        try:
            return super().retrieve(request, *args, **kwargs)
        except Http404:
            return Response(
                {'error': 'Ruleta no encontrada o no disponible públicamente'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Error obteniendo detalle público de ruleta {kwargs.get('pk')}: {e}")
            return Response(
                {'error': 'Error interno del servidor'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class PublicMetricsView(APIView):
    """
    Métricas públicas del sistema para mostrar en home/landing.
    
    GET /api/roulettes/public/metrics/
    
    Incluye estadísticas generales como:
    - Total de ruletas
    - Ruletas activas
    - Total de ganadores
    - Tiempo del servidor
    """
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    
    def get(self, request) -> Response:
        cache_key = 'public_metrics'
        
        # Intentar obtener de cache (5 minutos)
        cached_data = cache.get(cache_key)
        if cached_data:
            logger.debug("Métricas públicas servidas desde cache")
            return Response(cached_data, status=status.HTTP_200_OK)
        
        try:
            # Calcular métricas en tiempo real
            metrics_data = self._calculate_metrics()
            
            # Cachear por 5 minutos
            cache.set(cache_key, metrics_data, timeout=300)
            
            logger.info("Métricas públicas calculadas y cacheadas")
            return Response(metrics_data, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error calculando métricas públicas: {e}")
            # Fallback con datos mínimos
            fallback_data = {
                "roulettes_total": 0,
                "active_roulettes": 0,
                "winners_total": 0,
                "participants_total": 0,
                "server_time": timezone.now().isoformat(),
                "error": "Datos no disponibles temporalmente"
            }
            return Response(fallback_data, status=status.HTTP_200_OK)
    
    def _calculate_metrics(self) -> Dict[str, Any]:
        """
        Calcula las métricas del sistema de forma optimizada.
        """
        try:
            # Métricas de ruletas
            roulettes_stats = Roulette.objects.aggregate(
                total_roulettes=Count('id'),
                active_roulettes=Count(
                    'id', 
                    filter=Q(status__in=[RouletteStatus.ACTIVE, RouletteStatus.SCHEDULED])
                ),
            )
            
            # Total de ganadores (registros en DrawHistory)
            winners_total = DrawHistory.objects.count()
            
            # Total de participantes únicos
            try:
                participants_total = Participation.objects.values('user_id').distinct().count()
            except Exception:
                participants_total = 0
            
            # Datos adicionales útiles
            current_time = timezone.now()
            
            return {
                "roulettes_total": roulettes_stats.get('total_roulettes', 0),
                "active_roulettes": roulettes_stats.get('active_roulettes', 0),
                "winners_total": winners_total,
                "participants_total": participants_total,
                "server_time": current_time.isoformat(),
                "cache_updated": current_time.isoformat(),
            }
            
        except Exception as e:
            logger.error(f"Error en cálculo de métricas: {e}")
            raise


class PublicRouletteStatsView(APIView):
    """
    Estadísticas específicas de una ruleta pública.
    
    GET /api/roulettes/public/roulette/{id}/stats/
    
    Información estadística detallada de una ruleta específica.
    """
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    
    def get(self, request, pk: int) -> Response:
        try:
            # Obtener ruleta con validaciones de visibilidad
            roulette = self._get_public_roulette(pk)
            if not roulette:
                return Response(
                    {'error': 'Ruleta no encontrada o no disponible públicamente'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Calcular estadísticas
            stats = self._calculate_roulette_stats(roulette)
            
            return Response(stats, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error obteniendo stats públicas de ruleta {pk}: {e}")
            return Response(
                {'error': 'Error interno del servidor'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def _get_public_roulette(self, pk: int):
        """Obtiene ruleta solo si es públicamente visible."""
        try:
            return Roulette.objects.select_related('settings').get(
                pk=pk,
                status__in=[
                    RouletteStatus.ACTIVE,
                    RouletteStatus.SCHEDULED, 
                    RouletteStatus.COMPLETED
                ]
            )
        except Roulette.DoesNotExist:
            return None
        except Exception as e:
            logger.error(f"Error obteniendo ruleta {pk}: {e}")
            return None
    
    def _calculate_roulette_stats(self, roulette) -> Dict[str, Any]:
        """Calcula estadísticas específicas de la ruleta."""
        try:
            # Stats de participantes
            participants_stats = roulette.participations.aggregate(
                total_participants=Count('id'),
                winners_count=Count('id', filter=Q(is_winner=True)),
            )
            
            # Stats de premios
            prizes_stats = roulette.prizes.aggregate(
                total_prizes=Count('id'),
                active_prizes=Count('id', filter=Q(is_active=True)),
                available_awards=Count('id', filter=Q(is_active=True, stock__gt=0)),
            )
            
            # Info de configuración (solo pública)
            settings = getattr(roulette, 'settings', None)
            config_info = {
                'max_participants': getattr(settings, 'max_participants', 0) if settings else 0,
                'allow_multiple_entries': getattr(settings, 'allow_multiple_entries', False) if settings else False,
                'show_countdown': getattr(settings, 'show_countdown', True) if settings else True,
            }
            
            # Estado de participación
            participation_status = {
                'is_open': self._is_participation_open(roulette),
                'can_still_participate': self._can_still_participate(roulette, participants_stats),
            }
            
            # Tiempo restante para diferentes eventos
            time_info = self._calculate_time_remaining_info(roulette)
            
            return {
                'roulette_info': {
                    'id': roulette.id,
                    'name': roulette.name,
                    'status': roulette.status,
                    'is_drawn': getattr(roulette, 'is_drawn', False),
                    'created_at': roulette.created_at.isoformat() if roulette.created_at else None,
                },
                'participants': {
                    'total': participants_stats.get('total_participants', 0),
                    'winners': participants_stats.get('winners_count', 0),
                    'eligible': max(
                        participants_stats.get('total_participants', 0) - 
                        participants_stats.get('winners_count', 0), 0
                    ),
                },
                'prizes': {
                    'total': prizes_stats.get('total_prizes', 0),
                    'active': prizes_stats.get('active_prizes', 0),
                    'available_awards': prizes_stats.get('available_awards', 0),
                },
                'configuration': config_info,
                'participation_status': participation_status,
                'time_info': time_info,
                'last_updated': timezone.now().isoformat(),
            }
            
        except Exception as e:
            logger.error(f"Error calculando stats de ruleta {roulette.id}: {e}")
            raise
    
    def _is_participation_open(self, roulette) -> bool:
        """Verifica si la participación está abierta actualmente."""
        try:
            if roulette.status not in [RouletteStatus.ACTIVE, RouletteStatus.SCHEDULED]:
                return False
            
            if getattr(roulette, 'is_drawn', False):
                return False
                
            now = timezone.now()
            
            if roulette.participation_start and now < roulette.participation_start:
                return False
                
            if roulette.participation_end and now > roulette.participation_end:
                return False
                
            return True
        except Exception:
            return False
    
    def _can_still_participate(self, roulette, participants_stats) -> bool:
        """Verifica si aún se puede participar considerando límites."""
        try:
            if not self._is_participation_open(roulette):
                return False
            
            settings = getattr(roulette, 'settings', None)
            if settings and settings.max_participants > 0:
                current_count = participants_stats.get('total_participants', 0)
                if current_count >= settings.max_participants:
                    return False
            
            return True
        except Exception:
            return False
    
    def _calculate_time_remaining_info(self, roulette) -> Dict[str, Any]:
        """Calcula información de tiempo restante para diferentes eventos."""
        try:
            now = timezone.now()
            time_info = {}
            
            # Tiempo hasta inicio de participación
            if roulette.participation_start and now < roulette.participation_start:
                diff = roulette.participation_start - now
                time_info['until_participation_start'] = {
                    'total_seconds': int(diff.total_seconds()),
                    'days': diff.days,
                    'hours': diff.seconds // 3600,
                    'minutes': (diff.seconds % 3600) // 60,
                    'target_date': roulette.participation_start.isoformat(),
                }
            
            # Tiempo hasta fin de participación
            if roulette.participation_end and now < roulette.participation_end:
                diff = roulette.participation_end - now
                time_info['until_participation_end'] = {
                    'total_seconds': int(diff.total_seconds()),
                    'days': diff.days,
                    'hours': diff.seconds // 3600,
                    'minutes': (diff.seconds % 3600) // 60,
                    'target_date': roulette.participation_end.isoformat(),
                }
            
            # Tiempo hasta sorteo programado
            if (roulette.scheduled_date and now < roulette.scheduled_date and 
                not getattr(roulette, 'is_drawn', False)):
                diff = roulette.scheduled_date - now
                time_info['until_draw'] = {
                    'total_seconds': int(diff.total_seconds()),
                    'days': diff.days,
                    'hours': diff.seconds // 3600,
                    'minutes': (diff.seconds % 3600) // 60,
                    'target_date': roulette.scheduled_date.isoformat(),
                }
            
            return time_info
            
        except Exception as e:
            logger.error(f"Error calculando tiempo restante: {e}")
            return {}