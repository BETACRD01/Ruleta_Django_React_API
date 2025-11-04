import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

// Crear el contexto
const NotificationContext = createContext();

// Hook para usar el contexto
export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification debe ser usado dentro de un NotificationProvider');
  }
  return context;
};

// Componente de notificación individual
const NotificationItem = ({ notification, onClose }) => {
  const { id, type, title, message, duration } = notification;

  const getIcon = () => {
    switch (type) {
      case 'success': return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error': return <AlertCircle className="h-5 w-5 text-red-500" />;
      case 'warning': return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'info': return <Info className="h-5 w-5 text-blue-500" />;
      default: return <Info className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStyles = () => {
    switch (type) {
      case 'success': return 'bg-green-50 border-green-200 text-green-800';
      case 'error': return 'bg-red-50 border-red-200 text-red-800';
      case 'warning': return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'info': return 'bg-blue-50 border-blue-200 text-blue-800';
      default: return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  React.useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onClose(id);
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [id, duration, onClose]);

  return (
    <div className={`flex items-start gap-3 p-4 rounded-xl border shadow-lg backdrop-blur-sm animate-in slide-in-from-right duration-300 ${getStyles()}`}>
      <div className="flex-shrink-0 mt-0.5">
        {getIcon()}
      </div>
      <div className="flex-1 min-w-0">
        {title && (
          <h4 className="text-sm font-semibold mb-1">{title}</h4>
        )}
        <p className="text-sm opacity-90">{message}</p>
      </div>
      <button
        onClick={() => onClose(id)}
        className="flex-shrink-0 p-1 rounded-full hover:bg-black/10 transition-colors"
        aria-label="Cerrar notificación"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

// Componente contenedor de notificaciones
const NotificationContainer = ({ notifications, onClose }) => {
  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-3 max-w-sm w-full">
      {notifications.map(notification => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onClose={onClose}
        />
      ))}
    </div>
  );
};

// Proveedor del contexto
export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);

  // Función para agregar notificación
  const addNotification = useCallback((notification) => {
    const id = Date.now() + Math.random();
    const newNotification = {
      id,
      type: 'info',
      duration: 5000, // 5 segundos por defecto
      ...notification,
    };

    setNotifications(prev => [...prev, newNotification]);
    return id;
  }, []);

  // Función para remover notificación
  const removeNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id));
  }, []);

  // Función para limpiar todas las notificaciones
  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  // Funciones de conveniencia
  const showSuccess = useCallback((message, title, options = {}) => {
    return addNotification({
      type: 'success',
      title: title || 'Éxito',
      message,
      ...options
    });
  }, [addNotification]);

  const showError = useCallback((message, title, options = {}) => {
    return addNotification({
      type: 'error',
      title: title || 'Error',
      message,
      duration: 7000, // Errores duran más tiempo
      ...options
    });
  }, [addNotification]);

  const showWarning = useCallback((message, title, options = {}) => {
    return addNotification({
      type: 'warning',
      title: title || 'Advertencia',
      message,
      ...options
    });
  }, [addNotification]);

  const showInfo = useCallback((message, title, options = {}) => {
    return addNotification({
      type: 'info',
      title: title || 'Información',
      message,
      ...options
    });
  }, [addNotification]);

  // Funciones específicas para autenticación
  const showLoginSuccess = useCallback((user) => {
    const name = user?.first_name || user?.username || 'Usuario';
    return showSuccess(
      `Bienvenido de vuelta, ${name}!`,
      'Inicio de sesión exitoso',
      { duration: 4000 }
    );
  }, [showSuccess]);

  const showRegisterSuccess = useCallback((user) => {
    const name = user?.first_name || user?.username || 'Usuario';
    return showSuccess(
      `¡Cuenta creada exitosamente! Bienvenido ${name}!`,
      'Registro completado',
      { duration: 6000 }
    );
  }, [showSuccess]);

  const showPasswordResetSuccess = useCallback((email) => {
    return showSuccess(
      `Se han enviado las instrucciones de recuperación a ${email}`,
      'Email enviado',
      { duration: 6000 }
    );
  }, [showSuccess]);

  const showLogoutSuccess = useCallback(() => {
    return showInfo(
      'Has cerrado sesión correctamente. ¡Hasta pronto!',
      'Sesión cerrada',
      { duration: 3000 }
    );
  }, [showInfo]);

  // Funciones para errores de API
  const showAPIError = useCallback((error, context = 'Operación') => {
    const message = error?.message || error || 'Ha ocurrido un error inesperado';
    return showError(message, `Error en ${context}`);
  }, [showError]);

  const showNetworkError = useCallback(() => {
    return showError(
      'No se pudo conectar con el servidor. Verifica tu conexión a internet.',
      'Error de conexión',
      { duration: 8000 }
    );
  }, [showError]);

  const value = {
    notifications,
    addNotification,
    removeNotification,
    clearNotifications,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    // Funciones específicas para autenticación
    showLoginSuccess,
    showRegisterSuccess,
    showPasswordResetSuccess,
    showLogoutSuccess,
    showAPIError,
    showNetworkError,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <NotificationContainer
        notifications={notifications}
        onClose={removeNotification}
      />
    </NotificationContext.Provider>
  );
};

// Hook personalizado para autenticación con notificaciones
export const useAuthNotifications = () => {
  const {
    showLoginSuccess,
    showRegisterSuccess,
    showPasswordResetSuccess,
    showLogoutSuccess,
    showAPIError,
    showNetworkError
  } = useNotification();

  const handleLoginSuccess = useCallback((payload) => {
    // Acepta { user } o user directamente
    const user = payload?.user || payload;
    showLoginSuccess(user);
  }, [showLoginSuccess]);

  const handleRegisterSuccess = useCallback((payload) => {
    // 🔒 Arreglo: acepta { user } o el user plano
    const user = payload?.user || payload;
    showRegisterSuccess(user);
  }, [showRegisterSuccess]);

  const handlePasswordResetSuccess = useCallback((email) => {
    showPasswordResetSuccess(email);
  }, [showPasswordResetSuccess]);

  const handleLogout = useCallback(() => {
    showLogoutSuccess();
  }, [showLogoutSuccess]);

  const handleAuthError = useCallback((error, operation = 'autenticación') => {
    if (error?.message?.toLowerCase?.().includes('conexión') || error?.message?.toLowerCase?.().includes('network')) {
      showNetworkError();
    } else {
      showAPIError(error, operation);
    }
  }, [showAPIError, showNetworkError]);

  return {
    handleLoginSuccess,
    handleRegisterSuccess,
    handlePasswordResetSuccess,
    handleLogout,
    handleAuthError,
  };
};

// (Opcional) Componente de prueba local
export const ExampleUsage = () => {
  const { showSuccess, showError, showInfo } = useNotification();
  const { handleLoginSuccess, handleRegisterSuccess, handleAuthError } = useAuthNotifications();

  const testNotifications = () => {
    showSuccess('Esta es una notificación de éxito');
    setTimeout(() => showError('Esta es una notificación de error'), 1000);
    setTimeout(() => showInfo('Esta es una notificación informativa'), 2000);
  };

  const testAuthNotifications = () => {
    handleLoginSuccess({ first_name: 'Juan', username: 'juanperez' });
    setTimeout(() => handleRegisterSuccess({ first_name: 'María', username: 'maria123' }), 2000);
    setTimeout(() => handleAuthError({ message: 'Credenciales inválidas' }, 'inicio de sesión'), 4000);
  };

  return (
    <div className="p-8 space-y-4">
      <h2 className="text-2xl font-bold">Prueba de Notificaciones</h2>
      <div className="space-x-4">
        <button
          onClick={testNotifications}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Probar Notificaciones Básicas
        </button>
        <button
          onClick={testAuthNotifications}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
        >
          Probar Notificaciones de Auth
        </button>
      </div>
    </div>
  );
};

export default NotificationProvider;
