// src/components/UI.jsx
// ============================================================================
// Componentes UI compartidos con paleta corporativa
// - Incluye: Button, Card, Badge, Modal, Alert, LoadingSpinner, Inputs,
//   EmptyState y Tabs.
// - Diseño: Tailwind para layout/espaciado; colores por paleta corporativa.
// - Buenas prácticas: accesibilidad básica, props claras y comentarios.
// ============================================================================

import React, { forwardRef } from "react";
import { X, AlertCircle, CheckCircle, Info, AlertTriangle } from "lucide-react";

/* ----------------------------------------------------------------------------
   Paleta corporativa (colores de marca)
---------------------------------------------------------------------------- */
export const PALETTE = {
  primary: "#0b56a7", // Azul
  secondary: "#207ba8", // Azul secundario
  celeste: "#389fae", // Celeste
  turquesa: "#4dc9b1", // Turquesa
  success: "#16a34a",
  danger: "#dc2626",
  warning: "#ca8a04",
  grayRing: "#e5e7eb",
};

/** Oscurece / aclara un color hex en 'amt' unidades RGB (para :hover). */
const shade = (hex, amt) => {
  let usePound = false;
  let col = hex;
  if (col?.[0] === "#") {
    col = col.slice(1);
    usePound = true;
  }
  const num = parseInt(col, 16);
  let r = (num >> 16) + amt;
  let g = ((num >> 8) & 0x00ff) + amt;
  let b = (num & 0x0000ff) + amt;
  r = Math.max(Math.min(255, r), 0);
  g = Math.max(Math.min(255, g), 0);
  b = Math.max(Math.min(255, b), 0);
  return (usePound ? "#" : "") + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
};

/* ============================================================================
   BUTTON
   - API: variant, size, fullWidth, loading, leftIcon, rightIcon
   - Accesibilidad: aria-busy, role=status en spinner
   - Nota: usamos inline styles para aplicar colores corporativos hex.
============================================================================ */
export const Button = forwardRef(
  (
    {
      as: As = "button",
      children,
      variant = "primary",
      size = "md",
      className = "",
      disabled = false,
      loading = false,
      fullWidth = false,
      leftIcon: LeftIcon,
      rightIcon: RightIcon,
      type = "button",
      ...props
    },
    ref
  ) => {
    const base =
      "inline-flex items-center justify-center font-medium rounded-lg transition-colors " +
      "focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";

    // Mapa de variantes con colores corporativos
    const vMap = {
      primary: { bg: PALETTE.primary, text: "#ffffff", ring: PALETTE.primary, border: null },
      secondary: { bg: PALETTE.secondary, text: "#ffffff", ring: PALETTE.secondary, border: null },
      celeste: { bg: PALETTE.celeste, text: "#ffffff", ring: PALETTE.celeste, border: null },
      turquesa: { bg: PALETTE.turquesa, text: "#ffffff", ring: PALETTE.turquesa, border: null },
      success: { bg: PALETTE.success, text: "#ffffff", ring: PALETTE.success, border: null },
      danger: { bg: PALETTE.danger, text: "#ffffff", ring: PALETTE.danger, border: null },
      warning: { bg: PALETTE.warning, text: "#ffffff", ring: PALETTE.warning, border: null },
      outline: { bg: "#ffffff", text: "#374151", ring: PALETTE.primary, border: `1px solid ${PALETTE.grayRing}` },
      ghost: { bg: "transparent", text: "#374151", ring: PALETTE.primary, border: "1px solid transparent" },
    };

    const sMap = {
      sm: "px-3 py-1.5 text-sm",
      md: "px-4 py-2 text-sm",
      lg: "px-6 py-3 text-base",
      xl: "px-8 py-4 text-lg",
    };

    const v = vMap[variant] ?? vMap.primary;
    const hoverBg = v.bg && v.bg !== "transparent" ? shade(v.bg, -20) : "rgba(0,0,0,0.05)";

    const style = { backgroundColor: v.bg, color: v.text, border: v.border || undefined };
    const onMouseEnter = (e) => {
      if (!disabled && !loading && v.bg) e.currentTarget.style.backgroundColor = hoverBg;
    };
    const onMouseLeave = (e) => {
      if (!disabled && !loading && v.bg) e.currentTarget.style.backgroundColor = v.bg;
    };

    return (
      <As
        ref={ref}
        type={As === "button" ? type : undefined}
        className={`${base} ${sMap[size]} ${fullWidth ? "w-full" : ""} ${className}`}
        style={style}
        disabled={disabled || loading}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        aria-busy={loading ? "true" : "false"}
        {...props}
      >
        {loading && (
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden="true" role="status">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" opacity="0.25" />
            <path
              d="M4 12a8 8 0 018-8V1A11 11 0 001 12h3zm2 5.291A7.962 7.962 0 014 12H1c0 3.042 1.135 5.824 3 7.938l2-2.647z"
              fill="currentColor"
              opacity="0.75"
            />
          </svg>
        )}
        {LeftIcon && <LeftIcon className="mr-2 h-4 w-4" aria-hidden="true" />}
        {children}
        {RightIcon && <RightIcon className="ml-2 h-4 w-4" aria-hidden="true" />}
      </As>
    );
  }
);
Button.displayName = "Button";

/* ============================================================================
   CARD
   - Contenedor con borde y sombra ligera
============================================================================ */
export const Card = ({ children, className = "", hover = false, ...props }) => {
  const hoverClass = hover ? "hover:shadow-md transition-shadow cursor-pointer" : "";
  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 ${hoverClass} ${className}`} {...props}>
      {children}
    </div>
  );
};

/* ============================================================================
   BADGE
   - Usa inline style para garantizar color corporativo (Tailwind no genera
     clases con hex dinámico por defecto).
============================================================================ */
export const Badge = ({ children, variant = "default", size = "sm", className = "" }) => {
  const variants = {
    default: { bg: "#f3f4f6", text: "#1f2937" }, // gris claro
    primary: { bg: PALETTE.primary, text: "#ffffff" },
    secondary: { bg: PALETTE.secondary, text: "#ffffff" },
    celeste: { bg: PALETTE.celeste, text: "#ffffff" },
    turquesa: { bg: PALETTE.turquesa, text: "#ffffff" },
    success: { bg: "#dcfce7", text: "#14532d" },
    warning: { bg: "#fef9c3", text: "#713f12" },
    error: { bg: "#fee2e2", text: "#7f1d1d" },
    info: { bg: PALETTE.secondary, text: "#ffffff" },
  };

  const sizes = {
    sm: "px-2.5 py-0.5 text-xs",
    md: "px-3 py-1 text-sm",
    lg: "px-4 py-1.5 text-base",
  };

  const v = variants[variant] ?? variants.default;

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${sizes[size]} ${className}`}
      style={{ backgroundColor: v.bg, color: v.text }}
    >
      {children}
    </span>
  );
};

/* ============================================================================
   MODAL (accesible)
   - Cierra haciendo click en overlay o botón X
   - Tamaños: sm, md, lg, xl
============================================================================ */
export const Modal = ({ isOpen, onClose, title, children, size = "md" }) => {
  if (!isOpen) return null;

  const sizes = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        {/* Overlay */}
        <div className="fixed inset-0 bg-black/40 transition-opacity" onClick={onClose} aria-hidden="true" />

        {/* Modal card */}
        <div
          className={`inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle ${sizes[size]} sm:w-full sm:p-6`}
        >
          <div className="flex justify-between items-center mb-4">
            <h3 id="modal-title" className="text-lg font-medium text-gray-900">
              {title}
            </h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Cerrar modal">
              <X className="h-6 w-6" />
            </button>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
   ALERT
   - Tipos: success, error, warning, info (info usa paleta corporativa)
============================================================================ */
export const Alert = ({ type = "info", title, children, className = "" }) => {
  const types = {
    success: {
      container: "bg-green-50 border-green-200",
      icon: CheckCircle,
      iconColor: "text-green-500",
      titleColor: "text-green-800",
      textColor: "text-green-700",
    },
    error: {
      container: "bg-red-50 border-red-200",
      icon: AlertCircle,
      iconColor: "text-red-500",
      titleColor: "text-red-800",
      textColor: "text-red-700",
    },
    warning: {
      container: "bg-yellow-50 border-yellow-200",
      icon: AlertTriangle,
      iconColor: "text-yellow-600",
      titleColor: "text-yellow-800",
      textColor: "text-yellow-700",
    },
    info: {
      container: "border", // estilos adicionales via inline style abajo
      icon: Info,
      iconColor: "",
      titleColor: "",
      textColor: "",
    },
  };

  const config = types[type] || types.info;
  const Icon = config.icon;

  // Colores para INFO tomados de paleta
  const infoInline =
    type === "info"
      ? {
          containerStyle: { backgroundColor: "#eef6ff", borderColor: PALETTE.secondary },
          iconStyle: { color: PALETTE.secondary },
          titleStyle: { color: PALETTE.primary },
          textStyle: { color: "#1f2937" },
        }
      : {};

  return (
    <div
      className={`rounded-md border p-4 ${config.container} ${className}`}
      style={infoInline.containerStyle}
      role="alert"
      aria-live="polite"
    >
      <div className="flex">
        <div className="flex-shrink-0">
          <Icon className={`h-5 w-5 ${config.iconColor}`} style={infoInline.iconStyle} aria-hidden="true" />
        </div>
        <div className="ml-3">
          {title && (
            <h3 className={`text-sm font-medium ${config.titleColor}`} style={infoInline.titleStyle}>
              {title}
            </h3>
          )}
          <div className={`${title ? "mt-2" : ""} text-sm ${config.textColor}`} style={infoInline.textStyle}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
   LOADING SPINNER
   - Borde superior transparente + color de borde corporativo
============================================================================ */
export const LoadingSpinner = ({ size = "md", className = "" }) => {
  const sizes = { sm: "h-4 w-4", md: "h-8 w-8", lg: "h-12 w-12", xl: "h-16 w-16" };

  return (
    <div
      className={`animate-spin rounded-full border-2 ${sizes[size]} ${className}`}
      style={{
        borderColor: PALETTE.primary,
        borderTopColor: "transparent",
      }}
      role="status"
      aria-live="polite"
      aria-label="Cargando"
    />
  );
};

/* ============================================================================
   INPUTS (Input / Textarea / Select / Checkbox)
   - Usa ring primary cuando no hay error.
============================================================================ */
export const Input = ({ label, error, helper, className = "", containerClass = "", ...props }) => {
  const hasError = !!error;
  return (
    <div className={containerClass}>
      {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
      <input
        className={`
          block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 
          focus:outline-none focus:ring-2 focus:ring-offset-0 sm:text-sm
          ${hasError ? "border-red-300 focus:ring-red-500 focus:border-red-500" : "border-gray-300"}
          ${className}
        `}
        style={!hasError ? { "--tw-ring-color": PALETTE.primary, borderColor: "#d1d5db" } : undefined}
        {...props}
      />
      {helper && !error && <p className="mt-1 text-sm text-gray-500">{helper}</p>}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
};

export const Textarea = ({
  label,
  error,
  helper,
  className = "",
  containerClass = "",
  rows = 3,
  ...props
}) => {
  const hasError = !!error;
  return (
    <div className={containerClass}>
      {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
      <textarea
        rows={rows}
        className={`
          block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 
          focus:outline-none focus:ring-2 focus:ring-offset-0 sm:text-sm resize-vertical
          ${hasError ? "border-red-300 focus:ring-red-500 focus:border-red-500" : "border-gray-300"}
          ${className}
        `}
        style={!hasError ? { "--tw-ring-color": PALETTE.primary, borderColor: "#d1d5db" } : undefined}
        {...props}
      />
      {helper && !error && <p className="mt-1 text-sm text-gray-500">{helper}</p>}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
};

export const Select = ({
  label,
  error,
  helper,
  options = [],
  placeholder = "Seleccionar...",
  className = "",
  containerClass = "",
  ...props
}) => {
  const hasError = !!error;
  return (
    <div className={containerClass}>
      {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
      <select
        className={`
          block w-full px-3 py-2 border rounded-md shadow-sm 
          focus:outline-none focus:ring-2 focus:ring-offset-0 sm:text-sm
          ${hasError ? "border-red-300 focus:ring-red-500 focus:border-red-500" : "border-gray-300"}
          ${className}
        `}
        style={!hasError ? { "--tw-ring-color": PALETTE.primary, borderColor: "#d1d5db" } : undefined}
        {...props}
      >
        <option value="">{placeholder}</option>
        {options.map((opt, i) => (
          <option key={`${opt.value ?? i}`} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {helper && !error && <p className="mt-1 text-sm text-gray-500">{helper}</p>}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
};

export const Checkbox = ({ label, error, helper, className = "", containerClass = "", ...props }) => {
  return (
    <div className={containerClass}>
      <div className="flex items-start">
        <div className="flex items-center h-5">
          <input
            type="checkbox"
            className={`h-4 w-4 border-gray-300 rounded focus:ring-2 ${className}`}
            style={{ "--tw-ring-color": PALETTE.primary, accentColor: PALETTE.primary }}
            {...props}
          />
        </div>
        {label && (
          <div className="ml-3 text-sm">
            <label className="text-gray-700">{label}</label>
            {helper && <p className="text-gray-500">{helper}</p>}
          </div>
        )}
      </div>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
};

/* ============================================================================
   EMPTY STATE
   - Pequeño bloque centrado con icono, título, descripción y acción
============================================================================ */
export const EmptyState = ({ icon: Icon, title, description, action, className = "" }) => {
  return (
    <div className={`text-center py-12 ${className}`}>
      {Icon && <Icon className="mx-auto h-12 w-12" style={{ color: PALETTE.secondary }} aria-hidden="true" />}
      <h3 className="mt-2 text-sm font-medium text-gray-900">{title}</h3>
      {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
};

/* ============================================================================
   TABS
   - Control visual simple con conteo opcional
   - Usa paleta corporativa para el tab activo
============================================================================ */
export const Tabs = ({ tabs, activeTab, onChange, className = "" }) => {
  return (
    <div className={className}>
      <nav className="-mb-px flex flex-wrap gap-x-6 gap-y-2" aria-label="Tabs">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={`
                whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm flex items-center
                ${isActive ? "border-blue-600" : "border-transparent hover:border-gray-300"}
              `}
              style={{ color: isActive ? PALETTE.primary : "#6b7280", borderColor: isActive ? PALETTE.primary : undefined }}
              aria-current={isActive ? "page" : undefined}
            >
              {tab.icon && <tab.icon className="mr-2 h-4 w-4" aria-hidden="true" />}
              {tab.label}
              {tab.count !== undefined && (
                <span
                  className="ml-2 bg-gray-100 text-gray-900 py-0.5 px-2.5 rounded-full text-xs"
                  aria-label={`conteo ${tab.count}`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
};
