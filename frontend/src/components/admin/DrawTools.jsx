"use client"

// src/components/admin/DrawTools.jsx
import { useEffect, useMemo, useState, useCallback, useRef } from "react"
import {
  Play,
  Users,
  RefreshCcw,
  Award,
  AlertTriangle,
  Gift,
  Package,
  X,
  ZoomIn,
  Medal,
  Link2,
  AtSign,
  Crown,
  Clock,
} from "lucide-react"
import { roulettesAPI } from "../../config/api"
import PremiumRoulette from "./Gestión de Ruletas/PremiumRoulette"

const STORAGE_KEY_SELECTED_ROULETTE = "draw_tools_selected_roulette_id"
const SPIN_DURATION_MS = 4500

/* ============================================================================
   🔧 UTILIDADES - HELPERS GENERALES
============================================================================ */

const mod360 = (x) => ((x % 360) + 360) % 360

const pointerOffsetDegrees = (pointerSide) => (pointerSide === "top" ? -90 : 0)

const rotationForWinnerIndex = (winnerIndex, total, pointerSide) => {
  const segAngle = 360 / total
  const mid = winnerIndex * segAngle + segAngle / 2
  const offset = pointerOffsetDegrees(pointerSide)
  return mod360(offset - mid)
}

const normalizeHref = (raw) => {
  if (!raw) return "#"
  const v = String(raw).trim()
  if (/^https?:\/\//i.test(v)) return v
  if (/^www\./i.test(v)) return `https://${v}`
  return v
}

/* ============================================================================
   🏅 UTILIDADES - RANKING Y POSICIONES
============================================================================ */

const getRankMetaShared = (position) => {
  if (!position || position > 3) {
    return {
      label: `#${position ?? "-"}`,
      badgeClass:
        "inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-bold bg-slate-100 text-slate-700 border-slate-200",
      icon: null,
    }
  }

  const base = "inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-bold"

  if (position === 1) {
    return {
      label: "1°",
      icon: <Medal className="w-3.5 h-3.5 text-amber-600" />,
      badgeClass: `${base} bg-amber-50 text-amber-700 border-amber-200`,
    }
  }

  if (position === 2) {
    return {
      label: "2°",
      icon: <Medal className="w-3.5 h-3.5 text-slate-500" />,
      badgeClass: `${base} bg-slate-50 text-slate-700 border-slate-200`,
    }
  }

  return {
    label: "3°",
    icon: <Medal className="w-3.5 h-3.5 text-orange-600" />,
    badgeClass: `${base} bg-orange-50 text-orange-700 border-orange-200`,
  }
}

/* ============================================================================
   🎁 UTILIDADES - PREMIOS
============================================================================ */

const readCurrentUnits = (prize) => {
  const candidates = [prize?.stock, prize?.remaining_stock, prize?.quantity, prize?.units]
  const found = candidates.find((v) => typeof v === "number")
  if (typeof found === "number") return Math.max(0, found)

  if (typeof prize?.__initial_stock === "number") {
    if (prize?.is_awarded && prize.__initial_stock <= 1) return 0
    return prize.__initial_stock
  }
  return 1
}

const derivePrizeState = (prize) => {
  const initial =
    typeof prize?.__initial_stock === "number"
      ? prize.__initial_stock
      : typeof prize?.stock === "number"
        ? prize.stock
        : typeof prize?.remaining_stock === "number"
          ? prize.remaining_stock
          : typeof prize?.quantity === "number"
            ? prize.quantity
            : typeof prize?.units === "number"
              ? prize.units
              : 1

  const current = readCurrentUnits(prize)
  const awarded = Math.max(0, (typeof initial === "number" ? initial : 1) - current)
  const exhausted = current <= 0 || prize?.is_active === false || prize?.is_disabled === true
  const status = prize?.status ?? (exhausted ? "sorteado" : "pendiente")
  const low = current > 0 && current <= 2

  return { initial, current, awarded, exhausted, low, status }
}

const enrichPrize = (rawPrize, prizeList) => {
  if (!rawPrize) return null
  const local = prizeList.find((p) => String(p.id) === String(rawPrize.id))
  return {
    ...local,
    ...rawPrize,
    image_url: rawPrize.image_url || rawPrize.image || local?.image_url || local?.image || null,
    position: rawPrize.display_order ?? rawPrize.position ?? local?.position ?? local?.display_order ?? null,
  }
}

const canContinueDraw = (detail, prizes) => {
  if (!detail) return false

  const totalUnitsAvailable = (prizes || []).reduce((acc, p) => {
    if (p.is_active === false || p.is_disabled === true) return acc
    const current = readCurrentUnits(p)
    return acc + Math.max(0, current)
  }, 0)

  return totalUnitsAvailable > 0 && (detail.status === "active" || detail.status === "scheduled") && !detail.is_drawn
}

const getPrizeImage = (p) => p?.image_url || p?.image || p?.photo || p?.picture || p?.thumbnail || null

/* ============================================================================
   ⏰ UTILIDADES - VALIDACIÓN TEMPORAL
============================================================================ */

const getTemporalState = (detail, nowTs) => {
  if (!detail) return { phase: "invalid", canSpin: false, message: "", icon: "⚪", color: "gray" }

  const now = nowTs || Date.now()
  const start = detail.participation_start ? new Date(detail.participation_start).getTime() : null
  const end = detail.participation_end ? new Date(detail.participation_end).getTime() : null
  const scheduled = detail.scheduled_date ? new Date(detail.scheduled_date).getTime() : null

  // FASE 1: Todavía no inicia la participación
  if (start && now < start) {
    const diffMs = start - now
    const totalSeconds = Math.floor(diffMs / 1000)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    return {
      phase: "waiting",
      canSpin: false,
      message: `La participación inicia en ${hours}h ${minutes}m ${seconds}s`,
      icon: "⏳",
      color: "blue",
    }
  }

  // FASE 2: Sorteo programado en el futuro
  if (scheduled && now < scheduled) {
    const diffMs = scheduled - now
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))

    return {
      phase: "scheduled_future",
      canSpin: false,
      message: `Sorteo programado en ${days > 0 ? `${days}d ` : ""}${hours}h`,
      icon: "📅",
      color: "purple",
      scheduledDate: scheduled,
    }
  }

  // FASE 3: Participación activa
  if (end && now < end) {
    return {
      phase: "active",
      canSpin: true,
      message: "Participación activa - Puede sortear",
      icon: "✅",
      color: "green",
    }
  }

  // FASE 4: Participación cerrada
  if (end && now >= end) {
    return {
      phase: "closed",
      canSpin: true,
      message: "Participación cerrada - Listo para sortear",
      icon: "🎯",
      color: "orange",
    }
  }

  // FASE 5: Sin fechas configuradas
  return {
    phase: "no_dates",
    canSpin: true,
    message: "Sin fechas configuradas - Puede sortear",
    icon: "⚪",
    color: "gray",
  }
}

/* ============================================================================
   🔗 UTILIDADES - TEXTO Y ENLACES
============================================================================ */

const URL_RE = /\b((?:https?:\/\/|www\.)[^\s<]+)/gi
const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/gi

const linkifyText = (text) => {
  if (!text) return null

  const parts = []
  let lastIdx = 0

  const emailMatches = [...text.matchAll(EMAIL_RE)]
  const urlMatches = [...text.matchAll(URL_RE)]

  const allMatches = [
    ...emailMatches.map((m) => ({ type: "email", match: m[0], index: m.index })),
    ...urlMatches.map((m) => ({ type: "url", match: m[0], index: m.index })),
  ].sort((a, b) => a.index - b.index)

  allMatches.forEach((item, i) => {
    if (lastIdx < item.index) {
      parts.push(text.slice(lastIdx, item.index))
    }

    if (item.type === "email") {
      parts.push(
        <a
          key={`e-${i}`}
          href={`mailto:${item.match}`}
          className="inline-flex items-center gap-1 text-blue-700 hover:underline break-words"
        >
          <AtSign className="w-3 h-3" />
          {item.match}
        </a>,
      )
    } else {
      parts.push(
        <a
          key={`u-${i}`}
          href={normalizeHref(item.match)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-blue-700 hover:underline break-words"
        >
          <Link2 className="w-3 h-3" />
          {item.match}
        </a>,
      )
    }

    lastIdx = item.index + item.match.length
  })

  if (lastIdx < text.length) {
    parts.push(text.slice(lastIdx))
  }

  return <>{parts}</>
}

/* ============================================================================
   🎨 COMPONENTE - TARJETA DE PREMIO
============================================================================ */

const PrizeCard = ({ prize, idx, onOpen }) => {
  const img = getPrizeImage(prize)
  const pos = prize.position ?? idx + 1
  const rank = getRankMetaShared(pos)
  const { initial, current, exhausted, awarded } = derivePrizeState(prize)

  const stockBadge = (
    <span
      className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border-2 font-bold shadow-sm ${
        current > 0 && current <= 2
          ? "bg-gradient-to-r from-rose-100 to-red-100 text-rose-800 border-rose-300"
          : "bg-gradient-to-r from-purple-100 to-violet-100 text-purple-800 border-purple-300"
      }`}
      title={`Stock restante: ${current}${typeof initial === "number" ? ` / ${initial}` : ""}`}
    >
      <Package className="w-3.5 h-3.5" />
      <span className="font-mono">{current}</span>
      {typeof initial === "number" && (
        <>
          <span className="opacity-60">/</span>
          <span className="font-mono opacity-80">{initial}</span>
        </>
      )}
    </span>
  )

  const ribbon = (label, cls) => (
    <div className="absolute -left-10 top-5 -rotate-12 z-10">
      <span className={`text-white text-xs font-black tracking-wider px-4 py-1.5 rounded-lg shadow-lg ${cls}`}>
        {label}
      </span>
    </div>
  )

  const isSoldOut = exhausted
  const isAwardedSome = awarded > 0
  const sorteadoBadge = !isSoldOut && isAwardedSome && ribbon("SORTEADO", "bg-gradient-to-r from-emerald-600 to-green-600")
  const agotadoBadge = isSoldOut && ribbon("AGOTADO", "bg-gradient-to-r from-slate-700 to-slate-900")

  return (
    <div
      className={`group relative p-5 rounded-2xl border-2 transition-all duration-300 cursor-pointer overflow-hidden ${
        exhausted
          ? "border-slate-300 bg-gradient-to-br from-slate-50 to-slate-100 opacity-80"
          : "border-slate-200 bg-gradient-to-br from-white to-slate-50 hover:shadow-xl hover:border-blue-300 hover:-translate-y-1"
      }`}
      onClick={() => onOpen(prize)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === "Enter" ? onOpen(prize) : null)}
      aria-label={`Ver premio: ${prize.name || "Premio"}`}
      title={prize.name || "Premio"}
    >
      {!exhausted && (
        <div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 -translate-x-full group-hover:translate-x-full transform"
          style={{ transition: "transform 0.8s ease-in-out, opacity 0.3s" }}
        />
      )}

      {agotadoBadge || sorteadoBadge}

      <div className="relative flex items-center gap-4">
        <div
          className={`relative w-20 h-20 rounded-2xl overflow-hidden border-2 bg-slate-50 grid place-items-center shrink-0 shadow-md ${
            exhausted ? "border-slate-300" : "border-slate-200 group-hover:border-blue-300"
          }`}
        >
          {img ? (
            <>
              <img
                src={img || "/placeholder.svg"}
                alt={prize.name || "Premio"}
                className={`w-full h-full object-cover transition-transform duration-300 ${
                  exhausted ? "grayscale" : "group-hover:scale-110"
                }`}
              />
              {!exhausted && (
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-2">
                  <div className="bg-white/90 text-slate-900 px-2 py-1 rounded-md text-[10px] font-bold flex items-center gap-1">
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
                  : "bg-gradient-to-br from-amber-100 via-amber-200 to-orange-200"
              }`}
            >
              <Gift className={`w-8 h-8 ${exhausted ? "text-slate-500" : "text-amber-700"}`} />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3 mb-2">
            <h5 className={`font-bold text-lg truncate ${exhausted ? "text-slate-600" : "text-slate-900"}`}>
              {prize.name || "Premio"}
            </h5>
            <span className={rank.badgeClass} title={`Posición ${pos}`}>
              {rank.icon}
              {rank.label}
            </span>
          </div>

          {prize.description && (
            <p
              className={`text-xs mt-1 line-clamp-2 break-words leading-relaxed ${
                exhausted ? "text-slate-500" : "text-slate-600"
              }`}
            >
              {linkifyText(prize.description)}
            </p>
          )}

          <div className="mt-3 flex items-center gap-2 flex-wrap">{stockBadge}</div>
        </div>
      </div>
    </div>
  )
}

/* ============================================================================
   🎯 COMPONENTE PRINCIPAL - DRAW TOOLS
============================================================================ */

const DrawTools = ({ onRefresh }) => {
  /* ========== 📊 ESTADO PRINCIPAL ========== */
  const [loading, setLoading] = useState(true)
  const [executing, setExecuting] = useState(false)
  const [error, setError] = useState("")

  const [list, setList] = useState([])
  const [selectedId, setSelectedId] = useState("")
  const [detail, setDetail] = useState(null)
  const [prizes, setPrizes] = useState([])

  /* ========== 🎡 ESTADO DE LA RULETA ========== */
  const [rouletteAngle, setRouletteAngle] = useState(0)
  const [rouletteSpinning, setRouletteSpinning] = useState(false)
  const [rouletteWinner, setRouletteWinner] = useState(null)
  const [showWinnerAnimation, setShowWinnerAnimation] = useState(false)

  const bannerResolverRef = useRef(null)

  /* ========== 💬 ESTADO DE MODALES ========== */
  const [confirmModal, setConfirmModal] = useState({ open: false, type: null, message: "", onConfirm: null })
  const [prizeModal, setPrizeModal] = useState({ open: false, prize: null })

  /* ========== ⏰ CRONÓMETRO ========== */
  const [nowTs, setNowTs] = useState(Date.now())

  useEffect(() => {
    const id = setInterval(() => setNowTs(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  /* ========== 💾 PERSISTENCIA LOCAL ========== */
  useEffect(() => {
    const savedId = localStorage.getItem(STORAGE_KEY_SELECTED_ROULETTE)
    if (savedId) setSelectedId(savedId)
  }, [])

  useEffect(() => {
    if (selectedId) {
      localStorage.setItem(STORAGE_KEY_SELECTED_ROULETTE, selectedId)
    }
  }, [selectedId])

  /* ========== 🔄 CARGA DE DATOS ========== */
  const stampInitialStock = useCallback((list) => {
    return (list || []).map((p) => ({
      ...p,
      __initial_stock:
        typeof p.__initial_stock === "number"
          ? p.__initial_stock
          : typeof p.stock === "number"
            ? p.stock
            : typeof p.remaining_stock === "number"
              ? p.remaining_stock
              : typeof p.quantity === "number"
                ? p.quantity
                : typeof p.units === "number"
                  ? p.units
                  : 1,
    }))
  }, [])

  const loadList = useCallback(async () => {
    try {
      setError("")
      const items = await roulettesAPI
        .getRoulettes()
        .then((r) => (Array.isArray(r) ? r : r.results || []))
        .catch(() => [])

      const activeAndCompleted = items.filter((r) => {
        const status = (r.status || "").toLowerCase()
        return status === "active" || status === "completed" || r.is_active === true
      })

      setList(activeAndCompleted)

      const savedId = localStorage.getItem(STORAGE_KEY_SELECTED_ROULETTE)

      if (savedId) {
        const exists = activeAndCompleted.some((x) => String(x.id) === String(savedId))
        if (exists) {
          setSelectedId(savedId)
        } else {
          setSelectedId("")
          setDetail(null)
          setPrizes([])
          localStorage.removeItem(STORAGE_KEY_SELECTED_ROULETTE)
        }
      }
    } catch (e) {
      setError(`Error cargando sorteos: ${e?.message || "Error desconocido"}`)
      console.error(e)
    }
  }, [])

  const loadDetail = useCallback(
    async (id) => {
      if (!id) {
        setDetail(null)
        setPrizes([])
        return
      }
      try {
        setError("")
        const [rouletteDetail, prizesData] = await Promise.all([
          roulettesAPI.getRoulette(Number(id)),
          (roulettesAPI.listPrizes ? roulettesAPI.listPrizes(Number(id)) : Promise.resolve({ results: [] })).catch(
            () => ({ results: [] }),
          ),
        ])
        setDetail(rouletteDetail)

        const incoming = (prizesData?.results || prizesData || []).map((p) => ({
          ...p,
          image_url: p.image_url || p.image || p.photo || p.picture || null,
          position: p.position != null ? p.position : p.display_order != null ? p.display_order : undefined,
        }))

        incoming.sort((a, b) => (a.display_order ?? a.position ?? 0) - (b.display_order ?? b.position ?? 0))

        setPrizes(stampInitialStock(incoming))
      } catch (e) {
        setError(`Error cargando detalle: ${e?.message || "Error desconocido"}`)
        setDetail(null)
        setPrizes([])
        console.error(e)
      }
    },
    [stampInitialStock],
  )

  /* ========== 🎬 EFECTOS DE CARGA INICIAL ========== */
  useEffect(() => {
    ;(async () => {
      setLoading(true)
      try {
        await loadList()
      } finally {
        setLoading(false)
      }
    })()
  }, [loadList])

  useEffect(() => {
    if (selectedId) loadDetail(selectedId)
  }, [selectedId, loadDetail])

  /* ========== 🧮 DATOS DERIVADOS ========== */
  const participants = useMemo(() => {
    if (!detail?.participants) return []
    const ordered = [...detail.participants].sort(
      (a, b) => Number(a.participant_number ?? 0) - Number(b.participant_number ?? 0),
    )
    return ordered.map((p, i) => ({
      id: p.id ?? i + 1,
      num: p.participant_number ?? i + 1,
      name: p.user_name ?? p.name ?? `Participante ${i + 1}`,
      email: p.email || "",
      isWinner: !!p.is_winner,
    }))
  }, [detail])

  const temporalState = useMemo(() => getTemporalState(detail, nowTs), [detail, nowTs])

  const canDraw = useMemo(() => {
    if (!temporalState.canSpin) return false
    return canContinueDraw(detail, prizes)
  }, [detail, prizes, temporalState])

  const prizeUnitStats = useMemo(() => {
    let availableUnits = 0
    let deliveredUnits = 0
    let activeTypes = 0

    prizes.forEach((p) => {
      const { initial, current, exhausted } = derivePrizeState(p)
      availableUnits += Math.max(0, current)
      deliveredUnits += Math.max(0, (typeof initial === "number" ? initial : 1) - current)
      if (!exhausted && p.is_active !== false) activeTypes += 1
    })

    return { availableUnits, deliveredUnits, activeTypes }
  }, [prizes])

  const centerIconKey = (detail?.center_icon || "trophy").toLowerCase()

  /* ========== 🎰 LÓGICA DE SORTEO ========== */
  const doOneSpin = useCallback(async () => {
    if (!selectedId || participants.length === 0) throw new Error("No hay participantes")

    const res = await roulettesAPI.executeRouletteDraw(Number(selectedId))
    if (!res?.success) throw new Error(res?.message || "No se pudo ejecutar el sorteo")

    const w = res.winner || res.winner_data || {}
    const prizeRaw = res.prize || null

    // Encontrar índice del ganador
    let idx = -1
    if (w.participant_number != null)
      idx = participants.findIndex((p) => String(p.num) === String(w.participant_number))
    if (idx < 0 && w.id != null) idx = participants.findIndex((p) => String(p.id) === String(w.id))
    if (idx < 0 && w.name) idx = participants.findIndex((p) => p.name === w.name)
    if (idx < 0) idx = Math.floor(Math.random() * participants.length)

    const spins = Number(res.total_spins ?? 6)
    const returnedAngle = Number(res.angle ?? 0)
    const pointerSide = "right"
    const currentMod = mod360(rouletteAngle)
    const desiredMod =
      returnedAngle !== 0 ? mod360(returnedAngle) : rotationForWinnerIndex(idx, participants.length, pointerSide)
    let delta = desiredMod - currentMod
    if (delta <= 0) delta += 360
    const finalAngle = rouletteAngle + spins * 360 + delta

    const prize = enrichPrize(prizeRaw, prizes)

    const localWinner = {
      name: w.name || participants[idx]?.name || "Ganador",
      participant: participants[idx],
      prize,
      isLastDraw: false,
    }
    setRouletteWinner(localWinner)

    // Actualizar stock localmente
    if (prize?.id != null) {
      setPrizes((prev) =>
        prev.map((p) => {
          if (String(p.id) !== String(prize.id)) return p

          const before = readCurrentUnits(p)
          const next = Math.max(0, before - 1)

          const patched = { ...p, is_awarded: true }

          if (typeof p.stock === "number") patched.stock = next
          else if (typeof p.remaining_stock === "number") patched.remaining_stock = next
          else if (typeof p.quantity === "number") patched.quantity = next
          else if (typeof p.units === "number") patched.units = next

          patched.status = next === 0 ? "sorteado" : p.status && p.status !== "sorteado" ? p.status : "pendiente"

          return patched
        }),
      )
    }

    setRouletteAngle(finalAngle)
    setRouletteSpinning(true)

    // Esperar cierre manual del banner
    await new Promise((resolve) => {
      bannerResolverRef.current = resolve
    })

    // Delay adicional para mejor UX
    await new Promise((resolve) => setTimeout(resolve, 800))

    // Sincronizar con backend
    await Promise.all([loadDetail(selectedId), loadList().catch(() => {})])

    return true
  }, [selectedId, participants, rouletteAngle, prizes, loadDetail, loadList])

  /* ========== 🎬 HANDLERS DE LA RULETA ========== */
  const handleRouletteTransitionEnd = useCallback(() => {
    setRouletteSpinning(false)
    setTimeout(() => {
      setShowWinnerAnimation(true)
    }, 300)
  }, [])

  const dismissWinner = useCallback(() => {
    setShowWinnerAnimation(false)

    setTimeout(() => {
      setRouletteWinner(null)
      if (typeof bannerResolverRef.current === "function") {
        const r = bannerResolverRef.current
        bannerResolverRef.current = null
        r()
      }
    }, 400)
  }, [])

  /* ========== 🧹 LIMPIEZA AL CAMBIAR DE RULETA ========== */
  useEffect(() => {
    if (rouletteWinner) {
      dismissWinner()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  /* ========== 🎯 HANDLER DE SORTEO CON VALIDACIÓN ========== */
  const handleSingleDraw = useCallback(async () => {
    if (!selectedId || rouletteSpinning || executing || participants.length === 0 || !canDraw) return

    const performDraw = async () => {
      setError("")
      setExecuting(true)
      try {
        await doOneSpin()
      } catch (e) {
        console.error(e)
        setError(e?.message || "No se pudo completar el sorteo.")
      } finally {
        setExecuting(false)
      }
    }

    // Validación: Sorteo anticipado durante participación activa
    if (temporalState.phase === "active" && detail?.participation_end) {
      const endMs = new Date(detail.participation_end).getTime()
      const diffMs = endMs - nowTs
      const hoursRemaining = Math.floor(diffMs / (1000 * 60 * 60))

      if (hoursRemaining > 1) {
        setConfirmModal({
          open: true,
          type: "early_draw",
          message: `La participación cierra en ${hoursRemaining} hora${hoursRemaining !== 1 ? "s" : ""}. ¿Deseas sortear ahora de todas formas?`,
          onConfirm: async () => {
            setConfirmModal({ open: false, type: null, message: "", onConfirm: null })
            await performDraw()
          },
        })
        return
      }
    }

    // Validación: Sorteo programado para el futuro
    if (temporalState.phase === "scheduled_future" && temporalState.scheduledDate) {
      const diffMs = temporalState.scheduledDate - nowTs
      const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))

      setConfirmModal({
        open: true,
        type: "scheduled_override",
        message: `Este sorteo está programado para ${days > 0 ? `${days} día${days !== 1 ? "s" : ""}` : "hoy"}. ¿Ejecutar manualmente ahora?`,
        onConfirm: async () => {
          setConfirmModal({ open: false, type: null, message: "", onConfirm: null })
          await performDraw()
        },
      })
      return
    }

    // Si pasa todas las validaciones, sortear normalmente
    await performDraw()
  }, [selectedId, rouletteSpinning, executing, participants, canDraw, temporalState, detail, nowTs, doOneSpin])

  /* ========== 🎁 HANDLERS DE MODAL DE PREMIOS ========== */
  const openPrize = useCallback((prize) => setPrizeModal({ open: true, prize }), [])
  const closePrize = useCallback(() => setPrizeModal({ open: false, prize: null }), [])

  /* ========== 🔄 HANDLER DE REFRESH ========== */
  const handleRefresh = useCallback(async () => {
    setLoading(true)
    await Promise.all([loadList(), selectedId ? loadDetail(selectedId) : Promise.resolve()])
    setLoading(false)
    onRefresh?.()
  }, [loadList, loadDetail, selectedId, onRefresh])

  /* ========== 🎨 RENDERIZADO PRINCIPAL ========== */
  return (
    <div className="space-y-6">
      {/* ========== BARRA DE ACCIONES ========== */}
      <div className="flex justify-end">
        <button
          onClick={handleRefresh}
          className="group inline-flex items-center gap-2 px-5 py-3 text-sm font-bold rounded-xl bg-white hover:bg-gray-50 text-gray-900 border border-gray-200 hover:border-gray-300 transition-all duration-200 shadow-sm hover:shadow-md"
          disabled={loading}
        >
          <RefreshCcw
            className={`h-5 w-5 transition-transform duration-300 ${loading ? "animate-spin" : "group-hover:rotate-180"}`}
          />
          Refrescar
        </button>
      </div>

      {/* ========== MENSAJE DE ERROR ========== */}
      {error && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-rose-50 via-red-50 to-rose-50 border-2 border-rose-300 p-5 shadow-lg">
          <div className="absolute top-0 right-0 w-32 h-32 bg-rose-200 rounded-full blur-3xl opacity-20 -mr-16 -mt-16" />
          <div className="relative flex items-start gap-4">
            <div className="p-2 rounded-xl bg-rose-100 border border-rose-200">
              <AlertTriangle className="h-6 w-6 text-rose-600" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-rose-900 text-lg mb-1">Ocurrió un problema</p>
              <p className="text-rose-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* ========== GRID PRINCIPAL ========== */}
      <div className="grid lg:grid-cols-5 gap-6">
        {/* ========== COLUMNA IZQUIERDA: CONTROLES Y PREMIOS ========== */}
        <div className="lg:col-span-2 space-y-3">
          {/* ========== PANEL DE CONTROL ========== */}
          <div className="relative overflow-hidden p-6 rounded-2xl border-2 border-slate-200 bg-gradient-to-br from-white to-slate-50 shadow-lg hover:shadow-xl transition-shadow duration-300">
            <div className="absolute top-0 right-0 w-40 h-40 bg-blue-100 rounded-full blur-3xl opacity-30 -mr-20 -mt-20" />

            <div className="relative">
              {/* Selector de Ruleta */}
              <label className="text-sm font-bold text-slate-800 mb-3 inline-flex items-center gap-2">
                <Crown className="w-5 h-5 text-amber-500" />
                Ruleta a sortear
              </label>

              <div className="relative">
                <Crown className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                <select
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 rounded-xl border-2 border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none font-medium text-slate-700 hover:border-slate-400 transition-colors shadow-sm"
                >
                  <option value="" disabled>
                    Selecciona una ruleta activa
                  </option>
                  {list.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name || `Ruleta ${r.id}`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Estadísticas */}
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-blue-50 border border-blue-200">
                  <div className="p-2 rounded-lg bg-blue-100">
                    <Users className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs text-blue-600 font-medium">Participantes</p>
                    <p className="text-lg font-bold text-blue-900">{detail?.participants?.length ?? 0}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200">
                  <div className="p-2 rounded-lg bg-amber-100">
                    <Award className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-xs text-amber-600 font-medium">Disponibles</p>
                    <p className="text-lg font-bold text-amber-900">{prizeUnitStats.availableUnits}</p>
                  </div>
                </div>
              </div>

              {/* Estado Temporal */}
              {selectedId && detail && temporalState.phase !== "no_dates" && (
                <div
                  className={`mt-4 p-4 rounded-xl border-2 shadow-md ${
                    temporalState.color === "blue"
                      ? "bg-gradient-to-br from-blue-50 to-blue-100 border-blue-300"
                      : temporalState.color === "purple"
                        ? "bg-gradient-to-br from-purple-50 to-purple-100 border-purple-300"
                        : temporalState.color === "green"
                          ? "bg-gradient-to-br from-green-50 to-green-100 border-green-300"
                          : temporalState.color === "orange"
                            ? "bg-gradient-to-br from-orange-50 to-orange-100 border-orange-300"
                            : "bg-gradient-to-br from-gray-50 to-gray-100 border-gray-300"
                  }`}
                >
                  <div
                    className={`flex items-center gap-3 font-bold ${
                      temporalState.color === "blue"
                        ? "text-blue-900"
                        : temporalState.color === "purple"
                          ? "text-purple-900"
                          : temporalState.color === "green"
                            ? "text-green-900"
                            : temporalState.color === "orange"
                              ? "text-orange-900"
                              : "text-gray-900"
                    }`}
                  >
                    <span className="text-2xl">{temporalState.icon}</span>
                    <span>{temporalState.message}</span>
                  </div>

                  {/* Advertencia de cierre próximo */}
                  {temporalState.phase === "active" &&
                    detail.participation_end &&
                    (() => {
                      const endMs = new Date(detail.participation_end).getTime()
                      const diffMs = endMs - nowTs
                      const hoursUntilEnd = Math.floor(diffMs / (1000 * 60 * 60))

                      if (hoursUntilEnd < 24 && hoursUntilEnd > 0) {
                        return (
                          <div className="mt-3 pt-3 border-t-2 border-orange-200 text-sm text-orange-800 flex items-start gap-2 bg-orange-50/50 p-2 rounded-lg">
                            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <span>
                              <strong>Advertencia:</strong> La participación cierra en {hoursUntilEnd} hora
                              {hoursUntilEnd !== 1 ? "s" : ""}.
                            </span>
                          </div>
                        )
                      }
                      return null
                    })()}
                </div>
              )}

              {/* Mensaje de Sorteo Completado */}
              {detail?.status === "completed" && !canDraw && (
                <div className="mt-4 p-4 bg-gradient-to-r from-green-50 via-emerald-50 to-green-50 rounded-xl border-2 border-green-300 shadow-md">
                  <div className="flex items-center gap-3 justify-center text-green-900">
                    <Crown className="w-6 h-6 text-amber-500" />
                    <span className="font-bold text-lg">¡Sorteo Completado!</span>
                  </div>
                  <p className="text-green-700 text-sm text-center mt-1 font-medium">
                    Se alcanzó el objetivo de ganadores
                  </p>
                </div>
              )}

              {/* Botón de Sorteo */}
              <div className="mt-5">
                {!canDraw && detail?.status === "completed" ? null : (
                  <>
                    <button
                      onClick={handleSingleDraw}
                      disabled={!selectedId || rouletteSpinning || executing || participants.length === 0 || !canDraw}
                      className={`group relative inline-flex items-center gap-3 px-6 py-4 rounded-xl font-bold shadow-lg transition-all duration-300 transform hover:scale-105 ${
                        !canDraw || !temporalState.canSpin
                          ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                          : "bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white shadow-emerald-500/50"
                      }`}
                      title={!temporalState.canSpin ? temporalState.message : ""}
                    >
                      <Play
                        className={`w-6 h-6 ${rouletteSpinning || executing ? "animate-pulse" : "group-hover:scale-110 transition-transform"}`}
                      />
                      <span className="text-lg">
                        {rouletteSpinning || executing
                          ? "Girando..."
                          : !temporalState.canSpin
                            ? "Bloqueado"
                            : "Girar una vez"}
                      </span>
                      {!(!canDraw || !temporalState.canSpin) && (
                        <div className="absolute inset-0 rounded-xl bg-white opacity-0 group-hover:opacity-20 transition-opacity" />
                      )}
                    </button>

                    {!temporalState.canSpin && selectedId && (
                      <p className="text-xs text-slate-600 mt-3 flex items-center gap-2 bg-slate-100 p-2 rounded-lg">
                        <Clock className="w-4 h-4" />
                        {temporalState.message}
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* ========== PANEL DE PREMIOS ========== */}
          <div className="relative overflow-hidden p-6 rounded-2xl border-2 border-slate-200 bg-gradient-to-br from-white to-amber-50 shadow-lg">
            <div className="absolute top-0 left-0 w-40 h-40 bg-amber-100 rounded-full blur-3xl opacity-30 -ml-20 -mt-20" />

            <div className="relative">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-md">
                  <Gift className="w-6 h-6" />
                </div>
                <h4 className="font-extrabold text-slate-900 text-xl">Premios</h4>
              </div>
              <p className="text-sm text-slate-600 mb-4 font-medium">Toca un premio para ver sus detalles</p>

              {prizes.length === 0 ? (
                <div className="text-center py-8">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 mb-3">
                    <Package className="w-8 h-8 text-slate-400" />
                  </div>
                  <p className="text-slate-500 font-medium">No hay premios configurados</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {prizes.slice(0, 8).map((p, i) => (
                    <PrizeCard key={p.id ?? i} prize={p} idx={i} onOpen={openPrize} />
                  ))}
                  {prizes.length > 8 && (
                    <div className="text-sm text-slate-600 px-3 py-2 bg-slate-100 rounded-lg text-center font-medium">
                      y {prizes.length - 8} premios más
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ========== COLUMNA DERECHA: RULETA ========== */}
        <div className="lg:col-span-3 p-0 rounded-2xl border-2 border-slate-300 shadow-2xl bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 overflow-hidden">
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

      {/* ========== MODAL DE CONFIRMACIÓN ========== */}
      {confirmModal.open && (
        <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-7 transform animate-in zoom-in-95 duration-200">
            <div className="flex items-start gap-4 mb-5">
              <div className="p-3 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg">
                <AlertTriangle className="w-7 h-7 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-extrabold text-slate-900 mb-2">Confirmar Sorteo</h3>
                <p className="text-slate-700 leading-relaxed">{confirmModal.message}</p>
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmModal({ open: false, type: null, message: "", onConfirm: null })}
                className="px-5 py-2.5 rounded-xl border-2 border-slate-300 text-slate-700 font-bold hover:bg-slate-50 hover:border-slate-400 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={confirmModal.onConfirm}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 text-white font-bold hover:from-emerald-600 hover:to-green-700 shadow-lg shadow-emerald-500/30 transition-all transform hover:scale-105"
              >
                Sí, sortear ahora
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== MODAL DE DETALLE DE PREMIO ========== */}
      {prizeModal.open && (
        <div
          className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          onClick={closePrize}
        >
          <div
            className="relative w-full max-w-3xl max-h-[85vh] bg-white rounded-3xl shadow-2xl overflow-hidden transform animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Hero con imagen */}
            <div className="relative h-64 sm:h-80 md:h-96 bg-gradient-to-br from-slate-100 to-slate-200">
              {(() => {
                const url = getPrizeImage(prizeModal.prize)
                return url ? (
                  <>
                    <img
                      src={url || "/placeholder.svg"}
                      alt={prizeModal.prize?.name || "Premio"}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
                  </>
                ) : (
                  <div className="absolute inset-0 w-full h-full grid place-items-center bg-gradient-to-br from-amber-100 via-amber-200 to-orange-200">
                    <Gift className="w-20 h-20 text-amber-700" />
                  </div>
                )
              })()}

              {/* Insignia posición */}
              <div className="absolute top-5 left-5">
                {(() => {
                  const r = getRankMetaShared(prizeModal.prize?.position ?? null)
                  return (
                    <span
                      className={`${r.badgeClass} text-lg px-4 py-2 bg-white/95 backdrop-blur-sm shadow-lg border-2`}
                    >
                      {r.icon}
                      {r.label}
                    </span>
                  )
                })()}
              </div>

              {/* Botón cerrar */}
              <button
                className="absolute top-4 right-4 p-3 rounded-xl bg-white/95 hover:bg-white shadow-lg hover:shadow-xl transition-all transform hover:scale-110"
                onClick={closePrize}
                aria-label="Cerrar"
              >
                <X className="w-6 h-6 text-slate-700" />
              </button>

              {/* Título */}
              <div className="absolute bottom-6 left-6 right-6">
                <h3 className="text-white text-3xl sm:text-4xl font-black drop-shadow-lg">
                  {prizeModal.prize?.name || "Premio"}
                </h3>
              </div>
            </div>

            {/* Cuerpo scrollable */}
            <div className="p-6 overflow-y-auto max-h-[calc(85vh-10rem)] bg-gradient-to-br from-white to-slate-50">
              <div className="flex items-center gap-3 flex-wrap mb-5">
                {(() => {
                  const { initial, current } = derivePrizeState(prizeModal.prize || {})
                  return (
                    <span
                      className={`inline-flex items-center gap-2 text-base px-4 py-2 rounded-xl border-2 font-bold shadow-md ${
                        current > 0 && current <= 2
                          ? "bg-gradient-to-r from-rose-100 to-red-100 text-rose-800 border-rose-300"
                          : "bg-gradient-to-r from-purple-100 to-violet-100 text-purple-800 border-purple-300"
                      }`}
                      title="Stock restante"
                    >
                      <Package className="w-5 h-5" />
                      <span className="font-mono">{current}</span>
                      {typeof initial === "number" && (
                        <>
                          <span className="opacity-60">/</span>
                          <span className="font-mono opacity-80">{initial}</span>
                        </>
                      )}
                    </span>
                  )
                })()}
              </div>

              {prizeModal.prize?.description && (
                <div className="prose prose-sm max-w-none text-slate-800 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                  {linkifyText(prizeModal.prize.description)}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-5 bg-gradient-to-r from-slate-50 to-slate-100 border-t-2 border-slate-200 flex justify-end">
              <button
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-slate-800 to-slate-900 hover:from-slate-900 hover:to-black text-white font-bold shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
                onClick={closePrize}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DrawTools