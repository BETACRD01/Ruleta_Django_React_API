// src/components/user/MyParticipationsTab.jsx
// -------------------------------------------------------------
// "Mis Participaciones": lista las participaciones del usuario
// separadas en En curso / Ganadas / Completadas (no ganadas).
// - Fuente de datos: participantsAPI.getMyParticipations()
// - Botón "Ver": navega a la página de la ruleta.
// - Totalmente tipado por uso y con tolerancia a claves distintas
//   que pueda devolver tu API (roulette, raffle, scheduled_date…)
// -------------------------------------------------------------

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search, Filter, Eye, Trophy, RefreshCcw, AlertTriangle, Clock, CheckCircle,
} from "lucide-react";
import { participantsAPI, handleAPIError, API_URL, formatters } from "../../config/api";

// =============================================================
// Helpers de extracción de campos (tolerantes a nombres distintos)
// =============================================================
const toArray = (res) => {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.results)) return res.results;
  if (Array.isArray(res?.participations)) return res.participations;
  return [];
};

const rouletteObj = (p) => p?.roulette || p?.raffle || null;
const rouletteId = (p) =>
  p?.roulette_id || p?.raffle_id || rouletteObj(p)?.id || p?.id || null;
const rouletteTitle = (p) =>
  p?.roulette_title || p?.roulette_name || rouletteObj(p)?.title || rouletteObj(p)?.name || "Ruleta";

const resolveImageUrl = (val) => {
  const candidate =
    val?.image_url || val?.image || val?.cover_image || val?.banner || val?.thumbnail || val?.photo || val?.picture;
  if (!candidate) return null;
  try { return new URL(candidate).href; }
  catch {
    const base = String(API_URL || "").replace(/\/api\/?$/i, "");
    const path = String(candidate).startsWith("/") ? candidate : `/${candidate}`;
    return `${base}${path}`;
  }
};
const rouletteImage = (p) => resolveImageUrl(rouletteObj(p));

const isWinner = (p) =>
  Boolean(p?.is_winner ?? p?.winner ?? p?.result?.is_winner ?? p?.prize_won);

const partNumber = (p) =>
  p?.participation_number ?? p?.participant_number ?? p?.number ?? null;

const createdAtISO = (p) =>
  p?.created_at || p?.created || p?.timestamp || null;

const scheduledISO = (p) =>
  p?.scheduled_date || p?.scheduled_at || rouletteObj(p)?.scheduled_date || null;

const participationEndISO = (p) =>
  p?.participation_end || rouletteObj(p)?.participation_end || rouletteObj(p)?.end_date || null;

const rouletteStatus = (p) =>
  (p?.roulette_status || p?.status || rouletteObj(p)?.status || "").toLowerCase();

const rouletteIsDrawn = (p) =>
  Boolean(p?.is_drawn ?? rouletteObj(p)?.is_drawn);

// =============================================================
// Lógica de estado de la participación
// - "active": aún sin sortear / en curso
// - "won": el usuario ganó
// - "completed": sorteada/terminada y el usuario no ganó
// =============================================================
const computeStatus = (p) => {
  // Ganó -> "won"
  if (isWinner(p)) return "won";

  const status = rouletteStatus(p);
  const drawn  = rouletteIsDrawn(p);

  // Fechas de referencia
  const now   = new Date();
  const sched = scheduledISO(p) ? new Date(scheduledISO(p)) : null;
  const pend  = participationEndISO(p) ? new Date(participationEndISO(p)) : null;

  // Si está sorteada o marcada como "completed"/"cancelled" o ya pasaron
  // las fechas relevantes -> "completed" (no ganada, porque arriba filtra "won")
  const pastByDates = (sched && sched < now) || (pend && pend < now);
  if (drawn || status === "completed" || status === "cancelled" || pastByDates) return "completed";

  // En cualquier otro caso -> sigue "active"
  return "active";
};

// =============================================================
// Contador simple hacia una fecha (h:m:s, con días)
// =============================================================
const useCountdown = (iso) => {
  const target = useMemo(() => (iso ? new Date(iso) : null), [iso]);
  const [left, setLeft] = useState({ d: 0, h: 0, m: 0, s: 0, expired: false });

  useEffect(() => {
    if (!target || isNaN(target.getTime())) return;
    const tick = () => {
      const diff = target.getTime() - Date.now();
      if (diff <= 0) return setLeft({ d: 0, h: 0, m: 0, s: 0, expired: true });
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setLeft({ d, h, m, s, expired: false });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);

  return left;
};

// =============================================================
// Imagen segura (evita parpadeo si falla una vez)
// =============================================================
const SafeImage = ({ src, alt = "", className = "" }) => {
  const [displaySrc, setDisplaySrc] = useState(src || "");
  const [err, setErr] = useState(false);
  const tried = useRef(false);

  useEffect(() => { setDisplaySrc(src || ""); setErr(false); tried.current = false; }, [src]);

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
          setDisplaySrc((s) => (s.includes("?") ? `${s}&v=${Date.now()}` : `${s}?v=${Date.now()}`));
        } else {
          setErr(true);
        }
      }}
    />
  );
};

// =============================================================
// Helper de navegación (AJUSTA AQUÍ si tu ruta es distinta)
// Intenta varias rutas comunes y deja una por defecto.
// =============================================================
const buildRoulettePath = (id) => {
  if (!id) return "/";
  // ⇣ Cambia el return por la ruta real de tu app si es distinta
  // Ejemplos habituales:
  // return `/ruletas/${id}`;
  // return `/app/roulettes/${id}`;
  // return `/roulette/${id}/participar`;
  return `/roulettes/${id}`;
};

// =============================================================
// Tarjeta de participación
// =============================================================
const ParticipationRow = ({ p, onView }) => {
  const title  = rouletteTitle(p);
  const img    = rouletteImage(p);
  const number = partNumber(p);
  const created = createdAtISO(p);
  const schedISO = scheduledISO(p);

  const status = computeStatus(p);
  const cd = useCountdown(status === "active" ? schedISO : null);

  const chip = (() => {
    if (status === "won") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800 border border-green-200">
          <Trophy className="w-3.5 h-3.5" /> Ganada
        </span>
      );
    }
    if (status === "active") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
          <Clock className="w-3.5 h-3.5" />
          {schedISO && !cd.expired
            ? <>Faltan {cd.d > 0 && `${cd.d}d `}{String(cd.h).padStart(2,"0")}:{String(cd.m).padStart(2,"0")}:{String(cd.s).padStart(2,"0")}</>
            : <>En curso</>}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800 border border-gray-200">
        <CheckCircle className="w-3.5 h-3.5" /> Completada
      </span>
    );
  })();

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 bg-white hover:shadow-sm transition">
      <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100">
        <SafeImage src={img} alt={title} className="w-full h-full object-cover" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="font-semibold text-gray-900 truncate">{title}</h4>
          {chip}
        </div>

        <div className="text-xs text-gray-500 mt-0.5 flex flex-wrap gap-x-3">
          {number && <span>Número: <strong className="text-gray-700">#{number}</strong></span>}
          {created && <span>Participaste: {formatters.date(created, { month: "short", day: "numeric" })}</span>}
          {schedISO && <span>Sorteo: {formatters.date(schedISO)}</span>}
        </div>
      </div>

      <button
        type="button"
        onClick={() => onView(rouletteId(p))}
        className="inline-flex items-center gap-1 px-3 py-2 text-sm rounded-lg border bg-white hover:bg-gray-50"
      >
        <Eye className="w-4 h-4" /> Ver
      </button>
    </div>
  );
};

// =============================================================
// Sección plana (lista simple con título y vacíos bonitos)
// =============================================================
const Section = ({ title, emptyTitle, emptyDesc, items, onView }) => (
  <section className="space-y-2">
    <div className="flex items-center justify-between">
      <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      {items.length > 0 && (
        <span className="text-xs text-gray-500">
          {items.length} {items.length === 1 ? "registro" : "registros"}
        </span>
      )}
    </div>

    {items.length === 0 ? (
      <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center">
        <p className="font-medium text-gray-700">{emptyTitle}</p>
        <p className="text-xs text-gray-500 mt-1">{emptyDesc}</p>
      </div>
    ) : (
      <div className="grid gap-2">
        {items.map((p, i) => (
          <ParticipationRow key={p.id || i} p={p} onView={onView} />
        ))}
      </div>
    )}
  </section>
);

// =============================================================
// Componente principal
// =============================================================
export default function MyParticipationsTab() {
  const navigate = useNavigate();

  const [participations, setParticipations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  // filtros UI
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // all | active | won | completed

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setPageError("");
      const res = await participantsAPI.getMyParticipations({ page_size: 200 });
      setParticipations(toArray(res));
    } catch (err) {
      setPageError(handleAPIError(err, "No se pudieron cargar tus participaciones."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Filtro por texto + estado
  const filtered = useMemo(() => {
    const list = Array.isArray(participations) ? participations : [];
    const term = q.toLowerCase().trim();
    return list.filter((p) => {
      const title = (rouletteTitle(p) || "").toLowerCase();
      const matchesSearch = !term || title.includes(term);

      const st = computeStatus(p);
      let matchesStatus = true;
      if (statusFilter === "active")     matchesStatus = st === "active";
      if (statusFilter === "won")        matchesStatus = st === "won";
      if (statusFilter === "completed")  matchesStatus = st === "completed";

      return matchesSearch && matchesStatus;
    });
  }, [participations, q, statusFilter]);

  // Sub-listas reales
  const active     = useMemo(() => filtered.filter(p => computeStatus(p) === "active"), [filtered]);
  const won        = useMemo(() => filtered.filter(p => computeStatus(p) === "won"), [filtered]);
  const completed  = useMemo(() => filtered.filter(p => computeStatus(p) === "completed"), [filtered]);

  // Navegación de "Ver"
  const handleView = useCallback((rid) => {
    const path = buildRoulettePath(rid);
    navigate(path);
  }, [navigate]);

  return (
    <div className="space-y-6">
      {/* Controles superiores */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-lg font-semibold text-gray-900">Mis Participaciones</h2>

        <div className="flex items-center gap-2">
          {/* Buscar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar ruleta…"
              className="pl-10 pr-3 py-2 w-56 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Filtro por estado */}
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

          {/* Refrescar */}
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-2 border rounded-lg bg-white hover:bg-gray-50"
          >
            <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refrescar
          </button>
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
          <Section
            title="En curso"
            emptyTitle="Sin participaciones en curso"
            emptyDesc="Cuando participes en una ruleta activa, aparecerá aquí."
            items={active}
            onView={handleView}
          />

          {/* Ganadas */}
          <Section
            title="Ganadas"
            emptyTitle="Aún no hay ganadas"
            emptyDesc="Cuando ganes una ruleta, aparecerá aquí."
            items={won}
            onView={handleView}
          />

          {/* Completadas (no ganadas) */}
          <Section
            title="Completadas"
            emptyTitle="No hay participaciones completadas"
            emptyDesc="Aquí verás tus ruletas finalizadas."
            items={completed}
            onView={handleView}
          />
        </>
      )}
    </div>
  );
}
