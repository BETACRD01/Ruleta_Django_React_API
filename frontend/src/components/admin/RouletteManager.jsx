import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  Plus, Search, RefreshCcw, Edit, Trash2, Users, Calendar,
  Gift, Layout, Image as ImageIcon, X, AlertCircle, Clock, Trophy
} from "lucide-react";
import { RoulettesAPI, getGlobalAuthToken } from "../../config/api";
import RouletteModal from "../admin/Gestión de Ruletas/RouletteModal.jsx";
import PrizePanel from "../admin/Gestión de Ruletas/PrizePanel";
import '../../styles/ckeditor-custom.css';

/* ===========================
   COMPONENTE CRONÓMETRO PARA TARJETAS
   =========================== */
const RouletteCountdown = ({ startDate, endDate, label, type = "end" }) => {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    phase: 'inactive'
  });

  useEffect(() => {
    if (!endDate) {
      setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, phase: 'inactive' });
      return;
    }

    const updateTimer = () => {
      const now = new Date().getTime();
      const start = startDate ? new Date(startDate).getTime() : 0;
      const end = new Date(endDate).getTime();

      if (startDate && now < start) {
        const difference = start - now;
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);

        setTimeLeft({ days, hours, minutes, seconds, phase: 'waiting' });
        return;
      }

      const difference = end - now;
      
      if (difference > 0) {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);

        setTimeLeft({ days, hours, minutes, seconds, phase: 'active' });
        return;
      }
      
      setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, phase: 'expired' });
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [startDate, endDate]);

  if (timeLeft.phase === 'inactive') {
    return null;
  }

  const getStyles = () => {
    if (timeLeft.phase === 'expired') {
      return {
        container: "bg-orange-50 border-orange-200",
        text: "text-orange-800",
        badge: "bg-orange-100 text-orange-700"
      };
    }
    
    if (timeLeft.phase === 'waiting') {
      return {
        container: "bg-blue-50 border-blue-200",
        text: "text-blue-800",
        badge: "bg-blue-100 text-blue-700"
      };
    }

    const totalMinutes = timeLeft.days * 24 * 60 + timeLeft.hours * 60 + timeLeft.minutes;
    
    if (totalMinutes < 60) {
      return {
        container: "bg-red-50 border-red-200",
        text: "text-red-800",
        badge: "bg-red-100 text-red-700"
      };
    }
    
    if (totalMinutes < 1440) {
      return {
        container: "bg-orange-50 border-orange-200",
        text: "text-orange-800",
        badge: "bg-orange-100 text-orange-700"
      };
    }
    
    if (type === "draw") {
      return {
        container: "bg-purple-50 border-purple-200",
        text: "text-purple-800",
        badge: "bg-purple-100 text-purple-700"
      };
    }
    
    return {
      container: "bg-green-50 border-green-200",
      text: "text-green-800",
      badge: "bg-green-100 text-green-700"
    };
  };

  const getMessage = () => {
    if (timeLeft.phase === 'expired') {
      return type === "draw" ? "Sorteo vencido" : "⏳ Esperando sorteo";
    }
    if (timeLeft.phase === 'waiting') {
      return type === "draw" ? "Sorteo inicia en" : "Participación inicia en";
    }
    return type === "draw" ? "Sorteo en" : "Cierra en";
  };

  const styles = getStyles();

  return (
    <div className={`p-3 rounded-lg border ${styles.container}`}>
      <div className={`flex items-center text-xs font-medium ${styles.text} mb-2`}>
        <Clock className="h-3 w-3 mr-1" />
        {label || getMessage()}
      </div>
      {timeLeft.phase === 'expired' ? (
        <div className="text-sm font-bold text-orange-600">
          {type === "draw" ? "¡Ejecutar sorteo!" : "¡Cerrado - Ejecutar sorteo!"}
        </div>
      ) : (
        <div className="flex flex-wrap gap-1">
          {timeLeft.days > 0 && (
            <span className={`px-2 py-1 rounded text-xs font-bold ${styles.badge}`}>
              {timeLeft.days}d
            </span>
          )}
          <span className={`px-2 py-1 rounded text-xs font-bold ${styles.badge}`}>
            {String(timeLeft.hours).padStart(2, '0')}h
          </span>
          <span className={`px-2 py-1 rounded text-xs font-bold ${styles.badge}`}>
            {String(timeLeft.minutes).padStart(2, '0')}m
          </span>
          <span className={`px-2 py-1 rounded text-xs font-bold ${styles.badge}`}>
            {String(timeLeft.seconds).padStart(2, '0')}s
          </span>
        </div>
      )}
    </div>
  );
};

// Instancia de API con token
const createAPIInstance = () => {
  const token = getGlobalAuthToken();
  return new RoulettesAPI(token);
};

const RouletteManager = ({ onRefetchDashboard }) => {
  // -------------------- Estado principal --------------------
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);

  // Paginación
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [count, setCount] = useState(0);
  const totalPages = Math.max(1, Math.ceil(count / pageSize));

  // Filtros
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");

  // UI States
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [prizePanelOpen, setPrizePanelOpen] = useState(false);
  const [prizeContext, setPrizeContext] = useState({ rouletteId: null, data: [], rouletteName: "" });
  const [prizeLoading, setPrizeLoading] = useState(false);

  // Descripciones expandidas por tarjeta
  const [expandedDescriptions, setExpandedDescriptions] = useState(new Set());

  // -------------------- Helpers para imágenes --------------------
  const getImageUrl = (roulette) => {
    if (!roulette) return null;
    
    const possibleFields = [
      'cover_image_url',
      'cover_image', 
      'cover_url',
      'image_url',
      'image'
    ];
    
    for (const field of possibleFields) {
      const url = roulette[field];
      if (url && typeof url === 'string' && url.trim() !== '' && url !== 'null') {
        if (url.startsWith('/media/') || url.startsWith('/static/')) {
          const baseURL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
          return `${baseURL.replace('/api', '')}${url}`;
        }
        if (url.startsWith('http')) {
          return url;
        }
        return url;
      }
    }
    
    return null;
  };

  // -------------------- Helper para verificar si debe mostrar cronómetro --------------------
  const shouldShowTimer = (roulette) => {
    const now = new Date().getTime();
    const participationEnd = roulette.participation_end ? new Date(roulette.participation_end).getTime() : null;
    const scheduledDate = roulette.scheduled_date ? new Date(roulette.scheduled_date).getTime() : null;
    
    const recentThreshold = 60 * 60 * 1000;
    
    return (
      (participationEnd && participationEnd > (now - recentThreshold)) ||
      (scheduledDate && scheduledDate > (now - recentThreshold))
    );
  };

  // -------------------- Carga de datos --------------------
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const api = createAPIInstance();
      const params = { page, page_size: pageSize };
      if (status) params.status = status;

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
      console.error("Error cargando ruletas:", e);
      setError(e?.message || "Error cargando ruletas");
      setItems([]);
      setCount(0);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, status]);

  useEffect(() => { 
    load(); 
  }, [load]);

  // -------------------- Filtros --------------------
  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter(
      (r) =>
        String(r.name || "").toLowerCase().includes(q) ||
        String(r.description || "").toLowerCase().includes(q)
    );
  }, [items, query]);

  const getStatusConfig = (st) => {
    const configs = {
      active:     { label: "Activa",     class: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-400" },
      scheduled:  { label: "Programada", class: "bg-blue-50 text-blue-700 border-blue-200",         dot: "bg-blue-400" },
      completed:  { label: "Completada", class: "bg-purple-50 text-purple-700 border-purple-200",   dot: "bg-purple-400" },
      cancelled:  { label: "Cancelada",  class: "bg-red-50 text-red-700 border-red-200",             dot: "bg-red-400" },
      draft:      { label: "Borrador",   class: "bg-gray-50 text-gray-700 border-gray-200",          dot: "bg-gray-400" },
    };
    return configs[st] || { label: st || "—", class: "bg-gray-50 text-gray-700 border-gray-200", dot: "bg-gray-400" };
  };

  // -------------------- Funciones para "Ver más" --------------------
  const toggleDescription = (rouletteId) => {
    setExpandedDescriptions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(rouletteId)) {
        newSet.delete(rouletteId);
      } else {
        newSet.add(rouletteId);
      }
      return newSet;
    });
  };

  const isDescriptionExpanded = (rouletteId) => {
    return expandedDescriptions.has(rouletteId);
  };

  const shouldShowSeeMore = (description) => {
    if (!description) return false;
    return description.length > 150;
  };

  // -------------------- Acciones CRUD --------------------
  const startCreate = () => {
    setEditing({
      id: null,
      name: "",
      description: "",
      status: "active",
      participation_start: "",
      participation_end: "",
      scheduled_date: "",
      cover_image: null,
      cover_preview: "",
      cover_url: "",
      cover_delete: false,
    });
    setModalOpen(true);
  };

  const startEdit = async (id) => {
    if (!id) {
      setError("ID de ruleta inválido");
      return;
    }
    
    try {
      setLoading(true);
      setError("");
      
      const api = createAPIInstance();
      const detail = await api.getRoulette(id);
      
      if (!detail) {
        throw new Error("No se pudo obtener el detalle de la ruleta");
      }
      
      const imageUrl = getImageUrl(detail);
      
      const editingData = {
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
      };
      
      setEditing(editingData);
      setModalOpen(true);
    } catch (e) {
      console.error("Error cargando detalle:", e);
      setError("No se pudo cargar el detalle: " + (e?.message || "Error desconocido"));
    } finally {
      setLoading(false);
    }
  };

  const saveEditing = async (payload) => {
    if (!payload) {
      setError("Datos de payload inválidos");
      return;
    }
    
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
        updatedOrCreated = await api.createRoulette(payload);
      }

      if (updatedOrCreated?.id) {
        setItems((prevItems) => {
          const existingIndex = prevItems.findIndex((x) => x.id === updatedOrCreated.id);
          
          if (existingIndex === -1) {
            return [updatedOrCreated, ...prevItems];
          } else {
            const newItems = [...prevItems];
            newItems[existingIndex] = { 
              ...prevItems[existingIndex], 
              ...updatedOrCreated 
            };
            return newItems;
          }
        });
      }

      await load();
      
      if (typeof onRefetchDashboard === 'function') {
        onRefetchDashboard();
      }

      setModalOpen(false);
      setEditing(null);
      
    } catch (e) {
      console.error("Error guardando ruleta:", e);
      const errorMessage = e?.message || "No se pudo guardar la ruleta";
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const deleteRoulette = async (roulette) => {
    if (!roulette?.id) {
      setError("Ruleta inválida para eliminar");
      return;
    }
    
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
      
      setItems((prevItems) => prevItems.filter((item) => item.id !== id));
      setCount((prevCount) => Math.max(0, prevCount - 1));
      
      await load();
      
      if (typeof onRefetchDashboard === 'function') {
        onRefetchDashboard();
      }
      
    } catch (e) {
      console.error("Error eliminando ruleta:", e);
      setError("No se pudo eliminar: " + (e?.message || "Error desconocido"));
    } finally {
      setLoading(false);
    }
  };

  // -------------------- Gestión de premios --------------------
  const openPrizePanel = async (roulette) => {
    if (!roulette?.id) {
      setError("Ruleta inválida para gestionar premios");
      return;
    }
    
    setPrizePanelOpen(true);
    setPrizeContext({
      rouletteId: roulette.id,
      data: [],
      rouletteName: roulette.name || `Ruleta ${roulette.id}`
    });
    
    await fetchPrizes(roulette.id);
  };

  const fetchPrizes = async (rouletteId) => {
    if (!rouletteId) {
      setError("ID de ruleta inválido para cargar premios");
      return;
    }
    
    try {
      setPrizeLoading(true);
      
      const api = createAPIInstance();
      const res = await api.listPrizes(rouletteId);
      
      let prizesList = [];
      if (res) {
        if (Array.isArray(res.results)) {
          prizesList = res.results;
        } else if (Array.isArray(res)) {
          prizesList = res;
        } else if (res.data && Array.isArray(res.data)) {
          prizesList = res.data;
        }
      }
      
      setPrizeContext((ctx) => ({ 
        ...ctx, 
        data: prizesList 
      }));
      
    } catch (e) {
      console.error("Error cargando premios:", e);
      setError("No se pudieron cargar premios: " + (e?.message || "Error"));
      setPrizeContext((ctx) => ({ ...ctx, data: [] }));
    } finally {
      setPrizeLoading(false);
    }
  };

  const addPrize = async (payload) => {
    if (!prizeContext.rouletteId || !payload) {
      setError("Datos inválidos para crear premio");
      return;
    }
    
    try {
      setPrizeLoading(true);
      
      const api = createAPIInstance();
      await api.addPrize(prizeContext.rouletteId, payload);
      await fetchPrizes(prizeContext.rouletteId);
      
    } catch (e) {
      console.error("Error creando premio:", e);
      setError("No se pudo crear premio: " + (e?.message || "Error"));
    } finally {
      setPrizeLoading(false);
    }
  };

  const updatePrize = async (prizeId, payload) => {
    if (!prizeContext.rouletteId || !prizeId || !payload) {
      setError("Datos inválidos para actualizar premio");
      return;
    }
    
    try {
      setPrizeLoading(true);
      
      const api = createAPIInstance();
      await api.updatePrize(prizeContext.rouletteId, prizeId, payload);
      await fetchPrizes(prizeContext.rouletteId);
      
    } catch (e) {
      console.error("Error actualizando premio:", e);
      setError("No se pudo actualizar premio: " + (e?.message || "Error"));
    } finally {
      setPrizeLoading(false);
    }
  };

  const deletePrize = async (prizeId) => {
    if (!prizeContext.rouletteId || !prizeId) {
      setError("Datos inválidos para eliminar premio");
      return;
    }
    
    if (!window.confirm("¿Eliminar este premio? Esta acción no se puede deshacer.")) {
      return;
    }
    
    try {
      setPrizeLoading(true);
      
      const api = createAPIInstance();
      await api.deletePrize(prizeContext.rouletteId, prizeId);
      await fetchPrizes(prizeContext.rouletteId);
      
    } catch (e) {
      console.error("Error eliminando premio:", e);
      setError("No se pudo eliminar premio: " + (e?.message || "Error"));
    } finally {
      setPrizeLoading(false);
    }
  };

  // -------------------- Helpers de UI --------------------
  const handleErrorClose = () => {
    setError("");
  };

  const formatDate = (dateString) => {
    if (!dateString) return null;
    try {
      return new Date(dateString).toLocaleString('es-ES', {
        year: 'numeric',
        month: '2-digit', 
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  // -------------------- Render --------------------
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Toolbar */}
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

        {/* Filtros rápidos */}
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
                <button
                  onClick={() => setQuery("")}
                  className="text-gray-400 hover:text-gray-600 p-1"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>

          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="px-3 py-2 bg-white rounded-md border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todos los estados</option>
            <option value="active">Activa</option>
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
        {/* Error Banner */}
        {error && (
          <div className="mb-4 p-4 rounded-lg bg-red-50 border border-red-200 flex items-start justify-between">
            <div className="flex items-start space-x-3">
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="text-sm font-medium text-red-800">Error</h4>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
            <button
              onClick={handleErrorClose}
              className="text-red-400 hover:text-red-600 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="py-12 text-center text-gray-500">
            <div className="mx-auto mb-3 h-8 w-8 border-2 border-b-transparent border-blue-600 rounded-full animate-spin"></div>
            <p className="text-sm">Cargando ruletas...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && filtered.length === 0 && !error && (
          <div className="py-16 text-center">
            <div className="max-w-md mx-auto">
              <Layout className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {query ? "No se encontraron ruletas" : "No hay ruletas"}
              </h3>
              <p className="text-sm text-gray-500 mb-6">
                {query 
                  ? "Intenta cambiar los filtros de búsqueda" 
                  : "Comienza creando tu primera ruleta de premios"
                }
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

        {/* GRID de ruletas */}
        {!loading && filtered.length > 0 && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((r) => {
                const img = getImageUrl(r);
                const st = getStatusConfig(r.status);
                const isExpanded = isDescriptionExpanded(r.id);
                const showSeeMore = shouldShowSeeMore(r.description);
                const scheduledDate = formatDate(r.scheduled_date);
                const showTimer = shouldShowTimer(r);
                const isDrawn = Boolean(r.is_drawn || r.drawn_at || r.winner_id);
                
                return (
                  <div 
                    key={r.id} 
                    className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200"
                  >
                    {/* Imagen / placeholder */}
                    <div className="h-40 bg-gray-100 relative overflow-hidden">
                      {img ? (
                        <img 
                          src={img} 
                          alt={r.name || 'Ruleta'} 
                          className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.parentElement.querySelector('.fallback-icon').style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div 
                        className={`fallback-icon w-full h-full flex items-center justify-center text-gray-400 ${img ? 'hidden' : 'flex'}`}
                      >
                        <ImageIcon className="h-12 w-12" />
                      </div>
                      
                      {/* Estado */}
                      <div className={`absolute top-3 left-3 px-3 py-1 rounded-full text-xs font-medium border ${st.class} backdrop-blur-sm`}>
                        <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${st.dot}`} />
                        {st.label}
                      </div>
                      
                      {/* Badge si sorteo completado */}
                      {isDrawn && (
                        <div className="absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-medium border bg-green-100 text-green-800 border-green-200 backdrop-blur-sm">
                          <Trophy className="inline-block w-3 h-3 mr-1" />
                          Sorteado
                        </div>
                      )}
                    </div>

                    {/* Body */}
                    <div className="p-5">
                      <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">
                        {r.name || "Sin título"}
                      </h3>

                      {/* CRONÓMETROS Y FECHAS EN LAS TARJETAS */}
                      {showTimer && !isDrawn && (
                        <div className="mb-4 space-y-2">
                          {/* Cronómetro de participación */}
                          {r.participation_end && (
                            <RouletteCountdown
                              startDate={r.participation_start}
                              endDate={r.participation_end}
                              label={null}
                              type="end"
                            />
                          )}
                          
                          {/* Fecha del sorteo (estática, sin cronómetro) */}
                          {r.scheduled_date && (
                            <div className="p-3 rounded-lg border bg-purple-50 border-purple-200">
                              <div className="flex items-center text-xs font-medium text-purple-800 mb-2">
                                <Calendar className="h-3 w-3 mr-1" />
                                Fecha del sorteo
                              </div>
                              <div className="text-sm font-bold text-purple-700">
                                {formatDate(r.scheduled_date)}
                              </div>
                              <div className="text-xs text-purple-600 mt-1">
                                Ejecutar manualmente
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* Mensaje si sorteo completado */}
                      {isDrawn && (
                        <div className="mb-4 p-3 rounded-lg border bg-green-50 border-green-200">
                          <div className="flex items-center text-xs font-medium text-green-800">
                            <Trophy className="h-3 w-3 mr-1" />
                            Sorteo completado - Ya hay ganador
                          </div>
                        </div>
                      )}

                      {/* Descripción con HTML renderizado + Ver más */}
                      {r.description && (
                        <div className="mb-4">
                          <div
                            className={`text-sm text-gray-700 leading-relaxed prose prose-sm max-w-none ${
                              !isExpanded && showSeeMore ? "line-clamp-3" : ""
                            }`}
                            style={{ overflowWrap: "anywhere" }}
                            dangerouslySetInnerHTML={{ 
                              __html: r.description 
                            }}
                          />
                          {showSeeMore && (
                            <button
                              type="button"
                              onClick={() => toggleDescription(r.id)}
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
                        {typeof r.participants_count === "number" && (
                          <span className="inline-flex items-center">
                            <Users className="h-3 w-3 mr-1" />
                            {r.participants_count}
                          </span>
                        )}
                      </div>

                      {/* Acciones */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => startEdit(r.id)}
                            className="inline-flex items-center px-3 py-1.5 text-xs font-medium border rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                          >
                            <Edit className="h-3.5 w-3.5 mr-1" /> Editar
                          </button>
                          <button
                            onClick={() => openPrizePanel(r)}
                            className="inline-flex items-center px-3 py-1.5 text-xs font-medium border rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                          >
                            <Gift className="h-3.5 w-3.5 mr-1" /> Premios
                          </button>
                        </div>
                        <button
                          onClick={() => deleteRoulette(r)}
                          className="inline-flex items-center px-3 py-1.5 text-xs font-medium border rounded-md text-red-600 bg-white hover:bg-red-50 border-red-200 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" /> Eliminar
                        </button>
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
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="px-3 py-2 text-sm bg-white border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                  >
                    Anterior
                  </button>
                  <span className="px-3 py-2 text-sm font-medium">
                    {page} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
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
        onClose={() => { 
          setModalOpen(false); 
          setEditing(null); 
          setError("");
        }}
        editing={editing}
        setEditing={setEditing}
        onSave={saveEditing}  
        loading={loading}
        error={error}
      />

      <PrizePanel
        isOpen={prizePanelOpen}
        onClose={() => {
          setPrizePanelOpen(false);
          setError("");
        }}
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