// src/components/UserDashboard.jsx
import React, { useState, useEffect } from 'react';
import { Trophy, Users, Award, RefreshCw } from 'lucide-react';
import { Card, Tabs, LoadingSpinner } from './UI';
import { roulettesAPI, participantsAPI, handleAPIError } from '../config/api';
import { useAuth } from '../contexts/AuthContext';

// Tabs externos (extraídos)
import AvailableRoulettesTab from './user/AvailableRoulettesTab';
import MyParticipationsTab from './user/MyParticipationsTab';
import ResultsTab from './user/ResultsTab';

const UserDashboard = () => {
  const [activeTab, setActiveTab] = useState('available');
  const [loading, setLoading] = useState(true);
  const [dashboardStats, setDashboardStats] = useState({
    availableRoulettes: 0,
    myParticipations: 0,
    wonParticipations: 0,
    completedParticipations: 0
  });
  const [roulettes, setRoulettes] = useState([]);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const { user } = useAuth();

  useEffect(() => {
    loadDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Cargar datos en paralelo para mejor rendimiento
      const [roulettesResponse, participationsResponse] = await Promise.all([
        roulettesAPI.getRoulettes({ 
          status: 'active', 
          page_size: 50,
          ordering: '-created_at'
        }),
        participantsAPI.getMyParticipations({ 
          page_size: 100,
          include_results: true,
          include_stats: true
        })
      ]);

      // Procesar ruletas disponibles
      const activeRoulettes = roulettesResponse.results || roulettesResponse || [];
      setRoulettes(activeRoulettes);

      // Procesar participaciones y calcular estadísticas
      const participations = participationsResponse.results || 
                           participationsResponse.participations || 
                           participationsResponse || [];

      const stats = {
        availableRoulettes: activeRoulettes.length,
        myParticipations: participations.length,
        wonParticipations: participations.filter(p => p.is_winner === true).length,
        completedParticipations: participations.filter(p => p.is_drawn === true).length
      };

      setDashboardStats(stats);
      setLastRefresh(new Date());

    } catch (err) {
      console.error('Error loading dashboard:', err);
      setError(handleAPIError(err, 'Error al cargar datos del dashboard'));
    } finally {
      setLoading(false);
    }
  };

  // Handler para participar en ruleta
  const handleParticipate = async (rouletteId, receiptFile = null) => {
    try {
      setError(null);
      
      // Usar el método correcto de la API
      await participantsAPI.participate(rouletteId, receiptFile);
      
      // Recargar datos para actualizar estadísticas
      await loadDashboardData();
      
      // Cambiar a la pestaña de participaciones para mostrar el resultado
      setActiveTab('my-participations');
      
      return { success: true };
    } catch (err) {
      console.error('Error al participar:', err);
      const errorMessage = handleAPIError(err, 'No se pudo registrar tu participación.');
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  // Configuración de pestañas con conteos actualizados
  const tabs = [
    { 
      id: 'available', 
      label: 'Ruletas Disponibles', 
      icon: Trophy, 
      count: dashboardStats.availableRoulettes 
    },
    { 
      id: 'my-participations', 
      label: 'Mis Participaciones', 
      icon: Users, 
      count: dashboardStats.myParticipations 
    },
    { 
      id: 'results', 
      label: 'Resultados', 
      icon: Award, 
      count: dashboardStats.completedParticipations 
    },
  ];

  // Función para refrescar datos manualmente
  const handleRefresh = async () => {
    await loadDashboardData();
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-center items-center h-64">
          <div className="text-center">
            <LoadingSpinner size="lg" />
            <p className="mt-4 text-gray-600">Cargando tu dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header con información del usuario */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              ¡Hola, {user?.first_name || user?.username}!
            </h1>
            <p className="text-gray-600 mt-1">
              Participa en ruletas increíbles y gana premios fantásticos
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Última actualización: {lastRefresh.toLocaleTimeString()}
            </p>
          </div>
          
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start gap-3">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <h4 className="font-medium">Error en el dashboard</h4>
            <p className="text-sm mt-1">{error}</p>
          </div>
          <button
            onClick={() => setError(null)}
            className="ml-auto flex-shrink-0 text-red-400 hover:text-red-600"
          >
            <span className="sr-only">Cerrar</span>
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      )}

      {/* Resumen rápido con estadísticas mejoradas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card className="p-6">
          <div className="flex items-center">
            <div className="bg-blue-100 p-3 rounded-lg">
              <Trophy className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Ruletas Disponibles</p>
              <p className="text-2xl font-bold text-gray-900">{dashboardStats.availableRoulettes}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center">
            <div className="bg-green-100 p-3 rounded-lg">
              <Users className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Mis Participaciones</p>
              <p className="text-2xl font-bold text-gray-900">{dashboardStats.myParticipations}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center">
            <div className="bg-amber-100 p-3 rounded-lg">
              <Award className="h-6 w-6 text-amber-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Ganadas</p>
              <p className="text-2xl font-bold text-gray-900">{dashboardStats.wonParticipations}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center">
            <div className="bg-purple-100 p-3 rounded-lg">
              <Trophy className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Completadas</p>
              <p className="text-2xl font-bold text-gray-900">{dashboardStats.completedParticipations}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Pestañas de navegación */}
      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} className="mb-8" />

      {/* Contenido de pestañas */}
      <div className="min-h-96">
        {activeTab === 'available' && (
          <AvailableRoulettesTab
            roulettes={roulettes}
            onParticipate={handleParticipate}
            onDataChange={loadDashboardData} // Callback para actualizar cuando sea necesario
          />
        )}

        {activeTab === 'my-participations' && (
          <MyParticipationsTab 
            key={lastRefresh.getTime()} // Force re-render when data refreshes
          />
        )}

        {activeTab === 'results' && (
          <ResultsTab 
            onDataChange={loadDashboardData} // Callback para actualizar cuando sea necesario
          />
        )}
      </div>
    </div>
  );
};

export default UserDashboard;