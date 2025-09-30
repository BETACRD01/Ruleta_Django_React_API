import React, { useEffect, useState, useCallback } from "react";
import {
  RefreshCcw, Search, Mail, Trash2, CheckCircle,
  XCircle, Clock, Trophy, AlertTriangle, Bell
} from "lucide-react";
import { notificationAPI } from "../../config/api";

const AdminNotificationDashboard = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [emailStatus, setEmailStatus] = useState({});
  const [selectedIds, setSelectedIds] = useState(new Set());

  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const response = await notificationAPI.getAdminNotifications({
        page_size: 500,
        ordering: '-created_at'
      });
      setNotifications(response?.results || []);
    } catch (err) {
      setError(err.message || "Error al cargar notificaciones");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 120000);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  // Filtrar notificaciones
  const filteredNotifications = notifications.filter(n => {
    const matchesSearch = !searchTerm || 
      n.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      n.message?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesTab = 
      activeTab === "all" ||
      (activeTab === "winners" && (n.notification_type === "roulette_winner" || n.notification_type === "winner_notification")) ||
      (activeTab === "alerts" && (n.notification_type === "admin_system_alert" || n.priority === "urgent")) ||
      (activeTab === "draws" && (n.notification_type === "roulette_ending_soon" || n.notification_type === "roulette_started"));

    return matchesSearch && matchesTab;
  });

  // Estadísticas
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const stats = {
    total: notifications.length,
    winners: notifications.filter(n => n.notification_type === "roulette_winner" || n.notification_type === "winner_notification").length,
    alerts: notifications.filter(n => n.notification_type === "admin_system_alert" || n.priority === "urgent").length,
    unread: notifications.filter(n => !n.is_read).length,
    today: notifications.filter(n => new Date(n.created_at) >= today).length,
    pending: notifications.filter(n => !n.is_read && n.priority === "urgent").length
  };

  // Enviar email a ganador
  const sendEmail = async (notification) => {
    const winnerData = notification.extra_data || {};
    
    try {
      setEmailStatus(prev => ({ ...prev, [notification.id]: 'sending' }));
      
      const winnerEmail = winnerData.winner_email || '';
      const rouletteName = winnerData.roulette_name || notification.title;
      const prizeDetails = winnerData.prize_details || '';
      
      if (!winnerEmail) {
        throw new Error('No se encontró el email del ganador');
      }

      // Llamar al endpoint del backend
      const response = await notificationAPI.createWinnerAnnouncement({
        winner_user_id: winnerData.winner_user_id,
        roulette_name: rouletteName,
        roulette_id: notification.roulette_id,
        total_participants: winnerData.total_participants || 0,
        prize_details: prizeDetails
      });
      
      // Mostrar info del delay si existe
      if (response?.email_delay_info) {
        const delayInfo = response.email_delay_info;
        console.log(`📧 Email programado con delay de ${delayInfo.delay_minutes} minutos`);
        console.log(`⏰ Se enviará aproximadamente a las: ${new Date(delayInfo.scheduled_for).toLocaleTimeString()}`);
      }
      
      // Actualizar estado en BD
      await notificationAPI.updateEmailStatus(notification.id, {
        status: 'sent',
        recipient_email: winnerEmail
      });
      
      // Recargar notificaciones para ver estado actualizado
      await loadNotifications();
      
      // Limpiar estado local
      setEmailStatus(prev => {
        const newState = { ...prev };
        delete newState[notification.id];
        return newState;
      });
      
    } catch (err) {
      console.error('Error enviando email:', err);
      
      // Actualizar estado de error en BD
      try {
        await notificationAPI.updateEmailStatus(notification.id, {
          status: 'error',
          error_message: err.message || 'Error desconocido',
          recipient_email: winnerData?.winner_email || ''
        });
        await loadNotifications();
      } catch (updateErr) {
        console.error('Error actualizando estado:', updateErr);
      }
      
      setEmailStatus(prev => ({ 
        ...prev, 
        [notification.id]: 'error',
        [`${notification.id}_error`]: err.message || 'Error desconocido'
      }));
    }
  };

  // Eliminar
  const deleteNotification = async (id) => {
    try {
      await notificationAPI.deleteNotification(id);
      setNotifications(prev => prev.filter(n => n.id !== id));
      selectedIds.delete(id);
      setSelectedIds(new Set(selectedIds));
    } catch (err) {
      console.error(err);
    }
  };

  // Eliminar múltiples
  const deleteSelected = async () => {
    if (!window.confirm(`¿Eliminar ${selectedIds.size} notificaciones?`)) return;
    
    const promises = Array.from(selectedIds).map(id => 
      notificationAPI.deleteNotification(id).catch(() => null)
    );
    
    await Promise.all(promises);
    setNotifications(prev => prev.filter(n => !selectedIds.has(n.id)));
    setSelectedIds(new Set());
  };

  // Toggle selección
  const toggleSelect = (id) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  // Icono por tipo
  const getIcon = (type, priority) => {
    if (type === "roulette_winner" || type === "winner_notification") 
      return <Trophy className="h-5 w-5 text-yellow-600" />;
    if (type === "admin_system_alert" || priority === "urgent") 
      return <AlertTriangle className="h-5 w-5 text-red-600" />;
    if (type === "roulette_ending_soon" || type === "roulette_started") 
      return <Clock className="h-5 w-5 text-orange-600" />;
    return <Bell className="h-5 w-5 text-blue-600" />;
  };

  if (loading && notifications.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCcw className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={loadNotifications}
          disabled={loading}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          <RefreshCcw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
          <span>Actualizar</span>
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded mb-6">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-red-600 mr-3 flex-shrink-0" />
            <div>
              <p className="text-red-700 font-medium">Error al cargar notificaciones</p>
              <p className="text-red-600 text-sm mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="border-b border-gray-200">
          <div className="flex space-x-1 p-1">
            {[
              { id: "all", label: "Todas", count: notifications.length },
              { id: "winners", label: "Ganadores", count: stats.winners },
              { id: "alerts", label: "Alertas", count: stats.alerts },
              { id: "draws", label: "Sorteos", count: notifications.filter(n => n.notification_type === "roulette_ending_soon" || n.notification_type === "roulette_started").length }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? "bg-blue-100 text-blue-700"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 flex items-center justify-between space-x-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar notificaciones..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {selectedIds.size > 0 && (
            <button
              onClick={deleteSelected}
              className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              <Trash2 className="h-5 w-5" />
              <span>Eliminar ({selectedIds.size})</span>
            </button>
          )}
        </div>
      </div>

      {/* Lista de notificaciones */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        {filteredNotifications.length === 0 ? (
          <div className="p-12 text-center">
            <Bell className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">No hay notificaciones</p>
            <p className="text-gray-400 text-sm mt-2">
              {searchTerm ? "Intenta con otros términos de búsqueda" : "Las notificaciones aparecerán aquí"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredNotifications.map(notification => {
              // Determinar estado del email desde la BD
              const isWinnerNotif = notification.notification_type === "roulette_winner" || 
                                    notification.notification_type === "winner_notification";
              const isSending = emailStatus[notification.id] === 'sending';
              const hasLocalError = emailStatus[notification.id] === 'error';
              
              return (
                <div
                  key={notification.id}
                  className={`p-4 hover:bg-gray-50 transition-colors ${
                    selectedIds.has(notification.id) ? "bg-blue-50" : ""
                  }`}
                >
                  <div className="flex items-start space-x-4">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(notification.id)}
                      onChange={() => toggleSelect(notification.id)}
                      className="mt-1 h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />

                    <div className="flex-shrink-0 mt-1">
                      {getIcon(notification.notification_type, notification.priority)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="text-base font-semibold text-gray-900">
                            {notification.title}
                          </h3>
                          <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                            {notification.message}
                          </p>
                          <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                            <span>{new Date(notification.created_at).toLocaleString()}</span>
                            {notification.roulette_id && (
                              <span className="bg-gray-100 px-2 py-1 rounded">
                                Ruleta #{notification.roulette_id}
                              </span>
                            )}
                            {notification.priority === "urgent" && (
                              <span className="bg-red-100 text-red-700 px-2 py-1 rounded font-medium">
                                URGENTE
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Acciones - USAR ESTADO DE BD */}
                        <div className="flex items-center space-x-2 ml-4">
                          {isWinnerNotif && (
                            <>
                              {/* ESTADO DESDE LA BASE DE DATOS */}
                              {notification.email_sent ? (
                                <div className="flex flex-col items-end">
                                  <span className="flex items-center text-green-600 text-sm font-medium">
                                    <CheckCircle className="h-4 w-4 mr-1" />
                                    Email enviado
                                  </span>
                                  {notification.email_sent_at && (
                                    <span className="text-xs text-gray-500 mt-0.5">
                                      {new Date(notification.email_sent_at).toLocaleString()}
                                    </span>
                                  )}
                                  {notification.email_recipient && (
                                    <span className="text-xs text-gray-500 mt-0.5">
                                      a {notification.email_recipient}
                                    </span>
                                  )}
                                </div>
                              ) : notification.email_error && !isSending ? (
                                <div className="flex flex-col items-end">
                                  <span className="flex items-center text-orange-600 text-sm font-medium">
                                    <Clock className="h-4 w-4 mr-1" />
                                    Programado
                                  </span>
                                  <span className="text-xs text-gray-500 mt-0.5 max-w-xs">
                                    {notification.email_error}
                                  </span>
                                  {notification.email_recipient && (
                                    <span className="text-xs text-gray-500 mt-0.5">
                                      para {notification.email_recipient}
                                    </span>
                                  )}
                                </div>
                              ) : hasLocalError ? (
                                <div className="flex flex-col items-end">
                                  <span className="flex items-center text-red-600 text-sm font-medium">
                                    <XCircle className="h-4 w-4 mr-1" />
                                    Error
                                  </span>
                                  <span className="text-xs text-red-500 mt-0.5 max-w-xs truncate">
                                    {emailStatus[`${notification.id}_error`]}
                                  </span>
                                  <button
                                    onClick={() => sendEmail(notification)}
                                    className="text-xs text-blue-600 hover:text-blue-700 mt-1"
                                  >
                                    Reintentar
                                  </button>
                                </div>
                              ) : isSending ? (
                                <span className="flex items-center text-blue-600 text-sm">
                                  <RefreshCcw className="h-4 w-4 mr-1 animate-spin" />
                                  Enviando...
                                </span>
                              ) : (
                                <button
                                  onClick={() => sendEmail(notification)}
                                  className="flex items-center space-x-1 px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
                                >
                                  <Mail className="h-4 w-4" />
                                  <span>Notificar por email</span>
                                </button>
                              )}
                            </>
                          )}
                          
                          <button
                            onClick={() => deleteNotification(notification.id)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Eliminar notificación"
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminNotificationDashboard;