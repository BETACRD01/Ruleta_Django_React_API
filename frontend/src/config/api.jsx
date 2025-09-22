// src/config/api.jsx
export const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8000/api";
export const WS_URL  = process.env.REACT_APP_WS_URL  || "ws://localhost:8000/ws";

/* ================================
   Token helpers (compatibles)
================================ */
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

export const setGlobalAuthToken = (t) => writeAllTokens(t);
export const getGlobalAuthToken = () => readAnyToken();
export const clearAllTokens      = () => writeAllTokens(null);
export const isAuthenticated     = () => Boolean(readAnyToken());

/* ================================
   Endpoints (alineados backend)
================================ */
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
    DELETE: (id) => `/roulettes/${id}/delete/`,        // soporta ?force=1 en la vista
    STATS:  (id) => `/roulettes/${id}/stats/`,
    DRAW_EXECUTE: "/roulettes/draw/execute/",
    DRAW_HISTORY: "/roulettes/draw/history/",
    SETTINGS: {
      GET:    (id) => `/roulettes/${id}/settings/`,
      UPDATE: (id) => `/roulettes/${id}/settings/`,
    },
    PRIZES: {
      LIST:   (rid)            => `/roulettes/${rid}/prizes/`,
      ADD:    (rid)            => `/roulettes/${rid}/prizes/`,
      ITEM:   (rid, pid)       => `/roulettes/${rid}/prizes/${pid}/`,
      UPDATE: (rid, pid)       => `/roulettes/${rid}/prizes/${pid}/update/`,
      DELETE: (rid, pid)       => `/roulettes/${rid}/prizes/${pid}/delete/`,
    },
  },

  PARTICIPANTS: {
    PARTICIPATE:           "/participants/participations/participate/",
    MY_PARTICIPATIONS:     "/participants/participations/my-participations/",
    ROULETTE_PARTICIPANTS: (id) => `/participants/participations/roulette/${id}/`,
    CHECK_PARTICIPATION:   (id) => `/participants/participations/check-participation/${id}/`,
  },
};

export const NOTIFICATION_ENDPOINTS = {
  USER: "/notifications/user/",
  PUBLIC: "/notifications/public/",
  ADMIN: "/notifications/admin/",
  DETAIL: (id) => `/notifications/${id}/`,
  MARK_READ: "/notifications/mark-read/",
  MARK_ALL_READ: "/notifications/mark-all-read/",
  DELETE_READ: "/notifications/delete-read/",
  STATS: "/notifications/stats/",
  DASHBOARD: "/notifications/dashboard/",
  ROULETTE: (id) => `/notifications/roulette/${id}/`,
  CLEANUP: "/notifications/cleanup/",
  WEBHOOK: "/notifications/webhook/",
  WINNER_ANNOUNCEMENT: "/notifications/winner-announcement/",
  ADMIN_PREFERENCES: "/notifications/admin-preferences/",
  TEMPLATES: "/notifications/templates/",
  TEMPLATE_DETAIL: (id) => `/notifications/templates/${id}/`,
  REALTIME: "/notifications/realtime/",
};

/* ================================
   Helpers Multipart
================================ */
const isFileLike = (v) =>
  (typeof File !== "undefined"      && v instanceof File) ||
  (typeof Blob !== "undefined"      && v instanceof Blob) ||
  (typeof FileList !== "undefined"  && v instanceof FileList);

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

/* ================================
   Base API (errores y auth)
================================ */
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
    if (token) headers.Authorization = `Token ${token}`;
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
        let data = {};
        try { data = await res.json(); } catch (_) {}

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

        if (res.status === 403) throw new Error(backendMessage || "No tienes permisos para realizar esta acción.");
        if (res.status === 404) throw new Error(backendMessage || "Recurso no encontrado.");
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

/* ================================
   Auth API
================================ */
export class AuthAPI extends BaseAPI {
  constructor() { super(API_URL); }

  async login(credentials) {
    const result = await this.request(ENDPOINTS.AUTH.LOGIN, { method: "POST", body: JSON.stringify(credentials) });
    if (result?.success && result?.token) this.setAuthToken(result.token);
    return result;
  }

  async register(data) {
    const result = await this.request(ENDPOINTS.AUTH.REGISTER, { method: "POST", body: JSON.stringify(data) });
    if (result?.success && result?.token) this.setAuthToken(result.token);
    return result;
  }

  async logout() {
    try { await this.request(ENDPOINTS.AUTH.LOGOUT, { method: "POST" }); }
    finally { this.setAuthToken(null); }
  }

  getUserInfo()      { return this.request(ENDPOINTS.AUTH.USER_INFO); }
  getProfileDetail() { return this.request(ENDPOINTS.AUTH.PROFILE_DETAIL); }

  updateProfile(profile) {
    return this.request(ENDPOINTS.AUTH.PROFILE, { method: "PUT", body: JSON.stringify(profile) });
  }

  changePassword(payload) {
    return this.request(ENDPOINTS.AUTH.CHANGE_PASSWORD, { method: "POST", body: JSON.stringify(payload) });
  }

  requestPasswordReset(email) {
    return this.request(ENDPOINTS.AUTH.PASSWORD_RESET_REQUEST, { method: "POST", body: JSON.stringify({ email }) });
  }

  confirmPasswordReset(payload) {
    return this.request(ENDPOINTS.AUTH.PASSWORD_RESET_CONFIRM, { method: "POST", body: JSON.stringify(payload) });
  }

  validateResetToken(token) {
    return this.request(ENDPOINTS.AUTH.PASSWORD_RESET_VALIDATE, { method: "POST", body: JSON.stringify({ token }) });
  }
}

/* ================================
   Roulettes API
================================ */
export class RoulettesAPI extends BaseAPI {
  constructor(token = null) { super(API_URL, token); }

  getRoulettes(params = {}) {
    const q = new URLSearchParams();
    if (params.status)    q.append("status", params.status);
    if (params.page)      q.append("page", params.page);
    if (params.page_size) q.append("page_size", params.page_size);
    const ep = `${ENDPOINTS.ROULETTES.LIST}${q.toString() ? `?${q}` : ""}`;
    return this.request(ep);
  }

  getRoulette(id) { return this.request(ENDPOINTS.ROULETTES.DETAIL(id)); }

  createRoulette(data) {
    const isMulti = hasFileDeep(data);
    const body    = isMulti ? buildFormData(data) : JSON.stringify(data);
    return this.request(ENDPOINTS.ROULETTES.CREATE, { method: "POST", body, isMultipart: isMulti });
  }

  updateRoulette(id, data) {
    const isMulti = hasFileDeep(data);
    const body    = isMulti ? buildFormData(data) : JSON.stringify(data);
    return this.request(ENDPOINTS.ROULETTES.UPDATE(id), { method: "PUT", body, isMultipart: isMulti });
  }

  patchRoulette(id, data) {
    const isMulti = hasFileDeep(data);
    const body    = isMulti ? buildFormData(data) : JSON.stringify(data);
    return this.request(ENDPOINTS.ROULETTES.UPDATE(id), { method: "PATCH", body, isMultipart: isMulti });
  }

  // Borrado normal o forzado (?force=1) según tu vista de backend
  deleteRoulette(id, { force = false } = {}) {
    const qs = force ? "?force=1" : "";
    return this.request(`${ENDPOINTS.ROULETTES.DELETE(id)}${qs}`, { method: "DELETE" });
  }

  executeRouletteDraw(rouletteId) {
    return this.request(ENDPOINTS.ROULETTES.DRAW_EXECUTE, {
      method: "POST",
      body: JSON.stringify({ roulette_id: rouletteId }),
    });
  }

  getRouletteStats(id) { return this.request(ENDPOINTS.ROULETTES.STATS(id)); }

  getDrawHistory(params = {}) {
    const q = new URLSearchParams();
    if (params.roulette_id) q.append("roulette_id", params.roulette_id);
    if (params.page)        q.append("page", params.page);
    if (params.page_size)   q.append("page_size", params.page_size);
    const ep = `${ENDPOINTS.ROULETTES.DRAW_HISTORY}${q.toString() ? `?${q}` : ""}`;
    return this.request(ep);
  }

  getRouletteSettings(id)                 { return this.request(ENDPOINTS.ROULETTES.SETTINGS.GET(id)); }
  updateRouletteSettings(id, settings)    { return this.request(ENDPOINTS.ROULETTES.SETTINGS.UPDATE(id), { method: "PUT",   body: JSON.stringify(settings) }); }
  patchRouletteSettings(id, settings)     { return this.request(ENDPOINTS.ROULETTES.SETTINGS.UPDATE(id), { method: "PATCH", body: JSON.stringify(settings) }); }

  listPrizes(rouletteId)                  { return this.request(ENDPOINTS.ROULETTES.PRIZES.LIST(rouletteId)); }
  getPrize(rouletteId, prizeId)           { return this.request(ENDPOINTS.ROULETTES.PRIZES.ITEM(rouletteId, prizeId)); }
  addPrize(rouletteId, prize)             {
    const isMulti = hasFileDeep(prize);
    const body    = isMulti ? buildFormData(prize) : JSON.stringify(prize);
    return this.request(ENDPOINTS.ROULETTES.PRIZES.ADD(rouletteId), { method: "POST", body, isMultipart: isMulti });
  }
  updatePrize(rouletteId, prizeId, data)  {
    const isMulti = hasFileDeep(data);
    const body    = isMulti ? buildFormData(data) : JSON.stringify(data);
    return this.request(ENDPOINTS.ROULETTES.PRIZES.UPDATE(rouletteId, prizeId), { method: "PUT", body, isMultipart: isMulti });
  }
  patchPrize(rouletteId, prizeId, data)   {
    const isMulti = hasFileDeep(data);
    const body    = isMulti ? buildFormData(data) : JSON.stringify(data);
    return this.request(ENDPOINTS.ROULETTES.PRIZES.UPDATE(rouletteId, prizeId), { method: "PATCH", body, isMultipart: isMulti });
  }
  deletePrize(rouletteId, prizeId)        { return this.request(ENDPOINTS.ROULETTES.PRIZES.DELETE(rouletteId, prizeId), { method: "DELETE" }); }
}

/* ================================
   Participants API
================================ */
export class ParticipantsAPI extends BaseAPI {
  constructor(token = null) { super(API_URL, token); }

  participate(rouletteId, receiptFile = null) {
    const fd = new FormData();
    fd.append("roulette_id", rouletteId);
    if (receiptFile) fd.append("receipt", receiptFile);
    return this.request(ENDPOINTS.PARTICIPANTS.PARTICIPATE, { method: "POST", body: fd, isMultipart: true });
  }

  getMyParticipations(params = {}) {
    const q = new URLSearchParams();
    if (params.page)      q.append("page", params.page);
    if (params.page_size) q.append("page_size", params.page_size);
    const ep = `${ENDPOINTS.PARTICIPANTS.MY_PARTICIPATIONS}${q.toString() ? `?${q}` : ""}`;
    return this.request(ep);
  }

  getRouletteParticipants(rouletteId, params = {}) {
    const q = new URLSearchParams();
    if (params.page)      q.append("page", params.page);
    if (params.page_size) q.append("page_size", params.page_size);
    const ep = `${ENDPOINTS.PARTICIPANTS.ROULETTE_PARTICIPANTS(rouletteId)}${q.toString() ? `?${q}` : ""}`;
    return this.request(ep);
  }

  checkParticipation(rouletteId) { return this.request(ENDPOINTS.PARTICIPANTS.CHECK_PARTICIPATION(rouletteId)); }
}

/* ================================
   Notifications API
================================ */
export class NotificationAPI extends BaseAPI {
  constructor(token = null) { super(API_URL, token); }

  async getUserNotifications(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') query.append(k, String(v)); });
    const endpoint = `${NOTIFICATION_ENDPOINTS.USER}${query.toString() ? `?${query}` : ''}`;
    return this.request(endpoint);
  }

  async getPublicNotifications(params = {}) {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') q.append(k, String(v)); });
    const ep = `${NOTIFICATION_ENDPOINTS.PUBLIC}${q.toString() ? `?${q}` : ''}`;
    return this.request(ep);
  }

  async getAdminNotifications(params = {}) {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') q.append(k, String(v)); });
    const ep = `${NOTIFICATION_ENDPOINTS.ADMIN}${q.toString() ? `?${q}` : ''}`;
    return this.request(ep);
  }

  async getRouletteNotifications(rouletteId, params = {}) {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') q.append(k, String(v)); });
    const ep = `${NOTIFICATION_ENDPOINTS.ROULETTE(rouletteId)}${q.toString() ? `?${q}` : ''}`;
    return this.request(ep);
  }

  // ---- Acciones
  markAsRead(notification_ids)  { return this.request(NOTIFICATION_ENDPOINTS.MARK_READ, { method: "POST", body: JSON.stringify({ notification_ids }) }); }
  markAllAsRead()               { return this.request(NOTIFICATION_ENDPOINTS.MARK_ALL_READ, { method: "POST" }); }
  deleteReadNotifications()     { return this.request(NOTIFICATION_ENDPOINTS.DELETE_READ, { method: "DELETE" }); }

  // ---- CRUD por notificación (necesario para el Centro Admin)
  deleteNotification(id)        { return this.request(NOTIFICATION_ENDPOINTS.DETAIL(id), { method: "DELETE" }); }
  patchNotification(id, data)   { return this.request(NOTIFICATION_ENDPOINTS.DETAIL(id), { method: "PATCH", body: JSON.stringify(data) }); }

  // ---- Utilidades varias
  getStats()                    { return this.request(NOTIFICATION_ENDPOINTS.STATS); }
  getDashboard()                { return this.request(NOTIFICATION_ENDPOINTS.DASHBOARD); }
  cleanup(days = 30)            { return this.request(`${NOTIFICATION_ENDPOINTS.CLEANUP}?days=${days}`, { method: "DELETE" }); }
  createNotification(data)      { return this.request(NOTIFICATION_ENDPOINTS.WEBHOOK, { method: "POST", body: JSON.stringify(data) }); }
  createWinnerAnnouncement(d)   { return this.request(NOTIFICATION_ENDPOINTS.WINNER_ANNOUNCEMENT, { method: "POST", body: JSON.stringify(d) }); }
  getAdminPreferences()         { return this.request(NOTIFICATION_ENDPOINTS.ADMIN_PREFERENCES); }
  updateAdminPreferences(data)  { return this.request(NOTIFICATION_ENDPOINTS.ADMIN_PREFERENCES, { method: "PATCH", body: JSON.stringify(data) }); }
  getTemplates()                { return this.request(NOTIFICATION_ENDPOINTS.TEMPLATES); }
  createTemplate(data)          { return this.request(NOTIFICATION_ENDPOINTS.TEMPLATES, { method: "POST", body: JSON.stringify(data) }); }
  getTemplate(id)               { return this.request(NOTIFICATION_ENDPOINTS.TEMPLATE_DETAIL(id)); }
  updateTemplate(id, data)      { return this.request(NOTIFICATION_ENDPOINTS.TEMPLATE_DETAIL(id), { method: "PATCH", body: JSON.stringify(data) }); }
  deleteTemplate(id)            { return this.request(NOTIFICATION_ENDPOINTS.TEMPLATE_DETAIL(id), { method: "DELETE" }); }

  getRealTimeMessages(params={}) {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') q.append(k, String(v)); });
    const ep = `${NOTIFICATION_ENDPOINTS.REALTIME}${q.toString() ? `?${q}` : ''}`;
    return this.request(ep);
  }

  async getUnreadNotifications(params = {}) {
    return this.getUserNotifications({ ...params, unread_only: true, include_stats: true });
  }

  async getUnreadCount() {
    try {
      const r = await this.getUserNotifications({ unread_only: true, page_size: 1, include_stats: true });
      return r?.stats?.unread_count || 0;
    } catch { return 0; }
  }

  markSingleAsRead(id) { return this.markAsRead([id]); }
  async getNotificationsByPriority(priority, params = {}) {
    return this.getUserNotifications({ ...params, priority });
  }
  async hasUrgentNotifications() {
    try {
      const r = await this.getUserNotifications({ priority: "urgent", unread_only: true, page_size: 1 });
      return (r?.count || 0) > 0;
    } catch { return false; }
  }
}

/* ================================
   Notification Manager (polling)
================================ */
export class NotificationManager {
  constructor(api = null) {
    this.api = api || new NotificationAPI();
    this.listeners = new Set();
    this.pollInterval = null;
    this.isPolling = false;
    this.lastCheck = null;
    this.cache = new Map();
  }
  addEventListener(cb) { this.listeners.add(cb); return () => this.listeners.delete(cb); }
  addListener(cb)      { return this.addEventListener(cb); }
  notifyListeners(event, data) { this.listeners.forEach((cb) => { try { cb(event, data); } catch (e) { console.error("Listener error:", e); } }); }
  async refresh({ silent = false } = {}) {
    try {
      const data = await this.api.getUserNotifications({ include_stats: true, unread_only: false, page_size: 20 });
      this.cache.set("last", data);
      if (!silent) this.notifyListeners("refresh", data);
      return data;
    } catch (e) {
      if (!silent) this.notifyListeners("error", e);
      throw e;
    }
  }
  startPolling(intervalMs = 30000) {
    if (this.isPolling) return;
    this.isPolling = true;
    this.pollInterval = setInterval(() => { this.refresh({ silent: true }).catch(() => {}); }, intervalMs);
  }
  stopPolling() {
    if (this.pollInterval) clearInterval(this.pollInterval);
    this.isPolling = false;
    this.pollInterval = null;
  }
}

/* ================================
   Utilidades MEJORADAS
================================ */
export const handleAPIError = (err, fallback = "Error de red") => {
  if (!err) return fallback;
  const msg = (typeof err === "string") ? err : err.message || fallback;
  return msg;
};

export const createPaginationParams = (page, page_size) => {
  const q = new URLSearchParams();
  if (page)      q.append("page", page);
  if (page_size) q.append("page_size", page_size);
  return q.toString() ? `?${q.toString()}` : "";
};

export const formatPaginatedResponse = (resp) => ({
  count: resp?.count ?? 0,
  next: resp?.next ?? null,
  previous: resp?.previous ?? null,
  results: resp?.results ?? [],
});

// Validadores corregidos y expandidos
export const validators = {
  required: (v) => v !== undefined && v !== null && String(v).trim() !== "",
  email: (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
  minLength: (min) => (v) => String(v || '').length >= min,
  maxLength: (max) => (v) => String(v || '').length <= max,
  isNumber: (v) => !isNaN(Number(v)) && isFinite(Number(v)),
  isPositive: (v) => Number(v) > 0,
  isInteger: (v) => Number.isInteger(Number(v)),
  
  // Validadores de archivos que necesitas
  fileExtension: (allowedExts = []) => (file) => {
    if (!file || !file.name) return false;
    if (!Array.isArray(allowedExts) || allowedExts.length === 0) return true;
    const ext = file.name.split('.').pop()?.toLowerCase();
    return allowedExts.map(e => e.toLowerCase().replace('.', '')).includes(ext);
  },
  
  maxFileSize: (maxSizeMB) => (file) => {
    if (!file || !file.size) return true;
    return file.size <= maxSizeMB * 1024 * 1024;
  },
  
  isImageFile: (file) => {
    if (!file || !file.type) return false;
    return file.type.startsWith('image/');
  },
  
  minFileSize: (minSizeMB) => (file) => {
    if (!file || !file.size) return false;
    return file.size >= minSizeMB * 1024 * 1024;
  }
};

// Formateadores corregidos y expandidos
export const formatters = {
  date: (iso, options = {}) => {
    if (!iso) return "";
    try {
      const date = new Date(iso);
      return date.toLocaleString('es-ES', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        ...options
      });
    } catch {
      return iso;
    }
  },
  
  // Formateador de tamaño de archivo que necesitas
  fileSize: (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  },
  
  currency: (amount, currency = 'USD') => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: currency
    }).format(amount);
  },
  
  percentage: (value, decimals = 1) => {
    return `${Number(value).toFixed(decimals)}%`;
  },
  
  number: (value, decimals = 0) => {
    return Number(value).toLocaleString('es-ES', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  }
};

export const websocketUtils = { WS_URL };
export const uploadWithProgress = null;
export const generateId = (p = "id") => `${p}_${Math.random().toString(36).slice(2, 9)}`;

// deepMerge corregido (arreglado el typo)
export const deepMerge = (target = {}, source = {}) => {
  const result = { ...target };
  for (const key in source) {
    if (source[key] && typeof source[key] === "object" && !Array.isArray(source[key])) {
      result[key] = deepMerge(result[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
};

export const deviceUtils = {
  isMobile:  () => /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
  isTablet:  () => /iPad|Android/i.test(navigator.userAgent) && window.innerWidth >= 768,
  isDesktop: () => !( /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ) && !( /iPad|Android/i.test(navigator.userAgent) && window.innerWidth >= 768 ),
  getScreenSize: () => {
    const w = window.innerWidth;
    if (w < 640) return "sm";
    if (w < 768) return "md";
    if (w < 1024) return "lg";
    return "xl";
  }
};

// Utilidades adicionales para archivos y formularios
export const fileUtils = {
  createPreviewUrl: (file) => {
    if (!file) return null;
    return URL.createObjectURL(file);
  },
  
  revokePreviewUrl: (url) => {
    if (url && url.startsWith('blob:')) {
      URL.revokeObjectURL(url);
    }
  },
  
  getFileExtension: (filename) => {
    if (!filename) return '';
    return filename.split('.').pop()?.toLowerCase() || '';
  },
  
  isValidImageType: (file) => {
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    return file && validTypes.includes(file.type);
  },
  
  compressImage: async (file, maxWidth = 800, quality = 0.8) => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        const ratio = Math.min(maxWidth / img.width, maxWidth / img.height);
        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;
        
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(resolve, file.type, quality);
      };
      
      img.src = URL.createObjectURL(file);
    });
  }
};

// Utilidades para formularios
export const formUtils = {
  serializeFormData: (formData) => {
    const obj = {};
    for (let [key, value] of formData.entries()) {
      if (obj[key]) {
        if (!Array.isArray(obj[key])) obj[key] = [obj[key]];
        obj[key].push(value);
      } else {
        obj[key] = value;
      }
    }
    return obj;
  },
  
  validateForm: (data, rules) => {
    const errors = {};
    
    Object.entries(rules).forEach(([field, fieldRules]) => {
      const value = data[field];
      const fieldErrors = [];
      
      fieldRules.forEach(rule => {
        if (typeof rule === 'function') {
          if (!rule(value)) {
            fieldErrors.push(`El campo ${field} no es válido`);
          }
        } else if (rule.validator && !rule.validator(value)) {
          fieldErrors.push(rule.message || `El campo ${field} no es válido`);
        }
      });
      
      if (fieldErrors.length > 0) {
        errors[field] = fieldErrors;
      }
    });
    
    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  },
  
  cleanFormData: (data) => {
    const cleaned = {};
    Object.entries(data).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        cleaned[key] = value;
      }
    });
    return cleaned;
  }
};

/* ================================
   Instancias listas
================================ */
export const authAPI             = new AuthAPI();
export const roulettesAPI        = new RoulettesAPI();
export const participantsAPI     = new ParticipantsAPI();
export const notificationAPI     = new NotificationAPI();
export const notificationManager = new NotificationManager(notificationAPI);

/* ================================
   Export agrupado (compat)
================================ */
const APIClient = {
  authAPI,
  roulettesAPI,
  participantsAPI,
  notificationAPI,

  setGlobalAuthToken,
  getGlobalAuthToken,
  clearAllTokens,
  isAuthenticated,

  NotificationManager,
  notificationManager,

  handleAPIError,
  createPaginationParams,
  formatPaginatedResponse,
  validators,
  formatters,
  websocketUtils,
  uploadWithProgress,
  generateId,
  deepMerge,
  deviceUtils,
  fileUtils,
  formUtils,

  ENDPOINTS,
  NOTIFICATION_ENDPOINTS,

  init: (config = {}) => {
    if (config.apiUrl) {
      authAPI.baseURL = config.apiUrl;
      roulettesAPI.baseURL = config.apiUrl;
      participantsAPI.baseURL = config.apiUrl;
      notificationAPI.baseURL = config.apiUrl;
    }
    if (config.token) setGlobalAuthToken(config.token);
    if (config.enableNotificationPolling !== false && isAuthenticated()) {
      notificationManager.startPolling(config.notificationPollInterval || 30000);
    }
    return { 
      success: true, 
      message: "API Client initialized successfully", 
      config: { 
        apiUrl: config.apiUrl || API_URL, 
        hasToken: !!readAnyToken() 
      } 
    };
  }
};

export default APIClient;