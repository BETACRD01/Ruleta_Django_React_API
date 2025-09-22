// src/components/user/ResultsTab.jsx
import React, { useMemo, useEffect, useState, useCallback } from 'react';
import { Trophy, Award, RefreshCcw, AlertTriangle } from 'lucide-react';
import { Card, Badge, EmptyState, Button } from '../UI';
import { participantsAPI, handleAPIError, formatters } from '../../config/api';

/** Helpers defensivos */
const toArray = (res) => {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.results)) return res.results;
  if (Array.isArray(res?.participations)) return res.participations;
  return [];
};

const getStatus = (p) => p?.roulette_status || p?.status;
const isWinner = (p) =>
  Boolean(p?.is_winner ?? p?.winner ?? p?.result?.is_winner ?? p?.prize_won);

const getTitle = (p) =>
  p?.roulette_title ||
  p?.roulette_name ||
  p?.roulette?.title ||
  p?.roulette?.name ||
  'Ruleta';

const getDrawDateISO = (p) =>
  p?.draw_date || p?.drawn_at || p?.result?.draw_date || p?.roulette?.scheduled_date || null;

const getPrizeText = (p) => {
  // Acepta varias formas de premio
  const direct = p?.prize_won || p?.prize || p?.result?.prize;
  if (!direct) return null;
  if (typeof direct === 'string') return direct;
  // objetos comunes: { name, title, label, value }
  const name = direct.name || direct.title || direct.label;
  const value = direct.value || direct.amount || direct.price;
  if (name && value) return `${name} (${value})`;
  return name || value || null;
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
      setParticipations(toArray(res));
    } catch (err) {
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

  const wins = useMemo(() => completed.filter((p) => isWinner(p)), [completed]);
  // Removed unused 'losses' variable

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
                  const prize = getPrizeText(win);

                  return (
                    <Card key={win.id || `${title}-${drawISO || ''}`} className="p-4 border-l-4 border-l-green-500">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium text-gray-900 flex items-center">
                            🏆 {title}
                          </h4>
                          <p className="text-sm text-gray-600">
                            Ganaste el {draw}
                          </p>
                          {prize && (
                            <p className="text-sm text-green-700 font-medium">
                              Premio: {prize}
                            </p>
                          )}
                        </div>
                        <Badge variant="success">Ganador</Badge>
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