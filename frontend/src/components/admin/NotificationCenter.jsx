// src/components/admin/NotificationCenter.jsx
import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  RefreshCcw, Trash2, CheckCheck, AlertTriangle, Inbox, Search,
  ChevronDown, Check, X, Bell
} from "lucide-react";
import { notificationAPI } from "../../config/api";

const PRIORITY_OPTIONS = [
  { value: "", label: "Todas" },
  { value: "urgent", label: "🔴 Urgente" },
  { value: "high", label: "🟠 Alta" },
  { value: "normal", label: "🔵 Normal" },
  { value: "low", label: "⚪ Baja" },
];

const rowPriorityClass = (p, isRead) => {
  if (isRead) return "border-l-gray-300 bg-white opacity-75";
  switch (p) {
    case "urgent": return "border-l-red-500 bg-red-50";
    case "high": return "border-l-orange-500 bg-orange-50";
    case "normal": return "border-l-blue-500 bg-blue-50";
    case "low": return "border-l-green-500 bg-green-50";
    default: return "border-l-gray-400 bg-gray-50";
  }
};

const typeLabel = (t) => {
  const map = {
    admin_winner_alert: "Alerta Ganador",
    winner_notification: "Notificación Victoria",
    roulette_winner: "Anuncio Ganador",
    roulette_started: "Sorteo Iniciado",
    roulette_ending_soon: "Termina Pronto",
    roulette_created: "Ruleta Creada",
    participation_confirmed: "Participación Confirmada",
    welcome_message: "Bienvenida",
  };
  return map[t] || t || "Notificación";
};

const typeEmoji = (t) => {
  const map = {
    admin_winner_alert: "👑",
    winner_notification: "🏆",
    roulette_winner: "🎉",
    roulette_started: "🎯",
    roulette_ending_soon: "⏰",
    roulette_created: "✨",
    participation_confirmed: "✅",
    welcome_message: "👋",
  };
  return map[t] || "📢";
};

const AdminNotificationCenter = ({
  onUnreadChange,
  defaultPageSize = 15,
  defaultPriority = "",
  compact = false,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [list, setList] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [priority, setPriority] = useState(defaultPriority);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [stats, setStats] = useState(null);

  const headerRef = useRef(null);
  const [shadow, setShadow] = useState(false);

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const onScroll = () => setShadow((el.parentElement?.scrollTop || 0) > 0);
    el.parentElement?.addEventListener("scroll", onScroll);
    return () => el.parentElement?.removeEventListener("scroll", onScroll);
  }, []);

  // ⚠️ CORRECCIÓN PRINCIPAL: Usar getUserNotifications en lugar de getAdminNotifications
  // Los admins ven TODAS sus notificaciones (incluye admin-only automáticamente)
  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      console.log("📡 Cargando notificaciones admin...");

      const params = {
        page,
        page_size: pageSize,
        include_stats: true, // Para obtener contador de no leídas
      };

      if (priority) params.priority = priority;
      if (unreadOnly) params.unread_only = true;

      console.log("📤 Params:", params);

      // ✅ USAR getUserNotifications - los admins ven automáticamente:
      // - Sus notificaciones privadas
      // - Sus notificaciones admin-only
      // - Notificaciones públicas (EXCEPTO roulette_winner para evitar spoilers)
      const res = await notificationAPI.getUserNotifications(params);
      
      console.log("📥 Respuesta completa:", res);

      let items = [];
      if (Array.isArray(res?.results)) {
        items = res.results;
      } else if (Array.isArray(res)) {
        items = res;
      }

      console.log("✅ Notificaciones cargadas:", items.length);

      setList(items);

      // Paginación
      const count = res?.count || items.length;
      setTotalCount(count);
      const pages = count > 0 ? Math.ceil(count / pageSize) : 1;
      setTotalPages(pages);

      // Stats
      if (res?.stats) {
        setStats(res.stats);
        // Notificar al padre si hay callback
        if (onUnreadChange && typeof onUnreadChange === 'function') {
          onUnreadChange(res.stats.unread_count || 0);
        }
      }

    } catch (e) {
      console.error("❌ Error cargando notificaciones admin:", e);
      setError(e?.message || "Error al cargar notificaciones");
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, priority, unreadOnly, onUnreadChange]);

  useEffect(() => {
    load();
  }, [load]);

  // Polling cada 30s
  useEffect(() => {
    const interval = setInterval(() => {
      load();
    }, 30000);
    return () => clearInterval(interval);
  }, [load]);

  const refresh = () => {
    setError("");
    load();
  };

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelected(new Set());
  const selectAll = () => setSelected(new Set(list.map(n => n.id)));

  const markSelectedRead = async () => {
    if (!selected.size) return;
    try {
      setLoading(true);
      await notificationAPI.markAsRead(Array.from(selected));
      clearSelection();
      await load();
    } catch (e) {
      setError(e?.message || "Error al marcar como leídas");
    } finally {
      setLoading(false);
    }
  };

  const markAllRead = async () => {
    try {
      setLoading(true);
      await notificationAPI.markAllAsRead();
      clearSelection();
      await load();
    } catch (e) {
      setError(e?.message || "Error al marcar todas como leídas");
    } finally {
      setLoading(false);
    }
  };

  const deleteRead = async () => {
    try {
      setLoading(true);
      await notificationAPI.deleteReadNotifications();
      setPage(1);
      await load();
      setConfirmDeleteOpen(false);
    } catch (e) {
      setError(e?.message || "Error al eliminar notificaciones");
    } finally {
      clearSelection();
      setLoading(false);
    }
  };

  const deleteOne = async (id) => {
    try {
      setLoading(true);
      await notificationAPI.deleteNotification(id);
      await load();
    } catch (e) {
      setError(e?.message || "Error al eliminar notificación");
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    if (!q) return list;
    const search = q.toLowerCase();
    return list.filter(n =>
      String(n.title || "").toLowerCase().includes(search) ||
      String(n.message || "").toLowerCase().includes(search) ||
      String(n.notification_type_display || n.notification_type || "").toLowerCase().includes(search)
    );
  }, [list, q]);

  return (
    <div className="bg-white rounded-lg shadow-sm border" style={{ minHeight: "500px" }}>
      {/* Header */}
      <div
        ref={headerRef}
        className={`sticky top-0 z-10 bg-white border-b transition-shadow ${
          shadow ? "shadow-md" : ""
        }`}
      >
        <div className="px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <Bell className="h-6 w-6 text-indigo-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  Centro de Notificaciones
                </h2>
                {stats && (
                  <p className="text-sm text-gray-500 mt-0.5">
                    {stats.unread_count || 0} sin leer de {totalCount} totales
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={markSelectedRead}
                disabled={!selected.size || loading}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
              >
                <CheckCheck className="h-4 w-4" />
                Marcar seleccionadas
              </button>

              <button
                onClick={markAllRead}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
              >
                <CheckCheck className="h-4 w-4" />
                Marcar todas
              </button>

              <button
                onClick={() => setConfirmDeleteOpen(true)}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
                Eliminar leídas
              </button>

              <button
                onClick={refresh}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
              >
                <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                {loading ? "Cargando..." : "Refrescar"}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-900">Error</p>
                <p className="text-sm text-red-700 mt-0.5">{error}</p>
              </div>
              <button
                onClick={() => setError("")}
                className="text-red-400 hover:text-red-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          )}

          {/* Filtros */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-5">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Buscar
              </label>
              <div className="relative">
                <Search className="h-5 w-5 text-gray-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar en título, mensaje o tipo..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors"
                />
              </div>
            </div>

            <div className="md:col-span-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Prioridad
              </label>
              <div className="relative">
                <select
                  value={priority}
                  onChange={(e) => {
                    setPriority(e.target.value);
                    setPage(1);
                  }}
                  className="w-full appearance-none px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors"
                >
                  {PRIORITY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="h-5 w-5 text-gray-400 absolute right-3 top-2.5 pointer-events-none" />
              </div>
            </div>

            <div className="md:col-span-3 flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={unreadOnly}
                  onChange={() => {
                    setUnreadOnly((v) => !v);
                    setPage(1);
                  }}
                  className="h-4 w-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                />
                <span className="text-sm font-medium text-gray-700">
                  Solo no leídas
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Barra de selección */}
        <div className="bg-gray-50 px-6 py-3 flex items-center justify-between border-t">
          <div className="flex items-center gap-3">
            <button
              onClick={selectAll}
              disabled={!filtered.length || loading}
              className="text-sm text-indigo-600 hover:text-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              Seleccionar todo
            </button>
            <button
              onClick={clearSelection}
              disabled={!selected.size || loading}
              className="text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              Limpiar selección
            </button>
            <span className="text-sm text-gray-600">
              Seleccionadas: <span className="font-semibold">{selected.size}</span>
            </span>
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span>Página {page}</span>
            <span>•</span>
            <span>Total: {totalPages}</span>
            <span>•</span>
            <span>Mostrando: {filtered.length}</span>
          </div>
        </div>
      </div>

      {/* Lista de notificaciones */}
      <div className="divide-y divide-gray-200">
        {loading && list.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <RefreshCcw className="h-8 w-8 text-gray-400 animate-spin mb-4" />
            <p className="text-gray-600 font-medium">Cargando notificaciones...</p>
          </div>
        ) : error && filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <AlertTriangle className="h-12 w-12 text-red-400 mb-4" />
            <p className="text-red-600 font-medium mb-2">Error al cargar</p>
            <p className="text-sm text-gray-600">{error}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Inbox className="h-16 w-16 text-gray-300 mb-4" />
            <p className="text-lg font-medium text-gray-900 mb-1">
              No hay notificaciones
            </p>
            <p className="text-sm text-gray-500">
              {q ? "Sin resultados para la búsqueda" : "No tienes notificaciones pendientes"}
            </p>
          </div>
        ) : (
          filtered.map((n) => (
            <article
              key={n.id}
              className={`p-4 hover:bg-gray-50 transition-colors border-l-4 ${rowPriorityClass(
                n.priority,
                n.is_read
              )}`}
            >
              <div className="flex items-start gap-4">
                <input
                  type="checkbox"
                  checked={selected.has(n.id)}
                  onChange={() => toggleSelect(n.id)}
                  disabled={loading}
                  className="mt-1 h-4 w-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl flex-shrink-0">
                      {typeEmoji(n.notification_type)}
                    </span>

                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <h3
                          className={`text-base font-semibold ${
                            n.is_read ? "text-gray-600" : "text-gray-900"
                          }`}
                        >
                          {n.title}
                        </h3>
                        {!n.is_read && (
                          <div className="w-2.5 h-2.5 bg-indigo-600 rounded-full ml-3 flex-shrink-0" />
                        )}
                      </div>

                      <p className="text-sm text-gray-700 mb-3 line-clamp-2">
                        {n.message}
                      </p>

                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-800">
                          {typeLabel(n.notification_type)}
                        </span>

                        {n.roulette_id && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-purple-100 text-purple-800">
                            Ruleta #{n.roulette_id}
                          </span>
                        )}

                        <span className="text-xs text-gray-500">
                          {n.time_since_created ||
                            (n.created_at
                              ? new Date(n.created_at).toLocaleString("es-ES", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "")}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {!n.is_read && (
                          <button
                            onClick={async () => {
                              try {
                                await notificationAPI.markAsRead([n.id]);
                                await load();
                              } catch (e) {
                                setError(e?.message || "Error al marcar como leída");
                              }
                            }}
                            disabled={loading}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors disabled:opacity-50"
                          >
                            <Check className="h-3.5 w-3.5" />
                            Marcar leída
                          </button>
                        )}

                        <button
                          onClick={() => deleteOne(n.id)}
                          disabled={loading}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-md transition-colors disabled:opacity-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Eliminar
                        </button>
                      </div>

                      {/* Extra data expandible */}
                      {n.extra_data && Object.keys(n.extra_data).length > 0 && (
                        <details className="mt-3">
                          <summary className="text-xs text-gray-600 cursor-pointer hover:text-gray-900 font-medium">
                            Ver datos adicionales
                          </summary>
                          <div className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded-md">
                            <pre className="text-xs text-gray-700 overflow-auto whitespace-pre-wrap">
                              {JSON.stringify(n.extra_data, null, 2)}
                            </pre>
                          </div>
                        </details>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </article>
          ))
        )}
      </div>

      {/* Footer paginación */}
      <div className="bg-gray-50 px-6 py-4 border-t">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-700">Filas por página:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              disabled={loading}
              className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            >
              {[10, 15, 20, 25, 50].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <span className="text-sm text-gray-600">
              Página {page} de {totalPages}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Anterior
            </button>
            <span className="px-3 py-2 text-sm text-gray-700">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= totalPages || loading}
              className="px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Siguiente
            </button>
          </div>
        </div>
      </div>

      {/* Barra flotante selección */}
      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 px-6 py-4 flex items-center gap-4">
            <span className="text-sm font-medium text-gray-700">
              Seleccionadas: <span className="font-bold text-indigo-600">{selected.size}</span>
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={markSelectedRead}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
              >
                <CheckCheck className="h-4 w-4" />
                Marcar leídas
              </button>
              <button
                onClick={clearSelection}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2 transition-colors"
              >
                <X className="h-4 w-4" />
                Limpiar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmar delete */}
      {confirmDeleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => !loading && setConfirmDeleteOpen(false)}
          />
          <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Eliminar notificaciones leídas
                </h3>
                <p className="text-sm text-gray-600">
                  ¿Estás seguro de que deseas eliminar <strong>todas</strong> las
                  notificaciones marcadas como leídas? Esta acción no se puede deshacer.
                </p>
              </div>
              <button
                onClick={() => !loading && setConfirmDeleteOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setConfirmDeleteOpen(false)}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={deleteRead}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminNotificationCenter;