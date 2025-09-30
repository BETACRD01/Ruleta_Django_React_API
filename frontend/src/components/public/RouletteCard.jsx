// src/components/public/RouletteCard.jsx
import React, { useState } from 'react';
import { 
  Clock, Users, Gift, Zap, Trophy, Calendar, Play, CheckCircle, 
  X, Medal, Crown, Star, Award, User, Calendar as CalendarIcon,
  TrendingUp, Target, Percent, ChevronDown, ChevronUp
} from 'lucide-react';

// Hook para cronómetro
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
    return { text: "Sorteo manual", isManual: true, expired: false, urgency: 'normal' };
  }
  
  const target = new Date(targetISO);
  const diff = target.getTime() - now.getTime();
  
  if (diff <= 0) {
    return { text: "¡Tiempo terminado!", isManual: false, expired: true, urgency: 'expired' };
  }
  
  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  const pad = (n) => String(n).padStart(2, "0");
  
  let text, urgency = 'normal';
  
  if (days > 0) {
    text = `${days}d ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  } else if (hours > 0) {
    text = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    urgency = hours < 2 ? 'urgent' : 'moderate';
  } else {
    text = `${pad(minutes)}:${pad(seconds)}`;
    urgency = 'critical';
  }
  
  return { text, isManual: false, expired: false, urgency };
}

// Función para hacer enlaces clicables
const escapeHtml = (s = "") =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const autoLinkHTML = (plainText = "") => {
  const text = escapeHtml(plainText);
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
  let html = text.replace(emailRegex, (m) => {
    const href = `mailto:${m}`;
    return `<a href="${href}" class="text-blue-600 underline hover:no-underline">${m}</a>`;
  });
  const urlRegex = /\b((https?:\/\/|www\.)[^\s<]+)\b/gi;
  html = html.replace(urlRegex, (m) => {
    const href = m.startsWith("http") ? m : `https://${m}`;
    return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="text-blue-600 underline hover:no-underline">${m}</a>`;
  });
  return html.replace(/\n/g, "<br/>");
};

// Descripción expandible
function ExpandableDescription({ description }) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  
  if (!description || description.trim() === '') return null;
  
  const isLong = description.length > 150;
  
  return (
    <div className="space-y-2">
      <div
        className={`text-sm text-gray-600 leading-relaxed ${isExpanded ? '' : 'line-clamp-3'}`}
        style={{ overflowWrap: "anywhere" }}
        dangerouslySetInnerHTML={{ __html: autoLinkHTML(description) }}
      />
      
      {isLong && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
        >
          {isExpanded ? (
            <>Ver menos <ChevronUp size={14} /></>
          ) : (
            <>Ver más <ChevronDown size={14} /></>
          )}
        </button>
      )}
    </div>
  );
}

// Modal para ver imagen ampliada - CORREGIDO
function ImageModal({ isOpen, onClose, imageUrl, title }) {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" 
      onClick={onClose}
    >
      <button 
        onClick={onClose}
        className="absolute top-4 right-4 p-2 text-white hover:bg-white/20 rounded-full transition-colors z-10"
      >
        <X size={24} />
      </button>
      
      <div className="relative max-w-4xl w-full" onClick={(e) => e.stopPropagation()}>
        <img 
          src={imageUrl}
          alt={title}
          className="w-full h-auto max-h-[85vh] object-contain rounded-lg shadow-2xl"
        />
        {title && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 rounded-b-lg">
            <p className="text-white font-semibold text-center">{title}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Modal de ganadores
function WinnersModal({ isOpen, onClose, roulette }) {
  if (!isOpen) return null;

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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 relative">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
          
          <div className="flex items-center gap-3">
            <Trophy size={28} />
            <div>
              <h2 className="text-xl font-bold">{roulette.name}</h2>
              <p className="text-blue-100 text-sm">Resultados del sorteo</p>
            </div>
          </div>
        </div>

        <div className="overflow-y-auto max-h-[calc(90vh-200px)]">
          <div className="p-6 bg-gray-50">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <TrendingUp size={20} className="text-green-500" />
              Estadísticas
            </h3>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Gift size={16} className="text-purple-500" />
                  <span className="text-xs text-gray-600">Premios</span>
                </div>
                <div className="text-xl font-bold text-gray-900">
                  {winnersData.stats.total_prizes_awarded}
                </div>
              </div>
              
              <div className="bg-white rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Target size={16} className="text-green-500" />
                  <span className="text-xs text-gray-600">Valor</span>
                </div>
                <div className="text-xl font-bold text-gray-900">
                  {winnersData.stats.total_value_awarded}
                </div>
              </div>
              
              <div className="bg-white rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Percent size={16} className="text-blue-500" />
                  <span className="text-xs text-gray-600">Completado</span>
                </div>
                <div className="text-xl font-bold text-gray-900">
                  {winnersData.stats.completion_rate}
                </div>
              </div>
              
              <div className="bg-white rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <CalendarIcon size={16} className="text-orange-500" />
                  <span className="text-xs text-gray-600">Fecha</span>
                </div>
                <div className="text-sm font-bold text-gray-900">
                  {new Date(winnersData.stats.draw_date).toLocaleDateString('es-ES', {
                    day: '2-digit',
                    month: 'short'
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Crown size={20} className="text-yellow-500" />
              Ganadores ({winnersData.winners.length})
            </h3>
            
            {winnersData.winners.length > 0 ? (
              <div className="space-y-3">
                {winnersData.winners.map((winner) => (
                  <div key={winner.id} className="bg-gray-50 rounded-xl border p-4">
                    <div className="flex items-center gap-4">
                      <div className="flex-shrink-0">
                        {getPositionIcon(winner.position)}
                      </div>

                      <div className="flex-shrink-0">
                        {winner.avatar ? (
                          <img 
                            src={winner.avatar}
                            alt={winner.name}
                            className="w-12 h-12 rounded-full border-2 border-white shadow object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full border-2 border-white shadow flex items-center justify-center">
                            <User size={20} className="text-white" />
                          </div>
                        )}
                      </div>

                      <div className="flex-grow min-w-0">
                        <h4 className="font-semibold text-gray-900 truncate">
                          {winner.name}
                        </h4>
                        <p className="text-sm text-gray-600">
                          Posición #{winner.position}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(winner.won_at).toLocaleDateString('es-ES')}
                        </p>
                      </div>

                      <div className="flex-shrink-0">
                        <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border shadow-sm">
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
                            <div className="font-semibold text-sm text-gray-900 truncate max-w-[100px]">
                              {winner.prize.name}
                            </div>
                            <div className="text-xs text-gray-600">
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
                <p className="text-gray-500">No hay ganadores aún</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Preview de premios
function PrizesPreview({ prizes = [] }) {
  if (!Array.isArray(prizes) || prizes.length === 0) {
    return (
      <div className="flex items-center gap-1 text-gray-400">
        <Gift size={14} />
        <span className="text-xs">Sin premios</span>
      </div>
    );
  }

  const available = prizes.filter(p => p.is_available !== false);

  if (available.length === 0) {
    return (
      <div className="flex items-center gap-1 text-gray-400">
        <Gift size={14} />
        <span className="text-xs">Premios agotados</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-1">
        {available.slice(0, 3).map((prize, idx) => (
          <div key={prize.id || idx} className="relative">
            {prize.image_url ? (
              <img 
                src={prize.image_url} 
                alt={prize.name}
                className="w-7 h-7 object-cover rounded-full border-2 border-white shadow"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'flex';
                }}
              />
            ) : null}
            <div 
              className="w-7 h-7 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full border-2 border-white shadow flex items-center justify-center" 
              style={{display: prize.image_url ? 'none' : 'flex'}}
            >
              <Gift size={12} className="text-white" />
            </div>
          </div>
        ))}
        {available.length > 3 && (
          <div className="w-7 h-7 bg-gray-400 border-2 border-white rounded-full shadow flex items-center justify-center">
            <span className="text-[10px] font-bold text-white">+{available.length - 3}</span>
          </div>
        )}
      </div>
      <span className="text-xs text-gray-600 font-medium">
        {available.length} {available.length === 1 ? 'premio' : 'premios'}
      </span>
    </div>
  );
}

// Componente principal
export default function RouletteCard({ roulette, serverTime, onClick }) {
  const [showWinnersModal, setShowWinnersModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);

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
  const { text, isManual, urgency } = useCountdown(targetDate, serverTime);

  const getStatusInfo = () => {
    switch (phase) {
      case 'waiting_to_start':
        return { color: 'bg-blue-500', icon: Clock, label: 'Inicia en', action: 'Próximamente' };
      case 'participation_active':
        return { color: 'bg-green-500', icon: Users, label: 'Participación activa', action: 'Participar' };
      case 'waiting_for_draw':
        return { color: 'bg-purple-500', icon: Calendar, label: 'Sorteo en', action: 'Listo' };
      case 'completed':
        return { color: 'bg-gray-500', icon: CheckCircle, label: 'Completado', action: 'Ver ganadores' };
      case 'manual':
      default:
        return { 
          color: roulette.participation_is_open ? 'bg-green-500' : 'bg-orange-500', 
          icon: Play, 
          label: roulette.participation_is_open ? 'Disponible' : 'Listo',
          action: roulette.participation_is_open ? 'Participar' : 'Ver detalles'
        };
    }
  };

  const statusInfo = getStatusInfo();
  const StatusIcon = statusInfo.icon;

  const handleCardClick = (e) => {
    e.stopPropagation();
    if (onClick) onClick(roulette);
  };

  const handleWinnersClick = (e) => {
    e.stopPropagation();
    setShowWinnersModal(true);
  };

  const handleImageClick = (e) => {
    e.stopPropagation();
    if (roulette.cover_image_url) {
      setShowImageModal(true);
    }
  };

  return (
    <>
      <div className="group rounded-xl border border-gray-200 bg-white hover:shadow-lg transition-all duration-300 overflow-hidden">
        {/* Imagen de portada - CLICKEABLE PARA AMPLIAR (NO ACTIVA onClick) */}
        <div 
          className="relative h-40 overflow-hidden bg-gradient-to-br from-blue-400 to-purple-500 cursor-zoom-in" 
          onClick={handleImageClick}
        >
          {roulette.cover_image_url && (
            <img 
              src={roulette.cover_image_url}
              alt={roulette.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          )}
          
          {!roulette.cover_image_url && (
            <div className="w-full h-full flex items-center justify-center">
              <Trophy className="text-white/50" size={48} />
            </div>
          )}
          
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          
          {/* Badge de estado */}
          <div className="absolute top-3 right-3">
            <div className={`flex items-center gap-1.5 ${statusInfo.color} text-white rounded-lg px-2.5 py-1.5 text-xs font-bold shadow-lg backdrop-blur-sm`}>
              <StatusIcon size={12} />
              <span>{statusInfo.label}</span>
            </div>
          </div>

          {/* Badge de participación */}
          {roulette.participation_is_open && (
            <div className="absolute top-3 left-3">
              <div className="flex items-center gap-1.5 bg-green-500 text-white rounded-lg px-2.5 py-1.5 text-xs font-bold shadow-lg">
                <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                <span>ABIERTA</span>
              </div>
            </div>
          )}
        </div>

        {/* Contenido del card - CLICKEABLE PARA PARTICIPAR */}
        <div className="p-4 space-y-3 cursor-pointer" onClick={handleCardClick}>
          {/* Título */}
          <h3 className="font-bold text-gray-900 text-base leading-tight line-clamp-2">
            {roulette.name}
          </h3>

          {/* Descripción con enlaces clicables y "Ver más" */}
          <ExpandableDescription description={roulette.description} />

          {/* Cronómetro */}
          {!isManual && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-600 font-medium">{statusInfo.label}</span>
                <span className={`text-base font-mono font-bold ${
                  urgency === 'critical' ? 'text-red-600 animate-pulse' :
                  urgency === 'urgent' ? 'text-orange-600' :
                  urgency === 'moderate' ? 'text-yellow-600' :
                  'text-blue-600'
                }`}>
                  {text}
                </span>
              </div>
            </div>
          )}

          {/* Estadísticas */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-blue-500 flex-shrink-0" />
              <div>
                <div className="text-sm font-semibold text-gray-900">{roulette.participants_count || 0}</div>
                <div className="text-xs text-gray-500">participantes</div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Gift size={16} className="text-purple-500 flex-shrink-0" />
              <div>
                <div className="text-sm font-semibold text-gray-900">{roulette.prizes_count || 0}</div>
                <div className="text-xs text-gray-500">premios</div>
              </div>
            </div>
          </div>

          {/* Preview de premios */}
          {roulette.prizes && roulette.prizes.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1">
                <Gift size={12} className="text-purple-500" />
                Premios:
              </div>
              <PrizesPreview prizes={roulette.prizes} />
            </div>
          )}

          {/* Capacidad */}
          {roulette.settings?.max_participants > 0 && (
            <div className="bg-gray-50 rounded-lg p-2">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-gray-600">Capacidad:</span>
                <span className="font-semibold text-gray-800">
                  {roulette.participants_count}/{roulette.settings.max_participants}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1.5">
                <div 
                  className="bg-blue-500 h-1.5 rounded-full transition-all" 
                  style={{ width: `${Math.min((roulette.participants_count / roulette.settings.max_participants) * 100, 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer - BOTONES CLICKEABLES */}
        <div className="px-4 pb-4">
          <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${
                roulette.participation_is_open ? 'bg-green-500' :
                roulette.status === 'completed' ? 'bg-gray-400' : 'bg-blue-500'
              }`} />
              <span className="text-xs text-gray-600 font-medium capitalize">
                {roulette.status_display || roulette.status}
              </span>
            </div>

            <div className="flex gap-2">
              {(roulette.status === 'completed' || roulette.is_drawn) && (
                <button
                  onClick={handleWinnersClick}
                  className="flex items-center gap-1 text-xs font-bold text-white rounded-lg px-3 py-1.5 bg-yellow-500 hover:bg-yellow-600 transition-colors"
                >
                  <Crown size={12} />
                  Ganadores
                </button>
              )}

              <button
                onClick={handleCardClick}
                className={`flex items-center gap-1 text-xs font-bold text-white rounded-lg px-3 py-1.5 transition-colors ${
                  roulette.participation_is_open 
                    ? 'bg-green-500 hover:bg-green-600' 
                    : 'bg-blue-500 hover:bg-blue-600'
                }`}
              >
                {roulette.participation_is_open ? <Zap size={12} /> : <Play size={12} />}
                {statusInfo.action}
              </button>
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

      {/* Modal de imagen ampliada */}
      <ImageModal 
        isOpen={showImageModal}
        onClose={() => setShowImageModal(false)}
        imageUrl={roulette.cover_image_url}
        title={roulette.name}
      />
    </>
  );
}