// src/components/user/AvailableRoulettesTab.jsx
import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  RefreshCcw, AlertTriangle, Users, Play, X, Download, Clock, Timer, 
  ChevronDown, ChevronUp, Trophy
} from 'lucide-react';
import { EmptyState } from '../UI';
import {
  roulettesAPI,
  participantsAPI,
  handleAPIError,
  isAuthenticated,
  API_URL,
} from '../../config/api';

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

const getParticipantsCount = (r) =>
  r?.participants_count ?? r?.participants ?? r?.stats?.participants_count ?? 0;

const toArray = (res) => (Array.isArray(res?.results) ? res.results : Array.isArray(res) ? res : []);

/* =========================
   Lógica de estado de ruleta
   ========================= */
const getRouletteState = (r) => {
  // Verificar si está completada/sorteada
  if (
    r?.status === 'cancelled' ||
    r?.status === 'completed' ||
    r?.is_drawn ||
    r?.drawn_at
  ) return 'completed';

  // Verificar si está activa o programada
  if (r?.status === 'active') return 'active';
  if (r?.status === 'scheduled') return 'scheduled';

  // Por defecto es completada
  return 'completed';
};

const isRouletteCompleted = (r) => getRouletteState(r) === 'completed';
const isRouletteActive = (r) => getRouletteState(r) === 'active';

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
    return "bg-purple-100 text-purple-800 border-purple-200";
  };

  if (isExpired) {
    return (
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border ${getUrgencyStyles()} ${className}`}>
        <Timer className="w-4 h-4" />
        <span>Sorteo finalizado</span>
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
   Linkify
   ========================= */
const LINK_COLOR_CLASS = "text-blue-600 underline hover:text-blue-800 hover:no-underline transition-colors";
const escapeHtml = (s = "") =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const autoLinkHTML = (plainText = "") => {
  const text = escapeHtml(plainText);
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
  let html = text.replace(emailRegex, (m) => `<a href="mailto:${m}" class="${LINK_COLOR_CLASS}">${m}</a>`);
  const urlRegex = /\b((https?:\/\/|www\.)[^\s<]+)\b/gi;
  html = html.replace(urlRegex, (m) => {
    const href = m.startsWith("http") ? m : `https://${m}`;
    return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="${LINK_COLOR_CLASS}">${m}</a>`;
  });
  return html.replace(/\n/g, "<br/>");
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
            className={`max-w-[95vw] max-h-[90vh] object-contain transition-transform duration-300 rounded-lg shadow-2xl
                        ${zoomed ? 'scale-150 cursor-zoom-out' : 'scale-100 cursor-zoom-in'}`}
            onClick={(e) => { e.stopPropagation(); setZoomed(z => !z); }}
            draggable={false}
          />
        </div>
      </div>
    </div>
  );
};

/* =========================
   Descripción expandible
   ========================= */
const ExpandableDescription = ({ description, maxLength = 150, className = "" }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  if (!description) return null;
  
  const shouldTruncate = description.length > maxLength;
  const displayText = isExpanded || !shouldTruncate ? description : description.substring(0, maxLength) + '...';
  
  return (
    <div className={`relative ${className}`}>
      <div
        className="text-sm text-gray-700 leading-relaxed"
        style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}
        dangerouslySetInnerHTML={{ __html: autoLinkHTML(displayText) }}
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
   Badge de estado
   ========================= */
const StatusBadge = ({ roulette, className = "" }) => {
  const state = getRouletteState(roulette);
  const participantsCount = getParticipantsCount(roulette);

  const getStatusInfo = () => {
    if (state === 'completed') {
      return { color: 'bg-green-100 text-green-800 border-green-200', text: 'Completada' };
    }
    if (state === 'active') {
      if (participantsCount === 0) {
        return { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', text: 'Sin participantes' };
      }
      return { color: 'bg-blue-100 text-blue-800 border-blue-200', text: 'Activa' };
    }
    if (state === 'scheduled') {
      return { color: 'bg-purple-100 text-purple-800 border-purple-200', text: 'Programada' };
    }
    return { color: 'bg-gray-100 text-gray-800 border-gray-200', text: 'Inactiva' };
  };

  const { color, text } = getStatusInfo();

  return (
    <span className={`inline-flex items-center px-2.5 py-1 text-xs font-medium border rounded-full ${color} ${className}`}>
      {text}
    </span>
  );
};

/* =========================
   Main Component
   ========================= */
const AvailableRoulettesTab = ({ roulettes: roulettesProp, myParticipations: myPartsProp }) => {
  const [filterStatus, setFilterStatus] = useState('active');
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');

  const [roulettes, setRoulettes] = useState(Array.isArray(roulettesProp) ? roulettesProp : []);
  const [myParticipations, setMyParticipations] = useState(Array.isArray(myPartsProp) ? myPartsProp : []);

  const busyRef = useRef(null);
  const [lightbox, setLightbox] = useState({ open: false, src: '', alt: '' });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setPageError('');
      
      // IMPORTANTE: Cargar TODAS las ruletas sin filtro de status
      const [rRes, pRes] = await Promise.all([
        roulettesAPI.getRoulettes({ page_size: 100 }), // Sin filtro status
        participantsAPI.getMyParticipations({ page_size: 200 }),
      ]);
      
      const list = toArray(rRes).map((r) => ({
        ...r,
        image_url: resolveImageUrl(r),
        participants_count: getParticipantsCount(r),
        scheduled_date: getScheduledDate(r),
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
      if (filterStatus === 'active') return isRouletteActive(r);
      if (filterStatus === 'completed') return isRouletteCompleted(r);
      return true;
    });

    return filtered.sort((a, b) => {
      const da = a.created_date, db = b.created_date;
      return new Date(db || 0) - new Date(da || 0);
    });
  }, [roulettes, filterStatus]);

  const handleRouletteComplete = useCallback((rouletteId) => {
    console.log(`Ruleta ${rouletteId} completada`);
    loadData();
  }, [loadData]);

  const shouldShowTimer = (roulette) => {
    if (!roulette?.scheduled_date) return false;
    const t = new Date(roulette.scheduled_date).getTime();
    return Number.isFinite(t) && t > Date.now();
  };

  return (
    <div className="space-y-6">
      {/* Filtros simplificados */}
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
              Activas
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

      {/* Errores */}
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

      {/* Estado de carga */}
      {loading && (
        <div className="py-12 text-center">
          <div className="inline-flex items-center gap-3 text-gray-600">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            Cargando ruletas disponibles...
          </div>
        </div>
      )}

      {/* Contenido principal */}
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
            const isCompleted = isRouletteCompleted(r);
            
            // Solo deshabilitar si está cargando - permitir ver completadas
            const ctaDisabled = busyRef.current === r.id;
            
            // Cambiar texto según estado
            const ctaLabel = isCompleted 
              ? 'Ver Resultados' 
              : participating 
                ? 'Ya participas — Entrar' 
                : 'Participar Ahora';

            const gridCtaClass = ctaDisabled
              ? 'pointer-events-none bg-gray-100 text-gray-500 border border-gray-200'
              : participating
                ? 'bg-white text-blue-600 border border-blue-600 hover:bg-blue-50'
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-sm hover:shadow-md transform hover:scale-105';

            const cardImg = r.image_url || resolveImageUrl(r);
            const showTimer = shouldShowTimer(r);

            return (
              <div
                key={r.id}
                className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200 flex flex-col h-full group"
              >
                {/* Portada */}
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
                    
                    {/* Cronómetro SOLO si hay scheduled_date */}
                    {showTimer && (
                      <div className="absolute top-3 right-3">
                        <CountdownTimer
                          endDate={r.scheduled_date}
                          onComplete={() => handleRouletteComplete(r.id)}
                          className="bg-white/95 backdrop-blur-sm shadow-lg text-xs"
                        />
                      </div>
                    )}
                    
                    {/* Badge de estado */}
                    <div className="absolute top-3 left-3">
                      <StatusBadge 
                        roulette={r}
                        className="bg-white/95 backdrop-blur-sm shadow-lg"
                      />
                    </div>
                  </AspectBox>
                </button>

                {/* Contenido */}
                <div className="p-5 flex flex-col gap-3 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                        {r.title || r.name || `Ruleta #${r.id}`}
                      </h3>
                    </div>
                  </div>

                  {/* Descripción */}
                  {r.description && (
                    <ExpandableDescription 
                      description={r.description} 
                      maxLength={120} 
                      className="flex-1"
                    />
                  )}

                  {/* Metadata - SOLO participantes siempre visible */}
                  <div className="flex items-center text-sm text-gray-600">
                    <span className="inline-flex items-center gap-1.5">
                      <Users className="h-4 w-4 text-blue-500" />
                      <span className="font-medium">{getParticipantsCount(r)} participantes</span>
                    </span>
                  </div>

                  {/* CTA */}
                  <div className="mt-auto pt-2">
                    <Link
                      to={`/ruletas/${r.id}/participar`}
                      onClick={(e) => {
                        if (!isAuthenticated()) {
                          e.preventDefault();
                          setPageError('Debes iniciar sesión para participar.');
                          return;
                        }
                        if (ctaDisabled) {
                          e.preventDefault();
                          return;
                        }
                        busyRef.current = r.id;
                        setTimeout(() => {
                          if (busyRef.current === r.id) busyRef.current = null;
                        }, 300);
                      }}
                      className={`w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold transition-all duration-200 ${gridCtaClass}`}
                    >
                      {busyRef.current === r.id ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Cargando...
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4" />
                          {ctaLabel}
                        </>
                      )}
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lightbox */}
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