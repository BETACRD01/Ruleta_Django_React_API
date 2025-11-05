// src/contexts/AuthContext.jsx
import React, { createContext, useState, useEffect, useContext, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI, setGlobalAuthToken, clearAllTokens, isAuthenticated } from '../config/api';
import { useNotification } from './NotificationContext';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(null);
  const [error, setError] = useState(null);

  const { showSuccess, showError, showInfo } = useNotification();

  // Función helper para cargar perfil completo
  const loadUserProfile = useCallback(async () => {
    try {
      const profileDetail = await authAPI.getProfileDetail();
      setUserProfile(profileDetail);
      return profileDetail;
    } catch (err) {
      console.error('Error al cargar perfil completo:', err);
      return null;
    }
  }, []);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        if (isAuthenticated()) {
          const userInfo = await authAPI.getUserInfo();
          setUser(userInfo);
          setToken(localStorage.getItem('token') || localStorage.getItem('auth_token') || localStorage.getItem('authToken'));
          await loadUserProfile();
        }
      } catch (err) {
        console.error('Error al inicializar autenticación:', err);
        clearAllTokens();
      } finally {
        setLoading(false);
      }
    };
    initializeAuth();
  }, [loadUserProfile]);

  const login = useCallback(async (credentials) => {
    try {
      setLoading(true);
      setError(null);

      const result = await authAPI.login(credentials);

      // ✅ CORREGIDO: Aceptar tanto 'token' como 'key'
      const authToken = result?.token || result?.key;

      if (result?.success && authToken) {
        setToken(authToken);
        setGlobalAuthToken(authToken);
        const userInfo = await authAPI.getUserInfo();
        setUser(userInfo);
        await loadUserProfile();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadUserProfile]);

  // ============================================================================
  // 🆕 NUEVO MÉTODO: Establecer auth desde proveedor externo (Google, Facebook, etc)
  // ============================================================================
  const setAuthFromExternal = useCallback(async (authToken, userData) => {
    try {
      setLoading(true);
      setError(null);

      console.log('🔐 Estableciendo auth desde proveedor externo...');
      
      // Guardar token globalmente
      setToken(authToken);
      setGlobalAuthToken(authToken);

      // Si ya tenemos datos del usuario, usarlos directamente
      if (userData) {
        console.log('✅ Usando datos de usuario proporcionados:', userData);
        setUser(userData);
        await loadUserProfile();
        showSuccess(
          `¡Bienvenido ${userData.first_name || userData.username || 'Usuario'}!`,
          'Inicio de sesión exitoso'
        );
        return { success: true, user: userData };
      }

      // Si no, obtener datos del usuario del backend
      console.log('📡 Obteniendo datos del usuario del backend...');
      const userInfo = await authAPI.getUserInfo();
      setUser(userInfo);
      await loadUserProfile();
      showSuccess(
        `¡Bienvenido ${userInfo.first_name || userInfo.username || 'Usuario'}!`,
        'Inicio de sesión exitoso'
      );
      return { success: true, user: userInfo };

    } catch (err) {
      const errorMessage = err.message || 'Error al establecer autenticación';
      setError(errorMessage);
      console.error('❌ Error en setAuthFromExternal:', err);
      showError(errorMessage, 'Error de autenticación');
      
      // Limpiar tokens en caso de error
      clearAllTokens();
      setToken(null);
      setUser(null);
      
      return { success: false, message: errorMessage };
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadUserProfile]);

  // ============================================================================
  // GOOGLE LOGIN - CORREGIDO ✅
  // ============================================================================
  const googleLogin = useCallback(async (accessToken) => {
    try {
      setLoading(true);
      setError(null);

      console.log('🔍 Iniciando Google Login...');
      const result = await authAPI.googleLogin(accessToken);
      console.log('📦 Respuesta del backend:', result);

      // ✅ CORREGIDO: Múltiples formas de obtener el token
      // Prioridad: tokens.access > token > key
      const authToken = 
        result?.tokens?.access ||  // 🆕 Nuevo: soporte para tokens.access
        result?.token || 
        result?.key;

      console.log('🔑 Token extraído:', authToken);

      if (result?.success && authToken) {
        console.log('✅ Token recibido, estableciendo autenticación...');
        
        // 🆕 USAR EL NUEVO MÉTODO en lugar de setToken directamente
        const authResult = await setAuthFromExternal(authToken, result.user);
        
        if (authResult.success) {
          console.log('✅ Autenticación establecida correctamente');
          return { success: true, user: authResult.user };
        } else {
          throw new Error(authResult.message || 'Error al establecer autenticación');
        }
      }

      // Si no hay token pero la respuesta fue exitosa, mostrar info específica
      if (result?.success && !authToken) {
        console.error('⚠️ Backend respondió success=true pero no envió token');
        console.error('📦 Estructura completa de respuesta:', JSON.stringify(result, null, 2));
        const errorMessage = 'El servidor no devolvió un token de autenticación válido';
        setError(errorMessage);
        showError(errorMessage, 'Error de autenticación con Google');
        return { success: false, message: errorMessage };
      }

      const errorMessage = result?.message || result?.error || 'Error al autenticar con Google';
      setError(errorMessage);
      showError(errorMessage, 'Error de autenticación con Google');
      return { success: false, message: errorMessage };
    } catch (err) {
      const errorMessage = err.message || 'Error de conexión con Google';
      setError(errorMessage);
      console.error('❌ Error en Google login:', err);
      showError(errorMessage, 'Error de conexión');
      return { success: false, message: errorMessage };
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setAuthFromExternal]);

  const register = useCallback(async (userData) => {
    try {
      setLoading(true);
      setError(null);

      if (!userData.phone) {
        const errorMessage = 'El número de teléfono es requerido';
        setError(errorMessage);
        showError(errorMessage, 'Error en el registro');
        return { success: false, message: errorMessage };
      }

      if (!userData.accept_terms) {
        const errorMessage = 'Debe aceptar los términos y condiciones';
        setError(errorMessage);
        showError(errorMessage, 'Error en el registro');
        return { success: false, message: errorMessage };
      }

      const result = await authAPI.register(userData);

      // ✅ CORREGIDO: Aceptar tanto 'token' como 'key'
      const authToken = result?.token || result?.key;

      if (result?.success && authToken) {
        setToken(authToken);
        setGlobalAuthToken(authToken);
        const userInfo = await authAPI.getUserInfo();
        setUser(userInfo);
        await loadUserProfile();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadUserProfile]);

  const logout = useCallback(async () => {
    try {
      await authAPI.logout();
      showInfo('Has cerrado sesión correctamente. ¡Hasta pronto!', 'Sesión cerrada', { duration: 3000 });
    } catch (err) {
      console.error('Error en logout:', err);
      showError('Error al cerrar sesión en el servidor', 'Advertencia');
    } finally {
      clearAllTokens();
      setUser(null);
      setUserProfile(null);
      setToken(null);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const requestPasswordReset = useCallback(async (email) => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateProfile = useCallback(async (profileData) => {
    try {
      setLoading(true);
      setError(null);
      const updatedUser = await authAPI.updateProfile(profileData);
      setUser(updatedUser);
      await loadUserProfile();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadUserProfile]);

  const changePassword = useCallback(async (passwordData) => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isAdmin = useCallback(() =>
    user?.role === 'admin' || user?.is_admin === true || user?.is_staff === true || user?.is_superuser === true,
  [user]);

  const isUser = useCallback(() => user?.role === 'user' || (!isAdmin() && !!user), [user, isAdmin]);

  const hasPermission = useCallback((permission) => (isAdmin() ? true : user?.permissions?.includes(permission) || false), [user, isAdmin]);

  const hasRole = useCallback((role) => user?.role === role, [user]);

  const hasAcceptedTerms = useCallback(() => {
    return userProfile?.profile?.terms_accepted_at !== null && userProfile?.profile?.terms_accepted_at !== undefined;
  }, [userProfile]);

  const getUserPhone = useCallback(() => {
    return userProfile?.profile?.phone || '';
  }, [userProfile]);

  const getTermsAcceptedDate = useCallback(() => {
    return userProfile?.profile?.terms_accepted_at;
  }, [userProfile]);

  const clearError = useCallback(() => setError(null), []);

  const refreshUser = useCallback(async () => {
    try {
      if (isAuthenticated()) {
        const userInfo = await authAPI.getUserInfo();
        setUser(userInfo);
        await loadUserProfile();
        return userInfo;
      }
    } catch (err) {
      console.error('Error al refrescar usuario:', err);
      logout();
    }
  }, [logout, loadUserProfile]);

  const debugUserInfo = useCallback(() => {
    console.group('🔍 Debug User Info');
    console.log('User object:', user);
    console.log('User profile:', userProfile);
    console.log('User role:', user?.role);
    console.log('User phone:', getUserPhone());
    console.log('Terms accepted:', hasAcceptedTerms());
    console.log('Terms date:', getTermsAcceptedDate());
    console.log('Is admin (role):', user?.role === 'admin');
    console.log('Is admin (method):', user?.is_admin);
    console.log('Is staff:', user?.is_staff);
    console.log('Is superuser:', user?.is_superuser);
    console.log('Final isAdmin():', isAdmin());
    console.log('Final isUser():', isUser());
    console.log('Token present:', !!token);
    console.log('Is authenticated:', !!user);
    console.groupEnd();
    return { 
      user, 
      userProfile,
      role: user?.role, 
      phone: getUserPhone(),
      termsAccepted: hasAcceptedTerms(),
      isAdmin: isAdmin(), 
      isUser: isUser(), 
      hasToken: !!token, 
      isAuthenticated: !!user 
    };
  }, [user, userProfile, token, isAdmin, isUser, getUserPhone, hasAcceptedTerms, getTermsAcceptedDate]);

  const value = useMemo(() => ({
    // Estado
    user,
    userProfile,
    token,
    loading,
    error,

    // Métodos de autenticación
    login,
    googleLogin,
    register,
    logout,
    setAuthFromExternal, // 🆕 NUEVO: Para login externo sin peticiones duplicadas

    // Perfil
    updateProfile,
    changePassword,
    requestPasswordReset,
    loadUserProfile,

    // Verificaciones
    isAuthenticated: !!user,
    isAdmin: isAdmin(),
    isUser: isUser(),
    canCreateRoulettes: isAdmin() || user?.permissions?.includes('add_roulette') || false,
    canExecuteDraws: isAdmin() || user?.permissions?.includes('execute_draw') || false,
    canViewReports: isAdmin() || user?.permissions?.includes('view_reports') || false,

    hasPermission,
    hasRole,

    // Helpers para teléfono y términos
    hasAcceptedTerms: hasAcceptedTerms(),
    getUserPhone: getUserPhone(),
    getTermsAcceptedDate: getTermsAcceptedDate(),

    // Utilidades
    clearError,
    refreshUser,
    debugUserInfo,
  }), [
    user, 
    userProfile,
    token, 
    loading, 
    error, 
    login,
    googleLogin,
    register, 
    logout,
    setAuthFromExternal, // 🆕 Incluir en dependencias
    updateProfile, 
    changePassword, 
    requestPasswordReset,
    loadUserProfile,
    isAdmin,
    isUser,
    hasPermission, 
    hasRole, 
    hasAcceptedTerms,
    getUserPhone,
    getTermsAcceptedDate,
    clearError, 
    refreshUser, 
    debugUserInfo
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return context;
};

// Rutas protegidas
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
          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
            Sesión Requerida
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            Debes iniciar sesión para acceder a esta página.
          </p>
          <button
            onClick={() => navigate("/login")}
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