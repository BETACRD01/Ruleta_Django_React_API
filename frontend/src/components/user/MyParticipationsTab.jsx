import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, Filter, Calendar, Eye, Trophy, RefreshCw, AlertTriangle, X, User, Clock, XCircle, Gift } from 'lucide-react';
import { Button } from '../UI';
import { participantsAPI, handleAPIError, API_URL, formatters } from '../../config/api';

/* -----------------------
   Helpers
-------------------------*/
const resolveImageUrl = (imageUrl) => {
  if (!imageUrl) return null;

  // Si ya es absoluta
  try { return new URL(imageUrl).href; } catch {}

  // Si es relativa -> componer con el host de la API (quitando /api al final)
  try {
    const base = String(API_URL || '').replace(/\/api\/?$/i, '');
    const path = String(imageUrl).startsWith('/') ? imageUrl : `/${imageUrl}`;
    return `${base}${path}`;
  } catch {
    return null;
  }
};

const toArray = (res) => {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.results)) return res.results;
  if (Array.isArray(res?.participations)) return res.participations;
  if (Array.isArray(res?.data)) return res.data;
  return [];
};

const getParticipationState = (p) => {
  if (p?.participation_state) return p.participation_state;
  if (p?.is_winner) return 'won';

  const roulette = p?.roulette || {};
  if (
    roulette.status === 'cancelled' ||
    roulette.status === 'completed' ||
    roulette.is_drawn ||
    roulette.drawn_at
  ) return 'completed';

  if (roulette.status === 'active' || roulette.status === 'scheduled') return 'active';
  return 'completed';
};

const isWinner = (p) => getParticipationState(p) === 'won';
const isActive = (p) => getParticipationState(p) === 'active';
const isCompleted = (p) => getParticipationState(p) === 'completed';

const getRouletteTitle = (p) => p?.roulette_name || p?.roulette?.name || 'Sorteo';

const getRouletteImage = (p) => {
  const first =
    p?.roulette_image_url ||
    p?.rouletteImageUrl ||
    p?.roulette?.cover_image?.url ||
    p?.roulette?.cover_image ||
    p?.roulette?.image ||
    p?.roulette?.banner ||
    p?.roulette?.thumbnail ||
    null;

  return resolveImageUrl(first);
};

/** SOLO devuelve la URL del PREMIO si existe (sin fallback a ruleta).
 *  La idea es poder mostrar un placeholder *de premio* si falta.
 */
const getPrizeImageRaw = (p) => {
  if (!isWinner(p)) return null;

  const first =
    p?.prize_image_url ||
    p?.prizeImageUrl ||
    p?.won_prize?.image ||
    p?.wonPrize?.image ||
    p?.prize?.image_url ||
    p?.prize?.image ||
    p?.prizeImage ||
    p?.prize_image ||
    null;

  return resolveImageUrl(first);
};

const getPrizePosition = (p) => p?.prize_position || p?.position || 1;

const equalsIgnoreCaseTrim = (a = '', b = '') =>
  String(a).trim().toLowerCase() === String(b).trim().toLowerCase();

const getPrizeName = (p) => {
  if (!isWinner(p)) return null;
  const prizeName = p?.prize_name || p?.won_prize?.name || p?.wonPrize?.name || null;
  const title = getRouletteTitle(p);
  if (!prizeName) return null;
  return equalsIgnoreCaseTrim(prizeName, title) ? null : prizeName;
};

const getPrizeDescription = (p) =>
  p?.prize_description || p?.won_prize?.description || p?.wonPrize?.description || null;

const getNumber = (p) => p?.participant_number ?? p?.number ?? null;
const getCreatedISO = (p) => p?.created_at || null;
const getScheduledISO = (p) => p?.scheduled_date || null;

/* Imagen robusta con placeholder configurable (ruleta vs premio) */
const SafeImage = ({ src, alt = '', className = '', kind = 'roulette' /* 'roulette' | 'prize' */ }) => {
  const [error, setError] = useState(false);
  const resolved = src ? resolveImageUrl(src) : null;

  if (!resolved || error) {
    const isPrize = kind === 'prize';
    return (
      <div className={`w-full h-full flex items-center justify-center bg-gray-100 ${className.includes('rounded') ? '' : 'rounded'}`}>
        {isPrize ? (
          <Gift className="h-5 w-5 text-gray-300" />
        ) : (
          <Trophy className="h-5 w-5 text-gray-300" />
        )}
      </div>
    );
  }
  return (
    <img
      src={resolved}
      alt={alt}
      className={className}
      onError={() => setError(true)}
      decoding="async"
      loading="lazy"
      draggable={false}
    />
  );
};

/* -----------------------
   Modal de Detalles
-------------------------*/
const ParticipationDetailModal = ({ participation, isOpen, onClose }) => {
  if (!isOpen || !participation) return null;

  const state = getParticipationState(participation);
  const title = getRouletteTitle(participation);
  const headerImg = getRouletteImage(participation); // header = imagen de la ruleta
  const number = getNumber(participation);
  const createdISO = getCreatedISO(participation);
  const scheduledISO = getScheduledISO(participation);
  const prizeName = getPrizeName(participation);
  const prizeImg = getPrizeImageRaw(participation); // puede ser null → placeholder de premio

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Detalles de Participación</h3>
          <Button variant="ghost" size="sm" onClick={onClose} className="p-2">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Imagen y título principal */}
          <div className="flex items-start gap-4">
            <div className="w-20 h-16 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
              <SafeImage src={headerImg} alt={title} className="w-full h-full object-cover" kind="roulette" />
            </div>
            <div className="flex-1">
              <h4 className="text-xl font-semibold text-gray-900">{title}</h4>
              <div className="mt-2">
                <StatusChip state={state} size="lg" />
              </div>
            </div>
          </div>

          {/* Información específica según el estado */}
          {state === 'won' && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Trophy className="h-5 w-5 text-green-600" />
                <span className="font-semibold text-green-800">¡Felicidades! Has ganado este sorteo</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <InfoCard
                  icon={<User className="h-5 w-5" />}
                  title="Tu número ganador"
                  value={number ? `#${number}` : 'Sin número'}
                  valueClassName="text-green-600 font-bold text-lg"
                />

                <InfoCard
                  icon={<Calendar className="h-5 w-5" />}
                  title="Fecha del sorteo"
                  value={participation.roulette_drawn_at ? formatters.date(participation.roulette_drawn_at) : 'No disponible'}
                />
              </div>

              {/* Información del premio */}
              <div className="border-t border-green-200 pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <Gift className="h-5 w-5 text-green-600" />
                  <span className="font-semibold text-green-800">Tu Premio</span>
                </div>

                <div className="flex items-start gap-4 bg-white rounded-lg p-4 border border-green-200">
                  {/* Imagen del premio específico */}
                  <div className="w-20 h-16 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                    <SafeImage
                      src={prizeImg}
                      alt="Imagen del premio"
                      className="w-full h-full object-cover"
                      kind="prize"
                    />
                  </div>

                  {/* Información del premio */}
                  <div className="flex-1">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <InfoCard
                        title="Posición obtenida"
                        value={`${getPrizePosition(participation)}° Lugar`}
                        valueClassName="text-green-600 font-bold"
                      />

                      {prizeName && (
                        <InfoCard
                          title="Premio ganado"
                          value={prizeName}
                          valueClassName="text-gray-800 font-medium"
                        />
                      )}

                      <InfoCard
                        title="Notificación"
                        value="Enviada a tu correo"
                        valueClassName="text-blue-600 font-medium"
                      />
                    </div>

                    {getPrizeDescription(participation) && (
                      <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-700 font-medium">Descripción del premio:</p>
                        <p className="text-sm text-gray-600 mt-1">{getPrizeDescription(participation)}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-3 p-3 bg-green-100 rounded-lg">
                  <p className="text-sm text-green-800">
                    🎉 ¡Has sido notificado por correo electrónico sobre tu premio! Revisa tu bandeja de entrada para más detalles sobre cómo reclamar tu regalo.
                  </p>
                </div>
              </div>
            </div>
          )}

          {state === 'active' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="h-5 w-5 text-blue-600" />
                <span className="font-semibold text-blue-800">Participación en curso</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InfoCard
                  icon={<User className="h-5 w-5" />}
                  title="Tu número de participante"
                  value={number ? `#${number}` : 'Sin asignar'}
                  valueClassName="text-blue-600 font-semibold"
                />

                <InfoCard
                  icon={<Clock className="h-5 w-5" />}
                  title="Participaste el"
                  value={createdISO ? formatters.date(createdISO) : 'No disponible'}
                />

                {scheduledISO && (
                  <InfoCard
                    icon={<Calendar className="h-5 w-5" />}
                    title="Sorteo programado para"
                    value={formatters.date(scheduledISO)}
                    valueClassName="text-blue-600 font-medium"
                  />
                )}
              </div>

              <div className="mt-4 p-3 bg-blue-100 rounded-lg">
                <p className="text-sm text-blue-800">
                  El sorteo aún no se ha realizado. Te notificaremos por correo electrónico cuando se complete.
                </p>
              </div>
            </div>
          )}

          {state === 'completed' && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <XCircle className="h-5 w-5 text-gray-600" />
                <span className="font-semibold text-gray-800">Sorteo completado</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InfoCard
                  icon={<User className="h-5 w-5" />}
                  title="Tu número de participante"
                  value={number ? `#${number}` : 'Sin número'}
                />

                <InfoCard
                  icon={<Calendar className="h-5 w-5" />}
                  title="Fecha del sorteo"
                  value={participation.roulette_drawn_at ? formatters.date(participation.roulette_drawn_at) : 'Sorteo realizado'}
                />
              </div>

              <div className="mt-4 p-3 bg-gray-100 rounded-lg">
                <p className="text-sm text-gray-700">
                  Este sorteo ya fue realizado. No fuiste seleccionado en esta ocasión, pero recibiste una notificación por correo.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-4 bg-gray-50">
          <div className="flex justify-end">
            <Button onClick={onClose}>Cerrar</Button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* Componente auxiliar para mostrar información */
const InfoCard = ({ icon, title, value, valueClassName = '' }) => (
  <div className="bg-gray-50 rounded-lg p-3">
    <div className="flex items-center gap-2 mb-1">
      {icon && <span className="text-gray-400">{icon}</span>}
      <span className="text-sm font-medium text-gray-700">{title}</span>
    </div>
    <div className={`text-sm ${valueClassName || 'text-gray-900'}`}>
      {value}
    </div>
  </div>
);

/* -----------------------
   Componente principal
-------------------------*/
const MyParticipationsTab = () => {
  const [participations, setParticipations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedParticipation, setSelectedParticipation] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setPageError('');
      const res = await participantsAPI.getMyParticipations({ page_size: 200, _t: Date.now() });
      const list = toArray(res);
      setParticipations(list);
    } catch (err) {
      console.error('Error loading participations:', err);
      setPageError(handleAPIError(err, 'No se pudieron cargar tus participaciones.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = useMemo(() => {
    const list = Array.isArray(participations) ? participations : [];
    const term = q.toLowerCase().trim();

    return list.filter((p) => {
      const title = (getRouletteTitle(p) || '').toLowerCase();
      const matchesSearch = !term || title.includes(term);
      let matchesStatus = true;

      if (statusFilter === 'active') matchesStatus = isActive(p);
      else if (statusFilter === 'won') matchesStatus = isWinner(p);
      else if (statusFilter === 'completed') matchesStatus = isCompleted(p);

      return matchesSearch && matchesStatus;
    });
  }, [participations, q, statusFilter]);

  const active = useMemo(() => filtered.filter(isActive), [filtered]);
  const won = useMemo(() => filtered.filter(isWinner), [filtered]);
  const completed = useMemo(() => filtered.filter(isCompleted), [filtered]);

  const handleViewDetails = (participation) => {
    setSelectedParticipation(participation);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedParticipation(null);
  };

  return (
    <div className="space-y-6">
      {/* Controles superiores */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-lg font-semibold text-gray-900">Mis Participaciones</h2>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar ruleta"
              className="pl-10 pr-3 py-2 w-56 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="relative inline-flex items-center">
            <Filter className="h-4 w-4 text-gray-400 mr-2" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">Todas</option>
              <option value="active">En curso</option>
              <option value="won">Ganadas</option>
              <option value="completed">Completadas</option>
            </select>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refrescar
          </Button>
        </div>
      </div>

      {!!pageError && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="text-sm">{pageError}</span>
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-gray-500">
          <div className="inline-flex items-center gap-2">
            <RefreshCw className="h-5 w-5 animate-spin" />
            Cargando tus participaciones
          </div>
        </div>
      ) : (
        <>
          <SectionFlat
            title="En curso"
            emptyTitle="Sin participaciones en curso"
            emptyDesc="Cuando participes en una ruleta que aún no se ha sorteado, aparecerá aquí."
            items={active}
            onViewDetails={handleViewDetails}
          />

          <SectionFlat
            title="Ganadas"
            emptyTitle="Aún no has ganado"
            emptyDesc="Cuando ganes una ruleta, aparecerá aquí."
            items={won}
            highlight="win"
            onViewDetails={handleViewDetails}
          />

          <SectionFlat
            title="Completadas"
            emptyTitle="No hay participaciones completadas"
            emptyDesc="Aquí verás tus ruletas finalizadas donde no resultaste ganador."
            items={completed}
            onViewDetails={handleViewDetails}
          />
        </>
      )}

      {/* Modal de detalles */}
      <ParticipationDetailModal
        participation={selectedParticipation}
        isOpen={showModal}
        onClose={handleCloseModal}
      />
    </div>
  );
};

/* -----------------------
   Presentación
-------------------------*/
const SectionFlat = ({ title, emptyTitle, emptyDesc, items, highlight, onViewDetails }) => {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        {items.length > 0 && (
          <span className="text-xs text-gray-500">
            {items.length} {items.length === 1 ? 'registro' : 'registros'}
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <div className="py-8 text-center text-gray-500">
          <Trophy className="mx-auto mb-2 h-8 w-8 text-gray-300" />
          <div className="font-medium">{emptyTitle}</div>
          <div className="text-sm">{emptyDesc}</div>
        </div>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-100 bg-white">
          {items.map((p) => (
            <RowFlat
              key={p.id}
              participation={p}
              highlight={highlight}
              onViewDetails={onViewDetails}
            />
          ))}
        </ul>
      )}
    </section>
  );
};

const RowFlat = ({ participation, highlight, onViewDetails }) => {
  const title = getRouletteTitle(participation);
  const state = getParticipationState(participation);

  // Si ganó, intentamos imagen del PREMIO. Si no existe -> placeholder de premio.
  const prizeImg = isWinner(participation) ? getPrizeImageRaw(participation) : null;
  const rouletteImg = getRouletteImage(participation);

  // Para ganadores mostramos el premio (o su placeholder). Para no ganadores, la ruleta.
  const imgSrc = isWinner(participation) ? prizeImg : rouletteImg;
  const imgKind = isWinner(participation) ? 'prize' : 'roulette';

  const number = getNumber(participation);
  const createdISO = getCreatedISO(participation);
  const scheduledISO = getScheduledISO(participation);
  const created = createdISO ? formatters.date(createdISO) : 'Sin fecha';
  const scheduled = scheduledISO ? formatters.date(scheduledISO) : null;

  return (
    <li
      className={`px-3 sm:px-4 py-3 hover:bg-gray-50 transition flex items-center gap-3 ${
        highlight === 'win' ? 'bg-amber-50/40' : ''
      }`}
    >
      <div className="relative w-16 h-12 rounded-md overflow-hidden bg-gray-100 flex-shrink-0">
        <SafeImage src={imgSrc} alt={title} className="w-full h-full object-cover" kind={imgKind} />
        {isWinner(participation) && (
          <span className="absolute -top-1 -right-1 text-[10px] bg-green-600 text-white px-1.5 py-[2px] rounded">
            Premio
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-gray-900">{title}</span>
          <StatusChip state={state} />
        </div>

        <div className="mt-0.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600">
          <span className="truncate">
            <span className="font-medium">Participante:</span> {number ? `#${number}` : 'Sin número'}
          </span>
          <span className="truncate">
            <span className="font-medium">Participé:</span> {created}
          </span>
          {scheduled && (
            <span className="inline-flex items-center gap-1 truncate">
              <Calendar className="h-3.5 w-3.5 text-gray-400" />
              <span><span className="font-medium">Sorteo:</span> {scheduled}</span>
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 sm:gap-2">
        <Button
          variant="ghost"
          size="xs"
          title="Ver detalles"
          onClick={() => onViewDetails(participation)}
        >
          <Eye className="h-4 w-4" />
        </Button>
      </div>
    </li>
  );
};

const StatusChip = ({ state, size = 'sm' }) => {
  const configs = {
    active: {
      className: `px-2 py-0.5 ${size === 'lg' ? 'text-sm' : 'text-[11px]'} rounded-full bg-blue-100 text-blue-700 font-medium`,
      label: 'En curso'
    },
    won: {
      className: `px-2 py-0.5 ${size === 'lg' ? 'text-sm' : 'text-[11px]'} rounded-full bg-green-100 text-green-700 font-medium`,
      label: 'Ganada'
    },
    completed: {
      className: `px-2 py-0.5 ${size === 'lg' ? 'text-sm' : 'text-[11px]'} rounded-full bg-gray-100 text-gray-700 font-medium`,
      label: 'Completada'
    }
  };
  const config = configs[state] || configs.completed;
  return <span className={config.className}>{config.label}</span>;
};

export default MyParticipationsTab;
