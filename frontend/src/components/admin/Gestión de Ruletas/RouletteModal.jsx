/* ================================
   IMPORTS Y DEPENDENCIAS
================================ */
import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  X, Upload, ImageIcon, Trash2, Save, Calendar,
  AlertCircle, Info, Clock, FileText, Eye, Timer, CalendarCheck
} from "lucide-react";

/* ================================
   CONSTANTES Y CONFIGURACIONES
================================ */
const MAX_MB = 5;
const ALLOWED = [".jpg", ".jpeg", ".png", ".webp"];
const LINK_COLOR_CLASS = "text-blue-600 underline hover:no-underline";

const DEFAULT_EDITING = {
  id: null,
  name: "",
  description: "",
  status: "draft",
  cover_image: null,
  cover_preview: "",
  cover_url: "",
  cover_delete: false,
  participation_start: "",
  participation_end: "",
  scheduled_date: "",
};

/* ================================
   FUNCIONES AUXILIARES DE FECHAS
================================ */
const formatDate = (dateString) => {
  if (!dateString) return "";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "";
    
    return new Intl.DateTimeFormat('es-EC', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  } catch {
    return "";
  }
};

// ✅ CORREGIDO: Convierte fecha ISO a formato datetime-local para el input
const formatDateTimeLocal = (dateString) => {
  if (!dateString) return "";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "";

    // Ajustar a zona horaria local
    const offset = date.getTimezoneOffset();
    const localDate = new Date(date.getTime() - (offset * 60 * 1000));
    
    // Formato ISO sin timezone (YYYY-MM-DDTHH:mm)
    return localDate.toISOString().slice(0, 16);
  } catch {
    return "";
  }
};

// ✅ CORREGIDO: Convierte datetime-local a formato ISO para Django
const parseDateTimeLocal = (dateTimeLocalString) => {
  if (!dateTimeLocalString) return null;
  try {
    // El input datetime-local da formato "YYYY-MM-DDTHH:mm"
    const localDate = new Date(dateTimeLocalString);
    
    // Verificar que la fecha es válida
    if (isNaN(localDate.getTime())) return null;
    
    // Retornar en formato ISO (lo que espera Django)
    return localDate.toISOString();
  } catch {
    return null;
  }
};

/* =========================
   Componente de Fecha Programada
   ========================= */
const ScheduledDateDisplay = ({ targetDate, label = "Fecha programada", className = "" }) => {
  if (!targetDate) return null;

  const date = new Date(targetDate);
  const now = new Date();
  const isPast = date < now;

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border ${
      isPast 
        ? "bg-gray-100 text-gray-700 border-gray-300" 
        : "bg-purple-100 text-purple-800 border-purple-200"
    } ${className}`}>
      <CalendarCheck className="w-4 h-4" />
      <span className="text-xs font-medium">{label}:</span>
      <span className="font-bold">{formatDate(targetDate)}</span>
      {isPast && <span className="text-xs">(Ya pasó)</span>}
    </div>
  );
};

/* =========================
   Cronómetro MEJORADO con 3 fases
   ========================= */
const CountdownTimer = ({ startDate, endDate, onComplete, className = "" }) => {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    phase: 'inactive'
  });

  useEffect(() => {
    if (!endDate) {
      setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, phase: 'inactive' });
      return;
    }

    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const start = startDate ? new Date(startDate).getTime() : 0;
      const end = new Date(endDate).getTime();

      if (startDate && now < start) {
        const difference = start - now;
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);

        setTimeLeft({ days, hours, minutes, seconds, phase: 'waiting' });
        return;
      }

      const difference = end - now;
      
      if (difference > 0) {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);

        setTimeLeft({ days, hours, minutes, seconds, phase: 'active' });
        return;
      }

      setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, phase: 'expired' });
      onComplete?.();
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(interval);
  }, [startDate, endDate, onComplete]);

  if (timeLeft.phase === 'inactive') return null;

  const getUrgencyStyles = () => {
    if (timeLeft.phase === 'expired') {
      return "bg-red-100 text-red-800 border-red-200";
    }
    
    if (timeLeft.phase === 'waiting') {
      return "bg-blue-100 text-blue-800 border-blue-200";
    }

    const totalMinutes = timeLeft.days * 24 * 60 + timeLeft.hours * 60 + timeLeft.minutes;
    
    if (totalMinutes < 60) return "bg-red-100 text-red-800 border-red-200";
    if (totalMinutes < 1440) return "bg-orange-100 text-orange-800 border-orange-200";
    return "bg-green-100 text-green-800 border-green-200";
  };

  const getMessage = () => {
    if (timeLeft.phase === 'expired') return '¡Cerrado!';
    if (timeLeft.phase === 'waiting') return 'Inicia en';
    return 'Cierra en';
  };

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border ${getUrgencyStyles()} ${className}`}>
      {timeLeft.phase === 'expired' ? (
        <>
          <Timer className="w-4 h-4" />
          <span>Finalizado</span>
        </>
      ) : (
        <>
          <Clock className="w-4 h-4" />
          <span className="text-xs font-medium">{getMessage()}:</span>
          <div className="flex items-center gap-1">
            {timeLeft.days > 0 && <span className="font-bold">{timeLeft.days}d</span>}
            {(timeLeft.days > 0 || timeLeft.hours > 0) && <span className="font-bold">{timeLeft.hours}h</span>}
            <span className="font-bold">{timeLeft.minutes}m</span>
            <span className="font-bold">{timeLeft.seconds}s</span>
          </div>
        </>
      )}
    </div>
  );
};

/* ================================
   HELPERS DE TEXTO Y ENLACES
================================ */
const escapeHtml = (s = "") =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const autoLinkHTML = (plainText) => {
  if (!plainText) return "";
  const text = escapeHtml(plainText);

  const urlRegex = /\b((https?:\/\/|www\.)[^\s<]+)\b/gi;
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

  let html = text.replace(emailRegex, (m) => {
    const href = `mailto:${m}`;
    return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="${LINK_COLOR_CLASS}">${m}</a>`;
  });

  html = html.replace(urlRegex, (m) => {
    const href = m.startsWith("http") ? m : `https://${m}`;
    return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="${LINK_COLOR_CLASS}">${m}</a>`;
  });

  html = html.replace(/\n/g, "<br/>");
  return html;
};

/* ================================
   EDITOR DE TEXTO CON VISTA PREVIA
================================ */
const SimpleTextEditor = ({
  value,
  onChange,
  placeholder,
  disabled,
  maxLength,
  validationError,
  onValidationChange,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [preview, setPreview] = useState("");

  const handleChange = useCallback(
    (e) => {
      const newValue = e.target.value;
      if (maxLength && newValue.length > maxLength) {
        onValidationChange?.(true);
        return;
      } else {
        onValidationChange?.(false);
      }
      onChange(newValue);
    },
    [onChange, maxLength, onValidationChange]
  );

  useEffect(() => {
    setPreview(autoLinkHTML(value || ""));
  }, [value]);

  const togglePreview = () => setShowPreview((p) => !p);

  return (
    <div
      className={`bg-white rounded-lg border-2 transition-colors duration-200 ${
        isFocused
          ? "border-blue-500 ring-2 ring-blue-200"
          : validationError
          ? "border-red-300"
          : "border-gray-300"
      }`}
    >
      <div className="border-b border-gray-200 bg-gray-50 px-3 py-2 flex items-center justify-between">
        <div className="flex items-center text-xs text-gray-600">
          <FileText className="h-3 w-3 mr-1" />
          Los enlaces y correos se detectan automáticamente
        </div>
        <button
          type="button"
          onClick={togglePreview}
          className="flex items-center text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded transition-colors"
        >
          <Eye className="h-3 w-3 mr-1" />
          {showPreview ? "Ocultar" : "Vista previa"}
        </button>
      </div>

      {showPreview ? (
        <div className="p-3">
          <div className="flex items-center text-xs text-gray-600 mb-2">
            <Eye className="h-3 w-3 mr-1" />
            Vista previa con enlaces detectados
          </div>
          <div
            className="min-h-[200px] px-4 py-4 bg-gray-50 rounded-md text-sm border"
            style={{ lineHeight: "1.6" }}
            dangerouslySetInnerHTML={{ __html: preview }}
          />
          {maxLength && (
            <div className="mt-1 text-right text-xs text-gray-400">
              {(value?.length || 0)}/{maxLength}
            </div>
          )}
        </div>
      ) : (
        <div className="p-3">
          <textarea
            value={value || ""}
            onChange={handleChange}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            className={`w-full px-4 py-4 border-0 focus:ring-0 focus:outline-none resize-none min-h-[200px] ${
              validationError ? "bg-red-50" : "bg-white"
            }`}
            placeholder={placeholder || "Escribe aquí tu descripción..."}
            disabled={disabled}
            style={{
              fontFamily:
                'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
              fontSize: "14px",
              lineHeight: "1.6",
            }}
          />
          {maxLength && (
            <div className="mt-1 text-right text-xs text-gray-400">
              {(value?.length || 0)}/{maxLength}
            </div>
          )}
        </div>
      )}

      {validationError && (
        <div className="border-t border-gray-200 bg-red-50 px-4 py-2 flex items-center">
          <AlertCircle className="h-3 w-3 mr-1 text-red-500" />
          <span className="text-xs text-red-600">Límite de caracteres excedido</span>
        </div>
      )}
    </div>
  );
};

/* ================================
   HELPERS DE ARCHIVOS
================================ */
const getExt = (name = "") =>
  name && name.includes(".") ? name.toLowerCase().slice(name.lastIndexOf(".")) : "";

/* ================================
   MODAL PRINCIPAL
================================ */
const RouletteModal = ({
  isOpen,
  onClose,
  editing,
  setEditing,
  onSave,
  loading,
  error = null,
}) => {
  const fileRef = useRef(null);
  const [validationErrors, setValidationErrors] = useState({});
  const [descriptionValidationError, setDescriptionValidationError] = useState(false);

  const currentEditing = editing || DEFAULT_EDITING;

  const getDefaultDescription = () => {
    return ``;
  };

  useEffect(() => {
    if (!isOpen) {
      setValidationErrors({});
      setDescriptionValidationError(false);
      return;
    }

    if (!currentEditing.id && !currentEditing.description && setEditing) {
      setEditing(prev => ({
        ...DEFAULT_EDITING,
        ...prev,
        description: getDefaultDescription(),
      }));
    }
  }, [isOpen, currentEditing.id, currentEditing.description, setEditing]);

  if (!isOpen) return null;

  const getValidationErrors = () => {
    const errors = {};

    const nameTrim = (currentEditing.name || "").trim();
    if (!nameTrim) {
      errors.name = "El título es obligatorio";
    } else if (nameTrim.length < 3) {
      errors.name = "El título debe tener al menos 3 caracteres";
    } else if (nameTrim.length > 200) {
      errors.name = "El título no puede exceder los 200 caracteres";
    }

    if (currentEditing.description && currentEditing.description.length > 5000) {
      errors.description = "La descripción no puede exceder los 5,000 caracteres";
    }

    const participationStart = currentEditing.participation_start
      ? new Date(currentEditing.participation_start)
      : null;
    const participationEnd = currentEditing.participation_end
      ? new Date(currentEditing.participation_end)
      : null;
    const scheduledDate = currentEditing.scheduled_date
      ? new Date(currentEditing.scheduled_date)
      : null;

    if (participationEnd && !participationStart) {
      errors.participation_start = "Debes especificar cuándo inicia la participación si defines cuándo termina";
    }

    if (participationStart && !participationEnd) {
      errors.participation_end = "Debes especificar cuándo termina la participación si defines cuándo inicia";
    }

    if (participationStart && participationEnd && participationStart >= participationEnd) {
      errors.participation_end = "La fecha de fin debe ser posterior al inicio (mínimo 1 minuto)";
    }

    if (scheduledDate && !participationEnd) {
      errors.scheduled_date = "Debes especificar fecha de fin de participación antes de programar el sorteo";
    }

    if (scheduledDate && !participationStart) {
      errors.scheduled_date = "Debes especificar fecha de inicio de participación antes de programar el sorteo";
    }

    if (scheduledDate && participationEnd && scheduledDate <= participationEnd) {
      errors.scheduled_date = "El sorteo debe ser después del cierre de participación (mínimo 1 minuto)";
    }

    // ✅ VALIDACIÓN MEJORADA: Más flexible para edición
    const now = new Date();

    // Solo validar fechas muy antiguas si estamos creando una nueva ruleta
    if (participationStart && !currentEditing.id) {
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      
      if (participationStart < oneMonthAgo) {
        errors.participation_start = "Para ruletas nuevas, la fecha de inicio no puede ser más de 1 mes en el pasado";
      }
    }

    if (participationEnd && !currentEditing.id) {
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      
      if (participationEnd < oneMonthAgo) {
        errors.participation_end = "Para ruletas nuevas, la fecha de fin no puede ser más de 1 mes en el pasado";
      }
    }

    if (scheduledDate && !currentEditing.id) {
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      
      if (scheduledDate < oneMonthAgo) {
        errors.scheduled_date = "Para ruletas nuevas, la fecha del sorteo no puede ser más de 1 mes en el pasado";
      }
    }

    return errors;
  };

  const validateAndFocus = () => {
    const errors = getValidationErrors();
    setValidationErrors(errors);

    if (Object.keys(errors).length > 0) {
      const firstError = Object.keys(errors)[0];
      const el = document.querySelector(`[data-field="${firstError}"]`);
      if (el && typeof el.scrollIntoView === "function") {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        const focusable = el.querySelector("input,textarea,select,button");
        focusable?.focus?.();
      }
      return false;
    }
    return true;
  };

  const isFormValid = () => {
    const errs = getValidationErrors();
    return (
      (currentEditing.name || "").trim().length >= 3 &&
      (currentEditing.name || "").trim().length <= 200 &&
      !descriptionValidationError &&
      Object.keys(errs).length === 0
    );
  };

  const onPickFile = () => fileRef.current?.click();

  const onFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = getExt(file.name);
    if (!ALLOWED.includes(ext)) {
      alert(`Formato no permitido: ${ext}. Formatos permitidos: ${ALLOWED.join(", ")}`);
      e.target.value = "";
      return;
    }

    if (file.size > MAX_MB * 1024 * 1024) {
      alert(`Archivo demasiado grande. Tamaño máximo permitido: ${MAX_MB} MB.`);
      e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      setEditing?.((prev) => ({
        ...(prev || DEFAULT_EDITING),
        cover_image: file,
        cover_preview: String(ev.target?.result || ""),
        cover_delete: false,
      }));
    };
    reader.onerror = () => {
      alert("Error al leer el archivo. Inténtalo de nuevo.");
      e.target.value = "";
    };
    reader.readAsDataURL(file);
  };

  const clearCover = () => {
    if (!setEditing) return;

    if (currentEditing.cover_url && !currentEditing.cover_image) {
      setEditing((prev) => ({
        ...(prev || DEFAULT_EDITING),
        cover_delete: true,
        cover_preview: "",
        cover_image: null,
      }));
    } else {
      setEditing((prev) => ({
        ...(prev || DEFAULT_EDITING),
        cover_image: null,
        cover_preview: "",
        cover_delete: false,
      }));
    }

    if (fileRef.current) fileRef.current.value = "";
  };

  const getPreviewSrc = () => {
    if (currentEditing.cover_preview) return currentEditing.cover_preview;
    if (currentEditing.cover_delete) return null;
    if (currentEditing.cover_url) return currentEditing.cover_url;
    return null;
  };

  // ✅ FUNCIÓN handleSave VERIFICADA
  const handleSave = () => {
    if (!validateAndFocus()) return;

    const dataToSend = {
      id: currentEditing.id || undefined,
      name: currentEditing.name?.trim(),
      description: currentEditing.description || "",
      status: currentEditing.status,
      // ✅ Conversión correcta a formato ISO
      participation_start: currentEditing.participation_start
        ? parseDateTimeLocal(currentEditing.participation_start)
        : null,
      participation_end: currentEditing.participation_end
        ? parseDateTimeLocal(currentEditing.participation_end)
        : null,
      scheduled_date: currentEditing.scheduled_date
        ? parseDateTimeLocal(currentEditing.scheduled_date)
        : null,
    };

    if (currentEditing.cover_image) {
      dataToSend.cover_image = currentEditing.cover_image;
    } else if (currentEditing.cover_delete) {
      dataToSend.cover_delete = true;
    }

    onSave(dataToSend);
  };

  const statusOptions = [
    {
      value: "draft",
      label: "Borrador",
      color: "text-gray-600",
      description: "Ruleta en construcción, no visible públicamente",
    },
    {
      value: "active",
      label: "Activa",
      color: "text-green-600",
      description: "Ruleta activa, usuarios pueden participar",
    },
    {
      value: "scheduled",
      label: "Programada",
      color: "text-blue-600",
      description: "Programada para sorteo automático",
    },
    {
      value: "completed",
      label: "Completada",
      color: "text-purple-600",
      description: "Sorteo realizado, tiene ganador",
    },
    {
      value: "cancelled",
      label: "Cancelada",
      color: "text-red-600",
      description: "Ruleta cancelada, no se realizará sorteo",
    },
  ];

  const currentStatus = statusOptions.find((s) => s.value === currentEditing.status);
  const previewSrc = getPreviewSrc();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-7xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[95vh] overflow-y-auto">
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 px-6 py-5 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Save className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-white">
                {currentEditing.id ? "Editar Ruleta" : "Crear Nueva Ruleta"}
              </h3>
              <p className="text-blue-100 text-sm">
                {currentEditing.id ? `ID: ${currentEditing.id}` : "Formulario de creación"}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {currentEditing.id && currentStatus && (
              <div
                className={`px-3 py-1 rounded-full text-xs font-medium ${
                  currentStatus.color === "text-green-600"
                    ? "bg-green-100 text-green-800"
                    : currentStatus.color === "text-blue-600"
                    ? "bg-blue-100 text-blue-800"
                    : currentStatus.color === "text-purple-600"
                    ? "bg-purple-100 text-purple-800"
                    : currentStatus.color === "text-red-600"
                    ? "bg-red-100 text-red-800"
                    : "bg-gray-100 text-gray-800"
                }`}
              >
                {currentStatus.label}
              </div>
            )}

            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/20 text-white transition-colors duration-200"
              disabled={loading}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-4 bg-red-50 border-l-4 border-red-400 rounded-r-lg">
            <div className="flex items-start space-x-3">
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h4 className="text-sm font-bold text-red-800 mb-1">Error al procesar la solicitud</h4>
                <p className="text-sm text-red-700">{error}</p>
                <p className="text-xs text-red-600 mt-2">Verifica los datos ingresados y vuelve a intentarlo</p>
              </div>
            </div>
          </div>
        )}

        <div className="p-6">
          <div className="bg-slate-50 rounded-xl p-6 mb-6 border border-slate-200">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h4 className="text-xl font-bold text-slate-800 mb-1">Información Básica</h4>
                <p className="text-sm text-slate-600">Datos principales de la ruleta</p>
              </div>
              <div className="text-xs text-slate-500 bg-white px-3 py-1 rounded-full">
                Campos obligatorios (*)
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="lg:col-span-1" data-field="name">
                <label className="block text-sm font-bold text-gray-700 mb-3">
                  Título de la Ruleta *
                  <span className="text-xs font-normal text-gray-500 ml-2">
                    (Nombre que verán los participantes)
                  </span>
                </label>
                <input
                  value={currentEditing.name || ""}
                  onChange={(e) => {
                    setEditing?.((prev) => ({ ...(prev || DEFAULT_EDITING), name: e.target.value }));
                    if (validationErrors.name) setValidationErrors((p) => ({ ...p, name: null }));
                  }}
                  className={`w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200 ${
                    validationErrors.name
                      ? "border-red-300 bg-red-50 focus:border-red-500 focus:ring-red-200"
                      : "border-gray-300 hover:border-gray-400 focus:bg-white"
                  }`}
                  placeholder="ej: Ruleta de Navidad 2025 - ¡Grandes premios!"
                  maxLength={200}
                  disabled={loading}
                  required
                />

                <div className="flex items-center justify-between mt-2">
                  {validationErrors.name && (
                    <p className="text-sm text-red-600 flex items-center">
                      <AlertCircle className="h-4 w-4 mr-1" />
                      {validationErrors.name}
                    </p>
                  )}
                  <span
                    className={`text-xs ${
                      (currentEditing.name?.length || 0) > 180
                        ? "text-orange-600 font-medium"
                        : "text-gray-500"
                    }`}
                  >
                    {currentEditing.name?.length || 0}/200 caracteres
                  </span>
                </div>
              </div>

              <div data-field="status">
                <label className="block text-sm font-bold text-gray-700 mb-3">
                  Estado de la Ruleta *
                  <span className="text-xs font-normal text-gray-500 ml-2">
                    (Define la visibilidad y comportamiento)
                  </span>
                </label>
                <div className="relative">
                  <select
                    value={currentEditing.status || "draft"}
                    onChange={(e) =>
                      setEditing?.((prev) => ({
                        ...(prev || DEFAULT_EDITING),
                        status: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none hover:border-gray-400 transition-all duration-200 appearance-none bg-white"
                    disabled={loading}
                  >
                    {statusOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                    <svg
                      className="h-4 w-4 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
                {currentStatus && (
                  <p className="mt-2 text-xs text-gray-600 bg-white px-3 py-2 rounded-lg border">
                    <Info className="h-3 w-3 inline mr-1" />
                    {currentStatus.description}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-6" data-field="description">
              <label className="block text-sm font-bold text-gray-700 mb-3">
                Descripción de la Ruleta
                <span className="text-xs font-normal text-gray-500 ml-2">
                  (Los enlaces y correos se detectan automáticamente)
                </span>
              </label>

              <SimpleTextEditor
                value={currentEditing.description || ""}
                onChange={(v) => {
                  setEditing?.((prev) => ({ ...(prev || DEFAULT_EDITING), description: v }));
                  if (validationErrors.description)
                    setValidationErrors((p) => ({ ...p, description: null }));
                }}
                placeholder={`¡Bienvenidos a la Ruleta de Premios!

Participa de forma segura y transparente. Para no perderte sorteos y resultados:

YouTube: https://youtube.com/@TuCanal
Instagram: https://instagram.com/TuCuenta
Facebook: https://facebook.com/Tucuenta
Contacto: contacto@tudominio.com

¡Suscríbete y activa la campanita para recibir notificaciones!`}
                disabled={loading}
                maxLength={5000}
                validationError={validationErrors.description || descriptionValidationError}
                onValidationChange={setDescriptionValidationError}
              />

              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setEditing?.((prev) => ({
                      ...(prev || DEFAULT_EDITING),
                      description: getDefaultDescription(),
                    }))
                  }
                  className="text-xs px-3 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200"
                  disabled={loading}
                >
                  Usar plantilla
                </button>
              </div>

              {validationErrors.description && (
                <div className="mt-3 p-4 bg-red-50 border-l-4 border-red-400 rounded-r-lg">
                  <div className="flex items-start space-x-2">
                    <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-red-800">Error en la descripción</p>
                      <p className="text-sm text-red-600 mt-1">{validationErrors.description}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-6 mb-6 border border-slate-200">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h4 className="text-xl font-bold text-slate-800 mb-1">Imagen de Portada</h4>
                <p className="text-sm text-slate-600">Imagen principal que representa tu ruleta</p>
              </div>
              <div className="text-xs text-slate-500 bg-white px-3 py-1 rounded-full">Opcional</div>
            </div>

            <div className="flex flex-col xl:flex-row items-start gap-6">
              <div className="w-full xl:w-80 h-48 rounded-2xl overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center border-2 border-dashed border-gray-300 relative group">
                {previewSrc ? (
                  <>
                    <img
                      src={previewSrc}
                      alt="Vista previa de portada"
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 flex items-center justify-center">
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-white/90 px-3 py-2 rounded-lg text-sm font-medium text-gray-700">
                        Vista previa
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-gray-400 text-center p-6">
                    <ImageIcon className="h-12 w-12 mx-auto mb-3 opacity-60" />
                    <p className="text-sm font-medium mb-1">Sin imagen de portada</p>
                    <p className="text-xs">Sube una imagen atractiva</p>
                  </div>
                )}
              </div>

              <div className="flex-1 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={onPickFile}
                    disabled={loading}
                    className="inline-flex items-center justify-center px-4 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-white text-sm font-bold hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 transition-all duration-200 shadow-md"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {currentEditing.cover_image || currentEditing.cover_url ? "Cambiar" : "Subir"}
                  </button>

                  {(currentEditing.cover_image ||
                    (!currentEditing.cover_delete && currentEditing.cover_url)) && (
                    <button
                      type="button"
                      onClick={clearCover}
                      disabled={loading}
                      className="inline-flex items-center justify-center px-4 py-3 rounded-xl bg-gray-100 text-gray-700 text-sm font-bold hover:bg-gray-200 disabled:opacity-50 transition-all duration-200"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Quitar
                    </button>
                  )}
                </div>

                <div className="bg-white p-3 rounded-lg border text-xs text-gray-600">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="font-medium">Formatos:</span> JPG, PNG, WebP
                    </div>
                    <div>
                      <span className="font-medium">Max:</span> {MAX_MB} MB
                    </div>
                  </div>
                </div>

                <input
                  ref={fileRef}
                  type="file"
                  accept={ALLOWED.join(",")}
                  className="hidden"
                  onChange={onFileChange}
                />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-6 mb-6 border border-slate-200">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h4 className="text-xl font-bold text-slate-800 mb-1">Programación Temporal</h4>
                  <p className="text-sm text-slate-600">
                    Configura cuándo inicia, termina la participación y cuándo sortearás
                  </p>
                </div>
              </div>
              <div className="text-xs text-slate-500 bg-white px-3 py-1 rounded-full">Todas opcionales</div>
            </div>

            <div className="mb-6 p-4 bg-amber-50 border-l-4 border-amber-400 rounded-r-lg">
              <div className="flex items-start space-x-3">
                <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h5 className="text-sm font-bold text-amber-800 mb-2">Importante sobre los sorteos</h5>
                  <p className="text-sm text-amber-700">
                    El sorteo <strong>NO es automático</strong>. Debes ejecutarlo manualmente desde el panel de administración 
                    usando el botón "Ejecutar sorteo". La fecha programada es solo una referencia de cuándo planeas realizar el sorteo.
                  </p>
                </div>
              </div>
            </div>

            <div className="mb-6 space-y-3">
              {!currentEditing.participation_start && !currentEditing.participation_end && (
                <div className="p-3 bg-blue-50 border-l-4 border-blue-400 rounded-r-lg">
                  <div className="flex items-start space-x-2">
                    <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-blue-800">
                      <strong>Opcional:</strong> Puedes configurar fechas de inicio y fin para controlar cuándo los usuarios pueden participar.
                    </div>
                  </div>
                </div>
              )}

              {currentEditing.participation_start && !currentEditing.participation_end && (
                <div className="p-3 bg-orange-50 border-l-4 border-orange-400 rounded-r-lg">
                  <div className="flex items-start space-x-2">
                    <AlertCircle className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-orange-800">
                      <strong>Incompleto:</strong> Has definido cuándo inicia la participación, pero falta definir cuándo cierra. 
                      Define la fecha de fin para activar el cronómetro.
                    </div>
                  </div>
                </div>
              )}

              {!currentEditing.participation_start && currentEditing.participation_end && (
                <div className="p-3 bg-orange-50 border-l-4 border-orange-400 rounded-r-lg">
                  <div className="flex items-start space-x-2">
                    <AlertCircle className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-orange-800">
                      <strong>Incompleto:</strong> Has definido cuándo cierra la participación, pero falta definir cuándo inicia. 
                      Define la fecha de inicio para activar el cronómetro.
                    </div>
                  </div>
                </div>
              )}

              {currentEditing.scheduled_date && (!currentEditing.participation_start || !currentEditing.participation_end) && (
                <div className="p-3 bg-red-50 border-l-4 border-red-400 rounded-r-lg">
                  <div className="flex items-start space-x-2">
                    <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-red-800">
                      <strong>Error:</strong> Para programar un sorteo, primero debes configurar las fechas de inicio y fin de participación.
                    </div>
                  </div>
                </div>
              )}

              {currentEditing.participation_start && 
               currentEditing.participation_end && 
               new Date(currentEditing.participation_start) < new Date(currentEditing.participation_end) && (
                <div className="p-3 bg-green-50 border-l-4 border-green-400 rounded-r-lg">
                  <div className="flex items-start space-x-2">
                    <Clock className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-green-800">
                      <strong>Configuración correcta:</strong> El cronómetro de participación está activo y funcionando.
                      {currentEditing.scheduled_date && " El sorteo está programado correctamente."}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {(currentEditing.participation_start || currentEditing.participation_end) && (
              <div className="mb-6 p-4 bg-white rounded-xl border border-blue-200 shadow-sm">
                <h5 className="text-sm font-bold text-blue-800 mb-3 flex items-center">
                  <Clock className="h-4 w-4 mr-2" />
                  Estado de participación
                </h5>
                <div className="space-y-3">
                  {currentEditing.participation_end && currentEditing.participation_start && (
                    <CountdownTimer
                      startDate={currentEditing.participation_start}
                      endDate={currentEditing.participation_end}
                      className="block"
                    />
                  )}
                </div>
              </div>
            )}

            {currentEditing.scheduled_date && (
              <div className="mb-6 p-4 bg-purple-50 rounded-xl border border-purple-200 shadow-sm">
                <h5 className="text-sm font-bold text-purple-800 mb-3 flex items-center">
                  <Calendar className="h-4 w-4 mr-2" />
                  Fecha de sorteo programada
                </h5>
                <ScheduledDateDisplay
                  targetDate={currentEditing.scheduled_date}
                  label="Fecha del sorteo"
                  className="block"
                />
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div data-field="participation_start">
                <label className="block text-sm font-bold text-gray-700 mb-3">
                  Inicio de Participación
                  <span className="text-xs font-normal text-gray-500 ml-2">(Opcional)</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Calendar className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="datetime-local"
                    value={formatDateTimeLocal(currentEditing.participation_start)}
                    onChange={(e) => {
                      setEditing?.((prev) => ({
                        ...(prev || DEFAULT_EDITING),
                        participation_start: e.target.value,
                      }));
                      if (validationErrors.participation_start) {
                        setValidationErrors((p) => ({ ...p, participation_start: null }));
                      }
                    }}
                    className={`w-full pl-12 pr-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none hover:border-gray-400 transition-all duration-200 bg-white ${
                      validationErrors.participation_start ? "border-red-300 bg-red-50" : "border-gray-300"
                    }`}
                    disabled={loading}
                  />
                </div>
                {validationErrors.participation_start && (
                  <p className="mt-2 text-xs text-red-600 flex items-center bg-red-50 px-3 py-2 rounded-lg">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    {validationErrors.participation_start}
                  </p>
                )}
                <p className="mt-2 text-xs text-gray-500 bg-white px-3 py-2 rounded-lg">
                  <Clock className="h-3 w-3 inline mr-1" />
                  Cuándo ABRE la participación (hora local: {Intl.DateTimeFormat().resolvedOptions().timeZone})
                </p>
              </div>

              <div data-field="participation_end">
                <label className="block text-sm font-bold text-gray-700 mb-3">
                  Fin de Participación
                  <span className="text-xs font-normal text-gray-500 ml-2">(Opcional)</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Calendar className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="datetime-local"
                    value={formatDateTimeLocal(currentEditing.participation_end)}
                    onChange={(e) => {
                      setEditing?.((prev) => ({
                        ...(prev || DEFAULT_EDITING),
                        participation_end: e.target.value,
                      }));
                      if (validationErrors.participation_end) {
                        setValidationErrors((p) => ({ ...p, participation_end: null }));
                      }
                    }}
                    className={`w-full pl-12 pr-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none hover:border-gray-400 transition-all duration-200 bg-white ${
                      validationErrors.participation_end ? "border-red-300 bg-red-50" : "border-gray-300"
                    }`}
                    disabled={loading}
                  />
                </div>
                {validationErrors.participation_end && (
                  <p className="mt-2 text-xs text-red-600 flex items-center bg-red-50 px-3 py-2 rounded-lg">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    {validationErrors.participation_end}
                  </p>
                )}
                <p className="mt-2 text-xs text-gray-500 bg-white px-3 py-2 rounded-lg">
                  <Clock className="h-3 w-3 inline mr-1" />
                  Cuándo CIERRA la participación (hora local: {Intl.DateTimeFormat().resolvedOptions().timeZone})
                </p>
              </div>

              <div data-field="scheduled_date">
                <label className="block text-sm font-bold text-gray-700 mb-3">
                  Fecha del Sorteo
                  <span className="text-xs font-normal text-gray-500 ml-2">(Opcional)</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Calendar className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="datetime-local"
                    value={formatDateTimeLocal(currentEditing.scheduled_date)}
                    onChange={(e) => {
                      setEditing?.((prev) => ({
                        ...(prev || DEFAULT_EDITING),
                        scheduled_date: e.target.value,
                      }));
                      if (validationErrors.scheduled_date) {
                        setValidationErrors((p) => ({ ...p, scheduled_date: null }));
                      }
                    }}
                    className={`w-full pl-12 pr-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none hover:border-gray-400 transition-all duration-200 bg-white ${
                      validationErrors.scheduled_date ? "border-red-300 bg-red-50" : "border-gray-300"
                    }`}
                    disabled={loading}
                  />
                </div>
                {validationErrors.scheduled_date && (
                  <p className="mt-2 text-xs text-red-600 flex items-center bg-red-50 px-3 py-2 rounded-lg">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    {validationErrors.scheduled_date}
                  </p>
                )}
                <p className="mt-2 text-xs text-gray-500 bg-white px-3 py-2 rounded-lg">
                  <Calendar className="h-3 w-3 inline mr-1" />
                  Cuándo EJECUTARÁS el sorteo - manual (hora local: {Intl.DateTimeFormat().resolvedOptions().timeZone})
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-5 border-t-2 border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100 flex items-center justify-between sticky bottom-0 backdrop-blur-sm">
          <div className="flex items-center space-x-4">
            <div className="flex items-center text-sm text-gray-500">
              <Info className="h-4 w-4 mr-2" />
              Los campos marcados con (*) son obligatorios
            </div>

            {!isFormValid() && (
              <div className="flex items-center text-sm text-amber-600 bg-amber-50 px-3 py-1 rounded-full">
                <AlertCircle className="h-4 w-4 mr-2" />
                Faltan campos obligatorios
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={onClose}
              className="px-6 py-3 rounded-xl bg-white text-gray-700 border-2 border-gray-300 hover:bg-gray-50 hover:border-gray-400 font-medium transition-all duration-200 shadow-md"
              disabled={loading}
            >
              Cancelar
            </button>

            <button
              onClick={handleSave}
              disabled={loading || !isFormValid()}
              className="inline-flex items-center px-8 py-3 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white font-bold hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transition-all duration-200 transform hover:-translate-y-0.5"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <Save className="h-5 w-5 mr-2" />
                  <span>{currentEditing.id ? "Actualizar Ruleta" : "Crear Ruleta"}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RouletteModal;