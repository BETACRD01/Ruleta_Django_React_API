// src/components/NotificationCenter.jsx
import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  RefreshCcw, Trash2, CheckCheck, Filter, AlertTriangle, Inbox, Search,
  ChevronDown, Shield, Users, Globe, CheckSquare, X, MoreHorizontal, Trophy, Clock,
  Settings, Target, Zap
} from "lucide-react";
import { notificationAPI, notificationManager } from "../../config/api";

/**
 * NotificationCenter
 * -----------------------------------------------------------------------------
 * Modos de fuente:
 *  - "user": feed combinado (privadas + públicas + solo-admin si eres staff)
 *  - "admin": exclusivamente admin-only del propio staff (ganadores, problemas, alertas)
 *  - "public": exclusivamente públicas
 *
 * Props:
 * - onUnreadChange?: (n:number) => void  // actualiza badge global
 * - defaultPageSize?: number
 * - defaultPriority?: ''|'urgent'|'high'|'normal'|'low'
 * - rouletteId?: number
 * - compact?: boolean
 * - defaultSource?: 'user'|'admin'|'public'
 */
const NotificationCenter = ({
  onUnreadChange,
  defaultPageSize = 15,
  defaultPriority = "",
  rouletteId,
  compact = false,
  defaultSource = "user",
}) => {
  // -------------------- estado --------------------
  const [loading, setLoading] = useState(true);
  const [list, setList] = useState([]);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [totalPages, setTotalPages] = useState(1);

  // filtros UI
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [priority, setPriority] = useState(defaultPriority);
  const [search, setSearch] = useState("");

  // selección
  const [selected, setSelected] = useState(new Set());

  // fuente (user/admin/public)
  const [source, setSource] = useState(defaultSource); // 'user' | 'admin' | 'public'

  // sticky header sombra
  const headerRef = useRef(null);
  const [shadow, setShadow] = useState(false);
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const onScroll = () => setShadow(el.parentElement?.scrollTop > 0);
    el.parentElement?.addEventListener("scroll", onScroll);
    return () => el.parentElement?.removeEventListener("scroll", onScroll);
  }, []);

  // -------------------- carga --------------------
  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const query = {
        page,
        page_size: pageSize,
        include_stats: source === "user", // /user/ adjunta stats si se pide
      };
      if (unreadOnly) query.unread_only = true;
      if (priority) query.priority = priority;
      if (rouletteId) query.roulette_id = rouletteId;

      let res;
      if (source === "admin") {
        res = await notificationAPI.getAdminNotifications(query);
      } else if (source === "public") {
        res = await notificationAPI.getPublicNotifications(query);
      } else {
        res = await notificationAPI.getUserNotifications(query);
      }

      const items = Array.isArray(res?.results)
        ? res.results
        : Array.isArray(res)
        ? res
        : [];

      setList(items);

      // stats solo en feed "user"
      if (source === "user") {
        const s = res?.stats || null;
        setStats(s);
        if (onUnreadChange && s && typeof s.unread_count === "number") {
          onUnreadChange(s.unread_count);
        }
      } else {
        setStats(null);
      }

      // paginación
      const total = res?.count ? Math.max(1, Math.ceil(res.count / pageSize)) : calcPagesFallback(res, page);
      setTotalPages(total);
    } catch (e) {
      console.error("Error cargando notificaciones:", e);
      setError(e?.message || "Error cargando notificaciones");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, unreadOnly, priority, rouletteId, source, onUnreadChange]);

  const calcPagesFallback = (res, currentPage) => {
    const next = res?.next;
    const prev = res?.previous;
    return res?.count
      ? Math.max(1, Math.ceil(res.count / pageSize))
      : next || prev
      ? currentPage + 1
      : currentPage;
  };

  useEffect(() => {
    load();
  }, [load]);

  // tiempo real / polling
  useEffect(() => {
    const handler = ({ stats }) => {
      if (source === "user" && onUnreadChange && stats?.unread_count != null) {
        onUnreadChange(stats.unread_count);
      }
      load();
    };

    if (notificationManager?.addListener) {
      const cleanup = notificationManager.addListener("notifications_updated", handler);
      if (notificationManager?.startPolling) notificationManager.startPolling(30000);
      return cleanup;
    } else {
      const id = setInterval(() => load(), 30000);
      return () => clearInterval(id);
    }
  }, [load, onUnreadChange, source]);

  // -------------------- acciones --------------------
  const toggleSelect = (id) => {
    setSelected((prev) => {
      const nx = new Set(prev);
      if (nx.has(id)) nx.delete(id);
      else nx.add(id);
      return nx;
    });
  };
  const selectAll = () => setSelected(new Set(list.map((n) => n.id)));
  const clearSelection = () => setSelected(new Set());

  const markSelectedRead = async () => {
    if (!selected.size) return;
    try {
      setLoading(true);
      setError("");
      console.log("Marcando como leídas:", Array.from(selected));
      
      await notificationAPI.markAsRead(Array.from(selected));
      clearSelection();
      await load();
      
      console.log("Notificaciones marcadas como leídas exitosamente");
    } catch (e) {
      console.error("Error marcando como leídas:", e);
      setError(e?.message || "No se pudo marcar como leídas");
    } finally {
      setLoading(false);
    }
  };

  const markAllRead = async () => {
    try {
      setLoading(true);
      setError("");
      console.log("Marcando todas como leídas...");
      
      await notificationAPI.markAllAsRead();
      clearSelection();
      await load();
      
      console.log("Todas las notificaciones marcadas como leídas");
    } catch (e) {
      console.error("Error marcando todas como leídas:", e);
      setError(e?.message || "No se pudo marcar todo como leído");
    } finally {
      setLoading(false);
    }
  };

  const deleteRead = async () => {
    if (!window.confirm("¿Estás seguro de que quieres eliminar todas las notificaciones leídas? Esta acción no se puede deshacer.")) {
      return;
    }
    
    try {
      setLoading(true);
      setError("");
      console.log("Eliminando notificaciones leídas...");
      
      // Usar el método correcto del API que ya tienes implementado
      const result = await notificationAPI.deleteReadNotifications();
      
      console.log("Resultado de eliminación:", result);
      
      // Limpiar selección ya que las notificaciones fueron eliminadas
      clearSelection();
      
      // Resetear a la página 1 por si eliminamos todas las de la página actual
      setPage(1);
      
      // Recargar la lista
      await load();
      
      console.log("Notificaciones leídas eliminadas exitosamente");
      
      // Mostrar mensaje de éxito temporal
      const tempSuccess = "Notificaciones leídas eliminadas correctamente";
      setError(""); // Limpiar errores previos
      
      // Opcional: mostrar un mensaje de éxito temporal
      setTimeout(() => {
        if (result?.deleted_count !== undefined) {
          console.log(`Se eliminaron ${result.deleted_count} notificaciones leídas`);
        }
      }, 100);
      
    } catch (e) {
      console.error("Error completo eliminando notificaciones:", e);
      
      // Manejar diferentes tipos de errores
      let errorMessage = "No se pudieron eliminar las notificaciones leídas";
      
      if (e?.message) {
        errorMessage = e.message;
      } else if (typeof e === "string") {
        errorMessage = e;
      }
      
      // Si el error es de autenticación, dar un mensaje más específico
      if (e?.message?.includes("401") || e?.message?.includes("Sesión expirada")) {
        errorMessage = "Tu sesión ha expirado. Inicia sesión de nuevo.";
      } else if (e?.message?.includes("403") || e?.message?.includes("permisos")) {
        errorMessage = "No tienes permisos para eliminar notificaciones.";
      } else if (e?.message?.includes("404")) {
        errorMessage = "No se encontraron notificaciones leídas para eliminar.";
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const refresh = () => {
    setError("");
    load();
  };

  // -------------------- filtros locales --------------------
  const filtered = useMemo(() => {
    if (!search) return list;
    const q = search.toLowerCase();
    return list.filter(
      (n) =>
        String(n.title || "").toLowerCase().includes(q) ||
        String(n.message || "").toLowerCase().includes(q) ||
        String(n.notification_type_display || n.notification_type || "").toLowerCase().includes(q)
    );
  }, [list, search]);

  // -------------------- ui helpers --------------------
  const priorityBadge = (p) => {
    const map = {
      urgent: "bg-red-100 text-red-800 ring-1 ring-red-200",
      high: "bg-orange-100 text-orange-800 ring-1 ring-orange-200",
      normal: "bg-blue-100 text-blue-800 ring-1 ring-blue-200",
      low: "bg-gray-100 text-gray-700 ring-1 ring-gray-200",
    };
    return map[p] || "bg-slate-100 text-slate-700 ring-1 ring-slate-200";
  };

  const typeChipLabel = (t) => {
    const map = {
      participation_confirmed: "Participación",
      roulette_winner: "Ganador",
      roulette_started: "Sorteo iniciado",
      roulette_ending_soon: "Termina pronto",
      winner_notification: "Victoria",
      admin_winner_alert: "Ganador Admin",
      admin_problem_alert: "Problema",
      admin_system_alert: "Sistema",
      welcome_message: "Bienvenida",
      roulette_created: "Ruleta creada",
      roulette_updated: "Ruleta actualizada",
      participant_added: "Nuevo participante",
      prize_added: "Premio agregado",
      system_maintenance: "Mantenimiento",
      security_alert: "Seguridad",
    };
    return map[t] || t;
  };

  const WinnerChip = ({ n }) => {
    const winnerName = n?.extra_data?.winner_name;
    const isWinnerNotification = ['roulette_winner', 'admin_winner_alert', 'winner_notification'].includes(n.notification_type);
    
    if (!winnerName && !isWinnerNotification) return null;
    
    return (
      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200">
        <Trophy className="h-3 w-3" /> 
        {winnerName ? `Ganador: ${winnerName}` : "Ganador seleccionado"}
      </span>
    );
  };

  const CountdownChip = ({ n }) => {
    const ed = n?.extra_data || {};
    const days = ed.days_left ?? ed.days ?? null;
    const hours = ed.hours_left ?? ed.hours ?? null;
    const endsAt = ed.ends_at || ed.deadline || null;
    
    if (n.notification_type !== "roulette_ending_soon" && days == null && hours == null && !endsAt) return null;

    const label =
      days != null
        ? `${days} día${days === 1 ? "" : "s"}`
        : hours != null
        ? `${hours} hora${hours === 1 ? "" : "s"}`
        : endsAt
        ? `Fin: ${new Date(endsAt).toLocaleString()}`
        : "Próximo a terminar";

    return (
      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-800 ring-1 ring-yellow-200">
        <Clock className="h-3 w-3" /> {label}
      </span>
    );
  };

  const AdminChip = ({ n }) => {
    const isAdminNotification = n.notification_type?.includes('admin_') || 
                               ['admin_winner_alert', 'admin_problem_alert', 'admin_system_alert'].includes(n.notification_type);
    
    if (!isAdminNotification) return null;
    
    const iconMap = {
      'admin_winner_alert': Trophy,
      'admin_problem_alert': AlertTriangle,
      'admin_system_alert': Zap,
    };
    
    const Icon = iconMap[n.notification_type] || Shield;
    
    return (
      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 ring-1 ring-purple-200">
        <Icon className="h-3 w-3" /> ADMIN
      </span>
    );
  };

  const BulkBar = () => {
    const count = selected.size;
    if (!count || source === "public") return null; // públicas no se marcan para el usuario
    return (
      <div className="sticky bottom-3 left-0 right-0 z-20 mx-auto max-w-5xl">
        <div className="bg-white/90 backdrop-blur rounded-xl shadow border px-3 py-2 flex items-center gap-2">
          <CheckSquare className="h-4 w-4" />
          <span className="text-sm">Seleccionadas: <b>{count}</b></span>
          <div className="ml-auto flex items-center gap-2">
            <button 
              onClick={markSelectedRead} 
              disabled={loading}
              className="px-3 py-1.5 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCheck className="h-4 w-4 inline -mt-0.5 mr-1" /> Marcar leídas
            </button>
            <button 
              onClick={clearSelection} 
              disabled={loading}
              className="px-3 py-1.5 text-sm rounded-md border hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <X className="h-4 w-4 inline -mt-0.5 mr-1" /> Limpiar
            </button>
          </div>
        </div>
      </div>
    );
  };

  const getSourceIcon = (sourceType) => {
    switch(sourceType) {
      case "admin": return Shield;
      case "public": return Globe;
      default: return Users;
    }
  };

  const getSourceTitle = (sourceType) => {
    switch(sourceType) {
      case "admin": return "Panel Administrativo - Ganadores y Alertas";
      case "public": return "Notificaciones Públicas";
      default: return "Feed Principal - Todas las notificaciones";
    }
  };

  // -------------------- render --------------------
  return (
    <div className={`bg-white rounded-lg shadow ${compact ? "p-0" : "p-0"}`} style={{ overflow: "hidden" }}>
      {/* Header sticky */}
      <div ref={headerRef} className={`sticky top-0 z-10 bg-white ${shadow ? "shadow-sm" : ""} border-b`}>
        <div className="px-4 py-3 flex items-center gap-3">
          <Settings className="h-5 w-5 text-gray-700" />
          <h2 className="text-lg font-semibold">Centro de Notificaciones</h2>

          {source === "user" && stats && (
            <span className="ml-2 text-xs text-gray-500">
              Total: {stats.total_count ?? "–"} • No leídas:{" "}
              <strong className="text-red-600">{stats.unread_count ?? "–"}</strong>
              {typeof stats.urgent_count === "number" ? (
                <> • Urgentes: <b className="text-red-700">{stats.urgent_count}</b></>
              ) : null}
            </span>
          )}

          {/* Switch fuente */}
          <div className="ml-auto flex items-center gap-1 rounded-md overflow-hidden border">
            <button
              className={`px-3 py-1.5 text-sm flex items-center gap-1 transition-colors ${
                source === "user" ? "bg-gray-900 text-white" : "bg-white hover:bg-gray-50"
              }`}
              title={getSourceTitle("user")}
              onClick={() => { setSource("user"); setPage(1); setError(""); }}
            >
              <Users className="h-4 w-4" /> 
              <span className="hidden sm:inline">Principal</span>
            </button>
            <button
              className={`px-3 py-1.5 text-sm flex items-center gap-1 transition-colors ${
                source === "admin" ? "bg-gray-900 text-white" : "bg-white hover:bg-gray-50"
              }`}
              title={getSourceTitle("admin")}
              onClick={() => { setSource("admin"); setPage(1); setError(""); }}
            >
              <Shield className="h-4 w-4" /> 
              <span className="hidden sm:inline">Admin</span>
            </button>
            <button
              className={`px-3 py-1.5 text-sm flex items-center gap-1 transition-colors ${
                source === "public" ? "bg-gray-900 text-white" : "bg-white hover:bg-gray-50"
              }`}
              title={getSourceTitle("public")}
              onClick={() => { setSource("public"); setPage(1); setError(""); }}
            >
              <Globe className="h-4 w-4" /> 
              <span className="hidden sm:inline">Públicas</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={refresh}
              disabled={loading}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-md border border-gray-300 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Refrescar notificaciones"
            >
              <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> 
              {loading ? "Cargando..." : "Refrescar"}
            </button>
            {source !== "public" && (
              <div className="relative group">
                <button 
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-md border hover:bg-gray-50 transition-colors" 
                  title="Acciones masivas"
                  disabled={loading}
                >
                  <MoreHorizontal className="h-4 w-4" /> Acciones
                </button>
                <div className="absolute right-0 mt-2 hidden group-hover:block bg-white border rounded-md shadow-lg z-20 min-w-56">
                  <button
                    onClick={markSelectedRead}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    disabled={!selected.size || loading}
                  >
                    <CheckCheck className="h-4 w-4" /> Marcar seleccionadas como leídas ({selected.size})
                  </button>
                  <button 
                    onClick={markAllRead} 
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={loading}
                  >
                    <CheckCheck className="h-4 w-4" /> Marcar todas como leídas
                  </button>
                  <hr className="my-1" />
                  <button 
                    onClick={deleteRead} 
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 text-red-600 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={loading}
                  >
                    <Trash2 className="h-4 w-4" /> Eliminar notificaciones leídas
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Mostrar errores en el header si los hay */}
        {error && (
          <div className="px-4 pb-2">
            <div className="flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded-lg text-sm">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
              <button 
                onClick={() => setError("")}
                className="ml-auto hover:bg-red-100 rounded p-0.5"
                title="Cerrar error"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>
        )}

        {/* Filtros */}
        <div className="px-4 pb-3">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-4">
              <label className="text-xs text-gray-600 mb-1 block">Buscar</label>
              <div className="relative">
                <Search className="h-4 w-4 text-gray-400 absolute left-2 top-2.5" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Título, mensaje, tipo..."
                  className="w-full pl-8 pr-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                />
              </div>
            </div>
            <div className="md:col-span-3">
              <label className="text-xs text-gray-600 mb-1 block">Prioridad</label>
              <div className="relative">
                <ChevronDown className="h-4 w-4 text-gray-400 absolute right-2 top-2.5 pointer-events-none" />
                <select
                  value={priority}
                  onChange={(e) => { setPriority(e.target.value); setPage(1); }}
                  className="w-full appearance-none pr-8 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                >
                  <option value="">Todas las prioridades</option>
                  <option value="urgent">🔴 Urgente</option>
                  <option value="high">🟠 Alta</option>
                  <option value="normal">🔵 Normal</option>
                  <option value="low">⚪ Baja</option>
                </select>
              </div>
            </div>
            <div className="md:col-span-2 flex items-end">
              {source !== "public" ? (
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={unreadOnly}
                    onChange={() => { setUnreadOnly(v => !v); setPage(1); }}
                    className="h-4 w-4 text-blue-600 rounded"
                  />
                  Solo no leídas
                </label>
              ) : (
                <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">Solo lectura</div>
              )}
            </div>
            <div className="md:col-span-3 flex items-end">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Filter className="h-4 w-4" />
                {rouletteId ? (
                  <span className="bg-violet-100 text-violet-800 px-2 py-1 rounded text-xs">
                    Ruleta #{rouletteId}
                  </span>
                ) : (
                  <span>Todas las ruletas</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabla / lista */}
      <div className="divide-y">
        <div className="bg-gray-50 px-3 py-2 flex items-center justify-between text-xs text-gray-600">
          <div className="flex items-center gap-2">
            {source !== "public" && (
              <>
                <button 
                  onClick={selectAll} 
                  className="px-2 py-1 border rounded hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!filtered.length || loading}
                >
                  Seleccionar todo
                </button>
                <button 
                  onClick={clearSelection} 
                  className="px-2 py-1 border rounded hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!selected.size || loading}
                >
                  Limpiar selección
                </button>
                <span className="ml-2">Seleccionadas: <b>{selected.size}</b></span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span>
              Fuente: <b>{getSourceTitle(source).split(' - ')[0]}</b>
            </span>
            <span>•</span>
            <span>Página {page} de {totalPages}</span>
            <span>•</span>
            <span>Total: {filtered.length}</span>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-14 text-gray-500">
            <RefreshCcw className="h-5 w-5 mr-2 animate-spin" /> Cargando notificaciones...
          </div>
        ) : error && filtered.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-red-600 bg-red-50 mx-4 my-4 rounded-lg">
            <AlertTriangle className="h-5 w-5 mr-2" /> {error}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500">
            <Inbox className="h-12 w-12 mb-3 text-gray-300" /> 
            <p className="text-lg font-medium mb-1">No hay notificaciones</p>
            <p className="text-sm">
              {search ? "No se encontraron resultados con esos filtros" : "No hay notificaciones en esta sección"}
            </p>
          </div>
        ) : (
          filtered.map((n) => (
            <article key={n.id} className="p-3 hover:bg-gray-50 transition-colors">
              <div className="flex items-start gap-3">
                {source !== "public" && (
                  <input
                    type="checkbox"
                    checked={selected.has(n.id)}
                    onChange={() => toggleSelect(n.id)}
                    className="mt-1 h-4 w-4 text-blue-600 rounded"
                    disabled={loading}
                  />
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    {source !== "public" && !n.is_read && (
                      <span className="inline-block text-[10px] px-1.5 py-0.5 rounded bg-blue-600 text-white font-medium">
                        NUEVA
                      </span>
                    )}
                    <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded font-medium ${priorityBadge(n.priority)}`}>
                      {n.priority_display || n.priority?.toUpperCase() || 'NORMAL'}
                    </span>
                    <span className="inline-block text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 font-medium">
                      {n.notification_type_display || typeChipLabel(n.notification_type)}
                    </span>
                    {n.roulette_id && (
                      <span className="inline-block text-[10px] px-1.5 py-0.5 rounded bg-violet-100 text-violet-800 font-medium">
                        Ruleta #{n.roulette_id}
                      </span>
                    )}
                    <AdminChip n={n} />
                    <WinnerChip n={n} />
                    <CountdownChip n={n} />
                    <span className="text-xs text-gray-400 ml-auto">
                      {n.time_since_created || new Date(n.created_at).toLocaleString()}
                    </span>
                  </div>

                  <h4 className="mt-1 font-semibold text-gray-900 text-sm">{n.title}</h4>
                  <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">{n.message}</p>

                  {n.extra_data && Object.keys(n.extra_data).length > 0 && (
                    <details className="mt-2">
                      <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700 transition-colors">
                        Ver datos adicionales
                      </summary>
                      <div className="mt-2 p-3 bg-gray-50 rounded-md border">
                        <pre className="text-xs overflow-auto whitespace-pre-wrap">
                          {JSON.stringify(n.extra_data, null, 2)}
                        </pre>
                      </div>
                    </details>
                  )}
                </div>
              </div>
            </article>
          ))
        )}

        {/* Footer tabla */}
        <div className="bg-gray-50 px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <span>Filas por página:</span>
            <select
              className="border rounded px-2 py-1 text-sm"
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
              disabled={loading}
            >
              {[10, 15, 20, 25, 50].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <span className="text-gray-500">•</span>
            <span className="text-gray-600">
              Mostrando {Math.min((page - 1) * pageSize + 1, filtered.length)} - {Math.min(page * pageSize, filtered.length)} de {filtered.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1 || loading}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="px-3 py-1.5 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white transition-colors"
            >
              Anterior
            </button>
            <span className="px-2 text-sm text-gray-600">{page} / {totalPages}</span>
            <button
              disabled={page >= totalPages || loading}
              onClick={() => setPage(p => p + 1)}
              className="px-3 py-1.5 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white transition-colors"
            >
              Siguiente
            </button>
          </div>
        </div>
      </div>

      {/* Resumen/indicadores rápidos (solo feed user) */}
      {source === "user" && stats && (
        <div className="px-4 pb-4 mt-2">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <BadgeStat label="Totales" value={stats.total_count ?? "–"} />
            <BadgeStat label="No leídas" value={stats.unread_count ?? "–"} highlight />
            <BadgeStat label="Urgentes" value={stats.urgent_count ?? "–"} urgent />
            <BadgeStat label="Alta prioridad" value={stats.high_priority_count ?? "–"} />
          </div>
        </div>
      )}

      {/* Barra de acciones masivas */}
      <BulkBar />
    </div>
  );
};

const BadgeStat = ({ label, value, highlight = false, urgent = false }) => (
  <div className={`p-3 rounded border ${
    urgent 
      ? "bg-red-50 border-red-200 text-red-700" 
      : highlight 
      ? "bg-yellow-50 border-yellow-200 text-yellow-700" 
      : "bg-gray-50 border-gray-200 text-gray-700"
  }`}>
    <div className="text-xs font-medium">{label}</div>
    <div className="text-lg font-semibold">{value}</div>
  </div>
);

export default NotificationCenter;