// src/components/admin/ParticipantManager.jsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  Users, Search, Filter, Download, Eye, Trash2,
  Trophy, ChevronDown, ChevronUp,
  RefreshCw, AlertTriangle, User, Crown, X
} from 'lucide-react';

import { participantsAPI, roulettesAPI } from '../../config/api';

const ParticipantManager = ({ onRefreshDashboard }) => {
  const [loading, setLoading] = useState(true);
  const [participants, setParticipants] = useState([]);
  const [roulettes, setRoulettes] = useState([]);
  const [filters, setFilters] = useState({
    search: '',
    roulette: '',
    isWinner: '',
    dateFrom: '',
    dateTo: ''
  });
  const [selectedParticipants, setSelectedParticipants] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState('all'); // 'all', 'winners', 'recent'
  const [selectedParticipant, setSelectedParticipant] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    total: 0,
    winners: 0,
    recent: 0
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Cargar ruletas para el filtro
      const roulettesResponse = await roulettesAPI.getRoulettes({ page_size: 100 });
      const roulettesData = roulettesResponse.results || [];
      setRoulettes(roulettesData);

      // Cargar todas las participaciones de cada ruleta
      const allParticipations = [];
      for (const roulette of roulettesData) {
        try {
          const participantsResponse = await participantsAPI.getRouletteParticipants(roulette.id);
          if (participantsResponse.success && participantsResponse.participants) {
            const enrichedParticipants = participantsResponse.participants.map(p => ({
              ...p,
              roulette_name: roulette.name,
              roulette_id: roulette.id,
              roulette_status: roulette.status,
              roulette_is_drawn: roulette.is_drawn,
              // Simulación de fecha de participación (ajusta cuando tu API la envíe)
              created_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString()
            }));
            allParticipations.push(...enrichedParticipants);
          }
        } catch (err) {
          console.warn(`Error loading participants for roulette ${roulette.id}:`, err);
        }
      }

      setParticipants(allParticipations);

      // Calcular estadísticas
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      setStats({
        total: allParticipations.length,
        winners: allParticipations.filter(p => p.is_winner).length,
        recent: allParticipations.filter(p => new Date(p.created_at) > weekAgo).length
      });

    } catch (error) {
      console.error('Error loading participants:', error);
      setError('Error al cargar participantes: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const applyFilters = () => {
    let filtered = [...participants];

    // Filtro por modo de vista
    switch (viewMode) {
      case 'winners':
        filtered = filtered.filter(p => p.is_winner);
        break;
      case 'recent':
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        filtered = filtered.filter(p => new Date(p.created_at) > weekAgo);
        break;
      default:
        break;
    }

    // Búsqueda
    if (filters.search) {
      const search = filters.search.toLowerCase();
      filtered = filtered.filter(p =>
        p.name?.toLowerCase().includes(search) ||
        p.roulette_name?.toLowerCase().includes(search) ||
        p.participant_number?.toString().includes(search)
      );
    }

    // Ruleta
    if (filters.roulette) {
      filtered = filtered.filter(p => p.roulette_id === parseInt(filters.roulette, 10));
    }

    // Ganador
    if (filters.isWinner === 'true') {
      filtered = filtered.filter(p => p.is_winner);
    } else if (filters.isWinner === 'false') {
      filtered = filtered.filter(p => !p.is_winner);
    }

    // Fechas
    if (filters.dateFrom) {
      const fromDate = new Date(filters.dateFrom);
      filtered = filtered.filter(p => new Date(p.created_at) >= fromDate);
    }
    if (filters.dateTo) {
      const toDate = new Date(filters.dateTo);
      toDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(p => new Date(p.created_at) <= toDate);
    }

    return filtered;
  };

  const filteredParticipants = applyFilters();

  const handleSelectParticipant = (participantId) => {
    setSelectedParticipants(prev => (
      prev.includes(participantId) ? prev.filter(id => id !== participantId) : [...prev, participantId]
    ));
  };

  const handleSelectAll = () => {
    if (selectedParticipants.length === filteredParticipants.length) {
      setSelectedParticipants([]);
    } else {
      setSelectedParticipants(filteredParticipants.map(p => p.id));
    }
  };

  const handleViewDetails = (participant) => {
    setSelectedParticipant(participant);
    setShowDetailModal(true);
  };

  const handleBulkAction = async (action) => {
    if (selectedParticipants.length === 0) {
      alert('Selecciona al menos un participante');
      return;
    }

    let confirmMessage = '';
    switch (action) {
      case 'delete':
        confirmMessage = `¿Eliminar ${selectedParticipants.length} participante(s) seleccionado(s)?`;
        break;
      case 'mark_winner':
        confirmMessage = `¿Marcar ${selectedParticipants.length} participante(s) como ganador(es)?`;
        break;
      case 'unmark_winner':
        confirmMessage = `¿Quitar marca de ganador a ${selectedParticipants.length} participante(s)?`;
        break;
      default:
        return;
    }

    if (!window.confirm(confirmMessage)) return;

    try {
      setActionLoading(true);
      // Implementa aquí la acción real contra tu API
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulación
      alert(`Acción ${action} ejecutada en ${selectedParticipants.length} participante(s)`);
      setSelectedParticipants([]);
      await loadData();
      onRefreshDashboard?.();
    } catch (error) {
      alert('Error ejecutando acción: ' + error.message);
    } finally {
      setActionLoading(false);
    }
  };

  const exportData = () => {
    const dataToExport = filteredParticipants.map(p => ({
      'Número': p.participant_number,
      'Nombre': p.name,
      'Ruleta': p.roulette_name,
      'Estado Ruleta': p.roulette_status,
      'Es Ganador': p.is_winner ? 'Sí' : 'No',
      'Fecha Participación': new Date(p.created_at).toLocaleDateString('es-ES')
    }));

    if (dataToExport.length === 0) {
      alert('No hay datos para exportar');
      return;
    }

    const csvContent = [
      Object.keys(dataToExport[0]).join(','),
      ...dataToExport.map(row => Object.values(row).map(val =>
        typeof val === 'string' && val.includes(',') ? `"${val}"` : val
      ).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `participantes_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Cargando participantes...</span>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Gestión de Participantes</h2>
          <p className="text-sm text-gray-600">
            Total: {stats.total} | Ganadores: {stats.winners} | Recientes: {stats.recent}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </button>
          <button
            onClick={exportData}
            className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </button>
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

      {/* View Modes */}
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            {[
              { id: 'all', label: 'Todos', count: stats.total },
              { id: 'winners', label: 'Ganadores', count: stats.winners },
              { id: 'recent', label: 'Recientes', count: stats.recent }
            ].map((tab) => {
              const isActive = viewMode === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setViewMode(tab.id)}
                  className={`
                    flex items-center whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm
                    ${isActive
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
                  `}
                >
                  {tab.label}
                  {tab.count > 0 && (
                    <span className="ml-2 bg-gray-100 text-gray-900 py-0.5 px-2.5 rounded-full text-xs">
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Buscar por nombre, ruleta o número..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center px-4 py-2 border rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
              showFilters
                ? 'border-blue-500 text-blue-700 bg-blue-50'
                : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
            }`}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filtros
            {showFilters ? <ChevronUp className="ml-2 h-4 w-4" /> : <ChevronDown className="ml-2 h-4 w-4" />}
          </button>
        </div>

        {/* Extended Filters */}
        {showFilters && (
          <div className="bg-gray-50 p-4 rounded-lg border">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ruleta</label>
                <select
                  value={filters.roulette}
                  onChange={(e) => setFilters(prev => ({ ...prev, roulette: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Todas las ruletas</option>
                  {roulettes.map(roulette => (
                    <option key={roulette.id} value={roulette.id}>
                      {roulette.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                <select
                  value={filters.isWinner}
                  onChange={(e) => setFilters(prev => ({ ...prev, isWinner: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Todos</option>
                  <option value="true">Solo ganadores</option>
                  <option value="false">No ganadores</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Desde</label>
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hasta</label>
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <button
                onClick={() => setFilters({ search: '', roulette: '', isWinner: '', dateFrom: '', dateTo: '' })}
                className="text-sm text-gray-600 hover:text-gray-800"
              >
                Limpiar filtros
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bulk Actions */}
      {selectedParticipants.length > 0 && (
        <div className="mb-4 bg-blue-50 border border-blue-200 rounded-md p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <span className="text-sm text-blue-800">
                {selectedParticipants.length} participante(s) seleccionado(s)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleBulkAction('mark_winner')}
                disabled={actionLoading}
                className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-green-700 bg-green-100 hover:bg-green-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                <Crown className="h-3 w-3 mr-1" />
                Marcar ganadores
              </button>
              <button
                onClick={() => handleBulkAction('unmark_winner')}
                disabled={actionLoading}
                className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-yellow-700 bg-yellow-100 hover:bg-yellow-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
              >
                <User className="h-3 w-3 mr-1" />
                Quitar ganadores
              </button>
              <button
                onClick={() => handleBulkAction('delete')}
                disabled={actionLoading}
                className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Eliminar
              </button>
              <button
                onClick={() => setSelectedParticipants([])}
                className="inline-flex items-center px-2 py-1.5 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Participants Table */}
      {filteredParticipants.length === 0 ? (
        <div className="text-center py-12">
          <Users className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No se encontraron participantes</h3>
          <p className="mt-1 text-sm text-gray-500">
            {filters.search || filters.roulette || filters.isWinner || filters.dateFrom || filters.dateTo
              ? 'Intenta ajustar los filtros de búsqueda'
              : 'No hay participantes registrados'
            }
          </p>
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 sm:px-6">
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={selectedParticipants.length === filteredParticipants.length}
                onChange={handleSelectAll}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="ml-3 text-sm text-gray-700">
                Mostrando {filteredParticipants.length} participante(s)
              </span>
            </div>
          </div>
          <ul className="divide-y divide-gray-200">
            {filteredParticipants.map((participant) => (
              <li key={participant.id} className="px-4 py-4 sm:px-6 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={selectedParticipants.includes(participant.id)}
                      onChange={() => handleSelectParticipant(participant.id)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <div className="ml-4 flex items-center">
                      <div className="flex-shrink-0">
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium ${
                          participant.is_winner
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {participant.is_winner ? (
                            <Crown className="h-4 w-4" />
                          ) : (
                            participant.participant_number
                          )}
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="flex items-center">
                          <p className="text-sm font-medium text-gray-900">
                            {participant.name}
                          </p>
                          {participant.is_winner && (
                            <Trophy className="ml-2 h-4 w-4 text-yellow-500" />
                          )}
                        </div>
                        <div className="flex items-center text-sm text-gray-500">
                          <span>{participant.roulette_name}</span>
                          <span className="mx-2">•</span>
                          <span>#{participant.participant_number}</span>
                          <span className="mx-2">•</span>
                          <span>{new Date(participant.created_at).toLocaleDateString('es-ES')}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      participant.roulette_status === 'active'
                        ? 'bg-green-100 text-green-800'
                        : participant.roulette_status === 'completed'
                        ? 'bg-gray-100 text-gray-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {participant.roulette_status === 'active' ? 'Activa' :
                       participant.roulette_status === 'completed' ? 'Completada' : 'Cancelada'}
                    </span>
                    <button
                      onClick={() => handleViewDetails(participant)}
                      className="p-1 text-gray-400 hover:text-gray-600"
                      title="Ver detalles"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedParticipant && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Detalles del Participante</h3>
              <button
                onClick={() => setShowDetailModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">Nombre</label>
                <p className="text-sm text-gray-900">{selectedParticipant.name}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Número de Participante</label>
                <p className="text-sm text-gray-900">#{selectedParticipant.participant_number}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Ruleta</label>
                <p className="text-sm text-gray-900">{selectedParticipant.roulette_name}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Estado</label>
                <div className="flex items-center">
                  {selectedParticipant.is_winner ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                      <Crown className="h-3 w-3 mr-1" />
                      Ganador
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      Participante
                    </span>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Fecha de Participación</label>
                <p className="text-sm text-gray-900">
                  {new Date(selectedParticipant.created_at).toLocaleString('es-ES')}
                </p>
              </div>
            </div>
            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ParticipantManager;
