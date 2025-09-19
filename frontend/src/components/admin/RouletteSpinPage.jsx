// src/components/admin/RouletteSpinPage.jsx
import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Wheel } from "react-custom-roulette-r19";
import {
  ArrowLeft, Play, Award, Users, Calendar, Gift, AlertTriangle,
  Image as ImageIcon, Trophy, Star, X as XIcon, Maximize2, Minimize2, ZoomIn, ZoomOut
} from "lucide-react";
import {
  RoulettesAPI, ParticipantsAPI, getGlobalAuthToken, handleAPIError, formatters
} from "../../config/api";

/* =========================
   Helpers API
========================= */
const createRouletteAPI = () => new RoulettesAPI(getGlobalAuthToken());
const createParticipantsAPI = () => new ParticipantsAPI(getGlobalAuthToken());

/* =========================
   Fecha
========================= */
const normalizeToDate = (val) => {
  if (!val) return null;
  const s = String(val).trim();
  const withT = /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}(:\d{2})?$/.test(s) ? s.replace(/\s+/, "T") : s;
  const d = new Date(withT);
  if (!isNaN(d.getTime())) return d;
  const alt = new Date(withT.replace(/\//g, "-"));
  return isNaN(alt.getTime()) ? null : alt;
};
const fmt = (d) => {
  const date = normalizeToDate(d);
  if (!date) return "—";
  return date.toLocaleString("es-ES", {
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit"
  });
};

/* =========================
   Texto -> HTML con links
========================= */
const processTextHTML = (text) => {
  if (!text || typeof text !== "string") return "";
  let html = text
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;").replace(/'/g,"&#39;");
  const ranges = [];
  const overlaps = (s,e)=>ranges.some(r=>(s>=r.start&&s<=r.end)||(e>=r.start&&e<=r.end)||(s<=r.start&&e>=r.end));
  const mark=(s,e)=>ranges.push({start:s,end:e});

  const patterns = [
    {
      regex: /\b(https?:\/\/[^\s<>"']+)/gi,
      process: m => {
        const clean = m.replace(/[.,;!?)\]}>]+$/, "");
        return `<a href="${clean}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center text-blue-600 hover:text-blue-800 underline hover:no-underline font-medium bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-md transition-all duration-200 text-xs md:text-sm">${clean}<svg class="ml-1 w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg></a>`;
      }
    },
    {
      regex: /\b(www\.[^\s<>"']+)/gi,
      skipIf: (t,s) => t.substring(Math.max(0,s-10),s).includes('href="'),
      process: m => {
        const clean = m.replace(/[.,;!?)\]}>]+$/, "");
        return `<a href="https://${clean}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center text-blue-600 hover:text-blue-800 underline hover:no-underline font-medium bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-md transition-all duration-200 text-xs md:text-sm">${clean}<svg class="ml-1 w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg></a>`;
      }
    },
    {
      regex: /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g,
      skipIf: (t,s) => t.substring(Math.max(0,s-10),s).includes('href="'),
      process: m => `<a href="mailto:${m}" class="inline-flex items-center text-green-600 hover:text-green-800 underline hover:no-underline font-medium bg-green-50 hover:bg-green-100 px-2 py-1 rounded-md transition-all duration-200 text-xs md:text-sm">${m}</a>`
    },
    {
      regex: /\B@([a-zA-Z0-9_-]{1,30})\b/g,
      process: m => `<span class="inline-flex items-center bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-[10px] md:text-xs font-semibold border border-purple-200"><span class="w-2 h-2 bg-purple-500 rounded-full mr-1.5"></span>${m}</span>`
    },
    {
      regex: /\B#([a-zA-Z0-9_-]{1,30})\b/g,
      process: m => `<span class="inline-flex items-center bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full text-[10px] md:text-xs font-semibold border border-emerald-200"><span class="w-2 h-2 bg-emerald-500 rounded-full mr-1.5"></span>${m}</span>`
    }
  ];

  patterns.forEach(p => {
    p.regex.lastIndex = 0;
    let m;
    while((m = p.regex.exec(html)) !== null) {
      const full = m[0], s = m.index, e = s + full.length;
      if (overlaps(s,e) || (p.skipIf && p.skipIf(html,s))) continue;
      const rep = p.process(full);
      html = html.substring(0, s) + rep + html.substring(e);
      p.regex.lastIndex = s + rep.length;
      mark(s, s + rep.length);
    }
  });

  return html.replace(/\n/g, "<br/>");
};

/* =========================
   Generar colores de la rueda
========================= */
const makeWheelColors = (n) => {
  // paleta base clara y neutra (segmentos)
  const base = ["#f3f4f6","#e5e7eb","#d1d5db","#f9fafb","#ede9fe","#dbeafe","#dcfce7","#fee2e2"];
  if (!n) return base;
  const out = [];
  for (let i=0;i<n;i++){
    out.push(base[i % base.length]);
  }
  return out;
};

/* =========================
   Visor (Lightbox) de imágenes
========================= */
const ImageLightbox = ({ src, alt, onClose }) => {
  const [scale, setScale] = useState(1);
  const containerRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const onWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setScale((s) => Math.min(3, Math.max(0.5, s + delta)));
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex flex-col">
      <div className="flex items-center justify-between p-3 sm:p-4 text-white">
        <div className="flex items-center gap-2 text-sm sm:text-base">
          <ImageIcon className="w-5 h-5" />
          <span className="font-medium truncate max-w-[60vw]">{alt || "Imagen"}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={()=>setScale((s)=>Math.min(3,s+0.15))} className="inline-flex items-center px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20">
            <ZoomIn className="w-4 h-4 mr-1"/> Zoom
          </button>
          <button onClick={()=>setScale((s)=>Math.max(0.5,s-0.15))} className="inline-flex items-center px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20">
            <ZoomOut className="w-4 h-4 mr-1"/> Zoom
          </button>
          <button onClick={()=>setScale(1)} className="inline-flex items-center px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20">
            <Minimize2 className="w-4 h-4 mr-1"/> 100%
          </button>
          <button onClick={onClose} className="inline-flex items-center px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20">
            <XIcon className="w-4 h-4 mr-1"/> Cerrar
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="flex-1 overflow-auto grid place-items-center"
        onWheel={onWheel}
        onClick={(e)=>{ if(e.target === containerRef.current) onClose?.(); }}
      >
        <img
          src={src}
          alt={alt || ""}
          style={{ transform: `scale(${scale})`, transformOrigin: "center center" }}
          className="max-w-none select-none"
          draggable={false}
        />
      </div>
    </div>
  );
};

/* =========================
   Posiciones premios
========================= */
const getPositionText = (index) => {
  const positions = ['1°','2°','3°','4°','5°','6°','7°','8°','9°','10°'];
  return positions[index] || `${index + 1}°`;
};
const getPositionColor = (index) => {
  if (index === 0) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
  if (index === 1) return 'text-gray-600 bg-gray-50 border-gray-200';
  if (index === 2) return 'text-amber-600 bg-amber-50 border-amber-200';
  return 'text-blue-600 bg-blue-50 border-blue-200';
};

/* =========================
   Tarjeta Premio
========================= */
const PrizeTile = ({ prize, index, onOpenImage }) => {
  const hasImg = Boolean(prize?.image_url);
  const order = typeof prize?.display_order === "number" ? prize.display_order : index + 1;
  const positionText = getPositionText(index);
  const positionColor = getPositionColor(index);

  const [expanded, setExpanded] = useState(false);

  return (
    <div className="group relative bg-white border border-gray-200 rounded-lg hover:shadow-md hover:border-gray-300 transition-all duration-200 overflow-hidden">
      <div className={`absolute top-2 left-2 z-10 px-2 py-0.5 rounded-md text-xs font-bold border ${positionColor}`}>
        {positionText}
      </div>

      <div className="relative h-36 xl:h-40 bg-gray-50 overflow-hidden">
        {hasImg ? (
          <>
            <img
              src={prize.image_url}
              alt={prize.name || `Premio ${order}`}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 cursor-zoom-in"
              onClick={() => onOpenImage?.(prize.image_url, prize.name || `Premio ${order}`)}
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                const fb = e.currentTarget.parentElement.querySelector('.fallback');
                if (fb) fb.style.display = 'flex';
              }}
            />
            <button
              onClick={() => onOpenImage?.(prize.image_url, prize.name || `Premio ${order}`)}
              className="absolute bottom-2 right-2 inline-flex items-center bg-black/50 hover:bg-black/70 text-white text-xs px-2 py-1 rounded-md"
              aria-label="Ver imagen"
            >
              <Maximize2 className="w-3.5 h-3.5 mr-1" /> Ampliar
            </button>
          </>
        ) : null}
        <div className={`fallback ${hasImg ? "hidden" : "flex"} absolute inset-0 items-center justify-center text-gray-400`}>
          <div className="text-center">
            <ImageIcon className="w-8 h-8 mx-auto mb-1" />
            <span className="text-xs">Sin imagen</span>
          </div>
        </div>

        {/* Overlay info rápida */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/15 transition-all duration-200 flex items-end pointer-events-none">
          <div className="w-full p-2 transform translate-y-full group-hover:translate-y-0 transition-transform duration-200">
            <div className="flex items-center justify-between text-white text-xs">
              {typeof prize?.probability === "number" && (
                <span className="bg-black/50 px-1.5 py-0.5 rounded text-xs">
                  {(prize.probability).toFixed(0)}%
                </span>
              )}
              {typeof prize?.stock === "number" && (
                <span className="bg-black/50 px-1.5 py-0.5 rounded text-xs">
                  Stock: {prize.stock}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="p-3">
        <div className="flex items-start justify-between mb-2">
          <h6 className="font-semibold text-sm text-gray-900 leading-tight mr-2 line-clamp-1">
            {prize?.name || `Premio ${order}`}
          </h6>
          {index < 3 && (
            <div className="shrink-0">
              {index === 0 && <Trophy className="w-4 h-4 text-yellow-500" />}
              {index === 1 && <Star className="w-4 h-4 text-gray-500" />}
              {index === 2 && <Award className="w-4 h-4 text-amber-500" />}
            </div>
          )}
        </div>

        {prize?.description && (
          <>
            <div
              className={`text-xs text-gray-700 leading-relaxed ${expanded ? "" : "line-clamp-3"} mb-2`}
              dangerouslySetInnerHTML={{ __html: processTextHTML(prize.description) }}
            />
            <button
              className="text-[11px] text-blue-600 hover:text-blue-800 font-medium"
              onClick={()=>setExpanded(!expanded)}
            >
              {expanded ? "Ver menos" : "Ver más"}
            </button>
          </>
        )}

        <div className="mt-2 flex items-center justify-between">
          {typeof prize?.value !== "undefined" && prize?.value !== null && (
            <span className="text-sm font-bold text-green-600">
              {formatters?.currency ? formatters.currency(prize.value) : `US$ ${prize.value}`}
            </span>
          )}
          <div className="text-xs text-gray-500">#{order}</div>
        </div>
      </div>
    </div>
  );
};

/* =========================
   Página principal
========================= */
export default function RouletteSpinPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [roulette, setRoulette] = useState(null);
  const [prizes, setPrizes] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [error, setError] = useState("");

  const [prizesLoading, setPrizesLoading] = useState(true);

  const [mustStartSpinning, setMustStartSpinning] = useState(false);
  const [prizeNumber, setPrizeNumber] = useState(0);
  const [phase, setPhase] = useState("idle"); // idle | waitingApi | spinning | done
  const [winner, setWinner] = useState(null);
  const [apiError, setApiError] = useState("");

  // Lightbox
  const [lightbox, setLightbox] = useState(null); // { src, alt }

  /* Carga inicial */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setError("");

        const rouletteAPI = createRouletteAPI();
        const participantsAPI = createParticipantsAPI();

        const rouletteData = await rouletteAPI.getRoulette(id);
        if (!alive) return;
        setRoulette(rouletteData || null);

        setPrizesLoading(true);
        try {
          const res = await rouletteAPI.listPrizes(id);
          let list = [];
          if (Array.isArray(res?.results)) list = res.results;
          else if (Array.isArray(res)) list = res;
          else if (Array.isArray(res?.data)) list = res.data;
          const active = list.filter(p => (p?.is_active ?? true) && (p?.stock ?? 1) > 0);

          const sorted = (active.length ? active : list).slice();
          sorted.sort((a, b) => {
            const orderA = a?.display_order ?? 999;
            const orderB = b?.display_order ?? 999;
            if (orderA !== orderB) return orderA - orderB;
            return (a?.id || 0) - (b?.id || 0);
          });

          setPrizes(sorted);
        } catch {
          setPrizes([]);
        } finally { setPrizesLoading(false); }

        try {
          const pres = await participantsAPI.getRouletteParticipants(id);
          let list = [];
          if (Array.isArray(pres?.participants)) list = pres.participants;
          else if (Array.isArray(pres?.results)) list = pres.results;
          else if (Array.isArray(pres)) list = pres;
          setParticipants(list);
        } catch { setParticipants([]); }

      } catch (e) {
        const msg = handleAPIError ? handleAPIError(e, "No se pudo cargar la ruleta") : e?.message || "No se pudo cargar la ruleta";
        setError(msg);
      } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [id]);

  /* Datos para la rueda */
  const wheelData = useMemo(() => {
    if (!participants?.length) {
      if (!prizes?.length) return Array.from({ length: 8 }, (_, i) => ({ option: `Sector ${i + 1}` }));
      return prizes.map(p => ({ option: String(p.name || "Premio") }));
    }
    return participants.map(p => ({
      option: p?.name || p?.user?.name || (p?.email ? p.email.split("@")[0] : "Participante")
    }));
  }, [participants, prizes]);

  const wheelColors = useMemo(() => makeWheelColors(wheelData.length), [wheelData.length]);

  const indexByParticipantId = useMemo(() => {
    const map = new Map();
    (participants || []).forEach((p, i) => {
      const id = p?.id || p?.user?.id || i;
      map.set(String(id), i);
    });
    return map;
  }, [participants]);

  const spinDuration = useMemo(() => {
    const n = participants?.length || 0;
    if (n < 10) return 4.5;
    if (n < 50) return 5.8;
    if (n < 200) return 6.8;
    return 8.2;
  }, [participants?.length]);

  const canSpin = useMemo(() => {
    return roulette && !roulette.is_drawn && roulette.status === "active" &&
           (participants?.length || 0) > 0 && (prizes?.length || 0) > 0 && phase !== "spinning";
  }, [roulette, participants?.length, prizes?.length, phase]);

  /* Ejecutar sorteo */
  const startSpin = useCallback(async () => {
    if (!canSpin || !roulette?.id || mustStartSpinning || !wheelData.length) return;
    setApiError(""); setWinner(null); setPhase("waitingApi");
    try {
      const api = createRouletteAPI();
      const result = await api.executeRouletteDraw(roulette.id);

      const w = {
        success: result?.success,
        message: result?.message,
        winner_user: {
          name: result?.winner?.name || result?.winner?.user?.name,
          email: result?.winner?.email || result?.winner?.user?.email,
          id: result?.winner?.id || result?.winner?.user?.id,
        },
        prize: null, raw: result,
      };

      let idx = 0;
      const winnerId = result?.winner?.id || result?.winner?.user?.id;
      if (winnerId && indexByParticipantId.has(String(winnerId))) {
        idx = indexByParticipantId.get(String(winnerId));
      } else if (participants.length) {
        idx = Math.floor(Math.random() * participants.length);
      }

      const backendPrizeId = result?.prize?.id || result?.winner?.prize_id || result?.prize_id;
      if (backendPrizeId) {
        const foundPrize = prizes.find(p => String(p.id) === String(backendPrizeId));
        if (foundPrize) w.prize = foundPrize;
      } else if (prizes.length) {
        w.prize = prizes[Math.floor(Math.random() * prizes.length)];
      }

      setWinner(w);
      setPrizeNumber(idx);
      setPhase("spinning");
      setMustStartSpinning(true);
    } catch (e) {
      const msg = handleAPIError ? handleAPIError(e, "No se pudo ejecutar el sorteo") : e?.message || "No se pudo ejecutar el sorteo";
      setApiError(msg);
      const idx = participants.length ? Math.floor(Math.random() * participants.length) : 0;
      setWinner({
        success: false,
        message: msg,
        winner_user: {
          name: participants[idx]?.name || participants[idx]?.user?.name || "Participante simulado",
          email: participants[idx]?.email || participants[idx]?.user?.email || "",
          id: participants[idx]?.id || participants[idx]?.user?.id || null
        },
        prize: prizes[0] || { name: "Premio" },
        raw: null
      });
      setPrizeNumber(idx); setPhase("spinning"); setMustStartSpinning(true);
    }
  }, [canSpin, roulette?.id, mustStartSpinning, wheelData.length, participants, prizes, indexByParticipantId]);

  const handleStop = () => { setMustStartSpinning(false); setPhase("done"); };
  const resetSpin  = () => { setPhase("idle"); setWinner(null); setApiError(""); setMustStartSpinning(false); };

  /* =========================
     UI
  ========================= */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 mx-auto" />
          <p className="mt-4 text-lg text-gray-600">Cargando ruleta...</p>
        </div>
      </div>
    );
  }
  if (error || !roulette) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-red-900 mb-2">Error al cargar</h3>
          <p className="text-red-600 mb-4">{error || "Ruleta no encontrada"}</p>
          <button onClick={() => navigate(-1)} className="inline-flex items-center px-4 py-2 rounded-md border bg-white hover:bg-gray-50 transition-colors">
            <ArrowLeft className="w-4 h-4 mr-2" /> Volver
          </button>
        </div>
      </div>
    );
  }

  const participantCount = participants?.length || 0;

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center px-4 py-2 text-sm font-medium border rounded-lg bg-white hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 shadow-sm"
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Volver
          </button>
          <div className="text-right">
            <h1 className="text-2xl xl:text-3xl font-bold text-gray-900 mb-1">
              {roulette?.name || `Ruleta #${roulette?.id}`}
            </h1>
            <div className="flex items-center gap-6 text-sm text-gray-600 justify-end">
              <span className="inline-flex items-center bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-medium">
                <Users className="w-4 h-4 mr-1" />
                {participantCount} participantes
              </span>
              {roulette?.scheduled_date && (
                <span className="inline-flex items-center text-gray-600">
                  <Calendar className="w-4 h-4 mr-1" />
                  {fmt(roulette.scheduled_date)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Grid principal */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
          {/* Col 1 */}
          <div className="lg:col-span-4 xl:col-span-3 space-y-6">
            {/* Resultado */}
            <div className="bg-white border rounded-2xl shadow-sm p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <Award className="h-6 w-6 text-amber-600" />
                </div>
                <h4 className="text-xl font-bold text-gray-900">Resultado</h4>
              </div>

              {phase === "idle" && (
                <div className="text-center py-4">
                  <div className="text-gray-500 text-sm">Presiona "Iniciar Sorteo" para comenzar</div>
                </div>
              )}
              {phase === "waitingApi" && (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2" />
                  <div className="text-blue-600 font-medium">Consultando ganador...</div>
                </div>
              )}
              {phase === "spinning" && (
                <div className="text-center py-4">
                  <div className="text-2xl mb-2">🎰</div>
                  <div className="text-purple-600 font-bold text-lg">¡La ruleta está girando!</div>
                </div>
              )}

              {apiError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 mt-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-medium text-red-900 mb-1">Error de API</div>
                      <div className="text-sm text-red-700">{apiError}</div>
                    </div>
                  </div>
                </div>
              )}

              {phase === "done" && winner && (
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="text-3xl mb-2">🎉</div>
                    <div className="text-2xl font-bold text-green-700 mb-2">¡Tenemos ganador!</div>
                  </div>

                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-5">
                    <div className="text-center mb-4">
                      <div className="text-xl font-bold text-green-900 mb-1">
                        {winner?.winner_user?.name || "Participante anónimo"}
                      </div>
                      {winner?.winner_user?.email && (
                        <div className="text-sm text-green-700">{winner.winner_user.email}</div>
                      )}
                    </div>

                    {winner?.prize && (
                      <div className="border-t border-green-200 pt-4">
                        <div className="text-center">
                          <div className="text-lg font-bold text-green-900 mb-2">
                            Premio ganado: {winner.prize.name}
                          </div>
                          {winner.prize.description && (
                            <div
                              className="text-sm text-green-800 leading-relaxed mb-3"
                              dangerouslySetInnerHTML={{ __html: processTextHTML(winner.prize.description) }}
                            />
                          )}
                          {winner.prize.value && (
                            <div className="inline-flex items-center bg-green-200 text-green-900 px-4 py-2 rounded-lg font-bold text-lg">
                              💰 {formatters?.currency ? formatters.currency(winner.prize.value) : winner.prize.value}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {winner?.message && (
                      <div className="text-sm text-green-700 mt-3 italic text-center">
                        {winner.message}
                      </div>
                    )}
                  </div>

                  <div className="text-center">
                    <button
                      onClick={resetSpin}
                      className="inline-flex items-center px-6 py-3 text-sm font-medium text-white bg-gradient-to-r from-emerald-600 to-green-600 rounded-xl hover:from-emerald-700 hover:to-green-700 transition-all duration-200 shadow-lg hover:shadow-xl"
                    >
                      <Trophy className="w-4 h-4 mr-2" />
                      Confirmar resultado
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Descripción + portada ampliable */}
            <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
              {roulette?.cover_image_url && (
                <div className="relative w-full h-52 xl:h-64 bg-gray-100 overflow-hidden">
                  <img
                    src={roulette.cover_image_url}
                    alt={roulette?.name || "Portada"}
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-300 cursor-zoom-in"
                    onClick={() => setLightbox({ src: roulette.cover_image_url, alt: roulette?.name || "Portada" })}
                  />
                  <button
                    onClick={() => setLightbox({ src: roulette.cover_image_url, alt: roulette?.name || "Portada" })}
                    className="absolute bottom-2 right-2 inline-flex items-center bg-black/50 hover:bg-black/70 text-white text-xs px-2 py-1 rounded-md"
                  >
                    <Maximize2 className="w-3.5 h-3.5 mr-1" /> Ampliar
                  </button>
                </div>
              )}
              {roulette?.description && (
                <div className="p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <div className="w-1 h-6 bg-gradient-to-b from-blue-500 to-indigo-500 rounded-full"></div>
                    Descripción
                  </h3>
                  <div
                    className="prose prose-sm max-w-none text-gray-700 leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: processTextHTML(String(roulette.description)) }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Col 2 (rueda) */}
          <div className="lg:col-span-8 xl:col-span-6">
            <div className="bg-white border rounded-2xl shadow-sm p-6 md:p-8">
              <div className="text-center mb-4 md:mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-1">Ruleta de Premios</h2>
                <p className="text-gray-600">Gira la ruleta para descubrir al ganador</p>
              </div>

              <div className="flex flex-col items-center">
                {/* Contenedor de ruleta SIN color de fondo */}
                <div
                  className="relative w-full mx-auto"
                  style={{ aspectRatio: "1 / 1", maxWidth: "740px" }}
                >
                  <div className="absolute inset-0 grid place-items-center">
                    {/* Eliminado glow/gradiente de fondo */}
                    <div className="rounded-full shadow-xl">
                      <Wheel
                        mustStartSpinning={mustStartSpinning}
                        prizeNumber={prizeNumber}
                        data={wheelData}
                        spinDuration={spinDuration}
                        outerBorderColor="#4f46e5"
                        outerBorderWidth={9}
                        radiusLineColor="#ffffff"
                        radiusLineWidth={2}
                        textColors={["#111827"]}
                        backgroundColors={wheelColors}
                        fontSize={16}
                        fontWeight="700"
                        perpendicularText
                        onStopSpinning={handleStop}
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-4 md:mt-5 text-center">
                  <button
                    onClick={startSpin}
                    disabled={!canSpin}
                    className={`inline-flex items-center px-8 py-4 text-lg font-bold rounded-2xl transition-all duration-200 transform ${
                      canSpin
                        ? "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl hover:scale-105 active:scale-95"
                        : "bg-gray-200 text-gray-500 cursor-not-allowed"
                    }`}
                  >
                    <Play className={`h-6 w-6 mr-3 ${phase === "spinning" ? "animate-spin" : ""}`} />
                    {phase === "spinning" ? "Girando..." : "Iniciar Sorteo"}
                  </button>
                </div>

                {!canSpin && phase === "idle" && (
                  <div className="mt-5 space-y-3 max-w-md mx-auto">
                    {(participants?.length || 0) === 0 && (
                      <div className="flex items-center gap-3 text-amber-700 bg-amber-50 px-4 py-3 rounded-xl border border-amber-200">
                        <Users className="h-5 w-5 shrink-0" />
                        <span className="text-sm font-medium">No hay participantes registrados</span>
                      </div>
                    )}
                    {prizes.length === 0 && (
                      <div className="flex items-center gap-3 text-amber-700 bg-amber-50 px-4 py-3 rounded-xl border border-amber-200">
                        <Gift className="h-5 w-5 shrink-0" />
                        <span className="text-sm font-medium">No hay premios configurados</span>
                      </div>
                    )}
                    {roulette?.is_drawn && (
                      <div className="flex items-center gap-3 text-green-700 bg-green-50 px-4 py-3 rounded-xl border border-green-200">
                        <Trophy className="h-5 w-5 shrink-0" />
                        <span className="text-sm font-medium">Esta ruleta ya fue sorteada</span>
                      </div>
                    )}
                    {roulette?.status !== "active" && (
                      <div className="flex items-center gap-3 text-gray-700 bg-gray-50 px-4 py-3 rounded-xl border border-gray-200">
                        <AlertTriangle className="h-5 w-5 shrink-0" />
                        <span className="text-sm font-medium">
                          La ruleta no está activa (Estado: {roulette?.status})
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Col 3 (premios) */}
          <div className="lg:col-span-12 xl:col-span-3">
            <div className="bg-white border rounded-2xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Gift className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <h5 className="text-xl font-bold text-gray-900">Premios</h5>
                    <p className="text-sm text-gray-600">Ordenados por posición</p>
                  </div>
                </div>
                <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-bold">
                  {prizes.length}
                </span>
              </div>

              <div className="overflow-y-auto pr-2 -mr-2 max-h-[calc(100vh-260px)]">
                {prizesLoading ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
                    <span className="text-sm text-gray-500 font-medium">Cargando premios...</span>
                  </div>
                ) : prizes.length === 0 ? (
                  <div className="text-center py-12">
                    <Gift className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                    <div className="text-gray-500 font-medium mb-2">No hay premios configurados</div>
                    <div className="text-sm text-gray-400">
                      Agrega premios para poder realizar el sorteo
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {prizes.map((p, i) => (
                      <PrizeTile
                        key={p.id || i}
                        prize={p}
                        index={i}
                        onOpenImage={(src, alt)=>setLightbox({ src, alt })}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Confetti */}
        {phase === "done" && winner && (
          <div className="pointer-events-none fixed inset-0 overflow-hidden z-50">
            {[...Array(60)].map((_, i) => (
              <div
                key={i}
                className="absolute rounded-full"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `-10px`,
                  width: `${3 + Math.random() * 4}px`,
                  height: `${3 + Math.random() * 4}px`,
                  background: [
                    "#f59e0b", "#10b981", "#3b82f6", "#ef4444",
                    "#a855f7", "#ec4899", "#06b6d4", "#84cc16"
                  ][i % 8],
                  transform: `rotate(${Math.random() * 360}deg)`,
                  animation: `confettiFall ${2 + Math.random() * 3}s linear ${Math.random() * 1}s forwards`,
                }}
              />
            ))}
            <style>{`
              @keyframes confettiFall {
                to {
                  transform: translateY(110vh) rotate(${360 + Math.random() * 360}deg);
                  opacity: 0;
                }
              }
            `}</style>
          </div>
        )}

        {/* Sparkles durante giro */}
        {phase === "spinning" && (
          <div className="pointer-events-none fixed inset-0 overflow-hidden z-40">
            {[...Array(15)].map((_, i) => (
              <div
                key={i}
                className="absolute w-1.5 h-1.5 bg-purple-400 rounded-full opacity-70"
                style={{
                  left: `${30 + Math.random() * 40}%`,
                  top: `${30 + Math.random() * 40}%`,
                  animation: `sparkle ${1 + Math.random() * 1.5}s ease-in-out infinite`,
                  animationDelay: `${Math.random() * 1.5}s`,
                }}
              />
            ))}
            <style>{`
              @keyframes sparkle {
                0%, 100% { transform: scale(0) rotate(0deg); opacity: 0; }
                50% { transform: scale(1.2) rotate(180deg); opacity: 1; }
              }
            `}</style>
          </div>
        )}
      </div>

      {/* Lightbox global */}
      {lightbox?.src && (
        <ImageLightbox
          src={lightbox.src}
          alt={lightbox.alt}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}
