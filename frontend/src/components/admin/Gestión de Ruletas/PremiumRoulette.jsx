"use client"

// src/components/admin/PremiumRoulette.jsx
import React, { useEffect, useMemo, useState, useCallback, useRef } from "react"
import { Trophy, Crown, Gift, Medal, X, ImageIcon } from "lucide-react"

/* ============================================================================
   CONSTANTES Y CONFIGURACIÓN
============================================================================ */

const TAU = Math.PI * 2

const PREMIUM_COLORS = [
  { base: "#3b82f6", light: "#60a5fa", dark: "#2563eb" },
  { base: "#06b6d4", light: "#22d3ee", dark: "#0891b2" },
  { base: "#8b5cf6", light: "#a78bfa", dark: "#7c3aed" },
  { base: "#ec4899", light: "#f472b6", dark: "#db2777" },
  { base: "#10b981", light: "#34d399", dark: "#059669" },
  { base: "#f59e0b", light: "#fbbf24", dark: "#d97706" },
  { base: "#ef4444", light: "#f87171", dark: "#dc2626" },
  { base: "#6366f1", light: "#818cf8", dark: "#4f46e5" },
]

const CENTER_ICON_MAP = {
  trophy: Trophy,
  crown: Crown,
  gift: Gift,
  medal: Medal,
}

/* ============================================================================
   UTILIDADES DE GEOMETRÍA Y CÁLCULOS - MEJORADAS
============================================================================ */

const calculateTextPosition = (segmentMidAngle, radius, participantCount, cx, cy) => {
  let textRadiusFactor
  // Ajustamos el factor para que el texto esté más cerca del centro
  if (participantCount <= 4) textRadiusFactor = 0.65
  else if (participantCount <= 8) textRadiusFactor = 0.68
  else if (participantCount <= 16) textRadiusFactor = 0.7
  else if (participantCount <= 30) textRadiusFactor = 0.72
  else if (participantCount <= 50) textRadiusFactor = 0.73
  else if (participantCount <= 80) textRadiusFactor = 0.74
  else if (participantCount <= 120) textRadiusFactor = 0.75
  else textRadiusFactor = 0.76

  const textRadius = radius * textRadiusFactor
  const x = cx + textRadius * Math.cos(segmentMidAngle)
  const y = cy + textRadius * Math.sin(segmentMidAngle)
  return { x, y }
}

const calculateTextRotation = (segmentMidAngle) => {
  let rotationDegrees = (segmentMidAngle * 180) / Math.PI
  // Ajustamos para que el texto siempre sea legible
  if (rotationDegrees > 90 && rotationDegrees < 270) {
    rotationDegrees += 180
  }
  return rotationDegrees
}

const calculateOptimalFontSize = (participantCount, mode) => {
  let fontSize
  if (participantCount <= 6) fontSize = mode === "focus" ? 20 : 18
  else if (participantCount <= 10) fontSize = mode === "focus" ? 17 : 15
  else if (participantCount <= 15) fontSize = mode === "focus" ? 15 : 13
  else if (participantCount <= 25) fontSize = mode === "focus" ? 13 : 11
  else if (participantCount <= 40) fontSize = mode === "focus" ? 11 : 9
  else if (participantCount <= 60) fontSize = mode === "focus" ? 9 : 8
  else if (participantCount <= 80) fontSize = mode === "focus" ? 8 : 7
  else if (participantCount <= 120) fontSize = mode === "focus" ? 7 : 6
  else if (participantCount <= 200) fontSize = mode === "focus" ? 6 : 5
  else fontSize = mode === "focus" ? 5 : 4
  return fontSize
}

const calculateMaxTextLength = (participantCount) => {
  if (participantCount <= 4) return 25
  if (participantCount <= 8) return 20
  if (participantCount <= 12) return 16
  if (participantCount <= 20) return 14
  if (participantCount <= 30) return 12
  if (participantCount <= 50) return 10
  if (participantCount <= 80) return 8
  if (participantCount <= 120) return 6
  if (participantCount <= 200) return 5
  return 4
}

/* ============================================================================
   HOOKS PERSONALIZADOS
============================================================================ */

/** Hook para auto-dimensionamiento del contenedor */
const useAutoSize = () => {
  const ref = useRef(null)
  const [size, setSize] = useState({ w: 0, h: 0 })

  useEffect(() => {
    if (!ref.current) return

    const updateSize = () => {
      if (!ref.current) return
      const rect = ref.current.getBoundingClientRect()
      setSize({ w: rect.width, h: rect.height })
    }

    const ro = new ResizeObserver(() => requestAnimationFrame(updateSize))
    ro.observe(ref.current)
    updateSize()

    return () => ro.disconnect()
  }, [])

  return { ref, w: size.w, h: size.h }
}

/** Hook para manejar la transición de giro con física realista */
const useRouletteTransition = (onTransitionEnd, spinDurationMs) => {
  const wheelRef = useRef(null)
  const phaseTimeoutRef = useRef(null)
  const [isTransitioning, setIsTransitioning] = useState(false)

  const cleanup = useCallback(() => {
    if (phaseTimeoutRef.current) {
      clearTimeout(phaseTimeoutRef.current)
      phaseTimeoutRef.current = null
    }
  }, [])

  const startTransition = useCallback(
    (fromAngle, toAngle, opts = { twoPhase: true }) => {
      const wheel = wheelRef.current
      if (!wheel) return

      cleanup()
      setIsTransitioning(true)

      wheel.style.transition = "none"
      wheel.style.transform = `rotate(${fromAngle}deg)`
      void wheel.offsetHeight

      const total = spinDurationMs

      if (!opts.twoPhase) {
        // Animación simple con desaceleración suave
        wheel.style.transition = `transform ${total}ms cubic-bezier(0.08, 0.8, 0.16, 1)`
        wheel.style.transform = `rotate(${toAngle}deg)`
        phaseTimeoutRef.current = setTimeout(() => {
          setIsTransitioning(false)
          onTransitionEnd?.()
        }, total + 100)
        return
      }

      // Fase 1: Aceleración rápida (20% del tiempo)
      const A_MS = Math.max(400, Math.floor(total * 0.2))
      // Fase 2: Desaceleración con rebote (80% del tiempo)
      const B_MS = Math.max(1000, total - A_MS)
      // Ángulo de impulso: 3-5 vueltas completas adicionales
      const extraSpins = 3 + Math.random() * 2
      const impulseAngle = fromAngle + 360 * extraSpins

      requestAnimationFrame(() => {
        // Fase 1: Aceleración lineal rápida
        wheel.style.transition = `transform ${A_MS}ms cubic-bezier(0.33, 0, 0.67, 0.33)`
        wheel.style.transform = `rotate(${impulseAngle}deg)`

        phaseTimeoutRef.current = setTimeout(() => {
          // Fase 2: Desaceleración suave con pequeño rebote al final
          wheel.style.transition = `transform ${B_MS}ms cubic-bezier(0.16, 1, 0.3, 1)`
          wheel.style.transform = `rotate(${toAngle}deg)`

          phaseTimeoutRef.current = setTimeout(() => {
            setIsTransitioning(false)
            onTransitionEnd?.()
          }, B_MS + 150)
        }, A_MS + 50)
      })
    },
    [spinDurationMs, onTransitionEnd, cleanup],
  )

  useEffect(() => {
    return () => cleanup()
  }, [cleanup])

  useEffect(() => {
    const wheel = wheelRef.current
    if (!wheel) return

    const handleEnd = (e) => {
      if (e.target === wheel && e.propertyName === "transform") {
        // Safety net
      }
    }

    wheel.addEventListener("transitionend", handleEnd)
    return () => {
      wheel.removeEventListener("transitionend", handleEnd)
      cleanup()
    }
  }, [cleanup])

  return { wheelRef, startTransition, isTransitioning }
}

/* ============================================================================
   UTILIDADES DE RENDERIZADO
============================================================================ */

const getRankMeta = (position) => {
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
      icon: React.createElement(Medal, { className: "w-3.5 h-3.5 text-amber-600" }),
      badgeClass: `${base} bg-amber-50 text-amber-700 border-amber-200`,
    }
  }

  if (position === 2) {
    return {
      label: "2°",
      icon: React.createElement(Medal, { className: "w-3.5 h-3.5 text-slate-500" }),
      badgeClass: `${base} bg-slate-50 text-slate-700 border-slate-200`,
    }
  }

  return {
    label: "3°",
    icon: React.createElement(Medal, { className: "w-3.5 h-3.5 text-orange-600" }),
    badgeClass: `${base} bg-orange-50 text-orange-700 border-orange-200`,
  }
}

/* ============================================================================
   COMPONENTE PRINCIPAL: PREMIUM ROULETTE
============================================================================ */

const PremiumRoulette = ({
  participants = [],
  isSpinning = false,
  angle = 0,
  winner = null,
  showWinnerAnimation = false,
  onTransitionEnd,
  onDismissWinner,
  spinDurationMs = 5000,
  pointerSide = "right",
  mode = "page",
  centerIconKey = "trophy",
}) => {
  const box = useAutoSize()
  const { wheelRef, startTransition, isTransitioning } = useRouletteTransition(onTransitionEnd, spinDurationMs)
  const [lastAngle, setLastAngle] = useState(0)

  /* ========== Cálculo de Layout Responsivo MEJORADO ========== */
  const layout = useMemo(() => {
    const padding = 24
    const availableW = Math.max(0, box.w - padding * 2)
    const availableH = Math.max(0, box.h - padding * 2)

    if (!availableW || !availableH) {
      return { size: 0, radius: 0, fontSize: 12 }
    }

    const maxSize = Math.min(availableW, availableH)
    const n = Math.max(1, participants.length)
    let baseSize

    if (mode === "focus") {
      if (n <= 4) baseSize = Math.min(maxSize * 0.95, 650)
      else if (n <= 8) baseSize = Math.min(maxSize * 0.96, 680)
      else if (n <= 16) baseSize = Math.min(maxSize * 0.97, 720)
      else if (n <= 30) baseSize = Math.min(maxSize * 0.98, 760)
      else if (n <= 50) baseSize = Math.min(maxSize * 0.99, 800)
      else if (n <= 80) baseSize = Math.min(maxSize * 1.0, 850)
      else if (n <= 120) baseSize = Math.min(maxSize * 1.0, 900)
      else baseSize = Math.min(maxSize * 1.0, 950)
    } else {
      if (n <= 4) baseSize = Math.min(maxSize * 0.9, 550)
      else if (n <= 8) baseSize = Math.min(maxSize * 0.92, 580)
      else if (n <= 16) baseSize = Math.min(maxSize * 0.94, 620)
      else if (n <= 30) baseSize = Math.min(maxSize * 0.96, 660)
      else if (n <= 50) baseSize = Math.min(maxSize * 0.98, 700)
      else if (n <= 80) baseSize = Math.min(maxSize * 0.99, 750)
      else if (n <= 120) baseSize = Math.min(maxSize * 1.0, 800)
      else baseSize = Math.min(maxSize * 1.0, 850)
    }

    const size = Math.floor(baseSize)
    const radius = Math.max(mode === "focus" ? 160 : 140, Math.floor(size / 2) - 12)
    const fontSize = calculateOptimalFontSize(n, mode)

    return { size, radius, fontSize }
  }, [box.w, box.h, participants.length, mode])

  const { size, radius, fontSize } = layout
  const cx = size / 2
  const cy = size / 2

  /* ========== Generación de Segmentos OPTIMIZADA ========== */
  const segments = useMemo(() => {
    const n = Math.max(participants.length, 1)
    const step = TAU / n

    if (participants.length === 0) {
      const c = PREMIUM_COLORS[0]
      return [
        {
          idx: 0,
          start: 0,
          end: TAU,
          mid: TAU / 2,
          color: c.base,
          light: c.light,
          dark: c.dark,
          label: "—",
          id: 0,
          isEmpty: true,
        },
      ]
    }

    return participants.map((p, idx) => {
      const start = idx * step
      const end = start + step
      const c = PREMIUM_COLORS[idx % PREMIUM_COLORS.length]

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
      }
    })
  }, [participants])

  /* ========== Funciones de Renderizado SVG ========== */
  const createSegmentPath = useCallback(
    (start, end) => {
      const x0 = cx + radius * Math.cos(start)
      const y0 = cy + radius * Math.sin(start)
      const x1 = cx + radius * Math.cos(end)
      const y1 = cy + radius * Math.sin(end)
      const largeArc = end - start > Math.PI ? 1 : 0

      return `M ${cx} ${cy} L ${x0} ${y0} A ${radius} ${radius} 0 ${largeArc} 1 ${x1} ${y1} Z`
    },
    [cx, cy, radius],
  )

  const truncate = useCallback((text, maxLen) => {
    if (!text || typeof text !== "string") return ""
    return text.length <= maxLen ? text : text.substring(0, maxLen - 1) + "…"
  }, [])

  const getDisplayText = useCallback(
    (segment, participantCount) => {
      const maxLen = calculateMaxTextLength(participantCount)
      if (participantCount > 150) return `${segment.idx + 1}`
      if (participantCount > 100) return `#${segment.idx + 1}`
      return truncate(segment.label, maxLen)
    },
    [truncate],
  )

  /* ========== Control de Animación ========== */
  useEffect(() => {
    if (isSpinning && size > 0 && !isTransitioning && angle !== lastAngle) {
      startTransition(lastAngle, angle, { twoPhase: true })
      setLastAngle(angle)
    }
  }, [isSpinning, angle, size, startTransition, lastAngle, isTransitioning])

  /* ========== Configuración Visual MEJORADA ========== */
  const heights =
    mode === "focus"
      ? "h-[580px] sm:h-[680px] md:h-[760px] lg:h-[820px]"
      : "h-[520px] sm:h-[580px] md:h-[640px] lg:h-[700px]"

  const centerOuterR = Math.max(mode === "focus" ? 28 : 24, radius * 0.145)
  const centerInnerR = Math.max(4, radius * 0.028)
  const iconPx = Math.max(16, Math.floor(centerOuterR * 0.88))
  const CenterIcon = CENTER_ICON_MAP[centerIconKey] || Trophy

  const strokeWidth = participants.length > 100 ? 2 : participants.length > 50 ? 2.5 : 3.5

  /* ========== Renderizado ========== */
  return (
    <div className="w-full h-full p-4">
      <div
        ref={box.ref}
        className={`relative w-full ${heights} rounded-3xl bg-gradient-to-br from-white to-slate-50 border border-slate-200 shadow-xl overflow-hidden grid place-items-center`}
      >
        <div className="absolute inset-0 rounded-3xl shadow-[inset_0_2px_20px_rgba(0,0,0,0.05)]" aria-hidden="true" />

        <div style={{ filter: "drop-shadow(0 10px 25px rgba(0,0,0,0.15))" }}>
          <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            className="select-none"
            ref={wheelRef}
            aria-label="Ruleta de participantes"
            style={{ transformOrigin: `${cx}px ${cy}px` }}
          >
            {participants.length > 0 && (
              <>
                <circle cx={cx} cy={cy} r={radius + 2} fill="none" stroke="rgba(0,0,0,0.15)" strokeWidth="4" />
                <circle cx={cx} cy={cy} r={radius} fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2" />
              </>
            )}

            {participants.length > 0 ? (
              segments.map((seg) => {
                const textPos = calculateTextPosition(seg.mid, radius, participants.length, cx, cy)
                const textRotation = calculateTextRotation(seg.mid)
                const displayText = getDisplayText(seg, participants.length)

                const showDots = participants.length <= 100
                const dotRadius = radius + 8
                const dotX = cx + dotRadius * Math.cos(seg.end)
                const dotY = cy + dotRadius * Math.sin(seg.end)

                return (
                  <g key={seg.idx}>
                    <defs>
                      <radialGradient id={`g${seg.idx}`} cx="35%" cy="25%" r="85%">
                        <stop offset="0%" stopColor={seg.light} stopOpacity="0.95" />
                        <stop offset="60%" stopColor={seg.color} />
                        <stop offset="100%" stopColor={seg.dark} stopOpacity="0.9" />
                      </radialGradient>
                    </defs>

                    <path
                      d={createSegmentPath(seg.start, seg.end)}
                      fill={`url(#g${seg.idx})`}
                      stroke="#ffffff"
                      strokeWidth={strokeWidth}
                      style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.1))" }}
                    />

                    {showDots && (
                      <circle cx={dotX} cy={dotY} r="4" fill="#ffffff" stroke="rgba(0,0,0,0.15)" strokeWidth="1.5" />
                    )}

                    {displayText && (
                      <text
                        x={textPos.x}
                        y={textPos.y}
                        fontSize={fontSize}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="#ffffff"
                        fontWeight={participants.length > 50 ? "700" : "600"}
                        style={{
                          paintOrder: "stroke",
                          stroke: "rgba(0,0,0,0.75)",
                          strokeWidth: participants.length > 100 ? 2 : participants.length > 50 ? 2.5 : 3,
                          strokeLinecap: "round",
                          strokeLinejoin: "round",
                          filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.3))",
                        }}
                        transform={`rotate(${textRotation} ${textPos.x} ${textPos.y})`}
                      >
                        {displayText}
                      </text>
                    )}
                  </g>
                )
              })
            ) : (
              <circle cx={cx} cy={cy} r={radius} fill="url(#emptyGradient)" stroke="#e5e7eb" strokeWidth="3" />
            )}

            <defs>
              <radialGradient id="centerG" cx="50%" cy="30%" r="70%">
                <stop offset="0%" stopColor="#475569" />
                <stop offset="60%" stopColor="#334155" />
                <stop offset="100%" stopColor="#1e293b" />
              </radialGradient>
              <radialGradient id="emptyGradient" cx="50%" cy="50%" r="70%">
                <stop offset="0%" stopColor="#f1f5f9" />
                <stop offset="100%" stopColor="#e2e8f0" />
              </radialGradient>
            </defs>

            <circle cx={cx} cy={cy} r={centerOuterR + 2} fill="rgba(0,0,0,0.2)" filter="blur(4px)" />
            <circle
              cx={cx}
              cy={cy}
              r={centerOuterR}
              fill="url(#centerG)"
              stroke="#ffffff"
              strokeWidth="3"
              style={{ filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.2))" }}
            />
            <circle cx={cx} cy={cy} r={centerInnerR} fill="#f8fafc" />
          </svg>
        </div>

        <div
          className="pointer-events-none absolute z-10 text-white drop-shadow-lg"
          style={{
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
          }}
          aria-hidden="true"
        >
          <CenterIcon style={{ width: iconPx, height: iconPx }} />
        </div>

        {participants.length > 0 && (
  <div
    className="pointer-events-none absolute z-20"
    style={{
      right: `${(box.w - size) / 2 - 20}px`,
      top: `${box.h / 2}px`,
      transform: "translateY(-50%)",
    }}
    aria-hidden="true"
  >
    <div className="relative">
      {/* Flecha del puntero - MÁS GRANDE */}
      <div className="absolute top-1/2 -translate-y-1/2 right-0">
        <svg width="42" height="32" viewBox="0 0 42 32" fill="none">
          <path
            d="M0 16 L30 0 L30 10 L42 16 L30 22 L30 32 Z"
            fill="#1e293b"
            stroke="white"
            strokeWidth="1.3"
            style={{ filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.3))" }}
          />
        </svg>
      </div>

      {/* Círculo del puntero - MÁS PEQUEÑO */}
      <div className="relative" style={{ marginRight: "-16px" }}>
        <div className="absolute inset-0 w-9 h-9 rounded-full bg-black/30 blur-md" />
        <div className="relative w-9 h-9 rounded-full bg-gradient-to-br from-slate-800 to-black shadow-2xl border-3 border-white">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow-inner" />
        </div>
      </div>
    </div>
  </div>
)}
        {showWinnerAnimation && winner && (
          <div className="absolute inset-x-0 bottom-6 z-50 flex flex-col items-center animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="px-5 py-3 rounded-2xl bg-gradient-to-br from-amber-50 to-amber-100 border-2 border-amber-300 shadow-2xl flex flex-col items-center gap-3 max-w-md mx-4">
              <div className="flex items-center gap-3">
                <Trophy className="w-6 h-6 text-amber-600 animate-bounce" />
                <span className="text-amber-900 font-extrabold text-xl tracking-wide text-center">
                  ¡FELICIDADES {typeof winner === "string" ? winner : winner.name}!
                </span>
              </div>

              {typeof winner === "object" && winner.prize && (
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    {winner.prize.image_url ? (
                      <img
                        src={winner.prize.image_url || "/placeholder.svg"}
                        alt={winner.prize.name || "Premio"}
                        className="w-8 h-8 rounded object-cover border-2 border-amber-400 shadow-md"
                      />
                    ) : (
                      <ImageIcon className="w-5 h-5 text-emerald-600" />
                    )}
                    <span className="text-emerald-800 font-bold text-lg">{winner.prize.name}</span>
                  </div>

                  {winner.prize.description && (
                    <p className="text-slate-700 text-sm max-w-xs">{winner.prize.description}</p>
                  )}

                  {winner.prize.position != null && (
                    <div className="mt-2 flex justify-center">
                      <span className={`${getRankMeta(winner.prize.position).badgeClass} text-base px-3 py-1`}>
                        {getRankMeta(winner.prize.position).icon}
                        {getRankMeta(winner.prize.position).label}
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-center gap-2 mt-1">
                <button
                  type="button"
                  onClick={onDismissWinner}
                  className="pointer-events-auto inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 hover:from-slate-900 hover:to-black text-white text-sm font-semibold shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
                  aria-label="Cerrar mensaje de ganador"
                >
                  <X className="w-4 h-4" />
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}

        {participants.length > 50 && (
          <div className="absolute top-4 right-4 bg-gradient-to-br from-slate-800 to-slate-900 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg backdrop-blur-sm border border-white/20">
            {participants.length} participantes
          </div>
        )}
      </div>
    </div>
  )
}

export default PremiumRoulette
