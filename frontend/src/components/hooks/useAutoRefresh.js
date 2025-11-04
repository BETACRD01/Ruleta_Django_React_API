// src/hooks/useAutoRefresh.js
import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Hook para manejar actualización automática de datos
 * @param {Function} refreshFunction - Función que obtiene los datos actualizados
 * @param {Object} options - Opciones de configuración
 */
export function useAutoRefresh(refreshFunction, options = {}) {
  const {
    interval = 30000, // 30 segundos por defecto
    enabled = true,
    enabledWhen = () => true, // Condición para habilitar refresh
    onSuccess,
    onError,
    maxRetries = 3,
    retryDelay = 5000
  } = options;

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  
  const intervalRef = useRef(null);
  const retryTimeoutRef = useRef(null);
  const isUnmountedRef = useRef(false);

  // Función para ejecutar el refresh
  const executeRefresh = useCallback(async (isManual = false) => {
    if (isUnmountedRef.current || isRefreshing) return;
    
    // Verificar si el refresh está habilitado
    if (!enabled || !enabledWhen()) {
      return;
    }

    setIsRefreshing(true);
    setError(null);

    try {
      const result = await refreshFunction();
      
      if (!isUnmountedRef.current) {
        setLastRefresh(new Date());
        setRetryCount(0);
        
        if (onSuccess) {
          onSuccess(result, { isManual });
        }
      }
    } catch (err) {
      console.error('Auto-refresh error:', err);
      
      if (!isUnmountedRef.current) {
        setError(err);
        
        if (onError) {
          onError(err, { isManual, retryCount });
        }

        // Reintentar si no es manual y no se ha superado el límite
        if (!isManual && retryCount < maxRetries) {
          setRetryCount(prev => prev + 1);
          
          retryTimeoutRef.current = setTimeout(() => {
            if (!isUnmountedRef.current) {
              executeRefresh(false);
            }
          }, retryDelay);
        }
      }
    } finally {
      if (!isUnmountedRef.current) {
        setIsRefreshing(false);
      }
    }
  }, [refreshFunction, enabled, enabledWhen, isRefreshing, onSuccess, onError, retryCount, maxRetries, retryDelay]);

  // Función para refresh manual
  const manualRefresh = useCallback(() => {
    return executeRefresh(true);
  }, [executeRefresh]);

  // Configurar el intervalo automático
  useEffect(() => {
    if (!enabled || !enabledWhen()) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Ejecutar una vez al iniciar si no hay refresh previo
    if (!lastRefresh) {
      executeRefresh(false);
    }

    // Configurar intervalo
    intervalRef.current = setInterval(() => {
      executeRefresh(false);
    }, interval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, enabledWhen, interval, executeRefresh, lastRefresh]);

  // Cleanup al desmontar
  useEffect(() => {
    return () => {
      isUnmountedRef.current = true;
      
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  return {
    isRefreshing,
    lastRefresh,
    error,
    retryCount,
    manualRefresh,
    
    // Funciones de control
    start: () => {
      if (!intervalRef.current && enabled) {
        executeRefresh(false);
      }
    },
    
    stop: () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  };
}

/**
 * Hook específico para ruletas que necesitan actualización frecuente
 */
export function useRouletteAutoRefresh(roulette, refreshCallback, options = {}) {
  const shouldRefresh = useCallback(() => {
    if (!roulette) return false;
    
    // Refresh más frecuente para ruletas activas
    if (roulette.participation_is_open) return true;
    
    // Refresh para ruletas que tienen countdown activo
    if (roulette.time_remaining) {
      const hasActiveCountdown = 
        roulette.time_remaining.until_participation_start ||
        roulette.time_remaining.until_participation_end ||
        roulette.time_remaining.until_draw;
      return hasActiveCountdown;
    }
    
    // No refresh para ruletas completadas
    if (roulette.status === 'completed' || roulette.is_drawn) return false;
    
    return true;
  }, [roulette]);

  const refreshInterval = roulette?.participation_is_open ? 15000 : 30000; // 15s si activa, 30s normal

  return useAutoRefresh(refreshCallback, {
    interval: refreshInterval,
    enabledWhen: shouldRefresh,
    maxRetries: 2,
    retryDelay: 3000,
    ...options
  });
}