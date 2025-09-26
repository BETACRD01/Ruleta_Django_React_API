// src/config/publicApi.jsx - COMPLETAMENTE CORREGIDO
import axios from "axios";

// Configuración base de API
export const API_BASE = (process.env.REACT_APP_API_URL || "http://localhost:8000/api").replace(/\/$/, "");
export const MEDIA_BASE = (process.env.REACT_APP_MEDIA_URL || "http://localhost:8000").replace(/\/$/, "");

const http = axios.create({ 
  baseURL: API_BASE, 
  withCredentials: false,
  timeout: 15000, // 15 segundos
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  }
});

// Interceptor mejorado para manejar errores
http.interceptors.response.use(
  (response) => {
    console.log(`✅ API Success: ${response.config.method?.toUpperCase()} ${response.config.url} - ${response.status}`);
    return response;
  },
  (error) => {
    const errorInfo = {
      url: error?.config?.url,
      method: error?.config?.method?.toUpperCase(),
      status: error?.response?.status,
      statusText: error?.response?.statusText,
      data: error?.response?.data,
      code: error?.code
    };
    
    console.error('❌ API Error:', errorInfo);
    
    // Manejo específico de errores
    if (error.code === 'ECONNABORTED') {
      throw new Error('Timeout: El servidor tardó demasiado en responder');
    }
    if (error.code === 'NETWORK_ERROR' || !error.response) {
      throw new Error('Error de red: No se pudo conectar al servidor');
    }
    if (error.response?.status === 429) {
      throw new Error('Demasiadas requests: Intenta de nuevo más tarde');
    }
    if (error.response?.status >= 500) {
      throw new Error('Error interno del servidor');
    }
    
    throw error;
  }
);

// Función auxiliar para construir query strings
const buildQueryString = (params = {}) => {
  const filteredParams = {};
  
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '' && value !== false) {
      // Convertir arrays a strings separados por coma si es necesario
      filteredParams[key] = Array.isArray(value) ? value.join(',') : value;
    }
  });
  
  const queryString = new URLSearchParams(filteredParams).toString();
  return queryString ? `?${queryString}` : "";
};

// Función para normalizar URLs de medios
const normalizeMediaUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${MEDIA_BASE}${url.startsWith('/') ? '' : '/'}${url}`;
};

// Función para normalizar fechas
const normalizeDate = (dateStr) => {
  if (!dateStr) return null;
  try {
    return new Date(dateStr).toISOString();
  } catch {
    return null;
  }
};

export const publicAPI = {
  
  // ==================== RULETAS ====================
  
  /**
   * Obtiene lista pública de ruletas
   * @param {Object} params - Parámetros de filtrado y paginación
   */
  getPublicRoulettes: async (params = {}) => {
    try {
      console.log('🎯 Fetching public roulettes with params:', params);
      
      const response = await http.get(`/roulettes/public/roulettes/${buildQueryString(params)}`);
      const data = response.data;
      
      // Validar estructura de respuesta
      if (!data || typeof data !== 'object') {
        throw new Error('Respuesta inválida del servidor');
      }
      
      // Normalizar estructura de paginación
      const results = Array.isArray(data.results) ? data.results : Array.isArray(data) ? data : [];
      
      const normalizedData = {
        results: results.map(roulette => ({
          ...roulette,
          cover_image_url: normalizeMediaUrl(roulette.cover_image_url || roulette.cover_image),
          participation_start: normalizeDate(roulette.participation_start),
          participation_end: normalizeDate(roulette.participation_end),
          scheduled_date: normalizeDate(roulette.scheduled_date),
          participants_count: parseInt(roulette.participants_count) || 0,
          prizes_count: parseInt(roulette.prizes_count) || 0,
          participation_is_open: Boolean(roulette.participation_is_open),
        })),
        pagination: data.pagination || {
          count: data.count || results.length,
          next: data.next || null,
          previous: data.previous || null,
          current_page: data.current_page || 1,
          total_pages: data.total_pages || 1,
          page_size: data.page_size || results.length
        }
      };
      
      console.log('✅ Public roulettes fetched:', normalizedData);
      return normalizedData;
      
    } catch (error) {
      console.error('❌ Error fetching public roulettes:', error);
      return { 
        results: [], 
        pagination: { count: 0, next: null, previous: null, current_page: 1, total_pages: 0, page_size: 0 },
        error: error.message 
      };
    }
  },

  /**
   * Obtiene detalle de una ruleta específica
   * @param {number|string} rouletteId - ID de la ruleta
   */
  getPublicRouletteDetail: async (rouletteId) => {
    try {
      console.log('🎯 Fetching roulette detail for ID:', rouletteId);
      
      if (!rouletteId) {
        throw new Error('ID de ruleta requerido');
      }
      
      const response = await http.get(`/roulettes/public/roulette/${rouletteId}/`);
      const data = response.data;
      
      if (!data || typeof data !== 'object') {
        throw new Error('Ruleta no encontrada');
      }
      
      // Normalizar datos de la ruleta
      const normalizedData = {
        ...data,
        cover_image_url: normalizeMediaUrl(data.cover_image_url || data.cover_image),
        participation_start: normalizeDate(data.participation_start),
        participation_end: normalizeDate(data.participation_end),
        scheduled_date: normalizeDate(data.scheduled_date),
        participants_count: parseInt(data.participants_count) || 0,
        participation_is_open: Boolean(data.participation_is_open),
        
        // Normalizar premios
        prizes: Array.isArray(data.prizes) ? data.prizes.map(prize => ({
          ...prize,
          image_url: normalizeMediaUrl(prize.image_url || prize.image),
          is_available: Boolean(prize.is_available),
          display_order: parseInt(prize.display_order) || 0
        })) : [],
        
        // Normalizar configuración
        settings: data.settings ? {
          max_participants: parseInt(data.settings.max_participants) || 0,
          allow_multiple_entries: Boolean(data.settings.allow_multiple_entries),
          show_countdown: Boolean(data.settings.show_countdown)
        } : null
      };
      
      console.log('✅ Roulette detail fetched:', normalizedData);
      return normalizedData;
      
    } catch (error) {
      console.error('❌ Error fetching roulette detail:', error);
      return null;
    }
  },

  /**
   * Obtiene estadísticas de una ruleta específica
   * @param {number|string} rouletteId - ID de la ruleta
   */
  getPublicRouletteStats: async (rouletteId) => {
    try {
      console.log('🎯 Fetching roulette stats for ID:', rouletteId);
      
      const response = await http.get(`/roulettes/public/roulette/${rouletteId}/stats/`);
      return response.data;
      
    } catch (error) {
      console.error('❌ Error fetching roulette stats:', error);
      return null;
    }
  },

  // ==================== HISTORIAL ====================
  
  /**
   * Obtiene historial público de sorteos
   * @param {Object} params - Parámetros de filtrado y paginación
   */
  getPublicDrawHistory: async (params = {}) => {
    try {
      console.log('🎯 Fetching draw history with params:', params);
      
      const response = await http.get(`/roulettes/public/draw/history/${buildQueryString(params)}`);
      const data = response.data;
      
      if (!data || typeof data !== 'object') {
        throw new Error('Respuesta inválida del servidor');
      }
      
      const results = Array.isArray(data.results) ? data.results : [];
      
      const normalizedData = {
        results: results.map(item => ({
          ...item,
          draw_date: normalizeDate(item.draw_date),
          participants_count: parseInt(item.participants_count) || 0,
          roulette_name: item.roulette_name || 'Sorteo',
          winner_name: item.winner_name || 'Ganador anónimo'
        })),
        pagination: data.pagination || {
          count: data.count || results.length,
          next: data.next || null,
          previous: data.previous || null,
          current_page: data.current_page || 1,
          total_pages: data.total_pages || 1,
          page_size: data.page_size || results.length
        }
      };
      
      console.log('✅ Draw history fetched:', normalizedData);
      return normalizedData;
      
    } catch (error) {
      console.error('❌ Error fetching draw history:', error);
      return { 
        results: [], 
        pagination: { count: 0, next: null, previous: null, current_page: 1, total_pages: 0, page_size: 0 },
        error: error.message 
      };
    }
  },
  
  // ==================== MÉTRICAS ====================
  
  /**
   * Obtiene métricas públicas del sistema
   */
  getPublicMetrics: async () => {
    try {
      console.log('🎯 Fetching public metrics');
      
      const response = await http.get('/roulettes/public/metrics/');
      const data = response.data;
      
      const normalizedMetrics = {
        roulettes_total: parseInt(data.roulettes_total) || 0,
        active_roulettes: parseInt(data.active_roulettes) || 0,
        winners_total: parseInt(data.winners_total) || 0,
        participants_total: parseInt(data.participants_total) || 0,
        server_time: normalizeDate(data.server_time) || new Date().toISOString(),
        cache_updated: normalizeDate(data.cache_updated)
      };
      
      console.log('✅ Public metrics fetched:', normalizedMetrics);
      return normalizedMetrics;
      
    } catch (error) {
      console.error('❌ Error fetching public metrics:', error);
      return {
        roulettes_total: 0,
        active_roulettes: 0,
        winners_total: 0,
        participants_total: 0,
        server_time: new Date().toISOString(),
        error: error.message
      };
    }
  },

  // ==================== FUNCIONES ESPECÍFICAS PARA HOME ====================
  
  /**
   * Obtiene datos completos para la página de inicio
   */
  getHomeData: async () => {
    try {
      console.log('🏠 Fetching complete home data...');
      
      // Realizar llamadas en paralelo
      const [winnersResult, metricsResult, roulettesResult] = await Promise.allSettled([
        publicAPI.getPublicDrawHistory({ page_size: 8 }),
        publicAPI.getPublicMetrics(),
        publicAPI.getActiveRoulettesForHome({ page_size: 6 })
      ]);

      // Procesar resultados
      const winners = winnersResult.status === 'fulfilled' ? 
        (winnersResult.value?.results || []) : [];
      
      const metrics = metricsResult.status === 'fulfilled' ? 
        metricsResult.value || {} : {};
      
      const roulettes = roulettesResult.status === 'fulfilled' ? 
        (roulettesResult.value?.results || []) : [];

      const homeData = {
        recent_winners: winners.slice(0, 8),
        metrics: {
          total_roulettes: metrics.roulettes_total || 0,
          active_roulettes: metrics.active_roulettes || 0,
          total_winners: metrics.winners_total || 0,
          participants_total: metrics.participants_total || 0
        },
        featured_roulettes: roulettes.slice(0, 6),
        server_time: metrics.server_time || new Date().toISOString(),
        success: true
      };

      console.log('✅ Complete home data fetched:', {
        winners_count: homeData.recent_winners.length,
        roulettes_count: homeData.featured_roulettes.length,
        metrics: homeData.metrics
      });

      return homeData;

    } catch (error) {
      console.error('❌ Error fetching home data:', error);
      return {
        recent_winners: [],
        metrics: {
          total_roulettes: 0,
          active_roulettes: 0,
          total_winners: 0,
          participants_total: 0
        },
        featured_roulettes: [],
        server_time: new Date().toISOString(),
        success: false,
        error: error.message
      };
    }
  },

  /**
   * Obtiene ruletas activas específicamente para mostrar en home
   */
  getActiveRoulettesForHome: async (params = { page_size: 6 }) => {
    try {
      console.log('🎯 Fetching active roulettes for home with params:', params);
      
      // Filtrar solo ruletas activas y con participación abierta
      const requestParams = {
        ...params,
        status: 'active',
        page_size: params.page_size || 6
      };
      
      const roulettesData = await publicAPI.getPublicRoulettes(requestParams);
      
      if (!roulettesData || !Array.isArray(roulettesData.results)) {
        throw new Error('Respuesta inválida del servidor');
      }

      // Filtrar y procesar ruletas para home
      const processedRoulettes = roulettesData.results
        .filter(roulette => roulette.participation_is_open || roulette.status === 'active')
        .map(roulette => ({
          ...roulette,
          
          // Calcular estado específico para UI
          ui_status: publicAPI.computeRouletteUIStatus(roulette),
          
          // Calcular tiempo restante si aplica
          time_info: publicAPI.calculateTimeInfo(roulette),
          
          // Información de premios simplificada
          prizes_summary: {
            total_count: roulette.prizes_count || 0,
            has_prizes: (roulette.prizes_count || 0) > 0
          }
        }));

      const result = {
        results: processedRoulettes,
        pagination: roulettesData.pagination,
        success: true
      };

      console.log('✅ Active roulettes for home fetched:', {
        total_found: processedRoulettes.length,
        statuses: processedRoulettes.map(r => r.ui_status)
      });

      return result;

    } catch (error) {
      console.error('❌ Error fetching active roulettes for home:', error);
      return { 
        results: [], 
        pagination: { count: 0 },
        success: false, 
        error: error.message 
      };
    }
  },

  // ==================== FUNCIONES AUXILIARES ====================
  
  /**
   * Calcula el estado de UI de una ruleta
   */
  computeRouletteUIStatus: (roulette) => {
    if (!roulette) return 'unknown';
    
    const now = new Date();
    const participationStart = roulette.participation_start;
    const participationEnd = roulette.participation_end;
    const scheduledDate = roulette.scheduled_date;

    // Verificar si ya terminó
    if (roulette.status === 'completed' || roulette.is_drawn) {
      return 'completed';
    }

    // Verificar si aún no empezó
    if (participationStart && new Date(participationStart) > now) {
      return 'waiting_to_start';
    }

    // Verificar si está en período de participación
    if (roulette.participation_is_open) {
      return 'accepting_participants';
    }

    // Verificar si terminó participación pero no se sorteo
    if (participationEnd && new Date(participationEnd) < now) {
      if (scheduledDate && new Date(scheduledDate) > now) {
        return 'waiting_for_scheduled_draw';
      }
      return 'ready_for_manual_draw';
    }

    return 'active';
  },

  /**
   * Calcula información de tiempo para una ruleta
   */
  calculateTimeInfo: (roulette) => {
    if (!roulette) return null;
    
    const timeInfo = {};

    if (roulette.time_remaining) {
      // Usar tiempo ya calculado por el backend
      Object.keys(roulette.time_remaining).forEach(key => {
        const timeData = roulette.time_remaining[key];
        if (timeData && timeData.total_seconds > 0) {
          timeInfo[key] = {
            ...timeData,
            formatted: publicAPI.formatTimeRemaining(timeData)
          };
        }
      });
    }

    return Object.keys(timeInfo).length > 0 ? timeInfo : null;
  },

  /**
   * Formatea tiempo restante en texto legible
   */
  formatTimeRemaining: (timeData) => {
    if (!timeData || timeData.total_seconds <= 0) return '';
    
    const { days, hours, minutes } = timeData;
    
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  },

  // ==================== UTILIDADES DE DEBUG ====================
  
  /**
   * Prueba la conexión con la API
   */
  testConnection: async () => {
    try {
      console.log('🔧 Testing API connection...');
      const response = await http.get('/roulettes/public/metrics/');
      
      console.log('✅ Connection test successful:', {
        status: response.status,
        baseURL: http.defaults.baseURL,
        timeout: http.defaults.timeout
      });
      
      return { 
        success: true, 
        data: response.data,
        config: {
          baseURL: http.defaults.baseURL,
          timeout: http.defaults.timeout
        }
      };
      
    } catch (error) {
      console.error('❌ Connection test failed:', error);
      return { 
        success: false, 
        error: error.message,
        config: {
          baseURL: http.defaults.baseURL,
          timeout: http.defaults.timeout
        }
      };
    }
  },

  /**
   * Obtiene información de configuración actual
   */
  getConfig: () => ({
    API_BASE,
    MEDIA_BASE,
    timeout: http.defaults.timeout,
    headers: http.defaults.headers
  })
};

// Export default para compatibilidad
export default publicAPI;