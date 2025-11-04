import logging
import time
from django.http import JsonResponse
from django.core.cache import cache
from django.conf import settings

logger = logging.getLogger(__name__)


class PublicAPIRateLimitMiddleware:

    """
    Middleware para limitar el rate de requests a endpoints públicos.
    Evita abuso de los endpoints sin autenticación.
    """

    def __init__(self, get_response):
        self.get_response = get_response
        # Configuraciones por defecto
        self.rate_limit = getattr(settings, 'PUBLIC_API_RATE_LIMIT', 100)  # requests por hora
        self.rate_window = getattr(settings, 'PUBLIC_API_RATE_WINDOW', 3600)  # 1 hora en segundos
        self.enabled = getattr(settings, 'PUBLIC_API_RATE_LIMIT_ENABLED', True)

    def __call__(self, request):
        # Solo aplicar a endpoints públicos de roulettes
        if (self.enabled and 
            request.path.startswith('/api/roulettes/public/') and 
            not self._is_whitelisted_ip(request)):
            
            if not self._check_rate_limit(request):
                return JsonResponse(
                    {
                        'error': 'Rate limit excedido',
                        'message': f'Máximo {self.rate_limit} requests por hora',
                        'retry_after': self._get_retry_after(request)
                    },
                    status=429
                )

        response = self.get_response(request)
        return response

    def _get_client_ip(self, request):
        """Obtiene la IP real del cliente considerando proxies."""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0].strip()
        else:
            ip = request.META.get('REMOTE_ADDR', '127.0.0.1')
        return ip

    def _is_whitelisted_ip(self, request):
        """Verifica si la IP está en la lista blanca."""
        client_ip = self._get_client_ip(request)
        whitelist = getattr(settings, 'PUBLIC_API_IP_WHITELIST', ['127.0.0.1'])
        return client_ip in whitelist

    def _get_cache_key(self, request):
        """Genera clave de cache para el rate limiting."""
        client_ip = self._get_client_ip(request)
        return f'public_api_rate_limit:{client_ip}'

    def _check_rate_limit(self, request):
        """Verifica si el request está dentro del rate limit."""
        cache_key = self._get_cache_key(request)
        current_time = int(time.time())
        
        # Obtener requests previos
        requests_data = cache.get(cache_key, {'requests': [], 'count': 0})
        
        # Filtrar requests dentro de la ventana de tiempo
        window_start = current_time - self.rate_window
        recent_requests = [
            req_time for req_time in requests_data.get('requests', [])
            if req_time > window_start
        ]
        
        # Verificar si se excede el límite
        if len(recent_requests) >= self.rate_limit:
            logger.warning(f"Rate limit excedido para IP {self._get_client_ip(request)}")
            return False
        
        # Agregar request actual y guardar en cache
        recent_requests.append(current_time)
        cache.set(
            cache_key,
            {'requests': recent_requests, 'count': len(recent_requests)},
            timeout=self.rate_window
        )
        
        return True

    def _get_retry_after(self, request):
        """Calcula cuándo puede volver a hacer requests."""
        cache_key = self._get_cache_key(request)
        requests_data = cache.get(cache_key, {'requests': []})
        
        if not requests_data.get('requests'):
            return 0
        
        oldest_request = min(requests_data['requests'])
        retry_after = oldest_request + self.rate_window - int(time.time())
        return max(retry_after, 0)


class PublicAPISecurityMiddleware:
    """
    Middleware de seguridad para endpoints públicos.
    Agrega headers de seguridad y validaciones básicas.
    """
    
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        
        # Solo aplicar a endpoints públicos de roulettes
        if request.path.startswith('/api/roulettes/public/'):
            # Headers de seguridad
            response['X-Content-Type-Options'] = 'nosniff'
            response['X-Frame-Options'] = 'DENY'
            response['X-XSS-Protection'] = '1; mode=block'
            response['Referrer-Policy'] = 'strict-origin-when-cross-origin'
            
            # CORS básico para endpoints públicos
            response['Access-Control-Allow-Origin'] = '*'
            response['Access-Control-Allow-Methods'] = 'GET, OPTIONS'
            response['Access-Control-Allow-Headers'] = 'Content-Type, Accept'
            response['Access-Control-Max-Age'] = '3600'
            
            # Cache headers para mejorar performance
            if request.method == 'GET':
                if 'metrics' in request.path:
                    response['Cache-Control'] = 'public, max-age=300'  # 5 minutos
                elif 'history' in request.path:
                    response['Cache-Control'] = 'public, max-age=60'   # 1 minuto
                else:
                    response['Cache-Control'] = 'public, max-age=180'  # 3 minutos

        return response


class PublicAPILoggingMiddleware:
    """
    Middleware para logging específico de endpoints públicos.
    Útil para monitoreo y análisis de uso.
    """
    
    def __init__(self, get_response):
        self.get_response = get_response
        self.logger = logging.getLogger('public_api')

    def __call__(self, request):
        start_time = time.time()
        
        # Solo procesar endpoints públicos
        if request.path.startswith('/api/roulettes/public/'):
            client_ip = self._get_client_ip(request)
            user_agent = request.META.get('HTTP_USER_AGENT', 'Unknown')[:200]
            
            response = self.get_response(request)
            
            # Calcular tiempo de respuesta
            duration = round((time.time() - start_time) * 1000, 2)  # ms
            
            # Log de la request
            log_data = {
                'method': request.method,
                'path': request.path,
                'client_ip': client_ip,
                'user_agent': user_agent,
                'status_code': response.status_code,
                'duration_ms': duration,
                'query_params': dict(request.GET) if request.GET else None,
            }
            
            if response.status_code >= 400:
                self.logger.warning('Public API request failed', extra=log_data)
            else:
                self.logger.info('Public API request', extra=log_data)
                
            # Header con tiempo de respuesta
            response['X-Response-Time'] = f'{duration}ms'
            
            return response
        
        return self.get_response(request)

    def _get_client_ip(self, request):
        """Obtiene la IP real del cliente."""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0].strip()
        else:
            ip = request.META.get('REMOTE_ADDR', '127.0.0.1')
        return ip