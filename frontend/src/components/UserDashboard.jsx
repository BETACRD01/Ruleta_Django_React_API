// src/components/UserDashboard.jsx
// ============================================================================
// Dashboard de Usuario
// - Muestra estadísticas rápidas (ruletas disponibles, participaciones, ganadas,
//   completadas), pestañas y contenido de cada sección.
// - Usa buenas prácticas de React: helpers puros, hooks memorizados,
//   tolerancia a variaciones de API y control de desmontaje.
// ============================================================================

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Trophy, Users, Award, RefreshCw } from "lucide-react";
import { Card, Tabs, LoadingSpinner } from "./UI";
import { roulettesAPI, participantsAPI, handleAPIError } from "../config/api";
import { useAuth } from "../contexts/AuthContext";

// Pestañas externas
import AvailableRoulettesTab from "./user/AvailableRoulettesTab";
import MyParticipationsTab from "./user/MyParticipationsTab";
import ResultsTab from "./user/ResultsTab";

/* ============================================================================
   Utils & Helpers
   - Pequeñas funciones puras y tolerantes a distintas formas de payload
============================================================================ */
const formatClock = (date) =>
  new Intl.DateTimeFormat("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);

/** Devuelve un array independientemente de si viene en results, participations o raíz */
const toArray = (res) => {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.results)) return res.results;
  if (Array.isArray(res?.participations)) return res.participations;
  return res ? [res].flat().filter(Boolean) : [];
};

/** Detección robusta de ganador */
const isWinner = (p) =>
  p?.is_winner === true ||
  p?.winner === true ||
  String(p?.status || "").toLowerCase() === "won";

/** Detección robusta de participación completada/sorteo realizado */
const isCompleted = (p) => {
  const s = String(p?.status || "").toLowerCase();
  return (
    p?.is_drawn === true ||
    p?.drawn === true ||
    s === "completed" ||
    s === "closed" ||
    s === "finished"
  );
};

/* ============================================================================
   Componente principal
============================================================================ */
const UserDashboard = () => {
  const { user } = useAuth();

  // -----------------------------
  // Estado local
  // -----------------------------
  const [activeTab, setActiveTab] = useState("available");
  const [loading, setLoading] = useState(true);
  const [roulettes, setRoulettes] = useState([]);
  const [participations, setParticipations] = useState([]);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(() => new Date());

  // Flag para evitar setState tras desmontaje
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // -----------------------------
  // Carga de datos (memorizada)
  // -----------------------------
  const loadDashboardData = useCallback(async () => {
    try {
      if (!mountedRef.current) return;
      setLoading(true);
      setError(null);

      const [roulettesRes, participationsRes] = await Promise.all([
        // Ruletas activas (ordenadas por creación desc)
        roulettesAPI.getRoulettes({
          status: "active",
          page_size: 50,
          ordering: "-created_at",
        }),
        // Mis participaciones (con resultados y estadísticas)
        participantsAPI.getMyParticipations({
          page_size: 100,
          include_results: true,
          include_stats: true,
        }),
      ]);

      if (!mountedRef.current) return;
      setRoulettes(toArray(roulettesRes));
      setParticipations(toArray(participationsRes));
      setLastRefresh(new Date());
    } catch (err) {
      if (!mountedRef.current) return;
      setError(handleAPIError(err, "Error al cargar datos del dashboard"));
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  // Cargar una vez al montar
  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // -----------------------------
  // Estadísticas derivadas (memorizadas)
  // -----------------------------
  const stats = useMemo(() => {
    const availableRoulettes = roulettes.length;
    const myParticipations = participations.length;
    const wonParticipations = participations.filter(isWinner).length;
    const completedParticipations = participations.filter(isCompleted).length;

    return {
      availableRoulettes,
      myParticipations,
      wonParticipations,
      completedParticipations,
    };
  }, [roulettes, participations]);

  // -----------------------------
  // Acción: participar en una ruleta
  // -----------------------------
  const handleParticipate = useCallback(
    async (rouletteId, receiptFile = null) => {
      try {
        setError(null);
        await participantsAPI.participate(rouletteId, receiptFile);
        // Tras participar, recargar datos y navegar a "Mis Participaciones"
        await loadDashboardData();
        setActiveTab("my-participations");
        return { success: true };
      } catch (err) {
        const message = handleAPIError(
          err,
          "No se pudo registrar tu participación."
        );
        setError(message);
        return { success: false, error: message };
      }
    },
    [loadDashboardData]
  );

  // -----------------------------
  // Tabs (memorizadas)
  // -----------------------------
  const tabs = useMemo(
    () => [
      {
        id: "available",
        label: "Ruletas Disponibles",
        icon: Trophy,
        count: stats.availableRoulettes,
      },
      {
        id: "my-participations",
        label: "Mis Participaciones",
        icon: Users,
        count: stats.myParticipations,
      },
      {
        id: "results",
        label: "Resultados",
        icon: Award,
        count: stats.completedParticipations,
      },
    ],
    [stats.availableRoulettes, stats.myParticipations, stats.completedParticipations]
  );

  // -----------------------------
  // Refresh manual
  // -----------------------------
  const handleRefresh = useCallback(async () => {
    await loadDashboardData();
  }, [loadDashboardData]);

  /* ============================================================================
     Render
  ============================================================================ */
  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-8">
        <div className="flex justify-center items-center h-64">
          <div className="text-center">
            <LoadingSpinner size="lg" />
            <p className="mt-3 text-gray-600 text-sm">
              Cargando tu dashboard…
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-6">
      {/* ------------------------------------------------------------------
          Header: saludo + acciones
      ------------------------------------------------------------------- */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-gray-900 truncate">
              ¡Hola, {user?.first_name || user?.username || "participante"}!
            </h1>
            <p className="text-gray-600 mt-1 text-sm">
              Participa en ruletas y gana premios fantásticos.
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Última actualización: {formatClock(lastRefresh)}
            </p>
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            aria-label="Actualizar dashboard"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------------
          Alert de error (cuando exista)
      ------------------------------------------------------------------- */}
      {error && (
        <div
          role="alert"
          className="mb-5 bg-red-50 border border-red-200 text-red-700 px-3 py-3 rounded-md flex items-start gap-3"
        >
          <div className="flex-shrink-0">
            <svg
              className="h-5 w-5 text-red-400"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="min-w-0">
            <h4 className="font-medium text-sm">Error en el dashboard</h4>
            <p className="text-sm mt-1 break-words">{error}</p>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="ml-auto flex-shrink-0 text-red-400 hover:text-red-600"
            aria-label="Cerrar alerta de error"
            title="Cerrar"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      )}

      {/* ------------------------------------------------------------------
          Resumen: tarjetas compactas
          - Altura y tipografías contenidas para no “ocupar” de más.
      ------------------------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Card className="p-4">
          <div className="flex items-center">
            <div className="bg-blue-100 p-2.5 rounded-md">
              <Trophy className="h-5 w-5 text-blue-600" />
            </div>
            <div className="ml-3">
              <p className="text-xs font-medium text-gray-600">
                Ruletas Disponibles
              </p>
              <p className="text-xl font-bold text-gray-900">
                {stats.availableRoulettes}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center">
            <div className="bg-green-100 p-2.5 rounded-md">
              <Users className="h-5 w-5 text-green-600" />
            </div>
            <div className="ml-3">
              <p className="text-xs font-medium text-gray-600">
                Mis Participaciones
              </p>
              <p className="text-xl font-bold text-gray-900">
                {stats.myParticipations}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center">
            <div className="bg-amber-100 p-2.5 rounded-md">
              <Award className="h-5 w-5 text-amber-600" />
            </div>
            <div className="ml-3">
              <p className="text-xs font-medium text-gray-600">Ganadas</p>
              <p className="text-xl font-bold text-gray-900">
                {stats.wonParticipations}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center">
            <div className="bg-purple-100 p-2.5 rounded-md">
              <Trophy className="h-5 w-5 text-purple-600" />
            </div>
            <div className="ml-3">
              <p className="text-xs font-medium text-gray-600">Completadas</p>
              <p className="text-xl font-bold text-gray-900">
                {stats.completedParticipations}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* ------------------------------------------------------------------
          Navegación por pestañas
      ------------------------------------------------------------------- */}
      <Tabs
        tabs={tabs}
        activeTab={activeTab}
        onChange={setActiveTab}
        className="mb-6"
      />

      {/* ------------------------------------------------------------------
          Contenido de cada pestaña
      ------------------------------------------------------------------- */}
      <div className="min-h-80">
        {activeTab === "available" && (
          <AvailableRoulettesTab
            roulettes={roulettes}
            onParticipate={handleParticipate}
            onDataChange={loadDashboardData}
          />
        )}

        {activeTab === "my-participations" && (
          // La key fuerza re-render si cambia lastRefresh
          <MyParticipationsTab key={lastRefresh.getTime()} />
        )}

        {activeTab === "results" && (
          <ResultsTab onDataChange={loadDashboardData} />
        )}
      </div>
    </div>
  );
};

export default UserDashboard;