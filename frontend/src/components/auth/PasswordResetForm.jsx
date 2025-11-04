// src/components/auth/PasswordResetForm.jsx - CON VALIDACIÓN DE EMAIL
import React from "react";
import { CheckCircle, AlertCircle, Eye, EyeOff, Info } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { useAuthNotifications } from "../../contexts/NotificationContext";
import { AuthAPI } from "../../config/api";
import logo from "../../assets/HAYU24_original.png";

const authAPI = new AuthAPI();

const PasswordResetForm = ({ onBackToLogin }) => {
  // ------------------- Estado común -------------------
  const [formData, setFormData] = React.useState({ email: "" });
  const [submittedEmail, setSubmittedEmail] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState(false);
  const [countdown, setCountdown] = React.useState(0);
  const [checkingEmail, setCheckingEmail] = React.useState(false);

  const { handlePasswordResetSuccess, handleAuthError } = useAuthNotifications();

  // ------------------- Detección de token -------------------
  const [params] = useSearchParams();
  const token = params.get("token") || "";

  const initialMode = token ? "reset" : "request";
  const [mode, setMode] = React.useState(initialMode);

  // Estados propios de "reset"
  const [validating, setValidating] = React.useState(!!token);
  const [tokenValid, setTokenValid] = React.useState(false);
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [showNew, setShowNew] = React.useState(false);
  const [showConfirm, setShowConfirm] = React.useState(false);
  const [submittedReset, setSubmittedReset] = React.useState(false);

  // Validar token si existe
  React.useEffect(() => {
    let mounted = true;
    if (!token) {
      setMode("request");
      setValidating(false);
      setTokenValid(false);
      return;
    }

    setMode("reset");
    setValidating(true);
    setError("");

    (async () => {
      try {
        const res = await authAPI.validateResetToken(token);
        
        if (!mounted) return;
        
        if (res?.valid) {
          setTokenValid(true);
        } else {
          setTokenValid(false);
          setError(res?.message || "Token inválido o expirado");
          setMode("request");
        }
      } catch (e) {
        if (!mounted) return;
        setTokenValid(false);
        setError("No se pudo validar el token. Intenta nuevamente.");
        setMode("request");
      } finally {
        if (mounted) setValidating(false);
      }
    })();

    return () => { mounted = false; };
  }, [token]);

  // Countdown para volver al login
  React.useEffect(() => {
    if (countdown > 0) {
      const t = setTimeout(() => setCountdown(s => s - 1), 1000);
      return () => clearTimeout(t);
    } else if (countdown === 0 && success && !token) {
      onBackToLogin();
    }
  }, [countdown, success, token, onBackToLogin]);

  // ------------------- Helpers -------------------
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (error) setError("");
    if (success) setSuccess(false);
  };

  const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  // ------------------- NUEVA FUNCIÓN: Validar email antes de enviar -------------------
  const handlePasswordResetRequest = async (e) => {
    e.preventDefault();
    
    const email = formData.email.trim();
    
    if (!email) {
      return setError("Por favor ingresa tu correo electrónico");
    }
    
    if (!validateEmail(email)) {
      return setError("Por favor ingresa un correo electrónico válido");
    }

    try {
      setLoading(true);
      setCheckingEmail(true);
      setError("");
      setSuccess(false);

      // PASO 1: Verificar si el email existe en la base de datos
      const checkResult = await authAPI.checkEmailExists(email);
      
      setCheckingEmail(false);

      if (!checkResult?.exists) {
        setError(
          "Este correo no está registrado en nuestro sistema. " +
          "Verifica que sea correcto o regístrate primero."
        );
        setLoading(false);
        return;
      }

      // PASO 2: Si existe, enviar el email de recuperación
      const response = await authAPI.requestPasswordReset(email);
      
      if (response && (response.success !== undefined || response.message)) {
        setSubmittedEmail(email);
        setSuccess(true);
        handlePasswordResetSuccess(email);
        setCountdown(5);
        setFormData({ email: "" });
      } else {
        throw new Error("No se pudo procesar la solicitud");
      }
    } catch (err) {
      console.error("Password reset request error:", err);
      
      let errorMessage = "Error al solicitar recuperación de contraseña";
      const msg = err?.message || "";
      
      if (/rate limit|bloqueado|demasiadas|429/i.test(msg)) {
        errorMessage = "Demasiadas solicitudes. Intenta nuevamente en unos minutos.";
      } else if (/configuraci[oó]n.*email/i.test(msg)) {
        errorMessage = "Error de configuración de email. Contacta al administrador.";
      } else if (msg) {
        errorMessage = msg;
      }

      setError(errorMessage);
      handleAuthError(err, "recuperación de contraseña");
    } finally {
      setLoading(false);
      setCheckingEmail(false);
    }
  };

  // ------------------- Guardar nueva contraseña (con token) -------------------
  const clientPwdOk = (pwd) => pwd && pwd.length >= 8;

  const handleConfirmNewPassword = async (e) => {
    e.preventDefault();
    setError("");

    if (!clientPwdOk(newPassword)) {
      return setError("La nueva contraseña debe tener al menos 8 caracteres.");
    }
    
    if (newPassword !== confirmPassword) {
      return setError("Las contraseñas no coinciden.");
    }

    try {
      setLoading(true);
      
      await authAPI.confirmPasswordReset({
        token,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      
      setSubmittedReset(true);
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      console.error("Error confirmando nueva contraseña:", err);
      const backendMsg =
        err?.errors?.confirm_password?.[0] ||
        err?.errors?.token ||
        err?.message ||
        "No se pudo restablecer la contraseña.";
      setError(typeof backendMsg === "string" ? backendMsg : "Error desconocido");
      handleAuthError(err, "restablecer contraseña");
    } finally {
      setLoading(false);
    }
  };

  // ------------------- UI -------------------
  const Header = ({ ok }) => (
    <div className="text-center mb-8">
      <div className="mx-auto mb-4 w-24 h-24 flex items-center justify-center">
        <img 
          src={logo} 
          alt="HAYU24 Logo" 
          className="w-full h-full object-contain"
        />
      </div>
      <h2 className="font-bold mb-2" style={{ color: "#0b56a7", fontSize: "clamp(1.25rem, 1vw + 1rem, 1.75rem)" }}>
        {mode === "reset" ? "Restablecer contraseña" : ok ? "Email Enviado" : "Recuperar Contraseña"}
      </h2>
      <p className="text-gray-600" style={{ fontSize: "clamp(.9rem, .5vw + .7rem, 1rem)" }}>
        {mode === "reset"
          ? validating
            ? "Validando token..."
            : tokenValid
              ? "Ingresa tu nueva contraseña"
              : "El token no es válido. Puedes solicitar otro."
          : ok
            ? "Revisa tu bandeja de entrada"
            : "Te ayudamos a recuperarla"}
      </p>
    </div>
  );

  return (
    <div className="w-full max-w-[min(520px,100%)] bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-6 sm:p-8 border border-white/20">
      <Header ok={success || submittedReset} />

      {/* Alertas */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
          <div className="flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Éxito de solicitud de email */}
      {mode === "request" && success && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
          <div className="flex items-start space-x-3">
            <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-green-700 text-sm font-medium mb-2">Enlace enviado correctamente</p>
              <p className="text-green-600 text-sm mb-2">
                Hemos enviado un enlace de recuperación a <strong>{submittedEmail}</strong>.
              </p>
              <p className="text-green-600 text-xs">
                Revisa tu bandeja de entrada y spam. El enlace es válido por 1 hora.
              </p>
              {countdown > 0 && (
                <p className="text-green-600 text-xs mt-3 font-medium">
                  Regresando al login en {countdown} segundos...
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ----------- Vista: Solicitar email (sin token o token inválido) ----------- */}
      {mode === "request" && !success && (
        <form className="space-y-6" onSubmit={handlePasswordResetRequest}>
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
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#4dc9b1] focus:ring-0 outline-none transition-all duration-200 text-gray-900 placeholder-gray-400 bg-gray-50 focus:bg-white"
              disabled={loading || validating}
              required
              autoComplete="email"
              autoFocus
            />
            <p className="text-xs text-gray-500 mt-1.5">
              Verificaremos que este correo esté registrado antes de enviar el enlace.
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-700 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-blue-700 text-sm font-medium mb-1.5">
                  Información importante
                </p>
                <ul className="text-blue-600 text-xs space-y-1">
                  <li>• Verificamos que el correo esté registrado</li>
                  <li>• El enlace será válido por 1 hora</li>
                  <li>• Revisa spam si no lo recibes en 5 minutos</li>
                </ul>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !formData.email || validating}
            className="w-full text-white font-bold py-4 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50 transform hover:scale-[1.02] active:scale-[0.98]"
            style={{ 
              backgroundColor: loading || !formData.email || validating ? "#9ca3af" : "#4dc9b1", 
              cursor: loading ? "wait" : "pointer" 
            }}
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {checkingEmail ? "Verificando email..." : "Enviando..."}
              </span>
            ) : (
              "Enviar enlace de recuperación"
            )}
          </button>

          <p className="text-center text-gray-600 text-sm">
            ¿Recordaste tu contraseña?{" "}
            <button 
              type="button" 
              onClick={onBackToLogin} 
              className="font-semibold hover:underline transition-colors" 
              style={{ color: "#0b56a7" }} 
              disabled={loading || validating}
            >
              Volver al login
            </button>
          </p>
        </form>
      )}

      {/* ----------- Vista: Restablecer contraseña (token válido) ----------- */}
      {mode === "reset" && (
        <div>
          {validating ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Validando token...</p>
            </div>
          ) : tokenValid ? (
            submittedReset ? (
              <>
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                    <div>
                      <p className="text-green-700 text-sm font-medium mb-1">
                        Contraseña actualizada
                      </p>
                      <p className="text-green-600 text-sm">
                        Ya puedes iniciar sesión con tu nueva contraseña.
                      </p>
                    </div>
                  </div>
                </div>
                <button
                  onClick={onBackToLogin}
                  className="w-full text-white font-bold py-4 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98]"
                  style={{ backgroundColor: "#4dc9b1" }}
                >
                  Ir al login
                </button>
              </>
            ) : (
              <form className="space-y-5" onSubmit={handleConfirmNewPassword}>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Nueva contraseña
                  </label>
                  <div className="relative">
                    <input
                      type={showNew ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#4dc9b1] focus:ring-0 outline-none transition-all duration-200 text-gray-900 bg-gray-50 focus:bg-white"
                      placeholder="Mínimo 8 caracteres"
                      autoComplete="new-password"
                      required
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowNew(s => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                      aria-label={showNew ? "Ocultar contraseña" : "Mostrar contraseña"}
                    >
                      {showNew ? <EyeOff className="w-5 h-5 text-gray-500" /> : <Eye className="w-5 h-5 text-gray-500" />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Mínimo 8 caracteres.</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Confirmar contraseña
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirm ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#4dc9b1] focus:ring-0 outline-none transition-all duration-200 text-gray-900 bg-gray-50 focus:bg-white"
                      placeholder="Repite la contraseña"
                      autoComplete="new-password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(s => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                      aria-label={showConfirm ? "Ocultar confirmación" : "Mostrar confirmación"}
                    >
                      {showConfirm ? <EyeOff className="w-5 h-5 text-gray-500" /> : <Eye className="w-5 h-5 text-gray-500" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !newPassword || !confirmPassword}
                  className="w-full text-white font-bold py-4 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50 transform hover:scale-[1.02] active:scale-[0.98]"
                  style={{ 
                    backgroundColor: loading || !newPassword || !confirmPassword ? "#9ca3af" : "#4dc9b1" 
                  }}
                >
                  {loading ? "Guardando..." : "Guardar nueva contraseña"}
                </button>

                <p className="text-center text-gray-600 text-sm">
                  ¿Recordaste tu contraseña?{" "}
                  <button 
                    type="button" 
                    onClick={onBackToLogin} 
                    className="font-semibold hover:underline transition-colors" 
                    style={{ color: "#0b56a7" }}
                  >
                    Volver al login
                  </button>
                </p>
              </form>
            )
          ) : (
            <div className="text-center py-4">
              <p className="text-gray-600 mb-4">
                El token no es válido o ha expirado. Solicita un nuevo enlace.
              </p>
              <button
                onClick={() => setMode("request")}
                className="text-blue-600 font-semibold hover:underline"
              >
                Solicitar nuevo enlace
              </button>
            </div>
          )}
        </div>
      )}

      {/* Botón extra cuando hay éxito en solicitud */}
      {mode === "request" && success && (
        <button
          onClick={onBackToLogin}
          className="w-full text-white font-bold py-4 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] mt-4"
          style={{ backgroundColor: "#4dc9b1" }}
        >
          Volver al login ahora
        </button>
      )}
    </div>
  );
};

export default PasswordResetForm;