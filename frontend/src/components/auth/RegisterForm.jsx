// src/components/auth/RegisterForm.jsx
import React, { useState, useCallback } from "react";
import { Phone, FileCheck, ExternalLink, Eye, EyeOff } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthNotifications } from "../../contexts/NotificationContext";
import { useAuth } from "../../contexts/AuthContext";
import { AuthAPI } from "../../config/api";
import { validatePhone } from "./utils/phoneValidation";
import logo from "../../assets/HAYU24_original.png";

const authAPI = new AuthAPI();

// ============================================================================
// CONSTANTES
// ============================================================================
const INITIAL_FORM_STATE = {
  email: "",
  password: "",
  confirmPassword: "",
  username: "",
  firstName: "",
  lastName: "",
  phone: "",
  accept_terms: false,
};

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================
const RegisterForm = ({ onBackToLogin }) => {
  // ---------------------------------------------------------------------------
  // HOOKS Y ESTADO
  // ---------------------------------------------------------------------------
  const navigate = useNavigate();
  const { login: ctxLogin } = useAuth() || {};
  const { handleRegisterSuccess, handleAuthError } = useAuthNotifications() || {
    handleRegisterSuccess: () => {},
    handleAuthError: () => {},
  };

  const [formData, setFormData] = useState(INITIAL_FORM_STATE);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [suggestedPhone, setSuggestedPhone] = useState("");

  // ---------------------------------------------------------------------------
  // NAVEGACIÓN
  // ---------------------------------------------------------------------------
  const goBackToLogin = useCallback(() => {
    if (typeof onBackToLogin === "function") onBackToLogin();
    else navigate("/login");
  }, [onBackToLogin, navigate]);

  // ---------------------------------------------------------------------------
  // MANEJADORES DE FORMULARIO
  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------
  // REGISTRO TRADICIONAL
  // ---------------------------------------------------------------------------
  const handleRegister = async (e) => {
    e.preventDefault();

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

    const phoneValidation = validatePhone(formData.phone, {
      defaultCountry: "+593",
    });

    if (!phoneValidation.valid) {
      const msg = phoneValidation.error || "Teléfono inválido";
      setPhoneError(msg);
      setError(msg);
      if (phoneValidation.suggestion) setSuggestedPhone(phoneValidation.suggestion);
      return;
    }

    const normalizedPhone = phoneValidation.normalized;

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
        phone: normalizedPhone,
        accept_terms: formData.accept_terms,
      };

      const result = await authAPI.register(registrationData);
      handleRegisterSuccess({ user: result });

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

      setFormData(INITIAL_FORM_STATE);
    } catch (err) {
      let display = err?.message || "Error al registrarse";

      const api = err?.response?.data;
      if (api && typeof api === "object") {
        if (Array.isArray(api.phone) && api.phone.length) {
          const first = String(api.phone[0]);
          setPhoneError(first);
          const sugMatch = first.match(/Sugerencia:\s*(\+\d+)/i);
          if (sugMatch?.[1]) setSuggestedPhone(sugMatch[1]);
          display = null;
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

  // ---------------------------------------------------------------------------
  // VALIDACIÓN DE CAMPOS
  // ---------------------------------------------------------------------------
  const isDisabled =
    loading ||
    !formData.email ||
    !formData.password ||
    !formData.username ||
    !formData.firstName ||
    !formData.lastName ||
    !formData.phone ||
    !formData.accept_terms;

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------
  return (
    <div className="w-full max-w-[min(420px,100%)] bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-6 sm:p-8 border border-white/20">
      
      {/* HEADER CON LOGO */}
      <div className="text-center mb-8">
        <div className="mx-auto mb-4 flex items-center justify-center">
          <img
            src={logo}
            alt="HAYU24"
            className="h-16 sm:h-20 w-auto object-contain"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        </div>
        <h2
          className="font-bold mb-2"
          style={{ color: "#0b56a7", fontSize: "clamp(1.25rem, 1vw + 1rem, 1.75rem)" }}
        >
          Crear Cuenta
        </h2>
        <p className="text-gray-600" style={{ fontSize: "clamp(.9rem, .5vw + .7rem, 1rem)" }}>
          Únete a nuestra plataforma
        </p>
      </div>

      {/* MENSAJES DE ERROR */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {/* FORMULARIO TRADICIONAL */}
      <form className="space-y-5" onSubmit={handleRegister}>
        
        {/* NOMBRE Y APELLIDO */}
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
              placeholder="Lucas"
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
              placeholder="Mojoara"
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#389fae] focus:ring-0 outline-none transition-all duration-200 text-gray-900 placeholder-gray-400 bg-gray-50 focus:bg-white"
              disabled={loading}
              required
            />
          </div>
        </div>

        {/* USUARIO */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Usuario <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="username"
            value={formData.username}
            onChange={handleInputChange}
            placeholder="lucas.mojoara"
            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#389fae] focus:ring-0 outline-none transition-all duration-200 text-gray-900 placeholder-gray-400 bg-gray-50 focus:bg-white"
            disabled={loading}
            required
          />
        </div>

        {/* EMAIL */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Correo electrónico <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleInputChange}
            placeholder="lucas.mojoara@example.com"
            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#389fae] focus:ring-0 outline-none transition-all duration-200 text-gray-900 placeholder-gray-400 bg-gray-50 focus:bg-white"
            disabled={loading}
            required
          />
        </div>

        {/* TELÉFONO */}
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
              phoneError
                ? "border-red-300 focus:border-red-500"
                : "border-gray-200 focus:border-[#389fae]"
            } focus:ring-0 outline-none transition-all duration-200 text-gray-900 placeholder-gray-400 bg-gray-50 focus:bg-white`}
            disabled={loading}
            required
            aria-invalid={!!phoneError}
          />

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

        {/* CONTRASEÑA */}
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
              tabIndex={-1}
            >
              {showPassword ? (
                <EyeOff className="h-5 w-5" aria-hidden="true" />
              ) : (
                <Eye className="h-5 w-5" aria-hidden="true" />
              )}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
            <span className="text-orange-600">🔒</span>
            Mínimo <span className="font-medium text-orange-600">8 caracteres</span>
          </p>
        </div>

        {/* CONFIRMAR CONTRASEÑA */}
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
              tabIndex={-1}
            >
              {showConfirmPassword ? (
                <EyeOff className="h-5 w-5" aria-hidden="true" />
              ) : (
                <Eye className="h-5 w-5" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        {/* TÉRMINOS Y CONDICIONES */}
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
                Al registrarte en <span className="font-semibold text-blue-800">HAYU24</span>,
                aceptas nuestros{" "}
                <Link
                  to="/terminos"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-blue-600 hover:text-blue-800 transition-colors underline decoration-dotted underline-offset-2 hover:decoration-solid inline-flex items-center gap-0.5"
                >
                  términos de servicio y política de privacidad
                  <ExternalLink className="h-2.5 w-2.5 ml-0.5" />
                </Link>
                . Confirmas que la información proporcionada es{" "}
                <span className="font-semibold">veraz</span> y que eres{" "}
                <span className="font-semibold">mayor de edad</span>.
              </p>
            </div>
          </label>
        </div>

        {/* BOTÓN SUBMIT */}
        <button
          type="submit"
          disabled={isDisabled}
          className="w-full text-white font-bold py-4 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98]"
          style={{ backgroundColor: isDisabled ? "#9ca3af" : "#389fae" }}
        >
          {loading ? "Creando cuenta..." : "Crear cuenta"}
        </button>

        {/* LINK A LOGIN */}
        <p className="text-center text-gray-600 text-sm">
          ¿Ya tienes cuenta?{" "}
          <button
            type="button"
            onClick={goBackToLogin}
            className="font-semibold hover:underline transition-colors"
            style={{ color: "#0b56a7" }}
            disabled={loading}
          >
            Inicia sesión
          </button>
        </p>
      </form>
    </div>
  );
};

export default RegisterForm;