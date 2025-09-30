// src/components/admin/DrawTools.jsx
import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  RotateCcw, Play, Users, Calendar, RefreshCcw, AlertTriangle,
  Gift, Trophy, Package, X, ZoomIn, Medal, Link2, AtSign, Timer, Crown,
} from "lucide-react";
import { roulettesAPI } from "../../config/api";

/* =============================================================================
   Herramientas de Sorteo — Ruleta Premium (SIN auto-serie, manual 1 a 1)
============================================================================= */

const TAU = Math.PI * 2;

/* ---------- Helper compartido: meta de "posición" (1°, 2°, 3°...) ---------- */
const getRankMetaShared = (position) => {
  if (!position || position > 3) {
    return {
      label: `#${position ?? "-"}`,
      badgeClass:
        "inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-bold bg-slate-100 text-slate-700 border-slate-200",
      icon: null,
    };
  }
  const base = "inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-bold";
  if (position === 1)
    return {
      label: "1°",
      icon: <Medal className="w-3.5 h-3.5 text-amber-600" />,
      badgeClass: `${base} bg-amber-50 text-amber-700 border-amber-200`,
    };
  if (position === 2)
    return {
      label: "2°",
      icon: <Medal className="w-3.5 h-3.5 text-slate-500" />,
      badgeClass: `${base} bg-slate-50 text-slate-700 border-slate-200`,
    };
  return {
    label: "3°",
    icon: <Medal className="w-3.5 h-3.5 text-orange-600" />,
    badgeClass: `${base} bg-orange-50 text-orange-700 border-orange-200`,
  };
};

/* ---------- Utilidad de layout (autodimensiona contenedor) ---------- */
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

/* ---------- Transición de giro bi-fase (impulso → desaceleración) ---------- */
const useRouletteTransition = (onTransitionEnd, spinDurationMs) => {
  const wheelRef = useRef(null);
  const phaseTimeoutRef = useRef(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const cleanup = useCallback(() => {
    if (phaseTimeoutRef.current) {
      clearTimeout(phaseTimeoutRef.current);
      phaseTimeoutRef.current = null;
    }
  }, []);

  const startTransition = useCallback(
    (fromAngle, toAngle, opts = { twoPhase: true }) => {
      const wheel = wheelRef.current;
      if (!wheel) return;
      cleanup();

      setIsTransitioning(true);
      wheel.style.transition = "none";
      wheel.style.transform = `rotate(${fromAngle}deg)`;
      // reflow
      // eslint-disable-next-line no-unused-expressions
      wheel.offsetHeight;

      const total = spinDurationMs;
      if (!opts.twoPhase) {
        wheel.style.transition = `transform ${total}ms cubic-bezier(0.08, 0.8, 0.16, 1)`;
        wheel.style.transform = `rotate(${toAngle}deg)`;
        phaseTimeoutRef.current = setTimeout(() => {
          setIsTransitioning(false);
          onTransitionEnd?.();
        }, total + 100);
        return;
      }

      const A_MS = Math.max(300, Math.floor(total * 0.2));
      const B_MS = Math.max(800, total - A_MS);
      const impulseAngle = fromAngle + 720;

      requestAnimationFrame(() => {
        wheel.style.transition = `transform ${A_MS}ms linear`;
        wheel.style.transform = `rotate(${impulseAngle}deg)`;
        phaseTimeoutRef.current = setTimeout(() => {
          wheel.style.transition = `transform ${B_MS}ms cubic-bezier(0.05, 0.85, 0.15, 1)`;
          wheel.style.transform = `rotate(${toAngle}deg)`;
          phaseTimeoutRef.current = setTimeout(() => {
            setIsTransitioning(false);
            onTransitionEnd?.();
          }, B_MS + 120);
        }, A_MS + 40);
      });
    },
    [spinDurationMs, onTransitionEnd, cleanup]
  );

  useEffect(() => {
    const wheel = wheelRef.current;
    if (!wheel) return;
    const handleEnd = (e) => {
      if (e.target === wheel && e.propertyName === "transform") {
        /* safety net */
      }
    };
    wheel.addEventListener("transitionend", handleEnd);
    return () => {
      wheel.removeEventListener("transitionend", handleEnd);
      cleanup();
    };
  }, [cleanup]);

  useEffect(() => () => cleanup(), [cleanup]);

  return { wheelRef, startTransition, isTransitioning };
};

/* ---------- Cálculos de texto y geometría ---------- */
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
  return { x, y };
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

/* ---------- ¿Se puede continuar sorteando? ---------- */
const canContinueDraw = (detail, prizes) => {
  if (!detail) return false;

  const totalUnitsAvailable = (prizes || []).reduce((acc, p) => {
    if (p.is_active === false || p.is_disabled === true) return acc;
    const current = readCurrentUnits(p);
    return acc + Math.max(0, current);
  }, 0);

  return (
    totalUnitsAvailable > 0 &&
    (detail.status === "active" || detail.status === "scheduled") &&
    !detail.is_drawn
  );
};

/* ---------- Linkificador (URLs + emails) ---------- */
const URL_RE = /\b((?:https?:\/\/|www\.)[^\s<]+)/gi;
const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/gi;
const normalizeHref = (raw) => (!raw ? "#" : raw.startsWith("http") ? raw : `https://${raw}`);

const linkifyText = (text) => {
  if (!text) return null;
  let parts = [];
  let lastIdx = 0;

  const emailChunks = (() => {
    let m;
    const chunks = [];
    while ((m = EMAIL_RE.exec(text)) !== null) {
      const [match] = m;
      const start = m.index;
      const end = start + match.length;
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
    const txt = chunk.value;
    let m;
    lastIdx = 0;
    while ((m = URL_RE.exec(txt)) !== null) {
      const [match] = m;
      const start = m.index;
      const end = start + match.length;
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

/* ---------- Utilidades de giro (alinear con puntero) ---------- */
const mod360 = (x) => ((x % 360) + 360) % 360;
const pointerOffsetDegrees = (pointerSide) => (pointerSide === "top" ? -90 : 0);
const rotationForWinnerIndex = (winnerIndex, total, pointerSide) => {
  const segAngle = 360 / total;
  const mid = winnerIndex * segAngle + segAngle / 2;
  const offset = pointerOffsetDegrees(pointerSide);
  return mod360(offset - mid);
};

/** Lectura robusta de UNIDADES actuales */
const readCurrentUnits = (prize) => {
  const candidates = [
    prize?.stock,
    prize?.remaining_stock,
    prize?.quantity,
    prize?.units,
  ];
  const found = candidates.find((v) => typeof v === "number");
  if (typeof found === "number") return Math.max(0, found);
  if (typeof prize?.__initial_stock === "number") {
    if (prize?.is_awarded && prize.__initial_stock <= 1) return 0;
    return prize.__initial_stock;
  }
  return 1;
};

/** Derivados de premio robustos */
const derivePrizeState = (prize) => {
  const initial =
    typeof prize?.__initial_stock === "number"
      ? prize.__initial_stock
      : (typeof prize?.stock === "number"
          ? prize.stock
          : (typeof prize?.remaining_stock === "number"
              ? prize.remaining_stock
              : (typeof prize?.quantity === "number"
                  ? prize.quantity
                  : (typeof prize?.units === "number" ? prize.units : 1))));

  const current = readCurrentUnits(prize);
  const awarded = Math.max(0, (typeof initial === "number" ? initial : 1) - current);

  const exhausted =
    current <= 0 || prize?.is_active === false || prize?.is_disabled === true;

  const status = prize?.status ?? (exhausted ? "sorteado" : "pendiente");
  const low = current > 0 && current <= 2;

  return { initial, current, awarded, exhausted, low, status };
};

const enrichPrize = (rawPrize, prizeList) => {
  if (!rawPrize) return null;
  const local = prizeList.find((p) => String(p.id) === String(rawPrize.id));
  return {
    ...local,
    ...rawPrize,
    image_url: rawPrize.image_url || rawPrize.image || local?.image_url || local?.image || null,
    position:
      rawPrize.display_order ?? rawPrize.position ?? local?.position ?? local?.display_order ?? null,
  };
};

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

  const bannerResolverRef = useRef(null);
  const SPIN_DURATION_MS = 4500;

  const [nowTs, setNowTs] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  
  const pad2 = (n) => String(n).padStart(2, "0");
  const countdown = useMemo(() => {
    if (!detail?.scheduled_date) return null;
    const target = new Date(detail.scheduled_date).getTime();
    const diffMs = target - nowTs;
    const positive = Math.max(diffMs, 0);
    let secs = Math.floor(positive / 1000);
    const days = Math.floor(secs / 86400);
    secs %= 86400;
    const hours = Math.floor(secs / 3600);
    secs %= 3600;
    const minutes = Math.floor(secs / 60);
    const seconds = secs % 60;
    return { diffMs, days, hours, minutes, seconds };
  }, [detail?.scheduled_date, nowTs]);

  const stampInitialStock = useCallback((list) => {
    return (list || []).map((p) => ({
      ...p,
      __initial_stock:
        typeof p.__initial_stock === "number"
          ? p.__initial_stock
          : (typeof p.stock === "number"
              ? p.stock
              : (typeof p.remaining_stock === "number"
                  ? p.remaining_stock
                  : (typeof p.quantity === "number"
                      ? p.quantity
                      : (typeof p.units === "number" ? p.units : 1)))),
    }));
  }, []);

  const loadList = useCallback(async () => {
    try {
      setError("");
      const items = await roulettesAPI
        .getRoulettes()
        .then((r) => (Array.isArray(r) ? r : r.results || []))
        .catch(() => []);

      const activeOnly = items.filter((r) => {
        const status = (r.status || "").toLowerCase();
        return status === "active" || r.is_active === true;
      });

      const sorted = activeOnly.sort((a, b) => {
        const countA = a.participants?.length || 0;
        const countB = b.participants?.length || 0;
        return countB - countA;
      });

      setList(sorted);

      if (!selectedId && sorted.length > 0) {
        setSelectedId(String(sorted[0].id));
      } else if (selectedId) {
        const exists = sorted.some((x) => String(x.id) === String(selectedId));
        if (!exists && sorted.length > 0) setSelectedId(String(sorted[0].id));
        if (!exists && sorted.length === 0) {
          setSelectedId("");
          setDetail(null);
          setPrizes([]);
        }
      }
    } catch (e) {
      setError(`Error cargando sorteos: ${e?.message || "Error desconocido"}`);
      console.error(e);
    }
  }, [selectedId]);

  const loadDetail = useCallback(
    async (id) => {
      if (!id) {
        setDetail(null);
        setPrizes([]);
        return;
      }
      try {
        setError("");
        const [rouletteDetail, prizesData] = await Promise.all([
          roulettesAPI.getRoulette(Number(id)),
          (roulettesAPI.listPrizes
            ? roulettesAPI.listPrizes(Number(id))
            : Promise.resolve({ results: [] })).catch(() => ({ results: [] })),
        ]);
        setDetail(rouletteDetail);

        const incoming = (prizesData?.results || prizesData || []).map((p) => ({
          ...p,
          image_url: p.image_url || p.image || p.photo || p.picture || null,
          position: p.position != null ? p.position : p.display_order != null ? p.display_order : undefined,
        }));

        incoming.sort(
          (a, b) => (a.display_order ?? a.position ?? 0) - (b.display_order ?? b.position ?? 0)
        );

        setPrizes(stampInitialStock(incoming));
      } catch (e) {
        setError(`Error cargando detalle: ${e?.message || "Error desconocido"}`);
        setDetail(null);
        setPrizes([]);
        console.error(e);
      }
    },
    [stampInitialStock]
  );

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        await loadList();
      } finally {
        setLoading(false);
      }
    })();
  }, [loadList]);

  useEffect(() => {
    if (selectedId) loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  const participants = useMemo(() => {
    if (!detail?.participants) return [];
    const ordered = [...detail.participants].sort(
      (a, b) => Number(a.participant_number ?? 0) - Number(b.participant_number ?? 0)
    );
    return ordered.map((p, i) => ({
      id: p.id ?? i + 1,
      num: p.participant_number ?? i + 1,
      name: p.user_name ?? p.name ?? `Participante ${i + 1}`,
      email: p.email || "",
      isWinner: !!p.is_winner,
    }));
  }, [detail]);

  const canDraw = useMemo(() => canContinueDraw(detail, prizes), [detail, prizes]);
  const centerIconKey = (detail?.center_icon || "trophy").toLowerCase();

  const doOneSpin = useCallback(async () => {
    if (!selectedId || participants.length === 0) throw new Error("No hay participantes");
    const res = await roulettesAPI.executeRouletteDraw(Number(selectedId));
    if (!res?.success) throw new Error(res?.message || "No se pudo ejecutar el sorteo");

    const w = res.winner || res.winner_data || {};
    const prizeRaw = res.prize || null;

    let idx = -1;
    if (w.participant_number != null)
      idx = participants.findIndex((p) => String(p.num) === String(w.participant_number));
    if (idx < 0 && w.id != null) idx = participants.findIndex((p) => String(p.id) === String(w.id));
    if (idx < 0 && w.name) idx = participants.findIndex((p) => p.name === w.name);
    if (idx < 0) idx = Math.floor(Math.random() * participants.length);

    const spins = Number(res.total_spins ?? 6);
    const returnedAngle = Number(res.angle ?? 0);
    const pointerSide = "right";
    const currentMod = mod360(rouletteAngle);
    const desiredMod =
      returnedAngle !== 0
        ? mod360(returnedAngle)
        : rotationForWinnerIndex(idx, participants.length, pointerSide);
    let delta = desiredMod - currentMod;
    if (delta <= 0) delta += 360;
    const finalAngle = rouletteAngle + spins * 360 + delta;

    const prize = enrichPrize(prizeRaw, prizes);

    const localWinner = {
      name: w.name || participants[idx]?.name || "Ganador",
      participant: participants[idx],
      prize,
      isLastDraw: false,
    };
    setRouletteWinner(localWinner);

    if (prize?.id != null) {
      setPrizes((prev) =>
        prev.map((p) => {
          if (String(p.id) !== String(prize.id)) return p;

          const before = readCurrentUnits(p);
          const next = Math.max(0, before - 1);

          const patched = { ...p, is_awarded: true };

          if (typeof p.stock === "number") patched.stock = next;
          else if (typeof p.remaining_stock === "number") patched.remaining_stock = next;
          else if (typeof p.quantity === "number") patched.quantity = next;
          else if (typeof p.units === "number") patched.units = next;

          patched.status = next === 0 ? "sorteado" : (p.status && p.status !== "sorteado" ? p.status : "pendiente");

          return patched;
        })
      );
    }

    setRouletteAngle(finalAngle);
    setRouletteSpinning(true);

    await new Promise((resolve) => {
      bannerResolverRef.current = resolve;
    });

    await Promise.all([loadDetail(selectedId), loadList().catch(() => {})]);

    return true;
  }, [selectedId, participants, rouletteAngle, prizes, loadDetail, loadList]);

  const handleRouletteTransitionEnd = useCallback(() => {
    setRouletteSpinning(false);
    setShowWinnerAnimation(true);
  }, []);

  const dismissWinner = useCallback(async () => {
    setShowWinnerAnimation(false);
    setRouletteWinner(null);
    if (typeof bannerResolverRef.current === "function") {
      const r = bannerResolverRef.current;
      bannerResolverRef.current = null;
      r();
    }
    try {
      await Promise.all([loadDetail(selectedId), loadList().catch(() => {})]);
    } catch (_) {}
  }, [selectedId, loadDetail, loadList]);

  const handleSingleDraw = useCallback(async () => {
    if (!selectedId || rouletteSpinning || executing || participants.length === 0 || !canDraw) return;
    setError("");
    setExecuting(true);
    try {
      await doOneSpin();
    } catch (e) {
      console.error(e);
      setError(e?.message || "No se pudo completar el sorteo.");
    } finally {
      setExecuting(false);
    }
  }, [selectedId, rouletteSpinning, executing, participants.length, canDraw, doOneSpin]);

  const [prizeModal, setPrizeModal] = useState({ open: false, prize: null });
  const openPrize = useCallback((prize) => setPrizeModal({ open: true, prize }), []);
  const closePrize = useCallback(() => setPrizeModal({ open: false, prize: null }), []);
  const getPrizeImage = (p) =>
    p?.image_url || p?.image || p?.photo || p?.picture || p?.thumbnail || null;

  const PrizeCard = ({ prize, idx }) => {
    const img = getPrizeImage(prize);
    const pos = prize.position ?? idx + 1;
    const rank = getRankMetaShared(pos);

    const { initial, current, awarded, exhausted, low } = derivePrizeState(prize);

    const stockBadge = (
      <span
        className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border font-semibold ${
          low ? "bg-rose-100 text-rose-700 border-rose-200" : "bg-purple-100 text-purple-700 border-purple-200"
        }`}
        title={`Stock restante: ${current}${typeof initial === "number" ? ` / ${initial}` : ""}`}
      >
        <Package className="w-3 h-3" />
        {current}
        {typeof initial === "number" ? ` / ${initial}` : ""}
      </span>
    );

    const ribbon = (label, cls) => (
      <div className="absolute -left-9 top-4 -rotate-12 z-10">
        <span className={`text-white text-xs font-black tracking-wider px-3 py-1 rounded-md shadow ${cls}`}>
          {label}
        </span>
      </div>
    );

    const isSoldOut = exhausted;
    const isAwardedSome = awarded > 0;
    const sorteadoBadge = !isSoldOut && isAwardedSome && ribbon("SORTEADO", "bg-emerald-600");
    const agotadoBadge = isSoldOut && ribbon("AGOTADO", "bg-slate-700");

    return (
      <div
        className={`group relative p-4 rounded-2xl border transition-all duration-200 cursor-pointer focus-within:ring-2 focus-within:ring-slate-400 ${
          exhausted ? "border-slate-300 bg-slate-50 opacity-80" : "border-slate-200 bg-white hover:shadow-md"
        }`}
        onClick={() => openPrize(prize)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === "Enter" ? openPrize(prize) : null)}
        aria-label={`Ver premio: ${prize.name || "Premio"}`}
        title={prize.name || "Premio"}
      >
        {agotadoBadge || sorteadoBadge}

        <div className="flex items-center gap-4">
          <div
            className={`relative w-20 h-20 rounded-xl overflow-hidden border bg-slate-50 grid place-items-center shrink-0 ${
              exhausted ? "border-slate-300" : "border-slate-200 shadow-sm"
            }`}
          >
            {img ? (
              <>
                <img
                  src={img}
                  alt={prize.name || "Premio"}
                  className={`w-full h-full object-cover transition-transform duration-200 ${
                    exhausted ? "grayscale" : "group-hover:scale-105"
                  }`}
                />
                {!exhausted && (
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <div className="absolute bottom-1.5 right-1.5 bg-white/95 text-slate-800 px-2 py-1 rounded-lg text-[10px] font-semibold flex items-center gap-1 shadow-sm">
                      <ZoomIn className="w-3 h-3" /> Ver
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div
                className={`w-full h-full grid place-items-center ${
                  exhausted
                    ? "bg-gradient-to-br from-slate-200 to-slate-300"
                    : "bg-gradient-to-br from-amber-100 via-amber-200 to-orange-100"
                }`}
              >
                <Gift className={`w-7 h-7 ${exhausted ? "text-slate-400" : "text-amber-700"}`} />
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-3 mb-1">
              <h5 className={`font-semibold truncate text-base ${exhausted ? "text-slate-600" : "text-slate-800"}`}>
                {prize.name || "Premio"}
              </h5>
              <span className={rank.badgeClass} title={`Posición ${pos}`}>
                {rank.icon}
                {rank.label}
              </span>
            </div>

            {prize.description && (
              <p className={`text-xs mt-1.5 line-clamp-2 leading-relaxed ${exhausted ? "text-slate-500" : "text-slate-600"}`}>
                {linkifyText(prize.description)}
              </p>
            )}

            <div className="mt-2.5 flex items-center gap-2 flex-wrap">{stockBadge}</div>
          </div>
        </div>

        {!exhausted && (
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl pointer-events-none" />
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
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
            <p className="text-slate-600">Ejecuta sorteos oficiales con ruleta premium (manual)</p>
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
          <RefreshCcw
            className={`h-5 w-5 transition-transform duration-200 ${loading ? "animate-spin" : "group-hover:rotate-180"}`}
          />
          Refrescar
        </button>
      </div>

      {error && (
        <div className="bg-gradient-to-r from-rose-50 to-red-50 border-2 border-rose-200 text-rose-800 rounded-xl p-4 flex items-start gap-3 shadow-sm">
          <AlertTriangle className="h-5 w-5 mt-0.5" />
          <div>
            <p className="font-semibold">Ocurrió un problema</p>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2 space-y-5">
          <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm">
            <label className="block text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <Crown className="w-4 h-4 text-amber-600" />
              Ruleta a sortear
            </label>

            <div className="relative">
              <Users className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-10" />
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className="w-full pl-10 pr-3 py-3 rounded-xl border-2 border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 appearance-none text-sm font-medium text-slate-800 hover:border-slate-400 transition-colors cursor-pointer"
              >
                <option value="" disabled>
                  Selecciona una ruleta activa
                </option>
                {list.map((r) => {
                  const pCount = r.participants?.length || 0;
                  return (
                    <option key={r.id} value={r.id}>
                      {r.name || `Ruleta ${r.id}`} • {pCount} participante{pCount !== 1 ? 's' : ''}
                    </option>
                  );
                })}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 text-slate-600 text-sm bg-slate-50 px-3 py-2 rounded-lg">
                <Users className="w-4 h-4 text-blue-600" />
                <span className="font-semibold">{detail?.participants?.length ?? 0}</span>
                <span className="text-slate-500">participantes</span>
              </div>
              {detail?.scheduled_date && (
                <div className="flex items-center gap-2 text-slate-600 text-sm bg-slate-50 px-3 py-2 rounded-lg">
                  <Calendar className="w-4 h-4 text-purple-600" />
                  <span className="text-xs">{new Date(detail.scheduled_date).toLocaleDateString("es-ES")}</span>
                </div>
              )}
            </div>

            {detail?.status === "completed" && !canDraw && (
              <div className="mt-3 p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200">
                <div className="flex items-center gap-2 justify-center text-green-800">
                  <Crown className="w-4 h-4" />
                  <span className="font-semibold text-sm">¡Sorteo Completado!</span>
                </div>
                <p className="text-green-700 text-xs text-center mt-1">Se alcanzó el objetivo de ganadores</p>
              </div>
            )}

            {detail?.scheduled_date && (
              <div className="mt-3 flex items-center gap-2 text-slate-600 text-sm bg-amber-50 px-3 py-2 rounded-lg border border-amber-200">
                <Timer className="w-4 h-4 text-amber-600" />
                {countdown?.diffMs > 0 ? (
                  <span className="font-mono">
                    {countdown.days > 0 && <strong className="text-amber-700">{countdown.days}d </strong>}
                    <strong className="text-amber-700">
                      {pad2(countdown.hours)}:{pad2(countdown.minutes)}:{pad2(countdown.seconds)}
                    </strong>
                  </span>
                ) : (
                  <span className="font-semibold text-emerald-700">¡Listo para girar!</span>
                )}
              </div>
            )}

            <div className="mt-5">
              {!canDraw && detail?.status === "completed" ? (
                <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-green-100 text-green-800 font-semibold border border-green-200">
                  <Crown className="w-5 h-5" /> Sorteo Completado
                </div>
              ) : (
                <button
                  onClick={handleSingleDraw}
                  disabled={
                    !selectedId || rouletteSpinning || executing || participants.length === 0 || !canDraw
                  }
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white font-bold shadow-lg disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Play className="w-5 h-5" />
                  {rouletteSpinning || executing ? "Girando..." : "Girar Ruleta"}
                </button>
              )}
            </div>
          </div>

          <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <Gift className="w-5 h-5 text-amber-500" />
              <h4 className="font-bold text-slate-800">Premios del Sorteo</h4>
            </div>
            <p className="text-xs text-slate-500 mb-4">Toca un premio para ver todos sus detalles</p>

            {prizes.length === 0 ? (
              <div className="text-center py-8">
                <Gift className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500">No hay premios configurados</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {prizes.slice(0, 8).map((p, i) => (
                  <PrizeCard key={p.id ?? i} prize={p} idx={i} />
                ))}
                {prizes.length > 8 && (
                  <div className="text-xs text-slate-500 px-2 py-2 bg-slate-50 rounded-lg text-center">
                    y {prizes.length - 8} premio{prizes.length - 8 !== 1 ? 's' : ''} más
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-3 p-0 rounded-2xl border border-slate-200 shadow-inner bg-gradient-to-br from-slate-50 to-blue-50">
          <PremiumRoulette
            participants={participants}
            isSpinning={rouletteSpinning}
            angle={rouletteAngle}
            winner={rouletteWinner}
            showWinnerAnimation={showWinnerAnimation}
            onTransitionEnd={handleRouletteTransitionEnd}
            onDismissWinner={dismissWinner}
            spinDurationMs={SPIN_DURATION_MS}
            pointerSide="right"
            mode="page"
            centerIconKey={centerIconKey}
          />
        </div>
      </div>

      {prizeModal.open && (
        <div
          className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          onClick={closePrize}
        >
          <div
            className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative h-72 sm:h-80 md:h-96 bg-gradient-to-br from-slate-100 to-slate-200 flex-shrink-0">
              {(() => {
                const url = getPrizeImage(prizeModal.prize);
                return url ? (
                  <img
                    src={url}
                    alt={prizeModal.prize?.name || "Premio"}
                    className="absolute inset-0 w-full h-full object-contain p-6"
                  />
                ) : (
                  <div className="absolute inset-0 w-full h-full grid place-items-center">
                    <div className="text-center">
                      <Gift className="w-20 h-20 text-amber-600 mx-auto mb-3" />
                      <p className="text-slate-500 text-sm">Sin imagen</p>
                    </div>
                  </div>
                );
              })()}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

              <div className="absolute top-5 left-5">
                {(() => {
                  const r = getRankMetaShared(prizeModal.prize?.position ?? null);
                  return (
                    <span className={`${r.badgeClass} text-base px-3 py-1.5 bg-white/95 backdrop-blur-sm shadow-lg`}>
                      {r.icon}
                      {r.label}
                    </span>
                  );
                })()}
              </div>

              <button
                className="absolute top-4 right-4 p-2.5 rounded-xl bg-white/95 hover:bg-white shadow-lg transition-all hover:scale-110"
                onClick={closePrize}
                aria-label="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="absolute bottom-5 left-5 right-5">
                <h3 className="text-white text-3xl sm:text-4xl font-extrabold drop-shadow-lg">
                  {prizeModal.prize?.name || "Premio"}
                </h3>
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <div className="flex items-center gap-3 flex-wrap mb-5">
                {(() => {
                  const { initial, current } = derivePrizeState(prizeModal.prize || {});
                  return (
                    <span
                      className={`inline-flex items-center gap-2 text-sm px-4 py-2 rounded-xl border-2 font-bold ${
                        current > 0 && current <= 2
                          ? "bg-rose-50 text-rose-700 border-rose-300"
                          : "bg-purple-50 text-purple-700 border-purple-300"
                      }`}
                      title="Stock restante"
                    >
                      <Package className="w-5 h-5" />
                      <span className="text-base">
                        {current}
                        {typeof initial === "number" ? ` / ${initial}` : ""} unidades
                      </span>
                    </span>
                  );
                })()}
              </div>

              {prizeModal.prize?.description && (
                <div className="prose prose-base max-w-none">
                  <div className="text-slate-700 leading-relaxed text-base">
                    {linkifyText(prizeModal.prize.description)}
                  </div>
                </div>
              )}
            </div>

            <div className="p-5 bg-slate-50 flex justify-end border-t border-slate-200 flex-shrink-0">
              <button
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold shadow-lg hover:shadow-xl transition-all"
                onClick={closePrize}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

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

const CENTER_ICON_MAP = { trophy: Trophy, crown: Crown, gift: Gift, medal: Medal };

const PremiumRoulette = ({
  participants = [],
  isSpinning = false,
  angle = 0,
  winner = null,
  showWinnerAnimation = false,
  onTransitionEnd,
  onDismissWinner,
  spinDurationMs = 4500,
  pointerSide = "right",
  mode = "page",
  centerIconKey = "trophy",
}) => {
  const box = useAutoSize();
  const { wheelRef, startTransition, isTransitioning } = useRouletteTransition(onTransitionEnd, spinDurationMs);
  const [lastAngle, setLastAngle] = useState(0);

  const layout = useMemo(() => {
    const padding = 24;
    const availableW = Math.max(0, box.w - padding * 2);
    const availableH = Math.max(0, box.h - padding * 2);
    if (!availableW || !availableH) return { size: 0, radius: 0, fontSize: 12 };

    const maxSize = Math.min(availableW, availableH);
    const n = Math.max(1, participants.length);
    let baseSize;

    if (mode === "focus") {
      if (n <= 4) baseSize = Math.min(maxSize * 1.01, 700);
      else if (n <= 8) baseSize = Math.min(maxSize * 1.01, 720);
      else if (n <= 16) baseSize = Math.min(maxSize * 1.01, 740);
      else baseSize = Math.min(maxSize * 1.01, 770);
    } else {
      if (n <= 4) baseSize = Math.min(maxSize * 1.0, 585);
      else if (n <= 8) baseSize = Math.min(maxSize * 1.0, 605);
      else if (n <= 16) baseSize = Math.min(maxSize * 1.0, 625);
      else baseSize = Math.min(maxSize * 1.0, 660);
    }

    const size = Math.floor(baseSize);
    const radius = Math.max(mode === "focus" ? 150 : 130, Math.floor(size / 2) - 12);
    const fontSize = calculateOptimalFontSize(n, mode);
    return { size, radius, fontSize };
  }, [box.w, box.h, participants.length, mode]);

  const { size, radius, fontSize } = layout;
  const cx = size / 2;
  const cy = size / 2;

  const segments = useMemo(() => {
    const n = Math.max(participants.length, 1);
    const step = TAU / n;
    if (participants.length === 0) {
      const c = PREMIUM_COLORS[0];
      return [
        { idx: 0, start: 0, end: TAU, mid: TAU / 2, color: c.base, light: c.light, dark: c.dark, label: "—", id: 0, isEmpty: true },
      ];
    }
    return participants.map((p, idx) => {
      const start = idx * step;
      const end = start + step;
      const c = PREMIUM_COLORS[idx % PREMIUM_COLORS.length];
      return {
        idx,
        start,
        end,
        mid: start + step / 2,
        color: c.base,
        light: c.light,
        dark: c.dark,
        label: p.name || `Participante ${idx + 1}`,
        id: p.id || idx + 1,
        participant: p,
        isEmpty: false,
      };
    });
  }, [participants]);

  const createSegmentPath = useCallback(
    (start, end) => {
      const x0 = cx + radius * Math.cos(start);
      const y0 = cy + radius * Math.sin(start);
      const x1 = cx + radius * Math.cos(end);
      const y1 = cy + radius * Math.sin(end);
      const largeArc = end - start > Math.PI ? 1 : 0;
      return `M ${cx} ${cy} L ${x0} ${y0} A ${radius} ${radius} 0 ${largeArc} 1 ${x1} ${y1} Z`;
    },
    [cx, cy, radius]
  );

  const truncate = useCallback((text, maxLen) => {
    if (!text || typeof text !== "string") return "";
    return text.length <= maxLen ? text : text.substring(0, maxLen - 1) + "…";
  }, []);

  const getDisplayText = useCallback(
    (segment, participantCount) => {
      const maxLen = calculateMaxTextLength(participantCount);
      if (participantCount > 100) return "";
      if (participantCount > 50) return `#${segment.idx + 1}`;
      return truncate(segment.label, maxLen);
    },
    [truncate]
  );

  useEffect(() => {
    if (isSpinning && size > 0 && !isTransitioning && angle !== lastAngle) {
      startTransition(lastAngle, angle, { twoPhase: true });
      setLastAngle(angle);
    }
  }, [isSpinning, angle, size, startTransition, lastAngle, isTransitioning]);

  const heights =
    mode === "focus"
      ? "h-[560px] sm:h-[660px] md:h-[720px] lg:h-[740px]"
      : "h-[500px] sm:h-[560px] md:h-[600px] lg:h-[620px]";

  const centerOuterR = Math.max(mode === "focus" ? 28 : 24, radius * 0.155);
  const centerInnerR = Math.max(4, radius * 0.03);
  const iconPx = Math.max(16, Math.floor(centerOuterR * 0.88));
  const CenterIcon = CENTER_ICON_MAP[centerIconKey] || Trophy;

  const idleStyle = !isSpinning ? { animation: "rdpIdlePulse 2800ms ease-in-out infinite" } : undefined;

  return (
    <div className="w-full h-full p-4">
      <style>{`
        @keyframes rdpIdlePulse {
          0%   { transform: scale(1);    filter: drop-shadow(0 4px 12px rgba(15,23,42,0.08)); }
          50%  { transform: scale(1.015);filter: drop-shadow(0 6px 16px rgba(15,23,42,0.12)); }
          100% { transform: scale(1);    filter: drop-shadow(0 4px 12px rgba(15,23,42,0.08)); }
        }
      `}</style>

      <div
        ref={box.ref}
        className={`relative w-full ${heights} rounded-3xl bg-gradient-to-br from-white to-slate-50 border border-slate-200 shadow-xl overflow-hidden grid place-items-center`}
      >
        <div style={idleStyle}>
          <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            className="select-none"
            ref={wheelRef}
            aria-label="Ruleta de participantes"
            style={{ transformOrigin: `${cx}px ${cy}px` }}
          >
            <circle cx={cx} cy={cy} r={radius} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth="6" />

            {segments.map((seg) => {
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

                  <path d={createSegmentPath(seg.start, seg.end)} fill={`url(#g${seg.idx})`} stroke="#ffffff" strokeWidth="3.5" />
                  <circle cx={dotX} cy={dotY} r="4" fill="#ffffff" stroke="rgba(0,0,0,0.1)" strokeWidth="1" />

                  {displayText && (
                    <text
                      x={textPos.x}
                      y={textPos.y}
                      fontSize={fontSize}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="#ffffff"
                      style={{ paintOrder: "stroke", stroke: "rgba(15,23,42,0.85)", strokeWidth: participants.length > 50 ? 2 : 3 }}
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

        <div
          className="pointer-events-none absolute z-20"
          style={{ left: `${(box.w / 2) + radius + 8}px`, top: `${box.h / 2}px`, transform: "translate(-50%, -50%)" }}
          aria-hidden="true"
        >
          <div className="relative">
            <div className="w-8 h-8 rounded-full bg-black shadow-xl border-2 border-white" />
            <div className="absolute top-1/2 -left-6 -translate-y-1/2 w-0 h-0 border-t-[12px] border-b-[12px] border-r-[24px] border-t-transparent border-b-transparent border-r-black drop-shadow-lg" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white" />
          </div>
        </div>

        {showWinnerAnimation && winner && (
          <div className="absolute inset-x-0 bottom-6 z-50 flex flex-col items-center px-4">
            <div className="w-full max-w-lg px-6 py-4 rounded-2xl bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 border-2 border-amber-300 shadow-2xl flex flex-col items-center gap-3">
              <div className="flex items-center gap-3">
                <Trophy className="w-7 h-7 text-amber-600 animate-pulse" />
                <span className="text-amber-900 font-extrabold text-xl md:text-2xl tracking-wide text-center">
                  ¡FELICIDADES {typeof winner === "string" ? winner : winner.name}!
                </span>
                <Trophy className="w-7 h-7 text-amber-600 animate-pulse" />
              </div>

              {typeof winner === "object" && winner.prize && (
                <div className="text-center w-full">
                  <div className="flex items-center justify-center gap-3 mb-2 bg-white/60 rounded-xl px-4 py-3 border border-amber-200">
                    {winner.prize.image_url ? (
                      <img
                        src={winner.prize.image_url}
                        alt={winner.prize.name || "Premio"}
                        className="w-12 h-12 rounded-lg object-cover border-2 border-amber-400 shadow-md"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-amber-200 to-orange-300 grid place-items-center">
                        <Gift className="w-6 h-6 text-amber-800" />
                      </div>
                    )}
                    <div className="text-left">
                      <span className="text-emerald-800 font-bold text-lg block">{winner.prize.name}</span>
                      {winner.prize.position != null && (
                        <span className={`${getRankMetaShared(winner.prize.position).badgeClass} mt-1`}>
                          {getRankMetaShared(winner.prize.position).icon}
                          {getRankMetaShared(winner.prize.position).label}
                        </span>
                      )}
                    </div>
                  </div>
                  {winner.prize.description && (
                    <p className="text-slate-700 text-sm max-w-md px-2 line-clamp-2">{winner.prize.description}</p>
                  )}
                </div>
              )}

              <div className="flex items-center justify-center gap-2 mt-2">
                <button
                  type="button"
                  onClick={onDismissWinner}
                  className="pointer-events-auto inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-black text-white text-sm font-bold shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95"
                  aria-label="Cerrar mensaje de ganador"
                >
                  <X className="w-4 h-4" />
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DrawTools;