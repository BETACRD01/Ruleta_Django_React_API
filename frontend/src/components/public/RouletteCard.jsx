import React, { useState } from 'react';
import { 
  Clock, Users, Gift, Zap, Trophy, Calendar, Play, CheckCircle, 
  X, Medal, Crown, Star, Award, User, Calendar as CalendarIcon,
  TrendingUp, Target, Percent
} from 'lucide-react';

// Hook para cronómetro sincronizado con el servidor
function useCountdown(targetISO, serverTime) {
  const [now, setNow] = React.useState(() => {
    if (serverTime) {
      const serverDate = new Date(serverTime);
      const localDate = new Date();
      const offset = serverDate.getTime() - localDate.getTime();
      return new Date(localDate.getTime() + offset);
    }
    return new Date();
  });

  React.useEffect(() => {
    const interval = setInterval(() => {
      setNow(prev => new Date(prev.getTime() + 1000));
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);

  if (!targetISO) {
    return { 
      text: "Sorteo manual", 
      isManual: true, 
      expired: false, 
      urgency: 'normal'
    };
  }
  
  const target = new Date(targetISO);
  const diff = target.getTime() - now.getTime();
  
  if (diff <= 0) {
    return { 
      text: "¡Tiempo terminado!", 
      isManual: false, 
      expired: true, 
      urgency: 'expired'
    };
  }
  
  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  const pad = (n) => String(n).padStart(2, "0");
  
  let text;
  let urgency = 'normal';
  
  if (days > 0) {
    text = `${days}d ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    urgency = 'normal';
  } else if (hours > 0) {
    text = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    urgency = hours < 2 ? 'urgent' : 'moderate';
  } else {
    text = `${pad(minutes)}:${pad(seconds)}`;
    urgency = 'critical';
  }
  
  return { text, isManual: false, expired: false, urgency };
}

// Componente para descripción expandible
function ExpandableDescription({ description }) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  
  if (!description || description.trim() === '') return null;
  
  const isLong = description.length > 120;
  const shouldShowToggle = isLong;
  
  const handleToggle = (e) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };
  
  return (
    <div className="space-y-2">
      <div className={`text-sm text-gray-600 leading-relaxed transition-all duration-300 ${
        isExpanded ? 'max-h-none' : 'max-h-12 overflow-hidden'
      }`}>
        <p className={isExpanded ? '' : 'line-clamp-2'}>
          {isExpanded ? description : (isLong ? `${description.substring(0, 120)}...` : description)}
        </p>
      </div>
      
      {shouldShowToggle && (
        <button
          onClick={handleToggle}
          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors hover:bg-blue-50 px-2 py-1 rounded-full"
        >
          {isExpanded ? (
            <>
              <span>Ver menos</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m18 15-6-6-6 6"/>
              </svg>
            </>
          ) : (
            <>
              <span>Ver más</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m6 9 6 6 6-6"/>
              </svg>
            </>
          )}
        </button>
      )}
    </div>
  );
}

// Modal de ganadores mejorado
function WinnersModal({ isOpen, onClose, roulette }) {
  if (!isOpen) return null;

  // Los datos de ganadores vendrían del backend a través de roulette.winners_data
  const winnersData = roulette.winners_data || {
    winners: [],
    stats: {
      total_prizes_awarded: 0,
      total_value_awarded: "$0",
      completion_rate: "0%",
      draw_date: new Date().toISOString()
    }
  };

  const getPositionIcon = (position) => {
    switch(position) {
      case 1: return <Crown className="text-yellow-500" size={20} />;
      case 2: return <Medal className="text-gray-400" size={20} />;
      case 3: return <Award className="text-orange-500" size={20} />;
      default: return <Star className="text-blue-500" size={18} />;
    }
  };

  const getPositionColor = (position) => {
    switch(position) {
      case 1: return "bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-200";
      case 2: return "bg-gradient-to-r from-gray-50 to-slate-50 border-gray-200";
      case 3: return "bg-gradient-to-r from-orange-50 to-red-50 border-orange-200";
      default: return "bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200";
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-6 relative">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
          
          <div className="flex items-center gap-3">
            <Trophy size={28} className="text-yellow-300" />
            <div>
              <h2 className="text-xl font-bold">{roulette.name}</h2>
              <p className="text-blue-100 text-sm">Resultados del sorteo</p>
            </div>
          </div>
        </div>

        <div className="overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* Estadísticas generales */}
          <div className="p-6 bg-gray-50">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <TrendingUp size={20} className="text-green-500" />
              Estadísticas del Sorteo
            </h3>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg p-3 border border-gray-200">
                <div className="flex items-center gap-2">
                  <Gift size={16} className="text-purple-500" />
                  <span className="text-xs text-gray-600">Premios Otorgados</span>
                </div>
                <div className="text-xl font-bold text-gray-900 mt-1">
                  {winnersData.stats.total_prizes_awarded}
                </div>
              </div>
              
              <div className="bg-white rounded-lg p-3 border border-gray-200">
                <div className="flex items-center gap-2">
                  <Target size={16} className="text-green-500" />
                  <span className="text-xs text-gray-600">Valor Total</span>
                </div>
                <div className="text-xl font-bold text-gray-900 mt-1">
                  {winnersData.stats.total_value_awarded}
                </div>
              </div>
              
              <div className="bg-white rounded-lg p-3 border border-gray-200">
                <div className="flex items-center gap-2">
                  <Percent size={16} className="text-blue-500" />
                  <span className="text-xs text-gray-600">Completado</span>
                </div>
                <div className="text-xl font-bold text-gray-900 mt-1">
                  {winnersData.stats.completion_rate}
                </div>
              </div>
              
              <div className="bg-white rounded-lg p-3 border border-gray-200">
                <div className="flex items-center gap-2">
                  <CalendarIcon size={16} className="text-orange-500" />
                  <span className="text-xs text-gray-600">Fecha Sorteo</span>
                </div>
                <div className="text-sm font-bold text-gray-900 mt-1">
                  {new Date(winnersData.stats.draw_date).toLocaleDateString('es-ES')}
                </div>
              </div>
            </div>
          </div>

          {/* Lista de ganadores */}
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Crown size={20} className="text-yellow-500" />
              Ganadores ({winnersData.winners.length})
            </h3>
            
            {winnersData.winners.length > 0 ? (
              <div className="space-y-3">
                {winnersData.winners.map((winner) => (
                  <div 
                    key={winner.id} 
                    className={`rounded-xl border-2 p-4 ${getPositionColor(winner.position)}`}
                  >
                    <div className="flex items-center gap-4">
                      {/* Posición */}
                      <div className="flex-shrink-0">
                        {getPositionIcon(winner.position)}
                      </div>

                      {/* Avatar del ganador */}
                      <div className="flex-shrink-0">
                        {winner.avatar ? (
                          <img 
                            src={winner.avatar}
                            alt={winner.name}
                            className="w-12 h-12 rounded-full border-2 border-white shadow-sm object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full border-2 border-white shadow-sm flex items-center justify-center">
                            <User size={20} className="text-white" />
                          </div>
                        )}
                      </div>

                      {/* Información del ganador */}
                      <div className="flex-grow min-w-0">
                        <h4 className="font-semibold text-gray-900 truncate">
                          {winner.name}
                        </h4>
                        <p className="text-sm text-gray-600">
                          Posición #{winner.position}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(winner.won_at).toLocaleString('es-ES')}
                        </p>
                      </div>

                      {/* Premio ganado */}
                      <div className="flex-shrink-0 text-right">
                        <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-gray-200 shadow-sm">
                          {winner.prize.image ? (
                            <img 
                              src={winner.prize.image}
                              alt={winner.prize.name}
                              className="w-8 h-8 rounded object-cover"
                            />
                          ) : (
                            <div className="w-8 h-8 bg-gradient-to-br from-purple-400 to-pink-400 rounded flex items-center justify-center">
                              <Gift size={16} className="text-white" />
                            </div>
                          )}
                          <div>
                            <div className="font-semibold text-sm text-gray-900 max-w-[120px] truncate">
                              {winner.prize.name}
                            </div>
                            <div className="text-xs text-gray-600 font-medium">
                              {winner.prize.value}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Trophy size={48} className="text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No hay ganadores para mostrar</p>
              </div>
            )}
          </div>

          {/* Footer con información adicional */}
          <div className="border-t border-gray-200 p-6 bg-gray-50">
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-2">
                Felicidades a todos los ganadores!
              </p>
              <p className="text-xs text-gray-500">
                Los premios serán contactados para la entrega en las próximas 24-48 horas.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Componente para mostrar premios
function PrizesPreview({ prizes = [] }) {
  if (!Array.isArray(prizes) || prizes.length === 0) {
    return (
      <div className="flex items-center gap-1 text-gray-400">
        <Gift size={14} />
        <span className="text-xs">Sin premios disponibles</span>
      </div>
    );
  }

  const availablePrizes = prizes.filter(prize => 
    prize.is_available === true || prize.is_available === undefined
  );

  if (availablePrizes.length === 0) {
    return (
      <div className="flex items-center gap-1 text-gray-400">
        <Gift size={14} />
        <span className="text-xs">Premios agotados</span>
      </div>
    );
  }

  if (availablePrizes.length <= 2) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {availablePrizes.map((prize, idx) => (
          <div key={prize.id || idx} className="flex items-center gap-1.5 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg px-2 py-1 border border-purple-100">
            {prize.image_url ? (
              <img 
                src={prize.image_url} 
                alt={prize.name || 'Premio'}
                className="w-5 h-5 object-cover rounded border shadow-sm"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'flex';
                }}
              />
            ) : null}
            <div 
              className="w-5 h-5 bg-gradient-to-br from-purple-400 to-pink-400 rounded border shadow-sm flex items-center justify-center" 
              style={{display: prize.image_url ? 'none' : 'flex'}}
            >
              <Gift size={10} className="text-white" />
            </div>
            <span className="text-xs text-gray-700 font-medium max-w-[120px] truncate">
              {prize.name || 'Premio'}
            </span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-1">
        {availablePrizes.slice(0, 3).map((prize, idx) => (
          <div key={prize.id || idx} className="relative">
            {prize.image_url ? (
              <img 
                src={prize.image_url} 
                alt={prize.name || 'Premio'}
                className="w-7 h-7 object-cover rounded-full border-2 border-white shadow-sm"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'flex';
                }}
              />
            ) : null}
            <div 
              className="w-7 h-7 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full border-2 border-white shadow-sm flex items-center justify-center" 
              style={{display: prize.image_url ? 'none' : 'flex'}}
            >
              <Gift size={12} className="text-white" />
            </div>
          </div>
        ))}
        {availablePrizes.length > 3 && (
          <div className="w-7 h-7 bg-gradient-to-br from-gray-400 to-gray-500 border-2 border-white rounded-full shadow-sm flex items-center justify-center">
            <span className="text-[10px] font-bold text-white">+{availablePrizes.length - 3}</span>
          </div>
        )}
      </div>
      <span className="text-xs text-gray-600 font-medium">
        {availablePrizes.length} premio{availablePrizes.length !== 1 ? 's' : ''} disponible{availablePrizes.length !== 1 ? 's' : ''}
      </span>
    </div>
  );
}

// Componente principal mejorado
export default function RouletteCard({ roulette, serverTime, onClick }) {
  const [showWinnersModal, setShowWinnersModal] = useState(false);

  // Las estadísticas de premios otorgados vendrían del backend
  const awardedStats = roulette.awarded_stats || {
    prizes_awarded: 0,
    total_value: "$0",
    winners_count: 0
  };

  const getTargetDateAndPhase = () => {
    if (!roulette.time_remaining) {
      if (roulette.status === 'completed' || roulette.is_drawn) {
        return { date: null, phase: 'completed' };
      }
      return { date: null, phase: 'manual' };
    }

    const timeRemaining = roulette.time_remaining;

    if (timeRemaining.until_participation_start) {
      return { 
        date: new Date(Date.now() + timeRemaining.until_participation_start.total_seconds * 1000).toISOString(), 
        phase: 'waiting_to_start' 
      };
    }

    if (timeRemaining.until_participation_end) {
      return { 
        date: new Date(Date.now() + timeRemaining.until_participation_end.total_seconds * 1000).toISOString(), 
        phase: 'participation_active' 
      };
    }

    if (timeRemaining.until_draw) {
      return { 
        date: new Date(Date.now() + timeRemaining.until_draw.total_seconds * 1000).toISOString(), 
        phase: 'waiting_for_draw' 
      };
    }

    return { date: null, phase: 'manual' };
  };

  const { date: targetDate, phase } = getTargetDateAndPhase();
  const { text, isManual, expired, urgency } = useCountdown(targetDate, serverTime);

  const getStatusInfo = () => {
    switch (phase) {
      case 'waiting_to_start':
        return {
          color: 'bg-blue-50 border-blue-200 text-blue-700',
          icon: Clock,
          label: 'Inicia en',
          actionText: 'Próximamente'
        };
      case 'participation_active':
        return {
          color: 'bg-green-50 border-green-200 text-green-700',
          icon: Users,
          label: 'Participación activa',
          actionText: 'Participar!'
        };
      case 'waiting_for_draw':
        return {
          color: 'bg-purple-50 border-purple-200 text-purple-700',
          icon: Calendar,
          label: 'Sorteo en',
          actionText: 'Listo para sortear'
        };
      case 'completed':
        return {
          color: 'bg-gray-50 border-gray-200 text-gray-700',
          icon: CheckCircle,
          label: 'Completado',
          actionText: 'Ver resultados'
        };
      case 'manual':
      default:
        return {
          color: 'bg-orange-50 border-orange-200 text-orange-700',
          icon: Play,
          label: roulette.participation_is_open ? 'Disponible' : 'Listo para sorteo',
          actionText: roulette.participation_is_open ? 'Participar!' : 'Ver detalles'
        };
    }
  };

  const statusInfo = getStatusInfo();
  const StatusIcon = statusInfo.icon;

  const getUrgencyStyles = () => {
    switch (urgency) {
      case 'critical':
        return 'text-red-600 animate-pulse';
      case 'urgent':
        return 'text-orange-600';
      case 'moderate':
        return 'text-yellow-600';
      case 'expired':
        return 'text-red-700 font-black';
      default:
        return 'text-blue-600';
    }
  };

  // Función para manejar clicks
  const handleCardClick = (e) => {
    e.stopPropagation();
    if (onClick) onClick(roulette);
  };

  const handleWinnersClick = (e) => {
    e.stopPropagation();
    setShowWinnersModal(true);
  };

  return (
    <>
      <div className="group rounded-2xl border border-gray-200 bg-white hover:border-blue-300 hover:shadow-lg transition-all duration-300 overflow-hidden cursor-pointer transform hover:-translate-y-1">
        {/* Header con imagen de portada mejorado */}
        <div className="relative h-32 overflow-hidden" onClick={handleCardClick}>
          {roulette.cover_image_url ? (
            <img 
              src={roulette.cover_image_url}
              alt={roulette.name}
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'flex';
              }}
            />
          ) : null}
          
          <div 
            className="w-full h-full bg-gradient-to-br from-blue-400 via-purple-500 to-pink-500 flex items-center justify-center group-hover:scale-110 transition-transform duration-300" 
            style={{display: roulette.cover_image_url ? 'none' : 'flex'}}
          >
            <Trophy className="text-white opacity-80" size={32} />
          </div>
          
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
          
          {/* Estadísticas de premios otorgados (solo si está completado) */}
          {(roulette.status === 'completed' || roulette.is_drawn) && awardedStats.prizes_awarded > 0 && (
            <div className="absolute top-2 left-2">
              <div className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-lg px-2 py-1 backdrop-blur-sm">
                <div className="flex items-center gap-1 text-xs font-semibold">
                  <Trophy size={12} />
                  <span>{awardedStats.prizes_awarded} premios otorgados</span>
                </div>
                <div className="text-[10px] opacity-90">
                  Valor: {awardedStats.total_value}
                </div>
              </div>
            </div>
          )}
          
          {/* Badge de estado */}
          <div className="absolute top-2 right-2">
            <div className={`flex items-center gap-1 text-xs border rounded-full px-2 py-1 backdrop-blur-sm ${statusInfo.color}`}>
              <StatusIcon size={10} />
              <span className="font-semibold">{statusInfo.label}</span>
            </div>
          </div>

          {/* Indicador de participación abierta */}
          {roulette.participation_is_open && (
            <div className="absolute bottom-2 left-2">
              <div className="flex items-center gap-1 text-xs bg-green-500 text-white rounded-full px-2 py-1 backdrop-blur-sm">
                <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
                <span className="font-semibold">ABIERTA</span>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 space-y-3" onClick={handleCardClick}>
          {/* Título y descripción mejorados */}
          <div>
            <h3 className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors leading-tight text-lg mb-2">
              {roulette.name}
            </h3>
            <ExpandableDescription description={roulette.description} />
          </div>

          {/* Cronómetro */}
          {!isManual && (
            <div className="bg-gradient-to-r from-gray-50 to-blue-50 border border-gray-200 rounded-xl p-3">
              <div className="flex items-center justify-between">
                <div className="text-xs text-gray-600 font-medium">
                  {expired ? 'Tiempo terminado!' : statusInfo.label}
                </div>
                <div className={`text-lg font-mono font-black ${getUrgencyStyles()}`}>
                  {text}
                </div>
              </div>
            </div>
          )}

          {/* Estadísticas */}
          <div className="grid grid-cols-2 gap-3">
            {/* Participantes */}
            <div className="flex items-center gap-2">
              <div className="flex-shrink-0">
                <Users size={16} className="text-blue-500" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-gray-900">
                  {roulette.participants_count || 0}
                </div>
                <div className="text-xs text-gray-500">
                  participantes
                </div>
              </div>
            </div>

            {/* Premios */}
            <div className="flex items-center gap-2">
              <div className="flex-shrink-0">
                <Gift size={16} className="text-purple-500" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-gray-900">
                  {roulette.prizes_count || 0}
                </div>
                <div className="text-xs text-gray-500">
                  premios
                </div>
              </div>
            </div>
          </div>

          {/* Preview de premios */}
          {roulette.prizes && roulette.prizes.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                <Gift size={12} className="text-purple-500" />
                Premios:
              </div>
              <PrizesPreview prizes={roulette.prizes} />
            </div>
          )}

          {/* Información adicional si hay configuración max_participants */}
          {roulette.settings?.max_participants > 0 && (
            <div className="bg-gray-50 rounded-lg p-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600">Capacidad:</span>
                <span className="font-semibold text-gray-800">
                  {roulette.participants_count}/{roulette.settings.max_participants}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                <div 
                  className="bg-gradient-to-r from-blue-500 to-purple-500 h-1.5 rounded-full transition-all duration-300" 
                  style={{
                    width: `${Math.min((roulette.participants_count / roulette.settings.max_participants) * 100, 100)}%`
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer con botones mejorado */}
        <div className="px-4 pb-4">
          <div className="pt-3 border-t border-gray-100">
            <div className="flex items-center justify-between gap-2">
              {/* Estado actual */}
              <div className="flex items-center gap-1">
                <div className={`w-2 h-2 rounded-full ${
                  roulette.participation_is_open ? 'bg-green-500' :
                  roulette.status === 'completed' ? 'bg-gray-400' :
                  'bg-blue-500'
                }`}></div>
                <span className="text-xs text-gray-600 font-medium capitalize">
                  {roulette.status_display || roulette.status}
                </span>
              </div>

              {/* Botones de acción */}
              <div className="flex items-center gap-2">
                {/* Botón de ganadores (solo si está completado) */}
                {(roulette.status === 'completed' || roulette.is_drawn) && (
                  <button
                    onClick={handleWinnersClick}
                    className="flex items-center gap-1 text-xs font-bold text-white rounded-full px-3 py-1.5 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 shadow-sm hover:shadow transition-all"
                  >
                    <Crown size={12} />
                    <span>Ganadores</span>
                  </button>
                )}

                {/* Botón principal */}
                <button
                  onClick={handleCardClick}
                  className={`flex items-center gap-1 text-xs font-bold text-white rounded-full px-3 py-1.5 shadow-sm group-hover:shadow transition-all ${
                    roulette.participation_is_open 
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600' 
                      : 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600'
                  }`}
                >
                  {roulette.participation_is_open ? <Zap size={12} /> : <Play size={12} />}
                  <span>{statusInfo.actionText}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de ganadores */}
      <WinnersModal 
        isOpen={showWinnersModal} 
        onClose={() => setShowWinnersModal(false)} 
        roulette={roulette} 
      />
    </>
  );
}