// src/components/AdminDashboard.jsx
import React, { useState, useEffect } from 'react';
import {
  Trophy, Users, CheckCircle, Clock,
  Edit, Trash2, Eye,
  Settings, TrendingUp, Calendar, AlertTriangle,
  Bell
} from 'lucide-react';

import { roulettesAPI, notificationAPI, notificationManager } from '../config/api';
// ⬇️ Centro de notificaciones
import NotificationCenter from '../components/admin/NotificationCenter';
import RouletteManager from '../components/admin/RouletteManager';
import ParticipantManager from '../components/admin/ParticipantManager';
import ReportsManager from '../components/admin/ReportsManager';

// ===============================
// DASHBOARD PRINCIPAL (sin herramienta de sorteo)
// ===============================
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

  // ---- Notificaciones (contador en campana) ----
  const [unreadCount, setUnreadCount] = useState(0);

  // Cargar datos iniciales de ruletas
  useEffect(() => {
    loadDashboardData();
  }, []);

  // Polling/Sync de notificaciones
  useEffect(() => {
    let mounted = true;

    const syncUnread = async () => {
      try {
        const s = await notificationAPI.stats();
        if (mounted) setUnreadCount(s?.unread_notifications || s?.unread_count || 0);
      } catch (e) {
        try {
          const res = await notificationAPI.getUserNotifications({ include_stats: true, page_size: 1 });
          const count = res?.stats?.unread_count ?? 0;
          if (mounted) setUnreadCount(count);
        } catch (_) {}
      }
    };

    syncUnread();

    const handler = ({ stats }) => setUnreadCount(stats?.unread_count || 0);
    if (notificationManager?.addListener) {
      notificationManager.addListener('notifications_updated', handler);
      if (notificationManager?.startPolling) notificationManager.startPolling(30000);
    } else {
      const id = setInterval(syncUnread, 30000);
      return () => { mounted = false; clearInterval(id); };
    }

    return () => {
      mounted = false;
      if (notificationManager?.removeListener) {
        notificationManager.removeListener('notifications_updated', handler);
      }
    };
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      const roulettesResponse = await roulettesAPI.getRoulettes({ page_size: 50 });
      const roulettesData = roulettesResponse.results || [];

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
      setError('Error al cargar datos del dashboard: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // ✅ pestañas SIN la herramienta de sorteo
  const tabs = [
    { id: 'overview', label: 'Resumen', icon: TrendingUp },
    { id: 'roulettes', label: 'Gestión de Ruletas', icon: Settings },
    { id: 'participants', label: 'Participantes', icon: Users },
    { id: 'notifications', label: 'Notificaciones', icon: Bell, badge: unreadCount },
    { id: 'reports', label: 'Reportes', icon: CheckCircle }
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 py-6 lg:py-8">
        {/* Header */}
        <div className="mb-6 lg:mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Panel de Administración</h1>
            <p className="text-gray-600 text-sm lg:text-base">
              Gestiona ruletas, usuarios y notificaciones del sistema
            </p>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
            <div className="flex">
              <AlertTriangle className="h-5 w-5 mr-2 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          </div>
        )}

        {/* Estadísticas principales */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-6 mb-6 lg:mb-8">
          <StatCard 
            title="Ruletas Activas" 
            value={stats.activeRoulettes} 
            icon={Trophy} 
            color="text-blue-600 bg-blue-100" 
          />
          <StatCard 
            title="Total Participantes" 
            value={stats.totalParticipants.toLocaleString()} 
            icon={Users} 
            color="text-green-600 bg-green-100" 
          />
          <StatCard 
            title="Sorteos Completados" 
            value={stats.completedDraws} 
            icon={CheckCircle} 
            color="text-purple-600 bg-purple-100" 
          />
          <StatCard 
            title="Sorteos Pendientes" 
            value={stats.pendingDraws} 
            icon={Clock} 
            color="text-yellow-600 bg-yellow-100" 
          />
        </div>

        {/* Pestañas */}
        <div className="mb-6 lg:mb-8">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8" aria-label="Tabs">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`
                      relative flex items-center whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm
                      ${isActive ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
                    `}
                  >
                    <Icon className="h-4 w-4 mr-2" />
                    {tab.label}
                    {tab.id === 'notifications' && (tab.badge || 0) > 0 && (
                      <span className="ml-2 inline-flex items-center justify-center text-[10px] font-semibold rounded-full bg-red-600 text-white px-1.5 py-0.5">
                        {tab.badge > 99 ? '99+' : tab.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Contenido de pestañas */}
        <div>
          {activeTab === 'overview' && <OverviewTab roulettes={roulettes} stats={stats} />}
          {activeTab === 'roulettes' && (<RouletteManager onRefetchDashboard={loadDashboardData} />)}
          {activeTab === 'participants' && <ParticipantManager onRefreshDashboard={loadDashboardData} />}
          {activeTab === 'notifications' && (
            <NotificationCenter
              onUnreadChange={setUnreadCount}
              defaultPageSize={15}
              compact={false}
            />
          )}
          {activeTab === 'reports' && <ReportsManager onRefreshDashboard={loadDashboardData} />}
        </div>
      </div>
    </div>
  );
};

// ===============================
// Tarjeta de estadística
// ===============================
const StatCard = ({ title, value, icon: Icon, color }) => (
  <div className="bg-white p-4 lg:p-6 rounded-lg shadow hover:shadow-md transition-shadow">
    <div className="flex items-center">
      <div className={`flex-shrink-0 p-2.5 lg:p-3 rounded-lg ${color}`}>
        <Icon className="h-5 w-5 lg:h-6 lg:w-6" />
      </div>
      <div className="ml-3 lg:ml-4 flex-1 min-w-0">
        <p className="text-xs lg:text-sm font-medium text-gray-600 truncate">{title}</p>
        <p className="text-xl lg:text-2xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  </div>
);

// ===============================
// Resumen
// ===============================
const OverviewTab = ({ roulettes, stats }) => {
  const recentRoulettes = roulettes.slice(0, 5);

  return (
    <div className="p-4 lg:p-6">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 lg:gap-8">
        {/* Ruletas recientes */}
        <div className="bg-gray-50 p-4 lg:p-6 rounded-lg">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">Ruletas Recientes</h3>
          </div>
          <div className="space-y-3">
            {recentRoulettes.length > 0 ? recentRoulettes.map(roulette => (
              <div key={roulette.id} className="flex items-center justify-between p-3 bg-white rounded-lg shadow-sm">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{roulette.name}</p>
                  <p className="text-sm text-gray-500">{roulette.participants_count || 0} participantes</p>
                </div>
                <span className={`
                  inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ml-2
                  ${roulette.status === 'active'
                    ? 'bg-green-100 text-green-800'
                    : roulette.status === 'completed'
                    ? 'bg-gray-100 text-gray-800'
                    : 'bg-red-100 text-red-800'
                  }
                `}>
                  {roulette.status === 'active' ? 'Activa' :
                   roulette.status === 'completed' ? 'Completada' : 'Cancelada'}
                </span>
              </div>
            )) : (
              <p className="text-gray-500 text-center py-4">No hay ruletas disponibles</p>
            )}
          </div>
        </div>

        {/* Resumen de estadísticas */}
        <div className="bg-gray-50 p-4 lg:p-6 rounded-lg">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Resumen General</h3>
          <div className="space-y-4">
            <div className="flex justify-between">
              <span className="text-gray-600">Total de ruletas</span>
              <span className="font-medium">{roulettes.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Ruletas activas</span>
              <span className="font-medium text-green-600">{stats.activeRoulettes}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Sorteos completados</span>
              <span className="font-medium text-blue-600">{stats.completedDraws}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Total participantes</span>
              <span className="font-medium">{stats.totalParticipants}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ===============================
// Gestión de Ruletas (sin botón de sorteo)
// ===============================
const RoulettesTab = ({ roulettes, onRefresh }) => {
  const [actionLoading, setActionLoading] = useState(false);

  const getStatusBadge = (status) => {
    const variants = {
      active: { className: 'bg-green-100 text-green-800', text: 'Activa' },
      completed: { className: 'bg-gray-100 text-gray-800', text: 'Completada' },
      cancelled: { className: 'bg-red-100 text-red-800', text: 'Cancelada' }
    };
    const config = variants[status] || variants.active;
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className}`}>
        {config.text}
      </span>
    );
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
      </div>

      {roulettes.length === 0 ? (
        <div className="text-center py-12">
          <Trophy className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No hay ruletas</h3>
          <p className="mt-1 text-sm text-gray-500">No se encontraron ruletas en el sistema</p>
        </div>
      ) : (
        <div className="grid gap-6">
          {roulettes.map((roulette) => (
            <div key={roulette.id} className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-medium text-gray-900">{roulette.name}</h3>
                    {getStatusBadge(roulette.status)}
                  </div>
                  <p className="text-gray-600 mb-4">{roulette.description || 'Sin descripción'}</p>
                  <div className="flex items-center gap-6 text-sm text-gray-500">
                    <div className="flex items-center">
                      <Users className="mr-1 h-4 w-4" />
                      {roulette.participants_count || 0} participantes
                    </div>
                    {roulette.scheduled_date && (
                      <div className="flex items-center">
                        <Calendar className="mr-1 h-4 w-4" />
                        Sorteo: {new Date(roulette.scheduled_date).toLocaleDateString('es-ES')}
                      </div>
                    )}
                    {roulette.created_at && (
                      <div className="flex items-center">
                        <Clock className="mr-1 h-4 w-4" />
                        Creado: {new Date(roulette.created_at).toLocaleDateString('es-ES')}
                      </div>
                    )}
                  </div>
                  {roulette.winner_name && (
                    <div className="mt-2 text-sm text-green-600">
                      Ganador: {roulette.winner_name}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button
                    className="p-2 text-gray-400 hover:text-gray-600"
                    title="Ver detalles"
                    onClick={() => console.log('Ver detalles:', roulette.id)}
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  <button
                    className="p-2 text-gray-400 hover:text-gray-600"
                    title="Editar"
                    onClick={() => console.log('Editar:', roulette.id)}
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  {/* 🔥 Eliminado el botón de ejecutar sorteo */}
                  <button
                    className="p-2 text-red-600 hover:text-red-800"
                    title="Eliminar"
                    onClick={() => handleDeleteRoulette(roulette.id)}
                    disabled={actionLoading}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ===============================
// Participantes (placeholder)
// ===============================
const ParticipantsTab = () => {
  return (
    <div className="p-4 lg:p-6">
      <div className="text-center py-12">
        <Users className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">Participantes</h3>
        <p className="mt-1 text-sm text-gray-500">Módulo de participantes</p>
      </div>
    </div>
  );
};

// ===============================
// NotificationsTab (referencia)
// ===============================
const NotificationsTab = ({ onUnreadChange }) => {
  return (
    <div className="text-sm text-gray-500">
      <p>Este módulo fue reemplazado por <code>NotificationCenter</code>.</p>
    </div>
  );
};

// ===============================
// Reportes (placeholder)
// ===============================
const ReportsTab = () => {
  return (
    <div className="p-4 lg:p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Reportes y Estadísticas</h2>
      <div className="text-center py-12">
        <CheckCircle className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">Reportes</h3>
        <p className="mt-1 text-sm text-gray-500">Panel de reportes y estadísticas próximamente</p>
      </div>
    </div>
  );
};

export default AdminDashboard;
