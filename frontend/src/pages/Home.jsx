import React from "react";
import { Sparkles, Shield, Bell, Award, UserPlus, Key } from "lucide-react";
import { useAuthNotifications } from '../contexts/NotificationContext';

// Usando tu API real
const API_URL = "http://localhost:8000/api";

// Token storage helpers de tu API
const LEGACY_KEYS = ["token", "auth_token", "authToken"];

const readAnyToken = () => {
  for (const k of LEGACY_KEYS) {
    const v = localStorage.getItem(k);
    if (v) return v;
  }
  return null;
};

const writeAllTokens = (token) => {
  for (const k of LEGACY_KEYS) {
    if (token) localStorage.setItem(k, token);
    else localStorage.removeItem(k);
  }
};

// Base API class de tu implementación
class BaseAPI {
  constructor(baseURL = API_URL, authToken = null) {
    this.baseURL = baseURL;
    this.authToken = authToken || readAnyToken();
  }

  setAuthToken(token) {
    this.authToken = token || null;
    writeAllTokens(token || null);
  }

  getHeaders(isMultipart = false) {
    const token = this.authToken || readAnyToken();
    const headers = { Accept: "application/json" };
    if (token) headers["Authorization"] = `Token ${token}`;
    if (!isMultipart) headers["Content-Type"] = "application/json";
    return headers;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const requestOptions = {
      method: options.method || "GET",
      headers: this.getHeaders(options.isMultipart),
      body: options.body,
      signal: options.signal,
    };

    try {
      const res = await fetch(url, requestOptions);

      if (!res.ok) {
        let data = {};
        try { data = await res.json(); } catch (_) {}

        const backendMessage =
          data?.message
          || (Array.isArray(data?.non_field_errors) && data.non_field_errors.join(", "))
          || (typeof data?.detail === "string" && data.detail)
          || (data?.errors && JSON.stringify(data.errors))
          || null;

        if (res.status === 401) {
          this.setAuthToken(null);
          throw new Error(backendMessage || "Sesión expirada. Inicia sesión de nuevo.");
        }

        if (res.status === 403) {
          throw new Error(backendMessage || "No tienes permisos para realizar esta acción.");
        }

        if (res.status === 404) {
          throw new Error(backendMessage || "Recurso no encontrado.");
        }

        throw new Error(backendMessage || `HTTP ${res.status}: ${res.statusText}`);
      }

      if (res.status === 204) return null;
      return await res.json();
    } catch (err) {
      console.error(`API Error [${endpoint}]`, err);
      throw err;
    }
  }
}

// Auth API de tu implementación
class AuthAPI extends BaseAPI {
  constructor() { super(API_URL); }

  async login(credentials) {
    const result = await this.request("/auth/login/", {
      method: "POST",
      body: JSON.stringify(credentials)
    });
    if (result?.success && result?.token) this.setAuthToken(result.token);
    return result;
  }

  async register(data) {
    const result = await this.request("/auth/register/", {
      method: "POST",
      body: JSON.stringify(data)
    });
    if (result?.success && result?.token) this.setAuthToken(result.token);
    return result;
  }

  async requestPasswordReset(email) {
    return this.request("/auth/password-reset/request/", {
      method: "POST",
      body: JSON.stringify({ email })
    });
  }
}

const authAPI = new AuthAPI();

const LoginForm = ({ onSubmit }) => {
  const [currentView, setCurrentView] = React.useState('login');
  const [formData, setFormData] = React.useState({
    email: "",
    password: "",
    confirmPassword: "",
    username: "",
    firstName: "",
    lastName: "",
    rememberMe: false,
  });
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  
  // Usar las notificaciones de autenticación
  const { 
    handleLoginSuccess, 
    handleRegisterSuccess, 
    handlePasswordResetSuccess, 
    handleAuthError 
  } = useAuthNotifications();

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
    if (error) setError("");
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!formData.email || !formData.password) {
      setError("Por favor completa todos los campos");
      return;
    }
    
    try {
      setLoading(true);
      setError("");
      
      if (onSubmit) {
        await onSubmit(formData);
      } else {
        const result = await authAPI.login({
          email: formData.email,
          password: formData.password
        });
        
        if (result.success && result.token) {
          localStorage.setItem('authToken', result.token);
          localStorage.setItem('user', JSON.stringify(result.user));
          
          // Mostrar notificación de éxito
          handleLoginSuccess(result);
          
          setTimeout(() => {
            window.location.reload();
          }, 2000);
        }
      }
    } catch (err) {
      setError(err.message || "Error al iniciar sesión");
      handleAuthError(err, 'inicio de sesión');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    
    if (!formData.email || !formData.password || !formData.username || 
        !formData.firstName || !formData.lastName) {
      setError("Por favor completa todos los campos");
      return;
    }
    
    if (formData.password !== formData.confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }
    
    if (formData.password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres");
      return;
    }
    
    try {
      setLoading(true);
      setError("");
      
      const result = await authAPI.register({
        username: formData.username,
        email: formData.email,
        password: formData.password,
        password_confirm: formData.confirmPassword,
        first_name: formData.firstName,
        last_name: formData.lastName
      });
      
      if (result.success) {
        // Mostrar notificación de éxito
        handleRegisterSuccess(result);
        
        setFormData({
          email: formData.email,
          password: "",
          confirmPassword: "",
          username: "",
          firstName: "",
          lastName: "",
          rememberMe: false,
        });
        setTimeout(() => {
          setCurrentView('login');
        }, 3000);
      }
    } catch (err) {
      setError(err.message || "Error al registrarse");
      handleAuthError(err, 'registro');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    
    if (!formData.email) {
      setError("Por favor ingresa tu correo electrónico");
      return;
    }
    
    try {
      setLoading(true);
      setError("");
      
      await authAPI.requestPasswordReset(formData.email);
      
      // Mostrar notificación de éxito
      handlePasswordResetSuccess(formData.email);
      
      setTimeout(() => {
        setCurrentView('login');
      }, 4000);
    } catch (err) {
      setError(err.message || "Error al solicitar recuperación de contraseña");
      handleAuthError(err, 'recuperación de contraseña');
    } finally {
      setLoading(false);
    }
  };

  const getHeaderIcon = () => {
    switch (currentView) {
      case 'register': return <UserPlus className="h-8 w-8 text-white" />;
      case 'reset': return <Key className="h-8 w-8 text-white" />;
      default: return <Sparkles className="h-8 w-8 text-white" />;
    }
  };

  const getHeaderTitle = () => {
    switch (currentView) {
      case 'register': return 'Crear Cuenta';
      case 'reset': return 'Recuperar Contraseña';
      default: return 'Iniciar Sesión';
    }
  };

  const getHeaderSubtitle = () => {
    switch (currentView) {
      case 'register': return 'Únete a nuestra plataforma';
      case 'reset': return 'Te ayudamos a recuperarla';
      default: return 'Accede a tu cuenta';
    }
  };

  return (
    <div className="w-full max-w-md bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8 border border-white/20">
      <div className="text-center mb-8">
        <div className="bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center shadow-lg transition-all duration-300">
          {getHeaderIcon()}
        </div>
        <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-900 via-purple-900 to-pink-900 bg-clip-text text-transparent mb-2">
          {getHeaderTitle()}
        </h2>
        <p className="text-gray-600">{getHeaderSubtitle()}</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {/* Vista Login */}
      {currentView === 'login' && (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Correo electrónico
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              placeholder="tu@email.com"
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:ring-0 outline-none transition-all duration-200 text-gray-900 placeholder-gray-400 bg-gray-50 focus:bg-white"
              disabled={loading}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Contraseña
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                placeholder="••••••••••"
                className="w-full px-4 py-3 pr-12 rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:ring-0 outline-none transition-all duration-200 text-gray-900 placeholder-gray-400 bg-gray-50 focus:bg-white"
                disabled={loading}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-purple-600 transition-colors"
              >
                {showPassword ? "🙈" : "👁️"}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center">
              <input
                type="checkbox"
                name="rememberMe"
                checked={formData.rememberMe}
                onChange={handleInputChange}
                className="w-4 h-4 text-purple-600 border-2 border-gray-300 rounded focus:ring-purple-500"
                disabled={loading}
              />
              <span className="ml-2 text-sm text-gray-600">Recordarme</span>
            </label>
            <button
              type="button"
              className="text-sm text-purple-600 hover:text-purple-800 font-medium"
              onClick={() => setCurrentView('reset')}
            >
              ¿Olvidaste tu contraseña?
            </button>
          </div>

          <button
            onClick={handleLogin}
            disabled={loading || !formData.email || !formData.password}
            className="w-full bg-gradient-to-r from-purple-600 via-pink-600 to-orange-600 hover:from-purple-700 hover:via-pink-700 hover:to-orange-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-bold py-4 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98]"
          >
            {loading ? "Iniciando sesión..." : "Entrar ✨"}
          </button>

          <p className="text-center text-gray-600 text-sm">
            ¿No tienes cuenta?{" "}
            <button
              type="button"
              onClick={() => setCurrentView('register')}
              className="text-purple-600 hover:text-purple-800 font-semibold"
            >
              Regístrate gratis
            </button>
          </p>
        </div>
      )}

      {/* Vista Registro */}
      {currentView === 'register' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Nombre
              </label>
              <input
                type="text"
                name="firstName"
                value={formData.firstName}
                onChange={handleInputChange}
                placeholder="Tu nombre"
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:ring-0 outline-none transition-all duration-200 text-gray-900 placeholder-gray-400 bg-gray-50 focus:bg-white"
                disabled={loading}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Apellido
              </label>
              <input
                type="text"
                name="lastName"
                value={formData.lastName}
                onChange={handleInputChange}
                placeholder="Tu apellido"
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:ring-0 outline-none transition-all duration-200 text-gray-900 placeholder-gray-400 bg-gray-50 focus:bg-white"
                disabled={loading}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Usuario
            </label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleInputChange}
              placeholder="usuario123"
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:ring-0 outline-none transition-all duration-200 text-gray-900 placeholder-gray-400 bg-gray-50 focus:bg-white"
              disabled={loading}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Correo electrónico
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              placeholder="tu@email.com"
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:ring-0 outline-none transition-all duration-200 text-gray-900 placeholder-gray-400 bg-gray-50 focus:bg-white"
              disabled={loading}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Contraseña
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                placeholder="••••••••••"
                className="w-full px-4 py-3 pr-12 rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:ring-0 outline-none transition-all duration-200 text-gray-900 placeholder-gray-400 bg-gray-50 focus:bg-white"
                disabled={loading}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-purple-600 transition-colors"
              >
                {showPassword ? "🙈" : "👁️"}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Confirmar contraseña
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                placeholder="••••••••••"
                className="w-full px-4 py-3 pr-12 rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:ring-0 outline-none transition-all duration-200 text-gray-900 placeholder-gray-400 bg-gray-50 focus:bg-white"
                disabled={loading}
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-purple-600 transition-colors"
              >
                {showConfirmPassword ? "🙈" : "👁️"}
              </button>
            </div>
          </div>

          <button
            onClick={handleRegister}
            disabled={loading || !formData.email || !formData.password || !formData.username || !formData.firstName || !formData.lastName}
            className="w-full bg-gradient-to-r from-purple-600 via-pink-600 to-orange-600 hover:from-purple-700 hover:via-pink-700 hover:to-orange-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-bold py-4 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98]"
          >
            {loading ? "Creando cuenta..." : "Crear cuenta ✨"}
          </button>

          <p className="text-center text-gray-600 text-sm">
            ¿Ya tienes cuenta?{" "}
            <button
              type="button"
              onClick={() => setCurrentView('login')}
              className="text-purple-600 hover:text-purple-800 font-semibold"
            >
              Inicia sesión
            </button>
          </p>
        </div>
      )}

      {/* Vista Recuperación */}
      {currentView === 'reset' && (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Correo electrónico
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              placeholder="tu@email.com"
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:ring-0 outline-none transition-all duration-200 text-gray-900 placeholder-gray-400 bg-gray-50 focus:bg-white"
              disabled={loading}
              required
            />
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-blue-700 text-sm">
              Te enviaremos un enlace para restablecer tu contraseña al correo electrónico proporcionado.
            </p>
          </div>

          <button
            onClick={handlePasswordReset}
            disabled={loading || !formData.email}
            className="w-full bg-gradient-to-r from-purple-600 via-pink-600 to-orange-600 hover:from-purple-700 hover:via-pink-700 hover:to-orange-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-bold py-4 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98]"
          >
            {loading ? "Enviando..." : "Enviar enlace ✨"}
          </button>

          <p className="text-center text-gray-600 text-sm">
            ¿Recordaste tu contraseña?{" "}
            <button
              type="button"
              onClick={() => setCurrentView('login')}
              className="text-purple-600 hover:text-purple-800 font-semibold"
            >
              Volver al login
            </button>
          </p>
        </div>
      )}
    </div>
  );
};

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50">
      {/* Elementos decorativos de fondo */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-20 w-32 h-32 bg-purple-200/30 rounded-full blur-xl"></div>
        <div className="absolute top-40 right-32 w-48 h-48 bg-pink-200/30 rounded-full blur-xl"></div>
        <div className="absolute bottom-20 left-1/3 w-40 h-40 bg-orange-200/30 rounded-full blur-xl"></div>
      </div>

      <main className="relative z-10 container mx-auto px-6 py-12">
        {/* Header mejorado */}
        <header className="text-center mb-16">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 rounded-2xl p-3 shadow-lg">
              <Award className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-5xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-orange-600 bg-clip-text text-transparent">
              LuckySpin
            </h1>
          </div>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
            Sorteos transparentes y experiencias educativas. 
            <span className="text-purple-600 font-semibold"> ¡Tu suerte te está esperando!</span>
          </p>
        </header>

        {/* Grid principal */}
        <section className="grid lg:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
          {/* Información izquierda */}
          <div className="space-y-8">
            <div>
              <h2 className="text-4xl font-bold text-gray-900 mb-6 leading-tight">
                Bienvenido a tu
                <span className="block bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  plataforma de sorteos
                </span>
              </h2>
              <p className="text-lg text-gray-600 leading-relaxed mb-8">
                Únete a miles de usuarios que ya disfrutan de sorteos justos, 
                verificables y completamente transparentes.
              </p>
            </div>

            {/* Características destacadas */}
            <div className="grid gap-4">
              <div className="flex items-center gap-4 p-4 bg-white/60 backdrop-blur-sm rounded-xl border border-white/20">
                <div className="bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg p-2">
                  <Shield className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">100% Transparente</h3>
                  <p className="text-sm text-gray-600">Verifica todos los resultados</p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 bg-white/60 backdrop-blur-sm rounded-xl border border-white/20">
                <div className="bg-gradient-to-br from-pink-500 to-orange-500 rounded-lg p-2">
                  <Bell className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Notificaciones Instantáneas</h3>
                  <p className="text-sm text-gray-600">Recibe alertas al momento</p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 bg-white/60 backdrop-blur-sm rounded-xl border border-white/20">
                <div className="bg-gradient-to-br from-orange-500 to-purple-500 rounded-lg p-2">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Experiencia Premium</h3>
                  <p className="text-sm text-gray-600">Interface moderna y fluida</p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-purple-100 to-pink-100 rounded-2xl p-6 border border-purple-200">
              <p className="text-purple-800 font-medium text-center">
                🎉 ¡Más de <span className="font-bold">10,000 usuarios</span> ya confían en nosotros!
              </p>
            </div>
          </div>

          {/* Formulario derecha */}
          <div className="flex justify-center">
            <LoginForm />
          </div>
        </section>

        {/* Footer decorativo */}
        <footer className="text-center mt-20 text-gray-500 text-sm">
          <p>© 2024 LuckySpin - Sorteos seguros y transparentes</p>
        </footer>
      </main>
    </div>
  );
}