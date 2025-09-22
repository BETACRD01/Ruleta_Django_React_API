// ============================================================================
// Centro de Notificaciones (ADMIN)
// - Solo consume /notifications/admin (sin feeds de user/public).
// - UI compacta tipo tarjetas, con bordes por prioridad.
// - Acciones: marcar seleccionadas, marcar todas, eliminar leídas, borrar 1.
// - Paginación robusta (usa count; fallback con next/previous).
// ============================================================================

import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  RefreshCcw, Trash2, CheckCheck, AlertTriangle, Inbox, Search,
  ChevronDown, Shield, Check, X
} from "lucide-react";
import { notificationAPI } from "../../config/api";

// Opciones de prioridad (filtro)
const PRIORITY_OPTIONS = [
  { value: "",       label: "Todas" },
  { value: "urgent", label: "🔴 Urgente" },
  { value: "high",   label: "🟠 Alta" },
  { value: "normal", label: "🔵 Normal" },
  { value: "low",    label: "⚪ Baja" },
];

// Clases de color por prioridad (borde + background suave)
const rowPriorityClass = (p, isRead) => {
  if (isRead) return "border-l-gray-200 bg-white";
  switch (p) {
    case "urgent": return "border-l-red-500 bg-red-50";
    case "high":   return "border-l-orange-500 bg-orange-50";
    case "normal": return "border-l-blue-500 bg-blue-50";
    case "low":    return "border-l-green-500 bg-green-50";
    default:       return "border-l-gray-300 bg-gray-50";
  }
};

// Etiqueta legible del tipo
const typeLabel = (t) => {
  const map = {
    admin_winner_alert: "Ganador (Admin)",
    admin_problem_alert: "Problema (Admin)",
    admin_system_alert:  "Sistema (Admin)",
    roulette_winner:     "Ganador",
    winner_notification: "Victoria",
    roulette_started:    "Sorteo iniciado",
    roulette_ending_soon:"Termina pronto",
    roulette_created:    "Ruleta creada",
    roulette_updated:    "Ruleta actualizada",
    prize_added:         "Premio agregado",
    participant_added:   "Nuevo participante",
    security_alert:      "Seguridad",
    system_maintenance:  "Mantenimiento",
    welcome_message:     "Bienvenida",
  };
  return map[t] || t || "Notificación";
};

// Icono simple
const typeEmoji = (t) => {
  const map = {
    roulette_winner: "🎉", winner_notification: "🏆",
    roulette_started: "🎯", roulette_ending_soon: "⏰",
    admin_winner_alert: "👑", welcome_message: "👋"
  };
  return map[t] || "📢";
};

const AdminNotificationCenter = ({
  defaultPageSize = 15,
  defaultPriority = "",
  compact = true,
}) => {
  // -------------------- estado base --------------------
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  // datos + paginación
  const [list, setList]       = useState([]);
  const [page, setPage]       = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [totalPages, setTotalPages] = useState(1);

  // filtros
  const [priority, setPriority]   = useState(defaultPriority);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [q, setQ] = useState("");

  // selección
  const [selected, setSelected] = useState(new Set());

  // confirm modal
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  // sombra para header sticky
  const headerRef = useRef(null);
  const [shadow, setShadow] = useState(false);
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const onScroll = () => setShadow((el.parentElement?.scrollTop || 0) > 0);
    el.parentElement?.addEventListener("scroll", onScroll);
    return () => el.parentElement?.removeEventListener("scroll", onScroll);
  }, []);

  // -------------------- helpers paginación --------------------
  const calcPagesFallback = useCallback((res, currentPage) => {
    // Si backend no envía count, infiere por next/previous
    if (res?.count) return Math.max(1, Math.ceil(res.count / pageSize));
    if (res?.next || res?.previous) return currentPage + 1;
    return currentPage;
  }, [pageSize]);

  // -------------------- carga principal (ADMIN) --------------------
  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const params = {
        page, page_size: pageSize,
        priority: priority || undefined,
        unread_only: unreadOnly || undefined,
      };

      const res = await notificationAPI.getAdminNotifications(params);
      const items = Array.isArray(res?.results) ? res.results : Array.isArray(res) ? res : [];
      setList(items);

      const total = res?.count
        ? Math.max(1, Math.ceil(res.count / pageSize))
        : calcPagesFallback(res, page);

      setTotalPages(total);
    } catch (e) {
      console.error("Admin notifications load error:", e);
      setError(e?.message || "Error cargando notificaciones");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, priority, unreadOnly, calcPagesFallback]);

  useEffect(() => { load(); }, [load]);

  // polling simple cada 30s
  useEffect(() => {
    const id = setInterval(() => load(), 30000);
    return () => clearInterval(id);
  }, [load]);

  // -------------------- acciones --------------------
  const refresh = () => { setError(""); load(); };

  const toggleSelect = (id) => {
    setSelected(prev => {
      const nx = new Set(prev);
      nx.has(id) ? nx.delete(id) : nx.add(id);
      return nx;
    });
  };
  const clearSelection = () => setSelected(new Set());
  const selectAll = () => setSelected(new Set(list.map(n => n.id)));

  const markSelectedRead = async () => {
    if (!selected.size) return;
    try {
      setLoading(true);
      setError("");
      await notificationAPI.markAsRead(Array.from(selected));
      clearSelection();
      await load();
    } catch (e) {
      setError(e?.message || "No se pudo marcar como leídas");
    } finally {
      setLoading(false);
    }
  };

  const markAllRead = async () => {
    try {
      setLoading(true);
      setError("");
      await notificationAPI.markAllAsRead();
    } catch (e) {
      setError(e?.message || "No se pudo marcar todo como leído");
    } finally {
      clearSelection();
      await load();
      setLoading(false);
    }
  };

  const deleteRead = async () => {
    try {
      setLoading(true);
      setError("");
      await notificationAPI.deleteReadNotifications();
      setPage(1);
    } catch (e) {
      setError(e?.message || "No se pudieron eliminar las notificaciones leídas");
    } finally {
      clearSelection();
      await load();
      setLoading(false);
      setConfirmDeleteOpen(false);
    }
  };

  const deleteOne = async (id) => {
    try {
      setLoading(true);
      setError("");
      await notificationAPI.deleteNotification(id);
    } catch (e) {
      setError(e?.message || "No se pudo eliminar la notificación");
    } finally {
      await load();
      setLoading(false);
    }
  };

  // -------------------- búsqueda local (rápida) --------------------
  const filtered = useMemo(() => {
    if (!q) return list;
    const s = q.toLowerCase();
    return list.filter(n =>
      String(n.title||"").toLowerCase().includes(s) ||
      String(n.message||"").toLowerCase().includes(s) ||
      String(n.notification_type_display || n.notification_type || "").toLowerCase().includes(s)
    );
  }, [list, q]);

  // -------------------- render --------------------
  return (
    <div className={`bg-white rounded-lg shadow ${compact ? "p-0" : "p-0"}`} style={{ overflow: "hidden" }}>
      {/* Header sticky */}
      <div ref={headerRef} className={`sticky top-0 z-10 bg-white ${shadow ? "shadow-sm" : ""} border-b`}>
        <div className="px-4 py-3 flex items-center gap-3">
          <Shield className="h-5 w-5 text-gray-700" />
          <h2 className="text-lg font-semibold">Centro de Notificaciones (Admin)</h2>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={markSelectedRead}
              disabled={!selected.size || loading}
              className="px-3 py-1.5 text-sm rounded-md border hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1"
              title="Marcar seleccionadas"
            >
              <CheckCheck className="h-4 w-4" /> Seleccionadas
            </button>
            <button
              onClick={markAllRead}
              disabled={loading}
              className="px-3 py-1.5 text-sm rounded-md border hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1"
              title="Marcar todas"
            >
              <CheckCheck className="h-4 w-4" /> Todas
            </button>
            <button
              onClick={() => setConfirmDeleteOpen(true)}
              disabled={loading}
              className="px-3 py-1.5 text-sm rounded-md border text-red-600 hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1"
              title="Eliminar leídas"
            >
              <Trash2 className="h-4 w-4" /> Eliminar leídas
            </button>
            <button
              onClick={refresh}
              disabled={loading}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-md border hover:bg-gray-50 disabled:opacity-50"
              title="Refrescar"
            >
              <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              {loading ? "Cargando..." : "Refrescar"}
            </button>
          </div>
        </div>

        {/* Errores (header) */}
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
            {/* Buscar */}
            <div className="md:col-span-5">
              <label className="text-xs text-gray-600 mb-1 block">Buscar</label>
              <div className="relative">
                <Search className="h-4 w-4 text-gray-400 absolute left-2 top-2.5" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Título, mensaje, tipo..."
                  className="w-full pl-8 pr-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                />
              </div>
            </div>

            {/* Prioridad */}
            <div className="md:col-span-4">
              <label className="text-xs text-gray-600 mb-1 block">Prioridad</label>
              <div className="relative">
                <ChevronDown className="h-4 w-4 text-gray-400 absolute right-2 top-2.5 pointer-events-none" />
                <select
                  value={priority}
                  onChange={(e) => { setPriority(e.target.value); setPage(1); }}
                  className="w-full appearance-none pr-8 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                >
                  {PRIORITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>

            {/* Solo no leídas */}
            <div className="md:col-span-3 flex items-end">
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={unreadOnly}
                  onChange={() => { setUnreadOnly(v => !v); setPage(1); }}
                  className="h-4 w-4 text-blue-600 rounded"
                />
                Solo no leídas
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Encabezado tabla compacto */}
      <div className="bg-gray-50 px-3 py-2 flex items-center justify-between text-xs text-gray-600">
        <div className="flex items-center gap-2">
          <button
            onClick={selectAll}
            className="px-2 py-1 border rounded hover:bg-white transition-colors disabled:opacity-50"
            disabled={!filtered.length || loading}
          >
            Seleccionar todo
          </button>
          <button
            onClick={clearSelection}
            className="px-2 py-1 border rounded hover:bg-white transition-colors disabled:opacity-50"
            disabled={!selected.size || loading}
          >
            Limpiar selección
          </button>
          <span className="ml-2">Seleccionadas: <b>{selected.size}</b></span>
        </div>
        <div className="flex items-center gap-2">
          <span>Página {page}</span>
          <span>•</span>
          <span>Total páginas: {totalPages}</span>
          <span>•</span>
          <span>Mostrando {filtered.length} en esta página</span>
        </div>
      </div>

      {/* Lista */}
      <div className="divide-y">
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
            <p className="text-sm">{q ? "Sin resultados para la búsqueda" : "Nada por aquí"}</p>
          </div>
        ) : (
          filtered.map(n => (
            <article
              key={n.id}
              className={`p-3 hover:bg-gray-50 transition-colors border-l-4 ${rowPriorityClass(n.priority, n.is_read)}`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={selected.has(n.id)}
                  onChange={() => toggleSelect(n.id)}
                  className="mt-1 h-4 w-4 text-blue-600 rounded"
                  disabled={loading}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start space-x-2">
                    <span className="text-lg flex-shrink-0">{typeEmoji(n.notification_type)}</span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className={`text-sm font-medium truncate ${!n.is_read ? "text-gray-900" : "text-gray-600"}`}>
                          {n.title}
                        </p>
                        {!n.is_read && <div className="w-2 h-2 bg-blue-600 rounded-full ml-2 flex-shrink-0" />}
                      </div>
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{n.message}</p>
                      <div className="flex items-center gap-2 mt-2 text-[11px] text-gray-500">
                        <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-700">{typeLabel(n.notification_type)}</span>
                        {n.roulette_id && (
                          <span className="px-1.5 py-0.5 rounded bg-violet-100 text-violet-800">Ruleta #{n.roulette_id}</span>
                        )}
                        <span className="ml-auto">
                          {n.time_since_created || (n.created_at ? new Date(n.created_at).toLocaleString() : "")}
                        </span>
                      </div>

                      {/* Acciones del item */}
                      <div className="flex items-center justify-end gap-1 mt-2">
                        {!n.is_read && (
                          <button
                            onClick={async () => {
                              try {
                                await notificationAPI.markAsRead([n.id]);
                                await load();
                              } catch (e) {
                                setError(e?.message || "No se pudo marcar como leída");
                              }
                            }}
                            className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded"
                            title="Marcar como leída"
                            disabled={loading}
                          >
                            <Check className="h-3 w-3" />
                          </button>
                        )}
                        <button
                          onClick={() => deleteOne(n.id)}
                          className="p-1 text-red-600 hover:text-red-800 hover:bg-red-100 rounded"
                          title="Eliminar"
                          disabled={loading}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Extra data plegable (opcional) */}
                  {n.extra_data && Object.keys(n.extra_data).length > 0 && (
                    <details className="mt-2">
                      <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
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
      </div>

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
            {[10, 15, 20, 25, 50].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <span className="text-gray-500">•</span>
          <span className="text-gray-600">
            Página {page} de {totalPages}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            disabled={page <= 1 || loading}
            onClick={() => setPage(p => Math.max(1, p - 1))}
            className="px-3 py-1.5 text-sm border rounded disabled:opacity-50 hover:bg-white"
          >
            Anterior
          </button>
          <span className="px-2 text-sm text-gray-600">{page} / {totalPages}</span>
          <button
            disabled={page >= totalPages || loading}
            onClick={() => setPage(p => p + 1)}
            className="px-3 py-1.5 text-sm border rounded disabled:opacity-50 hover:bg-white"
          >
            Siguiente
          </button>
        </div>
      </div>

      {/* Barra flotante selección */}
      {selected.size > 0 && (
        <div className="sticky bottom-3 left-0 right-0 z-20 mx-auto max-w-5xl">
          <div className="bg-white/90 backdrop-blur rounded-xl shadow border px-3 py-2 flex items-center gap-2">
            <span className="text-sm">Seleccionadas: <b>{selected.size}</b></span>
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={markSelectedRead}
                disabled={loading}
                className="px-3 py-1.5 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
              >
                <CheckCheck className="h-4 w-4" /> Marcar leídas
              </button>
              <button
                onClick={clearSelection}
                disabled={loading}
                className="px-3 py-1.5 text-sm rounded-md border hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1"
              >
                <X className="h-4 w-4" /> Limpiar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirm delete leídas */}
      {confirmDeleteOpen && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => !loading && setConfirmDeleteOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-lg border max-w-md w-full p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">Eliminar notificaciones leídas</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    ¿Seguro que deseas eliminar <b>todas</b> las notificaciones marcadas como leídas? Esta acción no se puede deshacer.
                  </p>
                </div>
                <button
                  onClick={() => !loading && setConfirmDeleteOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                  aria-label="Cerrar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <button
                  onClick={() => setConfirmDeleteOpen(false)}
                  disabled={loading}
                  className="px-3 py-1.5 text-sm rounded-md border hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={deleteRead}
                  disabled={loading}
                  className="px-3 py-1.5 text-sm rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 flex items-center gap-1"
                >
                  <Trash2 className="h-4 w-4" /> Eliminar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminNotificationCenter;
