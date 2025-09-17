// src/components/user/MyParticipationsTab.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, Filter, Calendar, Eye, Trophy, RefreshCcw, AlertTriangle } from 'lucide-react';
import { Button } from '../UI';
import { participantsAPI, handleAPIError, API_URL, formatters } from '../../config/api';

/* -----------------------
   Helpers
-------------------------*/
const resolveImageUrl = (r) => {
  const candidate =
    r?.image_url || r?.image || r?.cover_image || r?.banner || r?.thumbnail || r?.photo || r?.picture;
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
const toArray = (res) => {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.results)) return res.results;
  if (Array.isArray(res?.participations)) return res.participations;
  return [];
};

const getRouletteFromParticipation = (p) => p?.roulette || p?.raffle || null;
const getRouletteTitle = (p) =>
  p?.roulette_title || p?.roulette_name || p?.roulette?.title || p?.roulette?.name || 'Ruleta';
const getRouletteImage = (p) => {
  const r = getRouletteFromParticipation(p) || {};
  return resolveImageUrl({ image_url: r.image_url || r.image || r.banner || r.thumbnail });
};
const getStatus = (p) => p?.roulette_status || p?.status || 'completed';
const isWinner = (p) =>
  Boolean(p?.is_winner ?? p?.winner ?? p?.result?.is_winner ?? p?.prize_won);
const getNumber = (p) =>
  p?.participation_number ?? p?.participant_number ?? p?.number ?? null;
const getCreatedISO = (p) => p?.created_at || p?.created || p?.timestamp || null;
const getScheduledISO = (p) =>
  p?.scheduled_date || p?.scheduled_at || p?.roulette?.scheduled_date || null;

/* Imagen robusta (evita parpadeo) */
const SafeImage = ({ src, alt = '', className = '' }) => {
  const [displaySrc, setDisplaySrc] = useState(src || '');
  const [err, setErr] = useState(false);
  const tried = useRef(false);

  useEffect(() => { setDisplaySrc(src || ''); setErr(false); tried.current = false; }, [src]);

  if (!displaySrc || err) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100">
        <Trophy className="h-5 w-5 text-gray-300" />
      </div>
    );
  }
  return (
    <img
      src={displaySrc}
      alt={alt}
      className={className}
      decoding="async"
      draggable={false}
      onError={() => {
        if (!tried.current) {
          tried.current = true;
          setDisplaySrc((s) => (s.includes('?') ? `${s}&v=${Date.now()}` : `${s}?v=${Date.now()}`));
        } else {
          setErr(true);
        }
      }}
    />
  );
};

/* -----------------------
   Componente principal
-------------------------*/
const MyParticipationsTab = () => {
  const [participations, setParticipations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all | active | won | completed

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setPageError('');
      const res = await participantsAPI.getMyParticipations({ page_size: 200 });
      setParticipations(toArray(res));
    } catch (err) {
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

      if (statusFilter === 'active') matchesStatus = getStatus(p) === 'active';
      if (statusFilter === 'won') matchesStatus = getStatus(p) !== 'active' && isWinner(p);
      if (statusFilter === 'completed')
        matchesStatus = getStatus(p) === 'completed' && !isWinner(p);

      return matchesSearch && matchesStatus;
    });
  }, [participations, q, statusFilter]);

  const active = useMemo(() => filtered.filter((p) => getStatus(p) === 'active'), [filtered]);
  const won = useMemo(() => filtered.filter((p) => getStatus(p) !== 'active' && isWinner(p)), [filtered]);
  const completed = useMemo(
    () => filtered.filter((p) => getStatus(p) === 'completed' && !isWinner(p)),
    [filtered]
  );

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
              placeholder="Buscar ruleta…"
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
            <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
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
        <div className="py-12 text-center text-gray-500">Cargando tus participaciones…</div>
      ) : (
        <>
          {/* En curso */}
          <SectionFlat
            title="En curso"
            emptyTitle="Sin participaciones en curso"
            emptyDesc="Cuando participes en una ruleta activa, aparecerá aquí."
            items={active}
          />

          {/* Ganadas */}
          <SectionFlat
            title="Ganadas"
            emptyTitle="Aún no hay ganadas"
            emptyDesc="Cuando ganes una ruleta, aparecerá aquí."
            items={won}
            highlight="win"
          />

          {/* Completadas (no ganadas) */}
          <SectionFlat
            title="Completadas"
            emptyTitle="No hay participaciones completadas"
            emptyDesc="Aquí verás tus ruletas finalizadas."
            items={completed}
          />
        </>
      )}
    </div>
  );
};

/* -----------------------
   Sección “plana” (sin card)
-------------------------*/
const SectionFlat = ({ title, emptyTitle, emptyDesc, items, highlight }) => {
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
            <RowFlat key={p.id || `${p.roulette_id}-${getNumber(p)}`} participation={p} highlight={highlight} />
          ))}
        </ul>
      )}
    </section>
  );
};

/* -----------------------
   Fila de lista (sin card)
-------------------------*/
const RowFlat = ({ participation, highlight }) => {
  const title = getRouletteTitle(participation);
  const img = getRouletteImage(participation);
  const number = getNumber(participation);
  const createdISO = getCreatedISO(participation);
  const scheduledISO = getScheduledISO(participation);
  const created = createdISO ? formatters.date(createdISO) : '—';
  const scheduled = scheduledISO ? formatters.date(scheduledISO) : null;
  const status = getStatus(participation);
  const won = isWinner(participation);
  const receipt =
    participation?.receipt_url || participation?.receipt || participation?.voucher_url || null;

  return (
    <li
      className={`px-3 sm:px-4 py-3 hover:bg-gray-50 transition flex items-center gap-3 ${
        highlight === 'win' ? 'bg-amber-50/40' : ''
      }`}
    >
      {/* thumb */}
      <div className="w-16 h-12 rounded-md overflow-hidden bg-gray-100 flex-shrink-0">
        <SafeImage src={img} alt={title} className="w-full h-full object-cover" />
      </div>

      {/* title + meta */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-gray-900">{title}</span>
          <StatusChip status={status} won={won} />
        </div>

        <div className="mt-0.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600">
          <span className="truncate">
            <span className="font-medium">N°:</span> {number ? `#${number}` : '—'}
          </span>
          <span className="truncate">
            <span className="font-medium">Fecha:</span> {created}
          </span>
          {scheduled && (
            <span className="inline-flex items-center gap-1 truncate">
              <Calendar className="h-3.5 w-3.5 text-gray-400" />
              <span><span className="font-medium">Sorteo:</span> {scheduled}</span>
            </span>
          )}
        </div>
      </div>

      {/* acciones */}
      <div className="flex items-center gap-1 sm:gap-2">
        {receipt && (
          <Button
            variant="ghost"
            size="xs"
            title="Ver comprobante"
            onClick={() => window.open(receipt, '_blank', 'noopener')}
          >
            <Eye className="h-4 w-4" />
          </Button>
        )}
        <Button variant="ghost" size="xs" title="Detalles">
          <Trophy className="h-4 w-4" />
        </Button>
      </div>
    </li>
  );
};

/* -----------------------
   Chip de estado (sin card)
-------------------------*/
const StatusChip = ({ status, won }) => {
  if (status === 'active') {
    return (
      <span className="px-2 py-0.5 text-[11px] rounded-full bg-blue-100 text-blue-700 font-medium">
        En curso
      </span>
    );
  }
  if (won) {
    return (
      <span className="px-2 py-0.5 text-[11px] rounded-full bg-green-100 text-green-700 font-medium">
        🏆 Ganada
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 text-[11px] rounded-full bg-gray-100 text-gray-700 font-medium">
      Completada
    </span>
  );
};

export default MyParticipationsTab;
