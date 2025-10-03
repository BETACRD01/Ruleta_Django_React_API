"use client"

/* ================================
   IMPORTS Y DEPENDENCIAS
================================ */
import { useEffect, useRef, useState, useCallback } from "react"
import { X, Upload, ImageIcon, Trash2, Save, Calendar, AlertCircle, Info, Clock, FileText, Eye } from "lucide-react"

/* ================================
   CONSTANTES Y CONFIGURACIONES
================================ */
const MAX_MB = 5
const ALLOWED = [".jpg", ".jpeg", ".png", ".webp"]
const LINK_COLOR_CLASS = "text-blue-600 underline hover:no-underline"

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
}

/* ================================
   COMPONENTE CRONÓMETRO
================================ */
const CountdownTimer = ({ targetDate, label, className = "" }) => {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isExpired: false,
    isActive: false,
  })

  useEffect(() => {
    if (!targetDate) {
      setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: false, isActive: false })
      return
    }

    const updateTimer = () => {
      const now = new Date().getTime()
      const target = new Date(targetDate).getTime()
      const difference = target - now

      if (difference <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true, isActive: false })
        return
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24))
      const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((difference % (1000 * 60)) / 1000)

      setTimeLeft({ days, hours, minutes, seconds, isExpired: false, isActive: true })
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    return () => clearInterval(interval)
  }, [targetDate])

  if (!timeLeft.isActive && !timeLeft.isExpired) return null

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <Clock className="h-3.5 w-3.5 text-blue-600" />
      <span className="text-xs font-medium text-gray-600">{label}:</span>
      {timeLeft.isExpired ? (
        <span className="text-xs font-bold text-red-600">¡Terminado!</span>
      ) : (
        <div className="flex items-center gap-1">
          {timeLeft.days > 0 && (
            <span className="bg-blue-600 text-white px-1.5 py-0.5 rounded text-xs font-bold min-w-[28px] text-center">
              {timeLeft.days}d
            </span>
          )}
          <span className="bg-blue-600 text-white px-1.5 py-0.5 rounded text-xs font-bold min-w-[28px] text-center">
            {String(timeLeft.hours).padStart(2, "0")}h
          </span>
          <span className="bg-blue-600 text-white px-1.5 py-0.5 rounded text-xs font-bold min-w-[28px] text-center">
            {String(timeLeft.minutes).padStart(2, "0")}m
          </span>
          <span className="bg-blue-600 text-white px-1.5 py-0.5 rounded text-xs font-bold min-w-[28px] text-center">
            {String(timeLeft.seconds).padStart(2, "0")}s
          </span>
        </div>
      )}
    </div>
  )
}

/* ================================
   HELPERS DE TEXTO Y ENLACES
================================ */
const escapeHtml = (s = "") => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

const autoLinkHTML = (plainText) => {
  if (!plainText) return ""
  const text = escapeHtml(plainText)

  const urlRegex = /\b((https?:\/\/|www\.)[^\s<]+)\b/gi
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g

  let html = text.replace(emailRegex, (m) => {
    const href = `mailto:${m}`
    return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="${LINK_COLOR_CLASS}">${m}</a>`
  })

  html = html.replace(urlRegex, (m) => {
    const href = m.startsWith("http") ? m : `https://${m}`
    return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="${LINK_COLOR_CLASS}">${m}</a>`
  })

  html = html.replace(/\n/g, "<br/>")
  return html
}

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
  const [isFocused, setIsFocused] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [preview, setPreview] = useState("")

  const handleChange = useCallback(
    (e) => {
      const newValue = e.target.value
      if (maxLength && newValue.length > maxLength) {
        onValidationChange?.(true)
        return
      } else {
        onValidationChange?.(false)
      }
      onChange(newValue)
    },
    [onChange, maxLength, onValidationChange],
  )

  useEffect(() => {
    setPreview(autoLinkHTML(value || ""))
  }, [value])

  const togglePreview = () => setShowPreview((p) => !p)

  return (
    <div
      className={`bg-white rounded-lg border transition-colors ${
        isFocused ? "border-blue-500 ring-2 ring-blue-100" : validationError ? "border-red-300" : "border-gray-200"
      }`}
    >
      <div className="border-b border-gray-100 bg-gray-50 px-3 py-2 flex items-center justify-between">
        <div className="flex items-center text-xs text-gray-500">
          <FileText className="h-3 w-3 mr-1.5" />
          Enlaces detectados automáticamente
        </div>
        <button
          type="button"
          onClick={togglePreview}
          className="flex items-center text-xs text-blue-600 hover:text-blue-700 px-2 py-1 rounded hover:bg-blue-50 transition-colors"
        >
          <Eye className="h-3 w-3 mr-1" />
          {showPreview ? "Editar" : "Vista previa"}
        </button>
      </div>

      {showPreview ? (
        <div className="p-3">
          <div
            className="min-h-[140px] px-3 py-2 bg-gray-50 rounded text-sm border border-gray-100"
            style={{ lineHeight: "1.6" }}
            dangerouslySetInnerHTML={{ __html: preview }}
          />
          {maxLength && (
            <div className="mt-2 text-right text-xs text-gray-400">
              {value?.length || 0}/{maxLength}
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
            className={`w-full px-3 py-2 border-0 focus:ring-0 focus:outline-none resize-none min-h-[140px] text-sm ${
              validationError ? "bg-red-50" : "bg-white"
            }`}
            placeholder={placeholder || "Escribe aquí tu descripción..."}
            disabled={disabled}
            style={{ lineHeight: "1.6" }}
          />
          {maxLength && (
            <div className="mt-1 text-right text-xs text-gray-400">
              {value?.length || 0}/{maxLength}
            </div>
          )}
        </div>
      )}

      {validationError && (
        <div className="border-t border-gray-100 bg-red-50 px-3 py-2 flex items-center">
          <AlertCircle className="h-3 w-3 mr-1.5 text-red-500" />
          <span className="text-xs text-red-600">Límite de caracteres excedido</span>
        </div>
      )}
    </div>
  )
}

/* ================================
   HELPERS DE ARCHIVOS Y FECHAS
================================ */
const getExt = (name = "") => (name && name.includes(".") ? name.toLowerCase().slice(name.lastIndexOf(".")) : "")

const formatDateTimeLocal = (dateString) => {
  if (!dateString) return ""
  try {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return ""

    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const day = String(date.getDate()).padStart(2, "0")
    const hours = String(date.getHours()).padStart(2, "0")
    const minutes = String(date.getMinutes()).padStart(2, "0")

    return `${year}-${month}-${day}T${hours}:${minutes}`
  } catch {
    return ""
  }
}

const parseDateTimeLocal = (dateTimeLocalString) => {
  if (!dateTimeLocalString) return null
  try {
    const localDate = new Date(dateTimeLocalString)
    return localDate.toISOString()
  } catch {
    return null
  }
}

/* ================================
   MODAL PRINCIPAL - COMPONENTE ROULETTE MODAL
================================ */
const RouletteModal = ({
  isOpen,
  onClose,
  editing,
  setEditing,
  onSave,
  loading,
  error = null,
  apiBaseURL = process.env.REACT_APP_API_URL || "http://localhost:8000/api",
  authToken = null,
  currentUser = null,
}) => {
  const fileRef = useRef(null)
  const [validationErrors, setValidationErrors] = useState({})
  const [descriptionValidationError, setDescriptionValidationError] = useState(false)

  const currentEditing = editing || DEFAULT_EDITING

  const getDefaultDescription = () => {
    return ``
  }

  useEffect(() => {
    if (!isOpen) {
      setValidationErrors({})
      setDescriptionValidationError(false)
      return
    }

    if (!currentEditing.id && !currentEditing.description && setEditing) {
      setEditing((prev) => ({
        ...DEFAULT_EDITING,
        ...prev,
        description: getDefaultDescription(),
      }))
    }
  }, [isOpen, currentEditing.id, currentEditing.description, setEditing])

  if (!isOpen) return null

  const getValidationErrors = () => {
    const errors = {}

    const nameTrim = (currentEditing.name || "").trim()
    if (!nameTrim) {
      errors.name = "El título es obligatorio"
    } else if (nameTrim.length < 3) {
      errors.name = "El título debe tener al menos 3 caracteres"
    } else if (nameTrim.length > 200) {
      errors.name = "El título no puede exceder los 200 caracteres"
    }

    if (currentEditing.description && currentEditing.description.length > 5000) {
      errors.description = "La descripción no puede exceder los 5,000 caracteres"
    }

    const now = new Date()
    const isEditingExisting = !!currentEditing.id

    const participationStart = currentEditing.participation_start ? new Date(currentEditing.participation_start) : null
    const participationEnd = currentEditing.participation_end ? new Date(currentEditing.participation_end) : null
    const scheduledDate = currentEditing.scheduled_date ? new Date(currentEditing.scheduled_date) : null

    if (participationStart && participationEnd && participationStart >= participationEnd) {
      errors.participation_end = "La fecha de fin debe ser posterior al inicio"
    }

    if (scheduledDate && participationEnd && scheduledDate <= participationEnd) {
      errors.scheduled_date = "El sorteo debe ser después del fin de participación"
    }

    if (!isEditingExisting) {
      if (participationStart && participationStart <= now) {
        errors.participation_start = "El inicio de participación debe ser futuro para nuevas ruletas"
      }
      if (scheduledDate && scheduledDate <= now) {
        errors.scheduled_date = "La fecha de sorteo debe ser futura para nuevas ruletas"
      }
    }

    return errors
  }

  const validateAndFocus = () => {
    const errors = getValidationErrors()
    setValidationErrors(errors)

    if (Object.keys(errors).length > 0) {
      const firstError = Object.keys(errors)[0]
      const el = document.querySelector(`[data-field="${firstError}"]`)
      if (el && typeof el.scrollIntoView === "function") {
        el.scrollIntoView({ behavior: "smooth", block: "center" })
        const focusable = el.querySelector("input,textarea,select,button")
        focusable?.focus?.()
      }
      return false
    }
    return true
  }

  const isFormValid = () => {
    const errs = getValidationErrors()
    return (
      (currentEditing.name || "").trim().length >= 3 &&
      (currentEditing.name || "").trim().length <= 200 &&
      !descriptionValidationError &&
      Object.keys(errs).length === 0
    )
  }

  const onPickFile = () => fileRef.current?.click()

  const onFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const ext = getExt(file.name)
    if (!ALLOWED.includes(ext)) {
      alert(`Formato no permitido: ${ext}. Formatos permitidos: ${ALLOWED.join(", ")}`)
      e.target.value = ""
      return
    }

    if (file.size > MAX_MB * 1024 * 1024) {
      alert(`Archivo demasiado grande. Tamaño máximo permitido: ${MAX_MB} MB.`)
      e.target.value = ""
      return
    }

    const reader = new FileReader()
    reader.onload = (ev) => {
      setEditing?.((prev) => ({
        ...(prev || DEFAULT_EDITING),
        cover_image: file,
        cover_preview: String(ev.target?.result || ""),
        cover_delete: false,
      }))
    }
    reader.onerror = () => {
      alert("Error al leer el archivo. Inténtalo de nuevo.")
      e.target.value = ""
    }
    reader.readAsDataURL(file)
  }

  const clearCover = () => {
    if (!setEditing) return

    if (currentEditing.cover_url && !currentEditing.cover_image) {
      setEditing((prev) => ({
        ...(prev || DEFAULT_EDITING),
        cover_delete: true,
        cover_preview: "",
        cover_image: null,
      }))
    } else {
      setEditing((prev) => ({
        ...(prev || DEFAULT_EDITING),
        cover_image: null,
        cover_preview: "",
        cover_delete: false,
      }))
    }

    if (fileRef.current) fileRef.current.value = ""
  }

  const getPreviewSrc = () => {
    if (currentEditing.cover_preview) return currentEditing.cover_preview
    if (currentEditing.cover_delete) return null
    if (currentEditing.cover_url) return currentEditing.cover_url
    return null
  }

  const handleSave = () => {
    if (!validateAndFocus()) return

    const dataToSend = {
      id: currentEditing.id || undefined,
      name: currentEditing.name?.trim(),
      description: currentEditing.description || "",
      status: currentEditing.status,
      participation_start: currentEditing.participation_start
        ? parseDateTimeLocal(currentEditing.participation_start)
        : null,
      participation_end: currentEditing.participation_end ? parseDateTimeLocal(currentEditing.participation_end) : null,
      scheduled_date: currentEditing.scheduled_date ? parseDateTimeLocal(currentEditing.scheduled_date) : null,
    }

    if (currentEditing.cover_image) {
      dataToSend.cover_image = currentEditing.cover_image
    } else if (currentEditing.cover_delete) {
      dataToSend.cover_delete = true
    }

    console.log("Datos a enviar:", dataToSend)
    onSave(dataToSend)
  }

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
  ]

  const currentStatus = statusOptions.find((s) => s.value === currentEditing.status)
  const previewSrc = getPreviewSrc()

  /* ================================
     RENDERIZADO DEL COMPONENTE
  ================================ */
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-5xl bg-white rounded-xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* HEADER */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3.5 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
              <Save className="h-4 w-4 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">
                {currentEditing.id ? "Editar Ruleta" : "Crear Nueva Ruleta"}
              </h3>
              <p className="text-blue-100 text-xs">
                {currentEditing.id ? `ID: ${currentEditing.id}` : "Formulario de creación"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {currentEditing.id && currentStatus && (
              <div
                className={`px-2.5 py-1 rounded-full text-xs font-medium ${
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
              className="p-1.5 rounded-lg hover:bg-white/20 text-white transition-colors"
              disabled={loading}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* ERROR MESSAGE */}
        {error && (
          <div className="mx-5 mt-3 p-3 bg-red-50 border-l-4 border-red-400 rounded-r flex-shrink-0">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-red-800">Error al procesar</h4>
                <p className="text-xs text-red-700 mt-0.5">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* SCROLLABLE CONTENT */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* INFORMACIÓN BÁSICA */}
          <div className="bg-gray-50 rounded-lg p-4 mb-4 border border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-base font-semibold text-gray-800">Información Básica</h4>
              <span className="text-xs text-gray-500 bg-white px-2 py-0.5 rounded-full">Campos obligatorios (*)</span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* TÍTULO */}
              <div data-field="name">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Título de la Ruleta *</label>
                <input
                  value={currentEditing.name || ""}
                  onChange={(e) => {
                    setEditing?.((prev) => ({ ...(prev || DEFAULT_EDITING), name: e.target.value }))
                    if (validationErrors.name) setValidationErrors((p) => ({ ...p, name: null }))
                  }}
                  className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all ${
                    validationErrors.name ? "border-red-300 bg-red-50" : "border-gray-300 hover:border-gray-400"
                  }`}
                  placeholder="ej: Ruleta de Navidad 2025"
                  maxLength={200}
                  disabled={loading}
                  required
                />

                <div className="flex items-center justify-between mt-1">
                  {validationErrors.name && (
                    <p className="text-xs text-red-600 flex items-center">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      {validationErrors.name}
                    </p>
                  )}
                  <span
                    className={`text-xs ml-auto ${
                      (currentEditing.name?.length || 0) > 180 ? "text-orange-600 font-medium" : "text-gray-400"
                    }`}
                  >
                    {currentEditing.name?.length || 0}/200
                  </span>
                </div>
              </div>

              {/* ESTADO */}
              <div data-field="status">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Estado de la Ruleta *</label>
                <div className="relative">
                  <select
                    value={currentEditing.status || "draft"}
                    onChange={(e) =>
                      setEditing?.((prev) => ({
                        ...(prev || DEFAULT_EDITING),
                        status: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none hover:border-gray-400 transition-all appearance-none bg-white"
                    disabled={loading}
                  >
                    {statusOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                    <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
                {currentStatus && (
                  <p className="mt-1 text-xs text-gray-500 bg-white px-2 py-1 rounded border border-gray-100">
                    <Info className="h-3 w-3 inline mr-1" />
                    {currentStatus.description}
                  </p>
                )}
              </div>
            </div>

            {/* DESCRIPCIÓN */}
            <div className="mt-4" data-field="description">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Descripción de la Ruleta</label>

              <SimpleTextEditor
                value={currentEditing.description || ""}
                onChange={(v) => {
                  setEditing?.((prev) => ({ ...(prev || DEFAULT_EDITING), description: v }))
                  if (validationErrors.description) setValidationErrors((p) => ({ ...p, description: null }))
                }}
                placeholder={`¡Bienvenidos a la Ruleta de Premios!

Participa de forma segura y transparente.

YouTube: https://youtube.com/@TuCanal
Instagram: https://instagram.com/TuCuenta

Contacto: contacto@tudominio.com`}
                disabled={loading}
                maxLength={5000}
                validationError={validationErrors.description || descriptionValidationError}
                onValidationChange={setDescriptionValidationError}
              />

              {validationErrors.description && (
                <div className="mt-2 p-2 bg-red-50 border-l-4 border-red-400 rounded-r">
                  <p className="text-xs text-red-600 flex items-center">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    {validationErrors.description}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* IMAGEN DE PORTADA */}
          <div className="bg-gray-50 rounded-lg p-4 mb-4 border border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-base font-semibold text-gray-800">Imagen de Portada</h4>
              <span className="text-xs text-gray-500 bg-white px-2 py-0.5 rounded-full">Opcional</span>
            </div>

            <div className="flex flex-col md:flex-row items-start gap-4">
              {/* PREVIEW */}
              <div className="w-full md:w-64 h-36 rounded-lg overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center border border-gray-300 relative group">
                {previewSrc ? (
                  <>
                    <img
                      src={previewSrc || "/placeholder.svg"}
                      alt="Vista previa"
                      className="w-full h-full object-cover transition-transform group-hover:scale-105"
                      onError={(e) => {
                        console.error("Error cargando imagen:", previewSrc)
                        e.target.style.display = "none"
                      }}
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                  </>
                ) : (
                  <div className="text-gray-400 text-center p-4">
                    <ImageIcon className="h-10 w-10 mx-auto mb-2 opacity-50" />
                    <p className="text-xs">Sin imagen</p>
                  </div>
                )}
              </div>

              {/* CONTROLES */}
              <div className="flex-1 space-y-2">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={onPickFile}
                    disabled={loading}
                    className="flex-1 inline-flex items-center justify-center px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    <Upload className="h-4 w-4 mr-1.5" />
                    {currentEditing.cover_image || currentEditing.cover_url ? "Cambiar" : "Subir"}
                  </button>

                  {(currentEditing.cover_image || (!currentEditing.cover_delete && currentEditing.cover_url)) && (
                    <button
                      type="button"
                      onClick={clearCover}
                      disabled={loading}
                      className="px-3 py-2 rounded-lg bg-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-300 disabled:opacity-50 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div className="bg-white p-2 rounded border border-gray-200 text-xs text-gray-600">
                  <div className="flex justify-between">
                    <span>
                      <strong>Formatos:</strong> JPG, PNG, WebP
                    </span>
                    <span>
                      <strong>Max:</strong> {MAX_MB} MB
                    </span>
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

          {/* PROGRAMACIÓN TEMPORAL */}
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Calendar className="h-4 w-4 text-blue-600" />
                </div>
                <h4 className="text-base font-semibold text-gray-800">Programación Temporal</h4>
              </div>
              <span className="text-xs text-gray-500 bg-white px-2 py-0.5 rounded-full">Opcional</span>
            </div>

            {/* CRONÓMETROS */}
            {(currentEditing.participation_end || currentEditing.scheduled_date) && (
              <div className="mb-3 p-3 bg-white rounded-lg border border-blue-200">
                <h5 className="text-xs font-semibold text-blue-800 mb-2 flex items-center">
                  <Clock className="h-3.5 w-3.5 mr-1.5" />
                  Cronómetros en Tiempo Real
                </h5>
                <div className="space-y-2">
                  {currentEditing.participation_end && (
                    <CountdownTimer
                      targetDate={currentEditing.participation_end}
                      label="Fin de participación"
                      className="block"
                    />
                  )}
                  {currentEditing.scheduled_date && (
                    <CountdownTimer
                      targetDate={currentEditing.scheduled_date}
                      label="Sorteo programado"
                      className="block"
                    />
                  )}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* INICIO DE PARTICIPACIÓN */}
              <div data-field="participation_start" className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Inicio de Participación</label>
                <div className="relative">
                  <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-10 rounded-lg flex items-center justify-center cursor-not-allowed">
                    <span className="text-xs font-medium text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-full border border-yellow-300">
                      Próximamente
                    </span>
                  </div>
                  <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                    <Calendar className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="datetime-local"
                    value=""
                    disabled
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-400 text-sm cursor-not-allowed"
                  />
                </div>
              </div>

              {/* FIN DE PARTICIPACIÓN */}
              <div data-field="participation_end" className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Fin de Participación</label>
                <div className="relative">
                  <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-10 rounded-lg flex items-center justify-center cursor-not-allowed">
                    <span className="text-xs font-medium text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-full border border-yellow-300">
                      Próximamente
                    </span>
                  </div>
                  <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                    <Calendar className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="datetime-local"
                    value=""
                    disabled
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-400 text-sm cursor-not-allowed"
                  />
                </div>
              </div>

              {/* SORTEO PROGRAMADO */}
              <div data-field="scheduled_date">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Sorteo Programado</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                    <Calendar className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="datetime-local"
                    value={formatDateTimeLocal(currentEditing.scheduled_date)}
                    onChange={(e) => {
                      setEditing?.((prev) => ({
                        ...(prev || DEFAULT_EDITING),
                        scheduled_date: e.target.value,
                      }))
                      if (validationErrors.scheduled_date) {
                        setValidationErrors((p) => ({ ...p, scheduled_date: null }))
                      }
                    }}
                    className={`w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none hover:border-gray-400 transition-all bg-white ${
                      validationErrors.scheduled_date ? "border-red-300 bg-red-50" : "border-gray-300"
                    }`}
                    disabled={loading}
                  />
                </div>
                {validationErrors.scheduled_date && (
                  <p className="mt-1 text-xs text-red-600 flex items-center">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    {validationErrors.scheduled_date}
                  </p>
                )}
              </div>
            </div>

            {/* INFO */}
            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-blue-700 space-y-1">
                  <p>
                    <strong>Sin fechas:</strong> Participación inmediata, sorteo manual
                  </p>
                  <p>
                    <strong>Solo sorteo programado:</strong> Sorteo automático en fecha especificada
                  </p>
                  {currentEditing.id && (
                    <p className="text-blue-600 bg-blue-100 px-2 py-1 rounded mt-1">
                      <strong>Modo edición:</strong> Fechas pasadas permitidas
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="px-5 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center text-xs text-gray-500">
              <Info className="h-3.5 w-3.5 mr-1.5" />
              Campos con (*) obligatorios
            </div>

            {!isFormValid() && (
              <div className="flex items-center text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                <AlertCircle className="h-3.5 w-3.5 mr-1.5" />
                Faltan campos
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 hover:border-gray-400 font-medium text-sm transition-colors"
              disabled={loading}
            >
              Cancelar
            </button>

            <button
              onClick={handleSave}
              disabled={loading || !isFormValid()}
              className="inline-flex items-center px-5 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold text-sm hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg transition-all"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  <span>{currentEditing.id ? "Actualizar" : "Crear Ruleta"}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default RouletteModal
