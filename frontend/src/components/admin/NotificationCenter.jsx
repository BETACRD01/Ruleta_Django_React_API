import React, { useEffect, useState, useCallback } from "react";
import {
  RefreshCcw, Mail, Trophy, AlertTriangle, Clock, CheckCircle, XCircle, 
  Calendar, Hash, AlertCircle, Info, Target, Trash2, BarChart3,
  Users, Activity, TrendingUp, MessageSquare, Eye, EyeOff
} from "lucide-react";
import { notificationAPI } from "../../config/api";

const AdminNotificationPanel = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [emailStatus, setEmailStatus] = useState({}); // Estado de emails enviados
  const [expandedNotifications, setExpandedNotifications] = useState(new Set());
  const [deletingNotifications, setDeletingNotifications] = useState(new Set());

  // Cargar notificaciones administrativas
  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      
      const response = await notificationAPI.getAdminNotifications({
        page_size: 200,
        ordering: '-created_at'
      });
      
      setNotifications(response?.results || []);
    } catch (err) {
      setError("Error al cargar el panel administrativo");
      console.error("Error loading notifications:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
    // Actualizar cada 2 minutos (menos frecuente)
    const interval = setInterval(loadNotifications, 120000);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  // Enviar correo a ganador
  const sendWinnerEmail = async (notification) => {
    try {
      setEmailStatus(prev => ({ ...prev, [notification.id]: 'sending' }));
      
      await notificationAPI.createWinnerAnnouncement({
        notification_id: notification.id,
        roulette_id: notification.roulette_id,
        send_email: true
      });
      
      setEmailStatus(prev => ({ ...prev, [notification.id]: 'sent' }));
      
    } catch (err) {
      setEmailStatus(prev => ({ ...prev, [notification.id]: 'error' }));
      console.error("Error sending email:", err);
    }
  };

  // Eliminar notificación
  const deleteNotification = async (notificationId) => {
    try {
      setDeletingNotifications(prev => new Set(prev).add(notificationId));
      
      // Simular llamada API para eliminar
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      setDeletingNotifications(prev => {
        const newSet = new Set(prev);
        newSet.delete(notificationId);
        return newSet;
      });
    } catch (err) {
      console.error("Error deleting notification:", err);
      setDeletingNotifications(prev => {
        const newSet = new Set(prev);
        newSet.delete(notificationId);
        return newSet;
      });
    }
  };

  // Toggle expanded notification
  const toggleExpanded = (notificationId) => {
    setExpandedNotifications(prev => {
      const newSet = new Set(prev);
      if (newSet.has(notificationId)) {
        newSet.delete(notificationId);
      } else {
        newSet.add(notificationId);
      }
      return newSet;
    });
  };

  // Calcular estadísticas
  const statistics = React.useMemo(() => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const thisWeek = new Date(today);
    thisWeek.setDate(thisWeek.getDate() - 7);
    const thisMonth = new Date(today);
    thisMonth.setDate(thisMonth.getDate() - 30);

    const totalNotifications = notifications.length;
    const todayCount = notifications.filter(n => 
      new Date(n.created_at).toDateString() === today.toDateString()
    ).length;
    
    const thisWeekCount = notifications.filter(n => 
      new Date(n.created_at) >= thisWeek
    ).length;
    
    const winnersCount = notifications.filter(n => 
      n.notification_type === 'roulette_winner' || 
      n.notification_type === 'winner_notification'
    ).length;
    
    const alertsCount = notifications.filter(n => 
      n.notification_type === 'admin_system_alert' || 
      n.notification_type === 'admin_problem_alert' ||
      n.priority === 'urgent'
    ).length;
    
    const activeRoulettes = new Set(
      notifications
        .filter(n => n.roulette_id)
        .map(n => n.roulette_id)
    ).size;

    return {
      total: totalNotifications,
      today: todayCount,
      thisWeek: thisWeekCount,
      winners: winnersCount,
      alerts: alertsCount,
      activeRoulettes,
      avgPerDay: thisWeekCount > 0 ? Math.round(thisWeekCount / 7) : 0
    };
  }, [notifications]);

  // Dividir notificaciones en series por fecha
  const categorizedNotifications = React.useMemo(() => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const groupByDateAndType = (notifications) => {
      return notifications.reduce((acc, notification) => {
        const notificationDate = new Date(notification.created_at);
        let dateGroup = '';
        
        if (notificationDate.toDateString() === today.toDateString()) {
          dateGroup = 'Hoy';
        } else if (notificationDate.toDateString() === yesterday.toDateString()) {
          dateGroup = 'Ayer';
        } else if (notificationDate >= weekAgo) {
          dateGroup = 'Esta Semana';
        } else {
          dateGroup = 'Anteriores';
        }

        if (!acc[dateGroup]) {
          acc[dateGroup] = [];
        }
        acc[dateGroup].push(notification);
        return acc;
      }, {});
    };

    const winners = notifications.filter(n => 
      n.notification_type === 'roulette_winner' || 
      n.notification_type === 'winner_notification'
    );
    
    const errors = notifications.filter(n => 
      n.notification_type === 'admin_system_alert' || 
      n.notification_type === 'admin_problem_alert' ||
      n.priority === 'urgent'
    );
    
    const upcomingDraws = notifications.filter(n => 
      n.notification_type === 'roulette_ending_soon' ||
      n.notification_type === 'roulette_started'
    );
    
    const general = notifications.filter(n => 
      !['roulette_winner', 'winner_notification', 'admin_system_alert', 'admin_problem_alert', 'roulette_ending_soon', 'roulette_started'].includes(n.notification_type) &&
      n.priority !== 'urgent'
    );

    return {
      winners: groupByDateAndType(winners),
      errors: groupByDateAndType(errors),
      upcomingDraws: groupByDateAndType(upcomingDraws),
      general: groupByDateAndType(general)
    };
  }, [notifications]);

  if (loading && notifications.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-12">
        <div className="flex flex-col items-center justify-center">
          <RefreshCcw className="h-8 w-8 animate-spin text-blue-600 mb-4" />
          <span className="text-gray-600 text-lg">Cargando panel administrativo...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header simple solo con refresh */}
      <div className="flex justify-end mb-8">
        <button
          onClick={loadNotifications}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-xl transition-colors flex items-center space-x-3 disabled:opacity-50 shadow-lg hover:shadow-xl text-lg font-medium"
        >
          <RefreshCcw className={`h-6 w-6 ${loading ? "animate-spin" : ""}`} />
          <span>Actualizar Panel</span>
        </button>
      </div>

      {error && (
        <div className="mb-8 p-6 bg-red-50 border-l-4 border-red-500 rounded-xl">
          <div className="flex items-center">
            <AlertTriangle className="h-6 w-6 text-red-600 mr-4" />
            <span className="text-red-700 font-medium text-lg">{error}</span>
          </div>
        </div>
      )}

      {/* Grid responsive - más grande */}
      <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-4 gap-8">
        
        {/* CUADRO 1: Ganadores Recientes */}
        <div className="bg-white rounded-2xl shadow-xl p-10 border border-gray-100 hover:shadow-2xl transition-all duration-300 min-h-[600px]">
          <div className="flex items-center justify-between mb-10">
            <div className="flex items-center space-x-5">
              <div className="bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-2xl p-4 shadow-lg">
                <Trophy className="h-10 w-10 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Ganadores</h2>
                <p className="text-base text-gray-500">Recientes</p>
              </div>
            </div>
            <span className="bg-yellow-100 text-yellow-800 px-5 py-3 rounded-2xl text-xl font-bold shadow-md">
              {Object.values(categorizedNotifications.winners).flat().length}
            </span>
          </div>
          
          <div className="space-y-8 max-h-96 overflow-y-auto custom-scrollbar">
            {Object.values(categorizedNotifications.winners).flat().length === 0 ? (
              <div className="text-center py-16">
                <Trophy className="h-20 w-20 text-gray-300 mx-auto mb-6" />
                <p className="text-gray-500 text-xl">No hay ganadores recientes</p>
                <p className="text-gray-400 text-base mt-3">Los nuevos ganadores aparecerán aquí</p>
              </div>
            ) : (
              Object.entries(categorizedNotifications.winners).map(([dateGroup, groupNotifications]) => (
                <div key={dateGroup} className="space-y-4">
                  <div className="flex items-center space-x-4 pb-3 border-b-2 border-yellow-200">
                    <div className="w-5 h-5 rounded-full bg-gradient-to-r from-yellow-400 to-yellow-600 shadow-md"></div>
                    <h4 className="text-xl font-semibold text-gray-800">{dateGroup}</h4>
                    <span className="text-base text-gray-500 bg-gray-100 px-3 py-2 rounded-full">
                      {groupNotifications.length} {groupNotifications.length === 1 ? 'ganador' : 'ganadores'}
                    </span>
                  </div>
                  {groupNotifications.slice(0, 5).map(notification => (
                    <div key={notification.id} className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-xl p-6 border border-yellow-200 hover:shadow-lg transition-all duration-300">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1">
                          <div className="font-semibold text-yellow-900 mb-3 text-xl">🎉 {notification.title}</div>
                          <div className={`text-yellow-800 text-base leading-relaxed mb-4 ${expandedNotifications.has(notification.id) ? '' : 'line-clamp-2'}`}>
                            {notification.message}
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4 text-sm text-yellow-600">
                              {notification.roulette_id && (
                                <span className="flex items-center bg-yellow-200 px-3 py-2 rounded-full">
                                  <Hash className="h-4 w-4 mr-1" />
                                  Ruleta {notification.roulette_id}
                                </span>
                              )}
                              <span className="flex items-center">
                                <Calendar className="h-4 w-4 mr-1" />
                                {new Date(notification.created_at).toLocaleString()}
                              </span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => toggleExpanded(notification.id)}
                                className="text-yellow-600 hover:text-yellow-800 p-1"
                              >
                                {expandedNotifications.has(notification.id) ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </button>
                              <button
                                onClick={() => deleteNotification(notification.id)}
                                disabled={deletingNotifications.has(notification.id)}
                                className="text-red-500 hover:text-red-700 p-1 disabled:opacity-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-end">
                        {emailStatus[notification.id] === 'sent' ? (
                          <div className="flex items-center text-green-600 text-base bg-green-100 px-4 py-2 rounded-full">
                            <CheckCircle className="h-5 w-5 mr-2" />
                            Enviado
                          </div>
                        ) : emailStatus[notification.id] === 'error' ? (
                          <div className="flex items-center text-red-600 text-base bg-red-100 px-4 py-2 rounded-full">
                            <XCircle className="h-5 w-5 mr-2" />
                            Error
                          </div>
                        ) : (
                          <button
                            onClick={() => sendWinnerEmail(notification)}
                            disabled={emailStatus[notification.id] === 'sending'}
                            className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl text-base font-medium transition-colors disabled:opacity-50 shadow-lg hover:shadow-xl flex items-center space-x-3"
                          >
                            <Mail className="h-5 w-5" />
                            <span>{emailStatus[notification.id] === 'sending' ? 'Enviando...' : 'Notificar'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>

        {/* CUADRO 2: Alertas del Sistema */}
        <div className="bg-white rounded-2xl shadow-xl p-10 border border-gray-100 hover:shadow-2xl transition-all duration-300 min-h-[600px]">
          <div className="flex items-center justify-between mb-10">
            <div className="flex items-center space-x-5">
              <div className="bg-gradient-to-br from-red-400 to-red-600 rounded-2xl p-4 shadow-lg">
                <AlertTriangle className="h-10 w-10 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Alertas</h2>
                <p className="text-base text-gray-500">del Sistema</p>
              </div>
            </div>
            <span className="bg-red-100 text-red-800 px-5 py-3 rounded-2xl text-xl font-bold shadow-md">
              {Object.values(categorizedNotifications.errors).flat().length}
            </span>
          </div>
          
          <div className="space-y-8 max-h-96 overflow-y-auto custom-scrollbar">
            {Object.values(categorizedNotifications.errors).flat().length === 0 ? (
              <div className="text-center py-16">
                <AlertTriangle className="h-20 w-20 text-gray-300 mx-auto mb-6" />
                <p className="text-gray-500 text-xl">Sin alertas del sistema</p>
                <p className="text-gray-400 text-base mt-3">Todo funcionando correctamente</p>
              </div>
            ) : (
              Object.entries(categorizedNotifications.errors).map(([dateGroup, groupNotifications]) => (
                <div key={dateGroup} className="space-y-4">
                  <div className="flex items-center space-x-4 pb-3 border-b-2 border-red-200">
                    <div className="w-5 h-5 rounded-full bg-gradient-to-r from-red-400 to-red-600 shadow-md"></div>
                    <h4 className="text-xl font-semibold text-gray-800">{dateGroup}</h4>
                    <span className="text-base text-gray-500 bg-gray-100 px-3 py-2 rounded-full">
                      {groupNotifications.length} {groupNotifications.length === 1 ? 'alerta' : 'alertas'}
                    </span>
                  </div>
                  {groupNotifications.slice(0, 5).map(notification => (
                    <div key={notification.id} className="bg-red-50 border-l-4 border-red-500 rounded-xl p-6 hover:shadow-lg transition-all duration-300">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-4 flex-1">
                          <AlertCircle className="h-6 w-6 text-red-600 mt-1 flex-shrink-0" />
                          <div className="flex-1">
                            <div className="font-semibold text-red-900 mb-3 text-xl flex items-center">
                              {notification.title}
                              <span className="ml-3 bg-red-200 text-red-800 px-3 py-1 rounded-full text-sm font-medium">
                                URGENTE
                              </span>
                            </div>
                            <div className={`text-red-800 text-base leading-relaxed mb-4 ${expandedNotifications.has(notification.id) ? '' : 'line-clamp-2'}`}>
                              {notification.message}
                            </div>
                            <div className="flex items-center space-x-4 text-sm text-red-600">
                              {notification.roulette_id && (
                                <span className="flex items-center bg-red-200 px-3 py-2 rounded-full">
                                  <Hash className="h-4 w-4 mr-1" />
                                  Ruleta {notification.roulette_id}
                                </span>
                              )}
                              <span className="flex items-center">
                                <Calendar className="h-4 w-4 mr-1" />
                                {new Date(notification.created_at).toLocaleString()}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-center space-y-2 ml-4">
                          <button
                            onClick={() => toggleExpanded(notification.id)}
                            className="text-red-600 hover:text-red-800 p-1"
                          >
                            {expandedNotifications.has(notification.id) ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                          <button
                            onClick={() => deleteNotification(notification.id)}
                            disabled={deletingNotifications.has(notification.id)}
                            className="text-red-500 hover:text-red-700 p-1 disabled:opacity-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>

        {/* CUADRO 3: Próximos Sorteos */}
        <div className="bg-white rounded-2xl shadow-xl p-10 border border-gray-100 hover:shadow-2xl transition-all duration-300 min-h-[600px]">
          <div className="flex items-center justify-between mb-10">
            <div className="flex items-center space-x-5">
              <div className="bg-gradient-to-br from-orange-400 to-orange-600 rounded-2xl p-4 shadow-lg">
                <Clock className="h-10 w-10 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Próximos</h2>
                <p className="text-base text-gray-500">Sorteos</p>
              </div>
            </div>
            <span className="bg-orange-100 text-orange-800 px-5 py-3 rounded-2xl text-xl font-bold shadow-md">
              {Object.values(categorizedNotifications.upcomingDraws).flat().length}
            </span>
          </div>
          
          <div className="space-y-8 max-h-96 overflow-y-auto custom-scrollbar">
            {Object.values(categorizedNotifications.upcomingDraws).flat().length === 0 ? (
              <div className="text-center py-16">
                <Clock className="h-20 w-20 text-gray-300 mx-auto mb-6" />
                <p className="text-gray-500 text-xl">No hay próximos sorteos</p>
                <p className="text-gray-400 text-base mt-3">Los sorteos programados aparecerán aquí</p>
              </div>
            ) : (
              Object.entries(categorizedNotifications.upcomingDraws).map(([dateGroup, groupNotifications]) => (
                <div key={dateGroup} className="space-y-4">
                  <div className="flex items-center space-x-4 pb-3 border-b-2 border-orange-200">
                    <div className="w-5 h-5 rounded-full bg-gradient-to-r from-orange-400 to-orange-600 shadow-md"></div>
                    <h4 className="text-xl font-semibold text-gray-800">{dateGroup}</h4>
                    <span className="text-base text-gray-500 bg-gray-100 px-3 py-2 rounded-full">
                      {groupNotifications.length} {groupNotifications.length === 1 ? 'sorteo' : 'sorteos'}
                    </span>
                  </div>
                  {groupNotifications.slice(0, 5).map(notification => (
                    <div key={notification.id} className="bg-orange-50 border-l-4 border-orange-500 rounded-xl p-6 hover:shadow-lg transition-all duration-300">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-4 flex-1">
                          <Target className="h-6 w-6 text-orange-600 mt-1 flex-shrink-0" />
                          <div className="flex-1">
                            <div className="font-semibold text-orange-900 mb-3 text-xl">{notification.title}</div>
                            <div className={`text-orange-800 text-base leading-relaxed mb-4 ${expandedNotifications.has(notification.id) ? '' : 'line-clamp-2'}`}>
                              {notification.message}
                            </div>
                            <div className="flex items-center space-x-4 text-sm text-orange-600">
                              {notification.roulette_id && (
                                <span className="flex items-center bg-orange-200 px-3 py-2 rounded-full">
                                  <Hash className="h-4 w-4 mr-1" />
                                  Ruleta {notification.roulette_id}
                                </span>
                              )}
                              <span className="flex items-center">
                                <Calendar className="h-4 w-4 mr-1" />
                                {new Date(notification.created_at).toLocaleString()}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-center space-y-2 ml-4">
                          <button
                            onClick={() => toggleExpanded(notification.id)}
                            className="text-orange-600 hover:text-orange-800 p-1"
                          >
                            {expandedNotifications.has(notification.id) ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                          <button
                            onClick={() => deleteNotification(notification.id)}
                            disabled={deletingNotifications.has(notification.id)}
                            className="text-red-500 hover:text-red-700 p-1 disabled:opacity-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>

        {/* CUADRO 4: Estadísticas del Sistema */}
        <div className="bg-white rounded-2xl shadow-xl p-10 border border-gray-100 hover:shadow-2xl transition-all duration-300 min-h-[600px]">
          <div className="flex items-center justify-between mb-10">
            <div className="flex items-center space-x-5">
              <div className="bg-gradient-to-br from-blue-400 to-blue-600 rounded-2xl p-4 shadow-lg">
                <BarChart3 className="h-10 w-10 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Estadísticas</h2>
                <p className="text-base text-gray-500">del Sistema</p>
              </div>
            </div>
            <span className="bg-blue-100 text-blue-800 px-5 py-3 rounded-2xl text-xl font-bold shadow-md">
              LIVE
            </span>
          </div>
          
          <div className="space-y-6">
            {/* Métricas principales */}
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
                <div className="flex items-center space-x-3 mb-3">
                  <MessageSquare className="h-6 w-6 text-blue-600" />
                  <span className="text-blue-800 font-medium">Total</span>
                </div>
                <div className="text-3xl font-bold text-blue-900">{statistics.total}</div>
                <div className="text-sm text-blue-600 mt-1">Notificaciones</div>
              </div>
              
              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 border border-green-200">
                <div className="flex items-center space-x-3 mb-3">
                  <Activity className="h-6 w-6 text-green-600" />
                  <span className="text-green-800 font-medium">Hoy</span>
                </div>
                <div className="text-3xl font-bold text-green-900">{statistics.today}</div>
                <div className="text-sm text-green-600 mt-1">Nuevas</div>
              </div>
              
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6 border border-purple-200">
                <div className="flex items-center space-x-3 mb-3">
                  <TrendingUp className="h-6 w-6 text-purple-600" />
                  <span className="text-purple-800 font-medium">Esta Semana</span>
                </div>
                <div className="text-3xl font-bold text-purple-900">{statistics.thisWeek}</div>
                <div className="text-sm text-purple-600 mt-1">Notificaciones</div>
              </div>
              
              <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl p-6 border border-amber-200">
                <div className="flex items-center space-x-3 mb-3">
                  <Users className="h-6 w-6 text-amber-600" />
                  <span className="text-amber-800 font-medium">Promedio</span>
                </div>
                <div className="text-3xl font-bold text-amber-900">{statistics.avgPerDay}</div>
                <div className="text-sm text-amber-600 mt-1">Por día</div>
              </div>
            </div>

            {/* Estadísticas detalladas */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-2">Resumen por Categoría</h3>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                  <div className="flex items-center space-x-3">
                    <Trophy className="h-5 w-5 text-yellow-600" />
                    <span className="font-medium text-yellow-800">Ganadores</span>
                  </div>
                  <div className="text-2xl font-bold text-yellow-900">{statistics.winners}</div>
                </div>
                
                <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg border border-red-200">
                  <div className="flex items-center space-x-3">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                    <span className="font-medium text-red-800">Alertas</span>
                  </div>
                  <div className="text-2xl font-bold text-red-900">{statistics.alerts}</div>
                </div>
                
                <div className="flex items-center justify-between p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                  <div className="flex items-center space-x-3">
                    <Target className="h-5 w-5 text-indigo-600" />
                    <span className="font-medium text-indigo-800">Ruletas Activas</span>
                  </div>
                  <div className="text-2xl font-bold text-indigo-900">{statistics.activeRoulettes}</div>
                </div>
              </div>
            </div>

            {/* Estado del sistema */}
            <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-xl p-6 border border-green-200">
              <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                <Activity className="h-5 w-5 text-green-600 mr-2" />
                Estado del Sistema
              </h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-700">Estado General:</span>
                  <span className="flex items-center text-green-600 font-medium">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                    Operativo
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-700">Última Actualización:</span>
                  <span className="text-gray-600 text-sm">
                    {new Date().toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-700">Notificaciones Pendientes:</span>
                  <span className={`font-medium ${statistics.alerts > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {statistics.alerts > 0 ? `${statistics.alerts} pendientes` : 'Todas procesadas'}
                  </span>
                </div>
              </div>
            </div>

            {/* Notificaciones generales recientes */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-2">Actividad Reciente</h3>
              <div className="space-y-3 max-h-40 overflow-y-auto custom-scrollbar">
                {Object.values(categorizedNotifications.general).flat().slice(0, 3).map(notification => (
                  <div key={notification.id} className="bg-blue-50 border-l-4 border-blue-500 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3 flex-1">
                        <Info className="h-4 w-4 text-blue-600 mt-1 flex-shrink-0" />
                        <div className="flex-1">
                          <div className="font-medium text-blue-900 text-sm">{notification.title}</div>
                          <div className="text-blue-800 text-xs mt-1 line-clamp-1">{notification.message}</div>
                          <div className="text-xs text-blue-600 mt-2">
                            {new Date(notification.created_at).toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => deleteNotification(notification.id)}
                        disabled={deletingNotifications.has(notification.id)}
                        className="text-red-500 hover:text-red-700 p-1 disabled:opacity-50"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
                {Object.values(categorizedNotifications.general).flat().length === 0 && (
                  <div className="text-center py-8">
                    <Info className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 text-sm">Sin actividad reciente</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
        .line-clamp-1 {
          display: -webkit-box;
          -webkit-line-clamp: 1;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </div>
  );
};

export default AdminNotificationPanel;