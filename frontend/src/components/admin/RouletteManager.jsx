// src/components/admin/RouletteManager.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus, Search, RefreshCcw, Edit, Trash2, Users, Calendar,
  Gift, Layout, Image as ImageIcon, X, AlertCircle, Clock, Play
} from "lucide-react";
import { RoulettesAPI, getGlobalAuthToken } from "../../config/api";
import RouletteModal from "../admin/Gestión de Ruletas/RouletteModal.jsx";
import PrizePanel from "../admin/Gestión de Ruletas/PrizePanel";

/* ===========================
   Helpers de Fecha (ROBUSTOS)
   =========================== */
const normalizeToDate = (val) => {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  const raw = String(val).trim();
  const maybeLocal = /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}(:\d{2})?$/.test(raw) ? raw.replace(/\s+/, "T") : raw;
  const d = new Date(maybeLocal);
  if (!isNaN(d.getTime())) return d;
  const alt = new Date(maybeLocal.replace(/\//g, "-"));
  return isNaN(alt.getTime()) ? null : alt;
};

const formatDateHuman = (dateString) => {
  const d = normalizeToDate(dateString);
  if (!d) return null;
  try {
    return d.toLocaleString("es-ES", {
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit"
    });
  } catch {
    return null;
  }
};

/* ===========================
   CRONÓMETRO OPTIMIZADO
   =========================== */
const RouletteCountdown = ({ targetDate, label, type = "end" }) => {
  const parsed = useMemo(() => normalizeToDate(targetDate), [targetDate]);

  const [timeLeft, setTimeLeft] = useState({
    days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: false, isActive: false
  });

  useEffect(() => {
    if (!parsed) {
      setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: false, isActive: false });
      return;
    }
    const tick = () => {
      const diff = parsed.getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true, isActive: false });
        return;
      }
      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setTimeLeft({ days, hours, minutes, seconds, isExpired: false, isActive: true });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [parsed]);

  if (!parsed || (!timeLeft.isActive && !timeLeft.isExpired)) return null;

  const styles = timeLeft.isExpired
    ? { container: "bg-red-50 border-red-200", text: "text-red-800", badge: "bg-red-100 text-red-700" }
    : type === "draw"
    ? { container: "bg-purple-50 border-purple-200", text: "text-purple-800", badge: "bg-purple-100 text-purple-700" }
    : { container: "bg-blue-50 border-blue-200", text: "text-blue-800", badge: "bg-blue-100 text-blue-700" };

  return (
    <div className={`p-3 rounded-lg border ${styles.container}`}>
      <div className={`flex items-center text-xs font-medium ${styles.text} mb-2`}>
        <Clock className="h-3 w-3 mr-1" />
        {label}
      </div>
      {timeLeft.isExpired ? (
        <div className="text-sm font-bold text-red-600">Tiempo terminado</div>
      ) : (
        <div className="flex flex-wrap gap-1">
          {timeLeft.days > 0 && <span className={`px-2 py-1 rounded text-xs font-bold ${styles.badge}`}>{timeLeft.days}d</span>}
          <span className={`px-2 py-1 rounded text-xs font-bold ${styles.badge}`}>{String(timeLeft.hours).padStart(2,'0')}h</span>
          <span className={`px-2 py-1 rounded text-xs font-bold ${styles.badge}`}>{String(timeLeft.minutes).padStart(2,'0')}m</span>
          <span className={`px-2 py-1 rounded text-xs font-bold ${styles.badge}`}>{String(timeLeft.seconds).padStart(2,'0')}s</span>
        </div>
      )}
    </div>
  );
};

/* ===========================
   PROCESADOR DE TEXTO OPTIMIZADO
   =========================== */
const processText = (text) => {
  if (!text || typeof text !== "string") return "";
  let processedText = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
  const processedRanges = [];
  const seen = (a,b)=>processedRanges.some(r=>(a>=r.start&&a<=r.end)||(b>=r.start&&b<=r.end)||(a<=r.start&&b>=r.end));
  const mark=(a,b)=>processedRanges.push({start:a,end:b});
  const patterns = [
    { regex:/\b(https?:\/\/[^\s<>"']+)/gi,
      process:(m)=>`<a href="${m.replace(/[.,;!?)\]}>]+$/,'')}" target="_blank" rel="noopener noreferrer" class="text-blue-600 underline hover:text-blue-800 hover:no-underline font-medium bg-blue-50 px-1 rounded transition-colors">${m}</a>` },
    { regex:/\b(www\.[^\s<>"']+)/gi,
      process:(m)=>`<a href="https://${m.replace(/[.,;!?)\]}>]+$/,'')}" target="_blank" rel="noopener noreferrer" class="text-blue-600 underline hover:text-blue-800 hover:no-underline font-medium bg-blue-50 px-1 rounded transition-colors">${m}</a>`,
      skipIf:(t,i)=>t.substring(Math.max(0,i-10),i).includes('href="') },
    { regex:/\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g,
      process:(m)=>`<a href="mailto:${m}" class="text-green-600 underline hover:text-green-800 hover:no-underline font-medium bg-green-50 px-1 rounded transition-colors">${m}</a>`,
      skipIf:(t,i)=>t.substring(Math.max(0,i-10),i).includes('href="') },
    { regex:/\B@([a-zA-Z0-9_-]{1,30})\b/g,
      process:(m)=>`<span class="bg-purple-100 text-purple-800 px-2 py-1 rounded-full text-sm font-semibold border border-purple-200 inline-flex items-center"><span class="w-1.5 h-1.5 bg-purple-500 rounded-full mr-1"></span>${m}</span>` },
    { regex:/\B#([a-zA-Z0-9_-]{1,30})\b/g,
      process:(m)=>`<span class="bg-green-100 text-green-800 px-2 py-1 rounded-full text-sm font-semibold border border-green-200 inline-flex items-center"><span class="w-1.5 h-1.5 bg-green-500 rounded-full mr-1"></span>${m}</span>` },
  ];
  patterns.forEach(p=>{
    p.regex.lastIndex=0; let m;
    while((m=p.regex.exec(processedText))!==null){
      const full=m[0], a=m.index, b=a+full.length;
      if ((p.skipIf && p.skipIf(processedText,a)) || seen(a,b)) continue;
      const rep=p.process(full);
      processedText = processedText.substring(0,a)+rep+processedText.substring(b);
      const diff = rep.length - full.length;
      p.regex.lastIndex = b + diff;
      mark(a, a+rep.length);
    }
  });
  return processedText.replace(/\n/g,"<br/>");
};

/* ===========================
   MANAGER PRINCIPAL
   =========================== */
const RouletteManager = ({ onRefetchDashboard }) => {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [count, setCount] = useState(0);
  const totalPages = Math.max(1, Math.ceil(count / pageSize));

  const [query, setQuery] = useState("");
  // ⬇️ Por defecto “Activa”, pero el usuario puede cambiarlo
  const [status, setStatus] = useState("active");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [prizePanelOpen, setPrizePanelOpen] = useState(false);
  const [prizeContext, setPrizeContext] = useState({ rouletteId: null, data: [], rouletteName: "" });
  const [prizeLoading, setPrizeLoading] = useState(false);

  const [expandedDescriptions, setExpandedDescriptions] = useState(new Set());

  const createAPIInstance = useCallback(() => {
    const token = getGlobalAuthToken();
    return new RoulettesAPI(token);
  }, []);

  const getImageUrl = useCallback((roulette) => {
    if (!roulette) return null;
    const possibleFields = ['cover_image_url','cover_image','cover_url','image_url','image'];
    for (const field of possibleFields) {
      const url = roulette[field];
      if (url && typeof url === 'string' && url.trim() !== '' && url !== 'null') {
        if (url.startsWith('/media/') || url.startsWith('/static/')) {
          const baseURL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
          return `${baseURL.replace('/api', '')}${url}`;
        }
        if (url.startsWith('http')) return url;
        return url;
      }
    }
    return null;
  }, []);

  const shouldShowTimer = useCallback((roulette) => {
    const endDate = normalizeToDate(roulette?.participation_end);
    const drawDate = normalizeToDate(roulette?.scheduled_date);
    if (!endDate && !drawDate) return false;
    const now = Date.now();
    const recentThreshold = 60 * 60 * 1000;
    return (
      (endDate && endDate.getTime() > (now - recentThreshold)) ||
      (drawDate && drawDate.getTime() > (now - recentThreshold))
    );
  }, []);

  // ⬇️ Usa el estado elegido (por defecto “active”)
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const api = createAPIInstance();
      const params = { page, page_size: pageSize };
      if (status) params.status = status; // si está vacío -> trae todo
      const res = await api.getRoulettes(params);

      let list = [];
      let totalCount = 0;

      if (res) {
        if (Array.isArray(res.results)) { 
          list = res.results; 
          totalCount = res.count || list.length; 
        } else if (Array.isArray(res)) { 
          list = res; 
          totalCount = list.length; 
        } else if (res.data && Array.isArray(res.data)) { 
          list = res.data; 
          totalCount = res.total || res.count || list.length; 
        }
      }

      setItems(list);
      setCount(totalCount);
    } catch (e) {
      setError(e?.message || "Error cargando ruletas");
      setItems([]);
      setCount(0);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, status, createAPIInstance]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter(r =>
      String(r.name || "").toLowerCase().includes(q) ||
      String(r.description || "").toLowerCase().includes(q)
    );
  }, [items, query]);

  const getStatusConfig = useCallback((st) => {
    const configs = {
      active:     { label: "Activa",     class: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-400" },
      scheduled:  { label: "Programada", class: "bg-blue-50 text-blue-700 border-blue-200",         dot: "bg-blue-400" },
      completed:  { label: "Completada", class: "bg-purple-50 text-purple-700 border-purple-200",   dot: "bg-purple-400" },
      cancelled:  { label: "Cancelada",  class: "bg-red-50 text-red-700 border-red-200",             dot: "bg-red-400" },
      draft:      { label: "Borrador",   class: "bg-gray-50 text-gray-700 border-gray-200",          dot: "bg-gray-400" },
    };
    return configs[st] || { label: st || "—", class: "bg-gray-50 text-gray-700 border-gray-200", dot: "bg-gray-400" };
  }, []);

  const toggleDescription = useCallback((rouletteId) => {
    setExpandedDescriptions(prev => {
      const next = new Set(prev);
      next.has(rouletteId) ? next.delete(rouletteId) : next.add(rouletteId);
      return next;
    });
  }, []);

  const startCreate = useCallback(() => {
    setEditing({
      id: null, name: "", description: "", status: "active",
      participation_start: "", participation_end: "", scheduled_date: "",
      cover_image: null, cover_preview: "", cover_url: "", cover_delete: false,
    });
    setModalOpen(true);
  }, []);

  const startEdit = useCallback(async (id) => {
    if (!id) { setError("ID de ruleta inválido"); return; }
    try {
      setLoading(true);
      setError("");
      const api = createAPIInstance();
      const detail = await api.getRoulette(id);

      if (!detail) throw new Error("No se pudo obtener el detalle de la ruleta");

      const imageUrl = getImageUrl(detail);
      setEditing({
        id: detail.id,
        name: detail.name || "",
        description: detail.description || "",
        status: detail.status || "active",
        participation_start: detail.participation_start || "",
        participation_end: detail.participation_end || "",
        scheduled_date: detail.scheduled_date || "",
        cover_image: null,
        cover_preview: "",
        cover_url: imageUrl || "",
        cover_delete: false,
      });

      setModalOpen(true);
    } catch (e) {
      setError("No se pudo cargar el detalle: " + (e?.message || "Error desconocido"));
    } finally {
      setLoading(false);
    }
  }, [createAPIInstance, getImageUrl]);

  const saveEditing = useCallback(async (payload) => {
    if (!payload) { setError("Datos de payload inválidos"); return; }
    try {
      setLoading(true);
      setError("");
      const api = createAPIInstance();

      let updatedOrCreated;
      const isUpdate = payload?.id || editing?.id;

      if (isUpdate) {
        const id = payload?.id ?? editing.id;
        updatedOrCreated = await api.updateRoulette(id, payload);
      } else {
        // Por defecto creamos "active"; si tu modal permite cambiarlo, respeta payload.status
        if (!payload.status) payload.status = "active";
        updatedOrCreated = await api.createRoulette(payload);
      }

      if (updatedOrCreated?.id) {
        setItems(prev => {
          const i = prev.findIndex(x => x.id === updatedOrCreated.id);
          if (i === -1) return [updatedOrCreated, ...prev];
          const next = [...prev];
          next[i] = { ...prev[i], ...updatedOrCreated };
          return next;
        });
      }

      await load();
      onRefetchDashboard?.();
      setModalOpen(false);
      setEditing(null);
    } catch (e) {
      const msg = e?.message || "No se pudo guardar la ruleta";
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  }, [editing, createAPIInstance, load, onRefetchDashboard]);

  const deleteRoulette = useCallback(async (roulette) => {
    if (!roulette?.id) { setError("Ruleta inválida para eliminar"); return; }

    const { id, name, status: st, is_drawn } = roulette;
    const isCompleted = is_drawn || st === "completed";
    const msg = isCompleted
      ? `La ruleta "${name}" ya fue sorteada/completada.\n\n¿Eliminarla de todos modos? Esta acción eliminará todos los datos relacionados.`
      : `¿Eliminar la ruleta "${name}"?\n\nEsta acción no se puede deshacer y eliminará:\n• La ruleta\n• Todas las participaciones\n• Todos los premios\n• El historial de sorteos`;

    if (!window.confirm(msg)) return;

    try {
      setLoading(true);
      setError("");
      const api = createAPIInstance();
      await api.deleteRoulette(id, { force: isCompleted });

      setItems(prev => prev.filter(it => it.id !== id));
      setCount(c => Math.max(0, c - 1));

      await load();
      onRefetchDashboard?.();
    } catch (e) {
      setError("No se pudo eliminar: " + (e?.message || "Error desconocido"));
    } finally {
      setLoading(false);
    }
  }, [createAPIInstance, load, onRefetchDashboard]);

  const openPrizePanel = useCallback(async (roulette) => {
    if (!roulette?.id) { setError("Ruleta inválida para gestionar premios"); return; }
    setPrizePanelOpen(true);
    setPrizeContext({
      rouletteId: roulette.id,
      data: [],
      rouletteName: roulette.name || `Ruleta ${roulette.id}`
    });
    await fetchPrizes(roulette.id);
  }, []);

  const fetchPrizes = useCallback(async (rouletteId, opts = {}) => {
    if (!rouletteId) { setError("ID de ruleta inválido para cargar premios"); return []; }
    try {
      if (!opts.returnOnly) setPrizeLoading(true);
      const api = createAPIInstance();
      const res = await api.listPrizes(rouletteId);

      let prizesList = [];
      if (res) {
        if (Array.isArray(res.results)) prizesList = res.results;
        else if (Array.isArray(res)) prizesList = res;
        else if (res.data && Array.isArray(res.data)) prizesList = res.data;
      }

      if (!opts.returnOnly) {
        setPrizeContext(ctx => ({ ...ctx, data: prizesList }));
      }
      return prizesList;
    } catch (e) {
      if (!opts.returnOnly) {
        setError("No se pudieron cargar premios: " + (e?.message || "Error"));
        setPrizeContext(ctx => ({ ...ctx, data: [] }));
      }
      return [];
    } finally {
      if (!opts.returnOnly) setPrizeLoading(false);
    }
  }, [createAPIInstance]);

  const addPrize = useCallback(async (payload) => {
    if (!prizeContext.rouletteId || !payload) { setError("Datos inválidos para crear premio"); return; }
    try {
      setPrizeLoading(true);
      const api = createAPIInstance();
      await api.addPrize(prizeContext.rouletteId, payload);
      await fetchPrizes(prizeContext.rouletteId);
    } catch (e) {
      setError("No se pudo crear premio: " + (e?.message || "Error"));
    } finally {
      setPrizeLoading(false);
    }
  }, [prizeContext.rouletteId, createAPIInstance, fetchPrizes]);

  const updatePrize = useCallback(async (prizeId, payload) => {
    if (!prizeContext.rouletteId || !prizeId || !payload) { setError("Datos inválidos para actualizar premio"); return; }
    try {
      setPrizeLoading(true);
      const api = createAPIInstance();
      await api.updatePrize(prizeContext.rouletteId, prizeId, payload);
      await fetchPrizes(prizeContext.rouletteId);
    } catch (e) {
      setError("No se pudo actualizar premio: " + (e?.message || "Error"));
    } finally {
      setPrizeLoading(false);
    }
  }, [prizeContext.rouletteId, createAPIInstance, fetchPrizes]);

  const deletePrize = useCallback(async (prizeId) => {
    if (!prizeContext.rouletteId || !prizeId) { setError("Datos inválidos para eliminar premio"); return; }
    if (!window.confirm("¿Eliminar este premio? Esta acción no se puede deshacer.")) return;
    try {
      setPrizeLoading(true);
      const api = createAPIInstance();
      await api.deletePrize(prizeContext.rouletteId, prizeId);
      await fetchPrizes(prizeContext.rouletteId);
    } catch (e) {
      setError("No se pudo eliminar premio: " + (e?.message || "Error"));
    } finally {
      setPrizeLoading(false);
    }
  }, [prizeContext.rouletteId, createAPIInstance, fetchPrizes]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg shadow">
              <Layout className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Gestión de Ruletas</h1>
              <p className="text-sm text-gray-600">
                {count > 0 ? `${count} ruletas encontradas` : 'No hay ruletas'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={load}
              disabled={loading}
              className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              <RefreshCcw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
              Actualizar
            </button>
            <button
              onClick={startCreate}
              className="inline-flex items-center px-3 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-md shadow hover:from-blue-700 hover:to-indigo-700 transition-colors"
            >
              <Plus className="h-4 w-4 mr-1.5" /> Nueva ruleta
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre o descripción..."
              className="w-full pl-9 pr-3 py-2 bg-white rounded-md border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            />
            {query && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                <button onClick={() => setQuery("")} className="text-gray-400 hover:text-gray-600 p-1">
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>

          {/* ⬇️ Selector de estado restaurado (por defecto “Activa”) */}
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="px-3 py-2 bg-white rounded-md border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="active">Activa</option>
            <option value="">Todas</option>
            <option value="scheduled">Programada</option>
            <option value="completed">Completada</option>
            <option value="cancelled">Cancelada</option>
            <option value="draft">Borrador</option>
          </select>

          <select
            value={pageSize}
            onChange={(e) => { setPageSize(parseInt(e.target.value, 10)); setPage(1); }}
            className="px-3 py-2 bg-white rounded-md border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {[6, 12, 24, 48].map(n => <option key={n} value={n}>{n} / pág.</option>)}
          </select>
        </div>
      </div>

      {/* Contenido */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-14">
        {error && (
          <div className="mb-4 p-4 rounded-lg bg-red-50 border border-red-200 flex items-start justify-between">
            <div className="flex items-start space-x-3">
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="text-sm font-medium text-red-800">Error</h4>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
            <button onClick={() => setError("")} className="text-red-400 hover:text-red-600 transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {loading && (
          <div className="py-12 text-center text-gray-500">
            <div className="mx-auto mb-3 h-8 w-8 border-2 border-b-transparent border-blue-600 rounded-full animate-spin"></div>
            <p className="text-sm">Cargando ruletas...</p>
          </div>
        )}

        {!loading && filtered.length === 0 && !error && (
          <div className="py-16 text-center">
            <div className="max-w-md mx-auto">
              <Layout className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {query ? "No se encontraron ruletas" : (status ? "No hay ruletas con este estado" : "No hay ruletas")}
              </h3>
              <p className="text-sm text-gray-500 mb-6">
                {query ? "Intenta cambiar los filtros de búsqueda" : "Comienza creando tu primera ruleta de premios"}
              </p>
              {!query && (
                <button
                  onClick={startCreate}
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-md shadow hover:from-blue-700 hover:to-indigo-700 transition-colors"
                >
                  <Plus className="h-4 w-4 mr-2" /> Crear la primera ruleta
                </button>
              )}
            </div>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((roulette) => {
                const imageUrl = getImageUrl(roulette);
                const statusConfig = getStatusConfig(roulette.status);
                const isExpanded = expandedDescriptions.has(roulette.id);
                const showSeeMore = roulette.description && roulette.description.length > 150;

                const scheduledDate = formatDateHuman(roulette.scheduled_date);
                const showTimer = shouldShowTimer(roulette);

                const participantCount = roulette.participants_count || 0;
                const canSpin = roulette.status === 'active' && !roulette.is_drawn && participantCount > 0;

                return (
                  <div key={roulette.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200">
                    {/* Imagen */}
                    <div className="h-40 bg-gray-100 relative overflow-hidden">
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={roulette.name || 'Ruleta'}
                          className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            const fb = e.currentTarget.parentElement?.querySelector('.fallback-icon');
                            if (fb) fb.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div className={`fallback-icon w-full h-full flex items-center justify-center text-gray-400 ${imageUrl ? 'hidden' : 'flex'}`}>
                        <ImageIcon className="h-12 w-12" />
                      </div>

                      {/* Estado */}
                      <div className={`absolute top-3 left-3 px-3 py-1 rounded-full text-xs font-medium border ${statusConfig.class} backdrop-blur-sm`}>
                        <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${statusConfig.dot}`} />
                        {statusConfig.label}
                      </div>

                      {/* Badge de participantes */}
                      {participantCount > 0 && (
                        <div className={`absolute top-3 right-3 px-2 py-1 rounded-full text-xs font-medium border backdrop-blur-sm ${
                          participantCount > 100 ? 'bg-purple-50 text-purple-700 border-purple-200' :
                          participantCount > 20 ? 'bg-blue-50 text-blue-700 border-blue-200' :
                          'bg-gray-50 text-gray-700 border-gray-200'
                        }`}>
                          {participantCount > 100 ? 'Épico' : participantCount > 20 ? 'Intenso' : 'Rápido'}
                        </div>
                      )}
                    </div>

                    {/* Contenido */}
                    <div className="p-5">
                      <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">
                        {roulette.name || "Sin título"}
                      </h3>

                      {/* Cronómetros */}
                      {showTimer && (
                        <div className="mb-4 space-y-2">
                          {roulette.participation_end && (
                            <RouletteCountdown targetDate={roulette.participation_end} label="Fin de participación" type="end" />
                          )}
                          {roulette.scheduled_date && (
                            <RouletteCountdown targetDate={roulette.scheduled_date} label="Sorteo programado" type="draw" />
                          )}
                        </div>
                      )}

                      {/* Descripción */}
                      {roulette.description && (
                        <div className="mb-4">
                          <div
                            className={`text-sm text-gray-700 leading-relaxed ${!isExpanded && showSeeMore ? "line-clamp-3" : ""}`}
                            style={{ overflowWrap: "anywhere", lineHeight: "1.6" }}
                            dangerouslySetInnerHTML={{ __html: processText(roulette.description) }}
                          />
                          {showSeeMore && (
                            <button
                              type="button"
                              onClick={() => toggleDescription(roulette.id)}
                              className="mt-2 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
                            >
                              {isExpanded ? "Ver menos" : "Ver más"}
                            </button>
                          )}
                        </div>
                      )}

                      {/* Metadatos */}
                      <div className="flex items-center text-xs text-gray-500 gap-4 mb-4">
                        {scheduledDate && (
                          <span className="inline-flex items-center">
                            <Calendar className="h-3 w-3 mr-1" />
                            {scheduledDate}
                          </span>
                        )}
                        {typeof participantCount === "number" && (
                          <span className={`inline-flex items-center ${
                            participantCount > 100 ? 'text-purple-600 font-medium' :
                            participantCount > 20 ? 'text-blue-600 font-medium' :
                            'text-gray-500'
                          }`}>
                            <Users className="h-3 w-3 mr-1" />
                            {participantCount}
                          </span>
                        )}
                      </div>

                      {/* Acciones */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => startEdit(roulette.id)}
                            className="inline-flex items-center px-3 py-1.5 text-xs font-medium border rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                          >
                            <Edit className="h-3.5 w-3.5 mr-1" /> Editar
                          </button>
                          <button
                            onClick={() => openPrizePanel(roulette)}
                            className="inline-flex items-center px-3 py-1.5 text-xs font-medium border rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                          >
                            <Gift className="h-3.5 w-3.5 mr-1" /> Premios
                          </button>
                        </div>

                        <div className="flex items-center gap-2">
                          {canSpin && (
                            <button
                              onClick={() => navigate(`/admin/roulettes/${roulette.id}/spin`)}
                              className="inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-md text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
                              title="Ir a la pantalla de giro"
                            >
                              <Play className="h-3.5 w-3.5 mr-1" />
                              Girar
                            </button>
                          )}

                          <button
                            onClick={() => deleteRoulette(roulette)}
                            className="inline-flex items-center px-3 py-1.5 text-xs font-medium border rounded-md text-red-600 bg-white hover:bg-red-50 border-red-200 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-1" /> Eliminar
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Paginación */}
            {totalPages > 1 && (
              <div className="mt-8 flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Página {page} de {totalPages} · {count} resultados
                  {query && ` (filtrado de ${items.length})`}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="px-3 py-2 text-sm bg-white border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                  >
                    Anterior
                  </button>
                  <span className="px-3 py-2 text-sm font-medium">
                    {page} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="px-3 py-2 text-sm bg-white border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modales */}
      <RouletteModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null); setError(""); }}
        editing={editing}
        setEditing={setEditing}
        onSave={saveEditing}
        loading={loading}
        error={error}
      />

      <PrizePanel
        isOpen={prizePanelOpen}
        onClose={() => { setPrizePanelOpen(false); setError(""); }}
        prizeContext={prizeContext}
        prizeLoading={prizeLoading}
        onAddPrize={addPrize}
        onUpdatePrize={updatePrize}
        onDeletePrize={deletePrize}
      />
    </div>
  );
};

export default RouletteManager;
