// src/components/admin/NotificationCenter.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  RefreshCcw, Trash2, CheckCheck, Check, Filter, Inbox, Search,
  Trophy, Clock, X
} from "lucide-react";
import { notificationAPI, notificationManager } from "../../config/api";

/**
 * Centro de Notificaciones (Admin)
 * - Lista notificaciones admin-only del usuario staff autenticado.
 * - Filtros: prioridad, solo no leídas.
 * - Búsqueda local.
 * - Acciones: marcar selección como leída, marcar todas, eliminar TODAS las leídas (con modal propio).
 *
 * No inicia polling (lo hace App/Layout). Solo se suscribe al manager.
 * Endpoints: /api/notifications/admin/, mark-read, mark-all-read, delete-read
 */

const PAGE_SIZE = 20;

const priorityLabel = (p) => ({
  urgent: "Urgente",
  high: "Alta",
  normal: "Normal",
  low: "Baja",
}[p] || "—");

const priorityBadgeClass = (p) => ({
  urgent: "bg-red-100 text-red-800 ring-1 ring-red-200",
  high: "bg-orange-100 text-orange-800 ring-1 ring-orange-200",
  normal: "bg-blue-100 text-blue-800 ring-1 ring-blue-200",
  low: "bg-gray-100 text-gray-700 ring-1 ring-gray-200",
}[p] || "bg-slate-100 text-slate-700 ring-1 ring-slate-200");

const typeLabel = (t) => ({
  participation_confirmed: "Participación",
  roulette_winner: "Ganador",
  roulette_started: "Sorteo iniciado",
  roulette_ending_soon: "Termina pronto",
  winner_notification: "Victoria",
  admin_winner_alert: "Ganador (Admin)",
  welcome_message: "Bienvenida",
}[t] || t);

const fmtWhen = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now - d;
  const m = Math.floor(diffMs / 60000);
  const h = Math.floor(m / 60);
  const days = Math.floor(h / 24);
  if (m < 1) return "Ahora";
  if (m < 60) return `Hace ${m}m`;
  if (h < 24) return `Hace ${h}h`;
  if (days < 7) return `Hace ${days}d`;
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
};

export default function NotificationCenter({ onUnreadChange, defaultPageSize = PAGE_SIZE }) {
  // Estado base
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");

  // Paginación / filtros
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [priority, setPriority] = useState("");
  const [q, setQ] = useState("");

  // Selección
  const [selected, setSelected] = useState(new Set());

  // Modal de confirmación (para eliminar leídas)
  const [confirmOpen, setConfirmOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const query = {
        page,
        page_size: defaultPageSize,
        unread_only: unreadOnly || undefined,
        priority: priority || undefined,
      };

      // GET /api/notifications/admin/ (staff del usuario actual) – backend define esto. :contentReference[oaicite:6]{index=6}
      const res = await notificationAPI.getAdminNotifications(query);

      const list = Array.isArray(res?.results)
        ? res.results
        : Array.isArray(res) ? res : [];

      setItems(list);

      // Calcular páginas
      const total = res?.count
        ? Math.max(1, Math.ceil(res.count / (defaultPageSize || PAGE_SIZE)))
        : (res?.next || res?.previous) ? page + 1 : page;
      setPages(total);

      // Badge de no leídas (opcional)
      const unreadCountLocal = list.filter(n => !n.is_read).length;
      if (typeof onUnreadChange === "function") onUnreadChange(unreadCountLocal);
    } catch (e) {
      console.error(e);
      setError(e?.message || "Error cargando notificaciones");
    } finally {
      setLoading(false);
    }
  }, [page, defaultPageSize, unreadOnly, priority, onUnreadChange]);

  useEffect(() => {
    load();
  }, [load]);

  // Tiempo real: solo escuchar (nada de startPolling aquí)
  useEffect(() => {
    if (!notificationManager?.addListener) return;
    const off = notificationManager.addListener("notifications_updated", () => load());
    return () => { if (typeof off === "function") off(); };
  }, [load]);

  // Búsqueda local
  const filtered = useMemo(() => {
    if (!q) return items;
    const needle = q.toLowerCase();
    return items.filter((n) =>
      String(n.title || "").toLowerCase().includes(needle) ||
      String(n.message || "").toLowerCase().includes(needle) ||
      String(typeLabel(n.notification_type)).toLowerCase().includes(needle)
    );
  }, [items, q]);

  // Acciones
  const toggleSelect = (id) => {
    setSelected(prev => {
      const nx = new Set(prev);
      nx.has(id) ? nx.delete(id) : nx.add(id);
      return nx;
    });
  };
  const clearSelection = () => setSelected(new Set());
  const selectAll = () => setSelected(new Set(filtered.map(n => n.id)));

  const markSelectedRead = async () => {
    if (!selected.size) return;
    try {
      setLoading(true);
      setError("");
      await notificationAPI.markAsRead(Array.from(selected)); // POST /mark-read/ :contentReference[oaicite:7]{index=7}
      clearSelection();
      await load();
    } catch (e) {
      console.error(e);
      setError(e?.message || "No se pudo marcar como leídas");
    } finally {
      setLoading(false);
    }
  };

  const markAllRead = async () => {
    try {
      setLoading(true);
      setError("");
      await notificationAPI.markAllAsRead(); // POST /mark-all-read/ :contentReference[oaicite:8]{index=8}
      clearSelection();
      await load();
    } catch (e) {
      console.error(e);
      setError(e?.message || "No se pudo marcar todo como leído");
    } finally {
      setLoading(false);
    }
  };

  const deleteRead = async () => {
    try {
      setLoading(true);
      setError("");
      await notificationAPI.deleteReadNotifications(); // DELETE /delete-read/ :contentReference[oaicite:9]{index=9}
      clearSelection();
      setPage(1);
      await load();
    } catch (e) {
      console.error(e);
      setError(e?.message || "No se pudieron eliminar las leídas");
    } finally {
      setLoading(false);
      setConfirmOpen(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      {/* Header / filtros */}
      <div className="p-4 border-b border-gray-200 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-gray-900">Notificaciones (Admin)</h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
            {filtered.filter(n => !n.is_read).length} sin leer
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por título/mensaje/tipo"
              className="pl-9 pr-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <select
              value={priority}
              onChange={(e) => { setPage(1); setPriority(e.target.value); }}
              className="text-sm border border-gray-300 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todas las prioridades</option>
              <option value="urgent">Urgente</option>
              <option value="high">Alta</option>
              <option value="normal">Normal</option>
              <option value="low">Baja</option>
            </select>
          </div>

          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={(e) => { setPage(1); setUnreadOnly(e.target.checked); }}
              className="w-4 h-4"
            />
            Solo no leídas
          </label>

          <button
            onClick={markSelectedRead}
            disabled={!selected.size || loading}
            className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
            title="Marcar selección como leída"
          >
            <Check className="h-4 w-4" /> Marcar leídas
          </button>

          <button
            onClick={markAllRead}
            disabled={loading}
            className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
            title="Marcar todas como leídas"
          >
            <CheckCheck className="h-4 w-4" /> Marcar todas
          </button>

          <button
            onClick={() => setConfirmOpen(true)}
            disabled={loading}
            className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 text-red-700"
            title="Eliminar todas las leídas"
          >
            <Trash2 className="h-4 w-4" /> Eliminar leídas
          </button>

          <button
            onClick={() => load()}
            disabled={loading}
            className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
            title="Refrescar"
          >
            <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refrescar
          </button>
        </div>
      </div>

      {/* Lista */}
      <div className="divide-y divide-gray-100">
        {loading ? (
          <div className="p-8 text-center text-gray-500">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2" />
            Cargando notificaciones…
          </div>
        ) : error ? (
          <div className="p-6 text-center text-red-600">
            {error}
            <div className="mt-2">
              <button onClick={() => load()} className="text-sm text-blue-600 hover:text-blue-800">
                Reintentar
              </button>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-gray-500">
            <Inbox className="mx-auto h-8 w-8 text-gray-300 mb-2" />
            No hay notificaciones para mostrar
          </div>
        ) : (
          filtered.map((n) => (
            <Row
              key={n.id}
              n={n}
              checked={selected.has(n.id)}
              onToggle={() => toggleSelect(n.id)}
              onMarkRead={async () => {
                try {
                  await notificationAPI.markAsRead([n.id]);
                  await load();
                } catch (e) {
                  console.error(e);
                }
              }}
            />
          ))
        )}
      </div>

      {/* Paginación */}
      <div className="p-3 border-t border-gray-200 flex items-center justify-between text-sm bg-gray-50">
        <div className="text-gray-500">Página {page} de {pages}</div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || loading}
            className="px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-100 disabled:opacity-50"
          >
            Anterior
          </button>
          <button
            onClick={() => setPage((p) => Math.min(pages, p + 1))}
            disabled={page >= pages || loading}
            className="px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-100 disabled:opacity-50"
          >
            Siguiente
          </button>
        </div>
      </div>

      {/* Modal simple de confirmación (sin globals) */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setConfirmOpen(false)} />
          <div className="relative bg-white rounded-xl shadow-xl p-5 w-full max-w-sm z-10">
            <div className="flex items-start gap-3">
              <div className="shrink-0 mt-0.5">
                <Trash2 className="h-5 w-5 text-red-600" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-gray-900">
                  Eliminar todas las notificaciones leídas
                </h4>
                <p className="text-sm text-gray-600 mt-1">
                  Esta acción no se puede deshacer. ¿Deseas continuar?
                </p>
              </div>
              <button
                className="p-1 rounded hover:bg-gray-100"
                onClick={() => setConfirmOpen(false)}
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setConfirmOpen(false)}
                className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={deleteRead}
                className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm hover:bg-red-700"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ n, checked, onToggle, onMarkRead }) {
  const showWinner = ["roulette_winner", "admin_winner_alert", "winner_notification"].includes(n.notification_type);
  const winnerName = n?.extra_data?.winner_name;
  const endsSoon = n.notification_type === "roulette_ending_soon";
  const endsAt = n?.extra_data?.ends_at || n?.extra_data?.deadline;

  return (
    <div className={`p-4 ${!n.is_read ? "bg-blue-50/30" : "bg-white"}`}>
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          className="mt-1.5"
          aria-label="Seleccionar notificación"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {!n.is_read && <span className="w-2 h-2 rounded-full bg-blue-600" />}
            <span className={`text-xs px-2 py-0.5 rounded ${priorityBadgeClass(n.priority)}`}>
              {priorityLabel(n.priority)}
            </span>
            <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700 ring-1 ring-slate-200">
              {typeLabel(n.notification_type)}
            </span>
            {showWinner && (
              <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200">
                <Trophy className="h-3 w-3" />
                {winnerName ? `Ganador: ${winnerName}` : "Ganador seleccionado"}
              </span>
            )}
            {endsSoon && (
              <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-800 ring-1 ring-yellow-200">
                <Clock className="h-3 w-3" />
                {endsAt ? `Fin: ${new Date(endsAt).toLocaleString()}` : "Próximo a terminar"}
              </span>
            )}
          </div>

          <div className="mt-1 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className={`text-sm font-medium truncate ${!n.is_read ? "text-gray-900" : "text-gray-700"}`}>
                {n.title}
              </p>
              <p className="text-xs text-gray-500 mt-1 line-clamp-2">{n.message}</p>
            </div>
            <div className="shrink-0 text-xs text-gray-400">{fmtWhen(n.created_at)}</div>
          </div>
        </div>

        {!n.is_read && (
          <button
            onClick={onMarkRead}
            className="ml-2 px-2 py-1 text-xs rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50"
            title="Marcar como leída"
          >
            <Check className="h-3 w-3 inline mr-1" />
            Leída
          </button>
        )}
      </div>
    </div>
  );
}
