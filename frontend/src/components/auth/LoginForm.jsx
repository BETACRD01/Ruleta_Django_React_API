// src/components/auth/LoginForm.jsx
import React, { useState, useCallback } from "react";
import { Sparkles, Eye, EyeOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import logo from "../../assets/HAYU24_original.png";

// Componentes
import GoogleLoginButton from "./GoogleLoginButton";
import RegisterForm from "./RegisterForm";
import PasswordResetForm from "./PasswordResetForm";

// Contextos
import { useAuth } from "../../contexts/AuthContext";
import { useNotification } from "../../contexts/NotificationContext";

// ============================================================================
// CONSTANTES
// ============================================================================
const VIEWS = {
  LOGIN: "login",
  REGISTER: "register",
  RESET: "reset"
};

const INITIAL_FORM_STATE = {
  email: "",
  password: "",
  rememberMe: false
};

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================
const LoginForm = () => {
  // ---------------------------------------------------------------------------
  // HOOKS Y ESTADO
  // ---------------------------------------------------------------------------
  const navigate = useNavigate();
  const { 
    login, 
    googleLogin, 
    loading: authLoading, 
    error: authError, 
    clearError 
  } = useAuth();
  const { showError } = useNotification();

  const [currentView, setCurrentView] = useState(VIEWS.LOGIN);
  const [formData, setFormData] = useState(INITIAL_FORM_STATE);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  // Solo deshabilitar campos si hay cualquier tipo de carga
  const isAnyLoading = authLoading || googleLoading || formLoading;

  // ---------------------------------------------------------------------------
  // MANEJADORES DE FORMULARIO
  // ---------------------------------------------------------------------------
  const handleInputChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));
    
    // Limpiar errores al escribir
    if (error) setError("");
    if (authError) clearError?.();
  }, [error, authError, clearError]);

  const resetForm = useCallback(() => {
    setFormData(INITIAL_FORM_STATE);
    setError("");
    clearError?.();
  }, [clearError]);

  // ---------------------------------------------------------------------------
  // LOGIN TRADICIONAL
  // ---------------------------------------------------------------------------
  const handleLogin = async (e) => {
    e.preventDefault();
    
    // Validación
    if (!formData.email || !formData.password) {
      setError("Por favor completa todos los campos");
      return;
    }

    try {
      setFormLoading(true);
      const result = await login({
        email: formData.email,
        password: formData.password,
        remember: formData.rememberMe,
      });

      if (result?.success) {
        navigate("/", { replace: true });
      } else {
        setError(result?.message || "Credenciales inválidas");
      }
    } catch (err) {
      console.error("Error en login:", err);
      const msg = err?.message || "Error al iniciar sesión";
      setError(msg);
    } finally {
      setFormLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // LOGIN CON GOOGLE - CORREGIDO ✅
  // ---------------------------------------------------------------------------
  const handleGoogleSuccess = async (accessToken) => {
    try {
      setGoogleLoading(true);
      setError("");
      
      console.log('🔍 Iniciando Google Login desde LoginForm...');
      
      // 🆕 USAR EL MÉTODO googleLogin DEL CONTEXTO
      // Este método ya maneja todo internamente sin duplicar peticiones
      const result = await googleLogin(accessToken);
      
      if (result?.success) {
        console.log('✅ Google login exitoso, redirigiendo...');
        // Redirigir inmediatamente sin setTimeout
        navigate("/", { replace: true });
      } else {
        throw new Error(result?.message || "Error en autenticación con Google");
      }
      
    } catch (err) {
      console.error("❌ Error en Google Login:", err);
      const errorMsg = err.message || "Error de conexión. Por favor intenta nuevamente.";
      setError(errorMsg);
      showError?.(errorMsg, "Error de autenticación con Google");
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleGoogleError = useCallback((error) => {
    console.error("❌ Error en Google OAuth:", error);
    const errorMsg = "No se pudo conectar con Google. Por favor intenta nuevamente.";
    setError(errorMsg);
    showError?.(errorMsg, "Error de Google OAuth");
    setGoogleLoading(false);
  }, [showError]);

  // ---------------------------------------------------------------------------
  // NAVEGACIÓN ENTRE VISTAS
  // ---------------------------------------------------------------------------
  const backToLogin = useCallback(() => {
    setCurrentView(VIEWS.LOGIN);
    resetForm();
  }, [resetForm]);

  // ---------------------------------------------------------------------------
  // RENDERIZADO CONDICIONAL DE VISTAS
  // ---------------------------------------------------------------------------
  if (currentView === VIEWS.REGISTER) {
    return <RegisterForm onBackToLogin={backToLogin} />;
  }
  
  if (currentView === VIEWS.RESET) {
    return <PasswordResetForm onBackToLogin={backToLogin} />;
  }

  // ---------------------------------------------------------------------------
  // RENDER PRINCIPAL
  // ---------------------------------------------------------------------------
  return (
    <div className="w-full max-w-[min(420px,100%)] bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-6 sm:p-8 border border-white/20">
      
      {/* HEADER CON LOGO */}
      <div className="text-center mb-8">
        <div className="mb-6">
          <img
            src={logo}
            alt="HAYU24 Logo"
            className="h-16 w-auto mx-auto object-contain rounded-lg"
            onError={(e) => {
              e.currentTarget.style.display = "none";
              e.currentTarget.nextElementSibling.style.display = "flex";
            }}
          />
          <div className="fallback-icon rounded-full p-4 w-16 h-16 mx-auto items-center justify-center shadow-lg hidden bg-[#0b56a7]">
            <Sparkles className="h-8 w-8 text-white" />
          </div>
        </div>
        <p className="text-gray-600" style={{ fontSize: "clamp(.9rem, .5vw + .7rem, 1rem)" }}>
          Accede a tu cuenta
        </p>
      </div>

      {/* MENSAJES DE ERROR */}
      {(error || authError) && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
          <p className="text-red-700 text-sm">{error || authError}</p>
        </div>
      )}

      {/* FORMULARIO DE LOGIN */}
      <form className="space-y-6" onSubmit={handleLogin}>
        
        {/* CAMPO EMAIL */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Correo electrónico
          </label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleInputChange}
            placeholder="usuario@example.com"
            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#0b56a7] focus:ring-0 outline-none transition-all duration-200 text-gray-900 placeholder-gray-400 bg-gray-50 focus:bg-white"
            disabled={isAnyLoading}
            required
            autoComplete="email"
          />
        </div>

        {/* CAMPO CONTRASEÑA */}
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
              className="w-full px-4 py-3 pr-12 rounded-xl border-2 border-gray-200 focus:border-[#0b56a7] focus:ring-0 outline-none transition-all duration-200 text-gray-900 placeholder-gray-400 bg-gray-50 focus:bg-white"
              disabled={isAnyLoading}
              required
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#0b56a7] focus:outline-none transition-colors"
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              disabled={isAnyLoading}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* RECORDARME Y RECUPERAR CONTRASEÑA */}
        <div className="flex items-center justify-between">
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              name="rememberMe"
              checked={formData.rememberMe}
              onChange={handleInputChange}
              className="w-4 h-4 border-2 border-gray-300 rounded focus:ring-2"
              style={{ "--tw-ring-color": "#0b56a7", accentColor: "#0b56a7" }}
              disabled={isAnyLoading}
            />
            <span className="ml-2 text-sm text-gray-600">Recordarme</span>
          </label>
          <button
            type="button"
            className="text-sm font-medium text-[#389fae] hover:text-[#2d7a85] disabled:opacity-50 transition-colors"
            onClick={() => setCurrentView(VIEWS.RESET)}
            disabled={isAnyLoading}
          >
            ¿Olvidaste tu contraseña?
          </button>
        </div>

        {/* BOTÓN SUBMIT */}
        <button
          type="submit"
          disabled={formLoading || !formData.email || !formData.password}
          className="w-full text-white font-bold py-4 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl disabled:cursor-not-allowed disabled:bg-gray-400 transform hover:scale-[1.02] active:scale-[0.98] bg-[#0b56a7] hover:bg-[#094a91]"
        >
          {formLoading ? "Iniciando sesión..." : "Iniciar Sesión"}
        </button>

        {/* DIVISOR */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-white text-gray-500 font-medium">O continúa con</span>
          </div>
        </div>

        {/* BOTÓN GOOGLE */}
        <GoogleLoginButton
          onSuccess={handleGoogleSuccess}
          onError={handleGoogleError}
          loading={googleLoading}
        />

        {/* LINK A REGISTRO */}
        <p className="text-center text-gray-600 text-sm">
          ¿No tienes cuenta?{" "}
          <button
            type="button"
            onClick={() => setCurrentView(VIEWS.REGISTER)}
            className="font-semibold text-[#389fae] hover:text-[#2d7a85] disabled:opacity-50 transition-colors"
            disabled={isAnyLoading}
          >
            Regístrate gratis
          </button>
        </p>
      </form>
    </div>
  );
};

export default LoginForm;