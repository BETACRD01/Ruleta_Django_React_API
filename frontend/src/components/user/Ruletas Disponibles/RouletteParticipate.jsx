// src/pages/RouletteParticipate.jsx
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Users, Calendar, Upload, ArrowLeft, CheckCircle, AlertTriangle, Star, Award, Gift, Clock, Timer, Trophy, Zap } from 'lucide-react';
import {
  roulettesAPI,
  participantsAPI,
  handleAPIError,
  isAuthenticated,
  API_URL,
  formatters,
  validators,
} from '../../../config/api';

// -------- helpers --------
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

// ======================
// Cronómetro para la ruleta
// ======================
const CountdownTimer = ({ endDate, label, type = "default", className = "" }) => {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [isActive, setIsActive] = useState(true);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    if (!endDate || !isActive) return;

    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const end = new Date(endDate).getTime();
      const difference = end - now;

      if (difference > 0) {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);

        setTimeLeft({ days, hours, minutes, seconds });
      } else {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        setIsActive(false);
        setIsExpired(true);
      }
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(interval);
  }, [endDate, isActive]);

  const getUrgencyStyles = () => {
    if (isExpired) {
      return "bg-red-100 text-red-800 border-red-200";
    }
    
    const totalMinutes = timeLeft.days * 24 * 60 + timeLeft.hours * 60 + timeLeft.minutes;
    if (totalMinutes < 60) return "bg-red-100 text-red-800 border-red-200";
    if (totalMinutes < 1440) return "bg-orange-100 text-orange-800 border-orange-200";
    if (type === "draw") return "bg-purple-100 text-purple-800 border-purple-200";
    return "bg-blue-100 text-blue-800 border-blue-200";
  };

  if (isExpired) {
    return (
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border ${getUrgencyStyles()} ${className}`}>
        <Timer className="w-4 h-4" />
        <span>{type === "draw" ? "Sorteo finalizado" : "Participación cerrada"}</span>
      </div>
    );
  }

  if (!isActive && timeLeft.days === 0 && timeLeft.hours === 0 && timeLeft.minutes === 0 && timeLeft.seconds === 0) {
    return null;
  }

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border ${getUrgencyStyles()} ${className}`}>
      <Clock className="w-4 h-4" />
      <div className="flex items-center gap-1">
        <span className="text-xs opacity-75">{label}:</span>
        {timeLeft.days > 0 && <span className="font-bold">{timeLeft.days}d</span>}
        {(timeLeft.days > 0 || timeLeft.hours > 0) && <span className="font-bold">{timeLeft.hours}h</span>}
        <span className="font-bold">{timeLeft.minutes}m</span>
        <span className="font-bold">{timeLeft.seconds}s</span>
      </div>
    </div>
  );
};

// ======================
// Ruleta Visual Mejorada
// ======================
const InteractiveRoulette = ({ roulette, participants }) => {
  const [isSpinning, setIsSpinning] = useState(false);
  const [currentRotation, setCurrentRotation] = useState(0);
  const [winner, setWinner] = useState(null);

  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', 
    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
    '#F8BBD9', '#A8E6CF', '#FFB6C1', '#87CEEB', '#DDA0DD'
  ];
  
  const segmentAngle = participants.length > 0 ? 360 / participants.length : 0;

  const simulateSpin = () => {
    if (!roulette?.is_drawn && participants.length > 0 && !isSpinning) {
      setIsSpinning(true);
      setWinner(null);
      
      const spins = Math.random() * 8 + 12; // Más vueltas
      const randomOffset = Math.random() * 360;
      const finalRotation = currentRotation + (spins * 360) + randomOffset;
      
      setCurrentRotation(finalRotation);
      
      // Simular ganador después de la animación
      setTimeout(() => {
        setIsSpinning(false);
        const winnerIndex = Math.floor(Math.random() * participants.length);
        setWinner(participants[winnerIndex]);
      }, 4000);
    }
  };

  return (
    <div className="flex flex-col items-center space-y-6">
      <div className="relative">
        {/* Ruleta SVG Mejorada */}
        <div className="relative">
          <svg width="320" height="320" className="drop-shadow-2xl">
            {/* Fondo de la ruleta */}
            <circle cx="160" cy="160" r="150" fill="url(#rouletteGradient)" stroke="#1f2937" strokeWidth="4" />
            
            {/* Definir gradiente */}
            <defs>
              <radialGradient id="rouletteGradient" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.1" />
                <stop offset="100%" stopColor="#000000" stopOpacity="0.1" />
              </radialGradient>
              <filter id="textShadow">
                <feDropShadow dx="1" dy="1" stdDeviation="2" floodColor="#000000" floodOpacity="0.8"/>
              </filter>
            </defs>
            
            {/* Segmentos de la ruleta */}
            {participants.map((p, index) => {
              const startAngle = (index * segmentAngle) - 90;
              const endAngle = ((index + 1) * segmentAngle) - 90;
              const x1 = 160 + 135 * Math.cos((startAngle * Math.PI) / 180);
              const y1 = 160 + 135 * Math.sin((startAngle * Math.PI) / 180);
              const x2 = 160 + 135 * Math.cos((endAngle * Math.PI) / 180);
              const y2 = 160 + 135 * Math.sin((endAngle * Math.PI) / 180);
              const largeArcFlag = segmentAngle > 180 ? 1 : 0;
              const textAngle = startAngle + (segmentAngle / 2);
              const textX = 160 + 85 * Math.cos((textAngle * Math.PI) / 180);
              const textY = 160 + 85 * Math.sin((textAngle * Math.PI) / 180);

              return (
                <g
                  key={p.id || index}
                  transform={`rotate(${currentRotation} 160 160)`}
                  style={{ 
                    transition: isSpinning ? 'transform 4s cubic-bezier(0.23, 1, 0.32, 1)' : 'transform 0.3s ease',
                    transformOrigin: '160px 160px'
                  }}
                >
                  <path 
                    d={`M 160 160 L ${x1} ${y1} A 135 135 0 ${largeArcFlag} 1 ${x2} ${y2} Z`}
                    fill={colors[index % colors.length]} 
                    stroke="#ffffff" 
                    strokeWidth="2" 
                    opacity="0.95"
                    className="hover:opacity-100 transition-opacity"
                  />
                  
                  {/* Número del participante (SIN NOMBRES) */}
                  <text 
                    x={textX} 
                    y={textY} 
                    textAnchor="middle" 
                    dominantBaseline="middle"
                    fontSize={participants.length > 12 ? "10" : participants.length > 8 ? "12" : "14"} 
                    fontWeight="700" 
                    fill="white" 
                    filter="url(#textShadow)"
                    className="select-none"
                  >
                    #{index + 1}
                  </text>
                </g>
              );
            })}
            
            {/* Centro de la ruleta */}
            <circle cx="160" cy="160" r="25" fill="#1f2937" stroke="#f59e0b" strokeWidth="3" />
            <circle cx="160" cy="160" r="18" fill="#f59e0b" />
            
            {/* Flecha indicadora mejorada */}
            <polygon 
              points="160,15 175,35 145,35" 
              fill="#dc2626" 
              stroke="#ffffff" 
              strokeWidth="2"
              className="drop-shadow-lg"
            />
          </svg>
          
          {/* Botón de giro */}
          {!roulette?.is_drawn && participants.length > 0 && (
            <button
              onClick={simulateSpin}
              disabled={isSpinning}
              className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 
                         w-12 h-12 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 
                         hover:from-yellow-500 hover:to-orange-600 
                         flex items-center justify-center text-white font-bold text-lg
                         shadow-lg hover:shadow-xl transition-all duration-200
                         ${isSpinning ? 'cursor-not-allowed opacity-75 animate-pulse' : 'cursor-pointer hover:scale-110'}`}
              title={isSpinning ? 'Girando...' : 'Girar ruleta'}
            >
              {isSpinning ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <Zap className="h-5 w-5" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Estado de la ruleta */}
      <div className="text-center space-y-2">
        {participants.length === 0 && (
          <p className="text-sm text-gray-500 bg-gray-50 px-4 py-2 rounded-full border">
            La ruleta aparecerá cuando haya participantes
          </p>
        )}

        {winner && !roulette?.is_drawn && (
          <div className="bg-gradient-to-r from-yellow-100 to-orange-100 border border-yellow-300 rounded-xl p-4">
            <div className="flex items-center justify-center gap-2 text-orange-800 font-bold">
              <Trophy className="h-5 w-5 text-yellow-600" />
              Ganador simulado: #{participants.findIndex(p => p.id === winner.id) + 1}
            </div>
            <p className="text-xs text-orange-700 mt-1">
              *Esta es solo una simulación. El sorteo real será diferente.
            </p>
          </div>
        )}

        {roulette?.is_drawn && (
          <div className="flex items-center justify-center gap-2 px-4 py-2 bg-green-100 text-green-800 rounded-full text-sm font-medium border border-green-200">
            <Award className="h-4 w-4" /> 
            Ruleta oficialmente sorteada
          </div>
        )}

        {participants.length > 0 && !roulette?.is_drawn && (
          <p className="text-xs text-gray-600">
            Haz clic en el centro para simular un giro
          </p>
        )}
      </div>
    </div>
  );
};

// ======================
// Lista de participantes (SIN NOMBRES)
// ======================
const ParticipantsList = ({ rouletteId }) => {
  const [list, setList] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await participantsAPI.getRouletteParticipants(rouletteId);
      const rows = Array.isArray(res?.participants) ? res.participants : (res?.results || []);
      setList(rows);
    } catch (err) {
      setError(handleAPIError(err, 'No se pudieron cargar los participantes.'));
    } finally {
      setLoading(false);
    }
  }, [rouletteId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
      <div className="flex items-center justify-center py-8">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-3"></div>
        <span className="text-sm text-gray-500">Cargando participantes...</span>
      </div>
    </div>
  );

  if (error) return (
    <div className="bg-white rounded-xl border border-red-200 shadow-sm p-4">
      <div className="flex items-start gap-2 text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
        <span className="text-sm">{error}</span>
      </div>
    </div>
  );

  const colors = ['#ef4444', '#10b981', '#3b82f6', '#a855f7', '#f59e0b', '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#6366f1'];

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="px-5 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100">
        <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
          <Users className="h-5 w-5 text-blue-600" /> 
          Participantes Registrados ({list.length})
        </h3>
        <p className="text-xs text-gray-600 mt-1">Participantes confirmados en la ruleta</p>
      </div>
      
      {list.length === 0 ? (
        <div className="p-8 text-center">
          <Users className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm font-medium">Aún no hay participantes registrados</p>
          <p className="text-gray-400 text-xs mt-1">Sé el primero en participar</p>
        </div>
      ) : (
        <div className="max-h-80 overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-4">
            {list.map((p, index) => (
              <div 
                key={p.id || `participant-${index}`}
                className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-all duration-200"
              >
                <div 
                  className="inline-flex items-center justify-center w-8 h-8 text-sm font-bold text-white rounded-full shadow-sm"
                  style={{ backgroundColor: colors[index % colors.length] }}
                >
                  #{index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900">
                    Participante #{index + 1}
                  </div>
                  {p.created_at && (
                    <div className="text-xs text-gray-500">
                      Registrado: {formatters.date(p.created_at, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  )}
                </div>
                <div className="flex-shrink-0">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ======================
// Sección de Premios Mejorada
// ======================
const PrizesSection = ({ prizes = [] }) => {
  if (!Array.isArray(prizes) || prizes.length === 0) {
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

  const alias = (p, ...keys) => keys.find(k => p?.[k] !== undefined);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="px-5 py-4 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-pink-50">
        <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
          <Gift className="h-5 w-5 text-purple-600" />
          Premios Disponibles ({prizes.length})
        </h2>
        <p className="text-xs text-gray-600 mt-1">Premios que puedes ganar en esta ruleta</p>
      </div>

      <div className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {prizes.map((p, idx) => {
            const nameKey = alias(p,'name','title','prize_name','label') || 'name';
            const descKey = alias(p,'description','desc','details','text');
            const qtyKey  = alias(p,'quantity','qty','stock','count');
            const valKey  = alias(p,'value','amount','price','prize_value');
            const imgKey  = alias(p,'image_url','image','photo','picture','banner','thumbnail');
            const rawImg  = p?.[imgKey];
            const img     = rawImg ? resolveImageUrl({ image_url: rawImg }) : null;

            return (
              <div key={p.id || idx} className="border border-gray-200 rounded-xl overflow-hidden bg-white hover:shadow-md transition-shadow duration-200">
                <div className="h-32 bg-gradient-to-br from-gray-100 to-gray-200 relative overflow-hidden">
                  {img ? (
                    <img src={img} alt={p?.[nameKey] || 'Premio'} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Gift className="h-8 w-8 text-gray-400" />
                    </div>
                  )}
                  
                  {/* Badge de cantidad */}
                  {qtyKey && p?.[qtyKey] && (
                    <div className="absolute top-2 right-2 bg-blue-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                      x{p[qtyKey]}
                    </div>
                  )}
                </div>
                
                <div className="p-4 space-y-2">
                  <div className="font-semibold text-gray-900 text-sm line-clamp-2">
                    {p?.[nameKey] || `Premio #${idx + 1}`}
                  </div>
                  
                  {descKey && p?.[descKey] && (
                    <p className="text-xs text-gray-600 line-clamp-3 leading-relaxed">{p[descKey]}</p>
                  )}
                  
                  {valKey && p?.[valKey] && (
                    <div className="pt-2 border-t border-gray-100">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">Valor:</span>
                        <span className="text-sm font-bold text-green-600">
                          {typeof p[valKey] === 'number' ? formatters.currency(p[valKey]) : p[valKey]}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ======================
// Estadísticas superiores mejoradas
// ======================
const TopStats = ({ count, startDate, created, endDate, participationEnd, scheduledDate }) => {
  const shouldShowTimer = () => {
    const now = new Date().getTime();
    const participationEndTime = participationEnd ? new Date(participationEnd).getTime() : null;
    const scheduledTime = scheduledDate ? new Date(scheduledDate).getTime() : null;
    
    return (participationEndTime && participationEndTime > now) || (scheduledTime && scheduledTime > now);
  };

  return (
    <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 rounded-xl border border-blue-200 shadow-sm p-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Participantes */}
        <div className="text-center">
          <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-xl mx-auto mb-3">
            <Users className="h-6 w-6 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900">{count}</div>
          <div className="text-sm text-gray-600">Participantes</div>
        </div>

        {/* Fecha de inicio */}
        <div className="text-center">
          <div className="flex items-center justify-center w-12 h-12 bg-emerald-100 rounded-xl mx-auto mb-3">
            <Calendar className="h-6 w-6 text-emerald-600" />
          </div>
          <div className="text-sm font-medium text-gray-900">
            {startDate ? formatters.date(startDate, { month: 'short', day: 'numeric' }) : 
             created ? formatters.date(created, { month: 'short', day: 'numeric' }) : '---'}
          </div>
          <div className="text-sm text-gray-600">Fecha Inicio</div>
        </div>

        {/* Fecha de fin */}
        <div className="text-center">
          <div className="flex items-center justify-center w-12 h-12 bg-rose-100 rounded-xl mx-auto mb-3">
            <Calendar className="h-6 w-6 text-rose-600" />
          </div>
          <div className="text-sm font-medium text-gray-900">
            {endDate ? formatters.date(endDate, { month: 'short', day: 'numeric' }) : 
             participationEnd ? formatters.date(participationEnd, { month: 'short', day: 'numeric' }) : '---'}
          </div>
          <div className="text-sm text-gray-600">Fecha Fin</div>
        </div>

        {/* Cronómetros */}
        <div className="text-center">
          <div className="flex items-center justify-center w-12 h-12 bg-orange-100 rounded-xl mx-auto mb-3">
            <Clock className="h-6 w-6 text-orange-600" />
          </div>
          <div className="space-y-2">
            {shouldShowTimer() ? (
              <>
                {participationEnd && new Date(participationEnd) > new Date() && (
                  <CountdownTimer
                    endDate={participationEnd}
                    label="Fin"
                    type="participation"
                    className="text-xs"
                  />
                )}
                {scheduledDate && new Date(scheduledDate) > new Date() && (
                  <CountdownTimer
                    endDate={scheduledDate}
                    label="Sorteo"
                    type="draw"
                    className="text-xs"
                  />
                )}
              </>
            ) : (
              <div className="text-sm text-gray-600">Sin límite</div>
            )}
          </div>
          <div className="text-sm text-gray-600">Tiempo</div>
        </div>
      </div>
    </div>
  );
};

// ======================
// Página principal
// ======================
export default function RouletteParticipate() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [roulette, setRoulette] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [prizes, setPrizes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');

  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

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
        ? participantsRes.participants : (participantsRes?.results || []);
      setParticipants(participantsList);

      const prizeList = Array.isArray(prizesRes?.results) ? prizesRes.results : (prizesRes || []);
      setPrizes(prizeList.map(pr => {
        const img = pr?.image_url || pr?.image || pr?.photo || pr?.picture || pr?.banner || pr?.thumbnail || null;
        return img ? { ...pr, image_url: resolveImageUrl({ image_url: img }) } : pr;
      }));
    } catch (err) {
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

  const participationStatus = useMemo(() => {
    if (!roulette) return { disabled: false, reason: '' };
    if (roulette.is_drawn) return { disabled: true, reason: 'Esta ruleta ya fue sorteada.' };
    if (roulette.status === 'completed') return { disabled: true, reason: 'La ruleta está marcada como completada.' };
    if (roulette.status === 'cancelled') return { disabled: true, reason: 'Esta ruleta fue cancelada.' };
    if (participationEnd && new Date(participationEnd) <= new Date()) return { disabled: true, reason: 'El período de participación ha terminado.' };
    if (endDate && new Date(endDate) <= new Date()) return { disabled: true, reason: 'El período de participación ha terminado.' };
    return { disabled: false, reason: '' };
  }, [roulette, endDate, participationEnd]);

  const disabledByStatus = participationStatus.disabled;

  const validateReceipt = (f) => {
    if (!f) return 'Debes adjuntar el comprobante.';
    
    if (!validators.fileExtension(['jpg', 'jpeg', 'png', 'pdf'])(f)) {
      return 'Extensión no permitida (JPG, JPEG, PNG o PDF).';
    }
    
    if (!validators.maxFileSize(5)(f)) {
      return 'El archivo supera 5MB.';
    }
    
    return '';
  };

  const submit = async (e) => {
    e?.preventDefault?.();
    if (!isAuthenticated()) { setPageError('Debes iniciar sesión para participar.'); return; }
    const err = validateReceipt(file);
    if (err) { setFileError(err); return; }

    try {
      setSubmitting(true);
      setPageError('');
      setSuccessMsg('');
      await participantsAPI.participate(id, file);
      setSuccessMsg('¡Participación registrada con éxito!');
      await loadData();
      setFile(null);
    } catch (err) {
      setPageError(handleAPIError(err, 'No se pudo registrar tu participación.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="inline-flex items-center gap-3 text-gray-600">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-lg">Cargando ruleta...</span>
        </div>
      </div>
    );
  }

  if (pageError && !roulette) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <button 
          onClick={() => navigate(-1)} 
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-6 hover:bg-gray-100 px-3 py-2 rounded-lg transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Volver
        </button>
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-6 w-6 text-red-600 mt-1 flex-shrink-0" />
            <div>
              <h3 className="text-lg font-semibold text-red-900 mb-2">Error al cargar la ruleta</h3>
              <p className="text-red-700">{pageError}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50">
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button 
            onClick={() => navigate(-1)} 
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-white px-4 py-2 rounded-lg transition-colors shadow-sm border border-gray-200"
          >
            <ArrowLeft className="h-4 w-4" /> Volver a Ruletas
          </button>
          
          {roulette && (
            <div className="text-right">
              <h1 className="text-2xl font-bold text-gray-900">{roulette.name || roulette.title || 'Ruleta de Premios'}</h1>
              <p className="text-sm text-gray-600">ID: {roulette.id}</p>
            </div>
          )}
        </div>

        {/* Estadísticas superiores */}
        <TopStats 
          count={participantsCount} 
          startDate={startDate} 
          created={created} 
          endDate={endDate}
          participationEnd={participationEnd}
          scheduledDate={scheduledDate}
        />

        {/* Contenido principal */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Columna izquierda: Ruleta */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-gray-800 mb-2">Ruleta Interactiva</h2>
              <p className="text-sm text-gray-600">Simulación visual de la ruleta con participantes</p>
            </div>
            <InteractiveRoulette roulette={roulette} participants={participants} />
          </div>

          {/* Columna derecha: Formulario de participación */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="text-center mb-6">
              <Star className="h-8 w-8 text-yellow-500 mx-auto mb-3" />
              <h2 className="text-xl font-bold text-gray-800 mb-2">Participar en la Ruleta</h2>
              <p className="text-sm text-gray-600">Completa el formulario para participar</p>
            </div>

            {disabledByStatus ? (
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
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Comprobante de Participación
                  </label>
                  <p className="text-xs text-gray-500 mb-4">
                    Sube una imagen (JPG, PNG) o PDF de tu comprobante (máx. 5MB)
                  </p>

                  <label className="group relative flex flex-col items-center justify-center w-full h-32 
                                     border-2 border-dashed border-gray-300 rounded-xl
                                     hover:border-blue-400 hover:bg-blue-50 cursor-pointer 
                                     transition-all duration-200">
                    <div className="text-center">
                      <Upload className="h-8 w-8 text-gray-400 group-hover:text-blue-500 mx-auto mb-2" />
                      <span className="text-sm font-medium text-gray-600 group-hover:text-blue-600">
                        {file ? 'Cambiar archivo' : 'Seleccionar archivo'}
                      </span>
                      <p className="text-xs text-gray-500 mt-1">JPG, PNG o PDF hasta 5MB</p>
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
                    <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center gap-2 text-sm text-blue-800">
                        <CheckCircle className="h-4 w-4" />
                        <span className="font-medium">{file.name}</span>
                        <span className="text-blue-600">({formatters.fileSize(file.size)})</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Mensajes de error y éxito */}
                {fileError && (
                  <div className="flex items-start gap-2 text-red-700 bg-red-50 border border-red-200 px-4 py-3 rounded-lg">
                    <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">{fileError}</span>
                  </div>
                )}

                {pageError && (
                  <div className="flex items-start gap-2 text-red-700 bg-red-50 border border-red-200 px-4 py-3 rounded-lg">
                    <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">{pageError}</span>
                  </div>
                )}

                {successMsg && (
                  <div className="flex items-start gap-2 text-green-700 bg-green-50 border border-green-200 px-4 py-3 rounded-lg">
                    <CheckCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                    <span className="text-sm font-medium">{successMsg}</span>
                  </div>
                )}

                {/* Botón de envío */}
                <button
                  type="submit"
                  disabled={submitting || !!fileError || !file}
                  className={`w-full inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl text-sm font-semibold transition-all duration-200 transform
                    ${submitting || !!fileError || !file
                      ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                      : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 hover:scale-105 shadow-lg hover:shadow-xl'}`}
                >
                  {submitting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Procesando participación...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-5 w-5" />
                      Confirmar Participación
                    </>
                  )}
                </button>

                <div className="text-center pt-2">
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Al participar, aceptas que tu participación será visible públicamente como "Participante #N"
                    <br />
                    Tu nombre personal no será mostrado por privacidad
                  </p>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Sección inferior: Participantes y Premios */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <ParticipantsList rouletteId={id} />
          <PrizesSection prizes={prizes} />
        </div>

        {/* Información adicional de la ruleta */}
        {roulette?.description && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Información de la Ruleta</h3>
            <div className="prose prose-sm max-w-none">
              <div 
                className="text-gray-700 leading-relaxed"
                dangerouslySetInnerHTML={{ 
                  __html: roulette.description.replace(/\n/g, '<br/>') 
                }}
              />
            </div>
          </div>
        )}

        {/* Footer informativo */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-6 text-center">
          <div className="flex items-center justify-center gap-2 text-blue-800 mb-2">
            <Trophy className="h-5 w-5" />
            <span className="font-semibold">¡Buena suerte a todos los participantes!</span>
          </div>
          <p className="text-sm text-blue-700">
            El sorteo se realizará de manera transparente y todos los participantes tienen las mismas oportunidades de ganar.
          </p>
        </div>
      </div>
    </div>
  );
}