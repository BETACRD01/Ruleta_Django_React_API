// src/components/user/AvailableRoulettesTab.jsx
import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  RefreshCcw, AlertTriangle, Users, Play, X, Download, Clock, Timer, 
  ChevronDown, ChevronUp, Trophy, Calendar, CalendarCheck, CalendarX2, Lock, CheckCircle
} from 'lucide-react';
import { EmptyState } from '../UI';
import {
  roulettesAPI,
  participantsAPI,
  handleAPIError,
  isAuthenticated,
  API_URL,
} from '../../config/api';
import '../../styles/ckeditor-custom.css';

/* =========================
   Helpers
   ========================= */
const resolveImageUrl = (r) => {
  const candidate = r?.image_url || r?.image || r?.cover_image || r?.banner || r?.thumbnail || r?.photo || r?.picture;
  if (!candidate) return null;
  try {
    const u = new URL(candidate);
    return u.href;
  } catch {
    const base = String(API_URL || '').replace(/\/api\/?$/i, '');
    const path = String(candidate).startsWith('/') ? candidate : `/${candidate}`;
    return `${base}${path}`;
  }
};

const normalizeDate = (r) =>
  r?.created_at || r?.created || r?.date_created || r?.timestamp || r?.updated_at || null;

const getScheduledDate = (r) =>
  r?.scheduled_date || r?.schedule_date || r?.draw_date || r?.end_date || null;

const getParticipationStart = (r) =>
  r?.participation_start || r?.start_date || null;

const getParticipationEnd = (r) =>
  r?.participation_end || r?.end_date || null;

const getParticipantsCount = (r) =>
  r?.participants_count ?? r?.participants ?? r?.stats?.participants_count ?? 0;

const toArray = (res) => (Array.isArray(res?.results) ? res.results : Array.isArray(res) ? res : []);

/* =========================
   ✅ LÓGICA CORREGIDA DE ESTADOS
   ========================= */

// ✅ Verificar si el SORTEO está completado (ganador seleccionado)
const isRouletteDrawn = (r) => {
  return Boolean(r?.is_drawn || r?.drawn_at || r?.winner_id);
};

// ✅ Verificar si la PARTICIPACIÓN está cerrada (fecha expirada)
const isParticipationClosed = (r) => {
  const participationEnd = getParticipationEnd(r);
  if (!participationEnd) return false;
  return new Date(participationEnd) <= new Date();
};

// ✅ Verificar si la participación está abierta
const isParticipationOpen = (roulette) => {
  const now = new Date();
  const participationStart = getParticipationStart(roulette);
  const participationEnd = getParticipationEnd(roulette);
  
  if (!participationStart) {
    if (participationEnd) {
      return new Date(participationEnd) > now;
    }
    return true;
  }
  
  const hasStarted = new Date(participationStart) <= now;
  
  if (participationEnd) {
    const hasNotEnded = new Date(participationEnd) > now;
    return hasStarted && hasNotEnded;
  }
  
  return hasStarted;
};

/* =========================
   ✅ ESTADOS CORREGIDOS
   ========================= */
const getRouletteState = (r) => {
  if (isRouletteDrawn(r)) {
    return 'completed';
  }
  
  if (r?.status === 'cancelled') {
    return 'cancelled';
  }
  
  if (isParticipationClosed(r)) {
    return 'waiting_draw';
  }
  
  if (isParticipationOpen(r)) {
    return 'active';
  }
  
  const participationStart = getParticipationStart(r);
  if (participationStart && new Date(participationStart) > new Date()) {
    return 'scheduled';
  }
  
  return 'draft';
};

/* =========================
   Formatear fechas
   ========================= */
const formatDate = (dateString) => {
  if (!dateString) return null;
  try {
    const date = new Date(dateString);
    const options = {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    };
    return date.toLocaleString('es-ES', options);
  } catch {
    return null;
  }
};

/* =========================
   Cronómetro
   ========================= */
const CountdownTimer = ({ endDate, onComplete, className = "" }) => {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [isActive, setIsActive] = useState(true);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    if (!endDate || !isActive) return;

    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const end = new Date(endDate).getTime();
      const difference = end - now;

      if (difference > 0) {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);

        setTimeLeft({ days, hours, minutes, seconds });
      } else {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        setIsActive(false);
        setIsExpired(true);
        onComplete?.();
      }
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(interval);
  }, [endDate, isActive, onComplete]);

  const getUrgencyStyles = () => {
    if (isExpired) return "bg-red-100 text-red-800 border-red-200";
    const totalMinutes = timeLeft.days * 24 * 60 + timeLeft.hours * 60 + timeLeft.minutes;
    if (totalMinutes < 60) return "bg-red-100 text-red-800 border-red-200";
    if (totalMinutes < 1440) return "bg-orange-100 text-orange-800 border-orange-200";
    return "bg-blue-100 text-blue-800 border-blue-200";
  };

  if (isExpired) {
    return (
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border ${getUrgencyStyles()} ${className}`}>
        <Timer className="w-4 h-4" />
        <span>Finalizado</span>
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border ${getUrgencyStyles()} ${className}`}>
      <Clock className="w-4 h-4" />
      <div className="flex items-center gap-1">
        {timeLeft.days > 0 && <span className="font-bold">{timeLeft.days}d</span>}
        {(timeLeft.days > 0 || timeLeft.hours > 0) && <span className="font-bold">{timeLeft.hours}h</span>}
        <span className="font-bold">{timeLeft.minutes}m</span>
        <span className="font-bold">{timeLeft.seconds}s</span>
      </div>
    </div>
  );
};

/* =========================
   SafeImage
   ========================= */
const SafeImage = ({ src, alt = '', className = '' }) => {
  const [displaySrc, setDisplaySrc] = useState(src || '');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setDisplaySrc(src || '');
    setError(false);
    setLoading(true);
  }, [src]);

  const handleLoad = () => setLoading(false);
  
  const handleError = () => {
    setLoading(false);
    setError(true);
  };

  if (!displaySrc || error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
        <div className="text-center text-gray-400">
          <div className="text-sm font-medium">Sin imagen</div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
      <img
        src={displaySrc}
        alt={alt}
        className={`${className} ${loading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
        decoding="async"
        loading="lazy"
        draggable={false}
        onLoad={handleLoad}
        onError={handleError}
      />
    </div>
  );
};

/* =========================
   AspectRatio 16:9 
   ========================= */
const AspectBox = ({ children, className = '' }) => (
  <div className={`relative w-full overflow-hidden rounded-t-xl ${className}`}>
    <div style={{ paddingTop: '56.25%' }} />
    <div className="absolute inset-0">{children}</div>
  </div>
);

/* =========================
   Lightbox
   ========================= */
const ImageLightbox = ({ open, src, alt = '', onClose }) => {
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
      if (e.key === ' ') { e.preventDefault(); setZoomed(z => !z); }
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100]">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="relative max-w-[95vw] max-h-[90vh]">
          <div className="absolute -top-16 right-0 flex items-center gap-3">
            {src && (
              <a
                href={src}
                download
                className="inline-flex items-center gap-2 text-sm px-4 py-2 rounded-lg bg-white/90 hover:bg-white text-gray-800 font-medium transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <Download className="h-4 w-4" />
                Descargar
              </a>
            )}
            <button
              onClick={onClose}
              className="inline-flex items-center gap-2 text-sm px-4 py-2 rounded-lg bg-white/90 hover:bg-white text-gray-800 font-medium transition-colors"
            >
              <X className="h-4 w-4" />
              Cerrar
            </button>
          </div>

          <img
            src={src}
            alt={alt}
            className={`max-w-[95vw] max-h-[90vh] object-contain transition-transform duration-300 rounded-lg shadow-2xl ${zoomed ? 'scale-150 cursor-zoom-out' : 'scale-100 cursor-zoom-in'}`}
            onClick={(e) => { e.stopPropagation(); setZoomed(z => !z); }}
            draggable={false}
          />
        </div>
      </div>
    </div>
  );
};

/* =========================
   Descripción expandible CON RENDERIZADO HTML
   ========================= */
const ExpandableDescription = ({ description, maxLength = 150, className = "" }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  if (!description) return null;
  
  // Crear un elemento temporal para extraer texto plano del HTML
  const getPlainText = (html) => {
    const temp = document.createElement('div');
    temp.innerHTML = html;
    return temp.textContent || temp.innerText || '';
  };
  
  const plainText = getPlainText(description);
  const shouldTruncate = plainText.length > maxLength;
  
  // Truncar el HTML de manera segura
  const getTruncatedHTML = (html, maxLen) => {
    const temp = document.createElement('div');
    temp.innerHTML = html;
    const text = temp.textContent || temp.innerText || '';
    
    if (text.length <= maxLen) return html;
    
    // Crear versión truncada simple
    const truncatedText = text.substring(0, maxLen) + '...';
    const wrapper = document.createElement('div');
    wrapper.textContent = truncatedText;
    return wrapper.innerHTML;
  };
  
  const displayHTML = isExpanded || !shouldTruncate 
    ? description 
    : getTruncatedHTML(description, maxLength);
  
  return (
    <div className={`relative ${className}`}>
      <div
        className="prose prose-sm max-w-none text-sm text-gray-700 leading-relaxed"
        style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}
        dangerouslySetInnerHTML={{ __html: displayHTML }}
      />
      
      {shouldTruncate && (
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
        >
          {isExpanded ? (
            <>
              <ChevronUp className="w-4 h-4" />
              Ver menos
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4" />
              Ver más
            </>
          )}
        </button>
      )}
    </div>
  );
};

/* =========================
   ✅ Badge de estado CORREGIDO
   ========================= */
const StatusBadge = ({ roulette, className = "" }) => {
  const state = getRouletteState(roulette);
  const participantsCount = getParticipantsCount(roulette);

  const getStatusInfo = () => {
    switch(state) {
      case 'completed':
        return { 
          color: 'bg-green-100 text-green-800 border-green-200', 
          text: '✓ Sorteo Realizado'
        };
      
      case 'waiting_draw':
        return { 
          color: 'bg-orange-100 text-orange-800 border-orange-200', 
          text: '⏳ Esperando Sorteo'
        };
      
      case 'active':
        if (participantsCount === 0) {
          return { 
            color: 'bg-yellow-100 text-yellow-800 border-yellow-200', 
            text: '⚠️ Sin participantes'
          };
        }
        return { 
          color: 'bg-blue-100 text-blue-800 border-blue-200', 
          text: '🎯 Abierta'
        };
      
      case 'scheduled':
        return { 
          color: 'bg-purple-100 text-purple-800 border-purple-200', 
          text: '📅 Próximamente'
        };
      
      case 'cancelled':
        return { 
          color: 'bg-red-100 text-red-800 border-red-200', 
          text: '❌ Cancelada'
        };
      
      default:
        return { 
          color: 'bg-gray-100 text-gray-800 border-gray-200', 
          text: '📝 Borrador'
        };
    }
  };

  const { color, text } = getStatusInfo();

  return (
    <span className={`inline-flex items-center px-2.5 py-1 text-xs font-medium border rounded-full ${color} ${className}`}>
      {text}
    </span>
  );
};

/* =========================
   Información de fechas
   ========================= */
const DateInfoPanel = ({ roulette, className = "" }) => {
  const participationStart = getParticipationStart(roulette);
  const participationEnd = getParticipationEnd(roulette);
  const scheduledDate = getScheduledDate(roulette);
  
  const now = new Date();
  const hasStarted = !participationStart || new Date(participationStart) <= now;
  const hasEnded = participationEnd && new Date(participationEnd) <= now;
  
  const showCountdown = hasStarted && !hasEnded && participationEnd;
  
  return (
    <div className={`space-y-2 ${className}`}>
      {participationStart && (
        <div className="flex items-start gap-2 text-xs">
          <Calendar className={`h-4 w-4 flex-shrink-0 mt-0.5 ${hasStarted ? 'text-green-500' : 'text-blue-500'}`} />
          <div className="flex-1">
            <div>
              <span className="font-medium text-gray-700">Inicio:</span>
              <span className="ml-1 text-gray-600">{formatDate(participationStart)}</span>
              {!hasStarted && (
                <span className="ml-2 text-blue-600 font-medium">(Próximamente)</span>
              )}
            </div>
            {!hasStarted && (
              <div className="mt-1">
                <CountdownTimer
                  endDate={participationStart}
                  onComplete={() => {}}
                  className="text-xs"
                />
              </div>
            )}
          </div>
        </div>
      )}
      
      {participationEnd && (
        <div className="flex items-start gap-2 text-xs">
          <CalendarX2 className={`h-4 w-4 flex-shrink-0 mt-0.5 ${hasEnded ? 'text-red-500' : 'text-orange-500'}`} />
          <div className="flex-1">
            <div>
              <span className="font-medium text-gray-700">Cierre:</span>
              <span className="ml-1 text-gray-600">{formatDate(participationEnd)}</span>
            </div>
            {showCountdown && (
              <div className="mt-1">
                <CountdownTimer
                  endDate={participationEnd}
                  onComplete={() => {}}
                  className="text-xs"
                />
              </div>
            )}
            {!hasStarted && !hasEnded && (
              <span className="text-gray-500 text-xs mt-1 block">
                (Esperando inicio de participación)
              </span>
            )}
          </div>
        </div>
      )}
      
      {scheduledDate && (
        <div className="flex items-start gap-2 text-xs">
          <CalendarCheck className="h-4 w-4 flex-shrink-0 mt-0.5 text-purple-500" />
          <div>
            <span className="font-medium text-gray-700">Sorteo:</span>
            <span className="ml-1 text-gray-600">{formatDate(scheduledDate)}</span>
            <span className="ml-2 text-purple-600 font-medium">(Manual)</span>
          </div>
        </div>
      )}
      
      {!participationStart && !participationEnd && !scheduledDate && (
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Clock className="h-4 w-4" />
          <span>Sin fechas programadas</span>
        </div>
      )}
    </div>
  );
};

/* =========================
   Main Component
   ========================= */
const AvailableRoulettesTab = ({ roulettes: roulettesProp, myParticipations: myPartsProp }) => {
  const [filterStatus, setFilterStatus] = useState('active');
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [, forceUpdate] = useState(0);

  const [roulettes, setRoulettes] = useState(Array.isArray(roulettesProp) ? roulettesProp : []);
  const [myParticipations, setMyParticipations] = useState(Array.isArray(myPartsProp) ? myPartsProp : []);

  const busyRef = useRef(null);
  const [lightbox, setLightbox] = useState({ open: false, src: '', alt: '' });

  useEffect(() => {
    const interval = setInterval(() => {
      forceUpdate(prev => prev + 1);
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setPageError('');
      
      const [rRes, pRes] = await Promise.all([
        roulettesAPI.getRoulettes({ page_size: 100 }),
        participantsAPI.getMyParticipations({ page_size: 200 }),
      ]);
      
      const list = toArray(rRes).map((r) => ({
        ...r,
        image_url: resolveImageUrl(r),
        participants_count: getParticipantsCount(r),
        scheduled_date: getScheduledDate(r),
        participation_start: getParticipationStart(r),
        participation_end: getParticipationEnd(r),
        created_date: normalizeDate(r),
      }));
      
      setRoulettes(list);
      setMyParticipations(toArray(pRes));
    } catch (err) {
      setPageError(handleAPIError(err, 'No se pudieron cargar las ruletas.'));
      console.error('Error loading roulettes:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const needsFetch = !Array.isArray(roulettesProp) || !Array.isArray(myPartsProp);
    if (needsFetch) loadData();
    else setLoading(false);
  }, [roulettesProp, myPartsProp, loadData]);

  const isParticipating = useCallback(
    (rouletteId) =>
      Array.isArray(myParticipations) &&
      myParticipations.some(
        (p) => String(p?.roulette_id ?? p?.rouletteId ?? p?.roulette) === String(rouletteId)
      ),
    [myParticipations]
  );

  const filteredRoulettes = useMemo(() => {
    const list = Array.isArray(roulettes) ? roulettes : [];

    const filtered = list.filter((r) => {
      const state = getRouletteState(r);
      
      if (filterStatus === 'active') {
        return state === 'active' || state === 'scheduled';
      }
      if (filterStatus === 'completed') {
        return state === 'completed';
      }
      return true;
    });

    return filtered.sort((a, b) => {
      const da = a.created_date, db = b.created_date;
      return new Date(db || 0) - new Date(da || 0);
    });
  }, [roulettes, filterStatus]);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => setFilterStatus('active')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterStatus === 'active' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Disponibles
            </button>
            <button
              onClick={() => setFilterStatus('completed')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterStatus === 'completed' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Completadas
            </button>
          </div>
          
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium disabled:opacity-50"
            title="Refrescar"
          >
            <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refrescar
          </button>
        </div>
      </div>

      {pageError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-medium text-red-900">Error al cargar</h3>
              <p className="text-red-700 text-sm mt-1">{pageError}</p>
              <button
                onClick={loadData}
                className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
              >
                Reintentar
              </button>
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="py-12 text-center">
          <div className="inline-flex items-center gap-3 text-gray-600">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            Cargando ruletas disponibles...
          </div>
        </div>
      )}

      {!loading && filteredRoulettes.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="No hay ruletas disponibles"
          description="No hay ruletas con este filtro en este momento."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRoulettes.map((r) => {
            const participating = isParticipating(r.id);
            const state = getRouletteState(r);
            const isCompleted = state === 'completed';
            const isWaitingDraw = state === 'waiting_draw';
            const participationOpen = isParticipationOpen(r);
            
            let ctaDisabled = false;
            let ctaLabel = 'Participar Ahora';
            let ctaStyle = 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-sm hover:shadow-md transform hover:scale-105';
            let CtaIcon = Play;
            
            if (isCompleted) {
              ctaLabel = 'Ver Ganador';
              ctaStyle = 'bg-green-600 hover:bg-green-700 text-white shadow-sm';
              CtaIcon = Trophy;
              ctaDisabled = false;
            } else if (isWaitingDraw) {
              ctaLabel = 'Participación Cerrada';
              ctaStyle = 'bg-orange-100 text-orange-700 border border-orange-200 cursor-not-allowed';
              CtaIcon = Lock;
              ctaDisabled = true;
            } else if (state === 'scheduled') {
              ctaLabel = 'Próximamente';
              ctaStyle = 'bg-purple-100 text-purple-700 border border-purple-200 cursor-not-allowed';
              CtaIcon = Calendar;
              ctaDisabled = true;
            } else if (state === 'cancelled') {
              ctaLabel = 'Ruleta Cancelada';
              ctaStyle = 'bg-red-100 text-red-700 border border-red-200 cursor-not-allowed';
              CtaIcon = X;
              ctaDisabled = true;
            } else if (participationOpen) {
              if (participating) {
                ctaLabel = 'Ya participas — Entrar';
                ctaStyle = 'bg-white text-blue-600 border border-blue-600 hover:bg-blue-50';
                CtaIcon = CheckCircle;
              } else {
                ctaLabel = 'Participar Ahora';
                ctaStyle = 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-sm hover:shadow-md transform hover:scale-105';
                CtaIcon = Play;
              }
              ctaDisabled = false;
            } else {
              ctaLabel = 'No Disponible';
              ctaStyle = 'bg-gray-100 text-gray-500 border border-gray-200 cursor-not-allowed';
              CtaIcon = Lock;
              ctaDisabled = true;
            }

            const cardImg = r.image_url || resolveImageUrl(r);

            return (
              <div
                key={r.id}
                className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200 flex flex-col h-full group"
              >
                <button
                  type="button"
                  className="w-full cursor-zoom-in relative overflow-hidden"
                  onClick={() => cardImg && setLightbox({ open: true, src: cardImg, alt: r.title || r.name || 'Portada' })}
                  aria-label="Ver portada en grande"
                >
                  <AspectBox className="bg-gray-50">
                    <SafeImage
                      src={cardImg}
                      alt={r.title || r.name || 'Ruleta'}
                      className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    
                    <div className="absolute top-3 left-3">
                      <StatusBadge 
                        roulette={r}
                        className="bg-white/95 backdrop-blur-sm shadow-lg"
                      />
                    </div>
                    
                    {(state === 'scheduled' || isWaitingDraw) && (
                      <div className="absolute top-3 right-3">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200 rounded-full shadow-lg backdrop-blur-sm">
                          <Lock className="w-3 h-3" />
                          {state === 'scheduled' ? 'Bloqueada' : 'Cerrada'}
                        </span>
                      </div>
                    )}
                  </AspectBox>
                </button>

                <div className="p-5 flex flex-col gap-3 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                        {r.title || r.name || `Ruleta #${r.id}`}
                      </h3>
                    </div>
                  </div>

                  {r.description && (
                    <ExpandableDescription 
                      description={r.description} 
                      maxLength={100} 
                      className="flex-1"
                    />
                  )}

                  <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                    <DateInfoPanel roulette={r} />
                  </div>

                  {isWaitingDraw && (
                    <div className="bg-orange-50 border-l-4 border-orange-400 p-3 rounded-r-lg">
                      <div className="flex items-start gap-2">
                        <Clock className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
                        <div className="text-xs text-orange-800">
                          <p className="font-medium">Participación cerrada</p>
                          <p className="mt-1">El administrador ejecutará el sorteo próximamente</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {state === 'scheduled' && (
                    <div className="bg-purple-50 border-l-4 border-purple-400 p-3 rounded-r-lg">
                      <div className="flex items-start gap-2">
                        <Calendar className="h-4 w-4 text-purple-600 mt-0.5 flex-shrink-0" />
                        <div className="text-xs text-purple-800">
                          <p className="font-medium">Participación próximamente</p>
                          <p className="mt-1">Espera a que inicie para poder participar</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center text-sm text-gray-600">
                    <span className="inline-flex items-center gap-1.5">
                      <Users className="h-4 w-4 text-blue-500" />
                      <span className="font-medium">{getParticipantsCount(r)} participantes</span>
                    </span>
                  </div>

                  <div className="mt-auto pt-2">
                    {ctaDisabled ? (
                      <button
                        disabled
                        className={`w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold transition-all duration-200 ${ctaStyle}`}
                      >
                        <CtaIcon className="h-4 w-4" />
                        {ctaLabel}
                      </button>
                    ) : (
                      <Link
                        to={`/ruletas/${r.id}/participar`}
                        onClick={(e) => {
                          if (!isAuthenticated()) {
                            e.preventDefault();
                            setPageError('Debes iniciar sesión para participar.');
                            return;
                          }
                          busyRef.current = r.id;
                          setTimeout(() => {
                            if (busyRef.current === r.id) busyRef.current = null;
                          }, 300);
                        }}
                        className={`w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold transition-all duration-200 ${ctaStyle}`}
                      >
                        {busyRef.current === r.id ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            Cargando...
                          </>
                        ) : (
                          <>
                            <CtaIcon className="h-4 w-4" />
                            {ctaLabel}
                          </>
                        )}
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ImageLightbox
        open={lightbox.open}
        src={lightbox.src}
        alt={lightbox.alt}
        onClose={() => setLightbox({ open: false, src: '', alt: '' })}
      />
    </div>
  );
};

export default AvailableRoulettesTab;