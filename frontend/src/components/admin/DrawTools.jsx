"use client"

// src/components/admin/DrawTools.jsx
import { useEffect, useMemo, useState, useCallback, useRef } from "react"
import {
  RotateCcw,
  Play,
  Users,
  Calendar,
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
  Timer,
  Crown,
} from "lucide-react"
import { roulettesAPI } from "../../config/api"
import PremiumRoulette from "./Gestión de Ruletas/PremiumRoulette"

const STORAGE_KEY_SELECTED_ROULETTE = "draw_tools_selected_roulette_id"

/* ============================================================================
   UTILIDADES COMPARTIDAS
============================================================================ */

/** Helper para meta de posición (1°, 2°, 3°...) */
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
   UTILIDADES DE PREMIOS
============================================================================ */

/** Lectura robusta de UNIDADES actuales */
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

/** Derivar estado del premio */
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

/** Fusionar premio mínimo devuelto por draw con lista local */
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

/** Verificar si se puede continuar sorteando */
const canContinueDraw = (detail, prizes) => {
  if (!detail) return false

  const totalUnitsAvailable = (prizes || []).reduce((acc, p) => {
    if (p.is_active === false || p.is_disabled === true) return acc
    const current = readCurrentUnits(p)
    return acc + Math.max(0, current)
  }, 0)

  return totalUnitsAvailable > 0 && (detail.status === "active" || detail.status === "scheduled") && !detail.is_drawn
}

/* ============================================================================
   UTILIDADES DE TEXTO Y ENLACES
============================================================================ */

const URL_RE = /\b((?:https?:\/\/|www\.)[^\s<]+)/gi
const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/gi

const normalizeHref = (raw) => (!raw ? "#" : raw.startsWith("http") ? raw : `https://${raw}`)

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
   UTILIDADES DE ROTACIÓN (para alinear con puntero)
============================================================================ */

const mod360 = (x) => ((x % 360) + 360) % 360
const pointerOffsetDegrees = (pointerSide) => (pointerSide === "top" ? -90 : 0)

const rotationForWinnerIndex = (winnerIndex, total, pointerSide) => {
  const segAngle = 360 / total
  const mid = winnerIndex * segAngle + segAngle / 2
  const offset = pointerOffsetDegrees(pointerSide)
  return mod360(offset - mid)
}

/* ============================================================================
   COMPONENTE PRINCIPAL: DRAW TOOLS
============================================================================ */

const DrawTools = ({ onRefresh }) => {
  /* ========== Estado Principal ========== */
  const [loading, setLoading] = useState(true)
  const [executing, setExecuting] = useState(false)
  const [error, setError] = useState("")

  const [list, setList] = useState([])
  const [selectedId, setSelectedId] = useState("")
  const [detail, setDetail] = useState(null)
  const [prizes, setPrizes] = useState([])

  /* ========== Estado de la Ruleta ========== */
  const [rouletteAngle, setRouletteAngle] = useState(0)
  const [rouletteSpinning, setRouletteSpinning] = useState(false)
  const [rouletteWinner, setRouletteWinner] = useState(null)
  const [showWinnerAnimation, setShowWinnerAnimation] = useState(false)

  const bannerResolverRef = useRef(null)
  const SPIN_DURATION_MS = 4500

  /* ========== Cronómetro para sorteos programados ========== */
  const [nowTs, setNowTs] = useState(Date.now())

  useEffect(() => {
    const id = setInterval(() => setNowTs(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const pad2 = (n) => String(n).padStart(2, "0")

  const countdown = useMemo(() => {
    if (!detail?.scheduled_date) return null
    const target = new Date(detail.scheduled_date).getTime()
    const diffMs = target - nowTs
    const positive = Math.max(diffMs, 0)
    let secs = Math.floor(positive / 1000)
    const days = Math.floor(secs / 86400)
    secs %= 86400
    const hours = Math.floor(secs / 3600)
    secs %= 3600
    const minutes = Math.floor(secs / 60)
    const seconds = secs % 60
    return { diffMs, days, hours, minutes, seconds }
  }, [detail?.scheduled_date, nowTs])

  useEffect(() => {
    const savedId = localStorage.getItem(STORAGE_KEY_SELECTED_ROULETTE)
    if (savedId) {
      setSelectedId(savedId)
    }
  }, [])

  useEffect(() => {
    if (selectedId) {
      localStorage.setItem(STORAGE_KEY_SELECTED_ROULETTE, selectedId)
    }
  }, [selectedId])

  /* ========== Funciones de Carga de Datos ========== */

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
          // Mantener la selección guardada
          setSelectedId(savedId)
        } else {
          // Si la ruleta guardada ya no existe, limpiar la selección
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

  /* ========== Efectos de Carga ========== */

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

  /* ========== Datos Derivados ========== */

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

  const canDraw = useMemo(() => canContinueDraw(detail, prizes), [detail, prizes])
  const centerIconKey = (detail?.center_icon || "trophy").toLowerCase()

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

  /* ========== Lógica de Sorteo ========== */

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

    // Sincronizar con backend
    await Promise.all([loadDetail(selectedId), loadList().catch(() => {})])

    return true
  }, [selectedId, participants, rouletteAngle, prizes, loadDetail, loadList])

  /* ========== Handlers de la Ruleta ========== */

  const handleRouletteTransitionEnd = useCallback(() => {
    setRouletteSpinning(false)
    setShowWinnerAnimation(true)
  }, [])

  const dismissWinner = useCallback(() => {
    setShowWinnerAnimation(false)
    setRouletteWinner(null)
    if (typeof bannerResolverRef.current === "function") {
      const r = bannerResolverRef.current
      bannerResolverRef.current = null
      r()
    }
  }, [])

  const handleSingleDraw = useCallback(async () => {
    if (!selectedId || rouletteSpinning || executing || participants.length === 0 || !canDraw) return
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
  }, [selectedId, rouletteSpinning, executing, participants.length, canDraw, doOneSpin])

  /* ========== Modal de Premios ========== */

  const [prizeModal, setPrizeModal] = useState({ open: false, prize: null })
  const openPrize = useCallback((prize) => setPrizeModal({ open: true, prize }), [])
  const closePrize = useCallback(() => setPrizeModal({ open: false, prize: null }), [])
  const getPrizeImage = (p) => p?.image_url || p?.image || p?.photo || p?.picture || p?.thumbnail || null

  /* ========== Componente de Tarjeta de Premio ========== */

  const PrizeCard = ({ prize, idx }) => {
    const img = getPrizeImage(prize)
    const pos = prize.position ?? idx + 1
    const rank = getRankMetaShared(pos)

    const { initial, current, awarded, exhausted, low } = derivePrizeState(prize)

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
    )

    const ribbon = (label, cls) => (
      <div className="absolute -left-9 top-4 -rotate-12 z-10">
        <span className={`text-white text-xs font-black tracking-wider px-3 py-1 rounded-md shadow ${cls}`}>
          {label}
        </span>
      </div>
    )

    const isSoldOut = exhausted
    const isAwardedSome = awarded > 0
    const sorteadoBadge = !isSoldOut && isAwardedSome && ribbon("SORTEADO", "bg-emerald-600")
    const agotadoBadge = isSoldOut && ribbon("AGOTADO", "bg-slate-700")

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
            className={`relative w-16 h-16 rounded-xl overflow-hidden border bg-slate-50 grid place-items-center shrink-0 ${
              exhausted ? "border-slate-300" : "border-slate-200"
            }`}
          >
            {img ? (
              <>
                <img
                  src={img || "/placeholder.svg"}
                  alt={prize.name || "Premio"}
                  className={`w-full h-full object-cover ${exhausted ? "grayscale" : ""}`}
                />
                {!exhausted && (
                  <div className="absolute bottom-1 right-1 bg-black/55 text-white px-1.5 py-0.5 rounded-md text-[10px] flex items-center gap-1">
                    <ZoomIn className="w-3 h-3" /> Ver
                  </div>
                )}
              </>
            ) : (
              <div
                className={`w-full h-full grid place-items-center text-amber-700 ${
                  exhausted
                    ? "bg-gradient-to-br from-slate-200 to-slate-300"
                    : "bg-gradient-to-br from-amber-100 to-amber-200"
                }`}
              >
                <Gift className="w-6 h-6" />
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-3">
              <h5 className={`font-semibold truncate ${exhausted ? "text-slate-600" : "text-slate-800"}`}>
                {prize.name || "Premio"}
              </h5>
              <span className={rank.badgeClass} title={`Posición ${pos}`}>
                {rank.icon}
                {rank.label}
              </span>
            </div>

            {prize.description && (
              <p className={`text-xs mt-1 line-clamp-2 break-words ${exhausted ? "text-slate-500" : "text-slate-600"}`}>
                {linkifyText(prize.description)}
              </p>
            )}

            <div className="mt-2 flex items-center gap-2 flex-wrap">{stockBadge}</div>
          </div>
        </div>

        {!exhausted && (
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl pointer-events-none" />
        )}
      </div>
    )
  }

  /* ========== Renderizado Principal ========== */

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
            <p className="text-slate-600">Ejecuta sorteos oficiales con ruleta premium (manual)</p>
          </div>
        </div>

        <button
          onClick={async () => {
            setLoading(true)
            await Promise.all([loadList(), selectedId ? loadDetail(selectedId) : Promise.resolve()])
            setLoading(false)
            onRefresh?.()
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

      {/* Errores */}
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
        {/* Panel Izquierdo: Controles */}
        <div className="lg:col-span-2 space-y-5">
          <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm">
            <label className="block text-sm font-semibold text-slate-700 mb-2">Ruleta a sortear</label>

            <div className="relative">
              <Crown className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-slate-400 appearance-none"
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

            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 text-slate-600 text-sm">
                <Award className="w-4 h-4" />
                <span>{prizeUnitStats.availableUnits} premios disponibles</span>
              </div>
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
              <div className="mt-2 flex items-center gap-2 text-slate-600 text-sm">
                <Timer className="w-4 h-4" />
                {countdown?.diffMs > 0 ? (
                  <span>
                    Faltan {countdown.days > 0 && <strong>{countdown.days}d </strong>}
                    <strong>
                      {pad2(countdown.hours)}:{pad2(countdown.minutes)}:{pad2(countdown.seconds)}
                    </strong>
                  </span>
                ) : (
                  <span className="font-semibold text-emerald-700">¡Listo para girar!</span>
                )}
              </div>
            )}

            <div className="mt-4">
              {!canDraw && detail?.status === "completed" ? (
                <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-green-100 text-green-800 font-semibold border border-green-200">
                  <Crown className="w-5 h-5" /> Sorteo Completado
                </div>
              ) : (
                <button
                  onClick={handleSingleDraw}
                  disabled={!selectedId || rouletteSpinning || executing || participants.length === 0 || !canDraw}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-md disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200"
                >
                  <Play className="w-5 h-5" />
                  {rouletteSpinning || executing ? "Girando..." : "Girar una vez"}
                </button>
              )}
            </div>
          </div>

          {/* Lista de Premios */}
          <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <Gift className="w-5 h-5 text-amber-500" />
              <h4 className="font-bold text-slate-800">Premios</h4>
            </div>
            <p className="text-xs text-slate-500 mb-3">Toca un premio para ver sus detalles</p>

            {prizes.length === 0 ? (
              <p className="text-sm text-slate-500">No hay premios.</p>
            ) : (
              <div className="grid gap-3">
                {prizes.slice(0, 8).map((p, i) => (
                  <PrizeCard key={p.id ?? i} prize={p} idx={i} />
                ))}
                {prizes.length > 8 && (
                  <div className="text-xs text-slate-500 px-2">y {prizes.length - 8} premios más</div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Panel Derecho: Ruleta */}
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

      {/* Modal de Premio - Vista detallada */}
      {prizeModal.open && (
        <div
          className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-[1px] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          onClick={closePrize}
        >
          <div
            className="relative w-full max-w-3xl max-h-[85vh] bg-white rounded-3xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Hero con imagen */}
            <div className="relative h-60 sm:h-72 md:h-80 bg-slate-100">
              {(() => {
                const url = getPrizeImage(prizeModal.prize)
                return url ? (
                  <img
                    src={url || "/placeholder.svg"}
                    alt={prizeModal.prize?.name || "Premio"}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 w-full h-full grid place-items-center text-amber-600">
                    <Gift className="w-12 h-12" />
                  </div>
                )
              })()}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/25 to-transparent" />

              {/* Insignia posición */}
              <div className="absolute top-4 left-4">
                {(() => {
                  const r = getRankMetaShared(prizeModal.prize?.position ?? null)
                  return (
                    <span
                      className={`${r.badgeClass} text-white/95 bg-black/30 border-white/30 backdrop-blur px-2 py-1`}
                    >
                      {r.icon}
                      {r.label}
                    </span>
                  )
                })()}
              </div>

              {/* Botón cerrar */}
              <button
                className="absolute top-3 right-3 p-2 rounded-xl bg-white/90 hover:bg-white shadow"
                onClick={closePrize}
                aria-label="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Título sobre imagen */}
              <div className="absolute bottom-4 left-4 right-4">
                <h3 className="text-white text-2xl sm:text-3xl font-extrabold drop-shadow">
                  {prizeModal.prize?.name || "Premio"}
                </h3>
              </div>
            </div>

            {/* Cuerpo scrollable */}
            <div className="p-5 overflow-y-auto max-h-[calc(85vh-9.5rem)]">
              <div className="flex items-center gap-2 flex-wrap mb-4">
                {(() => {
                  const { initial, current } = derivePrizeState(prizeModal.prize || {})
                  return (
                    <span
                      className={`inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-full border font-semibold ${
                        current > 0 && current <= 2
                          ? "bg-rose-100 text-rose-700 border-rose-200"
                          : "bg-purple-100 text-purple-700 border-purple-200"
                      }`}
                      title="Stock restante"
                    >
                      <Package className="w-4 h-4" />
                      {current}
                      {typeof initial === "number" ? ` / ${initial}` : ""}
                    </span>
                  )
                })()}
              </div>

              {prizeModal.prize?.description && (
                <div className="prose prose-sm max-w-none text-slate-800">
                  {linkifyText(prizeModal.prize.description)}
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 flex justify-end">
              <button
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-semibold shadow"
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
