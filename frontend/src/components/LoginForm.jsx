// src/components/LoginForm.jsx - SIMPLIFICADO usando AuthContext
import React, { useState } from "react";
import { Eye, EyeOff, Sparkles, UserPlus, Key } from "lucide-react";
import { useAuth } from '../contexts/AuthContext'; // Usar AuthContext

const LoginForm = () => {
  const [currentView, setCurrentView] = useState('login');
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    username: "",
    firstName: "",
    lastName: "",
    rememberMe: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Usar AuthContext en lugar de lógica propia
  const { login, register, requestPasswordReset, loading, error, clearError } = useAuth();

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
    if (error) clearError();
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!formData.email || !formData.password) {
      return;
    }
    
    // El AuthContext se encarga de las notificaciones y redireccionamiento
    await login({
      email: formData.email,
      password: formData.password
    });
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    
    if (!formData.email || !formData.password || !formData.username || 
        !formData.firstName || !formData.lastName) {
      return;
    }
    
    if (formData.password !== formData.confirmPassword) {
      return;
    }
    
    if (formData.password.length < 8) {
      return;
    }
    
    // El AuthContext se encarga de las notificaciones y redireccionamiento
    const result = await register({
      username: formData.username,
      email: formData.email,
      password: formData.password,
      password_confirm: formData.confirmPassword,
      first_name: formData.firstName,
      last_name: formData.lastName
    });

    // Si el registro fue exitoso, el AuthContext ya manejó todo
    // Opcional: limpiar formulario si quieres mantener en vista de login
    if (!result.success) {
      // Solo limpiar campos de contraseña si hay error
      setFormData(prev => ({
        ...prev,
        password: "",
        confirmPassword: "",
      }));
    }
  };

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    
    if (!formData.email) {
      return;
    }
    
    const result = await requestPasswordReset(formData.email);
    
    if (result.success) {
      // Volver al login después de 3 segundos
      setTimeout(() => {
        setCurrentView('login');
      }, 3000);
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
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50">
      {/* Elementos decorativos de fondo */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-20 w-32 h-32 bg-purple-200/30 rounded-full blur-xl"></div>
        <div className="absolute top-40 right-32 w-48 h-48 bg-pink-200/30 rounded-full blur-xl"></div>
        <div className="absolute bottom-20 left-1/3 w-40 h-40 bg-orange-200/30 rounded-full blur-xl"></div>
      </div>

      <main className="relative z-10 container mx-auto px-6 py-12">
        {/* Header */}
        <header className="text-center mb-16">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 rounded-2xl p-3 shadow-lg">
              <Sparkles className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-5xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-orange-600 bg-clip-text text-transparent">
              Sistema de Ruletas
            </h1>
          </div>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
            Participa en sorteos transparentes y gana premios increíbles.
          </p>
        </header>

        {/* Formulario centrado */}
        <div className="flex justify-center">
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

            {/* Mostrar error del contexto */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}

            {/* Vista Login */}
            {currentView === 'login' && (
              <form onSubmit={handleLogin} className="space-y-6">
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
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
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
                  type="submit"
                  disabled={loading || !formData.email || !formData.password}
                  className="w-full bg-gradient-to-r from-purple-600 via-pink-600 to-orange-600 hover:from-purple-700 hover:via-pink-700 hover:to-orange-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-bold py-4 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  {loading ? "Iniciando sesión..." : "Entrar"}
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
              </form>
            )}

            {/* Vista Registro */}
            {currentView === 'register' && (
              <form onSubmit={handleRegister} className="space-y-5">
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
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
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
                      {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !formData.email || !formData.password || !formData.username || !formData.firstName || !formData.lastName}
                  className="w-full bg-gradient-to-r from-purple-600 via-pink-600 to-orange-600 hover:from-purple-700 hover:via-pink-700 hover:to-orange-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-bold py-4 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  {loading ? "Creando cuenta..." : "Crear cuenta"}
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
              </form>
            )}

            {/* Vista Recuperación */}
            {currentView === 'reset' && (
              <form onSubmit={handlePasswordReset} className="space-y-6">
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
                  type="submit"
                  disabled={loading || !formData.email}
                  className="w-full bg-gradient-to-r from-purple-600 via-pink-600 to-orange-600 hover:from-purple-700 hover:via-pink-700 hover:to-orange-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-bold py-4 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  {loading ? "Enviando..." : "Enviar enlace"}
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
              </form>
            )}
          </div>
        </div>

        {/* Footer */}
        <footer className="text-center mt-20 text-gray-500 text-sm">
          <p>© 2024 Sistema de Ruletas - Sorteos seguros y transparentes</p>
        </footer>
      </main>
    </div>
  );
};

export default LoginForm;