// src/pages/RouletteParticipate.jsx
import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Users, Upload, ArrowLeft, CheckCircle, AlertTriangle, Star,
  Award, Gift, Clock, Trophy, X as XIcon, Medal, Eye
} from "lucide-react";
import {
  roulettesAPI,
  participantsAPI,
  handleAPIError,
  isAuthenticated,
  API_URL,
  formatters,
  validators,
} from "../../../config/api";

/* ============================================================
   Helpers de imagen y campos
============================================================ */
const resolveImageUrl = (r) => {
  const candidate =
    r?.image_url || r?.image || r?.cover_image || r?.banner || r?.thumbnail || r?.photo || r?.picture;
  if (!candidate) return null;
  try { return new URL(candidate).href; }
  catch {
    const base = String(API_URL || "").replace(/\/api\/?$/i, "");
    const path = String(candidate).startsWith("/") ? candidate : `/${candidate}`;
    return `${base}${path}`;
  }
};

const startDate = (r) => r?.start_date || r?.start_at || r?.opens_at || r?.open_at || r?.participation_start || null;
const endDate   = (r) => r?.end_date   || r?.end_at   || r?.closes_at || r?.close_at || r?.deadline || null;
const partEnd   = (r) => r?.participation_end || r?.closing_date || r?.end_date || null;

/** Posición 1-based: usa display_order/position…; si nada, idx+1 */
const prizePosition = (p, idx = 0) => {
  for (const k of ["display_order","position","order","rank","priority","order_index","pos","displayIndex"]) {
    const v = Number(p?.[k]);
    if (Number.isFinite(v) && v > 0) return v;
  }
  if (Number.isFinite(+p?.id) && +p.id > 0) return +p.id;
  return idx + 1;
};
const sortByPosition = (a, b) => prizePosition(a, 0) - prizePosition(b, 0);

/** Ícono/chip por posición */
const getOrderBadge = (n) => {
  const map = {
    1: { label: "1° Premio", Icon: Trophy, cls: "bg-yellow-100 text-yellow-800 border-yellow-200" },
    2: { label: "2° Premio", Icon: Medal,  cls: "bg-gray-100 text-gray-800 border-gray-200" },
    3: { label: "3° Premio", Icon: Award,  cls: "bg-amber-100 text-amber-800 border-amber-200" },
  };
  return map[n] || { label: `${n}° Premio`, Icon: Star, cls: "bg-purple-100 text-purple-800 border-purple-200" };
};

/* ============================================================
   Normalizador de fecha
============================================================ */
const normalizeToDate = (val) => {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  const raw = String(val).trim();
  const maybeLocal = /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}(:\d{2})?$/.test(raw) ? raw.replace(/\s+/, "T") : raw;
  const d = new Date(maybeLocal);
  if (!isNaN(d.getTime())) return d;
  const alt = new Date(maybeLocal.replace(/\//g, "-"));
  return isNaN(alt.getTime()) ? null : alt;
};

/* ============================================================
   Cronómetro
============================================================ */
const RouletteCountdown = ({ targetDate, label, type = "end" }) => {
  const parsed = useMemo(() => normalizeToDate(targetDate), [targetDate]);
  const [timeLeft, setTL] = useState({ days:0,hours:0,minutes:0,seconds:0, isExpired:false, isActive:false });

  useEffect(() => {
    if (!parsed) { setTL({ days:0,hours:0,minutes:0,seconds:0, isExpired:false, isActive:false }); return; }
    const tick = () => {
      const diff = parsed.getTime() - Date.now();
      if (diff <= 0) { setTL({ days:0,hours:0,minutes:0,seconds:0, isExpired:true, isActive:false }); return; }
      const days = Math.floor(diff/86400000);
      const hours = Math.floor((diff%86400000)/3600000);
      const minutes = Math.floor((diff%3600000)/60000);
      const seconds = Math.floor((diff%60000)/1000);
      setTL({ days, hours, minutes, seconds, isExpired:false, isActive:true });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [parsed]);

  if (!parsed || (!timeLeft.isActive && !timeLeft.isExpired)) return null;

  const styles = timeLeft.isExpired
    ? { box:"bg-red-50 border-red-200", txt:"text-red-800", badge:"bg-red-100 text-red-700" }
    : type==="draw"
      ? { box:"bg-purple-50 border-purple-200", txt:"text-purple-800", badge:"bg-purple-100 text-purple-700" }
      : { box:"bg-blue-50 border-blue-200", txt:"text-blue-800", badge:"bg-blue-100 text-blue-700" };

  return (
    <div className={`p-3 rounded-lg border ${styles.box}`}>
      <div className={`flex items-center text-xs font-medium ${styles.txt} mb-2`}>
        <Clock className="h-3 w-3 mr-1" /> {label}
      </div>
      {timeLeft.isExpired ? (
        <div className="text-sm font-bold text-red-600">Tiempo terminado</div>
      ) : (
        <div className="flex flex-wrap gap-1">
          {timeLeft.days>0 && <span className={`px-2 py-1 rounded text-xs font-bold ${styles.badge}`}>{timeLeft.days}d</span>}
          <span className={`px-2 py-1 rounded text-xs font-bold ${styles.badge}`}>{String(timeLeft.hours).padStart(2,"0")}h</span>
          <span className={`px-2 py-1 rounded text-xs font-bold ${styles.badge}`}>{String(timeLeft.minutes).padStart(2,"0")}m</span>
          <span className={`px-2 py-1 rounded text-xs font-bold ${styles.badge}`}>{String(timeLeft.seconds).padStart(2,"0")}s</span>
        </div>
      )}
    </div>
  );
};

/* ============================================================
   processText (links básicos)
============================================================ */
const processText = (text) => {
  if (!text || typeof text !== "string") return "";
  let t = text
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;").replace(/'/g,"&#39;");
  const patterns = [
    { regex:/\b(https?:\/\/[^\s<>"']+)/gi,
      process:(m)=>`<a href="${m.replace(/[.,;!?)\]}>]+$/,"")}" target="_blank" rel="noopener noreferrer" class="text-blue-600 underline hover:text-blue-800 hover:no-underline font-medium">${m}</a>` },
    { regex:/\b(www\.[^\s<>"']+)/gi,
      process:(m)=>`<a href="https://${m.replace(/[.,;!?)\]}>]+$/,"")}" target="_blank" rel="noopener noreferrer" class="text-blue-600 underline hover:text-blue-800 hover:no-underline font-medium">${m}</a>` },
  ];
  patterns.forEach(p=>{
    p.regex.lastIndex=0; let m;
    while((m=p.regex.exec(t))!==null){
      const full=m[0]; const a=m.index; const b=a+full.length;
      const rep=p.process(full);
      t = t.substring(0,a)+rep+t.substring(b);
      const diff = rep.length - full.length;
      p.regex.lastIndex = b + diff;
    }
  });
  return t.replace(/\n/g,"<br/>");
};

/* ============================================================
   Ruleta visual (ESTÁTICA, no gira) — responsive medio
============================================================ */
const StaticRoulette = ({ participants }) => {
  const wrapRef = useRef(null);
  const [size, setSize] = useState(320); // px

  // Escala automática “media”: máx 520px y 80% del ancho
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      const s = Math.max(220, Math.min(520, Math.floor(w * 0.8)));
      setSize(s);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const colors = ['#FF6B6B','#4ECDC4','#45B7D1','#96CEB4','#FFEAA7','#DDA0DD','#98D8C8','#F7DC6F','#BB8FCE','#85C1E9','#F8BBD9','#A8E6CF','#FFB6C1','#87CEEB','#DDA0DD'];
  const seg = participants.length ? 360/participants.length : 0;
  const cx = size/2, cy = size/2;
  const R = size*0.47;
  const labelR = size*0.30;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <div className="text-center mb-3">
        <h2 className="text-lg font-semibold text-gray-800">Ruleta Interactiva</h2>
        <p className="text-xs text-gray-600">Vista previa de los sectores.</p>
      </div>

      <div ref={wrapRef} className="relative mx-auto w-full" style={{ maxWidth: 640 }}>
        <svg width={size} height={size} className="drop-shadow-2xl block mx-auto">
          <circle cx={cx} cy={cy} r={R} fill="url(#g)" stroke="#1f2937" strokeWidth={Math.max(2, size*0.012)} />
          <defs>
            <radialGradient id="g" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0.1" />
            </radialGradient>
            <filter id="ts"><feDropShadow dx="1" dy="1" stdDeviation="2" floodColor="#000" floodOpacity="0.8"/></filter>
          </defs>

          {participants.map((p,i)=>{
            const a1=(i*seg)-90, a2=((i+1)*seg)-90;
            const x1=cx+(R-15)*Math.cos(a1*Math.PI/180), y1=cy+(R-15)*Math.sin(a1*Math.PI/180);
            const x2=cx+(R-15)*Math.cos(a2*Math.PI/180), y2=cy+(R-15)*Math.sin(a2*Math.PI/180);
            const large= seg>180?1:0;
            const ta = a1 + seg/2;
            const tx = cx+labelR*Math.cos(ta*Math.PI/180), ty = cy+labelR*Math.sin(ta*Math.PI/180);

            return (
              <g key={p.id || i}>
                <path d={`M${cx} ${cy} L ${x1} ${y1} A ${R-15} ${R-15} 0 ${large} 1 ${x2} ${y2} Z`}
                      fill={colors[i%colors.length]} stroke="#fff" strokeWidth={Math.max(1, size*0.006)} opacity="0.95" />
                <text x={tx} y={ty} textAnchor="middle" dominantBaseline="middle"
                      fontSize={participants.length>12?Math.max(9, size*0.03):participants.length>8?Math.max(11, size*0.035):Math.max(13, size*0.04)}
                      fontWeight="700" fill="white" filter="url(#ts)">#{i+1}</text>
              </g>
            );
          })}

          <circle cx={cx} cy={cy} r={Math.max(16, size*0.07)} fill="#1f2937" stroke="#f59e0b" strokeWidth={Math.max(2, size*0.01)} />
          <circle cx={cx} cy={cy} r={Math.max(12, size*0.05)} fill="#f59e0b" />
        </svg>

        {participants.length === 0 && (
          <div className="text-center mt-3">
            <p className="text-xs text-gray-500 bg-gray-50 inline-block px-3 py-1 rounded-full border">
              La ruleta aparecerá cuando haya participantes
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

/* ============================================================
   Cabecera (sin ID)
============================================================ */
const HeaderInfo = ({ r, count }) => {
  const cover = resolveImageUrl(r);
  const st = startDate(r), ed = endDate(r), pe = partEnd(r), sched = r?.scheduled_date;

  const MAX_CHARS = 160;
  const rawDesc = r?.description || "";
  const [expanded, setExpanded] = useState(false);
  const shortDesc = rawDesc.length > MAX_CHARS ? rawDesc.slice(0, MAX_CHARS) + "…" : rawDesc;
  const showToggle = rawDesc.length > MAX_CHARS;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="w-full aspect-[21/9] max-h-28 overflow-hidden bg-gray-100">
        {cover
          ? <img src={cover} alt={r?.name || "Ruleta"} className="w-full h-full object-cover object-center" />
          : <div className="h-full w-full flex items-center justify-center text-gray-300"><Gift className="w-7 h-7" /></div>}
      </div>

      <div className="p-3">
        <div className="mb-1">
          <h2 className="text-[15px] font-bold text-gray-900 leading-tight">{r?.name || r?.title || "Ruleta de Premios"}</h2>
        </div>

        {rawDesc && (
          <div className="text-[13px] text-gray-700 leading-relaxed" style={{ overflowWrap: "anywhere", lineHeight: 1.6 }}>
            {expanded
              ? <span dangerouslySetInnerHTML={{ __html: processText(rawDesc) }} />
              : <span dangerouslySetInnerHTML={{ __html: processText(shortDesc) }} />}
            {showToggle && (
              <button
                type="button"
                onClick={() => setExpanded(v => !v)}
                className="ml-1 text-xs font-semibold text-blue-600 hover:text-blue-800"
              >
                {expanded ? "Ver menos" : "Ver más"}
              </button>
            )}
          </div>
        )}

        <div className="mt-2 flex flex-wrap gap-1.5 text-[11.5px]">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 border text-gray-700">
            Participantes: <strong className="font-semibold">{count}</strong>
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 border text-gray-700">
            Inicio: <strong className="font-semibold">{st ? formatters.date(st) : "—"}</strong>
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 border text-gray-700">
            Cierre: <strong className="font-semibold">{ed ? formatters.date(ed) : (pe ? formatters.date(pe) : "—")}</strong>
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 border text-gray-700">
            Sorteo: <strong className="font-semibold">{sched ? formatters.date(sched) : "—"}</strong>
          </span>
        </div>
      </div>
    </div>
  );
};

/* ============================================================
   Modal de Premio (scroll interno)
============================================================ */
const PrizeModal = ({ prize, onClose }) => {
  const onKey = useCallback((e) => { if (e.key === "Escape") onClose(); }, [onClose]);
  useEffect(() => { document.addEventListener("keydown", onKey); return () => document.removeEventListener("keydown", onKey); }, [onKey]);
  if (!prize) return null;

  const img = prize.image_url || prize.image || prize.photo || prize.banner || prize.picture || prize.thumbnail || null;
  const imageUrl = img ? resolveImageUrl({ image_url: img }) : null;
  const pos = prizePosition(prize, 0);
  const { label, Icon, cls } = getOrderBadge(pos);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e)=>e.stopPropagation()}
        role="dialog" aria-modal="true"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 rounded-full border text-xs font-semibold inline-flex items-center gap-1 ${cls}`}>
              <Icon className="w-4 h-4" /> {label}
            </span>
            <h3 className="text-lg font-semibold text-gray-900">{prize.name || prize.title || "Premio"}</h3>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 rounded-lg p-1">
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4 overflow-y-auto">
          <div className="rounded-xl overflow-hidden bg-gray-100 aspect-square flex items-center justify-center">
            {imageUrl ? (
              <img src={imageUrl} alt={prize.name || "Premio"} className="w-full h-full object-contain" />
            ) : (
              <Gift className="w-16 h-16 text-gray-300" />
            )}
          </div>
          <div className="text-sm text-gray-700 leading-relaxed">
            {prize.description
              ? <span dangerouslySetInnerHTML={{ __html: processText(prize.description) }} />
              : <span className="text-gray-400">Sin descripción</span>
            }
          </div>
        </div>
      </div>
    </div>
  );
};

/* ============================================================
   Grid de Premios
============================================================ */
const PrizesGrid = ({ prizes = [], onOpen }) => {
  const sorted = [...(prizes||[])].sort(sortByPosition);
  const pickKey = (p, ...ks) => ks.find(k => p?.[k] !== undefined);

  if (!sorted.length) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="text-center py-8">
          <Gift className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-gray-800 mb-2">Premios</h2>
          <p className="text-sm text-gray-500">Los premios se anunciarán pronto</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
      <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2 mb-2">
        <Gift className="h-5 w-5 text-purple-600" /> Premios ({sorted.length})
      </h3>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {sorted.map((p, idx) => {
          const nameK = pickKey(p,'name','title','prize_name','label') || 'name';
          const descK = pickKey(p,'description','desc','details','text');
          const qtyK  = pickKey(p,'quantity','qty','stock','count');
          const imgK  = pickKey(p,'image_url','image','photo','picture','banner','thumbnail');
          const raw   = p?.[imgK];
          const img   = raw ? resolveImageUrl({ image_url: raw }) : null;
          const pos   = prizePosition(p, idx);
          const { label, Icon, cls } = getOrderBadge(pos);

          return (
            <button
              key={p.id || idx}
              onClick={()=>onOpen(p)}
              className="group text-left border border-gray-100 rounded-lg p-2 hover:shadow-md transition-shadow bg-white"
              title={p?.[nameK] || `Premio ${idx+1}`}>
              <div className="relative w-full h-20 bg-gray-50 rounded overflow-hidden flex items-center justify-center">
                {img ? <img src={img} alt={p?.[nameK] || 'Premio'} className="w-full h-full object-cover"/> : <Gift className="w-8 h-8 text-gray-300" />}
                <span className={`absolute top-1 left-1 text-[10.5px] font-bold px-1.5 py-0.5 rounded-full border inline-flex items-center gap-1 ${cls}`}>
                  <Icon className="w-3.5 h-3.5" /> {label}
                </span>
                {qtyK && p?.[qtyK] ? (
                  <span className="absolute top-1 right-1 text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-blue-600 text-white shadow-sm">x{p[qtyK]}</span>
                ) : null}
                <span className="absolute bottom-1 right-1 inline-flex items-center gap-1.5 text-[11px] px-1.5 py-0.5 rounded-md bg-white/80 border shadow-sm">
                  <Eye className="w-3.5 h-3.5 text-gray-700" /> Ver
                </span>
              </div>
              <div className="mt-2">
                <div className="text-sm font-medium text-gray-900 line-clamp-2">{p?.[nameK] || `Premio #${idx+1}`}</div>
                <div className="text-xs text-gray-500 mt-1 line-clamp-2">
                  {p?.[descK] ? String(p[descK]).slice(0, 90) + (String(p[descK]).length>90 ? '…' : '') : '—'}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

/* ============================================================
   Página principal
============================================================ */
export default function RouletteParticipate() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [roulette, setRoulette] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [prizes, setPrizes] = useState([]);
  const [modalPrize, setModalPrize] = useState(null);

  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setPageError("");

      const [rRes, pRes, prRes] = await Promise.all([
        roulettesAPI.getRoulette(id),
        participantsAPI.getRouletteParticipants(id).catch(() => ({ participants: [] })),
        roulettesAPI.listPrizes(id).catch(() => ([]))
      ]);

      rRes.image_url = resolveImageUrl(rRes);
      setRoulette(rRes);

      const plist = Array.isArray(pRes?.participants) ? pRes.participants : (pRes?.results || []);
      setParticipants(plist);

      const rawPrizes = Array.isArray(prRes?.results) ? prRes.results : (prRes || []);
      setPrizes(rawPrizes.map((pr) => {
        const img = pr?.image_url || pr?.image || pr?.photo || pr?.picture || pr?.banner || pr?.thumbnail || null;
        return img ? { ...pr, image_url: resolveImageUrl({ image_url: img }) } : pr;
      }));

    } catch (err) {
      setPageError(handleAPIError(err, "No se pudo cargar la información de la ruleta."));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadData(); }, [loadData]);

  const ed = useMemo(() => endDate(roulette), [roulette]);
  const pe = useMemo(() => partEnd(roulette), [roulette]);
  const sched = useMemo(() => roulette?.scheduled_date, [roulette]);

  const participationStatus = useMemo(() => {
    if (!roulette) return { disabled:false, reason:"" };
    if (roulette.is_drawn) return { disabled:true, reason:"Esta ruleta ya fue sorteada." };
    if (roulette.status === "completed") return { disabled:true, reason:"La ruleta está marcada como completada." };
    if (roulette.status === "cancelled") return { disabled:true, reason:"Esta ruleta fue cancelada." };
    if (pe && new Date(pe) <= new Date()) return { disabled:true, reason:"El período de participación ha terminado." };
    if (ed && new Date(ed) <= new Date()) return { disabled:true, reason:"El período de participación ha terminado." };
    return { disabled:false, reason:"" };
  }, [roulette, ed, pe]);

  const validateReceipt = (f) => {
    if (!f) return "Debes adjuntar el comprobante.";
    if (!validators.fileExtension(["jpg","jpeg","png","pdf"])(f)) return "Extensión no permitida (JPG, JPEG, PNG o PDF).";
    if (!validators.maxFileSize(5)(f)) return "El archivo supera 5MB.";
    return "";
  };

  const submit = async (e) => {
    e?.preventDefault?.();
    if (!isAuthenticated()) { setPageError("Debes iniciar sesión para participar."); return; }
    const err = validateReceipt(file);
    if (err) { setFileError(err); return; }
    try {
      setSubmitting(true); setSuccessMsg(""); setPageError("");
      await participantsAPI.participate(id, file);
      setSuccessMsg("¡Participación registrada con éxito!");
      await loadData();
      setFile(null);
    } catch (err) {
      setPageError(handleAPIError(err, "No se pudo registrar tu participación."));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="inline-flex items-center gap-3 text-gray-600">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-lg">Cargando ruleta…</span>
        </div>
      </div>
    );
  }

  if (pageError && !roulette) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <button onClick={()=>navigate(-1)} className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-6 hover:bg-gray-100 px-3 py-2 rounded-lg transition-colors">
          <ArrowLeft className="h-4 w-4" /> Volver
        </button>
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-6 w-6 text-red-600 mt-1 shrink-0"/>
            <div>
              <h3 className="text-lg font-semibold text-red-900 mb-2">Error al cargar la ruleta</h3>
              <p className="text-red-700">{pageError}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const disabled = participationStatus.disabled;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50">
      <div className="p-4 sm:p-6 space-y-6 max-w-screen-2xl mx-auto">
        {/* Header simple (sin ID) */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <button onClick={()=>navigate(-1)} className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-white px-4 py-2 rounded-lg transition-colors shadow-sm border border-gray-200 w-max">
            <ArrowLeft className="h-4 w-4" /> Volver a Ruletas
          </button>
          {roulette && (
            <div className="text-left sm:text-right">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{roulette.name || roulette.title || "Ruleta de Premios"}</h1>
            </div>
          )}
        </div>

        {/* IZQ: Header+Ruleta / DER: Premios + Form */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="space-y-4">
            <HeaderInfo r={roulette} count={participants.length}/>
            <StaticRoulette participants={participants}/>
          </div>

          <div className="space-y-4">
            <PrizesGrid prizes={prizes} onOpen={setModalPrize}/>

            {/* Formulario */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <div className="text-center mb-4">
                <Star className="h-8 w-8 text-yellow-500 mx-auto mb-3" />
                <h2 className="text-xl font-bold text-gray-800 mb-2">Participar en el sorteo</h2>
                <p className="text-sm text-gray-600">Sube tu comprobante (JPG, PNG o PDF hasta 5MB)</p>
              </div>

              {disabled ? (
                <div className="text-center py-8">
                  <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Participación no disponible</h3>
                  <p className="text-gray-600 bg-amber-50 border border-amber-200 rounded-lg p-4">
                    {participationStatus.reason}
                  </p>
                </div>
              ) : (
                <form onSubmit={submit} className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3">Comprobante de Participación</label>
                    <label className="group relative flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-xl hover:border-blue-400 hover:bg-blue-50 cursor-pointer transition-all">
                      <div className="text-center">
                        <Upload className="h-8 w-8 text-gray-400 group-hover:text-blue-500 mx-auto mb-2" />
                        <span className="text-sm font-medium text-gray-600 group-hover:text-blue-600">{file ? "Cambiar archivo" : "Seleccionar archivo"}</span>
                        <p className="text-xs text-gray-500 mt-1">JPG, PNG o PDF • máx 5MB</p>
                      </div>
                      <input
                        type="file"
                        accept=".jpg,.jpeg,.png,.pdf"
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        onChange={(e)=>{ const f=e.target.files?.[0]||null; setFile(f); setFileError(validateReceipt(f)); }}
                      />
                    </label>

                    {file && (
                      <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-center gap-2 text-sm text-blue-800">
                          <CheckCircle className="h-4 w-4" />
                          <span className="font-medium">{file.name}</span>
                          <span className="text-blue-600">({formatters.fileSize(file.size)})</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {fileError && (
                    <div className="flex items-start gap-2 text-red-700 bg-red-50 border border-red-200 px-4 py-3 rounded-lg">
                      <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" />
                      <span className="text-sm">{fileError}</span>
                    </div>
                  )}

                  {pageError && (
                    <div className="flex items-start gap-2 text-red-700 bg-red-50 border border-red-200 px-4 py-3 rounded-lg">
                      <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" />
                      <span className="text-sm">{pageError}</span>
                    </div>
                  )}

                  {successMsg && (
                    <div className="flex items-start gap-2 text-green-700 bg-green-50 border border-green-200 px-4 py-3 rounded-lg">
                      <CheckCircle className="h-5 w-5 mt-0.5 shrink-0" />
                      <span className="text-sm font-medium">{successMsg}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={submitting || !!fileError || !file}
                    className={`w-full inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl text-sm font-semibold transition-all
                      ${submitting || !!fileError || !file
                        ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                        : "bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 hover:scale-105 shadow-lg hover:shadow-xl"}`}>
                    {submitting
                      ? (<><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>Procesando…</>)
                      : (<><CheckCircle className="h-5 w-5" /> Confirmar participación</>)}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal Premio */}
      <PrizeModal prize={modalPrize} onClose={()=>setModalPrize(null)} />
    </div>
  );
}
