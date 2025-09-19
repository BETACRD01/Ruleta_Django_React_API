// AdminCommentsSystem.jsx - Versión corregida con detección de enlaces mejorada
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  MessageCircle, Send, Edit3, Trash2, MoreHorizontal, 
  Clock, CheckCircle, AlertCircle, User, Tag, 
  Filter, Search, Plus, Eye, EyeOff, Pin, Archive,
  ChevronDown, ChevronUp, Loader2, X, FileText,
  AtSign, Hash, Flag, Download
} from 'lucide-react';

// Componente de confirmación personalizado
const ConfirmDialog = ({ isOpen, onConfirm, onCancel, title, message, confirmText = "Confirmar", cancelText = "Cancelar" }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
        <p className="text-gray-600 mb-6">{message}</p>
        <div className="flex justify-end space-x-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

// FUNCIÓN MEJORADA PARA DETECCIÓN DE ENLACES Y PATRONES
const detectAndProcessText = (text) => {
  if (!text || typeof text !== 'string') return "";
  
  // Escapar HTML primero para prevenir XSS
  let processedText = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
  
  // 1. URLs completas (http/https) - MEJORADO
  const httpRegex = /\b(https?:\/\/[a-zA-Z0-9\-._~:\/?#[\]@!$&'()*+,;=%]+)/gi;
  processedText = processedText.replace(httpRegex, (match) => {
    // Limpiar caracteres finales problemáticos
    let cleanUrl = match.replace(/[.,;!?)]+$/, '');
    return `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer" class="text-blue-600 underline hover:text-blue-800 hover:no-underline font-medium bg-blue-50 px-1 rounded transition-colors">${match}</a>`;
  });
  
  // 2. URLs que empiezan con www - MEJORADO
  const wwwRegex = /\b(www\.[a-zA-Z0-9\-._~:\/?#[\]@!$&'()*+,;=%]+)/gi;
  processedText = processedText.replace(wwwRegex, (match) => {
    // Evitar URLs ya procesadas (que tengan <a> antes)
    if (processedText.indexOf(`>${match}</a>`) !== -1) return match;
    
    let cleanUrl = match.replace(/[.,;!?)]+$/, '');
    return `<a href="https://${cleanUrl}" target="_blank" rel="noopener noreferrer" class="text-blue-600 underline hover:text-blue-800 hover:no-underline font-medium bg-blue-50 px-1 rounded transition-colors">${match}</a>`;
  });
  
  // 3. Emails - MEJORADO
  const emailRegex = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g;
  processedText = processedText.replace(emailRegex, (email) => {
    // Evitar emails ya procesadas (que tengan <a> antes)
    if (processedText.indexOf(`>${email}</a>`) !== -1) return email;
    
    return `<a href="mailto:${email}" class="text-green-600 underline hover:text-green-800 hover:no-underline font-medium bg-green-50 px-1 rounded transition-colors">${email}</a>`;
  });
  
  // 4. Menciones @usuario - MEJORADO
  const mentionRegex = /\B@([a-zA-Z0-9_-]{1,30})\b/g;
  processedText = processedText.replace(mentionRegex, (match, username) => {
    return `<span class="bg-purple-100 text-purple-800 px-2 py-1 rounded-full text-sm font-semibold border border-purple-200 inline-flex items-center">
              <span class="w-1.5 h-1.5 bg-purple-500 rounded-full mr-1"></span>
              ${match}
            </span>`;
  });
  
  // 5. Hashtags #etiqueta - MEJORADO
  const hashtagRegex = /\B#([a-zA-Z0-9_-]{1,30})\b/g;
  processedText = processedText.replace(hashtagRegex, (match, tag) => {
    return `<span class="bg-green-100 text-green-800 px-2 py-1 rounded-full text-sm font-semibold border border-green-200 inline-flex items-center">
              <span class="w-1.5 h-1.5 bg-green-500 rounded-full mr-1"></span>
              ${match}
            </span>`;
  });
  
  // 6. Estados - MEJORADO con más variaciones
  const statusRegex = /\b(TODO|DONE|PENDING|IN[_\s]?PROGRESS|COMPLETED|CANCELLED|PENDIENTE|COMPLETADO|CANCELADO|REVISION|APROBADO|RECHAZADO|URGENTE|IMPORTANTE)\b/gi;
  processedText = processedText.replace(statusRegex, (match) => {
    const status = match.toUpperCase().replace(/\s+/g, '_');
    let colorClass = 'bg-blue-100 text-blue-800 border-blue-200';
    
    if (['DONE', 'COMPLETED', 'COMPLETADO', 'APROBADO'].includes(status)) {
      colorClass = 'bg-green-100 text-green-800 border-green-200';
    } else if (['PENDING', 'PENDIENTE', 'TODO', 'REVISION'].includes(status)) {
      colorClass = 'bg-yellow-100 text-yellow-800 border-yellow-200';
    } else if (['CANCELLED', 'CANCELADO', 'RECHAZADO'].includes(status)) {
      colorClass = 'bg-red-100 text-red-800 border-red-200';
    } else if (['URGENTE', 'IMPORTANTE'].includes(status)) {
      colorClass = 'bg-red-100 text-red-800 border-red-300 font-bold animate-pulse';
    } else if (status.includes('PROGRESS')) {
      colorClass = 'bg-orange-100 text-orange-800 border-orange-200';
    }
    
    return `<span class="${colorClass} px-2 py-1 rounded border text-xs font-bold uppercase inline-flex items-center">
              <span class="w-2 h-2 rounded-full mr-1.5 ${colorClass.replace('bg-', 'bg-').replace('100', '500').replace('text-', '')}"></span>
              ${match}
            </span>`;
  });
  
  // 7. Prioridades - MEJORADO
  const priorityRegex = /\b(ALTA|MEDIA|BAJA|HIGH|MEDIUM|LOW|URGENT|CRÍTICO|NORMAL)\b/gi;
  processedText = processedText.replace(priorityRegex, (match) => {
    const priority = match.toUpperCase();
    let colorClass = 'bg-gray-100 text-gray-800';
    let icon = '●';
    
    if (['ALTA', 'HIGH', 'URGENT', 'CRÍTICO'].includes(priority)) {
      colorClass = 'bg-red-100 text-red-800 border-red-200';
      icon = '🔥';
    } else if (['MEDIA', 'MEDIUM', 'NORMAL'].includes(priority)) {
      colorClass = 'bg-yellow-100 text-yellow-800 border-yellow-200';
      icon = '⚡';
    } else if (['BAJA', 'LOW'].includes(priority)) {
      colorClass = 'bg-green-100 text-green-800 border-green-200';
      icon = '📌';
    }
    
    return `<span class="${colorClass} px-2 py-1 rounded border text-xs font-bold uppercase inline-flex items-center">
              <span class="mr-1">${icon}</span>
              ${match}
            </span>`;
  });
  
  // 8. Fechas ISO - MEJORADO
  const dateRegex = /\b(\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})?)?)\b/g;
  processedText = processedText.replace(dateRegex, (dateStr) => {
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      
      const formatted = date.toLocaleString('es-ES', {
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit',
        hour: dateStr.includes('T') ? '2-digit' : undefined,
        minute: dateStr.includes('T') ? '2-digit' : undefined
      });
      
      const now = new Date();
      const isPast = date < now;
      const colorClass = isPast ? 'bg-gray-100 text-gray-700' : 'bg-purple-100 text-purple-700';
      
      return `<span class="${colorClass} px-2 py-1 rounded border border-purple-200 text-xs font-mono font-semibold inline-flex items-center" title="Fecha detectada: ${dateStr}">
                <span class="mr-1">📅</span>
                ${formatted}
              </span>`;
    } catch {
      return dateStr;
    }
  });
  
  // 9. Números importantes (IDs, montos, etc.) - MEJORADO
  const importantNumberRegex = /\b(ID|REF|MONTO|CANTIDAD|TOTAL|PRECIO|#)[:=\s]*(\$?\d{1,3}(?:[,.\s]\d{3})*(?:\.\d{2})?)\b/gi;
  processedText = processedText.replace(importantNumberRegex, (match, prefix, number) => {
    return `<span class="bg-indigo-100 text-indigo-800 px-2 py-1 rounded border border-indigo-200 text-xs font-mono font-bold inline-flex items-center">
              <span class="mr-1">💰</span>
              ${prefix}: ${number}
            </span>`;
  });
  
  // 10. Convertir saltos de línea a <br/>
  processedText = processedText.replace(/\n/g, '<br/>');
  
  return processedText;
};

// Editor de texto rico con detección automática MEJORADO
const RichTextEditor = ({
  value,
  onChange,
  placeholder,
  disabled,
  maxLength = 2000,
  onValidationChange,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [preview, setPreview] = useState("");
  const [validationError, setValidationError] = useState(false);
  const textareaRef = useRef(null);

  const handleChange = useCallback((e) => {
    const newValue = e.target.value;
    const isValid = !maxLength || newValue.length <= maxLength;
    
    setValidationError(!isValid);
    onValidationChange?.(!isValid);
    
    if (isValid) {
      onChange(newValue);
    }
  }, [onChange, maxLength, onValidationChange]);

  // ACTUALIZACIÓN EN TIEMPO REAL del preview
  useEffect(() => {
    if (value) {
      const processed = detectAndProcessText(value);
      setPreview(processed);
    } else {
      setPreview("");
    }
  }, [value]);

  // Insertar texto en la posición del cursor
  const insertText = (text) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentValue = value || '';
    const newValue = currentValue.substring(0, start) + text + currentValue.substring(end);
    
    onChange(newValue);
    
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + text.length, start + text.length);
    }, 0);
  };

  return (
    <div className={`bg-white rounded-lg border-2 transition-all duration-300 ${
      isFocused ? "border-blue-500 ring-4 ring-blue-100 shadow-lg" : 
      validationError ? "border-red-300 ring-2 ring-red-100" : "border-gray-300 hover:border-gray-400"
    }`}>
      {/* Toolbar mejorado */}
      <div className="border-b border-gray-200 bg-gradient-to-r from-gray-50 to-blue-50 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center text-sm text-gray-700 font-medium">
              <FileText className="h-4 w-4 mr-2 text-blue-600" />
              Editor inteligente con detección automática
            </div>
            
            {/* Botones de inserción rápida */}
            <div className="flex items-center space-x-1">
              <button
                type="button"
                onClick={() => insertText('@')}
                className="p-2 rounded-md hover:bg-blue-100 text-gray-600 hover:text-purple-700 transition-colors"
                title="Insertar mención (@usuario)"
              >
                <AtSign className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => insertText('#')}
                className="p-2 rounded-md hover:bg-green-100 text-gray-600 hover:text-green-700 transition-colors"
                title="Insertar hashtag (#etiqueta)"
              >
                <Hash className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => insertText('TODO: ')}
                className="p-2 rounded-md hover:bg-yellow-100 text-gray-600 hover:text-yellow-700 transition-colors"
                title="Insertar tarea (TODO:)"
              >
                <Flag className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => insertText('URGENTE: ')}
                className="p-2 rounded-md hover:bg-red-100 text-gray-600 hover:text-red-700 transition-colors"
                title="Marcar como urgente"
              >
                ⚡
              </button>
            </div>
          </div>
          
          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            className={`flex items-center text-sm px-3 py-1.5 rounded-md transition-all ${
              showPreview 
                ? "bg-blue-600 text-white shadow-md" 
                : "bg-white text-blue-600 border border-blue-200 hover:bg-blue-50"
            }`}
          >
            <Eye className="h-4 w-4 mr-1.5" />
            {showPreview ? "Editor" : "Vista previa"}
          </button>
        </div>
      </div>

      {/* Área de contenido */}
      {showPreview ? (
        <div className="p-6">
          <div className="flex items-center text-sm text-blue-700 mb-4 bg-blue-50 px-3 py-2 rounded-lg">
            <Eye className="h-4 w-4 mr-2" />
            Vista previa con detección automática aplicada
          </div>
          <div
            className="min-h-[150px] p-4 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200 text-sm leading-relaxed"
            style={{ lineHeight: "1.8" }}
            dangerouslySetInnerHTML={{ __html: preview || '<span class="text-gray-400 italic">Escribe algo para ver la vista previa...</span>' }}
          />
        </div>
      ) : (
        <div className="p-6">
          <textarea
            ref={textareaRef}
            value={value || ""}
            onChange={handleChange}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            className={`w-full border-0 focus:ring-0 focus:outline-none resize-none min-h-[150px] transition-all duration-200 ${
              validationError ? "bg-red-50 text-red-800" : "bg-transparent text-gray-800"
            }`}
            placeholder={placeholder || "Escribe tu comentario aquí...\n\nDetección automática:\n• URLs: https://ejemplo.com, www.sitio.com\n• Emails: usuario@dominio.com\n• Menciones: @usuario\n• Hashtags: #etiqueta\n• Estados: TODO DONE PENDING URGENTE\n• Fechas: 2025-01-15T10:30:00\n• Prioridades: ALTA MEDIA BAJA"}
            disabled={disabled}
            style={{
              fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
              fontSize: "14px",
              lineHeight: "1.6",
            }}
          />
        </div>
      )}

      {/* Footer mejorado */}
      <div className="border-t border-gray-100 px-6 py-3 bg-gray-50 rounded-b-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-6 text-xs text-gray-600">
            <span className="flex items-center">
              <span className="w-2 h-2 bg-blue-500 rounded-full mr-1.5"></span>
              URLs y emails clicables
            </span>
            <span className="flex items-center">
              <span className="w-2 h-2 bg-purple-500 rounded-full mr-1.5"></span>
              @menciones destacadas
            </span>
            <span className="flex items-center">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-1.5"></span>
              #hashtags resaltados
            </span>
          </div>
          
          {maxLength && (
            <div className={`text-xs font-medium ${
              (value?.length || 0) > maxLength * 0.9 
                ? (value?.length || 0) > maxLength 
                  ? "text-red-600" 
                  : "text-orange-600"
                : "text-gray-500"
            }`}>
              {value?.length || 0}/{maxLength}
            </div>
          )}
        </div>
      </div>

      {validationError && (
        <div className="border-t border-red-200 bg-red-50 px-6 py-3 flex items-center">
          <AlertCircle className="h-4 w-4 mr-2 text-red-500" />
          <span className="text-sm text-red-700 font-medium">Límite de caracteres excedido</span>
        </div>
      )}
    </div>
  );
};

// API para comentarios administrativos
class AdminCommentsAPI {
  constructor(baseURL, authToken) {
    this.baseURL = baseURL;
    this.authToken = authToken;
  }

  getHeaders() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Token ${this.authToken}`
    };
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: { ...this.getHeaders(), ...options.headers }
    });

    if (!response.ok) {
      let errorData = {};
      try {
        errorData = await response.json();
      } catch {}
      
      const errorMessage = errorData.message || 
                          errorData.detail || 
                          errorData.error ||
                          `HTTP ${response.status}: ${response.statusText}`;
      throw new Error(errorMessage);
    }

    if (response.status === 204) return null;
    return await response.json();
  }

  // Endpoints para comentarios administrativos
  async getComments(rouletteId, params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/roulettes/${rouletteId}/admin-comments/${query ? `?${query}` : ''}`);
  }

  async createComment(rouletteId, data) {
    return this.request(`/roulettes/${rouletteId}/admin-comments/`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateComment(rouletteId, commentId, data) {
    return this.request(`/roulettes/${rouletteId}/admin-comments/${commentId}/`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  }

  async deleteComment(rouletteId, commentId) {
    return this.request(`/roulettes/${rouletteId}/admin-comments/${commentId}/`, {
      method: 'DELETE'
    });
  }

  async togglePin(rouletteId, commentId) {
    return this.request(`/roulettes/${rouletteId}/admin-comments/${commentId}/toggle-pin/`, {
      method: 'POST'
    });
  }

  async exportComments(rouletteId, format = 'json') {
    return this.request(`/roulettes/${rouletteId}/admin-comments/export/?format=${format}`);
  }
}

// Componente principal de comentarios administrativos
const AdminCommentsSystem = ({ 
  rouletteId, 
  apiBaseURL = 'http://localhost:8000/api',
  authToken,
  currentUser = null,
  className = "",
  onCommentChange = () => {},
  onCommentCount = () => {}
}) => {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newComment, setNewComment] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingContent, setEditingContent] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("active");
  const [selectedPriority, setSelectedPriority] = useState("medium");
  const [selectedCategory, setSelectedCategory] = useState("general");
  const [isPrivate, setIsPrivate] = useState(true);
  const [newTags, setNewTags] = useState("");
  
  // Filtros y búsqueda
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [showPrivateOnly, setShowPrivateOnly] = useState(false);
  
  const [isExpanded, setIsExpanded] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [validationError, setValidationError] = useState(false);
  
  // Estado para el diálogo de confirmación
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);

  // Inicializar API
  const api = new AdminCommentsAPI(apiBaseURL, authToken);

  const statusOptions = [
    { value: "active", label: "Activo", color: "bg-blue-100 text-blue-800", icon: AlertCircle },
    { value: "pending", label: "Pendiente", color: "bg-yellow-100 text-yellow-800", icon: Clock },
    { value: "resolved", label: "Resuelto", color: "bg-green-100 text-green-800", icon: CheckCircle },
    { value: "archived", label: "Archivado", color: "bg-gray-100 text-gray-800", icon: Archive }
  ];

  const priorityOptions = [
    { value: "low", label: "Baja", color: "text-green-600" },
    { value: "medium", label: "Media", color: "text-yellow-600" },
    { value: "high", label: "Alta", color: "text-red-600" },
    { value: "urgent", label: "Urgente", color: "text-red-700 font-bold" }
  ];

  const categoryOptions = [
    { value: "general", label: "General" },
    { value: "revision", label: "Revisión" },
    { value: "aprobacion", label: "Aprobación" },
    { value: "recordatorio", label: "Recordatorio" },
    { value: "problema", label: "Problema" },
    { value: "mejora", label: "Mejora" },
    { value: "cliente", label: "Cliente" },
    { value: "tecnico", label: "Técnico" }
  ];

  // Función auxiliar para mostrar confirmación
  const showConfirmation = (title, message, action) => {
    setConfirmAction(() => action);
    setShowConfirmDialog(true);
  };

  const handleConfirm = () => {
    if (confirmAction) {
      confirmAction();
    }
    setShowConfirmDialog(false);
    setConfirmAction(null);
  };

  const handleCancel = () => {
    setShowConfirmDialog(false);
    setConfirmAction(null);
  };

  // Cargar comentarios
  const loadComments = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getComments(rouletteId, {
        search: searchTerm || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        priority: priorityFilter !== 'all' ? priorityFilter : undefined,
        category: categoryFilter !== 'all' ? categoryFilter : undefined,
        private_only: showPrivateOnly || undefined
      });
      
      const commentsList = data.results || data || [];
      setComments(commentsList);
      onCommentChange(commentsList);
      onCommentCount(commentsList.length);
    } catch (err) {
      setError(err.message);
      console.error('Error loading comments:', err);
    } finally {
      setLoading(false);
    }
  };

  // Cargar comentarios al montar y cuando cambien los filtros
  useEffect(() => {
    if (rouletteId && authToken) {
      loadComments();
    }
  }, [rouletteId, authToken, searchTerm, statusFilter, priorityFilter, categoryFilter, showPrivateOnly]);

  // Filtrar comentarios localmente
  const filteredComments = comments
    .filter(comment => {
      if (searchTerm && !comment.content?.toLowerCase().includes(searchTerm.toLowerCase()) && 
          !comment.author?.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      if (statusFilter !== 'all' && comment.status !== statusFilter) return false;
      if (priorityFilter !== 'all' && comment.priority !== priorityFilter) return false;
      if (categoryFilter !== 'all' && comment.category !== categoryFilter) return false;
      if (showPrivateOnly && !comment.is_private) return false;
      return true;
    })
    .sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) {
        return b.is_pinned ? 1 : -1;
      }
      return new Date(b.created_at) - new Date(a.created_at);
    });

  // Crear comentario
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || submitting || validationError) return;

    try {
      setSubmitting(true);
      const commentData = {
        content: newComment.trim(),
        status: selectedStatus,
        priority: selectedPriority,
        category: selectedCategory,
        is_private: isPrivate,
        tags: newTags ? newTags.split(',').map(t => t.trim()).filter(Boolean) : []
      };

      const createdComment = await api.createComment(rouletteId, commentData);
      
      // Procesar el contenido del comentario creado
      const processedComment = {
        ...createdComment,
        processed_content: detectAndProcessText(createdComment.content)
      };
      
      const updatedComments = [processedComment, ...comments];
      setComments(updatedComments);
      
      // Limpiar formulario
      setNewComment("");
      setNewTags("");
      setSelectedStatus("active");
      setSelectedPriority("medium");
      setSelectedCategory("general");
      setIsPrivate(true);
      
      onCommentChange(updatedComments);
      onCommentCount(updatedComments.length);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Otras funciones (editar, eliminar, etc.)
  const startEdit = (comment) => {
    setEditingId(comment.id);
    setEditingContent(comment.content);
  };

  const saveEdit = async () => {
    if (!editingContent.trim() || submitting) return;

    try {
      setSubmitting(true);
      const updatedComment = await api.updateComment(rouletteId, editingId, {
        content: editingContent.trim()
      });
      
      // Procesar el contenido actualizado
      const processedComment = {
        ...updatedComment,
        processed_content: detectAndProcessText(updatedComment.content)
      };
      
      setComments(prev => prev.map(c => 
        c.id === editingId ? { ...c, ...processedComment } : c
      ));
      
      setEditingId(null);
      setEditingContent("");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingContent("");
  };

  const handleDelete = async (commentId) => {
    const deleteAction = async () => {
      try {
        await api.deleteComment(rouletteId, commentId);
        const updatedComments = comments.filter(c => c.id !== commentId);
        setComments(updatedComments);
        onCommentChange(updatedComments);
        onCommentCount(updatedComments.length);
      } catch (err) {
        setError(err.message);
      }
    };

    showConfirmation(
      "Eliminar comentario",
      "¿Estás seguro de que deseas eliminar este comentario? Esta acción no se puede deshacer.",
      deleteAction
    );
  };

  const handleTogglePin = async (commentId) => {
    try {
      const updatedComment = await api.togglePin(rouletteId, commentId);
      setComments(prev => prev.map(c => 
        c.id === commentId ? { ...c, is_pinned: updatedComment.is_pinned } : c
      ));
    } catch (err) {
      setError(err.message);
    }
  };

  const updateCommentStatus = async (commentId, newStatus) => {
    try {
      await api.updateComment(rouletteId, commentId, { status: newStatus });
      setComments(prev => prev.map(c => 
        c.id === commentId ? { ...c, status: newStatus } : c
      ));
    } catch (err) {
      setError(err.message);
    }
  };

  const formatDate = (dateString) => {
    try {
      return new Date(dateString).toLocaleString('es-ES', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  const getStatusOption = (status) => statusOptions.find(s => s.value === status);
  const getPriorityOption = (priority) => priorityOptions.find(p => p.value === priority);

  if (!authToken) {
    return (
      <div className={`bg-yellow-50 border border-yellow-200 rounded-xl p-4 ${className}`}>
        <div className="flex items-center space-x-2 text-yellow-800">
          <AlertCircle className="h-5 w-5" />
          <span className="text-sm font-medium">Autenticación requerida para comentarios administrativos</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white border border-gray-200 rounded-xl shadow-sm ${className}`}>
      {/* Diálogo de confirmación */}
      <ConfirmDialog
        isOpen={showConfirmDialog}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        title="Confirmar acción"
        message="¿Estás seguro de que deseas realizar esta acción?"
        confirmText="Eliminar"
        cancelText="Cancelar"
      />

      {/* Header */}
      <div className="border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <MessageCircle className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Comentarios Administrativos
              </h3>
              <p className="text-sm text-gray-500">
                {filteredComments.length} comentarios • Detección automática mejorada
              </p>
            </div>
          </div>
          
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            {isExpanded ? (
              <ChevronUp className="h-4 w-4 text-gray-500" />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-500" />
            )}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="p-4 space-y-4">
          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border-l-4 border-red-400 rounded-r-lg p-4">
              <div className="flex items-start space-x-3">
                <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h4 className="text-sm font-bold text-red-800">Error</h4>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                  <button
                    onClick={() => setError(null)}
                    className="mt-2 text-xs text-red-600 hover:text-red-800 underline"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Filtros rápidos */}
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">Todos los estados</option>
                {statusOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>

              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">Todas las prioridades</option>
                {priorityOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>

              <label className="flex items-center space-x-2 text-sm">
                <input
                  type="checkbox"
                  checked={showPrivateOnly}
                  onChange={(e) => setShowPrivateOnly(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-gray-700">Solo privados</span>
              </label>
            </div>
          </div>

          {/* Formulario para nuevo comentario */}
          <form onSubmit={handleSubmit} className="bg-blue-50 rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-gray-700">Nuevo Comentario Administrativo</h4>
              <div className="text-xs text-gray-500">Editor avanzado con detección automática</div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Estado</label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                >
                  {statusOptions.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Prioridad</label>
                <select
                  value={selectedPriority}
                  onChange={(e) => setSelectedPriority(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                >
                  {priorityOptions.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Categoría</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                >
                  {categoryOptions.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Visibilidad</label>
                <div className="flex items-center space-x-4 pt-2">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={isPrivate}
                      onChange={(e) => setIsPrivate(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-xs text-gray-700">Privado</span>
                  </label>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Etiquetas (separadas por comas)
              </label>
              <input
                type="text"
                value={newTags}
                onChange={(e) => setNewTags(e.target.value)}
                placeholder="revision, urgente, cliente, TODO..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <RichTextEditor
                value={newComment}
                onChange={setNewComment}
                placeholder="Escribe tu comentario administrativo...\n\nFunciones automáticas:\n• URLs: https://ejemplo.com, www.sitio.com\n• Emails: admin@empresa.com\n• Menciones: @usuario\n• Hashtags: #etiqueta #revision\n• Estados: TODO DONE PENDING URGENTE\n• Prioridades: ALTA MEDIA BAJA\n• Fechas: 2025-01-15T10:30:00"
                disabled={submitting}
                maxLength={2000}
                onValidationChange={setValidationError}
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={!newComment.trim() || submitting || validationError}
                className="inline-flex items-center px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Agregar Comentario
              </button>
            </div>
          </form>

          {/* Lista de comentarios */}
          <div className="space-y-3">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                <span className="ml-2 text-gray-500">Cargando comentarios...</span>
              </div>
            ) : filteredComments.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <MessageCircle className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p className="text-sm">No hay comentarios administrativos</p>
                <p className="text-xs text-gray-400 mt-1">
                  {searchTerm || statusFilter !== 'all' || priorityFilter !== 'all' || categoryFilter !== 'all' 
                    ? "Intenta cambiar los filtros de búsqueda"
                    : "Agrega el primer comentario administrativo para esta ruleta"
                  }
                </p>
              </div>
            ) : (
              filteredComments.map((comment) => {
                const statusOption = getStatusOption(comment.status);
                const priorityOption = getPriorityOption(comment.priority);
                const StatusIcon = statusOption?.icon || AlertCircle;
                const isEditing = editingId === comment.id;

                return (
                  <div
                    key={comment.id}
                    className={`border rounded-lg p-4 bg-white transition-all ${
                      comment.is_pinned 
                        ? 'border-yellow-300 bg-yellow-50 shadow-md' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {/* Header del comentario */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                          <User className="h-4 w-4 text-gray-600" />
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-medium text-gray-900">
                              {comment.author || currentUser?.username || 'Usuario'}
                            </span>
                            {comment.is_private && (
                              <div className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-gray-100">
                                <EyeOff className="h-3 w-3 text-gray-500" />
                                <span className="text-xs text-gray-600">Privado</span>
                              </div>
                            )}
                            {comment.is_pinned && (
                              <Pin className="h-3 w-3 text-yellow-600" />
                            )}
                          </div>
                          <div className="flex items-center space-x-2 mt-1">
                            <time className="text-xs text-gray-500">
                              {formatDate(comment.created_at)}
                            </time>
                            {comment.updated_at && comment.updated_at !== comment.created_at && (
                              <span className="text-xs text-gray-400">(editado)</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        {/* Badges */}
                        {statusOption && (
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusOption.color}`}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {statusOption.label}
                          </span>
                        )}
                        
                        {priorityOption && (
                          <span className={`text-xs font-medium px-2 py-1 rounded-full bg-gray-100 ${priorityOption.color}`}>
                            {priorityOption.label}
                          </span>
                        )}

                        {/* Menú de acciones */}
                        <div className="relative group">
                          <button className="p-1 rounded hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition-opacity">
                            <MoreHorizontal className="h-4 w-4 text-gray-500" />
                          </button>
                          
                          <div className="absolute right-0 top-8 w-48 bg-white border border-gray-200 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                            <div className="py-1">
                              <button
                                onClick={() => startEdit(comment)}
                                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                              >
                                <Edit3 className="h-4 w-4 mr-2" />
                                Editar
                              </button>
                              
                              <button
                                onClick={() => handleTogglePin(comment.id)}
                                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                              >
                                <Pin className="h-4 w-4 mr-2" />
                                {comment.is_pinned ? 'Desfijar' : 'Fijar'}
                              </button>

                              <div className="border-t border-gray-100">
                                <div className="px-4 py-2 text-xs font-medium text-gray-500">
                                  Cambiar estado:
                                </div>
                                {statusOptions.filter(s => s.value !== comment.status).map(status => (
                                  <button
                                    key={status.value}
                                    onClick={() => updateCommentStatus(comment.id, status.value)}
                                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                                  >
                                    <status.icon className="h-4 w-4 mr-2" />
                                    {status.label}
                                  </button>
                                ))}
                              </div>

                              <div className="border-t border-gray-100">
                                <button
                                  onClick={() => handleDelete(comment.id)}
                                  className="w-full px-4 py-2 text-left text-sm text-red-700 hover:bg-red-50 flex items-center"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Eliminar
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Contenido del comentario */}
                    <div className="ml-11">
                      {isEditing ? (
                        <div className="space-y-3">
                          <RichTextEditor
                            value={editingContent}
                            onChange={setEditingContent}
                            disabled={submitting}
                            maxLength={2000}
                          />
                          <div className="flex justify-end space-x-2">
                            <button
                              onClick={cancelEdit}
                              className="px-3 py-1 text-xs text-gray-600 hover:text-gray-800 border border-gray-300 rounded hover:bg-gray-50"
                              disabled={submitting}
                            >
                              Cancelar
                            </button>
                            <button
                              onClick={saveEdit}
                              disabled={!editingContent.trim() || submitting}
                              className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                            >
                              {submitting ? 'Guardando...' : 'Guardar'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div 
                            className="prose prose-sm max-w-none text-sm text-gray-700 leading-relaxed"
                            dangerouslySetInnerHTML={{ 
                              __html: comment.processed_content || detectAndProcessText(comment.content || '') 
                            }}
                          />
                          
                          {/* Etiquetas */}
                          {comment.tags && comment.tags.length > 0 && (
                            <div className="flex items-center space-x-1 mt-3">
                              <Tag className="h-3 w-3 text-gray-400" />
                              {comment.tags.map((tag, index) => (
                                <span
                                  key={index}
                                  className="inline-block px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Categoría */}
                          {comment.category && comment.category !== 'general' && (
                            <div className="mt-2">
                              <span className="inline-block px-2 py-1 text-xs bg-indigo-100 text-indigo-800 rounded">
                                {categoryOptions.find(c => c.value === comment.category)?.label || comment.category}
                              </span>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Stats footer */}
          {!loading && filteredComments.length > 0 && (
            <div className="border-t border-gray-200 pt-4 mt-6">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <div className="flex items-center space-x-4">
                  <span>Total: {comments.length}</span>
                  <span>Filtrados: {filteredComments.length}</span>
                  <span>Fijados: {comments.filter(c => c.is_pinned).length}</span>
                  <span>Privados: {comments.filter(c => c.is_private).length}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span>Última actualización: {formatDate(new Date())}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminCommentsSystem;