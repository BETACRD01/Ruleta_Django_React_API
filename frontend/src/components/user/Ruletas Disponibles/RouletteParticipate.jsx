// src/pages/RouletteParticipate.jsx
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Users, Calendar, Upload, ArrowLeft, CheckCircle, AlertTriangle,
  Star, Award, Gift, Clock, Crown, Medal, Package, Percent, X
} from 'lucide-react';
import {
  roulettesAPI,
  participantsAPI,
  handleAPIError,
  isAuthenticated,
  API_URL,
  formatters,
  validators,
} from '../../../config/api';

/* =========================
   Helpers
========================= */
const resolveImageUrl = (r) => {
  const candidate = r?.image_url || r?.image || r?.cover_image || r?.banner || r?.thumbnail || r?.photo || r?.picture;
  if (!candidate) return null;
  try {
    const u = new URL(candidate);
    return u.href;
  } catch {
    const base = String(API_URL || '').replace(/\/api\/?$/i, '');
    const path = String(candidate).startsWith('/') ? candidate : `/${candidate}`;
    return `${base}${path}`;
  }
};
const normalizeDate = (r) => r?.created_at || r?.created || r?.date_created || r?.timestamp || r?.updated_at || null;
const getStartDate = (r) => r?.start_date || r?.start_at || r?.opens_at || r?.open_at || null;
const getEndDate = (r) => r?.end_date || r?.end_at || r?.closes_at || r?.close_at || r?.deadline || r?.scheduled_date || null;
const getParticipationEnd = (r) => r?.participation_end || r?.end_date || r?.closing_date || null;

const safeDate = (value, opts = {}) => {
  if (!value) return '—';
  const d = new Date(value);
  if (formatters?.date && typeof formatters.date === 'function') return formatters.date(d, opts);
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', ...opts });
};

/* ===== Contador animado (para Participantes) ===== */
const useCountUp = (target = 0, duration = 800) => {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let raf; const start = performance.now(); const from = 0;
    const step = (t) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      setVal(Math.round(from + (target - from) * eased));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
};

/* =========================
   Tema por imagen (enlaces muy visibles)
========================= */
const useImageTheme = (imageUrl) => {
  const hasImage = Boolean(imageUrl);
  const overlayCls = hasImage ? 'bg-black/70 md:bg-black/65' : 'bg-transparent';
  const text = {
    title: hasImage ? 'text-white' : 'text-gray-900',
    body: hasImage ? 'text-white/95' : 'text-gray-700',
    link: hasImage
      ? 'text-yellow-300 hover:text-yellow-200 underline decoration-yellow-300/90 decoration-2 underline-offset-2'
      : 'text-blue-700 hover:text-blue-900 underline decoration-blue-700/90 decoration-2 underline-offset-2',
  };
  return { overlayCls, text };
};

/* =========================
   Enlaces dentro de texto
========================= */
const formatTextWithLinks = (text, theme = { link: 'text-blue-700 hover:text-blue-900 underline', mail: null, tel: null }) => {
  if (!text) return null;
  const urlClass = theme.link;
  const mailClass = theme.mail || theme.link.replace(/blue/g, 'green');
  const telClass = theme.tel || theme.link.replace(/blue/g, 'purple');

  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
  const phoneRegex = /(\+?[0-9]{1,4}[-.\s]?(\([0-9]{1,3}\))?[-.\s]?[0-9]{3,4}[-.\s]?[0-9]{3,4})/g;

  let s = text;
  s = s.replace(urlRegex, (url) =>
    `<a href="${url}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 ${urlClass}">
      <span>${url}</span>
    </a>`
  );
  s = s.replace(emailRegex, (email) =>
    `<a href="mailto:${email}" class="inline-flex items-center gap-1 ${mailClass}">
      <span>${email}</span>
    </a>`
  );
  s = s.replace(phoneRegex, (phone) =>
    `<a href="tel:${phone.replace(/[^\d+]/g, '')}" class="inline-flex items-center gap-1 ${telClass}">
      <span>${phone}</span>
    </a>`
  );
  return s.replace(/\n/g, '<br/>');
};

/* =========================
   LIGHTBOX de imagen
========================= */
const ImageLightbox = ({ src, alt, onClose }) => {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!src) return null;
  return (
    <div className="fixed inset-0 z-[80] bg-black/90 flex items-center justify-center p-4" onClick={onClose}>
      <button
        onClick={onClose}
        className="absolute right-4 top-4 inline-flex items-center justify-center w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white"
        aria-label="Cerrar imagen"
      >
        <X className="w-5 h-5" />
      </button>
      <img
        src={src}
        alt={alt || 'Imagen'}
        className="max-w-[95vw] max-h-[95vh] object-contain cursor-zoom-out"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
      />
    </div>
  );
};

/* =========================
   Modal Premio (con Lightbox)
========================= */
const PrizeModal = ({ open, onClose, prize }) => {
  const [showImage, setShowImage] = useState(false);
  useEffect(() => { if (!open) setShowImage(false); }, [open]);

  if (!open || !prize) return null;
  const name = prize.name || prize.title || 'Premio';
  const description = prize.description || prize.desc || prize.details || '';
  const formatted = description ? formatTextWithLinks(description, { link: 'text-blue-700 hover:text-blue-900 underline decoration-2 underline-offset-2' }) : null;

  return (
    <>
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4">
        <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden">
          <button
            onClick={onClose}
            className="absolute right-3 top-3 inline-flex items-center justify-center w-9 h-9 rounded-full bg-black/60 hover:bg-black/75 text-white"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="grid grid-cols-1 md:grid-cols-2 max-h-[80vh]">
            <button
              type="button"
              title="Ver imagen en grande"
              className="bg-gray-50 md:min-h-[420px] relative group"
              onClick={() => setShowImage(true)}
            >
              {prize.image_url ? (
                <>
                  <img src={prize.image_url} alt={name} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition" />
                  <div className="absolute bottom-3 right-3 text-xs px-2 py-1 rounded bg-black/60 text-white opacity-0 group-hover:opacity-100 transition">
                    Clic para ampliar
                  </div>
                </>
              ) : (
                <div className="w-full h-full min-h-[300px] flex items-center justify-center">
                  <Gift className="w-12 h-12 text-gray-400" />
                </div>
              )}
            </button>

            <div className="p-6 md:p-8 overflow-y-auto">
              <div className="flex items-center gap-2 mb-3">
                <Gift className="w-5 h-5 text-purple-600" />
                <h3 className="text-xl font-bold text-gray-900">{name}</h3>
              </div>

              {formatted ? (
                <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed"
                     dangerouslySetInnerHTML={{ __html: formatted }} />
              ) : (
                <p className="text-gray-600">Sin descripción</p>
              )}

              <div className="mt-5 flex flex-wrap gap-3 text-sm text-gray-600">
                {typeof prize.stock === 'number' && (
                  <span className="inline-flex items-center gap-2 bg-gray-100 border border-gray-200 px-3 py-1.5 rounded-full">
                    <Package className="w-4 h-4" /> Stock: <strong>{prize.stock}</strong>
                  </span>
                )}
                {typeof prize.probability === 'number' && (
                  <span className="inline-flex items-center gap-2 bg-gray-100 border border-gray-200 px-3 py-1.5 rounded-full">
                    <Percent className="w-4 h-4" /> Prob: <strong>{prize.probability}%</strong>
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {showImage && (
        <ImageLightbox
          src={prize.image_url}
          alt={name}
          onClose={() => setShowImage(false)}
        />
      )}
    </>
  );
};

/* =========================
   Cronómetro
========================= */
const CountdownTimer = ({ endDate, label, type = "default", className = "" }) => {
  const [t, setT] = useState({ d: 0, h: 0, m: 0, s: 0 });
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (!endDate) return;
    const tick = () => {
      const now = Date.now();
      const end = new Date(endDate).getTime();
      const diff = end - now;
      if (diff <= 0) { setExpired(true); return; }
      setT({
        d: Math.floor(diff / 86400000),
        h: Math.floor((diff % 86400000) / 3600000),
        m: Math.floor((diff % 3600000) / 60000),
        s: Math.floor((diff % 60000) / 1000),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endDate]);

  const base = expired
    ? "bg-red-100 text-red-800 border-red-200"
    : type === "draw" ? "bg-purple-100 text-purple-800 border-purple-200" : "bg-gray-100 text-gray-800 border-gray-200";

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border ${base} shadow-sm transition transform-gpu hover:-translate-y-0.5 ${className}`}>
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-current"></span>
      </span>
      {expired ? (
        <span>{type === "draw" ? "Sorteo finalizado" : "Participación cerrada"}</span>
      ) : (
        <div className="flex items-center gap-1 tabular-nums">
          <span className="opacity-75">{label}:</span>
          {t.d > 0 && <strong className="mx-0.5">{t.d}d</strong>}
          {(t.d > 0 || t.h > 0) && <strong className="mx-0.5">{t.h}h</strong>}
          <strong className="mx-0.5">{t.m}m</strong>
          <strong key={t.s} className="mx-0.5">{t.s}s</strong>
        </div>
      )}
    </div>
  );
};

/* =========================
   Premios (más dinámicos) — con scroll
========================= */
const CompactPrizesSection = ({ prizes = [], onOpenPrize }) => {
  const getProp = (p, ...k) => { for (const x of k) if (p?.[x] != null && p[x] !== '') return p[x]; return null; };
  const imgOf = (p) => {
    const raw = getProp(p, 'image_url', 'image', 'photo', 'picture', 'banner', 'thumbnail', 'cover');
    if (!raw) return null;
    if (/^https?:\/\//i.test(raw)) return raw;
    const base = API_URL ? API_URL.replace(/\/api\/?$/i, '') : '';
    const path = raw.startsWith('/') ? raw : `/${raw}`;
    return `${base}${path}`;
  };
  const posBadge = (p, i) => {
    const pos = p.position || (i + 1);
    const map = {
      1: { icon: Crown, cls: "from-yellow-100 to-yellow-200 text-yellow-800 border-yellow-300", label: "1°" },
      2: { icon: Award, cls: "from-gray-100 to-gray-200 text-gray-800 border-gray-300", label: "2°" },
      3: { icon: Medal, cls: "from-amber-100 to-amber-200 text-amber-800 border-amber-300", label: "3°" },
    };
    if (pos <= 3) return { ...map[pos], show: true };
    if (pos <= 5) return { icon: Award, cls: "from-indigo-100 to-indigo-200 text-indigo-800 border-indigo-300", label: `${pos}°`, show: true };
    return { icon: Star, cls: "from-purple-100 to-purple-200 text-purple-800 border-purple-300", label: `${pos}°`, show: true };
  };
  const sorted = [...(Array.isArray(prizes) ? prizes : [])].sort((a, b) => {
    const A = getProp(a, 'position', 'pos', 'order') ?? 999;
    const B = getProp(b, 'position', 'pos', 'order') ?? 999;
    return Number(A) - Number(B);
  });

  if (!sorted.length) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
        <Gift className="h-8 w-8 text-gray-400 mx-auto mb-2" />
        <h3 className="text-base font-semibold text-gray-800 mb-1">Premios</h3>
        <p className="text-sm text-gray-500">Pronto se anunciarán los premios</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="px-5 py-3 border-b border-gray-200 bg-gray-50 sticky top-0 z-10">
        <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2">
          <Gift className="h-5 w-5 text-[#0b56a7]" /> Premios ({sorted.length})
        </h3>
      </div>

      {/* Altura controlada + scroll suave + scrollbars discretos */}
      <div
        className="p-4 max-h-[28rem] overflow-y-auto"
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: '#cbd5e1 transparent'
        }}
      >
        <ul className="space-y-3">
          {sorted.map((p, i) => {
            const name = p.name || p.title || `Premio #${i + 1}`;
            const desc = p.description || p.desc || p.details || '';
            const stock = p.stock ?? p.quantity ?? p.qty ?? p.count ?? p.available;
            const prob = p.probability ?? p.chance ?? p.weight;
            const img = imgOf(p);
            const badge = posBadge(p, i);
            const formatted = desc ? formatTextWithLinks(desc, { link: 'text-[#0b56a7] hover:text-[#207ba8] underline decoration-2 underline-offset-2' }) : null;

            const Icon = badge.icon;

            return (
              <li
                key={p.id || i}
                className="relative group border border-gray-200 rounded-xl p-3 bg-white shadow-sm hover:shadow-md transition transform-gpu hover:-translate-y-0.5"
              >
                <span className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-transparent group-hover:ring-[#4dc9b1]/40" />
                {badge.show && (
                  <div className={`absolute -top-2 -left-2 inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold border-2 shadow bg-gradient-to-r ${badge.cls}`}>
                    <Icon className="h-3 w-3" /> {badge.label}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => onOpenPrize({ ...p, image_url: img, name, description: desc })}
                  className="w-full flex items-start gap-3 text-left"
                >
                  <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                    {img ? (
                      <>
                        <img src={img} alt={name} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.06]" />
                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition" />
                      </>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><Gift className="h-5 w-5 text-gray-400" /></div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-gray-900 text-sm truncate mb-1">{name}</h4>
                    {formatted && (
                      <div className="text-xs text-gray-600 line-clamp-2" dangerouslySetInnerHTML={{ __html: formatted }} />
                    )}

                    <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
                      {stock != null && (
                        <span className="inline-flex items-center gap-1"><Package className="h-3 w-3" />{stock}</span>
                      )}
                      {prob != null && (
                        <span className="inline-flex items-center gap-1"><Percent className="h-3 w-3" />{Number(prob)}%</span>
                      )}
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};

/* =========================
   Hero (sin chips / sin fila de ID/fecha)
========================= */
const RouletteHeroSection = ({ roulette }) => {
  const { overlayCls, text } = useImageTheme(roulette?.image_url);
  const [expanded, setExpanded] = useState(false);
  const linksTheme = { link: text.link };
  const formatted = roulette?.description ? formatTextWithLinks(roulette.description, linksTheme) : null;

  return (
    <div className="relative bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {roulette?.image_url && (
        <div className="absolute inset-0">
          <img src={roulette.image_url} alt={roulette?.name || 'Ruleta'} className="w-full h-full object-cover" />
          <div className={`absolute inset-0 ${overlayCls}`} />
        </div>
      )}

      <div className="relative z-10 p-4 sm:p-6">
        <div className="mx-auto w-full max-w-2xl">
          <div className={roulette?.image_url ? 'bg-black/35 backdrop-blur-sm rounded-xl p-4 sm:p-5' : ''}>
            <h1 className={`text-xl font-bold mb-3 ${text.title}`} style={{ textShadow: roulette?.image_url ? '0 1px 2px rgba(0,0,0,.55)' : 'none' }}>
              {roulette?.name || roulette?.title || 'Ruleta de Premios'}
            </h1>

            {formatted && (
              <div className="mb-1">
                <div
                  className={`${text.body} text-[15px] leading-relaxed ${expanded ? '' : 'line-clamp-[14]'}`}
                  style={{ textShadow: roulette?.image_url ? '0 1px 2px rgba(0,0,0,.35)' : 'none' }}
                  dangerouslySetInnerHTML={{ __html: formatted }}
                />
                <button
                  type="button"
                  className={`mt-2 text-sm font-semibold ${text.link}`}
                  onClick={() => setExpanded((v) => !v)}
                >
                  {expanded ? 'Ver menos' : 'Ver más'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/* =========================
   Formulario
========================= */
const ParticipationForm = ({ roulette, onSubmit, loading, error, success }) => {
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState('');

  const hasFn = (fn) => typeof fn === 'function';
  const extAllowed = ['jpg', 'jpeg', 'png', 'pdf'];
  const fallbackExt = (f) => f?.name && extAllowed.includes(f.name.split('.').pop()?.toLowerCase());
  const fallbackSize = (f) => (f?.size ?? 0) <= 5 * 1024 * 1024;

  const validateReceipt = (f) => {
    if (!f) return 'Debes adjuntar el comprobante.';
    const okExt = hasFn(validators?.fileExtension) ? validators.fileExtension(extAllowed)(f) : fallbackExt(f);
    if (!okExt) return 'Extensión no permitida (JPG, JPEG, PNG o PDF).';
    const okSize = hasFn(validators?.maxFileSize) ? validators.maxFileSize(5)(f) : fallbackSize(f);
    if (!okSize) return 'El archivo supera 5MB.';
    return '';
  };

  const onSubmitLocal = async (e) => {
    e?.preventDefault?.();
    const err = validateReceipt(file);
    if (err) { setFileError(err); return; }
    await onSubmit(file);
    setFile(null);
  };

  const disabled = useMemo(() => {
    if (!roulette) return false;
    if (roulette.is_drawn) return true;
    if (roulette.status === 'completed' || roulette.status === 'cancelled') return true;
    const participationEnd = roulette?.participation_end || roulette?.end_date;
    if (participationEnd && new Date(participationEnd) <= new Date()) return true;
    return false;
  }, [roulette]);

  if (disabled) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="text-center py-6">
          <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-gray-900 mb-2">Participación no disponible</h3>
          <p className="text-gray-600">La ruleta no acepta nuevas participaciones en este momento.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-[#207ba8]/20 shadow-sm overflow-hidden" id="participar">
      {/* Header con acento suave */}
      <div className="px-6 py-5 bg-[#0b56a7]/5 border-b border-[#207ba8]/20 text-center sticky top-0 z-10">
        <h3 className="text-lg font-semibold text-[#0b56a7]">Participar en el sorteo</h3>
        <p className="text-xs text-[#207ba8] mt-1">Adjunta tu comprobante (JPG, PNG o PDF). Máx. 5MB.</p>
      </div>

      <div className="p-6">
        <form onSubmit={onSubmitLocal} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-2">Comprobante *</label>
            {/* Dropzone con colores de marca */}
            <label
              className="
                group relative flex flex-col items-center justify-center w-full h-32
                border-2 border-dashed rounded-xl cursor-pointer transition
                bg-[#4dc9b1]/[0.03] border-[#207ba8]/30
                hover:border-[#207ba8]/50 hover:bg-[#4dc9b1]/[0.06]
                focus-within:outline-none focus-within:ring-2 focus-within:ring-[#4dc9b1]/40
              "
            >
              <div className="text-center p-3">
                <div
                  className="
                    w-12 h-12 mx-auto mb-2 rounded-full flex items-center justify-center
                    bg-[#389fae]/15 group-hover:bg-[#389fae]/25 transition-colors
                  "
                >
                  <Upload className="h-5 w-5 text-[#0b56a7]" />
                </div>
                <span className="text-sm font-medium text-[#0b56a7]">
                  {file ? 'Cambiar archivo' : 'Seleccionar archivo'}
                </span>
                <p className="text-xs text-[#207ba8]">JPG, JPEG, PNG o PDF</p>
              </div>

              <input
                type="file"
                accept=".jpg,.jpeg,.png,.pdf"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                onChange={(e) => {
                  const f = e.target.files?.[0] || null;
                  setFile(f);
                  setFileError(validateReceipt(f));
                }}
              />
            </label>

            {file && (
              <div className="mt-3 p-3 bg-[#4dc9b1]/10 border border-[#4dc9b1]/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 bg-[#4dc9b1]/20 rounded-full flex items-center justify-center">
                    <CheckCircle className="h-4 w-4 text-[#0b56a7]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#0b56a7]">{file.name}</p>
                    <p className="text-xs text-[#207ba8]">Tamaño: {formatters.fileSize(file.size)}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {fileError && (
            <div className="flex items-start gap-3 text-[#0b56a7] bg-[#0b56a7]/10 border border-[#0b56a7]/20 px-3 py-3 rounded-lg">
              <AlertTriangle className="h-5 w-5 mt-0.5" />
              <span className="text-sm font-medium">{fileError}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !!fileError || !file}
            className={`w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold transition
              ${loading || !!fileError || !file
                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                : 'bg-[#207ba8] hover:bg-[#0b56a7] text-white shadow-sm hover:shadow'}`}
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Procesando…
              </>
            ) : (
              <>Confirmar participación</>
            )}
          </button>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {success && <p className="text-sm text-green-600">{success}</p>}
        </form>
      </div>
    </div>
  );
};

/* =========================
   Página principal
========================= */
export default function RouletteParticipate() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [roulette, setRoulette] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [prizes, setPrizes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const [prizeModalOpen, setPrizeModalOpen] = useState(false);
  const [activePrize, setActivePrize] = useState(null);
  const openPrize = (p) => { setActivePrize(p); setPrizeModalOpen(true); };
  const closePrize = () => { setPrizeModalOpen(false); setActivePrize(null); };

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setPageError('');

      const [rouletteRes, participantsRes, prizesRes] = await Promise.all([
        roulettesAPI.getRoulette(id),
        participantsAPI.getRouletteParticipants(id).catch(() => ({ participants: [] })),
        roulettesAPI.listPrizes(id).catch(() => ([]))
      ]);

      rouletteRes.image_url = resolveImageUrl(rouletteRes);
      setRoulette(rouletteRes);

      const participantsList = Array.isArray(participantsRes?.participants)
        ? participantsRes.participants
        : (participantsRes?.results || []);
      setParticipants(participantsList);

      let prizeList = [];
      if (Array.isArray(prizesRes?.results)) prizeList = prizesRes.results;
      else if (Array.isArray(prizesRes)) prizeList = prizesRes;
      else if (prizesRes?.data && Array.isArray(prizesRes.data)) prizeList = prizesRes.data;
      else if (prizesRes?.prizes && Array.isArray(prizesRes.prizes)) prizeList = prizesRes.prizes;

      const processed = prizeList.map((p, idx) => {
        const x = { ...p };
        if (!x.id) x.id = `prize-${idx}-${Date.now()}`;
        const fields = ['image_url', 'image', 'photo', 'picture', 'banner', 'thumbnail', 'cover'];
        let img = null;
        for (const f of fields) { if (x[f]) { img = x[f]; break; } }
        if (img) {
          if (/^https?:\/\//i.test(img)) x.image_url = img;
          else {
            const base = API_URL ? API_URL.replace(/\/api\/?$/i, '') : '';
            const path = img.startsWith('/') ? img : `/${img}`;
            x.image_url = `${base}${path}`;
          }
        }
        if (!x.name && x.title) x.name = x.title;
        if (!x.stock && x.quantity) x.stock = x.quantity;
        if (x.stock != null) x.stock = Number(x.stock);
        if (x.probability != null) x.probability = Number(x.probability);
        if (x.position != null) x.position = Number(x.position);
        return x;
      });

      setPrizes(processed);
    } catch (err) {
      console.error('Error loading data:', err);
      setPageError(handleAPIError(err, 'No se pudo cargar la información de la ruleta.'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadData(); }, [loadData]);

  const created = useMemo(() => normalizeDate(roulette), [roulette]);
  const startDate = useMemo(() => getStartDate(roulette), [roulette]);
  const endDate = useMemo(() => getEndDate(roulette), [roulette]);
  const participationEnd = useMemo(() => getParticipationEnd(roulette), [roulette]);
  const scheduledDate = useMemo(() => roulette?.scheduled_date, [roulette]);
  const participantsCount = useMemo(() => participants.length, [participants]);
  const countUpParticipants = useCountUp(participantsCount);

  const handleSubmit = async (file) => {
    if (!isAuthenticated()) { setPageError('Debes iniciar sesión para participar.'); return; }
    try {
      setSubmitting(true);
      setPageError('');
      setSuccessMsg('');
      await participantsAPI.participate(id, file);
      setSuccessMsg('¡Participación registrada con éxito!');
      await loadData();
    } catch (err) {
      setPageError(handleAPIError(err, 'No se pudo registrar tu participación.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-14 h-14 border-4 border-gray-900 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-base text-gray-700">Cargando ruleta…</p>
        </div>
      </div>
    );
  }

  if (pageError && !roulette) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-2xl mx-auto pt-8">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-sm text-gray-700 hover:text-black mb-6 bg-white px-4 py-2 rounded-lg transition-colors shadow-sm border border-gray-200"
          >
            <ArrowLeft className="h-4 w-4" /> Volver
          </button>
          <div className="bg-red-50 border border-red-200 rounded-xl p-6">
            <div className="flex items-start gap-4">
              <AlertTriangle className="h-8 w-8 text-red-600 mt-1" />
              <div>
                <h3 className="text-lg font-semibold text-red-900 mb-1">Error al cargar la ruleta</h3>
                <p className="text-red-700">{pageError}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-2 text-sm text-gray-700 hover:text-black bg-white px-4 py-2 rounded-lg transition-colors shadow-sm border border-gray-200"
            >
              <ArrowLeft className="h-4 w-4" /> Volver a Ruletas
            </button>
          </div>

          {/* Estadísticas */}
          <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl border border-gray-200 p-4 shadow-sm">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Participantes */}
              <div className="group relative text-center rounded-xl p-4 transition transform-gpu hover:-translate-y-0.5 bg-white border border-gray-200">
                <div className="absolute -top-2 -left-2 w-10 h-10 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center shadow-sm">
                  <Users className="h-5 w-5 text-gray-700" />
                </div>
                <div className="mt-6 text-2xl font-extrabold text-gray-900 tabular-nums">{countUpParticipants}</div>
                <div className="text-xs text-gray-600 mt-1">Participantes</div>
              </div>

              {/* Inicio */}
              <div className="group relative text-center rounded-xl p-4 transition transform-gpu hover:-translate-y-0.5 bg-white border border-gray-200">
                <div className="absolute -top-2 -left-2 w-10 h-10 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center shadow-sm">
                  <Calendar className="h-5 w-5 text-gray-700" />
                </div>
                <div className="mt-6 text-base font-semibold text-gray-900">
                  {startDate ? safeDate(startDate, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) :
                    created ? safeDate(created, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '---'}
                </div>
                <div className="text-xs text-gray-600 mt-1">Inicio</div>
              </div>

              {/* Fin */}
              <div className="group relative text-center rounded-xl p-4 transition transform-gpu hover:-translate-y-0.5 bg-white border border-gray-200">
                <div className="absolute -top-2 -left-2 w-10 h-10 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center shadow-sm">
                  <Calendar className="h-5 w-5 text-gray-700" />
                </div>
                <div className="mt-6 text-base font-semibold text-gray-900">
                  {endDate ? safeDate(endDate, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) :
                    participationEnd ? safeDate(participationEnd, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '---'}
                </div>
                <div className="text-xs text-gray-600 mt-1">Fin</div>
              </div>

              {/* Tiempo */}
              <div className="group relative text-center rounded-xl p-4 transition transform-gpu hover:-translate-y-0.5 bg-white border border-gray-200">
                <div className="absolute -top-2 -left-2 w-10 h-10 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center shadow-sm">
                  <Clock className="h-5 w-5 text-gray-700" />
                </div>
                <div className="mt-6 space-y-2">
                  {participationEnd && new Date(participationEnd) > new Date() && (
                    <CountdownTimer endDate={participationEnd} label="Cierra" type="participation" />
                  )}
                  {scheduledDate && new Date(scheduledDate) > new Date() && (
                    <CountdownTimer endDate={scheduledDate} label="Sorteo" type="draw" />
                  )}
                </div>
                <div className="text-xs text-gray-600 mt-1">Tiempo</div>
              </div>
            </div>
          </div>

          {/* Layout principal */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <RouletteHeroSection roulette={roulette} />
            </div>

            {/* Columna derecha "pegajosa" con scroll propio */}
            <div className="lg:col-span-1">
              <div className="space-y-6 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto"
                   style={{ scrollbarWidth: 'thin', scrollbarColor: '#cbd5e1 transparent' }}>
                <CompactPrizesSection prizes={prizes} onOpenPrize={openPrize} />
                <ParticipationForm
                  roulette={roulette}
                  onSubmit={handleSubmit}
                  loading={submitting}
                  error={pageError}
                  success={successMsg}
                />
              </div>
            </div>
          </div>

          {/* Footer sobrio */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 text-center">
            <h3 className="text-base font-semibold text-gray-900 mb-1">¡Buena suerte!</h3>
            <p className="text-sm text-gray-600">
              Sorteo transparente y supervisado. ¡Participa y comprueba los resultados!
            </p>
          </div>
        </div>
      </div>

      {/* Modal premio + lightbox */}
      <PrizeModal open={prizeModalOpen} onClose={closePrize} prize={activePrize} />
    </>
  );
}
