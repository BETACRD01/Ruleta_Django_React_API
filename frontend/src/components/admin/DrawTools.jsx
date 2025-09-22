// src/components/admin/DrawTools.jsx
import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  RotateCcw, Play, Users, Calendar, RefreshCcw, Award, AlertTriangle,
  Gift, Trophy, Target, Package, X, ZoomIn, Medal, Link2, AtSign, Timer, Crown
} from "lucide-react";
import { roulettesAPI, notificationAPI } from "../../config/api";

/* =============================================================================
   PARTE A — PANEL / LÓGICA DE NEGOCIO
============================================================================= */

const TAU = Math.PI * 2;

/* ---------- Utilidad de layout ---------- */
const useAutoSize = () => {
  const ref = useRef(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    if (!ref.current) return;
    const updateSize = () => {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      setSize({ w: rect.width, h: rect.height });
    };
    const ro = new ResizeObserver(() => requestAnimationFrame(updateSize));
    ro.observe(ref.current);
    updateSize();
    return () => ro.disconnect();
  }, []);
  return { ref, w: size.w, h: size.h };
};

/* ---------- Transición de giro ---------- */
const useRouletteTransition = (onTransitionEnd, spinDurationMs) => {
  const wheelRef = useRef(null);
  const transitionTimeoutRef = useRef(null);

  const startTransition = useCallback((fromAngle, toAngle) => {
    const wheel = wheelRef.current;
    if (!wheel) return;

    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
      transitionTimeoutRef.current = null;
    }

    wheel.style.transform = `rotate(${fromAngle}deg)`;
    wheel.style.transition = "none";

    requestAnimationFrame(() => {
      if (!wheel) return;
      // Easing tipo "ease-out" más físico
      wheel.style.transition = `transform ${spinDurationMs}ms cubic-bezier(.12,.58,.21,.99)`;
      wheel.style.transform = `rotate(${toAngle}deg)`;
      transitionTimeoutRef.current = setTimeout(() => {
        onTransitionEnd?.();
      }, spinDurationMs + 200);
    });
  }, [spinDurationMs, onTransitionEnd]);

  useEffect(() => {
    const wheel = wheelRef.current;
    if (!wheel) return;
    const handleEnd = (e) => {
      if (e.target === wheel && e.propertyName === "transform") {
        if (transitionTimeoutRef.current) {
          clearTimeout(transitionTimeoutRef.current);
          transitionTimeoutRef.current = null;
        }
        onTransitionEnd?.();
      }
    };
    wheel.addEventListener("transitionend", handleEnd);
    return () => {
      wheel.removeEventListener("transitionend", handleEnd);
      if (transitionTimeoutRef.current) clearTimeout(transitionTimeoutRef.current);
    };
  }, [onTransitionEnd]);

  useEffect(() => () => {
    if (transitionTimeoutRef.current) clearTimeout(transitionTimeoutRef.current);
  }, []);

  return { wheelRef, startTransition };
};

/* ---------- Cálculo de ángulo objetivo ---------- */
const useRouletteCalculations = () => {
  const getSegmentAngleRange = useCallback((index, totalSegments) => {
    const segmentSize = 360 / totalSegments;
    const startAngle = index * segmentSize;
    const endAngle = startAngle + segmentSize;
    const centerAngle = startAngle + (segmentSize / 2);
    return { start: startAngle, end: endAngle, center: centerAngle, size: segmentSize };
  }, []);

  const calculateTargetAngle = useCallback(
    (winnerIndex, totalSegments, baseAngle = 0, extraSpins = 7, pointerAngle = 0) => {
      const seg = getSegmentAngleRange(winnerIndex, totalSegments);
      const targetRotation = pointerAngle - seg.center;

      const normalize = (x) => ((x % 360) + 360) % 360;
      const normalizedTarget = normalize(targetRotation);
      const currentNormalized = normalize(baseAngle);

      let finalAngle = normalizedTarget;
      if (normalizedTarget < currentNormalized) finalAngle += 360;

      finalAngle += (extraSpins * 360);
      return { targetAngle: finalAngle, segmentInfo: seg, totalRotation: finalAngle - baseAngle };
    },
    [getSegmentAngleRange]
  );

  return { calculateTargetAngle };
};

/* ---------- Funciones de posicionamiento de texto mejoradas ---------- */
const calculateTextPosition = (segmentMidAngle, radius, participantCount, cx, cy) => {
  let textRadiusFactor;
  if (participantCount <= 4) textRadiusFactor = 0.82;
  else if (participantCount <= 8) textRadiusFactor = 0.78;
  else if (participantCount <= 16) textRadiusFactor = 0.75;
  else if (participantCount <= 24) textRadiusFactor = 0.72;
  else if (participantCount <= 50) textRadiusFactor = 0.68;
  else textRadiusFactor = 0.65;

  const textRadius = radius * textRadiusFactor;
  const x = cx + textRadius * Math.cos(segmentMidAngle);
  const y = cy + textRadius * Math.sin(segmentMidAngle);

  return { x, y, textRadius, textRadiusFactor };
};

const calculateTextRotation = (segmentMidAngle) => {
  let rotationDegrees = (segmentMidAngle * 180) / Math.PI;
  if (rotationDegrees > 90 && rotationDegrees < 270) rotationDegrees += 180;
  return rotationDegrees;
};

const calculateOptimalFontSize = (participantCount, mode) => {
  let fontSize;
  if (participantCount <= 6) fontSize = mode === "focus" ? 18 : 16;
  else if (participantCount <= 10) fontSize = mode === "focus" ? 16 : 14;
  else if (participantCount <= 15) fontSize = 12 + (mode === "focus" ? 1 : 0);
  else if (participantCount <= 25) fontSize = 11 + (mode === "focus" ? 1 : 0);
  else if (participantCount <= 50) fontSize = 9 + (mode === "focus" ? 1 : 0);
  else fontSize = 8 + (mode === "focus" ? 1 : 0);
  return fontSize;
};

const calculateMaxTextLength = (participantCount) => {
  if (participantCount <= 4) return 20;
  if (participantCount <= 8) return 16;
  if (participantCount <= 12) return 14;
  if (participantCount <= 20) return 12;
  if (participantCount <= 30) return 10;
  if (participantCount <= 50) return 8;
  if (participantCount <= 80) return 6;
  return 4;
};

/* ---------- Helpers (linkificar) ---------- */
const URL_RE = /\b((?:https?:\/\/|www\.)[^\s<]+)/gi;
const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/gi;
const normalizeHref = (raw) => (!raw ? "#" : (raw.startsWith("http") ? raw : `https://${raw}`));

const linkifyText = (text) => {
  if (!text) return null;
  let parts = [];
  let lastIdx = 0;

  const emailChunks = (() => {
    let m; const chunks = [];
    while ((m = EMAIL_RE.exec(text)) !== null) {
      const [match] = m; const start = m.index; const end = start + match.length;
      if (lastIdx < start) chunks.push({ type: "text", value: text.slice(lastIdx, start) });
      chunks.push({ type: "email", value: match });
      lastIdx = end;
    }
    if (lastIdx < text.length) chunks.push({ type: "text", value: text.slice(lastIdx) });
    lastIdx = 0;
    return chunks;
  })();

  emailChunks.forEach((chunk, i) => {
    if (chunk.type !== "text") {
      parts.push(
        <a
          key={`e-${i}`}
          href={`mailto:${chunk.value}`}
          className="inline-flex items-center gap-1 text-blue-700 hover:underline break-words"
        >
          <AtSign className="w-3 h-3" />
          {chunk.value}
        </a>
      );
      return;
    }
    const txt = chunk.value; let m; lastIdx = 0;
    while ((m = URL_RE.exec(txt)) !== null) {
      const [match] = m; const start = m.index; const end = start + match.length;
      if (lastIdx < start) parts.push(txt.slice(lastIdx, start));
      parts.push(
        <a
          key={`u-${i}-${start}`}
          href={normalizeHref(match)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-blue-700 hover:underline break-words"
        >
          <Link2 className="w-3 h-3" />
          {match}
        </a>
      );
      lastIdx = end;
    }
    if (lastIdx < txt.length) parts.push(txt.slice(lastIdx));
  });
  return <>{parts}</>;
};

/* ---------- UI del Panel ---------- */
const DrawTools = ({ onRefresh }) => {
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState("");
  const [list, setList] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState(null);
  const [prizes, setPrizes] = useState([]);

  const [rouletteAngle, setRouletteAngle] = useState(0);
  const [rouletteSpinning, setRouletteSpinning] = useState(false);
  const [rouletteWinner, setRouletteWinner] = useState(null);
  const [showWinnerAnimation, setShowWinnerAnimation] = useState(false);

  const [prizeModal, setPrizeModal] = useState({ open: false, prize: null });

  const SPIN_DURATION_MS = 4500;
  const { calculateTargetAngle } = useRouletteCalculations();

  // Cronómetro
  const [nowTs, setNowTs] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const pad2 = (n) => String(n).padStart(2, "0");
  const countdown = useMemo(() => {
    if (!detail?.scheduled_date) return null;
    const target = new Date(detail.scheduled_date).getTime();
    const diffMs = target - nowTs; const positive = Math.max(diffMs, 0);
    let secs = Math.floor(positive / 1000);
    const days = Math.floor(secs / 86400); secs %= 86400;
    const hours = Math.floor(secs / 3600); secs %= 3600;
    const minutes = Math.floor(secs / 60); const seconds = secs % 60;
    return { diffMs, days, hours, minutes, seconds };
  }, [detail?.scheduled_date, nowTs]);

  // Datos
  const loadList = useCallback(async () => {
    try {
      setError("");
      const items = await roulettesAPI
        .getRoulettes()
        .then(r => Array.isArray(r) ? r : (r.results || []))
        .catch(() => []);
      setList(items);
      if (!selectedId && items.length > 0) setSelectedId(String(items[0].id));
      else if (selectedId) {
        const exists = items.some(x => String(x.id) === String(selectedId));
        if (!exists && items.length > 0) setSelectedId(String(items[0].id));
        if (!exists && items.length === 0) { setSelectedId(""); setDetail(null); setPrizes([]); }
      }
    } catch (e) {
      setError(`Error cargando sorteos: ${e?.message || "Error desconocido"}`);
      console.error(e);
    }
  }, [selectedId]);

  const loadDetail = useCallback(async (id) => {
    if (!id) { setDetail(null); setPrizes([]); return; }
    try {
      setError("");
      const [rouletteDetail, prizesData] = await Promise.all([
        roulettesAPI.getRoulette(Number(id)),
        (roulettesAPI.listPrizes ? roulettesAPI.listPrizes(Number(id)) : Promise.resolve({ results: [] }))
          .catch(() => ({ results: [] })),
      ]);
      setDetail(rouletteDetail);
      setPrizes(prizesData?.results || prizesData || []);
    } catch (e) {
      setError(`Error cargando detalle: ${e?.message || "Error desconocido"}`);
      setDetail(null); setPrizes([]);
      console.error(e);
    }
  }, []);

  useEffect(() => { (async () => { setLoading(true); try { await loadList(); } finally { setLoading(false); } })(); }, [loadList]);
  useEffect(() => { if (selectedId) loadDetail(selectedId); }, [selectedId, loadDetail]);

  const participants = useMemo(() => {
    if (!detail?.participants) return [];
    return detail.participants.map((p, i) => ({
      id: p.id ?? i + 1,
      num: p.participant_number ?? (i + 1),
      name: p.user_name ?? `Participante ${i + 1}`,
      email: p.email || "",
      isWinner: !!p.is_winner,
    }));
  }, [detail]);

  // Ícono del centro
  const centerIconKey = (detail?.center_icon || "trophy").toLowerCase();

  const executeDraw = useCallback(async () => {
    if (!selectedId || participants.length === 0 || rouletteSpinning || executing) return;
    try {
      setExecuting(true);
      setShowWinnerAnimation(false);
      setRouletteWinner(null);

      const res = await roulettesAPI.executeRouletteDraw(Number(selectedId));
      const payloadWinner = res?.winner || res;

      const winnerId = payloadWinner?.participant_id ?? payloadWinner?.id ?? null;
      const winnerName = payloadWinner?.participant_name ?? payloadWinner?.name ?? payloadWinner?.user_name ?? null;

      let idx = -1;
      if (winnerId != null) idx = participants.findIndex(p => String(p.id) === String(winnerId));
      if (idx < 0 && winnerName) idx = participants.findIndex(p => p.name === winnerName);
      if (idx < 0 && payloadWinner?.participant_number != null)
        idx = participants.findIndex(p => String(p.num) === String(payloadWinner.participant_number));
      if (idx < 0) idx = Math.floor(Math.random() * participants.length);

      // puntero en 0°
      const { targetAngle } = calculateTargetAngle(idx, participants.length, rouletteAngle, 7);
      setRouletteAngle(targetAngle);
      setRouletteSpinning(true);

      // Siguiente premio disponible (ORDEN DESCENDENTE: 3° → 2° → 1°)
      const availablePrizes = prizes
        .filter(p => !p.is_awarded)
        .sort((a, b) => (b.position || 0) - (a.position || 0));

      const currentPrize = availablePrizes.length > 0 ? availablePrizes[0] : null;

      setRouletteWinner({
        name: winnerName || participants[idx]?.name || "Ganador",
        participant: participants[idx],
        prize: currentPrize,
        isLastDraw: availablePrizes.length === 1
      });
    } catch (e) {
      console.error(e);
      setError(`No se pudo ejecutar el sorteo: ${e?.message || "Error desconocido"}`);
    } finally {
      setExecuting(false);
    }
  }, [selectedId, participants, rouletteSpinning, executing, calculateTargetAngle, rouletteAngle, prizes]);

  const handleRouletteTransitionEnd = useCallback(async () => {
    setRouletteSpinning(false);
    setShowWinnerAnimation(true);

    if (rouletteWinner && typeof rouletteWinner === 'object' && rouletteWinner.participant) {
      try {
        if (rouletteWinner.prize?.id) {
          await roulettesAPI.patchPrize(
            Number(selectedId),
            rouletteWinner.prize.id,
            { is_awarded: true, awarded_to: rouletteWinner.participant.id }
          );
        }

        if (notificationAPI) {
          await notificationAPI.createWinnerAnnouncement({
            roulette_id: Number(selectedId),
            winner_name: rouletteWinner.name,
            winner_id: rouletteWinner.participant.id,
            prize_name: rouletteWinner.prize?.name || "Premio especial",
            prize_id: rouletteWinner.prize?.id || null,
            is_final_draw: rouletteWinner.isLastDraw
          });
        }

        if (rouletteWinner.isLastDraw) {
          await roulettesAPI.patchRoulette(Number(selectedId), {
            status: 'completed',
            completed_at: new Date().toISOString()
          });
        }
      } catch (error) {
        console.error("Error procesando ganador:", error);
        setError("Ganador seleccionado, pero hubo un error al procesar el premio");
      }
    }

    if (selectedId) loadDetail(selectedId);

    // La ruleta ya NO se agranda ni muestra overlay; solo mensaje breve
    // El banner de ganador se oculta solo tras unos segundos (CSS/estado local)
  }, [selectedId, loadDetail, rouletteWinner]);

  const openPrize = useCallback((prize) => setPrizeModal({ open: true, prize }), []);
  const closePrize = useCallback(() => setPrizeModal({ open: false, prize: null }), []);
  const getPrizeImage = (p) => p?.image_url || p?.image || p?.photo || p?.picture || p?.thumbnail || null;

  const getRankMeta = (position) => {
    if (!position || position > 3) return { label: `#${position ?? "-"}`, badgeClass: "bg-slate-100 text-slate-700 border-slate-200", icon: null };
    const base = "inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-bold";
    if (position === 1) return { label: "1°", icon: <Medal className="w-3.5 h-3.5 text-amber-600" />, badgeClass: `${base} bg-amber-50 text-amber-700 border-amber-200` };
    if (position === 2) return { label: "2°", icon: <Medal className="w-3.5 h-3.5 text-slate-500" />, badgeClass: `${base} bg-slate-50 text-slate-700 border-slate-200` };
    return { label: "3°", icon: <Medal className="w-3.5 h-3.5 text-orange-600" />, badgeClass: `${base} bg-orange-50 text-orange-700 border-orange-200` };
  };

  const PrizeCard = ({ prize, idx }) => {
    const probability = prize.probability ?? prize.weight ?? null;
    const img = getPrizeImage(prize);
    const pos = prize.position ?? (idx + 1);
    const rank = getRankMeta(pos);
    const isAwarded = prize.is_awarded;

    return (
      <div
        className={`group relative p-4 rounded-2xl border transition-all duration-200 cursor-pointer focus-within:ring-2 focus-within:ring-slate-400 ${
          isAwarded
            ? 'border-slate-300 bg-slate-50 opacity-75'
            : 'border-slate-200 bg-white hover:shadow-md'
        }`}
        onClick={() => openPrize(prize)}
        role="button" tabIndex={0}
        onKeyDown={(e) => (e.key === "Enter" ? openPrize(prize) : null)}
        aria-label={`Ver premio: ${prize.name || "Premio"}`}
      >
        {isAwarded && (
          <div className="absolute top-2 right-2 z-10">
            <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full border border-green-200 font-semibold">
              <Trophy className="w-3 h-3" />
              Otorgado
            </span>
          </div>
        )}

        <div className="flex items-center gap-4">
          <div className={`relative w-16 h-16 rounded-xl overflow-hidden border bg-slate-50 grid place-items-center shrink-0 ${
            isAwarded ? 'border-slate-300' : 'border-slate-200'
          }`}>
            {img ? (
              <>
                <img
                  src={img}
                  alt={prize.name || "Premio"}
                  className={`w-full h-full object-cover ${isAwarded ? 'grayscale' : ''}`}
                />
                {!isAwarded && (
                  <div className="absolute bottom-1 right-1 bg-black/55 text-white px-1.5 py-0.5 rounded-md text-[10px] flex items-center gap-1">
                    <ZoomIn className="w-3 h-3" /> Ver
                  </div>
                )}
              </>
            ) : (
              <div className={`w-full h-full grid place-items-center text-amber-700 ${
                isAwarded
                  ? 'bg-gradient-to-br from-slate-200 to-slate-300'
                  : 'bg-gradient-to-br from-amber-100 to-amber-200'
              }`}>
                <Gift className="w-6 h-6" />
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-3">
              <h5 className={`font-semibold truncate ${
                isAwarded ? 'text-slate-600' : 'text-slate-800'
              }`}>
                {prize.name || "Premio"}
              </h5>
              <span className={rank.badgeClass} title={`Posición ${pos}`}>
                {rank.icon}{rank.label}
              </span>
            </div>

            {prize.description && (
              <p className={`text-xs mt-1 line-clamp-2 break-words ${
                isAwarded ? 'text-slate-500' : 'text-slate-600'
              }`}>
                {linkifyText(prize.description)}
              </p>
            )}

            <div className="mt-2 flex items-center gap-2 flex-wrap">
              {probability != null && (
                <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border font-semibold ${
                  isAwarded
                    ? 'bg-slate-100 text-slate-600 border-slate-200'
                    : 'bg-emerald-100 text-emerald-700 border-emerald-200'
                }`}>
                  <Target className="w-3 h-3" /> {probability}%
                </span>
              )}
              {prize.quantity != null && (
                <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border font-semibold ${
                  isAwarded
                    ? 'bg-slate-100 text-slate-600 border-slate-200'
                    : 'bg-purple-100 text-purple-700 border-purple-200'
                }`}>
                  <Package className="w-3 h-3" /> {prize.quantity}
                </span>
              )}
            </div>
          </div>
        </div>

        {!isAwarded && (
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl pointer-events-none" />
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="p-3 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 text-white shadow-lg">
              <RotateCcw className="h-6 w-6" />
            </div>
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full animate-pulse" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-1">Herramientas de Sorteo</h2>
            <p className="text-slate-600">Ejecuta sorteos oficiales con ruleta premium</p>
          </div>
        </div>
        <button
          onClick={async () => {
            setLoading(true);
            await Promise.all([loadList(), selectedId ? loadDetail(selectedId) : Promise.resolve()]);
            setLoading(false);
            onRefresh?.();
          }}
          className="group inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl border-2 border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 transition-all duration-200 shadow-sm hover:shadow-md"
          disabled={loading}
        >
          <RefreshCcw className={`h-5 w-5 transition-transform duration-200 ${loading ? "animate-spin" : "group-hover:rotate-180"}`} />
          Refrescar
        </button>
      </div>

      {error && (
        <div className="bg-gradient-to-r from-rose-50 to-red-50 border-2 border-rose-200 text-rose-800 rounded-xl p-4 flex items-start gap-3 shadow-sm">
          <AlertTriangle className="h-5 w-5 mt-0.5" />
          <div><p className="font-semibold">Ocurrió un problema</p><p className="text-sm">{error}</p></div>
        </div>
      )}

      {/* Selector + info */}
      <div className="grid lg:grid-cols-5 gap-6">
        {/* Lado izquierdo */}
        <div className="lg:col-span-2 space-y-5">
          <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm">
            <label className="block text-sm font-semibold text-slate-700 mb-2">Ruleta a sortear</label>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-slate-400"
            >
              <option value="" disabled>Selecciona una ruleta</option>
              {list.map(r => (<option key={r.id} value={r.id}>#{r.id} — {r.name}</option>))}
            </select>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 text-slate-600 text-sm">
                <Users className="w-4 h-4" />
                <span>{detail?.participants?.length ?? 0} participantes</span>
              </div>
              {detail?.scheduled_date && (
                <div className="flex items-center gap-2 text-slate-600 text-sm">
                  <Calendar className="w-4 h-4" />
                  <span>{new Date(detail.scheduled_date).toLocaleString("es-ES")}</span>
                </div>
              )}
            </div>

            {/* Estado de premios */}
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 text-slate-600 text-sm">
                <Award className="w-4 h-4" />
                <span>
                  {prizes.filter(p => !p.is_awarded).length} premios disponibles
                </span>
              </div>
              <div className="flex items-center gap-2 text-slate-600 text-sm">
                <Trophy className="w-4 h-4" />
                <span>
                  {prizes.filter(p => p.is_awarded).length} ya otorgados
                </span>
              </div>
            </div>

            {/* Estado del sorteo */}
            {detail?.status === 'completed' && (
              <div className="mt-3 p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200">
                <div className="flex items-center gap-2 justify-center text-green-800">
                  <Crown className="w-4 h-4" />
                  <span className="font-semibold text-sm">¡Sorteo Completado!</span>
                </div>
                <p className="text-green-700 text-xs text-center mt-1">
                  Todos los premios han sido otorgados exitosamente
                </p>
              </div>
            )}

            {detail?.scheduled_date && (
              <div className="mt-2 flex items-center gap-2 text-slate-600 text-sm">
                <Timer className="w-4 h-4" />
                {countdown?.diffMs > 0 ? (
                  <span>Faltan {countdown.days > 0 && <strong>{countdown.days}d </strong>}
                    <strong>{pad2(countdown.hours)}:{pad2(countdown.minutes)}:{pad2(countdown.seconds)}</strong>
                  </span>
                ) : (<span className="font-semibold text-emerald-700">¡Listo para girar!</span>)}
              </div>
            )}

            <div className="mt-4">
              {detail?.status === 'completed' ? (
                <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-green-100 text-green-800 font-semibold border border-green-200">
                  <Crown className="w-5 h-5" />
                  Sorteo Completado
                </div>
              ) : (
                <button
                  onClick={executeDraw}
                  disabled={
                    !selectedId ||
                    rouletteSpinning ||
                    executing ||
                    participants.length === 0 ||
                    prizes.filter(p => !p.is_awarded).length === 0
                  }
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
                  title={
                    prizes.filter(p => !p.is_awarded).length === 0
                      ? "No hay premios disponibles para sortear"
                      : undefined
                  }
                >
                  <Play className="w-5 h-5" />
                  {rouletteSpinning
                    ? "Girando..."
                    : prizes.filter(p => !p.is_awarded).length === 0
                    ? "Sin premios disponibles"
                    : "Ejecutar sorteo"}
                </button>
              )}
            </div>
          </div>

          {/* Premios */}
          <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm">
            <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2"><Award className="w-5 h-5 text-amber-500" />Premios configurados</h4>
            {prizes.length === 0 ? (
              <p className="text-sm text-slate-500">No hay premios configurados.</p>
            ) : (
              <div className="grid gap-3">
                {prizes.slice(0, 8).map((p, i) => (<PrizeCard key={p.id ?? i} prize={p} idx={i} />))}
                {prizes.length > 8 && (<div className="text-xs text-slate-500 px-2">y {prizes.length - 8} premios más</div>)}
              </div>
            )}
          </div>
        </div>

        {/* Lado derecho — Ruleta */}
        <div className="lg:col-span-3 p-0 rounded-2xl border border-slate-200 shadow-inner bg-gradient-to-br from-slate-50 to-blue-50">
          <PremiumRoulette
            participants={participants}
            isSpinning={rouletteSpinning}
            angle={rouletteAngle}
            winner={rouletteWinner}
            showWinnerAnimation={showWinnerAnimation}
            onTransitionEnd={handleRouletteTransitionEnd}
            spinDurationMs={SPIN_DURATION_MS}
            pointerSide="right"
            mode="page"
            centerIconKey={centerIconKey}
            rouletteWinner={rouletteWinner}
          />
        </div>
      </div>

      {/* Modal de premio */}
      {prizeModal.open && (
        <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-[1px] flex items-center justify-center p-4" role="dialog" aria-modal="true" onClick={closePrize}>
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <button className="absolute top-3 right-3 p-2 rounded-lg bg-white/80 hover:bg-white shadow" onClick={closePrize} aria-label="Cerrar"><X className="w-5 h-5" /></button>
            <div className="grid md:grid-cols-2">
              <div className="relative bg-slate-50 min-h-[240px]">
                {(() => {
                  const url = getPrizeImage(prizeModal.prize);
                  return url ? (
                    <img src={url} alt={prizeModal.prize?.name || "Premio"} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full grid place-items-center text-amber-600"><Gift className="w-12 h-12" /></div>
                  );
                })()}
              </div>
              <div className="p-5">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-xl font-bold text-slate-900">{prizeModal.prize?.name || "Premio"}</h3>
                  <span className={`${getRankMeta(prizeModal.prize?.position ?? 0).badgeClass}`}>
                    {getRankMeta(prizeModal.prize?.position ?? 0).icon}
                    {getRankMeta(prizeModal.prize?.position ?? 0).label}
                  </span>
                </div>
                {prizeModal.prize?.description && (
                  <div className="text-slate-700 mt-3 leading-relaxed prose prose-sm max-w-none">
                    {linkifyText(prizeModal.prize.description)}
                  </div>
                )}
                <div className="mt-4 flex items-center gap-2 flex-wrap">
                  {(prizeModal.prize?.probability ?? prizeModal.prize?.weight) != null && (
                    <span className="inline-flex items-center gap-1 text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full border border-emerald-200 font-semibold">
                      <Target className="w-3 h-3" />{(prizeModal.prize?.probability ?? prizeModal.prize?.weight)}%
                    </span>
                  )}
                  {prizeModal.prize?.quantity != null && (
                    <span className="inline-flex items-center gap-1 text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full border border-purple-200 font-semibold">
                      <Package className="w-3 h-3" />{prizeModal.prize.quantity}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="p-4 bg-slate-50 flex justify-end">
              <button className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-semibold shadow" onClick={closePrize}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* =============================================================================
   PARTE B — PREMIUM ROULETTE (rueda) CON POSICIONAMIENTO MEJORADO
============================================================================= */

const PREMIUM_COLORS = [
  { base: "#3b82f6", light: "#60a5fa", dark: "#2563eb" },
  { base: "#06b6d4", light: "#22d3ee", dark: "#0891b2" },
  { base: "#8b5cf6", light: "#a78bfa", dark: "#7c3aed" },
  { base: "#ec4899", light: "#f472b6", dark: "#db2777" },
  { base: "#10b981", light: "#34d399", dark: "#059669" },
  { base: "#f59e0b", light: "#fbbf24", dark: "#d97706" },
  { base: "#ef4444", light: "#f87171", dark: "#dc2626" },
  { base: "#6366f1", light: "#818cf8", dark: "#4f46e5" },
];

// Íconos disponibles para el centro
const CENTER_ICON_MAP = { trophy: Trophy, crown: Crown, gift: Gift, medal: Medal };

const PremiumRoulette = ({
  participants = [],
  isSpinning = false,
  angle = 0,
  winner = null,
  showWinnerAnimation = false,
  onTransitionEnd,
  spinDurationMs = 4500,
  pointerSide = "right",
  mode = "page",
  centerIconKey = "trophy",
  rouletteWinner = null,
}) => {
  const box = useAutoSize();
  const { wheelRef, startTransition } = useRouletteTransition(onTransitionEnd, spinDurationMs);
  const [lastAngle, setLastAngle] = useState(0);

  const getRankMeta = (position) => {
    if (!position || position > 3) return { label: `#${position ?? "-"}`, badgeClass: "bg-slate-100 text-slate-700 border-slate-200", icon: null };
    const base = "inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-bold";
    if (position === 1) return { label: "1°", icon: <Medal className="w-3.5 h-3.5 text-amber-600" />, badgeClass: `${base} bg-amber-50 text-amber-700 border-amber-200` };
    if (position === 2) return { label: "2°", icon: <Medal className="w-3.5 h-3.5 text-slate-500" />, badgeClass: `${base} bg-slate-50 text-slate-700 border-slate-200` };
    return { label: "3°", icon: <Medal className="w-3.5 h-3.5 text-orange-600" />, badgeClass: `${base} bg-orange-50 text-orange-700 border-orange-200` };
  };

  // Tamaño dinámico mejorado
  const layout = useMemo(() => {
    const padding = 24;
    const availableW = Math.max(0, box.w - padding * 2);
    const availableH = Math.max(0, box.h - padding * 2);
    if (!availableW || !availableH) return { size: 0, radius: 0, fontSize: 12, textRadius: 0.75 };
    const maxSize = Math.min(availableW, availableH);
    const n = Math.max(1, participants.length);

    let baseSize;
    if (mode === "focus") {
      if (n <= 4) baseSize = Math.min(maxSize * 1.01, 700);
      else if (n <= 8) baseSize = Math.min(maxSize * 1.01, 720);
      else if (n <= 16) baseSize = Math.min(maxSize * 1.01, 740);
      else baseSize = Math.min(maxSize * 1.01, 770);
    } else {
      if (n <= 4) baseSize = Math.min(maxSize * 1.00, 585);
      else if (n <= 8) baseSize = Math.min(maxSize * 1.00, 605);
      else if (n <= 16) baseSize = Math.min(maxSize * 1.00, 625);
      else baseSize = Math.min(maxSize * 1.00, 660);
    }

    const size = Math.floor(baseSize);
    const radius = Math.max(mode === "focus" ? 150 : 130, Math.floor(size / 2) - 12);

    const fontSize = calculateOptimalFontSize(n, mode);
    const textRadius = 0.75;

    return { size, radius, fontSize, textRadius };
  }, [box.w, box.h, participants.length, mode]);

  const { size, radius, fontSize } = layout;
  const cx = size / 2;
  const cy = size / 2;

  const segments = useMemo(() => {
    const n = Math.max(participants.length, 1);
    const step = TAU / n;
    if (participants.length === 0) {
      const c = PREMIUM_COLORS[0];
      return [{
        idx: 0, start: 0, end: TAU, mid: TAU / 2,
        color: c.base, light: c.light, dark: c.dark, label: "—", id: 0, isEmpty: true
      }];
    }
    return participants.map((p, idx) => {
      const start = idx * step;
      const end = start + step;
      const c = PREMIUM_COLORS[idx % PREMIUM_COLORS.length];
      return {
        idx, start, end, mid: start + step / 2,
        color: c.base, light: c.light, dark: c.dark,
        label: p.name || `Participante ${idx + 1}`,
        id: p.id || idx + 1,
        participant: p,
        isEmpty: false
      };
    });
  }, [participants]);

  const createSegmentPath = useCallback((start, end) => {
    const x0 = cx + radius * Math.cos(start);
    const y0 = cy + radius * Math.sin(start);
    const x1 = cx + radius * Math.cos(end);
    const y1 = cy + radius * Math.sin(end);
    const largeArc = end - start > Math.PI ? 1 : 0;
    return `M ${cx} ${cy} L ${x0} ${y0} A ${radius} ${radius} 0 ${largeArc} 1 ${x1} ${y1} Z`;
  }, [cx, cy, radius]);

  const truncate = useCallback((text, maxLen) =>
    (!text || typeof text !== "string") ? "" : (text.length <= maxLen ? text : text.substring(0, maxLen - 1) + "…"), []);

  const getDisplayText = useCallback((segment, participantCount) => {
    const maxLen = calculateMaxTextLength(participantCount);
    if (participantCount > 100) return "";
    if (participantCount > 50) return `#${segment.idx + 1}`;
    return truncate(segment.label, maxLen);
  }, [truncate]);

  useEffect(() => {
    if (isSpinning && size > 0) {
      startTransition(lastAngle, angle);
      setLastAngle(angle);
    }
  }, [isSpinning, angle, size, startTransition, lastAngle]);

  const heights = mode === "focus"
    ? "h-[560px] sm:h-[660px] md:h-[720px] lg:h-[740px]"
    : "h-[500px] sm:h-[560px] md:h-[600px] lg:h-[620px]";

  const pointerPos = useMemo(() => ({
    leftPx: (box.w / 2) + (size / 2) + 4,
    topPx: (box.h / 2)
  }), [box.w, box.h, size]);

  const centerOuterR = Math.max(mode === "focus" ? 28 : 24, radius * 0.155);
  const centerInnerR = Math.max(4, radius * 0.03);
  const iconPx = Math.max(16, Math.floor(centerOuterR * 0.88));
  const CenterIcon = (CENTER_ICON_MAP[centerIconKey] || Trophy);

  const idleStyle = !isSpinning ? { animation: "rdpIdlePulse 2800ms ease-in-out infinite" } : undefined;

  return (
    <div className="w-full h-full p-4">
      <style>{`
        @keyframes rdpIdlePulse {
          0% { transform: scale(1); filter: drop-shadow(0 4px 12px rgba(15,23,42,0.08)); }
          50% { transform: scale(1.015); filter: drop-shadow(0 6px 16px rgba(15,23,42,0.12)); }
          100% { transform: scale(1); filter: drop-shadow(0 4px 12px rgba(15,23,42,0.08)); }
        }
      `}</style>

      <div
        ref={box.ref}
        className={`relative w-full ${heights} rounded-3xl bg-gradient-to-br from-white to-slate-50
                    border border-slate-200 shadow-xl overflow-hidden grid place-items-center`}
      >
        <div style={idleStyle}>
          <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            className="select-none"
            ref={wheelRef}
            aria-label="Ruleta de participantes"
          >
            <circle cx={cx} cy={cy} r={radius} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth="6" />

            {segments.map(seg => {
              const textPos = calculateTextPosition(seg.mid, radius, participants.length, cx, cy);
              const textRotation = calculateTextRotation(seg.mid);
              const displayText = getDisplayText(seg, participants.length);

              const dotRadius = radius + 8;
              const dotX = cx + dotRadius * Math.cos(seg.end);
              const dotY = cy + dotRadius * Math.sin(seg.end);

              return (
                <g key={seg.idx}>
                  <defs>
                    <radialGradient id={`g${seg.idx}`} cx="30%" cy="20%" r="80%">
                      <stop offset="0%" stopColor={seg.light} />
                      <stop offset="75%" stopColor={seg.color} />
                      <stop offset="100%" stopColor={seg.dark} />
                    </radialGradient>
                  </defs>
                  <path
                    d={createSegmentPath(seg.start, seg.end)}
                    fill={`url(#g${seg.idx})`}
                    stroke="#ffffff"
                    strokeWidth="3.5"
                  />
                  <circle
                    cx={dotX}
                    cy={dotY}
                    r="4"
                    fill="#ffffff"
                    stroke="rgba(0,0,0,0.1)"
                    strokeWidth="1"
                  />
                  {displayText && (
                    <text
                      x={textPos.x}
                      y={textPos.y}
                      fontSize={fontSize}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="#ffffff"
                      style={{
                        paintOrder: "stroke",
                        stroke: "rgba(15,23,42,0.85)",
                        strokeWidth: participants.length > 50 ? 2 : 3
                      }}
                      transform={`rotate(${textRotation} ${textPos.x} ${textPos.y})`}
                    >
                      {displayText}
                    </text>
                  )}
                </g>
              );
            })}

            <defs>
              <radialGradient id="centerG" cx="50%" cy="30%" r="70%">
                <stop offset="0%" stopColor="#334155" />
                <stop offset="70%" stopColor="#1f2937" />
                <stop offset="100%" stopColor="#111827" />
              </radialGradient>
            </defs>
            <circle cx={cx} cy={cy} r={centerOuterR} fill="url(#centerG)" stroke="#e5e7eb" strokeWidth="3" />
            <circle cx={cx} cy={cy} r={centerInnerR} fill="#f8fafc" />
          </svg>
        </div>

        <div
          className="pointer-events-none absolute z-10 text-white/95"
          style={{ left: "50%", top: "50%", transform: "translate(-50%, -50%)" }}
          aria-hidden="true"
        >
          <CenterIcon style={{ width: iconPx, height: iconPx }} />
        </div>

        {pointerSide === "right" && (
          <div
            className="pointer-events-none absolute z-20"
            style={{ left: pointerPos.leftPx, top: pointerPos.topPx, transform: "translate(-50%, -50%)" }}
            aria-hidden="true"
          >
            <div className="relative">
              <div className="w-8 h-8 rounded-full bg-black shadow-xl border-2 border-white" />
              <div className="absolute top-1/2 -left-6 -translate-y-1/2 w-0 h-0 border-t-[12px] border-b-[12px] border-r-[24px] border-t-transparent border-b-transparent border-r-black drop-shadow-lg" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white" />
            </div>
          </div>
        )}

        {pointerSide === "top" && (
          <div className="absolute left-1/2 -translate-x-1/2 -top-3 z-20 pointer-events-none" aria-hidden="true">
            <div className="w-0 h-0 border-l-[12px] border-r-[12px] border-b-[24px] border-l-transparent border-r-transparent border-b-black drop-shadow-xl" />
          </div>
        )}

        {showWinnerAnimation && rouletteWinner && (
          <div className="absolute inset-x-0 bottom-6 z-30 flex flex-col items-center pointer-events-none">
            <div className="px-5 py-3 rounded-2xl bg-amber-50 border border-amber-200 shadow-lg flex flex-col items-center gap-3 max-w-md mx-4">
              <div className="flex items-center gap-3">
                <Trophy className="w-6 h-6 text-amber-600" />
                <span className="text-amber-800 font-extrabold text-xl tracking-wide text-center">
                  ¡FELICIDADES {typeof rouletteWinner === 'string' ? rouletteWinner : rouletteWinner.name}!
                </span>
              </div>

              {typeof rouletteWinner === 'object' && rouletteWinner.prize && (
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <Gift className="w-5 h-5 text-emerald-600" />
                    <span className="text-emerald-800 font-bold text-lg">
                      {rouletteWinner.prize.name}
                    </span>
                  </div>
                  {rouletteWinner.prize.description && (
                    <p className="text-slate-700 text-sm max-w-xs">
                      {rouletteWinner.prize.description}
                    </p>
                  )}
                  <div className="mt-2 flex justify-center">
                    <span className={`${getRankMeta(rouletteWinner.prize.position).badgeClass} text-base px-3 py-1`}>
                      {getRankMeta(rouletteWinner.prize.position).icon}
                      {getRankMeta(rouletteWinner.prize.position).label}
                    </span>
                  </div>
                </div>
              )}

              {typeof rouletteWinner === 'object' && rouletteWinner.isLastDraw && (
                <div className="mt-2 px-4 py-2 bg-gradient-to-r from-purple-100 to-pink-100 rounded-xl border border-purple-200">
                  <div className="flex items-center gap-2 justify-center">
                    <Crown className="w-5 h-5 text-purple-600" />
                    <span className="text-purple-800 font-bold text-sm">
                      ¡SORTEO COMPLETADO!
                    </span>
                  </div>
                  <p className="text-purple-700 text-xs text-center mt-1">
                    Todos los premios han sido otorgados
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DrawTools;
