import React from "react";
import {
  Sparkles, Shield, Bell, Award, UserPlus, Key
} from "lucide-react";
import { useAuthNotifications } from "../contexts/NotificationContext";

// ✅ Usa tu API real (sin duplicar BaseAPI)
import { AuthAPI } from "../config/api"; // ← ya exporta AuthAPI, maneja tokens y errores

const authAPI = new AuthAPI();

const LoginForm = ({ onSubmit }) => {
  const [currentView, setCurrentView] = React.useState("login");
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

  // Notificaciones UI (toast/snackbar) desde tu contexto
  const {
    handleLoginSuccess,
    handleRegisterSuccess,
    handlePasswordResetSuccess,
    handleAuthError,
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
          password: formData.password,
        });
        if (result?.success && result?.token) {
          localStorage.setItem("authToken", result.token);
          if (result.user) localStorage.setItem("user", JSON.stringify(result.user));
          handleLoginSuccess(result);
          // Evita parpadeos: da tiempo al toast y luego recarga
          setTimeout(() => window.location.reload(), 1200);
        }
      }
    } catch (err) {
      const msg = err?.message || "Error al iniciar sesión";
      setError(msg);
      handleAuthError(err, "inicio de sesión");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();

    if (!formData.email || !formData.password || !formData.username || !formData.firstName || !formData.lastName) {
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
        last_name: formData.lastName,
      });

      if (result?.success) {
        handleRegisterSuccess(result);
        setFormData((prev) => ({
          ...prev,
          password: "",
          confirmPassword: "",
          username: "",
          firstName: "",
          lastName: "",
          rememberMe: false,
        }));
        setTimeout(() => setCurrentView("login"), 1200);
      }
    } catch (err) {
      const msg = err?.message || "Error al registrarse";
      setError(msg);
      handleAuthError(err, "registro");
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
      handlePasswordResetSuccess(formData.email);
      setTimeout(() => setCurrentView("login"), 1200);
    } catch (err) {
      const msg = err?.message || "Error al solicitar recuperación de contraseña";
      setError(msg);
      handleAuthError(err, "recuperación de contraseña");
    } finally {
      setLoading(false);
    }
  };

  // Header de la tarjeta (color sólido por vista)
  const header = React.useMemo(() => {
    switch (currentView) {
      case "register":
        return { title: "Crear Cuenta", sub: "Únete a nuestra plataforma", color: "#389fae", Icon: UserPlus };
      case "reset":
        return { title: "Recuperar Contraseña", sub: "Te ayudamos a recuperarla", color: "#4dc9b1", Icon: Key };
      default:
        return { title: "Iniciar Sesión", sub: "Accede a tu cuenta", color: "#0b56a7", Icon: Sparkles };
    }
  }, [currentView]);

  return (
    <div
      className="
        w-full
        max-w-[min(420px,100%)]
        bg-white/95 backdrop-blur-sm
        rounded-2xl shadow-2xl
        p-6 sm:p-8
        border border-white/20
      "
    >
      {/* Cabecera */}
      <div className="text-center mb-8">
        <div
          className="rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center shadow-lg"
          style={{ backgroundColor: header.color }}
        >
          <header.Icon className="h-8 w-8 text-white" />
        </div>
        <h2
          className="font-bold mb-2"
          style={{ color: "#0b56a7", fontSize: "clamp(1.25rem, 1vw + 1rem, 1.75rem)" }}
        >
          {header.title}
        </h2>
        <p className="text-gray-600" style={{ fontSize: "clamp(.9rem, .5vw + .7rem, 1rem)" }}>
          {header.sub}
        </p>
      </div>

      {/* Errores */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {/* VISTA: LOGIN */}
      {currentView === "login" && (
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
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#0b56a7] transition-colors"
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
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
                className="w-4 h-4 border-2 border-gray-300 rounded focus:ring-2"
                style={{ "--tw-ring-color": "#0b56a7", accentColor: "#0b56a7" }}
                disabled={loading}
              />
              <span className="ml-2 text-sm text-gray-600">Recordarme</span>
            </label>
            <button
              type="button"
              className="text-sm font-medium"
              style={{ color: "#4dc9b1" }}
              onClick={() => setCurrentView("reset")}
            >
              ¿Olvidaste tu contraseña?
            </button>
          </div>

          <button
            type="submit"
            disabled={loading || !formData.email || !formData.password}
            className="w-full text-white font-bold py-4 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98]"
            style={{ backgroundColor: loading || !formData.email || !formData.password ? "#9ca3af" : "#0b56a7" }}
          >
            {loading ? "Iniciando sesión..." : "Entrar ✨"}
          </button>

          <p className="text-center text-gray-600 text-sm">
            ¿No tienes cuenta?{" "}
            <button type="button" onClick={() => setCurrentView("register")} className="font-semibold" style={{ color: "#389fae" }}>
              Regístrate gratis
            </button>
          </p>
        </form>
      )}

      {/* VISTA: REGISTRO */}
      {currentView === "register" && (
        <form className="space-y-5" onSubmit={handleRegister}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Nombre</label>
              <input
                type="text"
                name="firstName"
                value={formData.firstName}
                onChange={handleInputChange}
                placeholder="Tu nombre"
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#389fae] focus:ring-0 outline-none transition-all duration-200 text-gray-900 placeholder-gray-400 bg-gray-50 focus:bg-white"
                disabled={loading}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Apellido</label>
              <input
                type="text"
                name="lastName"
                value={formData.lastName}
                onChange={handleInputChange}
                placeholder="Tu apellido"
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#389fae] focus:ring-0 outline-none transition-all duration-200 text-gray-900 placeholder-gray-400 bg-gray-50 focus:bg-white"
                disabled={loading}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Usuario</label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleInputChange}
              placeholder="usuario123"
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#389fae] focus:ring-0 outline-none transition-all duration-200 text-gray-900 placeholder-gray-400 bg-gray-50 focus:bg-white"
              disabled={loading}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Correo electrónico</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              placeholder="tu@email.com"
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#389fae] focus:ring-0 outline-none transition-all duration-200 text-gray-900 placeholder-gray-400 bg-gray-50 focus:bg-white"
              disabled={loading}
              required
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
                className="w-full px-4 py-3 pr-12 rounded-xl border-2 border-gray-200 focus:border-[#389fae] focus:ring-0 outline-none transition-all duration-200 text-gray-900 placeholder-gray-400 bg-gray-50 focus:bg-white"
                disabled={loading}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#389fae] transition-colors"
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showPassword ? "🙈" : "👁️"}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Confirmar contraseña</label>
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                placeholder="••••••••••"
                className="w-full px-4 py-3 pr-12 rounded-xl border-2 border-gray-200 focus:border-[#389fae] focus:ring-0 outline-none transition-all duration-200 text-gray-900 placeholder-gray-400 bg-gray-50 focus:bg-white"
                disabled={loading}
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((v) => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#389fae] transition-colors"
                aria-label={showConfirmPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showConfirmPassword ? "🙈" : "👁️"}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={
              loading ||
              !formData.email ||
              !formData.password ||
              !formData.username ||
              !formData.firstName ||
              !formData.lastName
            }
            className="w-full text-white font-bold py-4 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98]"
            style={{
              backgroundColor:
                loading ||
                !formData.email ||
                !formData.password ||
                !formData.username ||
                !formData.firstName ||
                !formData.lastName
                  ? "#9ca3af"
                  : "#389fae",
            }}
          >
            {loading ? "Creando cuenta..." : "Crear cuenta ✨"}
          </button>

          <p className="text-center text-gray-600 text-sm">
            ¿Ya tienes cuenta?{" "}
            <button type="button" onClick={() => setCurrentView("login")} className="font-semibold" style={{ color: "#0b56a7" }}>
              Inicia sesión
            </button>
          </p>
        </form>
      )}

      {/* VISTA: RECUPERACIÓN */}
      {currentView === "reset" && (
        <form className="space-y-6" onSubmit={handlePasswordReset}>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Correo electrónico</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              placeholder="tu@email.com"
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#4dc9b1] focus:ring-0 outline-none transition-all duration-200 text-gray-900 placeholder-gray-400 bg-gray-50 focus:bg-white"
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
            className="w-full text-white font-bold py-4 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98]"
            style={{ backgroundColor: loading || !formData.email ? "#9ca3af" : "#4dc9b1" }}
          >
            {loading ? "Enviando..." : "Enviar enlace ✨"}
          </button>

          <p className="text-center text-gray-600 text-sm">
            ¿Recordaste tu contraseña?{" "}
            <button type="button" onClick={() => setCurrentView("login")} className="font-semibold" style={{ color: "#0b56a7" }}>
              Volver al login
            </button>
          </p>
        </form>
      )}
    </div>
  );
};

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Fondo decorativo seguro (no genera scroll horizontal) */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-[10vh] left-[8vw] w-[22vmin] h-[22vmin] rounded-full blur-2xl opacity-20"
          style={{ backgroundColor: "#0b56a7" }}
        />
        <div
          className="absolute top-[18vh] right-[10vw] w-[28vmin] h-[28vmin] rounded-full blur-2xl opacity-20"
          style={{ backgroundColor: "#389fae" }}
        />
        <div
          className="absolute bottom-[10vh] left-1/3 w-[24vmin] h-[24vmin] rounded-full blur-2xl opacity-20"
          style={{ backgroundColor: "#4dc9b1" }}
        />
        <div
          className="absolute bottom-[18vh] right-[20vw] w-[20vmin] h-[20vmin] rounded-full blur-2xl opacity-20"
          style={{ backgroundColor: "#207ba8" }}
        />
      </div>

      <main className="relative z-10 mx-auto w-full max-w-[min(1200px,92vw)] px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
        {/* Header */}
        <header className="text-center mb-12 lg:mb-16">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="rounded-2xl p-3 shadow-lg" style={{ backgroundColor: "#0b56a7" }}>
              <Award className="h-8 w-8 text-white" />
            </div>
            <h1 className="font-bold" style={{ color: "#0b56a7", fontSize: "clamp(2rem, 3vw + 1rem, 3rem)" }}>
              LuckySpin
            </h1>
          </div>
          <p className="text-gray-600 mx-auto leading-relaxed"
             style={{ maxWidth: "60ch", fontSize: "clamp(1rem, .7vw + .9rem, 1.25rem)" }}>
            Sorteos transparentes y experiencias educativas.
            <span className="font-semibold" style={{ color: "#4dc9b1" }}> ¡Tu suerte te está esperando!</span>
          </p>
        </header>

        {/* Grid principal */}
        <section className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-start max-w-[min(1200px,100%)] mx-auto">
          {/* Información izquierda */}
          <div className="space-y-8">
            <div>
              <h2 className="text-gray-900 mb-6 leading-tight"
                  style={{ fontWeight: 800, fontSize: "clamp(1.75rem, 2vw + 1rem, 2.5rem)" }}>
                Bienvenido a tu
                <span className="block" style={{ color: "#207ba8" }}>
                  plataforma de sorteos
                </span>
              </h2>
              <p className="text-gray-600 leading-relaxed mb-8" style={{ fontSize: "clamp(1rem, .6vw + .9rem, 1.125rem)" }}>
                Únete a miles de usuarios que ya disfrutan de sorteos justos,
                verificables y completamente transparentes.
              </p>
            </div>

            {/* Características */}
            <div className="grid gap-4">
              <FeatureCard color="#0b56a7" Icon={Shield} title="100% Transparente" sub="Verifica todos los resultados" />
              <FeatureCard color="#389fae" Icon={Bell} title="Notificaciones Instantáneas" sub="Recibe alertas al momento" />
              <FeatureCard color="#4dc9b1" Icon={Sparkles} title="Experiencia Premium" sub="Interfaz moderna y fluida" />
            </div>

            <div className="rounded-2xl p-6 border"
                 style={{ borderColor: "#207ba8", backgroundColor: "rgba(32,123,168,0.06)" }}>
              <p className="font-medium text-center" style={{ color: "#0b56a7" }}>
                🎉 ¡Más de <span className="font-bold">10,000 usuarios</span> ya confían en nosotros!
              </p>
            </div>
          </div>

          {/* Formulario derecha */}
          <div className="flex justify-center">
            <LoginForm />
          </div>
        </section>

        {/* Footer */}
        <footer className="text-center mt-16 text-gray-500 text-sm">
          <p>© {new Date().getFullYear()} LuckySpin - Sorteos seguros y transparentes</p>
        </footer>
      </main>
    </div>
  );
}

const FeatureCard = ({ color, Icon, title, sub }) => (
  <div className="flex items-center gap-4 p-4 bg-white/70 backdrop-blur-sm rounded-xl border border-white/30">
    <div className="rounded-lg p-2 shrink-0" style={{ backgroundColor: color }}>
      <Icon className="h-5 w-5 text-white" />
    </div>
    <div className="min-w-0">
      <h3 className="font-semibold text-gray-900">{title}</h3>
      <p className="text-sm text-gray-600">{sub}</p>
    </div>
  </div>
);
