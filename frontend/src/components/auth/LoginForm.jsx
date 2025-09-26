// src/components/auth/LoginForm.jsx
import React from "react";
import { Sparkles, Eye, EyeOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import logo from "../../assets/HAYU24_original.png";

// Vistas hermanas
import RegisterForm from "./RegisterForm";
import PasswordResetForm from "./PasswordResetForm";

// Auth + Notificaciones
import { useAuth } from "../../contexts/AuthContext";
import { useAuthNotifications } from "../../contexts/NotificationContext";

const LoginForm = () => {
  const navigate = useNavigate();
  const { login, loading: authLoading, error: authError, clearError } = useAuth(); // AuthContext maneja estado global
  const { handleAuthError } = useAuthNotifications();

  const [currentView, setCurrentView] = React.useState("login");
  const [formData, setFormData] = React.useState({
    email: "",
    password: "",
    rememberMe: false,
  });
  const [showPassword, setShowPassword] = React.useState(false);
  const [error, setError] = React.useState("");

  const loading = authLoading; // usamos loading del contexto para bloquear UI

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
    if (error) setError("");
    if (authError) clearError?.();
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!formData.email || !formData.password) {
      setError("Por favor completa todos los campos");
      return;
    }

    try {
      // Llama al login del AuthContext (integra API + tokens + user + toasts)
      const result = await login({
        email: formData.email,
        password: formData.password,
        remember: formData.rememberMe,
      });

      if (result?.success) {
        navigate("/"); // Ajusta a tu ruta post-login (p.ej. "/dashboard")
      } else {
        setError(result?.message || "Credenciales inválidas");
      }
    } catch (err) {
      const msg = err?.message || "Error al iniciar sesión";
      setError(msg);
      handleAuthError(err, "inicio de sesión");
    }
  };

  const backToLogin = () => {
    setCurrentView("login");
    setError("");
    clearError?.();
  };

  if (currentView === "register") return <RegisterForm onBackToLogin={backToLogin} />;
  if (currentView === "reset")    return <PasswordResetForm onBackToLogin={backToLogin} />;

  return (
    <div className="w-full max-w-[min(420px,100%)] bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-6 sm:p-8 border border-white/20">
      {/* Cabecera con Logo */}
      <div className="text-center mb-8">
        <div className="mb-6">
          <img
            src={logo}
            alt="HAYU24 Logo"
            className="h-16 w-auto mx-auto object-contain rounded-lg"
            onError={(e) => {
              e.currentTarget.style.display = "none";
              e.currentTarget.parentElement.querySelector(".fallback-icon").style.display = "flex";
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

      {/* Errores */}
      {(error || authError) && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
          <p className="text-red-700 text-sm">{error || authError}</p>
        </div>
      )}

      {/* FORM LOGIN */}
      <form className="space-y-6" onSubmit={handleLogin}>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Correo electrónico</label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleInputChange}
            placeholder="tu@email.com"
            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#0b56a7] focus:ring-0 outline-none transition-all duration-200 text-gray-900 placeholder-gray-400 bg-gray-50 focus:bg-white"
            disabled={loading}
            required
            autoComplete="email"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Contraseña</label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              placeholder="••••••••••"
              className="w-full px-4 py-3 pr-12 rounded-xl border-2 border-gray-200 focus:border-[#0b56a7] focus:ring-0 outline-none transition-all duration-200 text-gray-900 placeholder-gray-400 bg-gray-50 focus:bg-white"
              disabled={loading}
              required
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#0b56a7] focus:outline-none"
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
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
              className="w-4 h-4 border-2 border-gray-300 rounded focus:ring-2"
              style={{ "--tw-ring-color": "#0b56a7", accentColor: "#0b56a7" }}
              disabled={loading}
            />
            <span className="ml-2 text-sm text-gray-600">Recordarme</span>
          </label>
          <button
            type="button"
            className="text-sm font-medium text-[#389fae] hover:text-[#2d7a85]"
            onClick={() => setCurrentView("reset")}
          >
            ¿Olvidaste tu contraseña?
          </button>
        </div>

        <button
          type="submit"
          disabled={loading || !formData.email || !formData.password}
          className="w-full text-white font-bold py-4 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl disabled:cursor-not-allowed disabled:bg-gray-400 transform hover:scale-[1.02] active:scale-[0.98] bg-[#0b56a7] hover:bg-[#094a91]"
        >
          {loading ? "Iniciando sesión..." : "Iniciar Sesión"}
        </button>

        <p className="text-center text-gray-600 text-sm">
          ¿No tienes cuenta?{" "}
          <button
            type="button"
            onClick={() => setCurrentView("register")}
            className="font-semibold text-[#389fae] hover:text-[#2d7a85]"
          >
            Regístrate gratis
          </button>
        </p>
      </form>
    </div>
  );
};

export default LoginForm;
