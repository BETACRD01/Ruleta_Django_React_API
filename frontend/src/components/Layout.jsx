// src/components/Layout.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  Bell, User, LogOut, Settings,
  Menu, X, RotateCcw, ChevronDown, Check, CheckCheck, Trash2, ShieldCheck
} from 'lucide-react';
import { notificationAPI, notificationManager, resolveMediaUrl } from '../config/api';

// Panels
import ProfilePanel from './profile/ProfilePanel';
import AccountSettingsPanel from './settings/AccountSettingsPanel';

// Logo
import logo from '../assets/HAYU24_original.png';

const Layout = ({ children }) => {
  const { user, userProfile, logout, isAdmin, loading, loadUserProfile } = useAuth();

  // Menús
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  // Paneles
  const [profileOpen, setProfileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Notificaciones
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [notificationError, setNotificationError] = useState(null);

  // Avatar del usuario
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [avatarError, setAvatarError] = useState(false);

  // Cargar avatar desde userProfile del contexto
  useEffect(() => {
    if (userProfile?.profile?.avatar) {
      const url = resolveMediaUrl(userProfile.profile.avatar);
      setAvatarUrl(url);
      setAvatarError(false);
    } else {
      setAvatarUrl(null);
      setAvatarError(false);
    }
  }, [userProfile]);

  // Cargar notificaciones
  const loadNotifications = useCallback(async () => {
    if (!user) return;
    try {
      setNotificationLoading(true);
      setNotificationError(null);
      const response = await notificationAPI.getUserNotifications({
        page_size: 20,
        include_stats: true
      });
      if (response) {
        setNotifications(response.results || []);
        setUnreadCount(response.stats?.unread_count || 0);
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
      setNotificationError('Error al cargar notificaciones');
    } finally {
      setNotificationLoading(false);
    }
  }, [user]);

  // Suscripción y polling
  useEffect(() => {
    if (!user) return;
    loadNotifications();

    const unsubscribe = notificationManager.addEventListener((event, data) => {
      if (event === 'notifications_updated') {
        if (data.notifications) setNotifications(data.notifications);
        if (data.stats) setUnreadCount(data.stats.unread_count || 0);
      }
      if (event === 'session_expired') {
        setNotifications([]);
        setUnreadCount(0);
      }
    });

    notificationManager.startPolling(30000);
    return () => {
      unsubscribe();
    };
  }, [user, loadNotifications]);

  const markAsRead = async (notificationIds) => {
    const ids = Array.isArray(notificationIds) ? notificationIds : [notificationIds];
    try {
      await notificationAPI.markAsRead(ids);
      setNotifications(prev => prev.map(n => ids.includes(n.id) ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - ids.length));
      setTimeout(loadNotifications, 400);
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await notificationAPI.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
      setTimeout(loadNotifications, 400);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const deleteNotification = async (notificationId) => {
    try {
      await notificationAPI.deleteNotification(notificationId);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      const n = notifications.find(n => n.id === notificationId);
      if (n && !n.is_read) setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const getNotificationIcon = (type) => {
    const icons = {
      participation_confirmed: '✅',
      roulette_winner: '🎉',
      roulette_started: '🎯',
      roulette_ending_soon: '⏰',
      winner_notification: '🏆',
      welcome_message: '👋',
    };
    return icons[type] || '📢';
  };

  const formatNotificationTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    if (diffMins < 1) return 'Ahora';
    if (diffMins < 60) return `Hace ${diffMins}m`;
    if (diffHours < 24) return `Hace ${diffHours}h`;
    if (diffDays < 7) return `Hace ${diffDays}d`;
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  };

  // Recargar perfil cuando se guarda
  const handleProfileSaved = useCallback(async () => {
    await loadUserProfile();
  }, [loadUserProfile]);

  const handleSettingsSaved = useCallback(() => {
    // Configuración guardada
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const handleLogout = async () => {
    await logout();
    setUserMenuOpen(false);
    setMobileMenuOpen(false);
    setNotifications([]);
    setUnreadCount(0);
  };

  // Obtener iniciales del usuario
  const getUserInitials = () => {
    const firstName = user?.first_name || '';
    const lastName = user?.last_name || '';
    return `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase() || 'U';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Izquierda: logo o emblema admin */}
            <div className="flex items-center gap-2">
              <button
                className="md:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 transition-colors"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label="Abrir menú"
              >
                {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>

              <div className="flex items-center gap-2">
                {!isAdmin && (
                  <div className="hayu-logo-container">
                    <img
                      key={`logo-${user?.id || 'anon'}`}
                      src={logo}
                      alt="HAYU24"
                      className="h-10 w-auto object-contain select-none pointer-events-none"
                      loading="eager"
                      decoding="async"
                      draggable="false"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  </div>
                )}

                {isAdmin && (
                  <div className="flex items-center gap-2">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-600 to-blue-600 text-white shadow-lg flex items-center justify-center">
                      <ShieldCheck className="h-6 w-6" />
                    </div>
                    <span className="hidden sm:inline-block text-xs bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full font-semibold tracking-wide">
                      ADMIN
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Derecha: Notificaciones + menú usuario */}
            <div className="flex items-center space-x-2 sm:space-x-4">
              {/* Campana */}
              <div className="relative">
                <button
                  onClick={() => {
                    setNotificationsOpen(!notificationsOpen);
                    if (!notificationsOpen) loadNotifications();
                  }}
                  className="relative p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                  aria-label="Abrir notificaciones"
                >
                  <Bell className="h-5 w-5 sm:h-6 sm:w-6" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 inline-flex items-center justify-center text-[10px] font-bold rounded-full bg-red-600 text-white px-1.5 py-0.5 min-w-[18px] shadow-md">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </button>

                {notificationsOpen && (
                  <div className="origin-top-right absolute right-0 mt-2 w-[calc(100vw-2rem)] sm:w-96 rounded-lg shadow-2xl bg-white ring-1 ring-black ring-opacity-5 z-50 max-w-md">
                    <div className="p-4 border-b border-gray-200">
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="text-base font-semibold text-gray-900">Notificaciones</h3>
                        <div className="flex items-center space-x-2">
                          {unreadCount > 0 && (
                            <button
                              onClick={markAllAsRead}
                              className="text-xs text-blue-600 hover:text-blue-800 font-medium p-1 hover:bg-blue-50 rounded transition-colors"
                              title="Marcar todas como leídas"
                            >
                              <CheckCheck className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={loadNotifications}
                            disabled={notificationLoading}
                            className="text-xs text-gray-500 hover:text-gray-700 p-1 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
                            title="Actualizar"
                          >
                            <RotateCcw className={`h-4 w-4 ${notificationLoading ? 'animate-spin' : ''}`} />
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="max-h-[60vh] sm:max-h-96 overflow-y-auto">
                      {notificationLoading ? (
                        <div className="p-4 text-center text-gray-500">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
                          <span className="text-sm">Cargando notificaciones...</span>
                        </div>
                      ) : notificationError ? (
                        <div className="p-4 text-center text-red-600">
                          <span className="text-sm">{notificationError}</span>
                          <button
                            onClick={loadNotifications}
                            className="block mx-auto mt-2 text-xs text-blue-600 hover:text-blue-800 font-medium"
                          >
                            Reintentar
                          </button>
                        </div>
                      ) : notifications.length === 0 ? (
                        <div className="p-6 text-center text-gray-500">
                          <Bell className="mx-auto h-8 w-8 text-gray-300 mb-2" />
                          <span className="text-sm">No tienes notificaciones</span>
                        </div>
                      ) : (
                        <div className="divide-y divide-gray-100">
                          {notifications.map((notification) => (
                            <NotificationItem
                              key={notification.id}
                              notification={notification}
                              onMarkAsRead={() => markAsRead(notification.id)}
                              onDelete={() => deleteNotification(notification.id)}
                              formatTime={formatNotificationTime}
                              getIcon={getNotificationIcon}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Menú de usuario CON AVATAR */}
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all"
                  aria-label="Abrir menú de usuario"
                >
                  <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-gradient-to-r from-blue-400 to-blue-600 flex items-center justify-center shadow-md overflow-hidden ring-2 ring-white">
                    {avatarUrl && !avatarError ? (
                      <img
                        src={avatarUrl}
                        alt="Avatar"
                        className="h-full w-full object-cover"
                        onError={() => setAvatarError(true)}
                      />
                    ) : (
                      <span className="text-white font-medium text-xs sm:text-sm">
                        {getUserInitials()}
                      </span>
                    )}
                  </div>
                  <ChevronDown className="ml-1 h-4 w-4 text-gray-400 hidden sm:block" />
                </button>

                {userMenuOpen && (
                  <div className="origin-top-right absolute right-0 mt-2 w-52 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50">
                    <div className="py-1">
                      <button
                        onClick={() => { setProfileOpen(true); setUserMenuOpen(false); }}
                        className="flex items-center w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                      >
                        <User className="mr-3 h-4 w-4" />
                        Mi Perfil
                      </button>

                      <button
                        onClick={() => { setSettingsOpen(true); setUserMenuOpen(false); }}
                        className="flex items-center w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                      >
                        <Settings className="mr-3 h-4 w-4" />
                        Configuración
                      </button>

                      <div className="border-t border-gray-200">
                        <button
                          onClick={handleLogout}
                          className="flex items-center w-full text-left px-4 py-2 text-sm text-red-700 hover:bg-red-50 transition-colors"
                        >
                          <LogOut className="mr-3 h-4 w-4" />
                          Cerrar Sesión
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Menú móvil */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 bg-white">
            <div className="px-2 pt-2 pb-3 space-y-1">
              <MobileNavLink text="Inicio" active />
              <MobileNavLink text="Ruletas" />
              <MobileNavLink text="Mis Participaciones" />
              <MobileNavLink text="Resultados" />
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">
        {children}
      </main>

      {(userMenuOpen || notificationsOpen || mobileMenuOpen) && (
        <div
          className="fixed inset-0 z-30"
          onClick={() => {
            setUserMenuOpen(false);
            setNotificationsOpen(false);
            setMobileMenuOpen(false);
          }}
        />
      )}

      <ProfilePanel
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        onSaved={handleProfileSaved}
      />
      <AccountSettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSaved={handleSettingsSaved}
      />
    </div>
  );
};

/* Item de notificación */
const NotificationItem = ({ notification, onMarkAsRead, onDelete, formatTime, getIcon }) => {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async (e) => {
    e.stopPropagation();
    setIsDeleting(true);
    try {
      await onDelete();
    } catch (error) {
      console.error('Error deleting notification:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleMarkAsRead = async (e) => {
    e.stopPropagation();
    if (!notification.is_read) await onMarkAsRead();
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent': return 'border-l-red-500 bg-red-50';
      case 'high':   return 'border-l-orange-500 bg-orange-50';
      case 'normal': return 'border-l-blue-500 bg-blue-50';
      case 'low':    return 'border-l-green-500 bg-green-50';
      default:       return 'border-l-gray-300 bg-gray-50';
    }
  };

  return (
    <div
      className={`p-3 hover:bg-gray-50 transition-colors border-l-4 ${
        !notification.is_read ? getPriorityColor(notification.priority) : 'border-l-gray-200 bg-white'
      } ${isDeleting ? 'opacity-50' : ''}`}
    >
      <div className="flex justify-between items-start">
        <div className="flex-1 min-w-0">
          <div className="flex items-start space-x-2">
            <span className="text-lg flex-shrink-0">{getIcon(notification.notification_type)}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className={`text-sm font-medium truncate ${!notification.is_read ? 'text-gray-900' : 'text-gray-600'}`}>
                  {notification.title}
                </p>
                {!notification.is_read && <div className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0" />}
              </div>
              <p className="text-xs text-gray-500 mt-1 line-clamp-2 break-words">{notification.message}</p>
              <div className="flex items-center justify-between mt-2 gap-2">
                <p className="text-xs text-gray-400 flex-shrink-0">{formatTime(notification.created_at)}</p>
                <div className="flex items-center space-x-1 flex-shrink-0">
                  {!notification.is_read && (
                    <button
                      onClick={handleMarkAsRead}
                      className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded transition-colors"
                      title="Marcar como leída"
                    >
                      <Check className="h-3 w-3" />
                    </button>
                  )}
                  <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="p-1 text-red-600 hover:text-red-800 hover:bg-red-100 rounded transition-colors disabled:opacity-50"
                    title="Eliminar"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const MobileNavLink = ({ text, active = false, onClick }) => (
  <button
    onClick={onClick}
    className={`flex items-center px-3 py-2 text-base font-medium rounded-md transition-colors w-full text-left ${
      active ? 'text-blue-700 bg-blue-50' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
    }`}
  >
    {text}
  </button>
);

export default Layout;