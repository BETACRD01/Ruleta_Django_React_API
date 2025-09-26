// src/components/auth/RegisterForm.jsx
import React from "react";
import { UserPlus, Phone, FileCheck, ExternalLink, Eye, EyeOff } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthNotifications } from "../../contexts/NotificationContext";
import { useAuth } from "../../contexts/AuthContext";
import { AuthAPI } from "../../config/api";
// ⬇️ Importa el util .js (sin JSX)
import { validatePhone } from "./utils/phoneValidation";

const authAPI = new AuthAPI();

const RegisterForm = ({ onBackToLogin }) => {
  const navigate = useNavigate();
  const { login: ctxLogin } = useAuth() || {};

  // Fallback seguro para volver al login
  const goBackToLogin = React.useCallback(() => {
    if (typeof onBackToLogin === "function") onBackToLogin();
    else navigate("/login");
  }, [onBackToLogin, navigate]);

  const [formData, setFormData] = React.useState({
    email: "",
    password: "",
    confirmPassword: "",
    username: "",
    firstName: "",
    lastName: "",
    phone: "",
    accept_terms: false,
  });
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [phoneError, setPhoneError] = React.useState("");
  const [suggestedPhone, setSuggestedPhone] = React.useState("");

  const { handleRegisterSuccess, handleAuthError } =
    useAuthNotifications() || { handleRegisterSuccess: () => {}, handleAuthError: () => {} };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
    if (error) setError("");
    if (name === "phone") {
      setPhoneError("");
      setSuggestedPhone("");
    }
  };

  const applySuggestion = () => {
    if (!suggestedPhone) return;
    setFormData((prev) => ({ ...prev, phone: suggestedPhone }));
    setPhoneError("");
    setSuggestedPhone("");
  };

  const handleRegister = async (e) => {
    e.preventDefault();

    // Validaciones básicas
    const required = ["email", "password", "username", "firstName", "lastName", "phone"];
    if (required.some((f) => !formData[f])) {
      setError("Por favor completa todos los campos requeridos");
      return;
    }
    if (!formData.accept_terms) {
      setError("Debes aceptar los términos y condiciones para continuar");
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

    // ✅ Validación + normalización LATAM (tolerante a 0/00 y +5930...)
    const phoneValidation = validatePhone(formData.phone, {
      defaultCountry: "+593", // cambia si tu app no es Ecuador por defecto
    });

    if (!phoneValidation.valid) {
      const msg = phoneValidation.error || "Teléfono inválido";
      setPhoneError(msg);
      setError(msg);
      if (phoneValidation.suggestion) setSuggestedPhone(phoneValidation.suggestion);
      return;
    }

    const normalizedPhone = phoneValidation.normalized; // E.164 limpio

    try {
      setLoading(true);
      setError("");
      setPhoneError("");
      setSuggestedPhone("");

      const registrationData = {
        username: formData.username,
        email: formData.email,
        password: formData.password,
        password_confirm: formData.confirmPassword,
        first_name: formData.firstName,
        last_name: formData.lastName,
        phone: normalizedPhone, // ← enviamos normalizado
        accept_terms: formData.accept_terms,
      };

      // 1) Registrar
      const result = await authAPI.register(registrationData);

      // 2) Notificación de éxito
      handleRegisterSuccess({ user: result });

      // 3) Intentar login automático
      try {
        if (typeof ctxLogin === "function") {
          const loginRes = await ctxLogin({
            email: formData.email,
            password: formData.password,
            remember: true,
          });
          if (loginRes?.success) {
            navigate("/");
          } else {
            goBackToLogin();
          }
        } else {
          goBackToLogin();
        }
      } catch {
        goBackToLogin();
      }

      // 4) Limpiar formulario
      setFormData({
        email: "",
        password: "",
        confirmPassword: "",
        username: "",
        firstName: "",
        lastName: "",
        phone: "",
        accept_terms: false,
      });
    } catch (err) {
      // —— Manejo de errores limpio (sin duplicar) ——
      let display = err?.message || "Error al registrarse";

      // DRF: { phone: ["..."], detail: "...", non_field_errors: ["..."] }
      const api = err?.response?.data;
      if (api && typeof api === "object") {
        if (Array.isArray(api.phone) && api.phone.length) {
          const first = String(api.phone[0]);
          setPhoneError(first);
          const sugMatch = first.match(/Sugerencia:\s*(\+\d+)/i);
          if (sugMatch?.[1]) setSuggestedPhone(sugMatch[1]);
          display = null; // ya se muestra junto al campo
        }
        if (api?.detail) display = String(api.detail);
        if (Array.isArray(api.non_field_errors) && api.non_field_errors.length) {
          display = String(api.non_field_errors[0]);
        }
      }

      if (display) setError(display);
      handleAuthError(err, "registro");
    } finally {
      setLoading(false);
    }
  };

  const isDisabled =
    loading ||
    !formData.email ||
    !formData.password ||
    !formData.username ||
    !formData.firstName ||
    !formData.lastName ||
    !formData.phone ||
    !formData.accept_terms;

  return (
    <div className="w-full max-w-[min(420px,100%)] bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-6 sm:p-8 border border-white/20">
      {/* Cabecera */}
      <div className="text-center mb-8">
        <div
          className="rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center shadow-lg"
          style={{ backgroundColor: "#389fae" }}
        >
          <UserPlus className="h-8 w-8 text-white" />
        </div>
        <h2 className="font-bold mb-2" style={{ color: "#0b56a7", fontSize: "clamp(1.25rem, 1vw + 1rem, 1.75rem)" }}>
          Crear Cuenta
        </h2>
        <p className="text-gray-600" style={{ fontSize: "clamp(.9rem, .5vw + .7rem, 1rem)" }}>
          Únete a nuestra plataforma
        </p>
      </div>

      {/* Errores globales */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {/* FORMULARIO REGISTRO */}
      <form className="space-y-5" onSubmit={handleRegister}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Nombre <span className="text-red-500">*</span>
            </label>
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
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Apellido <span className="text-red-500">*</span>
            </label>
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
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Usuario <span className="text-red-500">*</span>
          </label>
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
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Correo electrónico <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleInputChange}
            placeholder="tu@email.com"
            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#389fae] focus:ring-0 outline-none transition-all duración-200 text-gray-900 placeholder-gray-400 bg-gray-50 focus:bg-white"
            disabled={loading}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-blue-600" />
              Teléfono <span className="text-red-500">*</span>
            </div>
          </label>
          <input
            type="tel"
            name="phone"
            value={formData.phone}
            onChange={handleInputChange}
            placeholder="+593987654321"
            className={`w-full px-4 py-3 rounded-xl border-2 ${
              phoneError ? "border-red-300 focus:border-red-500" : "border-gray-200 focus:border-[#389fae]"
            } focus:ring-0 outline-none transition-all duration-200 text-gray-900 placeholder-gray-400 bg-gray-50 focus:bg-white`}
            disabled={loading}
            required
            aria-invalid={!!phoneError}
          />

          {/* Error + sugerencia (si existe) */}
          {(phoneError || suggestedPhone) && (
            <div className="mt-1 flex items-start justify-between gap-2">
              {phoneError && <p className="text-xs text-red-600">{phoneError}</p>}
              {suggestedPhone && (
                <button
                  type="button"
                  onClick={applySuggestion}
                  className="ml-auto text-xs font-semibold text-blue-700 hover:text-blue-900 underline"
                >
                  Usar sugerencia: {suggestedPhone}
                </button>
              )}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Contraseña <span className="text-red-500">*</span>
          </label>
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
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-[#389fae] transition-colors"
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            >
              {showPassword ? <EyeOff className="h-5 w-5" aria-hidden="true" /> : <Eye className="h-5 w-5" aria-hidden="true" />}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
            <span className="text-orange-600">🔒</span>
            Mínimo <span className="font-medium text-orange-600">8 caracteres</span>
          </p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Confirmar contraseña <span className="text-red-500">*</span>
          </label>
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
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-[#389fae] transition-colors"
              aria-label={showConfirmPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            >
              {showConfirmPassword ? <EyeOff className="h-5 w-5" aria-hidden="true" /> : <Eye className="h-5 w-5" aria-hidden="true" />}
            </button>
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-5 transition-all duration-200 hover:shadow-md">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              name="accept_terms"
              checked={formData.accept_terms}
              onChange={handleInputChange}
              className="w-5 h-5 border-2 border-blue-300 rounded focus:ring-2 mt-0.5"
              style={{ "--tw-ring-color": "#389fae", accentColor: "#389fae" }}
              disabled={loading}
              required
            />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <FileCheck className="h-5 w-5 text-blue-600" />
                <span className="text-sm font-bold text-blue-800">
                  Términos y Condiciones <span className="text-red-500">*</span>
                </span>
              </div>
              <p className="text-xs text-blue-700 leading-relaxed">
                Al registrarte en <span className="font-semibold text-blue-800">LuckySpin</span>, aceptas nuestros{" "}
                <Link
                  to="/terminos"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-blue-600 hover:text-blue-800 transition-colors underline decoration-dotted underline-offset-2 hover:decoration-solid inline-flex items-center gap-0.5"
                >
                  términos de servicio y política de privacidad
                  <ExternalLink className="h-2.5 w-2.5 ml-0.5" />
                </Link>
                . Confirmas que la información proporcionada es <span className="font-semibold">veraz</span> y que eres{" "}
                <span className="font-semibold">mayor de edad</span>.
              </p>
            </div>
          </label>
        </div>

        <button
          type="submit"
          disabled={isDisabled}
          className="w-full text-white font-bold py-4 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98]"
          style={{ backgroundColor: isDisabled ? "#9ca3af" : "#389fae" }}
        >
          {loading ? "Creando cuenta..." : "Crear cuenta ✨"}
        </button>

        <p className="text-center text-gray-600 text-sm">
          ¿Ya tienes cuenta?{" "}
          <button type="button" onClick={goBackToLogin} className="font-semibold" style={{ color: "#0b56a7" }}>
            Inicia sesión
          </button>
        </p>
      </form>
    </div>
  );
};

export default RegisterForm;
