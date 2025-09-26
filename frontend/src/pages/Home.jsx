// src/pages/Home.jsx — Home público SIN login/registro (colores sólidos + animaciones)
import React from "react";
import { Shield, Bell, Sparkles, Award, Trophy, Activity, Users, Gift, Clock, Star } from "lucide-react";
import { publicAPI } from "../config/publicApi";
import { useAuth } from "../contexts/AuthContext";
import RouletteCard from "../components/public/RouletteCard";

/* ---------- Paleta centralizada (sólidos) ---------- */
const COLORS = {
  brandDark: "#003049",
  brandRed:  "#D62829",
  brandMint: "#4dc9b1",
  brandTeal: "#389fae",
  brandBlue: "#0b56a7",
  text:      "#0f172a",
  muted:     "#475569",
  card:      "rgba(255,255,255,0.90)",
  border:    "rgba(226,232,240,0.7)",
};

/* ---------- UI helpers ---------- */
const FeatureCard = ({ color, Icon, title, sub }) => (
  <div
    className="flex items-center gap-4 p-5 rounded-2xl border transition-all duration-300 group will-change-transform"
    style={{ backgroundColor: COLORS.card, borderColor: COLORS.border, transform: "translateZ(0)" }}
    onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-4px)")}
    onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
  >
    <div
      className="rounded-xl p-3 shrink-0 shadow-sm transition-shadow duration-300"
      style={{ backgroundColor: color, boxShadow: "0 6px 18px rgba(0,0,0,0.08)" }}
    >
      <Icon className="h-6 w-6 text-white" />
    </div>
    <div className="min-w-0">
      <h3 className="font-bold text-lg" style={{ color: COLORS.text }}>{title}</h3>
      <p className="text-sm leading-relaxed" style={{ color: COLORS.muted }}>{sub}</p>
    </div>
  </div>
);

const Pill = ({ label, value, color = COLORS.brandDark }) => (
  <div
    className="rounded-2xl border-2 px-6 py-5 transition-all duration-200"
    style={{
      borderColor: "rgba(255,255,255,0.8)",
      backgroundColor: "rgba(255,255,255,0.95)",
      boxShadow: "0 10px 24px rgba(2, 8, 23, 0.05)",
    }}
  >
    <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: COLORS.muted }}>{label}</p>
    <p className="text-3xl font-black" style={{ color }}>{value}</p>
  </div>
);

const SkeletonCard = () => (
  <div className="rounded-2xl border p-5 animate-pulse" style={{ backgroundColor: COLORS.card, borderColor: COLORS.border }}>
    <div className="h-36 bg-gray-200 rounded-xl mb-4"></div>
    <div className="h-5 bg-gray-200 rounded mb-3"></div>
    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
    <div className="h-4 bg-gray-200 rounded w-1/2"></div>
  </div>
);

/* ---------- Card: Actividad & Ganadores ---------- */
function WinnersAndActivityCard() {
  const { token } = useAuth();
  const [tab, setTab] = React.useState("actividad");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

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

        if (metricsResult.status === "fulfilled") {
          const m = metricsResult.value;
          setMetrics({
            roulettes_total:   m.roulettes_total   || 0,
            active_roulettes:  m.active_roulettes  || 0,
            winners_total:     m.winners_total     || 0,
            participants_total:m.participants_total|| 0,
          });
          setServerTime(m.server_time);
        }

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

  const handleRouletteClick = (roulette) => {
    console.log("Clicked roulette:", roulette);
  };

  return (
    <div
      className="rounded-3xl border-2 p-8 shadow-xl hover:shadow-2xl transition-all duration-300"
      style={{ borderColor: COLORS.border, backgroundColor: "rgba(255,255,255,0.92)" }}
    >
      {/* Header */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="rounded-2xl p-3 text-white shadow-lg" style={{ backgroundColor: COLORS.brandDark }}>
            <Trophy size={24} />
          </div>
          <h3 className="text-2xl font-black" style={{ color: COLORS.text }}>Actividad & Ganadores</h3>
        </div>
        <span
          className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold text-white shadow-md"
          style={{ backgroundColor: COLORS.brandRed }}
        >
          <Activity size={16} />
          En vivo
        </span>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        {loading ? (
          <>
            <div className="rounded-2xl border px-6 py-5 animate-pulse" style={{ backgroundColor: COLORS.card, borderColor: COLORS.border }}>
              <div className="h-4 bg-gray-200 rounded mb-3"></div>
              <div className="h-8 bg-gray-200 rounded"></div>
            </div>
            <div className="rounded-2xl border px-6 py-5 animate-pulse" style={{ backgroundColor: COLORS.card, borderColor: COLORS.border }}>
              <div className="h-4 bg-gray-200 rounded mb-3"></div>
              <div className="h-8 bg-gray-200 rounded"></div>
            </div>
          </>
        ) : (
          <>
            <Pill label="Ruletas Activas" value={metrics.active_roulettes || 0} color={COLORS.brandDark} />
            <Pill label="Total Ganadores" value={metrics.winners_total || 0} color={COLORS.brandRed} />
          </>
        )}
      </div>

      {/* Tabs */}
      <div
        className="mb-6 inline-flex rounded-2xl p-1.5 shadow-inner border-2"
        style={{ backgroundColor: "rgba(255,255,255,0.95)", borderColor: COLORS.border }}
      >
        <button
          onClick={() => setTab("actividad")}
          className={`px-6 py-3 rounded-xl text-sm font-bold transition-all duration-200 ${
            tab === "actividad" ? "text-white shadow-lg transform scale-105" : "hover:bg-gray-50"
          }`}
          style={{ backgroundColor: tab === "actividad" ? COLORS.brandDark : "transparent", color: tab === "actividad" ? "#fff" : COLORS.muted }}
        >
          Ruletas Activas ({roulettes.length})
        </button>
        <button
          onClick={() => setTab("ganadores")}
          className={`px-6 py-3 rounded-xl text-sm font-bold transition-all duration-200 ${
            tab === "ganadores" ? "text-white shadow-lg transform scale-105" : "hover:bg-gray-50"
          }`}
          style={{ backgroundColor: tab === "ganadores" ? COLORS.brandDark : "transparent", color: tab === "ganadores" ? "#fff" : COLORS.muted }}
        >
          Ganadores ({winners.length})
        </button>
      </div>

      {/* Error */}
      {error && (
        <div
          className="rounded-2xl border-2 px-6 py-4 text-sm mb-6"
          style={{ borderColor: "rgb(254,202,202)", backgroundColor: "rgba(254,226,226,0.8)", color: "#991b1b" }}
        >
          <div className="font-bold mb-2">Error al cargar datos</div>
          <div className="mb-3">{error}</div>
          <button
            onClick={() => window.location.reload()}
            className="text-xs font-semibold underline hover:no-underline px-3 py-1 rounded-lg"
            style={{ backgroundColor: "rgba(254,202,202,0.5)" }}
          >
            Recargar página
          </button>
        </div>
      )}

      {/* Actividad */}
      {!error && tab === "actividad" && (
        <div>
          {loading ? (
            <div className="grid gap-6">
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : roulettes.length === 0 ? (
            <div
              className="rounded-2xl border-2 px-6 py-12 text-center"
              style={{ borderColor: COLORS.border, backgroundColor: "rgba(248,250,252,0.9)" }}
            >
              <div className="text-6xl mb-4">🎰</div>
              <p className="text-lg font-bold mb-2" style={{ color: COLORS.text }}>¡No hay ruletas activas ahora!</p>
              <p className="text-sm" style={{ color: COLORS.muted }}>Vuelve pronto para participar en nuevos sorteos</p>
              {metrics.roulettes_total > 0 && (
                <p className="text-xs mt-3" style={{ color: "#64748b" }}>
                  Total de ruletas en el sistema: {metrics.roulettes_total}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {roulettes.slice(0, 3).map((roulette) => (
                <div key={roulette.id} className="transform hover:scale-[1.02] transition-all duration-300 hover:shadow-lg">
                  <RouletteCard roulette={roulette} serverTime={serverTime} onClick={handleRouletteClick} />
                </div>
              ))}
              {roulettes.length > 3 && (
                <div className="text-center pt-4">
                  <div className="text-sm font-medium" style={{ color: COLORS.muted }}>
                    ... y {roulettes.length - 3} ruletas más disponibles
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Ganadores */}
      {!error && tab === "ganadores" && (
        <div className="space-y-4">
          {loading ? (
            <>
              {[...Array(3)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-5 bg-gray-200 rounded w-3/4 mb-3"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                </div>
              ))}
            </>
          ) : winners.length === 0 ? (
            <div
              className="rounded-2xl border-2 px-6 py-12 text-center"
              style={{ borderColor: COLORS.border, backgroundColor: "rgba(248,250,252,0.9)" }}
            >
              <div className="text-6xl mb-4">🏆</div>
              <p className="text-lg font-bold mb-2" style={{ color: COLORS.text }}>¡Sé el primero en ganar!</p>
              <p className="text-sm" style={{ color: COLORS.muted }}>Los ganadores recientes aparecerán aquí</p>
              {metrics.winners_total > 0 && (
                <p className="text-xs mt-3" style={{ color: "#64748b" }}>
                  Total histórico de ganadores: {metrics.winners_total}
                </p>
              )}
            </div>
          ) : (
            winners.slice(0, 5).map((winner, idx) => (
              <div
                key={winner.id || `winner-${idx}`}
                className="rounded-2xl border-2 transition-all duration-300 p-6"
                style={{ borderColor: COLORS.border, backgroundColor: "rgba(255,255,255,0.95)", boxShadow: "0 10px 24px rgba(2, 8, 23, 0.05)" }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1 space-y-2">
                    <p className="text-base font-bold truncate" style={{ color: COLORS.text }}>
                      {winner.roulette_name}
                    </p>
                    <div className="flex items-center gap-3 text-sm flex-wrap">
                      <span
                        className="flex items-center gap-2 px-3 py-2 rounded-full font-bold text-white shadow-sm"
                        style={{ backgroundColor: COLORS.brandRed }}
                      >
                        🏆 {winner.winner_name}
                      </span>
                      {winner.participants_count > 0 && (
                        <span
                          className="flex items-center gap-2 px-3 py-1 rounded-full"
                          style={{ backgroundColor: "#f1f5f9", color: COLORS.muted }}
                        >
                          👥 {winner.participants_count} participantes
                        </span>
                      )}
                    </div>
                    {winner.created_at && (
                      <p className="text-sm font-medium" style={{ color: "#64748b" }}>
                        {new Date(winner.created_at).toLocaleDateString("es-ES", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    )}
                  </div>
                  <div
                    className="shrink-0 text-xs font-bold text-white px-3 py-2 rounded-full shadow-sm"
                    style={{ backgroundColor: COLORS.brandMint }}
                  >
                    Sorteado ✨
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- Sidebar con información ---------- */
function InfoSidebar() {
  return (
    <div className="space-y-8">
      {/* Cómo Funciona */}
      <div
        className="rounded-3xl border-2 p-8 shadow-xl transition-all duration-300"
        style={{ borderColor: COLORS.border, backgroundColor: "rgba(255,255,255,0.92)" }}
      >
        <div className="mb-6 flex items-center gap-4">
          <div className="rounded-2xl p-3 text-white shadow-lg" style={{ backgroundColor: COLORS.brandMint }}>
            <Star size={24} />
          </div>
          <h3 className="text-xl font-black" style={{ color: COLORS.text }}>¿Cómo Funciona?</h3>
        </div>
        <div className="space-y-6">
          {[
            { n: 1, t: "Regístrate", s: "Crea tu cuenta gratuita en segundos" },
            { n: 2, t: "Participa", s: "Únete a las ruletas que más te gusten" },
            { n: 3, t: "¡Gana!",   s: "Sorteos 100% aleatorios y transparentes" },
          ].map(step => (
            <div key={step.n} className="flex items-start gap-4">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-black text-white shadow-md"
                style={{ backgroundColor: COLORS.brandMint }}
              >
                {step.n}
              </div>
              <div>
                <p className="text-base font-bold" style={{ color: COLORS.text }}>{step.t}</p>
                <p className="text-sm leading-relaxed" style={{ color: COLORS.muted }}>{step.s}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Estadísticas */}
      <div
        className="rounded-3xl border-2 p-8 shadow-xl transition-all duration-300"
        style={{ borderColor: COLORS.border, backgroundColor: "rgba(255,255,255,0.92)" }}
      >
        <div className="mb-6 flex items-center gap-4">
          <div className="rounded-2xl p-3 text-white shadow-lg" style={{ backgroundColor: COLORS.brandTeal }}>
            <Users size={24} />
          </div>
          <h3 className="text-xl font-black" style={{ color: COLORS.text }}>Nuestra Comunidad</h3>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between py-2">
            <span className="text-base font-medium" style={{ color: COLORS.muted }}>Usuarios Registrados</span>
            <span className="text-2xl font-black" style={{ color: COLORS.brandTeal }}>15,234+</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-base font-medium" style={{ color: COLORS.muted }}>Sorteos Realizados</span>
            <span className="text-2xl font-black" style={{ color: COLORS.brandTeal }}>2,847</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-base font-medium" style={{ color: COLORS.muted }}>Premios Entregados</span>
            <span className="text-2xl font-black" style={{ color: COLORS.brandTeal }}>$125,430</span>
          </div>
        </div>
      </div>

      {/* Próximas Funcionalidades */}
      <div
        className="rounded-3xl border-2 p-8 shadow-xl transition-all duration-300"
        style={{ borderColor: COLORS.border, backgroundColor: "rgba(255,255,255,0.92)" }}
      >
        <div className="mb-6 flex items-center gap-4">
          <div className="rounded-2xl p-3 text-white shadow-lg" style={{ backgroundColor: COLORS.brandBlue }}>
            <Gift size={24} />
          </div>
          <h3 className="text-xl font-black" style={{ color: COLORS.text }}>Próximamente</h3>
        </div>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Clock size={18} style={{ color: COLORS.brandBlue }} />
            <span className="text-base font-medium" style={{ color: COLORS.text }}>Sorteos automáticos programados</span>
          </div>
          <div className="flex items-center gap-3">
            <Shield size={18} style={{ color: COLORS.brandBlue }} />
            <span className="text-base font-medium" style={{ color: COLORS.text }}>Verificación blockchain</span>
          </div>
          <div className="flex items-center gap-3">
            <Bell size={18} style={{ color: COLORS.brandBlue }} />
            <span className="text-base font-medium" style={{ color: COLORS.text }}>Notificaciones push</span>
          </div>
          <div className="flex items-center gap-3">
            <Trophy size={18} style={{ color: COLORS.brandBlue }} />
            <span className="text-base font-medium" style={{ color: COLORS.text }}>Sistema de recompensas</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ========================= HOME COMPONENT ========================= */
export default function Home() {
  return (
    <div
      className="min-h-screen"
      style={{
        background: "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 50%, #f1f5f9 100%)"
      }}
    >
      {/* Fondo decorativo */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[10vh] left-[8vw] w-[25vmin] h-[25vmin] rounded-full blur-3xl opacity-15" style={{ backgroundColor: COLORS.brandDark }} />
        <div className="absolute top-[18vh] right-[10vw] w-[30vmin] h-[30vmin] rounded-full blur-3xl opacity-15" style={{ backgroundColor: COLORS.brandRed }} />
        <div className="absolute bottom-[10vh] left-1/3 w-[28vmin] h-[28vmin] rounded-full blur-3xl opacity-15" style={{ backgroundColor: COLORS.brandMint }} />
        <div className="absolute bottom-[18vh] right-[20vw] w-[22vmin] h-[22vmin] rounded-full blur-3xl opacity-15" style={{ backgroundColor: COLORS.brandTeal }} />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[35vmin] h-[35vmin] rounded-full blur-3xl opacity-10" style={{ backgroundColor: COLORS.brandBlue }} />
      </div>

      <main className="relative z-10 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        {/* Keyframes globales para este archivo */}
        <style>{`
          @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(10px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          @keyframes popIn {
            0%   { transform: scale(0.92); opacity: .0; }
            60%  { transform: scale(1.06); opacity: .9; }
            100% { transform: scale(1);    opacity: 1;  }
          }
          @keyframes growLine {
            from { width: 0; opacity: .0; }
            to   { width: 100%; opacity: 1; }
          }
          @keyframes softPulse {
            0%,100% { text-shadow: 0 4px 18px rgba(0,0,0,.08); }
            50%     { text-shadow: 0 6px 28px rgba(0,0,0,.16); }
          }
        `}</style>

        {/* Header (animado y XL) */}
        <div className="text-center max-w-3xl mx-auto space-y-10">
          <h1
            className="font-extrabold tracking-tight leading-[1.1]"
            style={{
              fontSize: "clamp(2.25rem, 3vw + 2rem, 4.25rem)",
              animation: "fadeInUp .6s ease-out both",
              color: COLORS.text,
            }}
          >
         <span style={{ color: COLORS.brandBlue }}>Bienvenido a</span>
        <span
          style={{
         color: COLORS.brandRed,
          marginLeft: "0.5rem",              // ← separa del “a”
          animation: "popIn .55s .1s ease-out both, softPulse 2.8s 1.2s ease-in-out infinite",
          display: "inline-block",
           }}
          >
       24 Hayu
        </span>

          </h1>

          {/* Subrayado animado con margen extra */}
          <div
            className="mx-auto h-1.5 rounded-full my-8"
            style={{
              background: `linear-gradient(90deg, ${COLORS.brandBlue}, ${COLORS.brandRed})`,
              animation: "growLine .6s .15s ease-out both",
              width: "min(520px, 76%)",
              boxShadow: "0 6px 18px rgba(2,8,23,.06)",
            }}
          />

          {/* Descripción con separación */}
          <p
            className="font-medium leading-relaxed mx-auto"
            style={{
              color: COLORS.muted,
              fontSize: "clamp(1rem, .4vw + 1rem, 1.25rem)",
              maxWidth: "52ch",
              animation: "fadeInUp .6s .12s ease-out both",
            }}
          >
            La plataforma más confiable para participar en sorteos y rifas online.
            <br className="hidden sm:block" />
            Transparente, segura y completamente verificable.
          </p>
        </div>

        {/* Layout con dos columnas */}
        <section className="grid lg:grid-cols-3 gap-10">
          {/* Columna principal (izquierda) - 2/3 del espacio */}
          <div className="lg:col-span-2 space-y-10" id="ruletas">
            <WinnersAndActivityCard />

            {/* Características principales */}
            <div className="grid md:grid-cols-2 gap-6">
              <FeatureCard
                color={COLORS.brandDark}
                Icon={Shield}
                title="🔒 100% Transparente"
                sub="Verifica todos los resultados con tecnología blockchain"
              />
              <FeatureCard
                color={COLORS.brandRed}
                Icon={Bell}
                title="⚡ Notificaciones Instantáneas"
                sub="Recibe alertas en tiempo real sobre tus sorteos"
              />
              <FeatureCard
                color={COLORS.brandMint}
                Icon={Sparkles}
                title="✨ Experiencia Premium"
                sub="Interfaz moderna, fluida y fácil de usar"
              />
              <FeatureCard
                color={COLORS.brandTeal}
                Icon={Award}
                title="🏆 Premios Garantizados"
                sub="Todos los sorteos tienen ganadores reales verificados"
              />
            </div>
          </div>

          {/* Sidebar (derecha) - 1/3 del espacio */}
          <div className="lg:col-span-1" id="como-funciona">
            <div className="lg:sticky lg:top-8">
              <InfoSidebar />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
