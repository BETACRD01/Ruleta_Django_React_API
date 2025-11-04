/* ================================
   IMPORTS Y DEPENDENCIAS
================================ */
import React, { useEffect, useRef, useState } from "react";
import {
  X, Upload, ImageIcon, Trash2, Save, Calendar,
  AlertCircle, Info, Clock, Timer, CalendarCheck
} from "lucide-react";
import '../../../styles/ckeditor-custom.css';
import CKEditorWrapper from '../../CKEditorWrapper';

/* ================================
   CONSTANTES Y CONFIGURACIONES
================================ */
const MAX_MB = 5;
const ALLOWED = [".jpg", ".jpeg", ".png", ".webp"];

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
   ✅ FUNCIONES DE FECHAS
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

const formatDateTimeLocal = (dateString) => {
  if (!dateString) return "";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "";

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${year}-${month}-${day}T${hours}:${minutes}`;
  } catch {
    return "";
  }
};

const parseDateTimeLocal = (dateTimeLocalString) => {
  if (!dateTimeLocalString) return null;
  try {
    const [datePart, timePart] = dateTimeLocalString.split('T');
    if (!datePart || !timePart) return null;
    
    const [year, month, day] = datePart.split('-').map(Number);
    const [hours, minutes] = timePart.split(':').map(Number);
    
    const localDate = new Date(year, month - 1, day, hours, minutes, 0, 0);
    
    if (isNaN(localDate.getTime())) return null;
    
    return localDate.toISOString();
  } catch (error) {
    console.error('Error parsing datetime-local:', error);
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
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border ${
      isPast 
        ? "bg-gray-50 text-gray-700 border-gray-300" 
        : "bg-blue-50 text-blue-700 border-blue-200"
    } ${className}`}>
      <CalendarCheck className="w-4 h-4" />
      <span className="text-xs font-medium">{label}:</span>
      <span className="font-semibold">{formatDate(targetDate)}</span>
      {isPast && <span className="text-xs">(Ya pasó)</span>}
    </div>
  );
};

/* =========================
   Cronómetro con 3 fases
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
      return "bg-red-50 text-red-700 border-red-200";
    }
    
    if (timeLeft.phase === 'waiting') {
      return "bg-blue-50 text-blue-700 border-blue-200";
    }

    const totalMinutes = timeLeft.days * 24 * 60 + timeLeft.hours * 60 + timeLeft.minutes;
    
    if (totalMinutes < 60) return "bg-red-50 text-red-700 border-red-200";
    if (totalMinutes < 1440) return "bg-orange-50 text-orange-700 border-orange-200";
    return "bg-green-50 text-green-700 border-green-200";
  };

  const getMessage = () => {
    if (timeLeft.phase === 'expired') return '¡Cerrado!';
    if (timeLeft.phase === 'waiting') return 'Inicia en';
    return 'Cierra en';
  };

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border ${getUrgencyStyles()} ${className}`}>
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
            {timeLeft.days > 0 && <span className="font-semibold">{timeLeft.days}d</span>}
            {(timeLeft.days > 0 || timeLeft.hours > 0) && <span className="font-semibold">{timeLeft.hours}h</span>}
            <span className="font-semibold">{timeLeft.minutes}m</span>
            <span className="font-semibold">{timeLeft.seconds}s</span>
          </div>
        </>
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

    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    if (!currentEditing.id) {
      if (participationStart && participationStart < oneWeekAgo) {
        errors.participation_start = "Para ruletas nuevas, la fecha de inicio no puede ser más de 1 semana en el pasado";
      }

      if (participationEnd && participationEnd < oneWeekAgo) {
        errors.participation_end = "Para ruletas nuevas, la fecha de fin no puede ser más de 1 semana en el pasado";
      }

      if (scheduledDate && scheduledDate < oneWeekAgo) {
        errors.scheduled_date = "Para ruletas nuevas, la fecha del sorteo no puede ser más de 1 semana en el pasado";
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

  const handleSave = () => {
    if (!validateAndFocus()) return;

    const dataToSend = {
      id: currentEditing.id || undefined,
      name: currentEditing.name?.trim(),
      description: currentEditing.description || "",
      status: currentEditing.status,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-5xl bg-white rounded-xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-700 to-slate-800 px-6 py-4 flex items-center justify-between border-b border-slate-600">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 bg-white/10 rounded-lg flex items-center justify-center">
              <Save className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">
                {currentEditing.id ? "Editar Ruleta" : "Nueva Ruleta"}
              </h3>
              <p className="text-slate-300 text-sm">
                {currentEditing.id ? `ID: ${currentEditing.id}` : "Completa los datos"}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {currentEditing.id && currentStatus && (
              <div
                className={`px-2.5 py-1 rounded-md text-xs font-medium ${
                  currentStatus.color === "text-green-600"
                    ? "bg-green-100 text-green-700"
                    : currentStatus.color === "text-blue-600"
                    ? "bg-blue-100 text-blue-700"
                    : currentStatus.color === "text-purple-600"
                    ? "bg-purple-100 text-purple-700"
                    : currentStatus.color === "text-red-600"
                    ? "bg-red-100 text-red-700"
                    : "bg-gray-100 text-gray-700"
                }`}
              >
                {currentStatus.label}
              </div>
            )}

            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/10 text-white transition-colors"
              disabled={loading}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start space-x-2">
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-red-800">Error</h4>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Contenido scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Información Básica */}
          <div className="bg-gray-50 rounded-lg p-5 border border-gray-200">
            <h4 className="text-base font-semibold text-gray-900 mb-4">Información Básica</h4>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div data-field="name">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Título *
                </label>
                <input
                  value={currentEditing.name || ""}
                  onChange={(e) => {
                    setEditing?.((prev) => ({ ...(prev || DEFAULT_EDITING), name: e.target.value }));
                    if (validationErrors.name) setValidationErrors((p) => ({ ...p, name: null }));
                  }}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none transition ${
                    validationErrors.name
                      ? "border-red-300 bg-red-50"
                      : "border-gray-300"
                  }`}
                  placeholder="ej: Ruleta de Navidad 2025"
                  maxLength={200}
                  disabled={loading}
                  required
                />
                {validationErrors.name && (
                  <p className="text-xs text-red-600 mt-1 flex items-center">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    {validationErrors.name}
                  </p>
                )}
                <span className="text-xs text-gray-500 mt-1 block">
                  {currentEditing.name?.length || 0}/200 caracteres
                </span>
              </div>

              <div data-field="status">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Estado *
                </label>
                <select
                  value={currentEditing.status || "draft"}
                  onChange={(e) =>
                    setEditing?.((prev) => ({
                      ...(prev || DEFAULT_EDITING),
                      status: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none transition bg-white"
                  disabled={loading}
                >
                  {statusOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                {currentStatus && (
                  <p className="mt-2 text-xs text-gray-600 bg-white px-2 py-1.5 rounded border border-gray-200">
                    {currentStatus.description}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-4" data-field="description">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Descripción
              </label>
              <CKEditorWrapper
                value={currentEditing.description || ""}
                onChange={(v) => {
                  setEditing?.((prev) => ({ ...(prev || DEFAULT_EDITING), description: v }));
                  if (validationErrors.description)
                    setValidationErrors((p) => ({ ...p, description: null }));
                }}
                placeholder="Describe tu ruleta, incluye enlaces y contactos..."
                disabled={loading}
                maxLength={5000}
                validationError={validationErrors.description || descriptionValidationError}
                onValidationChange={setDescriptionValidationError}
              />
              {validationErrors.description && (
                <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700 flex items-start">
                  <AlertCircle className="h-4 w-4 mr-1 flex-shrink-0 mt-0.5" />
                  <span>{validationErrors.description}</span>
                </div>
              )}
            </div>
          </div>

          {/* Imagen de Portada */}
          <div className="bg-gray-50 rounded-lg p-5 border border-gray-200">
            <h4 className="text-base font-semibold text-gray-900 mb-4">Imagen de Portada</h4>

            <div className="flex flex-col lg:flex-row items-start gap-4">
              <div className="w-full lg:w-64 h-40 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center border-2 border-dashed border-gray-300">
                {previewSrc ? (
                  <img
                    src={previewSrc}
                    alt="Vista previa"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="text-gray-400 text-center p-4">
                    <ImageIcon className="h-10 w-10 mx-auto mb-2 opacity-50" />
                    <p className="text-xs">Sin imagen</p>
                  </div>
                )}
              </div>

              <div className="flex-1 space-y-3">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={onPickFile}
                    disabled={loading}
                    className="inline-flex items-center px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition"
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
                      className="inline-flex items-center px-4 py-2 rounded-lg bg-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-300 disabled:opacity-50 transition"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Quitar
                    </button>
                  )}
                </div>

                <div className="bg-white p-3 rounded border border-gray-200 text-xs text-gray-600">
                  <div className="space-y-1">
                    <div><span className="font-medium">Formatos:</span> JPG, PNG, WebP</div>
                    <div><span className="font-medium">Tamaño máximo:</span> {MAX_MB} MB</div>
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

          {/* Programación Temporal */}
          <div className="bg-gray-50 rounded-lg p-5 border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <Calendar className="h-5 w-5 text-gray-600" />
                <h4 className="text-base font-semibold text-gray-900">Programación Temporal</h4>
              </div>
              <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded border border-gray-200">
                Opcionales
              </span>
            </div>

            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start space-x-2">
                <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-amber-800">
                  <strong>Importante:</strong> El sorteo NO es automático. Debes ejecutarlo manualmente desde el panel de administración.
                </div>
              </div>
            </div>

            {(currentEditing.participation_start || currentEditing.participation_end) && (
              <div className="mb-4 p-3 bg-white rounded-lg border border-gray-200">
                <h5 className="text-xs font-semibold text-gray-700 mb-2 flex items-center">
                  <Clock className="h-3.5 w-3.5 mr-1" />
                  Estado de participación
                </h5>
                {currentEditing.participation_end && currentEditing.participation_start && (
                  <CountdownTimer
                    startDate={currentEditing.participation_start}
                    endDate={currentEditing.participation_end}
                  />
                )}
              </div>
            )}

            {currentEditing.scheduled_date && (
              <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <h5 className="text-xs font-semibold text-blue-800 mb-2 flex items-center">
                  <Calendar className="h-3.5 w-3.5 mr-1" />
                  Fecha programada
                </h5>
                <ScheduledDateDisplay
                  targetDate={currentEditing.scheduled_date}
                  label="Sorteo"
                />
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div data-field="participation_start">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Inicio de Participación
                </label>
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
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none transition bg-white ${
                    validationErrors.participation_start ? "border-red-300 bg-red-50" : "border-gray-300"
                  }`}
                  disabled={loading}
                />
                {validationErrors.participation_start && (
                  <p className="mt-1 text-xs text-red-600 flex items-center">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    {validationErrors.participation_start}
                  </p>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  Cuándo abre la participación
                </p>
              </div>

              <div data-field="participation_end">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fin de Participación
                </label>
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
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none transition bg-white ${
                    validationErrors.participation_end ? "border-red-300 bg-red-50" : "border-gray-300"
                  }`}
                  disabled={loading}
                />
                {validationErrors.participation_end && (
                  <p className="mt-1 text-xs text-red-600 flex items-center">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    {validationErrors.participation_end}
                  </p>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  Cuándo cierra la participación
                </p>
              </div>

              <div data-field="scheduled_date">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fecha del Sorteo
                </label>
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
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none transition bg-white ${
                    validationErrors.scheduled_date ? "border-red-300 bg-red-50" : "border-gray-300"
                  }`}
                  disabled={loading}
                />
                {validationErrors.scheduled_date && (
                  <p className="mt-1 text-xs text-red-600 flex items-center">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    {validationErrors.scheduled_date}
                  </p>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  Cuándo ejecutarás el sorteo (manual)
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          <div className="flex items-center text-xs text-gray-600">
            <Info className="h-4 w-4 mr-1" />
            Campos obligatorios (*)
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-lg bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 font-medium transition text-sm"
              disabled={loading}
            >
              Cancelar
            </button>

            <button
              onClick={handleSave}
              disabled={loading || !isFormValid()}
              className="inline-flex items-center px-6 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition text-sm"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  <span>{currentEditing.id ? "Actualizar" : "Crear"}</span>
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