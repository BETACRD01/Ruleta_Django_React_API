// src/components/AdminDashboard.jsx
import React, { useState, useEffect } from 'react';
import { 
  Trophy, Users, CheckCircle, Clock, Plus, 
  Edit, Trash2, Play, Eye, RotateCcw, Award,
  Settings, TrendingUp, Calendar, AlertTriangle
} from 'lucide-react';
import { Card, Button, Badge, Tabs, EmptyState, LoadingSpinner, Modal } from './UI';
import { roulettesAPI, participantsAPI, notificationAPI } from '../config/api';

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    activeRoulettes: 0,
    totalParticipants: 0,
    completedDraws: 0,
    pendingDraws: 0
  });
  const [roulettes, setRoulettes] = useState([]);
  const [error, setError] = useState(null);

  // Cargar datos iniciales
  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Cargar ruletas
      const roulettesResponse = await roulettesAPI.getRoulettes({ page_size: 50 });
      const roulettesData = roulettesResponse.results || [];
      
      // Calcular estadísticas
      const activeCount = roulettesData.filter(r => r.status === 'active').length;
      const completedCount = roulettesData.filter(r => r.status === 'completed').length;
      const totalParticipants = roulettesData.reduce((sum, r) => sum + (r.participants_count || 0), 0);
      const pendingDraws = roulettesData.filter(r => r.status === 'active' && !r.is_drawn).length;

      setRoulettes(roulettesData);
      setStats({
        activeRoulettes: activeCount,
        totalParticipants: totalParticipants,
        completedDraws: completedCount,
        pendingDraws: pendingDraws
      });
    } catch (error) {
      console.error('Error loading dashboard:', error);
      setError('Error al cargar datos del dashboard');
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'overview', label: 'Resumen', icon: TrendingUp },
    { id: 'roulettes', label: 'Gestión de Ruletas', icon: Settings },
    { id: 'draws', label: 'Herramientas de Sorteo', icon: RotateCcw },
    { id: 'participants', label: 'Participantes', icon: Users },
    { id: 'reports', label: 'Reportes', icon: Award }
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
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Panel de Administración</h1>
        <p className="text-gray-600">Gestiona ruletas, sorteos y usuarios del sistema</p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      {/* Estadísticas principales */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard 
          title="Ruletas Activas"
          value={stats.activeRoulettes}
          icon={Trophy}
          color="text-blue-600 bg-blue-100"
          trend="+12%"
        />
        <StatCard 
          title="Total Participantes"
          value={stats.totalParticipants.toLocaleString()}
          icon={Users}
          color="text-green-600 bg-green-100"
          trend="+23%"
        />
        <StatCard 
          title="Sorteos Completados"
          value={stats.completedDraws}
          icon={CheckCircle}
          color="text-purple-600 bg-purple-100"
          trend="+8%"
        />
        <StatCard 
          title="Sorteos Pendientes"
          value={stats.pendingDraws}
          icon={Clock}
          color="text-yellow-600 bg-yellow-100"
          trend="0%"
        />
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
        {activeTab === 'overview' && <OverviewTab roulettes={roulettes} stats={stats} />}
        {activeTab === 'roulettes' && <RoulettesTab roulettes={roulettes} onRefresh={loadDashboardData} />}
        {activeTab === 'draws' && <DrawsTab roulettes={roulettes} onRefresh={loadDashboardData} />}
        {activeTab === 'participants' && <ParticipantsTab />}
        {activeTab === 'reports' && <ReportsTab />}
      </div>
    </div>
  );
};

// Componente para estadísticas
const StatCard = ({ title, value, icon: Icon, color, trend }) => (
  <Card className="p-6">
    <div className="flex items-center">
      <div className={`flex-shrink-0 p-3 rounded-lg ${color}`}>
        <Icon className="h-6 w-6" />
      </div>
      <div className="ml-4 flex-1">
        <p className="text-sm font-medium text-gray-600">{title}</p>
        <div className="flex items-baseline">
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {trend && (
            <span className={`ml-2 text-sm ${trend.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
              {trend}
            </span>
          )}
        </div>
      </div>
    </div>
  </Card>
);

// Tab de Resumen
const OverviewTab = ({ roulettes, stats }) => {
  const recentRoulettes = roulettes.slice(0, 5);
  
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Ruletas recientes */}
      <Card className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900">Ruletas Recientes</h3>
          <Button variant="ghost" size="sm">Ver todas</Button>
        </div>
        <div className="space-y-3">
          {recentRoulettes.map(roulette => (
            <div key={roulette.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">{roulette.title}</p>
                <p className="text-sm text-gray-500">{roulette.participants_count} participantes</p>
              </div>
              <Badge variant={roulette.status === 'active' ? 'success' : 'default'}>
                {roulette.status === 'active' ? 'Activa' : 'Completada'}
              </Badge>
            </div>
          ))}
        </div>
      </Card>

      {/* Actividad reciente */}
      <Card className="p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Actividad Reciente</h3>
        <div className="space-y-3">
          <ActivityItem 
            action="Nueva participación"
            details="Usuario participó en 'Ruleta Navidad'"
            time="Hace 5 minutos"
          />
          <ActivityItem 
            action="Sorteo ejecutado"
            details="Completado sorteo de 'Ruleta Gaming'"
            time="Hace 2 horas"
          />
          <ActivityItem 
            action="Ruleta creada"
            details="Nueva ruleta 'Año Nuevo' agregada"
            time="Hace 1 día"
          />
        </div>
      </Card>
    </div>
  );
};

const ActivityItem = ({ action, details, time }) => (
  <div className="flex items-start space-x-3">
    <div className="w-2 h-2 bg-blue-600 rounded-full mt-2"></div>
    <div>
      <p className="font-medium text-gray-900">{action}</p>
      <p className="text-sm text-gray-500">{details}</p>
      <p className="text-xs text-gray-400">{time}</p>
    </div>
  </div>
);

// Tab de Gestión de Ruletas
const RoulettesTab = ({ roulettes, onRefresh }) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedRoulette, setSelectedRoulette] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const getStatusBadge = (status) => {
    const variants = {
      active: { variant: 'success', text: 'Activa' },
      completed: { variant: 'default', text: 'Completada' },
      cancelled: { variant: 'error', text: 'Cancelada' }
    };
    const config = variants[status] || variants.active;
    return <Badge variant={config.variant}>{config.text}</Badge>;
  };

  const handleDeleteRoulette = async (id) => {
    if (!window.confirm('¿Estás seguro de eliminar esta ruleta?')) return;
    
    try {
      setActionLoading(true);
      await roulettesAPI.deleteRoulette(id);
      onRefresh();
    } catch (error) {
      alert('Error al eliminar ruleta: ' + error.message);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Gestión de Ruletas</h2>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nueva Ruleta
        </Button>
      </div>

      {roulettes.length === 0 ? (
        <EmptyState 
          icon={Trophy}
          title="No hay ruletas"
          description="Crea tu primera ruleta para comenzar"
          action={
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Crear Ruleta
            </Button>
          }
        />
      ) : (
        <div className="grid gap-6">
          {roulettes.map((roulette) => (
            <Card key={roulette.id} className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-medium text-gray-900">{roulette.title}</h3>
                    {getStatusBadge(roulette.status)}
                  </div>
                  <p className="text-gray-600 mb-4">{roulette.description}</p>
                  <div className="flex items-center gap-6 text-sm text-gray-500">
                    <div className="flex items-center">
                      <Users className="mr-1 h-4 w-4" />
                      {roulette.participants_count} participantes
                    </div>
                    {roulette.scheduled_date && (
                      <div className="flex items-center">
                        <Calendar className="mr-1 h-4 w-4" />
                        Sorteo: {new Date(roulette.scheduled_date).toLocaleDateString()}
                      </div>
                    )}
                    <div className="flex items-center">
                      <Clock className="mr-1 h-4 w-4" />
                      Creado: {new Date(roulette.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <Button variant="ghost" size="sm" title="Ver detalles">
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" title="Editar">
                    <Edit className="h-4 w-4" />
                  </Button>
                  {roulette.status === 'active' && !roulette.is_drawn && (
                    <Button variant="ghost" size="sm" title="Ejecutar sorteo">
                      <Play className="h-4 w-4" />
                    </Button>
                  )}
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    title="Eliminar"
                    onClick={() => handleDeleteRoulette(roulette.id)}
                    disabled={actionLoading}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modal crear ruleta - placeholder */}
      <Modal 
        isOpen={showCreateModal} 
        onClose={() => setShowCreateModal(false)}
        title="Crear Nueva Ruleta"
        size="lg"
      >
        <div className="text-center py-8">
          <p className="text-gray-500">Formulario de creación próximamente</p>
          <Button 
            className="mt-4"
            onClick={() => setShowCreateModal(false)}
          >
            Cerrar
          </Button>
        </div>
      </Modal>
    </div>
  );
};

// Tab de Herramientas de Sorteo
const DrawsTab = ({ roulettes, onRefresh }) => {
  const [executing, setExecuting] = useState(false);
  const [selectedRouletteId, setSelectedRouletteId] = useState('');

  const activeRoulettes = roulettes.filter(r => r.status === 'active' && !r.is_drawn);

  const handleExecuteDraw = async () => {
    if (!selectedRouletteId) return;
    
    if (!window.confirm('¿Estás seguro de ejecutar este sorteo? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      setExecuting(true);
      await roulettesAPI.executeRouletteDraw(selectedRouletteId);
      alert('¡Sorteo ejecutado exitosamente!');
      onRefresh();
      setSelectedRouletteId('');
    } catch (error) {
      alert('Error al ejecutar sorteo: ' + error.message);
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Herramientas de Sorteo</h2>
      
      {activeRoulettes.length === 0 ? (
        <EmptyState 
          icon={RotateCcw}
          title="No hay sorteos pendientes"
          description="No hay ruletas activas disponibles para sorteo"
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Sorteo Manual */}
          <Card className="p-6">
            <div className="flex items-center mb-4">
              <div className="bg-blue-100 p-3 rounded-lg">
                <RotateCcw className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-medium text-gray-900">Sorteo Manual</h3>
                <p className="text-sm text-gray-500">Ejecuta el sorteo inmediatamente</p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Seleccionar Ruleta
                </label>
                <select
                  value={selectedRouletteId}
                  onChange={(e) => setSelectedRouletteId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Seleccionar ruleta...</option>
                  {activeRoulettes.map(roulette => (
                    <option key={roulette.id} value={roulette.id}>
                      {roulette.title} ({roulette.participants_count} participantes)
                    </option>
                  ))}
                </select>
              </div>
              
              <Button 
                onClick={handleExecuteDraw}
                disabled={!selectedRouletteId || executing}
                loading={executing}
                className="w-full"
              >
                {executing ? 'Ejecutando Sorteo...' : 'Ejecutar Sorteo'}
              </Button>
            </div>
          </Card>

          {/* Historial de Sorteos */}
          <Card className="p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Historial Reciente</h3>
            <div className="space-y-3">
              {roulettes
                .filter(r => r.is_drawn)
                .slice(0, 5)
                .map(roulette => (
                  <div key={roulette.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{roulette.title}</p>
                      <p className="text-sm text-gray-500">
                        {roulette.participants_count} participantes
                      </p>
                    </div>
                    <Badge variant="success">Completado</Badge>
                  </div>
                ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

// Tab de Participantes
const ParticipantsTab = () => {
  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Gestión de Participantes</h2>
      <EmptyState 
        icon={Users}
        title="Participantes"
        description="Herramientas de gestión de participantes próximamente"
      />
    </div>
  );
};

// Tab de Reportes
const ReportsTab = () => {
  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Reportes y Estadísticas</h2>
      <EmptyState 
        icon={Award}
        title="Reportes"
        description="Panel de reportes y estadísticas próximamente"
      />
    </div>
  );
};

export default AdminDashboard;