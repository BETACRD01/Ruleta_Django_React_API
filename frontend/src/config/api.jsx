/**
 * ============================================================================
 *                         CONFIGURACIÓN GLOBAL DE API
 * ============================================================================
 * Sistema centralizado de gestión de API, autenticación y datos.
 * Maneja: Auth, Ruletas, Participantes, Notificaciones
 */

export const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8000/api";
export const WS_URL = process.env.REACT_APP_WS_URL || "ws://localhost:8000/ws";

// ============================================================================
//                         ALMACENAMIENTO COMPATIBLE
// ============================================================================
/**
 * Sistema dual: localStorage (navegador) + InMemoryStorage (Claude artifacts)
 * Permite que la API funcione en ambos entornos
 */

class InMemoryStorage {
  constructor() {
    this.storage = new Map();
  }

  getItem(key) {
    return this.storage.get(key) || null;
  }

  setItem(key, value) {
    this.storage.set(key, value);
  }

  removeItem(key) {
    this.storage.delete(key);
  }

  clear() {
    this.storage.clear();
  }
}

/**
 * Detecta si localStorage está disponible
 * @returns {boolean} true si localStorage funciona, false si no
 */
const isLocalStorageAvailable = () => {
  try {
    const test = '__storage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
};

// Usar localStorage si está disponible, sino memoria
const storage = isLocalStorageAvailable() ? localStorage : new InMemoryStorage();

console.log(
  '📦 Sistema de almacenamiento:',
  isLocalStorageAvailable() ? 'localStorage ✅' : 'InMemoryStorage (modo Claude) ⚙️'
);

// ============================================================================
//                         GESTIÓN DE TOKENS
// ============================================================================
/**
 * Claves heredadas de tokens para compatibilidad
 */
const LEGACY_KEYS = ["token", "auth_token", "authToken"];

/**
 * Lee el primer token disponible de las claves heredadas
 * @returns {string|null} Token encontrado o null
 */
const readAnyToken = () => {
  for (const key of LEGACY_KEYS) {
    const value = storage.getItem(key);
    if (value) return value;
  }
  return null;
};

/**
 * Escribe el token en TODAS las claves heredadas
 * @param {string|null} token - Token a guardar o null para limpiar
 */
const writeAllTokens = (token) => {
  for (const key of LEGACY_KEYS) {
    if (token) {
      storage.setItem(key, token);
    } else {
      storage.removeItem(key);
    }
  }
};

/**
 * Expone API publica para token
 */
export const setGlobalAuthToken = (token) => writeAllTokens(token);
export const getGlobalAuthToken = () => readAnyToken();
export const clearAllTokens = () => writeAllTokens(null);
export const isAuthenticated = () => Boolean(readAnyToken());

// ============================================================================
//                         DEFINICIÓN DE ENDPOINTS
// ============================================================================
/**
 * Mapeo centralizado de todos los endpoints de la API
 * Facilita cambios globales y evita strings duplicados
 */
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
    PASSWORD_RESET_VALIDATE: "/auth/validate-reset-token/",
    CHANGE_PASSWORD: "/auth/change-password/",
    GOOGLE_LOGIN: "/auth/google/",
  },

  ROULETTES: {
    LIST: "/roulettes/",
    CREATE: "/roulettes/create/",
    DETAIL: (id) => `/roulettes/${id}/`,
    UPDATE: (id) => `/roulettes/${id}/update/`,
    DELETE: (id) => `/roulettes/${id}/delete/`,
    STATS: (id) => `/roulettes/${id}/stats/`,
    DRAW_EXECUTE: "/roulettes/draw/execute/",
    DRAW_HISTORY: "/roulettes/draw/history/",
    SETTINGS: {
      GET: (id) => `/roulettes/${id}/settings/`,
      UPDATE: (id) => `/roulettes/${id}/settings/`,
    },
    PRIZES: {
      LIST: (rid) => `/roulettes/${rid}/prizes/`,
      ADD: (rid) => `/roulettes/${rid}/prizes/`,
      ITEM: (rid, pid) => `/roulettes/${rid}/prizes/${pid}/`,
      UPDATE: (rid, pid) => `/roulettes/${rid}/prizes/${pid}/update/`,
      DELETE: (rid, pid) => `/roulettes/${rid}/prizes/${pid}/delete/`,
    },
  },

  PARTICIPANTS: {
    PARTICIPATE: "/participants/participations/participate/",
    MY_PARTICIPATIONS: "/participants/participations/my-participations/",
    ROULETTE_PARTICIPANTS: (id) => `/participants/participations/roulette/${id}/`,
    CHECK_PARTICIPATION: (id) => `/participants/participations/check-participation/${id}/`,
    PARTICIPATION_DETAIL: (pid) => `/participants/participations/${pid}/`,
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

// ============================================================================
//                         UTILIDADES FORMDATA
// ============================================================================
/**
 * Detecta si un valor es tipo File/Blob/FileList
 * @param {*} value - Valor a verificar
 * @returns {boolean} true si es archivo
 */
const isFileLike = (value) => {
  return (
    (typeof File !== "undefined" && value instanceof File) ||
    (typeof Blob !== "undefined" && value instanceof Blob) ||
    (typeof FileList !== "undefined" && value instanceof FileList)
  );
};

/**
 * Busca recursivamente si hay archivos en un objeto
 * @param {*} value - Valor a verificar profundamente
 * @returns {boolean} true si encuentra archivos
 */
const hasFileDeep = (value) => {
  if (!value) return false;
  if (isFileLike(value)) return true;
  if (Array.isArray(value)) return value.some(hasFileDeep);
  if (typeof value === "object") return Object.values(value).some(hasFileDeep);
  return false;
};

/**
 * ✅ OPTIMIZADO: Agrega valor a FormData con manejo especial para settings
 * @param {FormData} formData - FormData a llenar
 * @param {string} key - Clave del parámetro
 * @param {*} value - Valor a agregar
 */
const appendFormData = (formData, key, value) => {
  if (value === undefined || value === null) return;

  // ✅ CASO ESPECIAL: "settings" se envía como JSON string
  if (key === 'settings' && typeof value === 'object' && !isFileLike(value) && !Array.isArray(value)) {
    formData.append(key, JSON.stringify(value));
    return;
  }

  // Manejar archivos
  if (isFileLike(value)) {
    if (typeof FileList !== "undefined" && value instanceof FileList) {
      Array.from(value).forEach((file, index) => {
        formData.append(`${key}[${index}]`, file);
      });
    } else {
      formData.append(key, value);
    }
    return;
  }

  // Manejar arrays
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      appendFormData(formData, `${key}[${index}]`, item);
    });
    return;
  }

  // Manejar objetos (recursivo)
  if (typeof value === "object") {
    Object.entries(value).forEach(([nestedKey, nestedValue]) => {
      appendFormData(formData, `${key}[${nestedKey}]`, nestedValue);
    });
    return;
  }

  // Escalares (string, number, boolean)
  formData.append(key, String(value));
};

/**
 * Construye FormData a partir de un objeto
 * @param {object} data - Datos a convertir
 * @returns {FormData} FormData listo para enviar
 */
const buildFormData = (data = {}) => {
  const formData = new FormData();
  Object.entries(data).forEach(([key, value]) => {
    appendFormData(formData, key, value);
  });
  return formData;
};

// ============================================================================
//                         UTILIDADES COMUNES
// ============================================================================
/**
 * Construye query string desde objeto de parámetros
 * @param {object} params - Parámetros a convertir
 * @returns {string} Query string (ej: "?page=1&limit=10")
 */
const toQuery = (params = {}) => {
  const queryParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      queryParams.append(key, String(value));
    }
  });
  const queryString = queryParams.toString();
  return queryString ? `?${queryString}` : "";
};

/**
 * Intenta parsear JSON de una respuesta
 * @param {Response} response - Response de fetch
 * @returns {Promise<object|null>} JSON parseado o null
 */
const jsonOrNull = async (response) => {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return null;
  }
  try {
    return await response.json();
  } catch {
    return null;
  }
};

/**
 * Convierte objeto a JSON string de forma segura
 * @param {*} value - Valor a serializar
 * @returns {string|null} JSON string o null si falla
 */
const safeStringify = (value) => {
  if (value == null) return null;
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
};

/**
 * Resuelve URLs de media (imágenes, archivos) a absolutas
 * @param {string} maybeUrl - URL relativa o absoluta
 * @returns {string|null} URL absoluta resolvida
 */
export const resolveMediaUrl = (maybeUrl) => {
  if (!maybeUrl) return null;
  try {
    // Si ya es URL absoluta, devolverla directamente
    return new URL(maybeUrl).href;
  } catch {
    // Construir URL absoluta
    const baseUrl = String(API_URL || "").replace(/\/api\/?$/i, "");
    const path = String(maybeUrl).startsWith("/") ? maybeUrl : `/${maybeUrl}`;
    return `${baseUrl}${path}`;
  }
};

// ============================================================================
//                         NORMALIZADORES DE DATOS
// ============================================================================
/**
 * Obtiene estado de una participación
 * @param {object} participation - Objeto de participación
 * @returns {string} Estado: "won", "active", "completed"
 */
const getParticipationState = (participation) => {
  if (participation?.participation_state) return participation.participation_state;
  if (participation?.is_winner) return "won";

  const roulette = participation?.roulette || {};
  if (
    roulette.status === "cancelled" ||
    roulette.status === "completed" ||
    roulette.is_drawn ||
    roulette.drawn_at
  ) {
    return "completed";
  }

  if (roulette.status === "active" || roulette.status === "scheduled") {
    return "active";
  }

  return "completed";
};

/**
 * ✅ OPTIMIZADO: Normaliza una participación para consistencia en frontend
 * Busca imágenes en múltiples rutas posibles
 * @param {object} participation - Participación a normalizar
 * @returns {object} Participación normalizada
 */
const normalizeParticipation = (participation = {}) => {
  const roulette = participation.roulette || {};
  const isWinner = Boolean(participation.is_winner);

  // Buscar imagen de ruleta en múltiples rutas
  const rouletteImageUrl =
    participation.roulette_image_url ||
    roulette?.cover_image?.url ||
    roulette?.cover_image ||
    roulette?.image ||
    roulette?.banner ||
    roulette?.thumbnail ||
    null;

  // Buscar imagen de premio (solo para ganadores)
  const prizeImageUrl = isWinner
    ? (participation.prize_image_url ||
        participation?.won_prize?.image ||
        participation?.wonPrize?.image ||
        participation?.prize?.image_url ||
        participation?.prize?.image ||
        participation?.prizeImage ||
        participation?.prize_image ||
        null)
    : null;

  return {
    ...participation,
    // Campos aplanados útiles
    roulette_name: participation.roulette_name || roulette?.name || null,
    roulette_status: participation.roulette_status || roulette?.status || null,
    roulette_is_drawn: participation.roulette_is_drawn ?? roulette?.is_drawn ?? null,
    roulette_drawn_at: participation.roulette_drawn_at || roulette?.drawn_at || null,
    scheduled_date: participation.scheduled_date || roulette?.scheduled_date || null,
    // Estado calculado
    participation_state: getParticipationState(participation),
    // URLs normalizadas
    roulette_image_url: resolveMediaUrl(rouletteImageUrl),
    prize_image_url: resolveMediaUrl(prizeImageUrl),
  };
};

// ============================================================================
//                         CLASE BASE: BaseAPI
// ============================================================================
/**
 * Clase base con lógica común de requests HTTP, autenticación y manejo de errores
 */
class BaseAPI {
  /**
   * @param {string} baseURL - URL base de la API
   * @param {string|null} authToken - Token de autenticación inicial
   */
  constructor(baseURL = API_URL, authToken = null) {
    this.baseURL = baseURL;
    this.authToken = authToken || readAnyToken();

    // Sincronizar token al crear instancia
    if (this.authToken) {
      writeAllTokens(this.authToken);
    }
  }

  /**
   * Actualiza el token de autenticación
   * @param {string|null} token - Nuevo token o null
   */
  setAuthToken(token) {
    this.authToken = token || null;
    writeAllTokens(token || null);
  }

  /**
   * Construye headers HTTP con autenticación
   * @param {boolean} isMultipart - Si es request multipart (FormData)
   * @returns {object} Headers listos para usar
   */
  getHeaders(isMultipart = false) {
    const token = this.authToken || readAnyToken();
    const headers = { Accept: "application/json" };

    if (token) {
      headers.Authorization = `Token ${token}`;
    }

    if (!isMultipart) {
      headers["Content-Type"] = "application/json";
    }

    return headers;
  }

  /**
   * Realiza un request HTTP completo con manejo de errores
   * @param {string} endpoint - Endpoint relativo (ej: "/roulettes/")
   * @param {object} options - Opciones del request
   * @returns {Promise<object>} Respuesta JSON parseada
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const isMultipart = Boolean(options.isMultipart);
    const headers = this.getHeaders(isMultipart);

    let body = options.body;
    if (!isMultipart && body && typeof body !== "string") {
      body = safeStringify(body);
    }

    const requestOptions = {
      method: options.method || "GET",
      headers,
      body,
      signal: options.signal,
    };

    try {
      const response = await fetch(url, requestOptions);

      // Manejo de errores HTTP
      if (!response.ok) {
        const data = await jsonOrNull(response);

        // Extraer mensaje de error del backend
        const backendMessage =
          data?.message ||
          (Array.isArray(data?.non_field_errors) && data.non_field_errors.join(", ")) ||
          (typeof data?.detail === "string" && data.detail) ||
          (data?.errors && JSON.stringify(data.errors)) ||
          (data && typeof data === "object" ? JSON.stringify(data) : null) ||
          null;

        // Manejar códigos de error específicos
        if (response.status === 401) {
          this.setAuthToken(null);
          throw new Error(
            backendMessage || "Sesión expirada. Inicia sesión de nuevo."
          );
        }

        if (response.status === 403) {
          throw new Error(
            backendMessage || "No tienes permisos para realizar esta acción."
          );
        }

        if (response.status === 404) {
          throw new Error(backendMessage || "Recurso no encontrado.");
        }

        throw new Error(backendMessage || `HTTP ${response.status}: ${response.statusText}`);
      }

      // Status 204 = sin contenido
      if (response.status === 204) return null;

      // Parsear JSON
      const parsed = await jsonOrNull(response);
      return parsed ?? null;
    } catch (error) {
      console.error(`❌ API Error [${endpoint}]`, error);
      throw error;
    }
  }
}

// ============================================================================
//                         AUTH API
// ============================================================================
/**
 * Gestiona autenticación, login, registro, perfil
 */
export class AuthAPI extends BaseAPI {
  constructor() {
    super(API_URL);
  }

  async login(credentials) {
    const result = await this.request(ENDPOINTS.AUTH.LOGIN, {
      method: "POST",
      body: credentials,
    });
    if (result?.success && result?.token) {
      this.setAuthToken(result.token);
      writeAllTokens(result.token);
    }
    return result;
  }

  async register(data) {
    const result = await this.request(ENDPOINTS.AUTH.REGISTER, {
      method: "POST",
      body: data,
    });
    if (result?.success && result?.token) {
      this.setAuthToken(result.token);
      writeAllTokens(result.token);
    }
    return result;
  }

  async logout() {
    try {
      await this.request(ENDPOINTS.AUTH.LOGOUT, { method: "POST" });
    } finally {
      this.setAuthToken(null);
      writeAllTokens(null);
    }
  }

  async checkEmailExists(email) {
    return this.request("/auth/check-email/", {
      method: "POST",
      body: { email: email.trim().toLowerCase() },
    });
  }

  async googleLogin(accessToken) {
    const result = await this.request(ENDPOINTS.AUTH.GOOGLE_LOGIN, {
      method: "POST",
      body: { access_token: accessToken },
    });

    if (result?.key || result?.token) {
      const token = result.key || result.token;
      this.setAuthToken(token);
      writeAllTokens(token);
    }

    return result;
  }

  getUserInfo() {
    return this.request(ENDPOINTS.AUTH.USER_INFO);
  }

  getProfileDetail() {
    return this.request(ENDPOINTS.AUTH.PROFILE_DETAIL);
  }

  updateProfile(profile) {
    const isMultipart = hasFileDeep(profile);
    const body = isMultipart ? buildFormData(profile) : profile;
    return this.request(ENDPOINTS.AUTH.PROFILE, {
      method: "PATCH",
      body,
      isMultipart,
    });
  }

  changePassword(payload) {
    return this.request(ENDPOINTS.AUTH.CHANGE_PASSWORD, {
      method: "POST",
      body: payload,
    });
  }

  requestPasswordReset(email) {
    return this.request(ENDPOINTS.AUTH.PASSWORD_RESET_REQUEST, {
      method: "POST",
      body: { email },
    });
  }

  confirmPasswordReset(payload) {
    return this.request(ENDPOINTS.AUTH.PASSWORD_RESET_CONFIRM, {
      method: "POST",
      body: payload,
    });
  }

  validateResetToken(token) {
    return this.request(ENDPOINTS.AUTH.PASSWORD_RESET_VALIDATE, {
      method: "POST",
      body: { token },
    });
  }
}

// ============================================================================
//                         ROULETTES API
// ============================================================================
/**
 * ✅ OPTIMIZADO: Gestiona ruletas, premios, sorteos
 */
export class RoulettesAPI extends BaseAPI {
  constructor(token = null) {
    super(API_URL, token);
  }

  getRoulettes(params = {}) {
    const endpoint = `${ENDPOINTS.ROULETTES.LIST}${toQuery(params)}`;
    return this.request(endpoint);
  }

  getRoulette(id) {
    return this.request(ENDPOINTS.ROULETTES.DETAIL(id));
  }

  /**
   * ✅ Crea ruleta con FormData (maneja archivos + settings como JSON)
   */
  createRoulette(data) {
    const isMultipart = hasFileDeep(data);
    const body = isMultipart ? buildFormData(data) : data;
    return this.request(ENDPOINTS.ROULETTES.CREATE, {
      method: "POST",
      body,
      isMultipart,
    });
  }

  /**
   * ✅ Actualiza ruleta con FormData (maneja archivos + settings como JSON)
   */
  updateRoulette(id, data) {
    const isMultipart = hasFileDeep(data);
    const body = isMultipart ? buildFormData(data) : data;
    return this.request(ENDPOINTS.ROULETTES.UPDATE(id), {
      method: "PUT",
      body,
      isMultipart,
    });
  }

  patchRoulette(id, data) {
    const isMultipart = hasFileDeep(data);
    const body = isMultipart ? buildFormData(data) : data;
    return this.request(ENDPOINTS.ROULETTES.UPDATE(id), {
      method: "PATCH",
      body,
      isMultipart,
    });
  }

  deleteRoulette(id, { force = false } = {}) {
    const queryString = force ? "?force=1" : "";
    return this.request(`${ENDPOINTS.ROULETTES.DELETE(id)}${queryString}`, {
      method: "DELETE",
    });
  }

  executeRouletteDraw(rouletteId) {
    return this.request(ENDPOINTS.ROULETTES.DRAW_EXECUTE, {
      method: "POST",
      body: { roulette_id: rouletteId },
    });
  }

  getRouletteStats(id) {
    return this.request(ENDPOINTS.ROULETTES.STATS(id));
  }

  getDrawHistory(params = {}) {
    const endpoint = `${ENDPOINTS.ROULETTES.DRAW_HISTORY}${toQuery(params)}`;
    return this.request(endpoint);
  }

  // Settings
  getRouletteSettings(id) {
    return this.request(ENDPOINTS.ROULETTES.SETTINGS.GET(id));
  }

  updateRouletteSettings(id, settings) {
    return this.request(ENDPOINTS.ROULETTES.SETTINGS.UPDATE(id), {
      method: "PUT",
      body: settings,
    });
  }

  patchRouletteSettings(id, settings) {
    return this.request(ENDPOINTS.ROULETTES.SETTINGS.UPDATE(id), {
      method: "PATCH",
      body: settings,
    });
  }

  // Premios
  listPrizes(rouletteId) {
    return this.request(ENDPOINTS.ROULETTES.PRIZES.LIST(rouletteId));
  }

  getPrize(rouletteId, prizeId) {
    return this.request(ENDPOINTS.ROULETTES.PRIZES.ITEM(rouletteId, prizeId));
  }

  addPrize(rouletteId, prize) {
    const isMultipart = hasFileDeep(prize);
    const body = isMultipart ? buildFormData(prize) : prize;
    return this.request(ENDPOINTS.ROULETTES.PRIZES.ADD(rouletteId), {
      method: "POST",
      body,
      isMultipart,
    });
  }

  updatePrize(rouletteId, prizeId, data) {
    const isMultipart = hasFileDeep(data);
    const body = isMultipart ? buildFormData(data) : data;
    return this.request(ENDPOINTS.ROULETTES.PRIZES.UPDATE(rouletteId, prizeId), {
      method: "PUT",
      body,
      isMultipart,
    });
  }

  patchPrize(rouletteId, prizeId, data) {
    const isMultipart = hasFileDeep(data);
    const body = isMultipart ? buildFormData(data) : data;
    return this.request(ENDPOINTS.ROULETTES.PRIZES.UPDATE(rouletteId, prizeId), {
      method: "PATCH",
      body,
      isMultipart,
    });
  }

  deletePrize(rouletteId, prizeId) {
    return this.request(ENDPOINTS.ROULETTES.PRIZES.DELETE(rouletteId, prizeId), {
      method: "DELETE",
    });
  }
}

// ============================================================================
//                         PARTICIPANTS API
// ============================================================================
/**
 * Gestiona participaciones en ruletas
 */
export class ParticipantsAPI extends BaseAPI {
  constructor(token = null) {
    super(API_URL, token);
  }

  /**
   * Registra participación en una ruleta (con comprobante opcional)
   * @param {number} rouletteId - ID de la ruleta
   * @param {File|null} receiptFile - Archivo de comprobante
   */
  participate(rouletteId, receiptFile = null) {
    const formData = new FormData();
    formData.append("roulette_id", rouletteId);
    if (receiptFile) {
      formData.append("receipt", receiptFile);
    }
    return this.request(ENDPOINTS.PARTICIPANTS.PARTICIPATE, {
      method: "POST",
      body: formData,
      isMultipart: true,
    });
  }

  /**
   * ✅ OPTIMIZADO: Obtiene participaciones del usuario normalizadas
   */
  async getMyParticipations(params = {}) {
    const endpoint = `${ENDPOINTS.PARTICIPANTS.MY_PARTICIPATIONS}${toQuery(params)}`;
    const raw = await this.request(endpoint);

    // Extraer lista de participaciones
    const list = Array.isArray(raw?.results) ? raw.results : Array.isArray(raw) ? raw : [];

    // Normalizar cada participación
    const normalized = list.map(normalizeParticipation);

    // Devolver en formato compatible
    if (Array.isArray(raw?.results)) {
      return { ...raw, results: normalized };
    }
    return normalized;
  }

  getRouletteParticipants(rouletteId, params = {}) {
    const endpoint = `${ENDPOINTS.PARTICIPANTS.ROULETTE_PARTICIPANTS(rouletteId)}${toQuery(
      params
    )}`;
    return this.request(endpoint);
  }

  checkParticipation(rouletteId) {
    return this.request(ENDPOINTS.PARTICIPANTS.CHECK_PARTICIPATION(rouletteId));
  }

  getParticipant(participationId) {
    return this.request(ENDPOINTS.PARTICIPANTS.PARTICIPATION_DETAIL(participationId));
  }

  patchParticipant(participationId, data) {
    return this.request(ENDPOINTS.PARTICIPANTS.PARTICIPATION_DETAIL(participationId), {
      method: "PATCH",
      body: data,
    });
  }

  async getWinnerContact(_rouletteId, participantId) {
    const detail = await this.getParticipant(participantId);
    return {
      email: detail?.email ?? detail?.contact_email ?? "",
      phone: detail?.phone ?? detail?.contact_phone ?? "",
    };
  }

  updateWinnerContact(_rouletteId, participantId, { email, phone }) {
    return this.patchParticipant(participantId, { email, phone });
  }
}

// ============================================================================
//                         NOTIFICATIONS API
// ============================================================================
/**
 * Gestiona notificaciones del sistema
 */
export class NotificationAPI extends BaseAPI {
  constructor(token = null) {
    super(API_URL, token);
  }

  async getUserNotifications(params = {}) {
    const endpoint = `${NOTIFICATION_ENDPOINTS.USER}${toQuery(params)}`;
    return this.request(endpoint);
  }

  async getPublicNotifications(params = {}) {
    const endpoint = `${NOTIFICATION_ENDPOINTS.PUBLIC}${toQuery(params)}`;
    return this.request(endpoint);
  }

  async getAdminNotifications(params = {}) {
    const endpoint = `${NOTIFICATION_ENDPOINTS.ADMIN}${toQuery(params)}`;
    return this.request(endpoint);
  }

  async getRouletteNotifications(rouletteId, params = {}) {
    const endpoint = `${NOTIFICATION_ENDPOINTS.ROULETTE(rouletteId)}${toQuery(params)}`;
    return this.request(endpoint);
  }

  markAsRead(notificationIds) {
    return this.request(NOTIFICATION_ENDPOINTS.MARK_READ, {
      method: "POST",
      body: { notification_ids: notificationIds },
    });
  }

  markAllAsRead() {
    return this.request(NOTIFICATION_ENDPOINTS.MARK_ALL_READ, { method: "POST" });
  }

  deleteReadNotifications() {
    return this.request(NOTIFICATION_ENDPOINTS.DELETE_READ, { method: "DELETE" });
  }

  deleteNotification(id) {
    return this.request(NOTIFICATION_ENDPOINTS.DETAIL(id), { method: "DELETE" });
  }

  patchNotification(id, data) {
    return this.request(NOTIFICATION_ENDPOINTS.DETAIL(id), {
      method: "PATCH",
      body: data,
    });
  }

  getStats() {
    return this.request(NOTIFICATION_ENDPOINTS.STATS);
  }

  getDashboard() {
    return this.request(NOTIFICATION_ENDPOINTS.DASHBOARD);
  }

  cleanup(days = 30) {
    return this.request(`${NOTIFICATION_ENDPOINTS.CLEANUP}?days=${days}`, {
      method: "DELETE",
    });
  }

  createNotification(data) {
    return this.request(NOTIFICATION_ENDPOINTS.WEBHOOK, {
      method: "POST",
      body: data,
    });
  }

  createWinnerAnnouncement(data) {
    return this.request(NOTIFICATION_ENDPOINTS.WINNER_ANNOUNCEMENT, {
      method: "POST",
      body: data,
    });
  }

  getAdminPreferences() {
    return this.request(NOTIFICATION_ENDPOINTS.ADMIN_PREFERENCES);
  }

  updateAdminPreferences(data) {
    return this.request(NOTIFICATION_ENDPOINTS.ADMIN_PREFERENCES, {
      method: "PATCH",
      body: data,
    });
  }

  getTemplates() {
    return this.request(NOTIFICATION_ENDPOINTS.TEMPLATES);
  }

  createTemplate(data) {
    return this.request(NOTIFICATION_ENDPOINTS.TEMPLATES, {
      method: "POST",
      body: data,
    });
  }

  getTemplate(id) {
    return this.request(NOTIFICATION_ENDPOINTS.TEMPLATE_DETAIL(id));
  }

  updateTemplate(id, data) {
    return this.request(NOTIFICATION_ENDPOINTS.TEMPLATE_DETAIL(id), {
      method: "PATCH",
      body: data,
    });
  }

  deleteTemplate(id) {
    return this.request(NOTIFICATION_ENDPOINTS.TEMPLATE_DETAIL(id), {
      method: "DELETE",
    });
  }

  getRealTimeMessages(params = {}) {
    const endpoint = `${NOTIFICATION_ENDPOINTS.REALTIME}${toQuery(params)}`;
    return this.request(endpoint);
  }

  async updateEmailStatus(notificationId, statusData) {
    return this.request(`/notifications/${notificationId}/email-status/`, {
      method: "POST",
      body: statusData,
    });
  }

  async getUnreadNotifications(params = {}) {
    return this.getUserNotifications({ ...params, unread_only: true, include_stats: true });
  }

  async getUnreadCount() {
    try {
      const result = await this.getUserNotifications({
        unread_only: true,
        page_size: 1,
        include_stats: true,
      });
      return result?.stats?.unread_count || 0;
    } catch {
      return 0;
    }
  }

  markSingleAsRead(id) {
    return this.markAsRead([id]);
  }

  async getNotificationsByPriority(priority, params = {}) {
    return this.getUserNotifications({ ...params, priority });
  }

  async hasUrgentNotifications() {
    try {
      const result = await this.getUserNotifications({
        priority: "urgent",
        unread_only: true,
        page_size: 1,
      });
      return (result?.count || 0) > 0;
    } catch {
      return false;
    }
  }
}

// ============================================================================
//                         NOTIFICATION MANAGER
// ============================================================================
/**
 * Gestor de notificaciones con polling automático
 */
export class NotificationManager {
  constructor(api = null) {
    this.api = api || new NotificationAPI();
    this.listeners = new Set();
    this.pollInterval = null;
    this.isPolling = false;
    this.lastCheck = null;
    this.cache = new Map();
  }

  addEventListener(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  addListener(callback) {
    return this.addEventListener(callback);
  }

  notifyListeners(event, data) {
    this.listeners.forEach((callback) => {
      try {
        callback(event, data);
      } catch (error) {
        console.error("❌ Listener error:", error);
      }
    });
  }

  async refresh({ silent = false } = {}) {
    try {
      const data = await this.api.getUserNotifications({
        include_stats: true,
        unread_only: false,
        page_size: 20,
      });
      this.cache.set("last", data);
      if (!silent) this.notifyListeners("refresh", data);
      return data;
    } catch (error) {
      if (!silent) this.notifyListeners("error", error);
      throw error;
    }
  }

  startPolling(intervalMs = 30000) {
    if (this.isPolling) return;
    this.isPolling = true;
    this.pollInterval = setInterval(() => {
      this.refresh({ silent: true }).catch(() => {});
    }, intervalMs);
  }

  stopPolling() {
    if (this.pollInterval) clearInterval(this.pollInterval);
    this.isPolling = false;
    this.pollInterval = null;
  }
}

// ============================================================================
//                         UTILIDADES EXPORTADAS
// ============================================================================
/**
 * Maneja errores de API de forma uniforme
 * @param {Error|string} error - Error a procesar
 * @param {string} fallback - Mensaje por defecto
 * @returns {string} Mensaje de error formateado
 */
export const handleAPIError = (error, fallback = "Error de red") => {
  if (!error) return fallback;
  const message = typeof error === "string" ? error : error.message || fallback;
  return message;
};

/**
 * Crea parámetros de paginación
 * @param {number} page - Número de página
 * @param {number} pageSize - Elementos por página
 * @returns {string} Query string
 */
export const createPaginationParams = (page, pageSize) => toQuery({ page, page_size: pageSize });

/**
 * Formatea respuesta paginada
 * @param {object} response - Response de API
 * @returns {object} Objeto formateado
 */
export const formatPaginatedResponse = (response) => ({
  count: response?.count ?? 0,
  next: response?.next ?? null,
  previous: response?.previous ?? null,
  results: response?.results ?? [],
});

/**
 * Validadores reutilizables
 */
export const validators = {
  required: (value) =>
    value !== undefined && value !== null && String(value).trim() !== "",

  email: (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),

  minLength: (min) => (value) => String(value || "").length >= min,

  maxLength: (max) => (value) => String(value || "").length <= max,

  isNumber: (value) => !isNaN(Number(value)) && isFinite(Number(value)),

  isPositive: (value) => Number(value) > 0,

  isInteger: (value) => Number.isInteger(Number(value)),

  fileExtension: (allowedExtensions = []) => (file) => {
    if (!file || !file.name) return false;
    if (!Array.isArray(allowedExtensions) || allowedExtensions.length === 0) return true;
    const extension = file.name.split(".").pop()?.toLowerCase();
    return allowedExtensions
      .map((ext) => ext.toLowerCase().replace(".", ""))
      .includes(extension);
  },

  maxFileSize: (maxSizeMB) => (file) => {
    if (!file || !file.size) return true;
    return file.size <= maxSizeMB * 1024 * 1024;
  },

  isImageFile: (file) => {
    if (!file || !file.type) return false;
    return file.type.startsWith("image/");
  },

  minFileSize: (minSizeMB) => (file) => {
    if (!file || !file.size) return false;
    return file.size >= minSizeMB * 1024 * 1024;
  },
};

/**
 * Formateadores para presentación de datos
 */
export const formatters = {
  date: (isoString, options = {}) => {
    if (!isoString) return "";
    try {
      const date = new Date(isoString);
      return date.toLocaleString("es-ES", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        ...options,
      });
    } catch {
      return isoString;
    }
  },

  fileSize: (bytes) => {
    if (!bytes || bytes === 0) return "0 B";
    const kilo = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const exponent = Math.floor(Math.log(bytes) / Math.log(kilo));
    return parseFloat((bytes / Math.pow(kilo, exponent)).toFixed(2)) + " " + sizes[exponent];
  },

  currency: (amount, currency = "USD") =>
    new Intl.NumberFormat("es-ES", { style: "currency", currency }).format(amount),

  percentage: (value, decimals = 1) => `${Number(value).toFixed(decimals)}%`,

  number: (value, decimals = 0) =>
    Number(value).toLocaleString("es-ES", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }),
};

/**
 * Utilidades de dispositivo
 */
export const deviceUtils = {
  isMobile: () =>
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),

  isTablet: () =>
    /iPad|Android/i.test(navigator.userAgent) && window.innerWidth >= 768,

  isDesktop: () =>
    !/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    ) && !/iPad|Android/i.test(navigator.userAgent) && window.innerWidth >= 768,

  getScreenSize: () => {
    const width = window.innerWidth;
    if (width < 640) return "sm";
    if (width < 768) return "md";
    if (width < 1024) return "lg";
    return "xl";
  },
};

/**
 * Utilidades de archivos
 */
export const fileUtils = {
  createPreviewUrl: (file) => (file ? URL.createObjectURL(file) : null),

  revokePreviewUrl: (url) => {
    if (url && url.startsWith("blob:")) URL.revokeObjectURL(url);
  },

  getFileExtension: (filename) =>
    filename ? (filename.split(".").pop()?.toLowerCase() || "") : "",

  isValidImageType: (file) => {
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
    return file && validTypes.includes(file.type);
  },

  async compressImage(file, maxWidth = 800, quality = 0.8) {
    return new Promise((resolve) => {
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      const image = new Image();

      image.onload = () => {
        const ratio = Math.min(maxWidth / image.width, maxWidth / image.height);
        canvas.width = image.width * ratio;
        canvas.height = image.height * ratio;
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(resolve, file.type, quality);
      };

      image.src = URL.createObjectURL(file);
    });
  },
};

/**
 * Utilidades de formularios
 */
export const formUtils = {
  serializeFormData: (formData) => {
    const object = {};
    for (let [key, value] of formData.entries()) {
      if (object[key]) {
        if (!Array.isArray(object[key])) object[key] = [object[key]];
        object[key].push(value);
      } else {
        object[key] = value;
      }
    }
    return object;
  },

  validateForm: (data, rules) => {
    const errors = {};
    Object.entries(rules).forEach(([field, fieldRules]) => {
      const value = data[field];
      const fieldErrors = [];
      fieldRules.forEach((rule) => {
        if (typeof rule === "function") {
          if (!rule(value)) fieldErrors.push(`El campo ${field} no es válido`);
        } else if (rule.validator && !rule.validator(value)) {
          fieldErrors.push(rule.message || `El campo ${field} no es válido`);
        }
      });
      if (fieldErrors.length > 0) errors[field] = fieldErrors;
    });
    return { isValid: Object.keys(errors).length === 0, errors };
  },

  cleanFormData: (data) => {
    const cleaned = {};
    Object.entries(data).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== "") cleaned[key] = value;
    });
    return cleaned;
  },
};

/**
 * Sincroniza tokens entre instancias de API
 */
const syncGlobalTokens = (token) => {
  if (typeof authAPI !== "undefined") authAPI.authToken = token;
  if (typeof roulettesAPI !== "undefined") roulettesAPI.authToken = token;
  if (typeof participantsAPI !== "undefined") participantsAPI.authToken = token;
  if (typeof notificationAPI !== "undefined") notificationAPI.authToken = token;
};

// ============================================================================
//                         INSTANCIAS GLOBALES
// ============================================================================
/**
 * Instancias singleton de cada API
 * Úsalas directamente en lugar de instanciar nuevas clases
 */
export const authAPI = new AuthAPI();
export const roulettesAPI = new RoulettesAPI();
export const participantsAPI = new ParticipantsAPI();
export const notificationAPI = new NotificationAPI();
export const notificationManager = new NotificationManager(notificationAPI);

/**
 * Inicializa APIs globales (se ejecuta al cargar el módulo)
 */
const initializeGlobalAPIs = () => {
  const token = readAnyToken();
  if (token) {
    console.log("✅ Token encontrado, sincronizando APIs...");
    syncGlobalTokens(token);
  } else {
    console.log("ℹ️ No hay token guardado");
  }
};

initializeGlobalAPIs();

// ============================================================================
//                         CLIENTE UNIFICADO
// ============================================================================
/**
 * Objeto con todas las utilidades para importar como defecto
 */
const APIClient = {
  // APIs
  authAPI,
  roulettesAPI,
  participantsAPI,
  notificationAPI,

  // Token management
  setGlobalAuthToken,
  getGlobalAuthToken,
  clearAllTokens,
  isAuthenticated,

  // Managers
  NotificationManager,
  notificationManager,

  // Utilidades
  handleAPIError,
  createPaginationParams,
  formatPaginatedResponse,
  validators,
  formatters,
  deviceUtils,
  fileUtils,
  formUtils,
  resolveMediaUrl,

  // Endpoints
  ENDPOINTS,
  NOTIFICATION_ENDPOINTS,

  /**
   * Inicializa el cliente con configuración personalizada
   * @param {object} config - Configuración inicial
   * @returns {object} Resultado de inicialización
   */
  init: (config = {}) => {
    if (config.apiUrl) {
      authAPI.baseURL = config.apiUrl;
      roulettesAPI.baseURL = config.apiUrl;
      participantsAPI.baseURL = config.apiUrl;
      notificationAPI.baseURL = config.apiUrl;
    }
    if (config.token) {
      setGlobalAuthToken(config.token);
      syncGlobalTokens(config.token);
    }
    if (config.enableNotificationPolling !== false && isAuthenticated()) {
      notificationManager.startPolling(config.notificationPollInterval || 30000);
    }
    return {
      success: true,
      message: "✅ API Client initialized successfully",
      config: {
        apiUrl: config.apiUrl || API_URL,
        hasToken: !!readAnyToken(),
        storageType: isLocalStorageAvailable() ? "localStorage" : "InMemoryStorage",
      },
    };
  },
};

export default APIClient;