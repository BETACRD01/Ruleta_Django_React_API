// src/services/roulettes.js
import { ENDPOINTS } from "@/config/api";
import BaseAPI_default, { /* utilidades internas si las expusiste */ } from "@/config/api";

// Si no exportaste la instancia en api.jsx, crea una aquí:
const api = new (BaseAPI_default?.constructor || BaseAPI_default)(undefined, undefined);

// Detecta si el payload contiene archivos
const isFileLike = v =>
  (typeof File !== "undefined"     && v instanceof File) ||
  (typeof Blob !== "undefined"     && v instanceof Blob) ||
  (typeof FileList !== "undefined" && v instanceof FileList);

const hasFileDeep = (value) => {
  if (!value) return false;
  if (isFileLike(value)) return true;
  if (Array.isArray(value)) return value.some(hasFileDeep);
  if (typeof value === "object") return Object.values(value).some(hasFileDeep);
  return false;
};

// Construye FormData recursivo
const buildFormData = (data = {}) => {
  const fd = new FormData();
  const append = (fd, key, val) => {
    if (val === undefined || val === null) return;
    if (isFileLike(val)) {
      if (val instanceof FileList) Array.from(val).forEach((f,i)=>fd.append(`${key}[${i}]`, f));
      else fd.append(key, val);
    } else if (Array.isArray(val)) {
      val.forEach((v,i)=>append(fd, `${key}[${i}]`, v));
    } else if (typeof val === "object") {
      Object.entries(val).forEach(([k,v])=>append(fd, `${key}[${k}]`, v));
    } else {
      fd.append(key, String(val));
    }
  };
  Object.entries(data).forEach(([k,v])=>append(fd,k,v));
  return fd;
};

export const Roulettes = {
  async detail(id) {
    return api.request(ENDPOINTS.ROULETTES.DETAIL(id));
  },
  async create(payload) {
    const isMultipart = hasFileDeep(payload);
    const body = isMultipart ? buildFormData(payload) : JSON.stringify(payload);
    return api.request(ENDPOINTS.ROULETTES.CREATE, { method: "POST", body, isMultipart });
  },
  async update(id, payload) {
    const isMultipart = hasFileDeep(payload);
    const body = isMultipart ? buildFormData(payload) : JSON.stringify(payload);
    return api.request(ENDPOINTS.ROULETTES.UPDATE(id), { method: "PUT", body, isMultipart });
  },
};
