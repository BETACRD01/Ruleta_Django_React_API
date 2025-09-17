// src/components/UI.jsx
import React from 'react';
import { X, AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';

/* ================================
   Paleta corporativa (sólida)
================================ */
export const PALETTE = {
  primary: '#0b56a7',     // Azul
  secondary: '#207ba8',   // Azul secundario
  celeste: '#389fae',     // Celeste
  turquesa: '#4dc9b1',    // Turquesa
  success: '#16a34a',
  danger: '#dc2626',
  warning: '#ca8a04',
  grayRing: '#e5e7eb',
};

const shade = (hex, amt) => {
  // pequeña utilidad para hover/active (oscurecer)
  let usePound = false;
  let col = hex;
  if (col[0] === '#') { col = col.slice(1); usePound = true; }
  let num = parseInt(col, 16);
  let r = (num >> 16) + amt;
  let g = ((num >> 8) & 0x00FF) + amt;
  let b = (num & 0x0000FF) + amt;
  r = Math.max(Math.min(255, r), 0);
  g = Math.max(Math.min(255, g), 0);
  b = Math.max(Math.min(255, b), 0);
  return (usePound ? '#' : '') + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
};

/* ================================
   Button
================================ */
export const Button = ({
  as: As = 'button',
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  disabled = false,
  loading = false,
  fullWidth = false,
  leftIcon: LeftIcon,
  rightIcon: RightIcon,
  type = 'button',
  ...props
}) => {
  const base =
    'inline-flex items-center justify-center font-medium rounded-lg transition-colors ' +
    'focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';

  const vMap = {
    primary: {
      bg: PALETTE.primary,
      hover: shade(PALETTE.primary, -20),
      ring: PALETTE.primary,
      text: '#ffffff',
      border: null,
    },
    secondary: {
      bg: PALETTE.secondary,
      hover: shade(PALETTE.secondary, -20),
      ring: PALETTE.secondary,
      text: '#ffffff',
      border: null,
    },
    celeste: {
      bg: PALETTE.celeste,
      hover: shade(PALETTE.celeste, -20),
      ring: PALETTE.celeste,
      text: '#ffffff',
      border: null,
    },
    turquesa: {
      bg: PALETTE.turquesa,
      hover: shade(PALETTE.turquesa, -20),
      ring: PALETTE.turquesa,
      text: '#ffffff',
      border: null,
    },
    success: {
      bg: PALETTE.success,
      hover: shade(PALETTE.success, -20),
      ring: PALETTE.success,
      text: '#ffffff',
      border: null,
    },
    danger: {
      bg: PALETTE.danger,
      hover: shade(PALETTE.danger, -20),
      ring: PALETTE.danger,
      text: '#ffffff',
      border: null,
    },
    warning: {
      bg: PALETTE.warning,
      hover: shade(PALETTE.warning, -20),
      ring: PALETTE.warning,
      text: '#ffffff',
      border: null,
    },
    ghost: {
      bg: 'transparent',
      hover: 'rgba(0,0,0,0.05)',
      ring: PALETTE.primary,
      text: '#374151',
      border: '1px solid transparent',
    },
    outline: {
      bg: '#ffffff',
      hover: '#f9fafb',
      ring: PALETTE.primary,
      text: '#374151',
      border: `1px solid ${PALETTE.grayRing}`,
    },
  };

  const sMap = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
    xl: 'px-8 py-4 text-lg',
  };

  const v = vMap[variant] ?? vMap.primary;

  const style = {
    backgroundColor: v.bg,
    color: v.text,
    border: v.border || undefined,
  };

  const onMouseEnter = (e) => { if (!disabled && !loading) e.currentTarget.style.backgroundColor = v.hover; };
  const onMouseLeave = (e) => { if (!disabled && !loading) e.currentTarget.style.backgroundColor = v.bg; };

  return (
    <As
      type={As === 'button' ? type : undefined}
      className={`${base} ${sMap[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      style={style}
      disabled={disabled || loading}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      aria-busy={loading ? 'true' : 'false'}
      aria-live="polite"
      {...props}
    >
      {loading && (
        <svg
          className="animate-spin -ml-1 mr-2 h-4 w-4"
          viewBox="0 0 24 24"
          aria-hidden="true"
          role="status"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V1A11 11 0 001 12h3zm2 5.291A7.962 7.962 0 014 12H1c0 3.042 1.135 5.824 3 7.938l2-2.647z"></path>
        </svg>
      )}
      {LeftIcon && <LeftIcon className="mr-2 h-4 w-4" aria-hidden="true" />}
      {children}
      {RightIcon && <RightIcon className="ml-2 h-4 w-4" aria-hidden="true" />}
    </As>
  );
};

/* ================================
   Card
================================ */
export const Card = ({ children, className = '', hover = false, ...props }) => {
  const hoverClass = hover ? 'hover:shadow-md transition-shadow cursor-pointer' : '';
  return (
    <div
      className={`bg-white rounded-lg shadow-sm border border-gray-200 ${hoverClass} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

/* ================================
   Badge (usa paleta)
================================ */
export const Badge = ({ children, variant = 'default', size = 'sm', className = '' }) => {
  const variants = {
    default: 'bg-gray-100 text-gray-800',
    primary: `bg-[${PALETTE.primary}] text-white`,
    secondary: `bg-[${PALETTE.secondary}] text-white`,
    celeste: `bg-[${PALETTE.celeste}] text-white`,
    turquesa: `bg-[${PALETTE.turquesa}] text-white`,
    success: 'bg-green-100 text-green-800',
    warning: 'bg-yellow-100 text-yellow-800',
    error: 'bg-red-100 text-red-800',
    info: `bg-[${PALETTE.secondary}] text-white`,
  };

  const sizes = {
    sm: 'px-2.5 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-1.5 text-base',
  };

  // Fallback si Tailwind no procesa arbitrary for bg-[hex]
  const style =
    variants[variant]?.startsWith('bg-[')
      ? { backgroundColor: PALETTE[variant] || undefined, color: '#fff' }
      : undefined;

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${variants[variant] || variants.default} ${sizes[size]} ${className}`}
      style={style}
    >
      {children}
    </span>
  );
};

/* ================================
   Modal (accesible)
================================ */
export const Modal = ({ isOpen, onClose, title, children, size = 'md' }) => {
  if (!isOpen) return null;

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        {/* Overlay */}
        <div
          className="fixed inset-0 bg-black/40 transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />

        {/* Modal */}
        <div className={`inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle ${sizes[size]} sm:w-full sm:p-6`}>
          <div className="flex justify-between items-center mb-4">
            <h3 id="modal-title" className="text-lg font-medium text-gray-900">
              {title}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
              aria-label="Cerrar"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
};

/* ================================
   Alert (colores corporativos para info)
================================ */
export const Alert = ({ type = 'info', title, children, className = '' }) => {
  const types = {
    success: {
      container: 'bg-green-50 border-green-200',
      icon: CheckCircle,
      iconColor: 'text-green-500',
      titleColor: 'text-green-800',
      textColor: 'text-green-700',
    },
    error: {
      container: 'bg-red-50 border-red-200',
      icon: AlertCircle,
      iconColor: 'text-red-500',
      titleColor: 'text-red-800',
      textColor: 'text-red-700',
    },
    warning: {
      container: 'bg-yellow-50 border-yellow-200',
      icon: AlertTriangle,
      iconColor: 'text-yellow-600',
      titleColor: 'text-yellow-800',
      textColor: 'text-yellow-700',
    },
    info: {
      container: 'border',
      icon: Info,
      iconColor: '',
      titleColor: '',
      textColor: '',
    },
  };

  const config = types[type];
  const Icon = config.icon;

  // Estilo info con paleta
  const infoStyle =
    type === 'info'
      ? {
          containerStyle: { backgroundColor: '#eef6ff', borderColor: PALETTE.secondary },
          iconStyle: { color: PALETTE.secondary },
          titleStyle: { color: PALETTE.primary },
          textStyle: { color: '#1f2937' },
        }
      : {};

  return (
    <div
      className={`rounded-md border p-4 ${config.container} ${className}`}
      style={infoStyle.containerStyle}
      role="alert"
    >
      <div className="flex">
        <div className="flex-shrink-0">
          <Icon className={`h-5 w-5 ${config.iconColor}`} style={infoStyle.iconStyle} aria-hidden="true" />
        </div>
        <div className="ml-3">
          {title && (
            <h3 className={`text-sm font-medium ${config.titleColor}`} style={infoStyle.titleStyle}>
              {title}
            </h3>
          )}
          <div className={`${title ? 'mt-2' : ''} text-sm ${config.textColor}`} style={infoStyle.textStyle}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ================================
   Loading Spinner (primary)
================================ */
export const LoadingSpinner = ({ size = 'md', className = '' }) => {
  const sizes = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
    xl: 'h-16 w-16',
  };

  return (
    <div
      className={`animate-spin rounded-full border-2 border-t-transparent ${sizes[size]} ${className}`}
      style={{ borderColor: PALETTE.primary }}
      role="status"
      aria-live="polite"
      aria-label="Cargando"
    />
  );
};

/* ================================
   Input
================================ */
export const Input = ({
  label,
  error,
  helper,
  className = '',
  containerClass = '',
  ...props
}) => {
  const hasError = !!error;

  return (
    <div className={containerClass}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      <input
        className={`
          block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 
          focus:outline-none focus:ring-2 focus:ring-offset-0 sm:text-sm
          ${hasError 
            ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
            : 'border-gray-300'
          }
          ${className}
        `}
        style={!hasError ? { '--tw-ring-color': PALETTE.primary, borderColor: '#d1d5db' } : undefined}
        {...props}
      />
      {helper && !error && (
        <p className="mt-1 text-sm text-gray-500">{helper}</p>
      )}
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
};

/* ================================
   Textarea
================================ */
export const Textarea = ({
  label,
  error,
  helper,
  className = '',
  containerClass = '',
  rows = 3,
  ...props
}) => {
  const hasError = !!error;

  return (
    <div className={containerClass}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      <textarea
        rows={rows}
        className={`
          block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 
          focus:outline-none focus:ring-2 focus:ring-offset-0 sm:text-sm resize-vertical
          ${hasError 
            ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
            : 'border-gray-300'
          }
          ${className}
        `}
        style={!hasError ? { '--tw-ring-color': PALETTE.primary, borderColor: '#d1d5db' } : undefined}
        {...props}
      />
      {helper && !error && (
        <p className="mt-1 text-sm text-gray-500">{helper}</p>
      )}
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
};

/* ================================
   Select
================================ */
export const Select = ({
  label,
  error,
  helper,
  options = [],
  placeholder = 'Seleccionar...',
  className = '',
  containerClass = '',
  ...props
}) => {
  const hasError = !!error;

  return (
    <div className={containerClass}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      <select
        className={`
          block w-full px-3 py-2 border rounded-md shadow-sm 
          focus:outline-none focus:ring-2 focus:ring-offset-0 sm:text-sm
          ${hasError 
            ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
            : 'border-gray-300'
          }
          ${className}
        `}
        style={!hasError ? { '--tw-ring-color': PALETTE.primary, borderColor: '#d1d5db' } : undefined}
        {...props}
      >
        <option value="">{placeholder}</option>
        {options.map((option, index) => (
          <option key={index} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {helper && !error && (
        <p className="mt-1 text-sm text-gray-500">{helper}</p>
      )}
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
};

/* ================================
   Checkbox
================================ */
export const Checkbox = ({
  label,
  error,
  helper,
  className = '',
  containerClass = '',
  ...props
}) => {
  return (
    <div className={containerClass}>
      <div className="flex items-start">
        <div className="flex items-center h-5">
          <input
            type="checkbox"
            className={`h-4 w-4 border-gray-300 rounded focus:ring-2 ${className}`}
            style={{ '--tw-ring-color': PALETTE.primary, accentColor: PALETTE.primary }}
            {...props}
          />
        </div>
        {label && (
          <div className="ml-3 text-sm">
            <label className="text-gray-700">
              {label}
            </label>
            {helper && (
              <p className="text-gray-500">{helper}</p>
            )}
          </div>
        )}
      </div>
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
};

/* ================================
   EmptyState
================================ */
export const EmptyState = ({
  icon: Icon,
  title,
  description,
  action,
  className = '',
}) => {
  return (
    <div className={`text-center py-12 ${className}`}>
      {Icon && (
        <Icon className="mx-auto h-12 w-12" style={{ color: PALETTE.secondary }} aria-hidden="true" />
      )}
      <h3 className="mt-2 text-sm font-medium text-gray-900">{title}</h3>
      {description && (
        <p className="mt-1 text-sm text-gray-500">{description}</p>
      )}
      {action && (
        <div className="mt-6">
          {action}
        </div>
      )}
    </div>
  );
};

/* ================================
   Tabs (active con primary)
================================ */
export const Tabs = ({ tabs, activeTab, onChange, className = '' }) => {
  return (
    <div className={className}>
      <nav className="-mb-px flex space-x-8" aria-label="Tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`
              whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm flex items-center
              ${activeTab === tab.id
                ? 'text-blue-700 border-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }
            `}
            style={activeTab === tab.id ? { color: PALETTE.primary, borderColor: PALETTE.primary } : undefined}
          >
            {tab.icon && <tab.icon className="mr-2 h-4 w-4" aria-hidden="true" />}
            {tab.label}
            {tab.count !== undefined && (
              <span className="ml-2 bg-gray-100 text-gray-900 py-0.5 px-2.5 rounded-full text-xs">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </nav>
    </div>
  );
};
