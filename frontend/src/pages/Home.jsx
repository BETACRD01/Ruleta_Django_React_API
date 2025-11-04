// src/pages/Home.jsx - Con estadísticas reales de la API
import React from "react";
import { Shield, Bell, Sparkles, Award, Trophy, Activity, Users, Gift, Clock, Star, TrendingUp, Zap, AlertCircle, X } from "lucide-react";
import { publicAPI } from "../config/publicApi";
import { useAuth } from "../contexts/AuthContext";
import RouletteCard from "../components/public/RouletteCard";

const BRAND = {
  azul: "#0b56a7",
  azulOscuro: "#003049",
  celeste: "#389fae",
  turquesa: "#4dc9b1",
  rojo: "#D62829",
};

const FeatureCard = ({ Icon, title, description, gradient }) => (
  <div className="group relative overflow-hidden rounded-2xl bg-white p-6 shadow-lg border border-gray-100 hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
    <div className={`absolute top-0 right-0 w-32 h-32 ${gradient} opacity-10 rounded-full blur-3xl group-hover:opacity-20 transition-opacity`} />
    <div className="relative z-10">
      <div className={`inline-flex p-3 rounded-xl ${gradient} mb-4`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-600 leading-relaxed">{description}</p>
    </div>
  </div>
);

const StatCard = ({ icon: Icon, label, value, color }) => (
  <div className="bg-white rounded-xl p-6 shadow-md border border-gray-100 hover:shadow-xl transition-all duration-300">
    <div className="flex items-center justify-between mb-3">
      <Icon className="w-8 h-8" style={{ color }} />
      <span className="text-3xl font-black" style={{ color }}>{value}</span>
    </div>
    <p className="text-sm font-medium text-gray-600">{label}</p>
  </div>
);

function WinnersAndActivityCard() {
  const { token, isAuthenticated } = useAuth();
  const [tab, setTab] = React.useState("actividad");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [showAuthNotice, setShowAuthNotice] = React.useState(false);

  const [metrics, setMetrics] = React.useState({
    roulettes_total: 0,
    active_roulettes: 0,
    winners_total: 0,
    participants_total: 0
  });
  const [winners, setWinners] = React.useState([]);
  const [roulettes, setRoulettes] = React.useState([]);
  const [serverTime, setServerTime] = React.useState(null);

  React.useEffect(() => {
    let isCancelled = false;

    const loadData = async () => {
      try {
        setLoading(true);
        setError("");

        const [metricsResult, winnersResult, roulettesResult] = await Promise.allSettled([
          publicAPI.getPublicMetrics(),
          publicAPI.getPublicDrawHistory({ page_size: 8 }),
          publicAPI.getPublicRoulettes({ page_size: 6, status: "active" }),
        ]);

        if (isCancelled) return;

        // Procesar métricas
        if (metricsResult.status === "fulfilled") {
          const m = metricsResult.value;
          setMetrics({
            roulettes_total: m.roulettes_total || 0,
            active_roulettes: m.active_roulettes || 0,
            winners_total: m.winners_total || 0,
            participants_total: m.participants_total || 0,
          });
          setServerTime(m.server_time);
        }

        // Procesar ganadores
        if (winnersResult.status === "fulfilled") {
          const data = winnersResult.value;
          setWinners(
            Array.isArray(data.results)
              ? data.results.map((d, i) => ({
                  id: d.id || `winner-${i}`,
                  roulette_name: d.roulette_name || "Sorteo",
                  winner_name: d.winner_name || "Ganador",
                  created_at: d.draw_date || new Date().toISOString(),
                  participants_count: d.participants_count || 0,
                  draw_type: d.draw_type || "manual",
                }))
              : []
          );
        } else {
          setWinners([]);
        }

        // Procesar ruletas activas
        if (roulettesResult.status === "fulfilled") {
          const data = roulettesResult.value;
          const actives = Array.isArray(data.results)
            ? data.results.filter(
                r => r.participation_is_open === true || r.status === "active" || r.status === "scheduled"
              )
            : [];
          setRoulettes(actives);
        } else {
          setRoulettes([]);
        }
      } catch (e) {
        if (!isCancelled) {
          setError(e?.message || "Error cargando datos");
          setMetrics({ roulettes_total: 0, active_roulettes: 0, winners_total: 0, participants_total: 0 });
          setWinners([]);
          setRoulettes([]);
        }
      } finally {
        if (!isCancelled) setLoading(false);
      }
    };

    loadData();
    return () => { isCancelled = true; };
  }, [token]);

  React.useEffect(() => {
    if (showAuthNotice) {
      const timer = setTimeout(() => {
        setShowAuthNotice(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [showAuthNotice]);

  const handleRouletteClick = (roulette) => {
    if (!isAuthenticated) {
      setShowAuthNotice(true);
      return;
    }
    console.log("Usuario autenticado, accediendo a:", roulette);
    // Aquí puedes agregar navegación: window.location.href = `/roulette/${roulette.id}`;
  };

  return (
    <>
      {showAuthNotice && (
        <div className="fixed top-20 sm:top-24 right-4 z-50 animate-slide-in max-w-[calc(100vw-2rem)] sm:max-w-sm">
          <div className="bg-gradient-to-r from-[#0b56a7] to-[#003049] text-white rounded-xl shadow-2xl border-2 border-white/20 p-4">
            <div className="flex items-start gap-3">
              <div className="bg-white/20 backdrop-blur-sm rounded-lg p-2 flex-shrink-0">
                <AlertCircle className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-white text-sm mb-1">Inicia sesión para continuar</h4>
                <p className="text-xs text-blue-100 leading-relaxed">Regístrate o inicia sesión para participar</p>
              </div>
              <button
                onClick={() => setShowAuthNotice(false)}
                className="p-1 hover:bg-white/20 rounded-full transition-colors flex-shrink-0"
              >
                <X size={16} className="text-white" />
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-[#0b56a7] to-[#003049] p-4 sm:p-6 lg:p-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-2 sm:p-3">
                <Trophy className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-white">Actividad en Tiempo Real</h2>
                <p className="text-blue-100 text-xs sm:text-sm mt-1">Participa en sorteos activos ahora</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-2 bg-red-500 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-bold shadow-lg">
              <Activity className="w-3 h-3 sm:w-4 sm:h-4 animate-pulse" />
              En vivo
            </span>
          </div>

          {/* KPIs desde la API */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 mt-4 sm:mt-6">
            {loading ? (
              <>
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 sm:p-4 animate-pulse">
                  <div className="h-3 sm:h-4 bg-white/20 rounded mb-2" />
                  <div className="h-6 sm:h-8 bg-white/20 rounded" />
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 sm:p-4 animate-pulse">
                  <div className="h-3 sm:h-4 bg-white/20 rounded mb-2" />
                  <div className="h-6 sm:h-8 bg-white/20 rounded" />
                </div>
              </>
            ) : (
              <>
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 sm:p-4 border border-white/20">
                  <p className="text-[10px] sm:text-xs font-semibold text-blue-100 uppercase tracking-wider mb-1">Ruletas Activas</p>
                  <p className="text-2xl sm:text-3xl font-black text-white">{metrics.active_roulettes}</p>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 sm:p-4 border border-white/20">
                  <p className="text-[10px] sm:text-xs font-semibold text-blue-100 uppercase tracking-wider mb-1">Total Ganadores</p>
                  <p className="text-2xl sm:text-3xl font-black text-white">{metrics.winners_total}</p>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6">
          <div className="inline-flex bg-gray-100 rounded-xl p-1 w-full sm:w-auto overflow-x-auto">
            <button
              onClick={() => setTab("actividad")}
              className={`px-4 sm:px-6 py-2 sm:py-3 rounded-lg text-xs sm:text-sm font-bold transition-all duration-200 whitespace-nowrap ${
                tab === "actividad"
                  ? "bg-[#0b56a7] text-white shadow-md"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Ruletas Activas ({roulettes.length})
            </button>
            <button
              onClick={() => setTab("ganadores")}
              className={`px-4 sm:px-6 py-2 sm:py-3 rounded-lg text-xs sm:text-sm font-bold transition-all duration-200 whitespace-nowrap ${
                tab === "ganadores"
                  ? "bg-[#0b56a7] text-white shadow-md"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Ganadores Recientes ({winners.length})
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-6 lg:p-8">
          {error && (
            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 sm:p-6 mb-4 sm:mb-6">
              <div className="flex items-start gap-3">
                <div className="bg-red-100 rounded-lg p-2">
                  <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-red-600" />
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-red-900 mb-1 text-sm sm:text-base">Error al cargar datos</h4>
                  <p className="text-xs sm:text-sm text-red-700">{error}</p>
                  <button
                    onClick={() => window.location.reload()}
                    className="mt-3 text-xs sm:text-sm font-semibold text-red-600 hover:text-red-800 underline"
                  >
                    Recargar página
                  </button>
                </div>
              </div>
            </div>
          )}

          {!error && tab === "actividad" && (
            <div>
              {loading ? (
                <div className="space-y-4 sm:space-y-6">
                  {[...Array(2)].map((_, i) => (
                    <div key={i} className="bg-gray-50 rounded-2xl p-4 sm:p-6 animate-pulse">
                      <div className="h-24 sm:h-32 bg-gray-200 rounded-xl mb-4" />
                      <div className="h-4 sm:h-5 bg-gray-200 rounded mb-3" />
                      <div className="h-3 sm:h-4 bg-gray-200 rounded w-3/4" />
                    </div>
                  ))}
                </div>
              ) : roulettes.length === 0 ? (
                <div className="text-center py-12 sm:py-16 bg-gradient-to-br from-gray-50 to-blue-50 rounded-2xl border-2 border-dashed border-gray-200">
                  <div className="text-5xl sm:text-7xl mb-4">🎰</div>
                  <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">No hay ruletas activas ahora</h3>
                  <p className="text-sm sm:text-base text-gray-600">Vuelve pronto para participar en nuevos sorteos</p>
                </div>
              ) : (
                <div className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {roulettes.map((roulette) => (
                    <div
                      key={roulette.id}
                      className="transform hover:scale-[1.02] transition-all duration-300"
                    >
                      <RouletteCard 
                        roulette={roulette} 
                        serverTime={serverTime} 
                        onClick={handleRouletteClick}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {!error && tab === "ganadores" && (
            <div className="space-y-3 sm:space-y-4">
              {loading ? (
                <>
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="bg-gray-50 rounded-xl p-4 sm:p-6 animate-pulse">
                      <div className="h-4 sm:h-5 bg-gray-200 rounded w-3/4 mb-3" />
                      <div className="h-3 sm:h-4 bg-gray-200 rounded w-1/2" />
                    </div>
                  ))}
                </>
              ) : winners.length === 0 ? (
                <div className="text-center py-12 sm:py-16 bg-gradient-to-br from-gray-50 to-yellow-50 rounded-2xl border-2 border-dashed border-gray-200">
                  <div className="text-5xl sm:text-7xl mb-4">🏆</div>
                  <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">Sé el primero en ganar</h3>
                  <p className="text-sm sm:text-base text-gray-600">Los ganadores recientes aparecerán aquí</p>
                </div>
              ) : (
                winners.map((winner, idx) => (
                  <div
                    key={winner.id || `winner-${idx}`}
                    className="bg-gradient-to-r from-white to-yellow-50 rounded-xl p-4 sm:p-6 border border-yellow-200 shadow-md hover:shadow-xl transition-all"
                  >
                    <div className="flex flex-col sm:flex-row items-start justify-between gap-3 sm:gap-4">
                      <div className="flex-1 w-full">
                        <h4 className="text-base sm:text-lg font-bold text-gray-900 mb-2">{winner.roulette_name}</h4>
                        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                          <span className="inline-flex items-center gap-2 bg-gradient-to-r from-[#D62829] to-red-600 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-bold shadow-md">
                            <Trophy className="w-3 h-3 sm:w-4 sm:h-4" />
                            {winner.winner_name}
                          </span>
                          {winner.participants_count > 0 && (
                            <span className="inline-flex items-center gap-2 bg-gray-100 text-gray-700 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-medium">
                              <Users className="w-3 h-3 sm:w-4 sm:h-4" />
                              {winner.participants_count} participantes
                            </span>
                          )}
                        </div>
                        {winner.created_at && (
                          <p className="text-xs sm:text-sm text-gray-500 mt-2">
                            {new Date(winner.created_at).toLocaleDateString("es-ES", {
                              day: "2-digit",
                              month: "long",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        )}
                      </div>
                      <div className="bg-[#4dc9b1] text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-[10px] sm:text-xs font-bold shadow-md">
                        Sorteado
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function InfoSidebar({ metrics }) {
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Cómo Funciona */}
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-[#4dc9b1] to-[#389fae] p-4 sm:p-6">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-2">
              <Star className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <h3 className="text-lg sm:text-xl font-black text-white">¿Cómo Funciona?</h3>
          </div>
        </div>
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
          {[
            { n: 1, t: "Regístrate Gratis", s: "Crea tu cuenta en menos de 30 segundos" },
            { n: 2, t: "Elige tu Sorteo", s: "Explora y participa en las ruletas activas" },
            { n: 3, t: "Gana Premios", s: "Sorteos 100% aleatorios y verificables" },
          ].map(step => (
            <div key={step.n} className="flex items-start gap-3 sm:gap-4 group">
              <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#4dc9b1] to-[#389fae] text-white text-base sm:text-lg font-black shadow-md group-hover:scale-110 transition-transform flex-shrink-0">
                {step.n}
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-gray-900 mb-1 text-sm sm:text-base">{step.t}</h4>
                <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">{step.s}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Estadísticas dinámicas desde la API */}
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-4 sm:p-6">
        <div className="flex items-center gap-3 mb-4 sm:mb-6">
          <div className="bg-gradient-to-br from-[#0b56a7] to-[#003049] rounded-xl p-2">
            <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </div>
          <h3 className="text-lg sm:text-xl font-black text-gray-900">Nuestra Comunidad</h3>
        </div>
        <div className="space-y-3 sm:space-y-4">
          <StatCard 
            icon={Users} 
            label="Participantes Totales" 
            value={metrics.participants_total > 0 ? `${(metrics.participants_total / 1000).toFixed(1)}K` : "0"} 
            color={BRAND.azul} 
          />
          <StatCard 
            icon={Trophy} 
            label="Sorteos Realizados" 
            value={metrics.roulettes_total || 0} 
            color={BRAND.celeste} 
          />
          <StatCard 
            icon={Gift} 
            label="Ganadores Felices" 
            value={metrics.winners_total || 0} 
            color={BRAND.turquesa} 
          />
        </div>
      </div>

      {/* Próximamente */}
      <div className="bg-gradient-to-br from-[#0b56a7] to-[#003049] rounded-2xl shadow-xl p-4 sm:p-6 text-white">
        <div className="flex items-center gap-3 mb-4 sm:mb-6">
          <div className="bg-white/20 backdrop-blur-sm rounded-xl p-2">
            <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </div>
          <h3 className="text-lg sm:text-xl font-black">Próximamente</h3>
        </div>
        <div className="space-y-3 sm:space-y-4">
          {[
            { icon: Clock, text: "Sorteos automáticos programados" },
            { icon: Bell, text: "Notificaciones push en tiempo real" },
            { icon: Award, text: "Sistema de recompensas por participación" },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-3 text-white/90">
              <item.icon className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="text-xs sm:text-sm font-medium">{item.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [metrics, setMetrics] = React.useState({
    roulettes_total: 0,
    active_roulettes: 0,
    winners_total: 0,
    participants_total: 0
  });

  // Cargar métricas para el sidebar
  React.useEffect(() => {
    publicAPI.getPublicMetrics()
      .then(m => {
        setMetrics({
          roulettes_total: m.roulettes_total || 0,
          active_roulettes: m.active_roulettes || 0,
          winners_total: m.winners_total || 0,
          participants_total: m.participants_total || 0,
        });
      })
      .catch(() => {
        // Si falla, mantener valores en 0
      });
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-gray-100">
      {/* Animación para la notificación */}
      <style>{`
        @keyframes slide-in {
          from {
            opacity: 0;
            transform: translateX(100%);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
      `}</style>

      {/* Elementos decorativos */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none opacity-30">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#0b56a7] rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#4dc9b1] rounded-full blur-3xl" />
      </div>

      <main className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16">
        {/* Hero Section */}
        <div className="text-center mb-8 sm:mb-12 lg:mb-16">
          <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-black mb-4 sm:mb-6 leading-tight px-4">
            <span className="text-[#0b56a7]">Bienvenido a </span>
            <span className="text-[#D62829] inline-block animate-pulse">Hayu24</span>
          </h1>

          <div className="w-24 sm:w-32 h-1.5 sm:h-2 bg-gradient-to-r from-[#0b56a7] to-[#D62829] rounded-full mx-auto mb-6 sm:mb-8" />

          <p className="text-base sm:text-lg lg:text-xl text-gray-700 max-w-3xl mx-auto leading-relaxed px-4">
            La plataforma más confiable para participar en sorteos y rifas online.
            <br className="hidden sm:block" />
            <span className="font-semibold text-[#0b56a7]">Transparente, segura y completamente verificable.</span>
          </p>
        </div>

        {/* Layout Principal */}
        <div className="grid lg:grid-cols-3 gap-6 sm:gap-8">
          {/* Columna Principal */}
          <div className="lg:col-span-2 space-y-6 sm:space-y-8">
            <WinnersAndActivityCard />

            {/* Features Grid */}
            <div className="grid sm:grid-cols-2 gap-4 sm:gap-6">
              <FeatureCard
                Icon={Shield}
                title="100% Transparente"
                description="Todos los resultados son verificables con tecnología blockchain"
                gradient="bg-gradient-to-br from-[#0b56a7] to-[#003049]"
              />
              <FeatureCard
                Icon={Bell}
                title="Notificaciones Instantáneas"
                description="Recibe alertas en tiempo real sobre tus sorteos favoritos"
                gradient="bg-gradient-to-br from-[#D62829] to-red-700"
              />
              <FeatureCard
                Icon={Sparkles}
                title="Experiencia Premium"
                description="Interfaz moderna, intuitiva y fácil de usar en cualquier dispositivo"
                gradient="bg-gradient-to-br from-[#4dc9b1] to-[#389fae]"
              />
              <FeatureCard
                Icon={Award}
                title="Premios Garantizados"
                description="Todos los sorteos tienen ganadores reales y verificados"
                gradient="bg-gradient-to-br from-[#389fae] to-[#0b56a7]"
              />
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="lg:sticky lg:top-8">
              <InfoSidebar metrics={metrics} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}