// src/components/UserDashboard.jsx
import React, { useState, useEffect } from 'react';
import { 
  Trophy, Clock, Users, Award, Search, Filter,
  Calendar, CheckCircle, Eye, Upload
} from 'lucide-react';
import { Card, Button, Badge, Tabs, EmptyState, LoadingSpinner } from './UI';
import { roulettesAPI, participantsAPI } from '../config/api';
import { useAuth } from '../contexts/AuthContext';
import RouletteCard from './RouletteCard';
import ParticipationModal from './ParticipationModal';

const UserDashboard = () => {
  const [activeTab, setActiveTab] = useState('available');
  const [loading, setLoading] = useState(true);
  const [roulettes, setRoulettes] = useState([]);
  const [myParticipations, setMyParticipations] = useState([]);
  const [showParticipationModal, setShowParticipationModal] = useState(false);
  const [selectedRoulette, setSelectedRoulette] = useState(null);
  const [error, setError] = useState(null);
  const { user } = useAuth();

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [roulettesResponse, participationsResponse] = await Promise.all([
        roulettesAPI.getRoulettes({ status: 'active', page_size: 20 }),
        participantsAPI.getMyParticipations({ page_size: 50 })
      ]);

      setRoulettes(roulettesResponse.results || []);
      setMyParticipations(participationsResponse.results || []);
    } catch (error) {
      console.error('Error loading dashboard:', error);
      setError('Error al cargar datos del dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleParticipate = (roulette) => {
    setSelectedRoulette(roulette);
    setShowParticipationModal(true);
  };

  const handleParticipationSuccess = () => {
    loadDashboardData(); // Recargar datos después de participar
    setShowParticipationModal(false);
    setSelectedRoulette(null);
  };

  const tabs = [
    { 
      id: 'available', 
      label: 'Ruletas Disponibles', 
      icon: Trophy,
      count: roulettes.length 
    },
    { 
      id: 'my-participations', 
      label: 'Mis Participaciones', 
      icon: Users,
      count: myParticipations.length 
    },
    { 
      id: 'results', 
      label: 'Resultados', 
      icon: Award,
      count: myParticipations.filter(p => p.roulette_status === 'completed').length
    }
  ];

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-center items-center h-64">
          <LoadingSpinner size="lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header de bienvenida */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          ¡Hola, {user?.first_name}!
        </h1>
        <p className="text-gray-600">
          Participa en ruletas increíbles y gana premios fantásticos
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      {/* Resumen rápido */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <Card className="p-4">
          <div className="flex items-center">
            <div className="bg-blue-100 p-2 rounded-lg">
              <Trophy className="h-5 w-5 text-blue-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-gray-600">Ruletas Disponibles</p>
              <p className="text-xl font-bold text-gray-900">{roulettes.length}</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center">
            <div className="bg-green-100 p-2 rounded-lg">
              <Users className="h-5 w-5 text-green-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-gray-600">Mis Participaciones</p>
              <p className="text-xl font-bold text-gray-900">{myParticipations.length}</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center">
            <div className="bg-purple-100 p-2 rounded-lg">
              <Award className="h-5 w-5 text-purple-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-gray-600">Resultados</p>
              <p className="text-xl font-bold text-gray-900">
                {myParticipations.filter(p => p.is_winner).length}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Pestañas */}
      <Tabs 
        tabs={tabs}
        activeTab={activeTab}
        onChange={setActiveTab}
        className="mb-8"
      />

      {/* Contenido de pestañas */}
      <div>
        {activeTab === 'available' && (
          <AvailableRoulettesTab 
            roulettes={roulettes} 
            myParticipations={myParticipations}
            onParticipate={handleParticipate}
          />
        )}
        {activeTab === 'my-participations' && (
          <MyParticipationsTab participations={myParticipations} />
        )}
        {activeTab === 'results' && (
          <ResultsTab participations={myParticipations} />
        )}
      </div>

      {/* Modal de Participación */}
      <ParticipationModal
        isOpen={showParticipationModal}
        onClose={() => {
          setShowParticipationModal(false);
          setSelectedRoulette(null);
        }}
        roulette={selectedRoulette}
        onSuccess={handleParticipationSuccess}
      />
    </div>
  );
};

// Tab de Ruletas Disponibles
const AvailableRoulettesTab = ({ roulettes, myParticipations, onParticipate }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('newest');

  // Filtrar y ordenar ruletas
    const filteredRoulettes = roulettes
   .filter(roulette => {
    // Verificar que las propiedades existan antes de llamar toLowerCase()
    const title = roulette.title || '';
    const description = roulette.description || '';
    const searchTermLower = searchTerm.toLowerCase();
    
    return title.toLowerCase().includes(searchTermLower) ||
           description.toLowerCase().includes(searchTermLower);
  })
  .sort((a, b) => {
    switch (sortBy) {
      case 'newest':
        return new Date(b.created_at) - new Date(a.created_at);
      case 'oldest':
        return new Date(a.created_at) - new Date(b.created_at);
      case 'most-participants':
        return b.participants_count - a.participants_count;
      case 'least-participants':
        return a.participants_count - b.participants_count;
      default:
        return 0;
    }
  });

  // Verificar si ya participo en una ruleta
  const isParticipating = (rouletteId) => {
    return myParticipations.some(p => p.roulette_id === rouletteId);
  };

  return (
    <div>
      {/* Controles de búsqueda y filtros */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Buscar ruletas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="newest">Más recientes</option>
            <option value="oldest">Más antiguos</option>
            <option value="most-participants">Más participantes</option>
            <option value="least-participants">Menos participantes</option>
          </select>
        </div>
      </div>

      {/* Lista de ruletas */}
      {filteredRoulettes.length === 0 ? (
        <EmptyState 
          icon={Trophy}
          title="No hay ruletas disponibles"
          description={searchTerm ? "No se encontraron ruletas con ese término" : "No hay ruletas activas en este momento"}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredRoulettes.map((roulette) => (
            <RouletteCard
              key={roulette.id}
              roulette={roulette}
              isParticipating={isParticipating(roulette.id)}
              onParticipate={() => onParticipate(roulette)}
              showParticipateButton={true}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// Tab de Mis Participaciones
const MyParticipationsTab = ({ participations }) => {
  const activeParticipations = participations.filter(p => p.roulette_status === 'active');
  const completedParticipations = participations.filter(p => p.roulette_status === 'completed');

  return (
    <div className="space-y-8">
      {/* Participaciones Activas */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Participaciones Activas</h3>
        {activeParticipations.length === 0 ? (
          <EmptyState 
            icon={Clock}
            title="No tienes participaciones activas"
            description="Participa en una ruleta para ver tus participaciones aquí"
          />
        ) : (
          <div className="grid gap-4">
            {activeParticipations.map((participation) => (
              <ParticipationCard key={participation.id} participation={participation} />
            ))}
          </div>
        )}
      </div>

      {/* Participaciones Completadas */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Historial Completado</h3>
        {completedParticipations.length === 0 ? (
          <EmptyState 
            icon={Award}
            title="No tienes participaciones completadas"
            description="Aquí aparecerán las ruletas en las que participaste y ya fueron sorteadas"
          />
        ) : (
          <div className="grid gap-4">
            {completedParticipations.map((participation) => (
              <ParticipationCard key={participation.id} participation={participation} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Componente para mostrar una participación
const ParticipationCard = ({ participation }) => {
  const isActive = participation.roulette_status === 'active';
  const isWinner = participation.is_winner;
  
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h4 className="font-medium text-gray-900">{participation.roulette_title}</h4>
            {isActive ? (
              <Badge variant="info">En curso</Badge>
            ) : isWinner ? (
              <Badge variant="success">🏆 Ganador</Badge>
            ) : (
              <Badge variant="default">Completado</Badge>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
            <div>
              <p><span className="font-medium">Número:</span> #{participation.participation_number}</p>
              <p><span className="font-medium">Fecha:</span> {new Date(participation.created_at).toLocaleDateString()}</p>
            </div>
            <div>
              <p><span className="font-medium">Participantes:</span> {participation.total_participants}</p>
              {participation.scheduled_date && (
                <p><span className="font-medium">Sorteo:</span> {new Date(participation.scheduled_date).toLocaleDateString()}</p>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 ml-4">
          {participation.receipt_url && (
            <Button variant="ghost" size="sm" title="Ver comprobante">
              <Eye className="h-4 w-4" />
            </Button>
          )}
          <Button variant="ghost" size="sm" title="Ver detalles">
            <Award className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
};

// Tab de Resultados
const ResultsTab = ({ participations }) => {
  const completedParticipations = participations.filter(p => p.roulette_status === 'completed');
  const wins = completedParticipations.filter(p => p.is_winner);
  const losses = completedParticipations.filter(p => !p.is_winner);

  return (
    <div className="space-y-8">
      {/* Estadísticas de resultados */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{wins.length}</div>
          <div className="text-sm text-gray-600">Victorias</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-gray-600">{losses.length}</div>
          <div className="text-sm text-gray-600">Participaciones</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">
            {completedParticipations.length > 0 ? Math.round((wins.length / completedParticipations.length) * 100) : 0}%
          </div>
          <div className="text-sm text-gray-600">Tasa de éxito</div>
        </Card>
      </div>

      {/* Victorias */}
      {wins.length > 0 && (
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
            <Trophy className="mr-2 h-5 w-5 text-yellow-500" />
            Mis Victorias
          </h3>
          <div className="grid gap-4">
            {wins.map((win) => (
              <Card key={win.id} className="p-4 border-l-4 border-l-green-500">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-gray-900 flex items-center">
                      🏆 {win.roulette_title}
                    </h4>
                    <p className="text-sm text-gray-600">
                      Ganaste el {new Date(win.draw_date).toLocaleDateString()}
                    </p>
                    {win.prize_won && (
                      <p className="text-sm text-green-700 font-medium">
                        Premio: {win.prize_won}
                      </p>
                    )}
                  </div>
                  <Badge variant="success">Ganador</Badge>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Mensaje si no hay resultados */}
      {completedParticipations.length === 0 && (
        <EmptyState 
          icon={Award}
          title="No tienes resultados aún"
          description="Participa en ruletas y espera los sorteos para ver tus resultados aquí"
        />
      )}
    </div>
  );
};

export default UserDashboard;