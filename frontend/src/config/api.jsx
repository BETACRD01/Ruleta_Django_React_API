// config/api.js - CLIENTE DE API COMPLETO Y CORREGIDO

export const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8000/api";
export const WS_URL = process.env.REACT_APP_WS_URL || "ws://localhost:8000/ws";

// =========================================
// TOKEN STORAGE (compat con el proyecto)
// =========================================
const LEGACY_KEYS = ["token", "auth_token", "authToken"];

const readAnyToken = () => {
  for (const k of LEGACY_KEYS) {
    const v = localStorage.getItem(k);
    if (v) return v;
  }
  return null;
};

const writeAllTokens = (token) => {
  for (const k of LEGACY_KEYS) {
    if (token) localStorage.setItem(k, token);
    else localStorage.removeItem(k);
  }
};

// ---------------------------------------------------------------------
// ENDPOINTS COMPLETOS
// ---------------------------------------------------------------------
export const ENDPOINTS = {
  AUTH: {
    LOGIN: "/auth/login/",
    REGISTER: "/auth/register/",
    LOGOUT: "/auth/logout/",
    USER_INFO: "/auth/user-info/",
    PROFILE: "/auth/profile/",
    PROFILE_DETAIL: "/auth/profile/detail/",
    PASSWORD_RESET_REQUEST: "/auth/password-reset/request/",
    PASSWORD_RESET_CONFIRM: "/auth/password-reset/confirm/",
    PASSWORD_RESET_VALIDATE: "/auth/password-reset/validate-token/",
    CHANGE_PASSWORD: "/auth/change-password/",
  },

  ROULETTES: {
    LIST: "/roulettes/",
    CREATE: "/roulettes/create/",
    DETAIL: (id) => `/roulettes/${id}/`,
    UPDATE: (id) => `/roulettes/${id}/update/`,
    STATS: (id) => `/roulettes/${id}/stats/`,
    DRAW_EXECUTE: "/roulettes/draw/execute/",
    DRAW_HISTORY: "/roulettes/draw/history/",
    
    // Configuraciones de ruleta
    SETTINGS: {
      GET: (id) => `/roulettes/${id}/settings/`,
      UPDATE: (id) => `/roulettes/${id}/settings/`,
    },
    
    // Premios anidados (corregidos)
    PRIZES: {
      LIST: (rid) => `/roulettes/${rid}/prizes/`,
      ADD: (rid) => `/roulettes/${rid}/prizes/`,
      ITEM: (rid, pid) => `/roulettes/${rid}/prizes/${pid}/`,
      UPDATE: (rid, pid) => `/roulettes/${rid}/prizes/${pid}/update/`,
      DELETE: (rid, pid) => `/roulettes/${rid}/prizes/${pid}/delete/`,
    },
  },

  NOTIFICATIONS: {
    USER: "/notifications/user/",
    PUBLIC: "/notifications/public/",
    DETAIL: (id) => `/notifications/${id}/`,
    MARK_READ: "/notifications/mark-read/",
    DELETE_READ: "/notifications/delete-read/",
    STATS: "/notifications/stats/",
    ROULETTE: (id) => `/notifications/roulette/${id}/`,
    CLEANUP: "/notifications/cleanup/",
    WEBHOOK: "/notifications/webhook/",
  },

  PARTICIPANTS: {
    PARTICIPATE: "/participants/participations/participate/",
    MY_PARTICIPATIONS: "/participants/participations/my-participations/",
    ROULETTE_PARTICIPANTS: (id) => `/participants/participations/roulette/${id}/`,
    CHECK_PARTICIPATION: (id) => `/participants/participations/check-participation/${id}/`,
  },
};

// ---------------------------------------------------------------------
// Helpers de multipart mejorados
// ---------------------------------------------------------------------
const isFileLike = (v) =>
  (typeof File !== "undefined" && v instanceof File) ||
  (typeof Blob !== "undefined" && v instanceof Blob) ||
  (typeof FileList !== "undefined" && v instanceof FileList);

const hasFileDeep = (value) => {
  if (!value) return false;
  if (isFileLike(value)) return true;
  if (Array.isArray(value)) return value.some(hasFileDeep);
  if (typeof value === "object") return Object.values(value).some(hasFileDeep);
  return false;
};

const appendFormData = (fd, key, val) => {
  if (val === undefined || val === null) return;
  if (isFileLike(val)) {
    if (val instanceof FileList) {
      Array.from(val).forEach((file, i) => fd.append(`${key}[${i}]`, file));
    } else {
      fd.append(key, val);
    }
  } else if (Array.isArray(val)) {
    val.forEach((v, i) => appendFormData(fd, `${key}[${i}]`, v));
  } else if (typeof val === "object") {
    Object.entries(val).forEach(([k, v]) => appendFormData(fd, `${key}[${k}]`, v));
  } else {
    fd.append(key, String(val));
  }
};

const buildFormData = (data = {}) => {
  const fd = new FormData();
  Object.entries(data).forEach(([k, v]) => appendFormData(fd, k, v));
  return fd;
};

// ---------------------------------------------------------------------
// Base API mejorada
// ---------------------------------------------------------------------
class BaseAPI {
  constructor(baseURL = API_URL, authToken = null) {
    this.baseURL = baseURL;
    this.authToken = authToken || readAnyToken();
  }

  setAuthToken(token) {
    this.authToken = token || null;
    writeAllTokens(token || null);
  }

  getHeaders(isMultipart = false) {
    const token = this.authToken || readAnyToken();
    const headers = { Accept: "application/json" };
    if (token) headers["Authorization"] = `Token ${token}`;
    if (!isMultipart) headers["Content-Type"] = "application/json";
    return headers;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const requestOptions = {
      method: options.method || "GET",
      headers: this.getHeaders(options.isMultipart),
      body: options.body,
      signal: options.signal,
    };

    try {
      const res = await fetch(url, requestOptions);

      if (!res.ok) {
        // Intentar decodificar JSON del backend
        let data = {};
        try { data = await res.json(); } catch (_) {}

        // Mensaje útil
        const backendMessage =
          data?.message
          || (Array.isArray(data?.non_field_errors) && data.non_field_errors.join(", "))
          || (typeof data?.detail === "string" && data.detail)
          || (data?.errors && JSON.stringify(data.errors))
          || null;

        if (res.status === 401) {
          this.setAuthToken(null);
          if (endpoint.startsWith("/notifications")) {
            throw new Error(backendMessage || "Sesión expirada. Inicia sesión para ver tus notificaciones.");
          }
          if (endpoint.startsWith("/roulettes") || endpoint.startsWith("/participants")) {
            throw new Error(backendMessage || "Sesión expirada. Inicia sesión para continuar.");
          }
          throw new Error(backendMessage || "Sesión expirada. Inicia sesión de nuevo.");
        }

        if (res.status === 403) {
          throw new Error(backendMessage || "No tienes permisos para realizar esta acción.");
        }

        if (res.status === 404) {
          throw new Error(backendMessage || "Recurso no encontrado.");
        }

        throw new Error(backendMessage || `HTTP ${res.status}: ${res.statusText}`);
      }

      if (res.status === 204) return null;
      return await res.json();
    } catch (err) {
      console.error(`API Error [${endpoint}]`, err);
      throw err;
    }
  }
}

// ---------------------------------------------------------------------
// AUTH API
// ---------------------------------------------------------------------
export class AuthAPI extends BaseAPI {
  constructor() { super(API_URL); }

  async login(credentials) {
    const result = await this.request(ENDPOINTS.AUTH.LOGIN, {
      method: "POST",
      body: JSON.stringify(credentials)
    });
    if (result?.success && result?.token) this.setAuthToken(result.token);
    return result;
  }

  async register(data) {
    const result = await this.request(ENDPOINTS.AUTH.REGISTER, {
      method: "POST",
      body: JSON.stringify(data)
    });
    if (result?.success && result?.token) this.setAuthToken(result.token);
    return result;
  }

  async logout() {
    try { 
      await this.request(ENDPOINTS.AUTH.LOGOUT, { method: "POST" }); 
    } finally { 
      this.setAuthToken(null); 
    }
  }

  getUserInfo() { 
    return this.request(ENDPOINTS.AUTH.USER_INFO); 
  }

  updateProfile(profile) { 
    return this.request(ENDPOINTS.AUTH.PROFILE, { 
      method: "PUT", 
      body: JSON.stringify(profile) 
    }); 
  }

  getProfileDetail() { 
    return this.request(ENDPOINTS.AUTH.PROFILE_DETAIL); 
  }

  changePassword(payload) { 
    return this.request(ENDPOINTS.AUTH.CHANGE_PASSWORD, { 
      method: "POST", 
      body: JSON.stringify(payload) 
    }); 
  }

  requestPasswordReset(email) { 
    return this.request(ENDPOINTS.AUTH.PASSWORD_RESET_REQUEST, { 
      method: "POST", 
      body: JSON.stringify({ email }) 
    }); 
  }

  confirmPasswordReset(payload) { 
    return this.request(ENDPOINTS.AUTH.PASSWORD_RESET_CONFIRM, { 
      method: "POST", 
      body: JSON.stringify(payload) 
    }); 
  }

  validateResetToken(token) { 
    return this.request(ENDPOINTS.AUTH.PASSWORD_RESET_VALIDATE, { 
      method: "POST", 
      body: JSON.stringify({ token }) 
    }); 
  }
}

// ---------------------------------------------------------------------
// ROULETTES API COMPLETA (con configuraciones y premios)
// ---------------------------------------------------------------------
export class RoulettesAPI extends BaseAPI {
  constructor(token = null) { super(API_URL, token); }

  // ---- Operaciones principales de ruletas ----
  getRoulettes(params = {}) {
    const q = new URLSearchParams();
    if (params.status) q.append("status", params.status);
    if (params.page) q.append("page", params.page);
    if (params.page_size) q.append("page_size", params.page_size);
    const ep = `${ENDPOINTS.ROULETTES.LIST}${q.toString() ? `?${q}` : ""}`;
    return this.request(ep);
  }

  getRoulette(id) { 
    return this.request(ENDPOINTS.ROULETTES.DETAIL(id)); 
  }

  createRoulette(data) {
    const sendMultipart = hasFileDeep(data);
    if (sendMultipart) {
      const fd = buildFormData(data);
      return this.request(ENDPOINTS.ROULETTES.CREATE, { 
        method: "POST", 
        body: fd, 
        isMultipart: true 
      });
    }
    return this.request(ENDPOINTS.ROULETTES.CREATE, { 
      method: "POST", 
      body: JSON.stringify(data) 
    });
  }

  // Método específico para creación con archivos
  createRouletteMultipart(data) {
    const fd = buildFormData(data);
    return this.request(ENDPOINTS.ROULETTES.CREATE, { 
      method: "POST", 
      body: fd, 
      isMultipart: true 
    });
  }

  updateRoulette(id, data) {
    const sendMultipart = hasFileDeep(data);
    if (sendMultipart) {
      const fd = buildFormData(data);
      return this.request(ENDPOINTS.ROULETTES.UPDATE(id), { 
        method: "PUT", 
        body: fd, 
        isMultipart: true 
      });
    }
    return this.request(ENDPOINTS.ROULETTES.UPDATE(id), { 
      method: "PUT", 
      body: JSON.stringify(data) 
    });
  }

  // Método específico para actualización con PATCH
  patchRoulette(id, data) {
    const sendMultipart = hasFileDeep(data);
    if (sendMultipart) {
      const fd = buildFormData(data);
      return this.request(ENDPOINTS.ROULETTES.UPDATE(id), { 
        method: "PATCH", 
        body: fd, 
        isMultipart: true 
      });
    }
    return this.request(ENDPOINTS.ROULETTES.UPDATE(id), { 
      method: "PATCH", 
      body: JSON.stringify(data) 
    });
  }

  deleteRoulette(id) {
    return this.request(ENDPOINTS.ROULETTES.DETAIL(id), { 
      method: "DELETE" 
    });
  }

  // ---- Operaciones de sorteo ----
  executeRouletteDraw(rouletteId) {
    return this.request(ENDPOINTS.ROULETTES.DRAW_EXECUTE, {
      method: "POST",
      body: JSON.stringify({ roulette_id: rouletteId }),
    });
  }

  getRouletteStats(id) { 
    return this.request(ENDPOINTS.ROULETTES.STATS(id)); 
  }

  getDrawHistory(params = {}) {
    const q = new URLSearchParams();
    if (params.roulette_id) q.append("roulette_id", params.roulette_id);
    if (params.page) q.append("page", params.page);
    if (params.page_size) q.append("page_size", params.page_size);
    const ep = `${ENDPOINTS.ROULETTES.DRAW_HISTORY}${q.toString() ? `?${q}` : ""}`;
    return this.request(ep);
  }

  // ---- Configuraciones de ruleta (NUEVA FUNCIONALIDAD) ----
  getRouletteSettings(id) {
    return this.request(ENDPOINTS.ROULETTES.SETTINGS.GET(id));
  }

  updateRouletteSettings(id, settings) {
    return this.request(ENDPOINTS.ROULETTES.SETTINGS.UPDATE(id), {
      method: "PUT",
      body: JSON.stringify(settings),
    });
  }

  patchRouletteSettings(id, settings) {
    return this.request(ENDPOINTS.ROULETTES.SETTINGS.UPDATE(id), {
      method: "PATCH",
      body: JSON.stringify(settings),
    });
  }

  // ---- Premios anidados (mejorado) ----
  listPrizes(rouletteId) {
    return this.request(ENDPOINTS.ROULETTES.PRIZES.LIST(rouletteId));
  }

  getPrize(rouletteId, prizeId) {
    return this.request(ENDPOINTS.ROULETTES.PRIZES.ITEM(rouletteId, prizeId));
  }

  addPrize(rouletteId, prize) {
    const isMulti = hasFileDeep(prize);
    const body = isMulti ? buildFormData(prize) : JSON.stringify(prize);
    return this.request(ENDPOINTS.ROULETTES.PRIZES.ADD(rouletteId), {
      method: "POST",
      body,
      isMultipart: isMulti,
    });
  }

  updatePrize(rouletteId, prizeId, updates) {
    const isMulti = hasFileDeep(updates);
    const body = isMulti ? buildFormData(updates) : JSON.stringify(updates);
    return this.request(ENDPOINTS.ROULETTES.PRIZES.UPDATE(rouletteId, prizeId), {
      method: "PUT",
      body,
      isMultipart: isMulti,
    });
  }

  patchPrize(rouletteId, prizeId, updates) {
    const isMulti = hasFileDeep(updates);
    const body = isMulti ? buildFormData(updates) : JSON.stringify(updates);
    return this.request(ENDPOINTS.ROULETTES.PRIZES.UPDATE(rouletteId, prizeId), {
      method: "PATCH",
      body,
      isMultipart: isMulti,
    });
  }

  deletePrize(rouletteId, prizeId) {
    return this.request(ENDPOINTS.ROULETTES.PRIZES.DELETE(rouletteId, prizeId), { 
      method: "DELETE" 
    });
  }

  // ---- Métodos de conveniencia ----
  
  // Crear ruleta con configuraciones y premios
  async createCompleteRoulette(rouletteData, settings = {}, prizes = []) {
    try {
      // 1. Crear ruleta
      const roulette = await this.createRoulette(rouletteData);
      
      // 2. Actualizar configuraciones si se proporcionan
      if (Object.keys(settings).length > 0) {
        await this.updateRouletteSettings(roulette.id, settings);
      }
      
      // 3. Agregar premios si se proporcionan
      const addedPrizes = [];
      for (const prize of prizes) {
        const addedPrize = await this.addPrize(roulette.id, prize);
        addedPrizes.push(addedPrize);
      }
      
      return { 
        roulette, 
        settings: settings, 
        prizes: addedPrizes 
      };
    } catch (error) {
      console.error("Error creating complete roulette:", error);
      throw error;
    }
  }

  // Obtener información completa de ruleta
  async getCompleteRoulette(id) {
    try {
      const [roulette, prizes] = await Promise.all([
        this.getRoulette(id),
        this.listPrizes(id),
      ]);
      
      return {
        ...roulette,
        prizes: prizes || []
      };
    } catch (error) {
      console.error("Error fetching complete roulette:", error);
      throw error;
    }
  }

  // Validar si se puede participar en ruleta
  async canParticipateInRoulette(id, userId = null) {
    try {
      const roulette = await this.getRoulette(id);
      
      // Verificaciones básicas
      if (roulette.is_drawn || roulette.status === 'completed') {
        return { canParticipate: false, reason: 'La ruleta ya fue sorteada' };
      }
      
      if (roulette.status === 'cancelled') {
        return { canParticipate: false, reason: 'La ruleta fue cancelada' };
      }
      
      // Verificar límite de participantes
      if (roulette.settings?.max_participants > 0 && 
          roulette.participants_count >= roulette.settings.max_participants) {
        return { canParticipate: false, reason: 'Se alcanzó el límite de participantes' };
      }
      
      // Verificar fecha programada
      if (roulette.scheduled_date) {
        const scheduledDate = new Date(roulette.scheduled_date);
        if (scheduledDate <= new Date()) {
          return { canParticipate: false, reason: 'El período de participación ha terminado' };
        }
      }
      
      return { canParticipate: true };
    } catch (error) {
      console.error("Error checking participation eligibility:", error);
      return { canParticipate: false, reason: 'Error al verificar elegibilidad' };
    }
  }
}

// ---------------------------------------------------------------------
// PARTICIPANTS API (sin cambios)
// ---------------------------------------------------------------------
export class ParticipantsAPI extends BaseAPI {
  constructor(token = null) { super(API_URL, token); }

  participate(rouletteId, receiptFile = null) {
    const fd = new FormData();
    fd.append("roulette_id", rouletteId);
    if (receiptFile) fd.append("receipt", receiptFile);
    return this.request(ENDPOINTS.PARTICIPANTS.PARTICIPATE, { 
      method: "POST", 
      body: fd, 
      isMultipart: true 
    });
  }

  getMyParticipations(params = {}) {
    const q = new URLSearchParams();
    if (params.page) q.append("page", params.page);
    if (params.page_size) q.append("page_size", params.page_size);
    const ep = `${ENDPOINTS.PARTICIPANTS.MY_PARTICIPATIONS}${q.toString() ? `?${q}` : ""}`;
    return this.request(ep);
  }

  getRouletteParticipants(rouletteId, params = {}) {
    const q = new URLSearchParams();
    if (params.page) q.append("page", params.page);
    if (params.page_size) q.append("page_size", params.page_size);
    const ep = `${ENDPOINTS.PARTICIPANTS.ROULETTE_PARTICIPANTS(rouletteId)}${q.toString() ? `?${q}` : ""}`;
    return this.request(ep);
  }

  checkParticipation(rouletteId) { 
    return this.request(ENDPOINTS.PARTICIPANTS.CHECK_PARTICIPATION(rouletteId)); 
  }
}

// ---------------------------------------------------------------------
// NOTIFICATIONS API (mejorada)
// ---------------------------------------------------------------------
export class NotificationAPI extends BaseAPI {
  constructor(token = null) { super(API_URL, token); }

  getUserNotifications(params = {}) {
    const q = new URLSearchParams();
    if (params.unread_only) q.append("unread_only", "true");
    if (params.roulette_id) q.append("roulette_id", params.roulette_id);
    if (params.page) q.append("page", params.page);
    if (params.page_size) q.append("page_size", params.page_size);
    if (params.include_stats) q.append("include_stats", "true");
    const ep = `${ENDPOINTS.NOTIFICATIONS.USER}${q.toString() ? `?${q}` : ""}`;
    return this.request(ep);
  }

  getPublicNotifications(params = {}) {
    const q = new URLSearchParams();
    if (params.page) q.append("page", params.page);
    if (params.page_size) q.append("page_size", params.page_size);
    const ep = `${ENDPOINTS.NOTIFICATIONS.PUBLIC}${q.toString() ? `?${q}` : ""}`;
    return this.request(ep);
  }

  getNotification(id) {
    return this.request(ENDPOINTS.NOTIFICATIONS.DETAIL(id));
  }

  markAsRead(ids) {
    const idsArray = Array.isArray(ids) ? ids : [ids];
    return this.request(ENDPOINTS.NOTIFICATIONS.MARK_READ, {
      method: "POST",
      body: JSON.stringify({ notification_ids: idsArray }),
    });
  }

  markAllAsRead() {
    return this.request(ENDPOINTS.NOTIFICATIONS.MARK_READ, {
      method: "POST",
      body: JSON.stringify({ mark_all: true }),
    });
  }

  delete(id) { 
    return this.request(ENDPOINTS.NOTIFICATIONS.DETAIL(id), { 
      method: "DELETE" 
    }); 
  }

  deleteRead() { 
    return this.request(ENDPOINTS.NOTIFICATIONS.DELETE_READ, { 
      method: "DELETE" 
    }); 
  }

  stats() { 
    return this.request(ENDPOINTS.NOTIFICATIONS.STATS); 
  }

  byRoulette(id) { 
    return this.request(ENDPOINTS.NOTIFICATIONS.ROULETTE(id)); 
  }

  cleanup() {
    return this.request(ENDPOINTS.NOTIFICATIONS.CLEANUP, {
      method: "POST"
    });
  }

  // ===== Alias de compatibilidad con el UI actual =====
  getNotificationStats() { 
    return this.stats(); 
  }
  
  markNotificationsAsRead(ids) { 
    return this.markAsRead(ids); 
  }
}

// ---------------------------------------------------------------------
// INSTANCIAS GLOBALES (compatibles con imports actuales)
// ---------------------------------------------------------------------
export const authAPI = new AuthAPI();
export const roulettesAPI = new RoulettesAPI(readAnyToken());
export const participantsAPI = new ParticipantsAPI(readAnyToken());
export const notificationAPI = new NotificationAPI(readAnyToken());

// ---------------------------------------------------------------------
// HELPERS Y UTILIDADES ADICIONALES
// ---------------------------------------------------------------------

// Actualizar tokens en todas las instancias
export const setGlobalAuthToken = (token) => {
  writeAllTokens(token);
  authAPI.setAuthToken(token);
  roulettesAPI.setAuthToken(token);
  participantsAPI.setAuthToken(token);
  notificationAPI.setAuthToken(token);
};

export const getGlobalAuthToken = () => readAnyToken();

// Limpiar todas las instancias (logout)
export const clearAllTokens = () => {
  setGlobalAuthToken(null);
};

// Verificar si el usuario está autenticado
export const isAuthenticated = () => {
  return !!readAnyToken();
};

// Helper para manejar errores de API de forma consistente
export const handleAPIError = (error, fallbackMessage = "Error desconocido") => {
  if (error?.response?.data?.message) {
    return error.response.data.message;
  }
  if (error?.response?.data?.detail) {
    return error.response.data.detail;
  }
  if (error?.response?.data?.non_field_errors) {
    return Array.isArray(error.response.data.non_field_errors) 
      ? error.response.data.non_field_errors.join(', ')
      : error.response.data.non_field_errors;
  }
  if (error?.message) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  console.error("Unhandled API error:", error);
  return fallbackMessage;
};

// Helper para crear parámetros de paginación
export const createPaginationParams = (page = 1, pageSize = 20, additionalParams = {}) => {
  return {
    page: page,
    page_size: pageSize,
    ...additionalParams
  };
};

// Helper para formatear respuestas paginadas
export const formatPaginatedResponse = (response) => {
  return {
    results: response?.results || response?.data || [],
    count: response?.count || 0,
    next: response?.next || null,
    previous: response?.previous || null,
    totalPages: Math.ceil((response?.count || 0) / (response?.page_size || 20)),
    currentPage: response?.current_page || response?.page || 1,
    pageSize: response?.page_size || 20,
    hasNext: !!response?.next,
    hasPrevious: !!response?.previous
  };
};

// Validadores de datos mejorados
export const validators = {
  email: (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  },
  
  password: (password) => {
    return password && password.length >= 8;
  },
  
  required: (value) => {
    return value !== null && value !== undefined && value !== '';
  },
  
  positiveNumber: (value) => {
    const num = Number(value);
    return !isNaN(num) && num > 0;
  },
  
  nonNegativeNumber: (value) => {
    const num = Number(value);
    return !isNaN(num) && num >= 0;
  },
  
  probability: (value) => {
    const num = Number(value);
    return !isNaN(num) && num >= 0 && num <= 100;
  },

  dateInFuture: (dateString) => {
    if (!dateString) return false;
    const date = new Date(dateString);
    return date > new Date();
  },

  fileSize: (file, maxSizeMB = 5) => {
    if (!file) return false;
    const maxSize = maxSizeMB * 1024 * 1024;
    return file.size <= maxSize;
  },

  fileExtension: (file, allowedExtensions = ['.jpg', '.jpeg', '.png', '.pdf']) => {
    if (!file || !file.name) return false;
    const ext = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    return allowedExtensions.includes(ext);
  },

  username: (username) => {
    if (!username) return false;
    const re = /^[a-zA-Z0-9_]{3,30}$/;
    return re.test(username);
  },

  phone: (phone) => {
    if (!phone) return false;
    const re = /^\+?[\d\s\-\(\)]{10,}$/;
    return re.test(phone);
  }
};

// Estados y constantes
export const ROULETTE_STATUS = {
  ACTIVE: 'active',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
};

export const DRAW_TYPES = {
  MANUAL: 'manual',
  AUTOMATIC: 'automatic',
  ADMIN: 'admin'
};

export const NOTIFICATION_TYPES = {
  PARTICIPATION_CONFIRMED: 'participation_confirmed',
  ROULETTE_DRAW: 'roulette_draw',
  WINNER_SELECTED: 'winner_selected',
  ROULETTE_CREATED: 'roulette_created',
  SYSTEM: 'system'
};

export const FILE_TYPES = {
  IMAGE: 'image',
  PDF: 'pdf',
  OTHER: 'other'
};

// Utilidades de formato
export const formatters = {
  fileSize: (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  },

  currency: (amount, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  },

  date: (dateString, options = {}) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const defaultOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    return date.toLocaleDateString('es-ES', { ...defaultOptions, ...options });
  },

  relativeTime: (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Ahora';
    if (diffMins < 60) return `Hace ${diffMins}m`;
    if (diffHours < 24) return `Hace ${diffHours}h`;
    if (diffDays < 7) return `Hace ${diffDays}d`;
    return formatters.date(dateString, { year: 'numeric', month: 'short', day: 'numeric' });
  },

  truncate: (text, maxLength = 100) => {
    if (!text) return '';
    return text.length <= maxLength ? text : text.substring(0, maxLength) + '...';
  },

  percentage: (value, total) => {
    if (total === 0) return '0%';
    return Math.round((value / total) * 100) + '%';
  }
};

// Cache simple para optimizar peticiones
class SimpleCache {
  constructor(ttl = 5 * 60 * 1000) { // 5 minutos por defecto
    this.cache = new Map();
    this.ttl = ttl;
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data;
  }

  set(key, data) {
    this.cache.set(key, {
      data,
      expiry: Date.now() + this.ttl
    });
  }

  clear() {
    this.cache.clear();
  }

  delete(key) {
    this.cache.delete(key);
  }
}

export const apiCache = new SimpleCache();

// Helper para retry automático en peticiones fallidas
export const withRetry = async (fn, maxRetries = 3, delay = 1000) => {
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i === maxRetries - 1) break;
      
      // No reintentar en errores 4xx (excepto 429)
      if (error?.response?.status >= 400 && error?.response?.status < 500 && error?.response?.status !== 429) {
        break;
      }
      
      await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
    }
  }
  
  throw lastError;
};

// Helper para batch requests
export const batchRequests = async (requests, batchSize = 5) => {
  const results = [];
  
  for (let i = 0; i < requests.length; i += batchSize) {
    const batch = requests.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(batch);
    results.push(...batchResults);
  }
  
  return results;
};

// Utilidades para WebSocket (si está disponible)
export const websocketUtils = {
  connect: (url, token) => {
    const wsUrl = token ? `${url}?token=${token}` : url;
    return new WebSocket(wsUrl);
  },

  sendMessage: (ws, type, data) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type, data }));
    }
  },

  setupHeartbeat: (ws, interval = 30000) => {
    const heartbeat = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        websocketUtils.sendMessage(ws, 'ping', { timestamp: Date.now() });
      } else {
        clearInterval(heartbeat);
      }
    }, interval);
    return heartbeat;
  }
};

// Helper para manejar uploads con progreso
export const uploadWithProgress = (api, endpoint, formData, onProgress) => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        const percentComplete = (e.loaded / e.total) * 100;
        onProgress(percentComplete);
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          resolve(response);
        } catch (e) {
          resolve(xhr.responseText);
        }
      } else {
        reject(new Error(`HTTP ${xhr.status}: ${xhr.statusText}`));
      }
    });

    xhr.addEventListener('error', () => {
      reject(new Error('Error de red'));
    });

    const token = api.authToken || readAnyToken();
    xhr.open('POST', `${api.baseURL}${endpoint}`);
    xhr.setRequestHeader('Accept', 'application/json');
    if (token) {
      xhr.setRequestHeader('Authorization', `Token ${token}`);
    }

    xhr.send(formData);
  });
};

// Helper para generar IDs únicos
export const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

// Helper para deep merge de objetos
export const deepMerge = (target, source) => {
  const result = { ...target };
  
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(result[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  
  return result;
};

// Helper para detectar tipo de dispositivo
export const deviceUtils = {
  isMobile: () => /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
  isTablet: () => /iPad|Android/i.test(navigator.userAgent) && window.innerWidth >= 768,
  isDesktop: () => !deviceUtils.isMobile() && !deviceUtils.isTablet(),
  getScreenSize: () => {
    const width = window.innerWidth;
    if (width < 640) return 'sm';
    if (width < 768) return 'md';
    if (width < 1024) return 'lg';
    return 'xl';
  }
};

// Utilidades adicionales para autenticación
export const authUtils = {
  // Verificar si un token está expirado
  isTokenExpired: (token) => {
    if (!token) return true;
    try {
      // Si el token es JWT, decodificar y verificar exp
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1]));
        return payload.exp * 1000 < Date.now();
      }
      return false; // Para tokens simples, asumimos que no expiran
    } catch (e) {
      return false;
    }
  },

  // Obtener información del usuario desde el token
  getUserFromToken: (token) => {
    if (!token) return null;
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1]));
        return {
          id: payload.user_id,
          username: payload.username,
          email: payload.email,
          exp: payload.exp,
        };
      }
      return null;
    } catch (e) {
      return null;
    }
  },

  // Verificar permisos
  hasPermission: (userPermissions, requiredPermission) => {
    if (!userPermissions || !Array.isArray(userPermissions)) return false;
    return userPermissions.includes(requiredPermission);
  },

  // Verificar roles
  hasRole: (userRoles, requiredRole) => {
    if (!userRoles || !Array.isArray(userRoles)) return false;
    return userRoles.includes(requiredRole);
  }
};

// Gestor de sesión mejorado
export class SessionManager {
  constructor() {
    this.listeners = new Set();
    this.checkInterval = null;
    this.warningShown = false;
    this.startSessionCheck();
  }

  // Agregar listener para cambios de sesión
  addListener(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  // Notificar a todos los listeners
  notifyListeners(event, data = {}) {
    this.listeners.forEach(callback => {
      try {
        callback(event, data);
      } catch (error) {
        console.error('Error in session listener:', error);
      }
    });
  }

  // Iniciar verificación periódica de sesión
  startSessionCheck(interval = 60000) { // 1 minuto
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    this.checkInterval = setInterval(() => {
      const token = readAnyToken();
      if (token && authUtils.isTokenExpired(token)) {
        this.handleExpiredToken();
      }
    }, interval);
  }

  // Manejar token expirado
  handleExpiredToken() {
    if (!this.warningShown) {
      this.warningShown = true;
      this.notifyListeners('token_expired');
      clearAllTokens();
    }
  }

  // Limpiar sesión
  destroy() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
    this.listeners.clear();
  }
}

// Instancia global del gestor de sesión
export const sessionManager = new SessionManager();

// Utilidades para tokens
export const tokenUtils = {
  // Obtener tiempo restante de un token
  getTimeRemaining: (token) => {
    const user = authUtils.getUserFromToken(token);
    if (!user || !user.exp) return null;
    
    const remaining = user.exp * 1000 - Date.now();
    return Math.max(0, remaining);
  },

  // Formatear tiempo restante
  formatTimeRemaining: (milliseconds) => {
    if (!milliseconds || milliseconds <= 0) return 'Expirado';
    
    const minutes = Math.floor(milliseconds / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    return `${minutes}m`;
  },

  // Verificar si el token expira pronto
  isExpiringSoon: (token, thresholdMinutes = 15) => {
    const remaining = tokenUtils.getTimeRemaining(token);
    if (!remaining) return false;
    return remaining < thresholdMinutes * 60000;
  }
};

// Utilidades para notificaciones
export const notificationUtils = {
  // Agrupar notificaciones por tipo
  groupByType: (notifications) => {
    return notifications.reduce((groups, notification) => {
      const type = notification.notification_type || 'other';
      if (!groups[type]) groups[type] = [];
      groups[type].push(notification);
      return groups;
    }, {});
  },

  // Filtrar notificaciones no leídas
  getUnread: (notifications) => {
    return notifications.filter(n => !n.is_read);
  },

  // Obtener notificaciones recientes
  getRecent: (notifications, hours = 24) => {
    const threshold = new Date(Date.now() - hours * 60 * 60 * 1000);
    return notifications.filter(n => new Date(n.created_at) > threshold);
  },

  // Formatear conteo de notificaciones
  formatCount: (count) => {
    if (count === 0) return '';
    if (count <= 99) return count.toString();
    return '99+';
  }
};

// Gestor de notificaciones mejorado
export class NotificationManager {
  constructor() {
    this.listeners = new Set();
    this.cache = new Map();
    this.pollInterval = null;
    this.isPolling = false;
  }

  // Agregar listener
  addListener(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  // Notificar cambios
  notifyListeners(event, data) {
    this.listeners.forEach(callback => {
      try {
        callback(event, data);
      } catch (error) {
        console.error('Error in notification listener:', error);
      }
    });
  }

  // Iniciar polling de notificaciones
  startPolling(intervalMs = 30000) {
    if (this.isPolling) return;

    this.isPolling = true;
    this.pollInterval = setInterval(async () => {
      try {
        await this.fetchAndUpdate();
      } catch (error) {
        console.error('Error polling notifications:', error);
      }
    }, intervalMs);
  }

  // Detener polling
  stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.isPolling = false;
  }

  // Obtener y actualizar notificaciones
  async fetchAndUpdate() {
    try {
      const response = await notificationAPI.getUserNotifications({
        include_stats: true,
        page_size: 50
      });

      const notifications = response.results || [];
      const stats = response.stats || { unread_count: 0, total_count: 0 };

      // Verificar cambios
      const cacheKey = 'user_notifications';
      const cached = this.cache.get(cacheKey);
      
      if (!cached || JSON.stringify(notifications) !== JSON.stringify(cached.notifications)) {
        this.cache.set(cacheKey, { notifications, stats, timestamp: Date.now() });
        this.notifyListeners('notifications_updated', { notifications, stats });
      }

      return { notifications, stats };
    } catch (error) {
      if (error.message?.includes('Sesión expirada')) {
        this.stopPolling();
      }
      throw error;
    }
  }

  // Obtener notificaciones desde cache
  getCachedNotifications() {
    const cached = this.cache.get('user_notifications');
    return cached || { notifications: [], stats: { unread_count: 0, total_count: 0 } };
  }

  // Limpiar cache
  clearCache() {
    this.cache.clear();
  }

  // Destruir instancia
  destroy() {
    this.stopPolling();
    this.listeners.clear();
    this.clearCache();
  }
}

// Instancia global del gestor de notificaciones
export const notificationManager = new NotificationManager();

// Export del objeto principal con funcionalidades completas
export default {
  // APIs principales
  authAPI,
  roulettesAPI,
  participantsAPI,
  notificationAPI,
  
  // Gestión de tokens
  setGlobalAuthToken,
  getGlobalAuthToken,
  clearAllTokens,
  isAuthenticated,
  
  // Utilidades generales
  handleAPIError,
  createPaginationParams,
  formatPaginatedResponse,
  validators,
  formatters,
  apiCache,
  withRetry,
  batchRequests,
  websocketUtils,
  uploadWithProgress,
  generateId,
  deepMerge,
  deviceUtils,
  
  // Utilidades específicas
  authUtils,
  SessionManager,
  sessionManager,
  tokenUtils,
  notificationUtils,
  NotificationManager,
  notificationManager,
  
  // Constantes
  ROULETTE_STATUS,
  DRAW_TYPES,
  NOTIFICATION_TYPES,
  FILE_TYPES,
  
  // Endpoints (por si se necesitan en otros módulos)
  ENDPOINTS,

  // Funciones de inicialización
  init: (config = {}) => {
    // Configurar APIs con configuración personalizada
    if (config.apiUrl) {
      // Actualizar URLs base si se proporciona configuración personalizada
      authAPI.baseURL = config.apiUrl;
      roulettesAPI.baseURL = config.apiUrl;
      participantsAPI.baseURL = config.apiUrl;
      notificationAPI.baseURL = config.apiUrl;
    }
    
    if (config.token) {
      setGlobalAuthToken(config.token);
    }

    // Iniciar polling de notificaciones si está autenticado
    if (config.enableNotificationPolling !== false && isAuthenticated()) {
      notificationManager.startPolling(config.notificationPollInterval);
    }

    return {
      success: true,
      message: 'API Client initialized successfully',
      config: {
        apiUrl: config.apiUrl || API_URL,
        hasToken: !!getGlobalAuthToken(),
        notificationPolling: config.enableNotificationPolling !== false
      }
    };
  },

  // Información del cliente
  version: '2.0.0',
  features: [
    'Complete CRUD operations',
    'File upload with validation',
    'Real-time notifications',
    'Pagination support',
    'Caching system',
    'Error handling',
    'Session management',
    'Token utilities',
    'WebSocket support',
    'Batch requests',
    'Upload progress tracking',
    'Device detection',
    'Data validators',
    'Response formatters'
  ] 
};
