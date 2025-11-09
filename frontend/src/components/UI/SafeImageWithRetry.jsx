// src/components/UI/SafeImageWithRetry.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AlertCircle } from 'lucide-react';

/**
 * Componente que carga imágenes con reintentos automáticos y fallback
 * 
 * @param {string} src - URL de la imagen
 * @param {string} alt - Texto alternativo
 * @param {string} className - Clases CSS de Tailwind
 * @param {number} maxRetries - Máximo número de reintentos (default: 3)
 * @param {number} retryDelay - Delay entre reintentos en ms (default: 2000)
 * @param {React.CSSProperties} style - Estilos inline
 * @param {string} placeholderBg - Color de fondo del placeholder (default: 'bg-gray-200')
 * @param {boolean} showError - Mostrar icono de error (default: true)
 */
const SafeImageWithRetry = React.forwardRef(({
  src,
  alt = 'Imagen',
  className = '',
  maxRetries = 3,
  retryDelay = 2000,
  style,
  placeholderBg = 'bg-gray-200',
  showError = true,
  ...rest
}, ref) => {
  const [state, setState] = useState('loading'); // 'loading' | 'loaded' | 'error'
  const [currentSrc, setCurrentSrc] = useState(src);
  const [retryCount, setRetryCount] = useState(0);
  const imgRef = useRef(null);
  const timeoutRef = useRef(null);

  /**
   * Maneja el error de carga y reintenta si es posible
   */
  const handleError = useCallback(() => {
    if (retryCount < maxRetries) {
      setState('loading');
      setRetryCount(prev => prev + 1);
      
      // Esperar antes de reintentar (backoff progresivo)
      timeoutRef.current = setTimeout(() => {
        if (imgRef.current) {
          imgRef.current.src = currentSrc;
        }
      }, retryDelay * (retryCount + 1));
    } else {
      setState('error');
    }
  }, [retryCount, maxRetries, retryDelay, currentSrc]);

  /**
   * Maneja la carga exitosa
   */
  const handleLoad = useCallback(() => {
    setState('loaded');
    setRetryCount(0);
  }, []);

  /**
   * Efecto para cambios de src
   */
  useEffect(() => {
    if (!src) {
      setState('error');
      return;
    }

    setCurrentSrc(src);
    setState('loading');
    setRetryCount(0);
    
    // Limpiar timeout previo
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, [src]);

  /**
   * Limpiar timeouts al desmontar
   */
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Estado de error: mostrar placeholder o icono
  if (state === 'error' || !src) {
    return (
      <div
        ref={ref}
        className={`flex items-center justify-center ${placeholderBg} ${className}`}
        style={style}
        aria-label={`Error al cargar: ${alt}`}
        {...rest}
      >
        {showError && (
          <div className="flex flex-col items-center justify-center text-gray-400 pointer-events-none">
            <AlertCircle className="w-8 h-8 mb-1 opacity-60" />
            <span className="text-xs font-medium opacity-50">Error</span>
          </div>
        )}
      </div>
    );
  }

  // Estado de carga: mostrar placeholder
  if (state === 'loading') {
    return (
      <>
        <img
          ref={(el) => {
            imgRef.current = el;
            if (ref) {
              if (typeof ref === 'function') ref(el);
              else ref.current = el;
            }
          }}
          src={currentSrc}
          alt={alt}
          onLoad={handleLoad}
          onError={handleError}
          className={`${className}`}
          style={{ ...style, visibility: 'hidden', display: 'none' }}
          {...rest}
        />
        <div
          className={`flex items-center justify-center ${placeholderBg} ${className}`}
          style={style}
          aria-label={`Cargando: ${alt}`}
        >
          <div className="flex flex-col items-center justify-center">
            <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-500 rounded-full animate-spin"></div>
          </div>
        </div>
      </>
    );
  }

  // Estado de carga exitosa: mostrar imagen
  return (
    <img
      ref={(el) => {
        imgRef.current = el;
        if (ref) {
          if (typeof ref === 'function') ref(el);
          else ref.current = el;
        }
      }}
      src={currentSrc}
      alt={alt}
      onLoad={handleLoad}
      onError={handleError}
      className={className}
      style={style}
      {...rest}
    />
  );
});

SafeImageWithRetry.displayName = 'SafeImageWithRetry';

export default SafeImageWithRetry;