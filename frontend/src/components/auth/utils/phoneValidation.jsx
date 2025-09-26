// src/components/auth/utils/phoneValidation.js

/**
 * Valida y normaliza teléfonos a E.164 con tolerancia:
 * - Acepta "00" -> se convierte a "+"
 * - Acepta "0" nacional (lo elimina tras el código si aplica)
 * - Si no trae "+", asume país por defecto (defaultCountry = +593 por defecto)
 * - Devuelve { valid, error, suggestion, normalized }
 * - Reglas permisivas para LATAM + NANP (+1) y España (+34)
 */

const COUNTRY_NAMES = {
  "+54": "Argentina",
  "+55": "Brasil",
  "+56": "Chile",
  "+57": "Colombia",
  "+58": "Venezuela",
  "+51": "Perú",
  "+52": "México",
  "+53": "Cuba",
  "+502": "Guatemala",
  "+503": "El Salvador",
  "+504": "Honduras",
  "+505": "Nicaragua",
  "+506": "Costa Rica",
  "+507": "Panamá",
  "+509": "Haití",
  "+591": "Bolivia",
  "+592": "Guyana",
  "+593": "Ecuador",
  "+594": "Guayana Francesa",
  "+595": "Paraguay",
  "+596": "Martinica/Guadalupe",
  "+597": "Surinam",
  "+598": "Uruguay",
  "+599": "Antillas Neerlandesas",
  "+1": "EE.UU./Canadá/Caribe (NANP)",
  "+34": "España",
};

// Reglas por país: longitudes NSN y/o regex simples.
// trunkZero: aceptar y remover un "0" nacional justo después del código.
const COUNTRY_RULES = {
  "+54": { nsnLengths: [10, 11], trunkZero: true }, // AR
  "+55": { nsnLengths: [10, 11] },                  // BR
  "+56": { nsnLengths: [9], trunkZero: true },      // CL
  "+57": { nsnLengths: [10], mobileRegex: /^3\d{9}$/ }, // CO (móvil 3xxxxxxxxx)
  "+58": { nsnLengths: [10] },                      // VE
  "+51": { nsnLengths: [9], mobileRegex: /^9\d{8}$/ },  // PE
  "+52": { nsnLengths: [10], legacyMX1: true },     // MX (+521 xxxxxxxxxx legacy)
  "+53": { nsnLengths: [8] },                       // CU
  "+502": { nsnLengths: [8] },                      // GT
  "+503": { nsnLengths: [8] },                      // SV
  "+504": { nsnLengths: [8] },                      // HN
  "+505": { nsnLengths: [8] },                      // NI
  "+506": { nsnLengths: [8] },                      // CR
  "+507": { nsnLengths: [8] },                      // PA
  "+509": { nsnLengths: [8] },                      // HT
  "+591": { nsnLengths: [8] },                      // BO
  "+593": { nsnLengths: [8, 9], mobileRegex: /^9\d{8}$/, fixedRegex: /^[2-7]\d{7}$/, trunkZero: true, allowFixedLines: true }, // EC
  "+595": { nsnLengths: [9] },                      // PY
  "+598": { nsnLengths: [8, 9] },                   // UY
  "+1":   { nsnLengths: [10], nanp: true },         // NANP
  "+34":  { nsnLengths: [9], mobileRegex: /^[67]\d{8}$/ }, // ES
};

// Ordenar códigos por longitud (desc) para elegir el prefijo más largo primero
const COUNTRY_CODES = Object.keys(COUNTRY_RULES).sort((a, b) => b.length - a.length);

const pickCountryCode = (e164) => COUNTRY_CODES.find((code) => e164.startsWith(code)) || null;

/** Normaliza a E.164 con heurísticas amistosas */
export const normalizePhone = (
  raw,
  { defaultCountry = "+593" } = {}
) => {
  if (!raw) return { normalized: null, suggestion: null, error: "El teléfono es requerido", meta: { defaultCountry } };

  let s = String(raw).trim().replace(/[\s\-()]/g, "");

  // 00 -> +
  if (s.startsWith("00")) s = "+" + s.slice(2);

  // Si ya trae +, remover "0" de troncal si aplica (p.ej. +5930...)
  if (s.startsWith("+")) {
    const code = pickCountryCode(s);
    if (code && COUNTRY_RULES[code]?.trunkZero && s[code.length] === "0") {
      const fixed = code + s.slice(code.length + 1);
      return { normalized: fixed, suggestion: fixed, error: null, meta: { defaultCountry } };
    }
    return { normalized: s, suggestion: null, error: null, meta: { defaultCountry } };
  }

  // Si empieza con 0 → tratar como nacional del país por defecto (quita el 0)
  if (/^0\d+$/.test(s)) {
    const fixed = defaultCountry + s.slice(1);
    return { normalized: fixed, suggestion: fixed, error: null, meta: { defaultCountry } };
  }

  // Solo dígitos → anteponer país por defecto
  if (/^\d+$/.test(s)) {
    const fixed = defaultCountry + s;
    return { normalized: fixed, suggestion: fixed, error: null, meta: { defaultCountry } };
  }

  return { normalized: null, suggestion: null, error: "Formato inválido de teléfono", meta: { defaultCountry } };
};

/** Validación principal (normaliza + valida por país) */
export const validatePhone = (phone, opts = {}) => {
  // 1) Normalizar
  const norm = normalizePhone(phone, opts);
  if (!norm.normalized) {
    return { valid: false, error: norm.error || "Formato inválido", suggestion: norm.suggestion ?? null };
  }
  const clean = norm.normalized;

  // 2) E.164 básico
  const e164Regex = /^\+[1-9]\d{7,14}$/;
  if (!e164Regex.test(clean)) {
    return {
      valid: false,
      error: "Formato inválido. Use: +[código país][número] (8-15 dígitos)",
      suggestion: norm.suggestion ?? clean,
      normalized: clean,
    };
  }

  // 3) Reglas por país (permisivas)
  const code = pickCountryCode(clean);
  if (!code) {
    // País no mapeado: aceptar si pasó E.164
    return { valid: true, error: null, suggestion: norm.suggestion ?? null, normalized: clean };
  }

  const rules = COUNTRY_RULES[code];
  const nsn = clean.slice(code.length); // número sin el prefijo

  // MX legacy: +521 + 10 dígitos
  if (rules.legacyMX1 && nsn.length === 11 && nsn.startsWith("1")) {
    const tail10 = nsn.slice(1);
    if (/^\d{10}$/.test(tail10)) {
      return { valid: true, error: null, suggestion: norm.suggestion ?? null, normalized: clean };
    }
  }

  // NANP (EE.UU., Canadá, PR, DO, etc.)
  if (rules.nanp) {
    if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(nsn)) {
      return {
        valid: false,
        error: `Número inválido para ${COUNTRY_NAMES[code] || "NANP"}. Verifica el formato.`,
        suggestion: norm.suggestion ?? clean,
        normalized: clean,
      };
    }
    return { valid: true, error: null, suggestion: norm.suggestion ?? null, normalized: clean };
  }

  // Verificación de longitud permitida
  if (!rules.nsnLengths.includes(nsn.length)) {
    return {
      valid: false,
      error: `Número inválido para ${COUNTRY_NAMES[code] || "este país"}. Verifica la longitud.`,
      suggestion: norm.suggestion ?? clean,
      normalized: clean,
    };
  }

  // Regex móvil/fijo si existen (permisivo)
  if (rules.mobileRegex && rules.fixedRegex) {
    if (!(rules.mobileRegex.test(nsn) || rules.fixedRegex.test(nsn))) {
      return {
        valid: false,
        error: `Número inválido para ${COUNTRY_NAMES[code] || "este país"}. Verifica el formato.`,
        suggestion: norm.suggestion ?? clean,
        normalized: clean,
      };
    }
  } else if (rules.mobileRegex) {
    // Si quieres ser estricto para móviles, descomenta:
    // if (!rules.mobileRegex.test(nsn)) { ... }
  }

  return { valid: true, error: null, suggestion: norm.suggestion ?? null, normalized: clean };
};