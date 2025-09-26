// src/components/admin/ParticipantManager.jsx
import React, { useEffect, useState, useCallback } from "react";
import {
  Trophy, Users, ChevronRight, X, Mail, Phone, Loader2
} from "lucide-react";
import { roulettesAPI, participantsAPI } from "../../config/api";

const ParticipantManager = () => {
  const [roulettes, setRoulettes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);
  const [activeRoulette, setActiveRoulette] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [error, setError] = useState("");

  /* ---------- helpers de premios (solo para ordenar, no para mostrar) ---------- */
  const normalizePrize = (p) => {
    if (!p) return null;
    const image =
      p.image_url || p.image || p.picture || (typeof p === "object" && p.media_url) || null;
    return {
      id: p.id ?? p.prize_id ?? p.pk ?? null,
      name: p.name ?? p.title ?? "Premio",
      description: p.description ?? p.desc ?? "",
      image,
      value: p.value ?? p.price ?? 0,
    };
  };

  const toMapById = (arr = []) => {
    const m = new Map();
    arr.forEach((raw) => {
      const n = normalizePrize(raw);
      if (n?.id != null) m.set(Number(n.id), n);
    });
    return m;
  };

  const resolvePrizeForParticipant = (p, map) => {
    if (p.prize && typeof p.prize === "object") return normalizePrize(p.prize);
    if (p.prize_info && typeof p.prize_info === "object") return normalizePrize(p.prize_info);

    const ids = [p.prize_id, p.winner_prize_id, p.prize, p.winner_prize]
      .map((x) => (typeof x === "string" || typeof x === "number" ? Number(x) : null));
    const pid = ids.find((x) => Number.isFinite(x));
    if (pid != null && map?.has(pid)) return map.get(pid);

    if (typeof p.prize === "string") {
      return { id: null, name: p.prize, description: p.prize_description ?? "", image: null, value: 0 };
    }
    return null;
  };

  /* ---------- helper para extraer email/phone ---------- */
  const extractContactInfo = (participant) => {
    const email = participant.email || null;
    const phone = participant.phone || null;
    return { email, phone };
  };

  /* ---------- carga de ruletas ---------- */
  const loadRoulettes = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const r = await roulettesAPI.getRoulettes({ page_size: 50 });
      const items = r?.results || r?.data?.results || [];
      setRoulettes(items);
    } catch (e) {
      setError(e?.message || "No se pudieron cargar las ruletas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRoulettes();
  }, [loadRoulettes]);

  /* ---------- abrir ruleta con premios (solo para ordenar) ---------- */
  const openRoulette = async (roulette) => {
    try {
      setError("");
      setActiveRoulette(roulette);
      setPanelOpen(true);
      setParticipants([]);

      // 1) Obtener premios para poder ordenar por "valor"
      let prizeMapLocal = new Map();
      let allPrizes = [];
      try {
        const pr = await roulettesAPI.listPrizes(roulette.id);
        const list = pr?.results || pr || [];
        allPrizes = list.map((prize) => ({
          ...prize,
          image: prize.image_url || prize.image || prize.picture || prize.media_url || null,
          value: prize.value || prize.price || 0,
        }));
        allPrizes.sort((a, b) => (b.value || 0) - (a.value || 0));
        prizeMapLocal = toMapById(allPrizes);
      } catch (_e) {
        prizeMapLocal = new Map();
      }

      // 2) participantes (con datos de contacto incluidos)
      const res = await participantsAPI.getRouletteParticipants(roulette.id);
      const list = res?.participants || res?.data?.participants || res?.results || [];

      // 3) normalizar con premio resuelto (NO se muestra, solo orden) y contacto extraído
      const normalized = list.map((p) => {
        const contactInfo = extractContactInfo(p);
        const resolvedPrize = resolvePrizeForParticipant(p, prizeMapLocal);
        return {
          ...p,
          __prize: resolvedPrize,
          __email: contactInfo.email,
          __phone: contactInfo.phone,
        };
      });

      // 4) Ordenar ganadores por valor del premio (mayor a menor) — solo afecta posiciones
      const sortedParticipants = normalized.sort((a, b) => {
        if (a.is_winner && b.is_winner) {
          const aValue = a.__prize?.value || 0;
          const bValue = b.__prize?.value || 0;
          return bValue - aValue;
        }
        if (a.is_winner && !b.is_winner) return -1;
        if (!a.is_winner && b.is_winner) return 1;
        return a.participant_number - b.participant_number;
      });

      setParticipants(sortedParticipants);
    } catch (e) {
      setError(e?.message || "No se pudo abrir la ruleta.");
    }
  };

  const closePanel = () => {
    setPanelOpen(false);
    setActiveRoulette(null);
    setParticipants([]);
  };

  /* ---------- estado derivado ---------- */
  const winners = participants.filter((p) => p.is_winner);
  const others = participants.filter((p) => !p.is_winner);

  /* ---------- UI ---------- */
  return (
    <div className="p-4">
      <header className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">Ruletas</h2>
        <p className="text-sm text-gray-600">
          Haz clic en una ruleta para ver ganadores y participantes.
        </p>
      </header>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-gray-600">
          <Loader2 className="h-5 w-5 animate-spin" />
          Cargando...
        </div>
      ) : roulettes.length === 0 ? (
        <div className="text-gray-600">No hay ruletas.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {roulettes.map((r) => (
            <button
              key={r.id}
              onClick={() => openRoulette(r)}
              className="group text-left rounded-xl border border-gray-200 bg-white p-4 hover:shadow-md transition"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 truncate">{r.name}</h3>
                <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-gray-600" />
              </div>
              <div className="mt-2 flex items-center gap-3 text-sm text-gray-600">
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${
                    r.status === "active"
                      ? "bg-green-100 text-green-800"
                      : r.status === "completed"
                      ? "bg-gray-100 text-gray-800"
                      : "bg-red-100 text-red-800"
                  }`}
                >
                  {r.status === "active"
                    ? "Activa"
                    : r.status === "completed"
                    ? "Completada"
                    : "Cancelada"}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Trophy className="h-4 w-4 text-yellow-500" /> Ganadores
                </span>
                <span className="inline-flex items-center gap-1">
                  <Users className="h-4 w-4 text-blue-500" /> Participantes
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Panel lateral */}
      {panelOpen && activeRoulette && (
        <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/30">
          <div className="h-full w-full max-w-xl bg-white shadow-xl">
            {/* Header panel */}
            <div className="flex items-center justify-between border-b p-4">
              <div>
                <h4 className="font-bold text-gray-900">{activeRoulette.name}</h4>
                <p className="text-sm text-gray-600">Ganadores y participantes</p>
              </div>
              <button
                onClick={closePanel}
                className="rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto p-4 space-y-6 h-[calc(100%-64px)]">
              {/* GANADORES (con posiciones/medallas; SIN mostrar premio) */}
              <section>
                <div className="mb-3 flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-yellow-500" />
                  <h5 className="text-sm font-semibold text-gray-900">
                    Ganadores ({winners.length})
                  </h5>
                  <span className="text-xs text-gray-500">
                    (Ordenados por valor del premio)
                  </span>
                </div>

                {winners.length === 0 ? (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
                    No hay ganadores registrados.
                  </div>
                ) : (
                  <ul className="space-y-4">
                    {winners.map((w, index) => {
                      const email = w.__email || w.email || "Sin correo";
                      const phone = w.__phone || w.phone || "Sin celular";

                      const getMedalInfo = (position) => {
                        switch (position) {
                          case 0: return { color: "text-yellow-500", bg: "bg-yellow-50", icon: "🥇", text: "1er Lugar" };
                          case 1: return { color: "text-gray-400", bg: "bg-gray-50", icon: "🥈", text: "2do Lugar" };
                          case 2: return { color: "text-orange-500", bg: "bg-orange-50", icon: "🥉", text: "3er Lugar" };
                          default: return { color: "text-blue-500", bg: "bg-blue-50", icon: "🏆", text: `${position + 1}° Lugar` };
                        }
                      };

                      const medal = getMedalInfo(index);

                      return (
                        <li
                          key={w.id}
                          className={`rounded-xl border-2 p-4 ${
                            index === 0
                              ? "border-yellow-300 bg-gradient-to-br from-yellow-50 to-amber-50"
                              : "border-gray-200 bg-white"
                          } shadow-sm hover:shadow-md transition-all duration-200`}
                        >
                          {/* Header con posición y nombre */}
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className={`rounded-full px-3 py-1 ${medal.bg} ${medal.color} font-bold text-sm flex items-center gap-1`}>
                                <span>{medal.icon}</span>
                                <span>{medal.text}</span>
                              </div>
                              <div>
                                <p className="font-bold text-gray-900 text-lg">
                                  {w.name || "Sin nombre"}
                                </p>
                                <p className="text-xs text-gray-500">
                                  Participante #{w.participant_number}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Datos de contacto */}
                          <div className="space-y-2">
                            <h6 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1">
                              <Phone className="h-4 w-4" />
                              Información de contacto
                            </h6>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div
                                className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                                  email === "Sin correo"
                                    ? "border-orange-200 bg-orange-50"
                                    : "border-green-200 bg-green-50 text-green-800"
                                }`}
                              >
                                <Mail className="h-4 w-4 text-gray-400" />
                                {email === "Sin correo" ? (
                                  <span className="text-orange-700 font-medium">
                                    ⚠️ Falta email del ganador
                                  </span>
                                ) : (
                                  <span className="truncate font-medium">{email}</span>
                                )}
                              </div>

                              <div
                                className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                                  phone === "Sin celular"
                                    ? "border-orange-200 bg-orange-50"
                                    : "border-green-200 bg-green-50 text-green-800"
                                }`}
                              >
                                <Phone className="h-4 w-4 text-gray-400" />
                                {phone === "Sin celular" ? (
                                  <span className="text-orange-700 font-medium">
                                    ⚠️ Falta teléfono
                                  </span>
                                ) : (
                                  <span className="truncate font-medium">{phone}</span>
                                )}
                              </div>
                            </div>

                            {(email === "Sin correo" || phone === "Sin celular") && (
                              <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded-md">
                                <p className="text-xs text-blue-700 flex items-center gap-1">
                                  <span>💡</span>
                                  <strong>Importante:</strong> Este ganador debe proporcionar sus datos de contacto para recibir su premio.
                                </p>
                              </div>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              {/* PARTICIPANTES */}
              <section>
                <div className="mb-3 flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-500" />
                  <h5 className="text-sm font-semibold text-gray-900">
                    Participantes ({participants.length})
                  </h5>
                </div>

                {participants.length === 0 ? (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
                    No hay participantes.
                  </div>
                ) : (
                  <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
                    {others.map((p) => (
                      <li key={p.id} className="p-3">
                        <p className="text-sm font-medium text-gray-900">
                          {p.name || "Sin nombre"}
                        </p>
                      </li>
                    ))}
                    {winners.map((p) => (
                      <li key={`w-${p.id}`} className="flex items-center justify-between p-3 bg-yellow-50/40">
                        <p className="text-sm font-medium text-gray-900">
                          {p.name || "Sin nombre"}
                        </p>
                        <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-800">
                          Ganador
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ParticipantManager;
