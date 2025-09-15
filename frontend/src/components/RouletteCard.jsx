// src/components/RouletteCard.jsx
import React from 'react';
import { Trophy, Users, Calendar, Clock, CheckCircle } from 'lucide-react';
import { Card, Button, Badge } from './UI';

const RouletteCard = ({ 
  roulette, 
  isParticipating = false, 
  onParticipate, 
  showParticipateButton = true,
  className = '' 
}) => {
  const getStatusBadge = () => {
    if (isParticipating) {
      return <Badge variant="success">✓ Participando</Badge>;
    }
    
    switch (roulette.status) {
      case 'active':
        return <Badge variant="info">Disponible</Badge>;
      case 'completed':
        return <Badge variant="default">Completada</Badge>;
      case 'cancelled':
        return <Badge variant="error">Cancelada</Badge>;
      default:
        return <Badge variant="default">{roulette.status}</Badge>;
    }
  };

  const isActive = roulette.status === 'active' && !roulette.is_drawn;
  const canParticipate = isActive && !isParticipating;

  const formatDate = (dateString) => {
    if (!dateString) return 'No definida';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTimeRemaining = () => {
    if (!roulette.scheduled_date) return null;
    
    const now = new Date();
    const scheduledDate = new Date(roulette.scheduled_date);
    const diff = scheduledDate - now;
    
    if (diff <= 0) return 'Sorteo realizado';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return `${days}d ${hours}h restantes`;
    if (hours > 0) return `${hours}h restantes`;
    
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${minutes}m restantes`;
  };

  const timeRemaining = getTimeRemaining();

  return (
    <Card className={`hover:shadow-lg transition-shadow ${className}`}>
      {/* Imagen */}
      <div className="aspect-video w-full bg-gradient-to-br from-blue-400 to-purple-600 rounded-t-lg flex items-center justify-center">
        {roulette.image ? (
          <img 
            src={roulette.image} 
            alt={roulette.title}
            className="w-full h-full object-cover rounded-t-lg"
          />
        ) : (
          <Trophy className="h-16 w-16 text-white opacity-80" />
        )}
      </div>

      {/* Contenido */}
      <div className="p-6">
        {/* Header con título y estado */}
        <div className="flex items-start justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900 flex-1 pr-2">
            {roulette.title}
          </h3>
          {getStatusBadge()}
        </div>

        {/* Descripción */}
        <p className="text-gray-600 text-sm mb-4 line-clamp-2">
          {roulette.description}
        </p>

        {/* Estadísticas */}
        <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
          <div className="flex items-center text-gray-500">
            <Users className="h-4 w-4 mr-1" />
            <span>{roulette.participants_count || 0} participantes</span>
          </div>
          
          {roulette.max_participants && (
            <div className="flex items-center text-gray-500">
              <Trophy className="h-4 w-4 mr-1" />
              <span>Máx: {roulette.max_participants}</span>
            </div>
          )}
          
          {roulette.scheduled_date && (
            <div className="flex items-center text-gray-500 col-span-2">
              <Calendar className="h-4 w-4 mr-1" />
              <span>Sorteo: {formatDate(roulette.scheduled_date)}</span>
            </div>
          )}
        </div>

        {/* Countdown si está activa */}
        {timeRemaining && isActive && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
            <div className="flex items-center justify-center text-blue-700">
              <Clock className="h-4 w-4 mr-2" />
              <span className="font-medium text-sm">{timeRemaining}</span>
            </div>
          </div>
        )}

        {/* Barra de progreso si hay límite de participantes */}
        {roulette.max_participants && roulette.max_participants > 0 && (
          <div className="mb-4">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Participantes</span>
              <span>{roulette.participants_count}/{roulette.max_participants}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ 
                  width: `${Math.min((roulette.participants_count / roulette.max_participants) * 100, 100)}%` 
                }}
              />
            </div>
          </div>
        )}

        {/* Botones de acción */}
        {showParticipateButton && (
          <div className="flex gap-2">
            {canParticipate ? (
              <Button 
                onClick={() => onParticipate(roulette)}
                className="flex-1"
                size="sm"
              >
                Participar Ahora
              </Button>
            ) : isParticipating ? (
              <Button 
                variant="success" 
                className="flex-1" 
                size="sm"
                disabled
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                Ya Participas
              </Button>
            ) : (
              <Button 
                variant="secondary" 
                className="flex-1" 
                size="sm"
                disabled
              >
                No Disponible
              </Button>
            )}
            
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => {
                // Funcionalidad para ver detalles
                console.log('Ver detalles de', roulette.title);
              }}
            >
              Ver Detalles
            </Button>
          </div>
        )}

        {/* Información adicional para cards completadas */}
        {roulette.is_drawn && roulette.winner && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center text-green-700">
              <Trophy className="h-4 w-4 mr-2" />
              <span className="text-sm font-medium">
                Ganador: {roulette.winner.name || 'Usuario #' + roulette.winner.participation_number}
              </span>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};

export default RouletteCard;