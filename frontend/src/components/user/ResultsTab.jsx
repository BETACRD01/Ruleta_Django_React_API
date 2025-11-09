// src/components/user/ResultsTab.jsx
import React, { useMemo, useEffect, useState, useCallback } from 'react';
import { Trophy, Award, RefreshCcw, AlertTriangle, Gift } from 'lucide-react';
import { Card, Badge, EmptyState, Button } from '../UI/UI';
import { participantsAPI, handleAPIError, formatters } from '../../config/api';

/** Helpers defensivos mejorados */
const toArray = (res) => {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.results)) return res.results;
  if (Array.isArray(res?.participations)) return res.participations;
  return [];
};

const getStatus = (p) => p?.roulette_status || p?.status || 'unknown';

const isWinner = (p) => {
  // Verifica múltiples campos posibles para determinar si ganó
  return Boolean(
    p?.is_winner || 
    p?.winner || 
    p?.result?.is_winner || 
    p?.prize_won ||
    p?.won_prize ||
    p?.prize
  );
};

const getTitle = (p) =>
  p?.roulette_title ||
  p?.roulette_name ||
  p?.roulette?.title ||
  p?.roulette?.name ||
  'Ruleta';

const getDrawDateISO = (p) =>
  p?.draw_date || 
  p?.drawn_at || 
  p?.result?.draw_date || 
  p?.roulette?.scheduled_date || 
  p?.roulette?.drawn_at ||
  null;

/**
 * Extrae información completa del premio ganado
 * Retorna: { name, description, image, rank }
 */
const getPrizeInfo = (p) => {
  if (!isWinner(p)) return null;

  // Intentar obtener el premio de múltiples ubicaciones posibles
  const prizeObj = 
    p?.won_prize ||
    p?.prize_won || 
    p?.prize || 
    p?.result?.prize ||
    null;

  if (!prizeObj) return null;

  // Si es string, retornar solo el nombre
  if (typeof prizeObj === 'string') {
    return { 
      name: prizeObj, 
      description: null, 
      image: null,
      rank: null 
    };
  }

  // Extraer campos del objeto premio
  return {
    name: prizeObj.name || prizeObj.title || prizeObj.label || 'Premio',
    description: prizeObj.description || null,
    image: p?.prize_image_url || prizeObj.image_url || prizeObj.image || null,
    rank: prizeObj.rank || prizeObj.position || null,
    value: prizeObj.value || prizeObj.amount || prizeObj.price || null,
  };
};

/**
 * Genera un label visual para el ranking del premio
 */
const getRankLabel = (rank) => {
  if (!rank) return null;
  
  const labels = {
    1: '🥇 Primer Lugar',
    2: '🥈 Segundo Lugar',
    3: '🥉 Tercer Lugar',
  };
  
  return labels[rank] || `🏅 ${rank}° Lugar`;
};

const ResultsTab = () => {
  const [participations, setParticipations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setPageError('');
      const res = await participantsAPI.getMyParticipations({ page_size: 300 });
      const data = toArray(res);
      
      console.log('📊 Participaciones cargadas:', data.length);
      console.log('🎯 Primera participación:', data[0]);
      
      setParticipations(data);
    } catch (err) {
      console.error('❌ Error cargando participaciones:', err);
      setPageError(handleAPIError(err, 'No se pudieron cargar tus resultados.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const completed = useMemo(
    () => (Array.isArray(participations) ? participations : [])
            .filter((p) => getStatus(p) === 'completed'),
    [participations]
  );

  const wins = useMemo(() => {
    const winners = completed.filter((p) => isWinner(p));
    console.log('🏆 Victorias encontradas:', winners.length);
    return winners;
  }, [completed]);

  const successRate = useMemo(() => {
    if (completed.length === 0) return 0;
    return Math.round((wins.length / completed.length) * 100);
  }, [wins.length, completed.length]);

  return (
    <div className="space-y-8">
      {/* Encabezado + refrescar */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Resultados</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={loadData}
          disabled={loading}
          className="inline-flex items-center gap-2"
        >
          <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refrescar
        </Button>
      </div>

      {!!pageError && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="text-sm">{pageError}</span>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="py-10 text-center text-gray-500">Cargando resultados…</div>
      )}

      {!loading && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{wins.length}</div>
              <div className="text-sm text-gray-600">Victorias</div>
            </Card>
            <Card className="p-4 text-center">
              <div className="text-2xl font-bold text-gray-600">{completed.length}</div>
              <div className="text-sm text-gray-600">Participaciones completadas</div>
            </Card>
            <Card className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">{successRate}%</div>
              <div className="text-sm text-gray-600">Tasa de éxito</div>
            </Card>
          </div>

          {/* Listado de victorias */}
          {wins.length > 0 && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <Trophy className="mr-2 h-5 w-5 text-yellow-500" />
                Mis Victorias
              </h3>
              <div className="grid gap-4">
                {wins.map((win) => {
                  const title = getTitle(win);
                  const drawISO = getDrawDateISO(win);
                  const draw = drawISO ? formatters.date(drawISO) : '—';
                  const prizeInfo = getPrizeInfo(win);
                  const rankLabel = prizeInfo?.rank ? getRankLabel(prizeInfo.rank) : null;

                  return (
                    <Card 
                      key={win.id || `${title}-${drawISO || ''}`} 
                      className="p-4 border-l-4 border-l-green-500"
                    >
                      <div className="flex gap-4">
                        {/* Imagen del premio si existe */}
                        {prizeInfo?.image && (
                          <div className="flex-shrink-0">
                            <img 
                              src={prizeInfo.image} 
                              alt={prizeInfo.name}
                              className="w-20 h-20 object-cover rounded-lg border-2 border-green-500"
                              onError={(e) => {
                                e.target.style.display = 'none';
                              }}
                            />
                          </div>
                        )}
                        
                        {/* Información del premio */}
                        <div className="flex-1">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className="font-medium text-gray-900 flex items-center gap-2">
                                <Trophy className="h-5 w-5 text-yellow-500" />
                                {title}
                              </h4>
                              
                              <p className="text-sm text-gray-600 mt-1">
                                Ganaste el {draw}
                              </p>
                              
                              {/* Información del premio */}
                              {prizeInfo && (
                                <div className="mt-2 space-y-1">
                                  {rankLabel && (
                                    <p className="text-sm font-semibold text-green-700">
                                      {rankLabel}
                                    </p>
                                  )}
                                  
                                  <p className="text-sm font-medium text-green-700 flex items-center gap-1">
                                    <Gift className="h-4 w-4" />
                                    {prizeInfo.name}
                                    {prizeInfo.value && (
                                      <span className="text-gray-600">
                                        ({prizeInfo.value})
                                      </span>
                                    )}
                                  </p>
                                  
                                  {prizeInfo.description && (
                                    <p className="text-sm text-gray-600">
                                      {prizeInfo.description}
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                            
                            <Badge variant="success" className="ml-2">
                              Ganador
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Estado vacío */}
          {completed.length === 0 && (
            <EmptyState
              icon={Award}
              title="No tienes resultados aún"
              description="Participa en ruletas y espera los sorteos para ver tus resultados aquí"
            />
          )}
        </>
      )}
    </div>
  );
};

export default ResultsTab;