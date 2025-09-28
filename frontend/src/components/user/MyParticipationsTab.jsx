// src/components/user/MyParticipationsTab.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, Filter, Calendar, Eye, Trophy, RefreshCw, AlertTriangle } from 'lucide-react';
import { Button } from '../UI';
import { participantsAPI, handleAPIError, API_URL, formatters } from '../../config/api';

/* -----------------------
   Helpers - CORREGIDOS Y MEJORADOS
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
  if (Array.isArray(res?.data)) return res.data;
  return [];
};

const getRouletteFromParticipation = (p) => p?.roulette || p?.raffle || {};

const getRouletteTitle = (p) =>
  p?.roulette_title || 
  p?.roulette_name || 
  p?.roulette?.title || 
  p?.roulette?.name || 
  getRouletteFromParticipation(p)?.name ||
  'Ruleta';

const getRouletteImage = (p) => {
  const r = getRouletteFromParticipation(p) || {};
  return resolveImageUrl({ 
    image_url: r.image_url || r.image || r.banner || r.thumbnail || r.cover_image || p?.roulette_image_url 
  });
};

// LÓGICA USANDO ESTADO INFERIDO (basado en datos disponibles)
const getParticipationState = (p) => {
  // 1. Usar estado inferido si existe
  if (p?.inferred_state) {
    console.log(`[DEBUG] Usando estado inferido para ${getRouletteTitle(p)}: ${p.inferred_state}`);
    return p.inferred_state;
  }
  
  // 2. GANADOR: Si es ganador, siempre mostrar como ganado
  if (p?.is_winner === true || p?.winner === true) {
    return 'won';
  }
  
  // 3. USAR STATUS DE LA RULETA (si está disponible)
  const roulette = getRouletteFromParticipation(p) || {};
  const status = p?.roulette_status || roulette?.status || p?.status || 'active';
  
  console.log(`[DEBUG] Status para ${getRouletteTitle(p)}:`, {
    roulette_status: p?.roulette_status,
    'roulette.status': roulette?.status,
    final_status: status,
    is_winner: p?.is_winner
  });
  
  // 4. MAPEAR STATUS A ESTADO
  switch (status) {
    case 'completed':
    case 'cancelled':
    case 'draft':
      return 'completed';
    case 'active':
    case 'scheduled':
    default:
      return 'active';
  }
};

const isWinner = (p) => getParticipationState(p) === 'won';
const isActive = (p) => getParticipationState(p) === 'active';
const isCompleted = (p) => getParticipationState(p) === 'completed' && !isWinner(p);

const getNumber = (p) =>
  p?.participation_number ?? p?.participant_number ?? p?.number ?? null;

const getCreatedISO = (p) => p?.created_at || p?.created || p?.timestamp || null;

const getScheduledISO = (p) =>
  p?.scheduled_date || p?.scheduled_at || p?.roulette?.scheduled_date || p?.roulette_scheduled_date || null;

/* Imagen robusta (evita parpadeo) */
const SafeImage = ({ src, alt = '', className = '' }) => {
  const [displaySrc, setDisplaySrc] = useState(src || '');
  const [err, setErr] = useState(false);
  const tried = useRef(false);

  useEffect(() => { 
    setDisplaySrc(src || ''); 
    setErr(false); 
    tried.current = false; 
  }, [src]);

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
   Componente principal - MEJORADO
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
      
      // ESTRATEGIA SIMPLIFICADA: Solo usar la API existente y inferir el estado
      const res = await participantsAPI.getMyParticipations({ 
        page_size: 200,
        _t: Date.now()
      });
      
      console.log('=== PARTICIPATIONS RESPONSE ===');
      console.log('Raw response:', res);
      
      const participationsList = toArray(res);
      
      console.log('=== ESTADO DE CADA PARTICIPACIÓN ===');
      
      // Analizar cada participación con la información disponible
      const processedParticipations = participationsList.map((p, index) => {
        console.log(`${index + 1}. ${p.roulette_name || 'Sin nombre'}:`);
        console.log('   - is_winner:', p?.is_winner);
        console.log('   - created_at:', p?.created_at);
        
        // INFERIR ESTADO: Si hay un ganador en DGTAL EDUCAS, esa ruleta está completada
        // Para las otras participaciones del mismo usuario, si no ganó, están completadas
        let inferredState = 'active'; // por defecto
        
        if (p?.is_winner === true) {
          inferredState = 'won';
          console.log('   - ESTADO: ganada (is_winner=true)');
        } else {
          // LÓGICA DE INFERENCIA: Si la participación es muy antigua (más de 7 días)
          // y no es ganador, probablemente esté completada
          const createdDate = new Date(p.created_at);
          const now = new Date();
          const daysDiff = (now - createdDate) / (1000 * 60 * 60 * 24);
          
          if (daysDiff > 7) { // Más de 7 días
            inferredState = 'completed';
            console.log('   - ESTADO: completada (inferida por antigüedad)');
          } else {
            console.log('   - ESTADO: en curso (reciente)');
          }
        }
        
        return {
          ...p,
          // Agregar campos inferidos
          inferred_state: inferredState,
          days_old: Math.floor((new Date() - new Date(p.created_at)) / (1000 * 60 * 60 * 24))
        };
      });
      
      setParticipations(processedParticipations);
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

      // FILTROS CORREGIDOS
      if (statusFilter === 'active') {
        matchesStatus = isActive(p);
      } else if (statusFilter === 'won') {
        matchesStatus = isWinner(p);
      } else if (statusFilter === 'completed') {
        matchesStatus = isCompleted(p);
      }

      return matchesSearch && matchesStatus;
    });
  }, [participations, q, statusFilter]);

  // SECCIONES CON VALIDACIÓN MEJORADA
  const active = useMemo(() => 
    filtered.filter(isActive), [filtered]
  );
  
  const won = useMemo(() => 
    filtered.filter(isWinner), [filtered]
  );
  
  const completed = useMemo(() => 
    filtered.filter(isCompleted), [filtered]
  );

  // Debug info para desarrollo
  console.log('Sections count:', {
    total: participations.length,
    filtered: filtered.length,
    active: active.length, 
    won: won.length, 
    completed: completed.length
  });

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
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refrescar
          </Button>
        </div>
      </div>

      {/* DEBUG INFO - MEJORADA */}
      {participations.length > 0 && (
        <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded border">
          <div className="font-medium mb-1">Debug Info:</div>
          <div>Total: {participations.length} | Filtradas: {filtered.length}</div>
          <div>En curso: {active.length} | Ganadas: {won.length} | Completadas: {completed.length}</div>
          {statusFilter !== 'all' && (
            <div className="mt-1 text-indigo-600">
              Mostrando filtro: <span className="font-medium">{statusFilter}</span>
            </div>
          )}
        </div>
      )}

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
            Cargando tus participaciones…
          </div>
        </div>
      ) : (
        <>
          {/* En curso */}
          <SectionFlat
            title="En curso"
            emptyTitle="Sin participaciones en curso"
            emptyDesc="Cuando participes en una ruleta que aún no se ha sorteado, aparecerá aquí."
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
            emptyDesc="Aquí verás tus ruletas finalizadas donde no resultaste ganador."
            items={completed}
          />
        </>
      )}
    </div>
  );
};

/* -----------------------
   Sección "plana" (sin card)
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
            <RowFlat 
              key={p.id || `${p.roulette_id || 'unknown'}-${getNumber(p) || 'no-number'}`} 
              participation={p} 
              highlight={highlight} 
            />
          ))}
        </ul>
      )}
    </section>
  );
};

/* -----------------------
   Fila de lista (sin card) - MEJORADA
-------------------------*/
const RowFlat = ({ participation, highlight }) => {
  const title = getRouletteTitle(participation);
  const img = getRouletteImage(participation);
  const number = getNumber(participation);
  const createdISO = getCreatedISO(participation);
  const scheduledISO = getScheduledISO(participation);
  const created = createdISO ? formatters.date(createdISO) : '—';
  const scheduled = scheduledISO ? formatters.date(scheduledISO) : null;
  const state = getParticipationState(participation);
  const receipt = participation?.receipt_url || participation?.receipt || participation?.voucher_url || null;

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
          <StatusChip state={state} />
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
   Chip de estado - SIN CAMBIOS
-------------------------*/
const StatusChip = ({ state }) => {
  switch (state) {
    case 'active':
      return (
        <span className="px-2 py-0.5 text-[11px] rounded-full bg-blue-100 text-blue-700 font-medium">
          En curso
        </span>
      );
    case 'won':
      return (
        <span className="px-2 py-0.5 text-[11px] rounded-full bg-green-100 text-green-700 font-medium">
          🏆 Ganada
        </span>
      );
    case 'completed':
      return (
        <span className="px-2 py-0.5 text-[11px] rounded-full bg-gray-100 text-gray-700 font-medium">
          Completada
        </span>
      );
    default:
      return null;
  }
};

export default MyParticipationsTab;