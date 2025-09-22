// src/components/user/AvailableRoulettesTab.jsx
import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Search, Filter, Trophy, RefreshCcw, AlertTriangle, Users, Calendar, 
  Play, X, Download, Clock, Timer, ChevronDown, ChevronUp
} from 'lucide-react';
import { EmptyState } from '../UI';
import {
  roulettesAPI,
  participantsAPI,
  handleAPIError,
  isAuthenticated,
  API_URL,
  formatters,
} from '../../config/api';

/* =========================
   Helpers mejorados
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

const getParticipationEnd = (r) =>
  r?.participation_end || r?.end_date || r?.closing_date || null;

const getParticipantsCount = (r) =>
  r?.participants_count ?? r?.participants ?? r?.stats?.participants_count ?? 0;

const toArray = (res) => (Array.isArray(res?.results) ? res.results : Array.isArray(res) ? res : []);

/* =========================
   Cronómetro integrado
   ========================= */
const CountdownTimer = ({ endDate, label = "Tiempo restante", onComplete, className = "", type = "default" }) => {
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
    if (isExpired) {
      return "bg-red-100 text-red-800 border-red-200";
    }
    
    const totalMinutes = timeLeft.days * 24 * 60 + timeLeft.hours * 60 + timeLeft.minutes;
    if (totalMinutes < 60) return "bg-red-100 text-red-800 border-red-200";
    if (totalMinutes < 1440) return "bg-orange-100 text-orange-800 border-orange-200";
    if (type === "draw") return "bg-purple-100 text-purple-800 border-purple-200";
    return "bg-blue-100 text-blue-800 border-blue-200";
  };

  if (isExpired) {
    return (
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border ${getUrgencyStyles()} ${className}`}>
        <Timer className="w-4 h-4" />
        <span>{type === "draw" ? "Sorteo finalizado" : "Participación cerrada"}</span>
      </div>
    );
  }

  if (!isActive && timeLeft.days === 0 && timeLeft.hours === 0 && timeLeft.minutes === 0 && timeLeft.seconds === 0) {
    return null;
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
   Linkify mejorado
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
   Imagen simplificada sin iconos
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
   Lightbox simplificado
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
   Componente de descripción expandible
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
   Badge de estado simplificado
   ========================= */
const StatusBadge = ({ status, isDrawn, participantsCount, className = "" }) => {
  const getStatusInfo = () => {
    if (isDrawn) return { color: 'bg-green-100 text-green-800 border-green-200', text: 'Completada' };
    if (status === 'active') {
      if (participantsCount === 0) return { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', text: 'Sin participantes' };
      return { color: 'bg-blue-100 text-blue-800 border-blue-200', text: 'Activa' };
    }
    if (status === 'scheduled') return { color: 'bg-purple-100 text-purple-800 border-purple-200', text: 'Programada' };
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
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [viewMode, setViewMode] = useState('grid');

  const [roulettes, setRoulettes] = useState(Array.isArray(roulettesProp) ? roulettesProp : []);
  const [myParticipations, setMyParticipations] = useState(Array.isArray(myPartsProp) ? myPartsProp : []);

  const busyRef = useRef(null);
  const [lightbox, setLightbox] = useState({ open: false, src: '', alt: '' });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setPageError('');
      
      const [rRes, pRes] = await Promise.all([
        roulettesAPI.getRoulettes({ status: 'active', page_size: 100 }),
        participantsAPI.getMyParticipations({ page_size: 200 }),
      ]);
      
      const list = toArray(rRes).map((r) => ({
        ...r,
        image_url: resolveImageUrl(r),
        participants_count: getParticipantsCount(r),
        scheduled_date: getScheduledDate(r),
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
    const s = searchTerm.toLowerCase().trim();

    const filtered = list.filter((r) => {
      const title = (r.title || r.name || '').toLowerCase();
      const desc = (r.description || '').toLowerCase();
      return !s || title.includes(s) || desc.includes(s);
    });

    return filtered.sort((a, b) => {
      const da = a.created_date, db = b.created_date;
      const sa = a.scheduled_date, sb = b.scheduled_date;
      
      switch (sortBy) {
        case 'newest': 
          return new Date(db || 0) - new Date(da || 0);
        case 'oldest': 
          return new Date(da || 0) - new Date(db || 0);
        case 'most-participants': 
          return getParticipantsCount(b) - getParticipantsCount(a);
        case 'least-participants': 
          return getParticipantsCount(a) - getParticipantsCount(b);
        case 'ending-soon':
          if (!sa && !sb) return 0;
          if (!sa) return 1;
          if (!sb) return -1;
          return new Date(sa) - new Date(sb);
        default: 
          return 0;
      }
    });
  }, [roulettes, searchTerm, sortBy]);

  const handleRouletteComplete = useCallback((rouletteId) => {
    console.log(`Ruleta ${rouletteId} completada`);
    loadData();
  }, [loadData]);

  // Función para determinar si debe mostrar cronómetro
  const shouldShowTimer = (roulette) => {
    const now = new Date().getTime();
    const participationEnd = roulette.participation_end ? new Date(roulette.participation_end).getTime() : null;
    const scheduledDate = roulette.scheduled_date ? new Date(roulette.scheduled_date).getTime() : null;
    
    // Mostrar si hay fechas futuras o recién pasadas (menos de 1 hora)
    const recentThreshold = 60 * 60 * 1000; // 1 hora
    
    return (
      (participationEnd && participationEnd > (now - recentThreshold)) ||
      (scheduledDate && scheduledDate > (now - recentThreshold))
    );
  };

  return (
    <div className="space-y-6">
      {/* Controles */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Buscador */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                placeholder="Buscar ruletas por nombre o descripción..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
            </div>
          </div>
          
          {/* Controles */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="newest">Más recientes</option>
                <option value="oldest">Más antiguos</option>
                <option value="most-participants">Más participantes</option>
                <option value="least-participants">Menos participantes</option>
                <option value="ending-soon">Terminan pronto</option>
              </select>
            </div>
            
            {/* Selector de vista */}
            <div className="flex border border-gray-300 rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-2 text-sm ${viewMode === 'grid' ? 'bg-blue-500 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'} transition-colors`}
              >
                Grid
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-2 text-sm ${viewMode === 'list' ? 'bg-blue-500 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'} transition-colors`}
              >
                Lista
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

        {/* Estadísticas */}
        <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-gray-600">
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
          description={searchTerm ? 'No se encontraron ruletas con ese término de búsqueda' : 'No hay ruletas activas en este momento. ¡Vuelve pronto!'}
        />
      ) : (
        <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'space-y-4'}>
          {filteredRoulettes.map((r) => {
            const participating = isParticipating(r.id);
            const disabled = participating || busyRef.current === r.id || r.status === 'completed' || r.is_drawn;
            const cardImg = r.image_url || resolveImageUrl(r);
            const showTimer = shouldShowTimer(r);

            if (viewMode === 'list') {
              return (
                <div
                  key={r.id}
                  className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex gap-6">
                    {/* Imagen */}
                    <button
                      type="button"
                      className="flex-shrink-0 cursor-zoom-in"
                      onClick={() => cardImg && setLightbox({ open: true, src: cardImg, alt: r.title || r.name || 'Portada' })}
                    >
                      <div className="w-32 h-20 rounded-lg overflow-hidden">
                        <SafeImage
                          src={cardImg}
                          alt={r.title || r.name || 'Ruleta'}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </button>

                    {/* Contenido */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg font-semibold text-gray-900 truncate">
                            {r.title || r.name || `Ruleta #${r.id}`}
                          </h3>
                          <div className="flex items-center gap-3 mt-2 flex-wrap">
                            <StatusBadge 
                              status={r.status} 
                              isDrawn={r.is_drawn} 
                              participantsCount={getParticipantsCount(r)} 
                            />
                            {/* Cronómetros integrados */}
                            {showTimer && (
                              <div className="flex gap-2">
                                {r.participation_end && new Date(r.participation_end) > new Date() && (
                                  <CountdownTimer
                                    endDate={r.participation_end}
                                    label="Fin participación"
                                    onComplete={() => handleRouletteComplete(r.id)}
                                    type="participation"
                                  />
                                )}
                                {r.scheduled_date && new Date(r.scheduled_date) > new Date() && (
                                  <CountdownTimer
                                    endDate={r.scheduled_date}
                                    label="Sorteo"
                                    onComplete={() => handleRouletteComplete(r.id)}
                                    type="draw"
                                  />
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        <Link
                          to={`/ruletas/${r.id}/participar`}
                          onClick={(e) => {
                            if (!isAuthenticated()) {
                              e.preventDefault();
                              setPageError('Debes iniciar sesión para participar.');
                              return;
                            }
                            if (disabled) {
                              e.preventDefault();
                              return;
                            }
                            busyRef.current = r.id;
                            setTimeout(() => {
                              if (busyRef.current === r.id) busyRef.current = null;
                            }, 300);
                          }}
                          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            disabled 
                              ? 'pointer-events-none bg-gray-200 text-gray-500' 
                              : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm hover:shadow-md'
                          }`}
                        >
                          <Play className="h-4 w-4" />
                          {participating ? 'Participando' : 'Participar'}
                        </Link>
                      </div>

                      {/* Descripción expandible */}
                      {r.description && (
                        <ExpandableDescription 
                          description={r.description} 
                          maxLength={200} 
                          className="mb-3"
                        />
                      )}

                      {/* Metadata */}
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span className="inline-flex items-center gap-1.5">
                          <Users className="h-4 w-4" />
                          {getParticipantsCount(r)} participantes
                        </span>
                        {r.created_date && (
                          <span className="inline-flex items-center gap-1.5">
                            <Calendar className="h-4 w-4" />
                            {formatters.date(r.created_date, { year: 'numeric', month: 'short', day: 'numeric' })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            // Vista Grid (por defecto)
            return (
              <div
                key={r.id}
                className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200 flex flex-col h-full group"
              >
                {/* Portada con AspectRatio 16:9 */}
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
                    
                    {/* Overlay con cronómetros en posición absoluta */}
                    {showTimer && (
                      <div className="absolute top-3 right-3 flex flex-col gap-1">
                        {r.participation_end && new Date(r.participation_end) > new Date() && (
                          <CountdownTimer
                            endDate={r.participation_end}
                            onComplete={() => handleRouletteComplete(r.id)}
                            type="participation"
                            className="bg-white/95 backdrop-blur-sm shadow-lg text-xs"
                          />
                        )}
                        {r.scheduled_date && new Date(r.scheduled_date) > new Date() && (
                          <CountdownTimer
                            endDate={r.scheduled_date}
                            onComplete={() => handleRouletteComplete(r.id)}
                            type="draw"
                            className="bg-white/95 backdrop-blur-sm shadow-lg text-xs"
                          />
                        )}
                      </div>
                    )}
                    
                    {/* Badge de estado */}
                    <div className="absolute top-3 left-3">
                      <StatusBadge 
                        status={r.status} 
                        isDrawn={r.is_drawn} 
                        participantsCount={getParticipantsCount(r)} 
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

                  {/* Descripción expandible */}
                  {r.description && (
                    <ExpandableDescription 
                      description={r.description} 
                      maxLength={120} 
                      className="flex-1"
                    />
                  )}



                  {/* Metadata */}
                  <div className="flex items-center justify-between text-sm text-gray-600">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center gap-1.5">
                        <Users className="h-4 w-4 text-blue-500" />
                        <span className="font-medium">{getParticipantsCount(r)}</span>
                      </span>
                      {r.created_date && (
                        <span className="inline-flex items-center gap-1.5">
                          <Calendar className="h-4 w-4 text-gray-400" />
                          <span>{formatters.date(r.created_date, { month: 'short', day: 'numeric' })}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* CTA pegado al fondo */}
                  <div className="mt-auto pt-2">
                    <Link
                      to={`/ruletas/${r.id}/participar`}
                      onClick={(e) => {
                        if (!isAuthenticated()) {
                          e.preventDefault();
                          setPageError('Debes iniciar sesión para participar.');
                          return;
                        }
                        if (disabled) {
                          e.preventDefault();
                          return;
                        }
                        busyRef.current = r.id;
                        setTimeout(() => {
                          if (busyRef.current === r.id) busyRef.current = null;
                        }, 300);
                      }}
                      className={`w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold transition-all duration-200 ${
                        disabled 
                          ? 'pointer-events-none bg-gray-100 text-gray-500 border border-gray-200' 
                          : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-sm hover:shadow-md transform hover:scale-105'
                      }`}
                    >
                      {busyRef.current === r.id ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Cargando...
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4" />
                          {participating ? 'Ya Participas' : 'Participar Ahora'}
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

      {/* Lightbox global */}
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