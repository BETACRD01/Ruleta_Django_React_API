// src/components/DrawTools.jsx
import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  RotateCcw, Play, Users, Calendar, Clock, RefreshCcw, Award, AlertTriangle,
  Gift, Trophy, Star, Package, Crown, Sparkles, DollarSign, Target
} from "lucide-react";
import { roulettesAPI } from "../../config/api";

const TAU = Math.PI * 2;

// Paleta de colores elegante para la ruleta
const CASINO_COLORS = [
  "#FF6B35", "#4ECDC4", "#FFE66D", "#A8E6CF", "#FF8B94", "#C7CEEA",
  "#FECA57", "#48CAE4", "#F38BA8", "#95E1D3", "#A8DADC", "#F1FAEE",
  "#E63946", "#F77F00", "#6A994E", "#277DA1", "#7209B7", "#F72585",
  "#4C956C", "#F2E9E4", "#C9ADA7", "#2F3E46", "#52B788", "#168AAD"
];

const deg = (rad) => (rad * 180) / Math.PI;

const DrawTools = ({ onRefresh }) => {
  // ---- Estado base
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState("");
  const [list, setList] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState(null);
  const [prizes, setPrizes] = useState([]);
  
  // ---- Estado de la ruleta integrada
  const [rouletteAngle, setRouletteAngle] = useState(0);
  const [rouletteSpinning, setRouletteSpinning] = useState(false);
  const [rouletteWinner, setRouletteWinner] = useState(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [confettiParticles, setConfettiParticles] = useState([]);
  
  // ---- Estado del modal de ganador
  const [winnerData, setWinnerData] = useState(null);
  const [showWinnerModal, setShowWinnerModal] = useState(false);

  const selectedExistsRef = useRef(false);
  const wheelRef = useRef(null);
  const celebrationTimeoutRef = useRef(null);

  // ---- Funciones de carga (sin cambios)
  const loadList = useCallback(async () => {
    setError("");
    try {
      const res = await roulettesAPI.getRoulettes({ page_size: 100, status: "active" });
      const items = (res?.results || res || []).filter((r) => !r.is_drawn);
      setList(items);

      const stillThere = items.some((r) => String(r.id) === String(selectedId));
      selectedExistsRef.current = stillThere;

      if (!selectedId && items.length > 0) setSelectedId(String(items[0].id));
      if (selectedId && !stillThere && items.length > 0) setSelectedId(String(items[0].id));
      if (items.length === 0) {
        setSelectedId("");
        setDetail(null);
        setPrizes([]);
      }
    } catch (e) {
      setError(e?.message || "Error cargando sorteos pendientes");
    }
  }, [selectedId]);

  const loadDetail = useCallback(async (id) => {
    if (!id) {
      setDetail(null);
      setPrizes([]);
      return;
    }
    try {
      setError("");
      const [rouletteDetail, prizesData] = await Promise.all([
        roulettesAPI.getRoulette(Number(id)),
        roulettesAPI.listPrizes(Number(id)).catch(() => []),
      ]);
      setDetail(rouletteDetail);
      setPrizes(prizesData?.results || prizesData || []);
    } catch (e) {
      setError(e?.message || "Error cargando detalle de la ruleta");
      setDetail(null);
      setPrizes([]);
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadList();
      setLoading(false);
    })();
  }, [loadList]);

  useEffect(() => { 
    if (selectedId) loadDetail(selectedId); 
  }, [selectedId, loadDetail]);

  // ---- Datos procesados
  const participants = useMemo(() => {
    const arr = detail?.participants || [];
    return arr.map((p, i) => ({
      id: p.id ?? i + 1,
      num: p.participant_number ?? (i + 1),
      name: p.user_name ?? `Participante ${i + 1}`,
      email: p.email || '',
      isWinner: !!p.is_winner,
    }));
  }, [detail]);

  const canExecute = useMemo(() => {
    const r = list.find((x) => String(x.id) === String(selectedId));
    const count = r?.participants_count ?? participants.length;
    return !!selectedId && !executing && !rouletteSpinning && (count > 0);
  }, [list, selectedId, executing, rouletteSpinning, participants.length]);

  // ---- Funciones de la ruleta integrada
  const adjustBrightness = useCallback((hex, percent) => {
    const num = parseInt(hex.replace("#", ""), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.max(0, Math.min(255, (num >> 16) + amt));
    const G = Math.max(0, Math.min(255, (num >> 8 & 0x00FF) + amt));
    const B = Math.max(0, Math.min(255, (num & 0x0000FF) + amt));
    return "#" + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
  }, []);

  // Configuración dinámica de la ruleta
  const wheelConfig = useMemo(() => {
    const numParticipants = participants.length;
    if (numParticipants <= 6) return { radius: 180, size: 400, fontSize: 13, textRadius: 0.75 };
    if (numParticipants <= 10) return { radius: 200, size: 440, fontSize: 11, textRadius: 0.78 };
    if (numParticipants <= 15) return { radius: 220, size: 480, fontSize: 10, textRadius: 0.8 };
    return { radius: 240, size: 520, fontSize: 9, textRadius: 0.82 };
  }, [participants.length]);

  const { radius, size, fontSize, textRadius } = wheelConfig;
  const cx = size / 2, cy = size / 2;

  // Segmentos de la ruleta
  const segments = useMemo(() => {
    const n = Math.max(participants.length, 1);
    const step = TAU / n;
    return participants.map((p, idx) => {
      const start = idx * step;
      const end = start + step;
      const color = CASINO_COLORS[idx % CASINO_COLORS.length];
      
      return {
        idx,
        start,
        end,
        mid: start + step / 2,
        color,
        darkColor: adjustBrightness(color, -30),
        lightColor: adjustBrightness(color, 20),
        label: p.name,
        id: p.id,
      };
    });
  }, [participants, adjustBrightness]);

  const createSegmentPath = useCallback((start, end) => {
    const x0 = cx + radius * Math.cos(start);
    const y0 = cy + radius * Math.sin(start);
    const x1 = cx + radius * Math.cos(end);
    const y1 = cy + radius * Math.sin(end);
    const largeArc = end - start > Math.PI ? 1 : 0;
    return `M ${cx} ${cy} L ${x0} ${y0} A ${radius} ${radius} 0 ${largeArc} 1 ${x1} ${y1} Z`;
  }, [cx, cy, radius]);

  const findWinnerByAngle = useCallback((finalAngle) => {
    const normalizedAngle = ((finalAngle % 360) + 360) % 360;
    const pointerAngle = (270 - normalizedAngle + 360) % 360;
    const radians = (pointerAngle * Math.PI) / 180;
    
    for (const seg of segments) {
      if (radians >= seg.start && radians <= seg.end) {
        return participants[seg.idx];
      }
    }
    return participants[0];
  }, [segments, participants]);

  const createConfetti = useCallback(() => {
    const particles = [];
    for (let i = 0; i < 80; i++) {
      particles.push({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        rotation: Math.random() * 360,
        delay: Math.random() * 3,
        color: CASINO_COLORS[Math.floor(Math.random() * CASINO_COLORS.length)],
        size: Math.random() * 8 + 6,
        speed: Math.random() * 2.5 + 1.5
      });
    }
    setConfettiParticles(particles);
  }, []);

  // Selección de premio ponderada
  const selectRandomPrize = useCallback(() => {
    if (prizes.length === 0) return null;

    const withP = prizes.filter(p => Number(p.probability) > 0);
    if (withP.length > 0) {
      const total = withP.reduce((s, p) => s + Number(p.probability || 0), 0);
      let rnd = Math.random() * total;
      for (const prize of withP) {
        rnd -= Number(prize.probability || 0);
        if (rnd <= 0) return prize;
      }
      return withP[withP.length - 1];
    }

    const available = prizes.filter(p => !p.quantity || p.quantity > 0);
    if (available.length === 0) return prizes[0];
    return available[Math.floor(Math.random() * available.length)];
  }, [prizes]);

  // Eventos de transición de la ruleta
  useEffect(() => {
    const node = wheelRef.current;
    if (!node) return;
    
    const onTransitionEnd = () => {
      if (rouletteSpinning) {
        setRouletteSpinning(false);
        const currentWinner = findWinnerByAngle(rouletteAngle);
        
        setRouletteWinner(currentWinner);
        setShowCelebration(true);
        createConfetti();
        
        celebrationTimeoutRef.current = setTimeout(() => {
          setShowCelebration(false);
          setConfettiParticles([]);
          
          // Mostrar modal del ganador con premio
          const selectedPrize = selectRandomPrize();
          setWinnerData({
            winner: {
              name: currentWinner.name,
              email: currentWinner.email || '',
              id: currentWinner.id
            },
            prize: selectedPrize,
            roulette: {
              name: detail?.name || '',
              id: selectedId
            },
            timestamp: new Date().toISOString()
          });
          setShowWinnerModal(true);
        }, 4000);
      }
    };
    
    node.addEventListener("transitionend", onTransitionEnd);
    return () => {
      node.removeEventListener("transitionend", onTransitionEnd);
      if (celebrationTimeoutRef.current) {
        clearTimeout(celebrationTimeoutRef.current);
      }
    };
  }, [rouletteAngle, rouletteSpinning, findWinnerByAngle, createConfetti, selectRandomPrize, detail, selectedId]);

  // ---- Ejecutar sorteo
  const execute = async () => {
    if (!canExecute) {
      alert("Esta ruleta no tiene participantes.");
      return;
    }
    if (!window.confirm("¿Ejecutar el sorteo ahora?")) return;

    try {
      setExecuting(true);
      setRouletteWinner(null);
      setShowCelebration(false);
      
      // Girar la ruleta
      const baseAngle = rouletteAngle % 360;
      const spins = 5 + Math.random() * 3;
      const randomAngle = Math.random() * 360;
      const finalAngle = baseAngle + (spins * 360) + randomAngle;
      
      setRouletteSpinning(true);
      setRouletteAngle(finalAngle);
      
      // Ejecutar sorteo oficial en paralelo
      const result = await roulettesAPI.executeRouletteDraw(Number(selectedId));
      if (!result?.success) throw new Error(result?.message || "No se pudo ejecutar el sorteo.");

      // Actualizar listas
      await Promise.all([loadList(), loadDetail(selectedId)]);
      onRefresh?.();
      
    } catch (e) {
      alert("Error al ejecutar sorteo: " + (e?.message || "Error"));
      setRouletteSpinning(false);
    } finally {
      setExecuting(false);
    }
  };

  const truncateText = (text, maxLength) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 1) + "…";
  };

  const maxTextLength = useMemo(() => {
    const numParticipants = participants.length;
    if (numParticipants <= 6) return 16;
    if (numParticipants <= 10) return 14;
    if (numParticipants <= 15) return 12;
    return 10;
  }, [participants.length]);

  // ---- Componente de ruleta integrada
  const IntegratedRoulette = () => {
    if (participants.length === 0) {
      return (
        <div className="flex items-center justify-center h-full min-h-[400px] bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl">
          <div className="text-center p-8">
            <Target className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <h3 className="text-xl font-semibold text-gray-600 mb-2">Sin Participantes</h3>
            <p className="text-gray-500">Selecciona una ruleta con participantes para comenzar</p>
          </div>
        </div>
      );
    }

    return (
      <div className="relative bg-gradient-to-br from-purple-900 via-red-800 to-pink-900 rounded-2xl p-6 min-h-[500px] flex items-center justify-center overflow-hidden">
        {/* Partículas de fondo */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-yellow-400 opacity-30 rounded-full"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animation: `twinkle ${2 + Math.random() * 4}s ease-in-out infinite`,
                animationDelay: `${Math.random() * 4}s`
              }}
            />
          ))}
        </div>

        {/* Confetti */}
        {showCelebration && (
          <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
            {confettiParticles.map((particle) => (
              <div
                key={particle.id}
                className="absolute rounded-full"
                style={{
                  left: `${particle.x}%`,
                  top: `-5%`,
                  width: `${particle.size}px`,
                  height: `${particle.size}px`,
                  backgroundColor: particle.color,
                  animation: `confetti-fall ${particle.speed}s linear infinite`,
                  animationDelay: `${particle.delay}s`,
                  transform: `rotate(${particle.rotation}deg)`
                }}
              />
            ))}
          </div>
        )}

        {/* Header */}
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-20">
          <div className="flex items-center gap-2 bg-black bg-opacity-30 backdrop-blur-sm rounded-full px-4 py-2 border border-yellow-400">
            <Users className="w-4 h-4 text-yellow-300" />
            <span className="text-yellow-100 text-sm font-semibold">
              {participants.length} Participantes
            </span>
          </div>
        </div>

        {/* Ruleta */}
        <div className="relative z-10">
          {/* Puntero */}
          <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 z-30">
            <div className="w-0 h-0 border-l-[16px] border-r-[16px] border-b-[32px] border-l-transparent border-r-transparent border-b-yellow-500 drop-shadow-xl">
              <div className="absolute top-1 left-1/2 transform -translate-x-1/2">
                <div className="w-0 h-0 border-l-[12px] border-r-[12px] border-b-[24px] border-l-transparent border-r-transparent border-b-red-600" />
              </div>
            </div>
          </div>

          {/* SVG de la ruleta */}
          <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            className="drop-shadow-2xl"
          >
            <defs>
              <linearGradient id="goldBorder" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FFD700" />
                <stop offset="50%" stopColor="#FFA500" />
                <stop offset="100%" stopColor="#FFD700" />
              </linearGradient>
              
              <filter id="goldGlow">
                <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>

              {segments.map((seg, i) => (
                <linearGradient key={`segGrad-${i}`} id={`segmentGradient-${i}`} x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor={seg.lightColor} />
                  <stop offset="50%" stopColor={seg.color} />
                  <stop offset="100%" stopColor={seg.darkColor} />
                </linearGradient>
              ))}
            </defs>

            {/* Sombra exterior */}
            <circle cx={cx} cy={cy} r={radius + 20} fill="rgba(0,0,0,0.4)" />

            {/* Borde dorado */}
            <circle 
              cx={cx} 
              cy={cy} 
              r={radius + 15} 
              fill="url(#goldBorder)"
              filter="url(#goldGlow)"
            />
            <circle cx={cx} cy={cy} r={radius + 8} fill="#B8860B" />

            {/* Rueda giratoria */}
            <g
              ref={wheelRef}
              style={{
                transform: `rotate(${rouletteAngle}deg)`,
                transformOrigin: `${cx}px ${cy}px`,
                transition: rouletteSpinning ? 'transform 4s cubic-bezier(0.25, 0.1, 0.25, 1)' : 'none'
              }}
            >
              {segments.map((seg) => (
                <g key={seg.idx}>
                  <path
                    d={createSegmentPath(seg.start, seg.end)}
                    fill={`url(#segmentGradient-${seg.idx})`}
                    stroke="#2d3748"
                    strokeWidth="1.5"
                  />
                  
                  <g>
                    {(() => {
                      const textR = radius * textRadius;
                      const x = cx + textR * Math.cos(seg.mid);
                      const y = cy + textR * Math.sin(seg.mid);
                      const rotation = deg(seg.mid) + 90;
                      const textRotation = rotation > 90 && rotation < 270 ? rotation + 180 : rotation;
                      
                      return (
                        <g transform={`rotate(${textRotation} ${x} ${y})`}>
                          <text
                            x={x + 1}
                            y={y + 1}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fontSize={fontSize}
                            fill="rgba(0,0,0,0.7)"
                            fontWeight="bold"
                            fontFamily="Arial, sans-serif"
                          >
                            {truncateText(seg.label, maxTextLength)}
                          </text>
                          <text
                            x={x}
                            y={y}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fontSize={fontSize}
                            fill="#ffffff"
                            fontWeight="bold"
                            fontFamily="Arial, sans-serif"
                          >
                            {truncateText(seg.label, maxTextLength)}
                          </text>
                        </g>
                      );
                    })()}
                  </g>
                </g>
              ))}
            </g>

            {/* Centro dorado */}
            <circle cx={cx} cy={cy} r={40} fill="url(#goldBorder)" filter="url(#goldGlow)" />
            <circle cx={cx} cy={cy} r={32} fill="#1a202c" stroke="#FFD700" strokeWidth="2" />
            
            <g transform={`translate(${cx-10}, ${cy-10})`}>
              <Star className="w-5 h-5 text-yellow-400" fill="currentColor" />
            </g>
          </svg>
        </div>

        {/* Resultado del ganador */}
        {rouletteWinner && !rouletteSpinning && (
          <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-20">
            <div className="bg-gradient-to-r from-yellow-400 to-orange-500 rounded-2xl p-4 shadow-2xl border-2 border-white text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Trophy className="w-8 h-8 text-white" />
                <Crown className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-1">¡GANADOR!</h3>
              <p className="text-xl font-bold text-white">{rouletteWinner.name}</p>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ---- Modal del ganador mejorado
  const WinnerModal = () => {
    if (!showWinnerModal || !winnerData) return null;
    const { winner, prize, roulette } = winnerData;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50 animate-fadeIn">
        <div className="bg-white rounded-3xl max-w-lg w-full p-8 transform animate-slideUp shadow-2xl">
          <div className="text-center mb-6 relative">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-32 h-32 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full opacity-20 animate-pulse"></div>
            </div>
            <div className="relative z-10">
              <div className="flex items-center justify-center gap-4 mb-4">
                <Trophy className="w-16 h-16 text-yellow-500 animate-bounce" />
                <Crown className="w-16 h-16 text-yellow-500 animate-bounce" style={{animationDelay: '0.2s'}} />
              </div>
              <h2 className="text-4xl font-bold text-gray-900 mb-2">¡FELICIDADES!</h2>
              <div className="flex items-center justify-center gap-2 mb-4">
                <Sparkles className="w-6 h-6 text-yellow-500" />
                <span className="text-2xl font-bold text-blue-600">{winner.name}</span>
                <Sparkles className="w-6 h-6 text-yellow-500" />
              </div>
            </div>
          </div>

          {prize && (
            <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-2xl p-6 mb-6 border-2 border-yellow-200">
              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center justify-center gap-2">
                  <Gift className="w-6 h-6 text-yellow-600" />
                  Has ganado
                </h3>
                {prize.image && (
                  <div className="mb-4">
                    <img
                      src={prize.image}
                      alt={prize.name}
                      className="w-32 h-32 object-cover rounded-xl mx-auto shadow-lg border-2 border-white"
                    />
                  </div>
                )}
                <h4 className="text-2xl font-bold text-gray-900 mb-2">{prize.name}</h4>
                {prize.description && <p className="text-gray-600 text-sm mb-3">{prize.description}</p>}
                {prize.value && (
                  <div className="inline-flex items-center gap-2 bg-green-100 text-green-800 px-4 py-2 rounded-full font-bold text-lg">
                    <DollarSign className="w-5 h-5" />
                    {prize.value}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="bg-gray-50 rounded-xl p-4 mb-6">
            <div className="text-center text-sm text-gray-600">
              <p>Ruleta: <span className="font-semibold text-gray-800">{roulette.name}</span></p>
              <p>Fecha: <span className="font-semibold text-gray-800">
                {new Date(winnerData.timestamp).toLocaleDateString('es-ES', {
                  year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
                })}
              </span></p>
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => setShowWinnerModal(false)}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-3 px-6 rounded-xl font-semibold hover:from-blue-600 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              Cerrar
            </button>
            {prize && (
              <button
                onClick={() => {
                  navigator.clipboard.writeText(
                    `¡${winner.name} ha ganado ${prize.name} en la ruleta ${roulette.name}!`
                  );
                  alert('Información copiada al portapapeles');
                }}
                className="w-full bg-gray-100 text-gray-700 py-2 px-6 rounded-xl font-medium hover:bg-gray-200 transition-colors duration-200"
              >
                Compartir resultado
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ---- Renderizar premio individual (sin cambios)
  const renderPrize = (prize, index) => (
    <div
      key={prize.id || index}
      className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-lg p-3 hover:shadow-md transition-shadow duration-200"
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          {prize.image ? (
            <img
              src={prize.image}
              alt={prize.name}
              className="w-12 h-12 rounded-lg object-cover border border-yellow-300"
            />
          ) : (
            <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-lg flex items-center justify-center">
              <Gift className="w-6 h-6 text-white" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-sm font-semibold text-gray-900 truncate">
              {prize.name || "Premio sin nombre"}
            </h4>
            {prize.value && (
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                ${prize.value}
              </span>
            )}
          </div>

          {prize.description && (
            <p className="text-xs text-gray-600 mb-2 line-clamp-2">
              {prize.description}
            </p>
          )}

          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-3">
              {prize.quantity && (
                <span className="flex items-center gap-1">
                  <Package className="w-3 h-3" />
                  {prize.quantity} unidades
                </span>
              )}
              {prize.probability && (
                <span className="flex items-center gap-1">
                  <Star className="w-3 h-3" />
                  {prize.probability}% prob.
                </span>
              )}
            </div>
            {prize.is_main_prize && (
              <span className="text-yellow-600 font-medium flex items-center gap-1">
                <Trophy className="w-3 h-3" />
                Principal
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Modal del ganador */}
      <WinnerModal />

      {/* Título mejorado */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-2 rounded-lg">
            <RotateCcw className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Herramientas de Sorteo</h2>
            <p className="text-sm text-gray-600">Ejecuta sorteos oficiales con ruleta interactiva</p>
          </div>
        </div>
        <button
          onClick={async () => {
            setLoading(true);
            await Promise.all([loadList(), selectedId ? loadDetail(selectedId) : Promise.resolve()]);
            setLoading(false);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors duration-200 disabled:opacity-60"
          disabled={loading}
        >
          <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> 
          Refrescar
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-lg">
          <div className="flex items-start">
            <AlertTriangle className="h-5 w-5 text-red-400 mt-0.5 mr-3" />
            <div>
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Panel principal con ruleta integrada */}
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
        <div className="flex flex-col 2xl:flex-row min-h-[700px]">
          {/* Panel de controles optimizado */}
          <div className="flex-shrink-0 2xl:w-96 bg-gradient-to-br from-gray-50 to-white border-b 2xl:border-b-0 2xl:border-r border-gray-200">
            <div className="p-6 space-y-6">
              {/* Header del panel */}
              <div className="text-center pb-4 border-b border-gray-200">
                <div className="bg-gradient-to-r from-blue-100 to-purple-100 p-4 rounded-xl mb-4">
                  <Play className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                  <h3 className="text-lg font-bold text-gray-900">Control de Sorteo</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Selecciona una ruleta y ejecuta el sorteo oficial
                  </p>
                </div>
              </div>

              {/* Selector de ruleta */}
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-gray-700">
                  Ruleta Activa
                </label>
                <select
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white transition-all duration-200 text-sm"
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value)}
                  disabled={loading || list.length === 0}
                >
                  <option value="">
                    {loading ? "Cargando..." : list.length === 0 ? "Sin ruletas disponibles" : "Seleccionar ruleta"}
                  </option>
                  {list.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} — {(r.participants_count || 0)} participante{(r.participants_count || 0) !== 1 ? 's' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Botón de ejecutar mejorado */}
              <button
                onClick={execute}
                disabled={!canExecute}
                className={`w-full px-6 py-4 rounded-xl text-base font-bold text-white transition-all duration-300 transform relative overflow-hidden ${
                  !canExecute 
                    ? "bg-gray-400 cursor-not-allowed" 
                    : "bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 hover:shadow-xl hover:scale-105 bg-size-200 hover:bg-pos-100"
                }`}
                style={{
                  backgroundSize: '200% 100%',
                  backgroundPosition: canExecute ? '0% 0%' : 'center'
                }}
              >
                {executing || rouletteSpinning ? (
                  <span className="inline-flex items-center gap-3">
                    <RefreshCcw className="h-5 w-5 animate-spin" /> 
                    {rouletteSpinning ? "Girando Ruleta..." : "Ejecutando Sorteo..."}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-3">
                    <Play className="h-5 w-5" /> 
                    EJECUTAR SORTEO OFICIAL
                  </span>
                )}
                
                {canExecute && !executing && !rouletteSpinning && (
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-25 transform -skew-x-12 animate-pulse" />
                )}
              </button>

              {/* Resumen mejorado */}
              <div className="bg-white rounded-xl p-5 border-2 border-gray-100 shadow-sm">
                <h4 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <Target className="h-4 w-4 text-blue-500" />
                  Resumen de Ruleta
                </h4>
                
                {!detail ? (
                  <div className="text-center py-4">
                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <RotateCcw className="h-6 w-6 text-gray-400" />
                    </div>
                    <p className="text-sm text-gray-500">Selecciona una ruleta</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-3">
                      <h5 className="font-bold text-gray-900 text-sm mb-2">{detail.name}</h5>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="flex items-center bg-white rounded-lg p-2">
                          <Users className="h-4 w-4 mr-2 text-blue-500 flex-shrink-0" />
                          <span className="font-medium">{participants.length}</span>
                        </div>
                        <div className="flex items-center bg-white rounded-lg p-2">
                          <Gift className="h-4 w-4 mr-2 text-yellow-500 flex-shrink-0" />
                          <span className="font-medium">{prizes.length}</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 text-xs text-gray-600">
                      {detail.scheduled_date && (
                        <div className="flex items-center">
                          <Calendar className="h-3.5 w-3.5 mr-2 text-green-500" />
                          <span>Programada: {new Date(detail.scheduled_date).toLocaleDateString("es-ES")}</span>
                        </div>
                      )}
                      {detail.created_at && (
                        <div className="flex items-center">
                          <Clock className="h-3.5 w-3.5 mr-2 text-gray-400" />
                          <span>Creada: {new Date(detail.created_at).toLocaleDateString("es-ES")}</span>
                        </div>
                      )}
                    </div>

                    {detail.winner_name && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                        <div className="flex items-center gap-2 text-green-700 text-xs">
                          <Award className="h-4 w-4" /> 
                          <span>Último ganador: <strong>{detail.winner_name}</strong></span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Sección de premios mejorada */}
              <div className="bg-white rounded-xl p-5 border-2 border-gray-100 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                    <Gift className="h-4 w-4 text-yellow-500" />
                    Premios Disponibles
                  </h4>
                  <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full font-medium">
                    {prizes.length}
                  </span>
                </div>
                
                {prizes.length === 0 ? (
                  <div className="text-center py-6">
                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Package className="h-6 w-6 text-gray-400" />
                    </div>
                    <p className="text-xs text-gray-500">Sin premios configurados</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-80 overflow-y-auto">
                    {prizes.map((prize, index) => renderPrize(prize, index))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Panel de la ruleta integrada */}
          <div className="flex-1 p-0">
            <IntegratedRoulette />
          </div>
        </div>
      </div>

      {/* Lista de ruletas activas mejorada */}
      <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-green-500 to-teal-600 p-2 rounded-lg">
              <RotateCcw className="h-5 w-5 text-white" />
            </div>
            <div>
              <h4 className="text-lg font-bold text-gray-800">
                Ruletas Activas Pendientes
              </h4>
              <p className="text-sm text-gray-600">
                {list.length} ruletas disponibles para sorteo
              </p>
            </div>
          </div>
          <div className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm font-medium">
            {list.length} activas
          </div>
        </div>
        
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <RefreshCcw className="h-8 w-8 mx-auto mb-3 animate-spin text-blue-500" />
              <p className="text-gray-500">Cargando ruletas...</p>
            </div>
          </div>
        ) : list.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <RotateCcw className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">Sin Ruletas Activas</h3>
            <p className="text-gray-500">No hay ruletas activas pendientes de sorteo.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
            {list.map((r) => {
              const hasPeople = (r.participants_count || 0) > 0;
              const isSelected = String(selectedId) === String(r.id);
              
              return (
                <button
                  key={r.id}
                  onClick={() => setSelectedId(String(r.id))}
                  className={`text-left border-2 rounded-xl p-4 transition-all duration-300 hover:shadow-lg transform hover:scale-105 ${
                    isSelected 
                      ? "border-blue-500 bg-gradient-to-br from-blue-50 to-purple-50 shadow-lg scale-105" 
                      : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className={`font-semibold text-sm ${isSelected ? "text-blue-900" : "text-gray-900"}`}>
                      {r.name}
                    </div>
                    {isSelected && (
                      <div className="bg-blue-500 text-white px-2 py-1 rounded-full text-xs font-bold">
                        ACTIVA
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className={`flex items-center ${hasPeople ? "text-green-600" : "text-gray-400"}`}>
                        <Users className="h-3.5 w-3.5 mr-1" />
                        <span className="font-medium">{r.participants_count || 0}</span>
                      </div>
                      {hasPeople && (
                        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                      )}
                    </div>
                    
                    {r.scheduled_date && (
                      <div className="flex items-center text-blue-600">
                        <Calendar className="h-3.5 w-3.5 mr-1" />
                        <span>{new Date(r.scheduled_date).toLocaleDateString("es-ES")}</span>
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Estilos CSS mejorados */}
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        
        @keyframes confetti-fall {
          0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
        }
        
        @keyframes twinkle {
          0%, 100% { opacity: 0.2; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.2); }
        }
        
        .animate-fadeIn { animation: fadeIn 0.3s ease-out; }
        .animate-slideUp { animation: slideUp 0.4s ease-out; }
        
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        
        .bg-size-200 { background-size: 200% 100%; }
        .hover\\:bg-pos-100:hover { background-position: 100% 0%; }
      `}</style>
    </div>
  );
};

export default DrawTools;