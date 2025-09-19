// src/contexts/AuthContext.jsx
import React, { createContext, useState, useEffect, useContext, useMemo } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { authAPI, setGlobalAuthToken, clearAllTokens, isAuthenticated } from '../config/api';
import { useNotification } from './NotificationContext';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(null);
  const [error, setError] = useState(null);

  const { showSuccess, showError, showInfo } = useNotification();

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        if (isAuthenticated()) {
          const userInfo = await authAPI.getUserInfo();
          setUser(userInfo);
          // ✅ Fuente única del token (sessionStorage via helpers API)
          const { getGlobalAuthToken } = await import('../config/api');
          setToken(getGlobalAuthToken());
        }
      } catch (err) {
        console.error('Error al inicializar autenticación:', err);
        clearAllTokens();
      } finally {
        setLoading(false);
      }
    };
    initializeAuth();
  }, []);

  const login = async (credentials) => {
    try {
      setLoading(true);
      setError(null);

      const result = await authAPI.login(credentials);

      if (result?.success && result?.token) {
        setToken(result.token);
        setGlobalAuthToken(result.token);
        const userInfo = await authAPI.getUserInfo();
        setUser(userInfo);
        showSuccess(`¡Bienvenido de vuelta, ${userInfo.first_name || userInfo.username || 'Usuario'}!`, 'Inicio de sesión exitoso');
        return { success: true, user: userInfo };
      }

      const errorMessage = result?.message || 'Error en el login';
      setError(errorMessage);
      showError(errorMessage, 'Error de autenticación');
      return { success: false, message: errorMessage };
    } catch (err) {
      const errorMessage = err.message || 'Error de conexión';
      setError(errorMessage);
      console.error('Error en login:', err);
      showError(errorMessage, 'Error de conexión');
      return { success: false, message: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const register = async (userData) => {
    try {
      setLoading(true);
      setError(null);

      const result = await authAPI.register(userData);

      if (result?.success && result?.token) {
        setToken(result.token);
        setGlobalAuthToken(result.token);
        const userInfo = await authAPI.getUserInfo();
        setUser(userInfo);
        showSuccess(
          `¡Cuenta creada exitosamente! Bienvenido ${userInfo.first_name || userInfo.username || 'Usuario'}!`,
          'Registro completado',
          { duration: 6000 }
        );
        return { success: true, user: userInfo };
      }

      const errorMessage = result?.message || 'Error en el registro';
      setError(errorMessage);
      showError(errorMessage, 'Error en el registro');
      return { success: false, message: errorMessage };
    } catch (err) {
      const errorMessage = err.message || 'Error de conexión';
      setError(errorMessage);
      console.error('Error en registro:', err);
      showError(errorMessage, 'Error de registro');
      return { success: false, message: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await authAPI.logout();
      showInfo('Has cerrado sesión correctamente. ¡Hasta pronto!', 'Sesión cerrada', { duration: 3000 });
    } catch (err) {
      console.error('Error en logout:', err);
      showError('Error al cerrar sesión en el servidor', 'Advertencia');
    } finally {
      clearAllTokens();
      setUser(null);
      setToken(null);
      setError(null);
    }
  };

  const requestPasswordReset = async (email) => {
    try {
      setLoading(true);
      setError(null);
      await authAPI.requestPasswordReset(email);
      showSuccess(`Se han enviado las instrucciones de recuperación a ${email}`, 'Email enviado', { duration: 6000 });
      return { success: true, message: 'Enlace de recuperación enviado a tu email' };
    } catch (err) {
      const errorMessage = err.message || 'Error al solicitar recuperación';
      setError(errorMessage);
      showError(errorMessage, 'Error de recuperación');
      return { success: false, message: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (profileData) => {
    try {
      setLoading(true);
      setError(null);
      const updatedUser = await authAPI.updateProfile(profileData);
      setUser(updatedUser);
      showSuccess('Tu perfil ha sido actualizado correctamente', 'Perfil actualizado');
      return { success: true, user: updatedUser };
    } catch (err) {
      const errorMessage = err.message || 'Error al actualizar perfil';
      setError(errorMessage);
      console.error('Error actualizando perfil:', err);
      showError(errorMessage, 'Error al actualizar perfil');
      return { success: false, message: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const changePassword = async (passwordData) => {
    try {
      setLoading(true);
      setError(null);
      await authAPI.changePassword(passwordData);
      showSuccess('Tu contraseña ha sido cambiada exitosamente', 'Contraseña actualizada');
      return { success: true, message: 'Contraseña cambiada exitosamente' };
    } catch (err) {
      const errorMessage = err.message || 'Error al cambiar contraseña';
      setError(errorMessage);
      console.error('Error cambiando contraseña:', err);
      showError(errorMessage, 'Error al cambiar contraseña');
      return { success: false, message: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  // Roles/Permisos
  const isAdmin = () =>
    user?.role === 'admin' || user?.is_admin === true || user?.is_staff === true || user?.is_superuser === true;

  const isUser = () => user?.role === 'user' || (!isAdmin() && !!user);
  const hasPermission = (permission) => (isAdmin() ? true : user?.permissions?.includes(permission) || false);
  const hasRole = (role) => user?.role === role;
  const clearError = () => setError(null);

  const refreshUser = async () => {
    try {
      if (isAuthenticated()) {
        const userInfo = await authAPI.getUserInfo();
        setUser(userInfo);
        return userInfo;
      }
    } catch (err) {
      console.error('Error al refrescar usuario:', err);
      logout();
    }
  };

  const debugUserInfo = () => {
    console.group('🔍 Debug User Info');
    console.log('User object:', user);
    console.log('User role:', user?.role);
    console.log('Is admin (role):', user?.role === 'admin');
    console.log('Is admin (method):', user?.is_admin);
    console.log('Is staff:', user?.is_staff);
    console.log('Is superuser:', user?.is_superuser);
    console.log('Final isAdmin():', isAdmin());
    console.log('Final isUser():', isUser());
    console.log('Token present:', !!token);
    console.log('Is authenticated:', !!user);
    console.groupEnd();
    return { user, role: user?.role, isAdmin: isAdmin(), isUser: isUser(), hasToken: !!token, isAuthenticated: !!user };
  };

  const value = useMemo(() => ({
    // Estado
    user,
    token,
    loading,
    error,

    // Métodos de autenticación
    login,
    register,
    logout,

    // Perfil
    updateProfile,
    changePassword,
    requestPasswordReset,

    // Verificaciones
    isAuthenticated: !!user,
    isAdmin: isAdmin(),
    isUser: isUser(),
    canCreateRoulettes: isAdmin() || user?.permissions?.includes('add_roulette') || false,
    canExecuteDraws: isAdmin() || user?.permissions?.includes('execute_draw') || false,
    canViewReports: isAdmin() || user?.permissions?.includes('view_reports') || false,

    hasPermission,
    hasRole,

    // Utilidades
    clearError,
    refreshUser,
    debugUserInfo,
  }), [user, token, loading, error]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return context;
};

// Rutas protegidas auxiliares (si las usas en otros sitios)
export const ProtectedRoute = ({ children, requireAdmin = false, requireRole = null, requirePermission = null }) => {
  const { user, loading, isAdmin, hasRole, hasPermission } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) return <LoginRedirect />;

  if (requireRole && !hasRole(requireRole)) {
    return <AccessDenied message={`Se requiere rol: ${requireRole}`} />;
  }

  if (requirePermission && !hasPermission(requirePermission)) {
    return <AccessDenied message={`Se requiere permiso: ${requirePermission}`} />;
  }

  if (requireAdmin && !isAdmin) {
    return <AccessDenied message="Se requieren permisos de administrador" />;
  }

  return children;
};

const AccessDenied = ({ message = 'No tienes permisos para acceder a esta sección' }) => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="max-w-md w-full text-center">
      <div className="bg-white shadow rounded-lg p-6">
        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
          <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <div className="mt-3 text-center">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Acceso Denegado</h3>
          <div className="mt-2">
            <p className="text-sm text-gray-500">{message}</p>
          </div>
          <div className="mt-4">
            <button
              onClick={() => (window.location.href = '/')}
              className="inline-flex justify-center px-4 py-2 text-sm font-medium text-blue-900 bg-blue-100 rounded-md hover:bg-blue-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
            >
              Volver al Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const LoginRedirect = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full text-center">
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Sesión Requerida</h3>
          <p className="text-sm text-gray-500 mb-4">Debes iniciar sesión para acceder a esta página.</p>
          <button
            onClick={() => navigate('/login')}
            className="inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
          >
            Ir al Login
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthContext;
