// src/components/PrizePanel.jsx
import React, { useState } from "react";
import {
  X, Gift, Plus, Edit, Trash2, Save, Package,
  Image as ImageIcon, Trophy, Medal, Award, Star, Crown
} from "lucide-react";

/**
 * PrizePanel - Panel lateral para gestión de premios (SIN probabilidad)
 * Props:
 * - isOpen: boolean
 * - onClose: () => void
 * - prizeContext: { rouletteId, data, rouletteName }
 * - prizeLoading: boolean
 * - onAddPrize: (payload) => Promise<void>   // { name, description, stock, display_order, image, is_active }
 * - onUpdatePrize: (prizeId, payload) => Promise<void>
 * - onDeletePrize: (prizeId) => Promise<void>
 */
const PrizePanel = ({
  isOpen,
  onClose,
  prizeContext,
  prizeLoading,
  onAddPrize,
  onUpdatePrize,
  onDeletePrize
}) => {
  if (!isOpen) return null;

  // Orden de render
  const sortedPrizes = (prizeContext?.data || []).slice().sort((a, b) => {
    const pa = a.display_order ?? a.position ?? null;
    const pb = b.display_order ?? b.position ?? null;
    if (pa != null && pb != null) return pa - pb;
    if (pa != null && pb == null) return -1;
    if (pa == null && pb != null) return 1;
    return (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" });
  });

  const totalStock = (prizeContext?.data || []).reduce(
    (sum, p) => sum + (Number(p.stock) || 0),
    0
  );

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center p-4">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-gradient-to-br from-blue-900/20 via-purple-900/20 to-pink-900/20 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel (AHORA FLEX-COL + ALTURA FIJA) */}
      <div className="relative w-full max-w-5xl h-[90vh] max-h-[92vh] rounded-3xl overflow-hidden shadow-2xl ring-1 ring-black/10 flex flex-col">
        {/* Header fijo */}
        <div className="relative bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-500 px-8 pt-8 pb-6 shrink-0">
          <div
            className="absolute inset-0 pointer-events-none opacity-20"
            style={{ backgroundImage: "radial-gradient(circle at 20% 20%, white, transparent 35%)" }}
          />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-4 bg-white/20 rounded-2xl backdrop-blur-md shadow-lg border border-white/30">
                <Gift className="h-8 w-8 text-white drop-shadow-sm" />
              </div>
              <div>
                <h2 className="text-3xl font-bold text-white drop-shadow-sm">Gestión de Premios</h2>
                <p className="text-blue-100 text-base mt-2 font-medium">
                  {prizeContext?.rouletteName || `Ruleta #${prizeContext?.rouletteId}`}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="group relative p-3 text-white hover:bg-white/10 active:bg-white/20 rounded-2xl border border-white/20 transition-all duration-300 ease-out hover:scale-105"
            >
              <X className="h-7 w-7 transition-transform group-hover:rotate-90 duration-300" />
              <div className="absolute inset-0 bg-white/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </button>
          </div>
        </div>

        {/* Contenido SCROLLABLE */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-8 py-8 bg-gradient-to-br from-gray-50 to-white">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-white rounded-2xl p-5 shadow-lg border border-blue-100 hover:shadow-xl transition-all duration-300">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-blue-100 rounded-xl">
                  <Award className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Premios</p>
                  <p className="text-2xl font-bold text-gray-900">{(prizeContext?.data || []).length}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-lg border border-emerald-100 hover:shadow-xl transition-all duration-300">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-emerald-100 rounded-xl">
                  <Package className="h-6 w-6 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Stock total</p>
                  <p className="text-2xl font-bold text-gray-900">{totalStock}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Formulario crear */}
          <div className="mb-8">
            <PrizeForm onSubmit={onAddPrize} loading={prizeLoading} />
          </div>

          {/* Lista de premios */}
          <div>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-gradient-to-r from-blue-500 to-teal-500 rounded-xl">
                  <Trophy className="h-5 w-5 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900">Premios configurados</h3>
              </div>
            </div>

            {sortedPrizes.length === 0 ? (
              <div className="text-center py-16 bg-white/70 rounded-3xl border-2 border-dashed border-blue-200/60">
                <div className="flex items-center justify-center">
                  <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl">
                    <Gift className="h-10 w-10" />
                  </div>
                </div>
                <p className="text-gray-700 text-xl font-semibold mb-3">No hay premios configurados</p>
                <p className="text-gray-500 text-base max-w-md mx-auto leading-relaxed">
                  Agrega tu primer premio usando el formulario de arriba para comenzar con tu ruleta de premios
                </p>
              </div>
            ) : (
              <div className="grid gap-6">
                {sortedPrizes.map((prize, index) => (
                  <PrizeCard
                    key={prize.id ?? `${index}-${prize.name}`}
                    prize={prize}
                    position={index + 1}
                    onUpdate={(payload) => onUpdatePrize(prize.id, payload)}
                    onDelete={() => onDeletePrize(prize.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Tips */}
          <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 border-2 border-blue-200/50 rounded-3xl p-8 mt-8 shadow-lg">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-3 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-2xl shadow-lg">
                <Star className="h-6 w-6 text-white" />
              </div>
              <h4 className="font-bold text-xl text-blue-900">Consejos para configurar premios</h4>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl p-6 border border-blue-100">
                <p className="text-blue-900 font-semibold">🧭 Orden de premios</p>
                <p className="text-blue-800/80 mt-1">Usa <strong>“Orden”</strong> para indicar la prioridad visual (1°, 2°, 3°…).</p>
              </div>
              <div className="bg-white rounded-2xl p-6 border border-purple-100">
                <p className="text-purple-900 font-semibold">🖼️ Imágenes</p>
                <p className="text-purple-800/80 mt-1">Sube imágenes cuadradas para mejores resultados en la UI.</p>
              </div>
              <div className="bg-white rounded-2xl p-6 border border-rose-100">
                <p className="text-rose-900 font-semibold">📦 Stock</p>
                <p className="text-rose-800/80 mt-1">Un stock 0 marca el premio como agotado; si no manejas stock, déjalo en 1.</p>
              </div>
              <div className="bg-white rounded-2xl p-6 border border-emerald-100">
                <p className="text-emerald-900 font-semibold">✅ Activación</p>
                <p className="text-emerald-800/80 mt-1">Activa o desactiva premios sin borrarlos para controlar su aparición.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* =========================
 * Formulario de creación
 * =======================*/
const PrizeForm = ({ onSubmit, loading }) => {
  const [form, setForm] = useState({
    name: "",
    description: "",
    stock: 1,
    position: "",
    image: null,
    is_active: true,
  });
  const [imagePreview, setImagePreview] = useState(null);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0] || null;
    if (file) {
      setForm((prev) => ({ ...prev, image: file }));
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result);
      reader.readAsDataURL(file);
    } else {
      setForm((prev) => ({ ...prev, image: null }));
      setImagePreview(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      alert("El nombre del premio es obligatorio");
      return;
    }
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description?.trim() || "",
        stock: Number(form.stock) || 0,
        display_order: form.position ? Number(form.position) : null,
        image: form.image || null,
        is_active: !!form.is_active,
      };
      await onSubmit(payload);
      setForm({ name: "", description: "", stock: 1, position: "", image: null, is_active: true });
      setImagePreview(null);
    } catch (error) {
      console.error("Error al crear premio:", error);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white/80 border-2 border-blue-100 rounded-3xl p-6 shadow-lg space-y-6">
      <div className="flex items-center space-x-3 mb-2">
        <div className="p-2 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500">
          <Plus className="h-5 w-5 text-white" />
        </div>
        <h4 className="text-xl font-bold text-gray-900">Agregar premio</h4>
      </div>

      {/* Nombre */}
      <div className="group">
        <label className="block text-sm font-bold text-gray-700 mb-3">Nombre del premio</label>
        <div className="relative">
          <Gift className="absolute left-4 top-4 h-5 w-5 text-blue-500" />
          <input
            type="text"
            required
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            className="w-full pl-12 pr-5 py-4 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-300 text-gray-900 font-semibold placeholder-gray-400 group-hover:border-blue-300"
            placeholder="Ej. Tarjeta de regalo"
          />
        </div>
      </div>

      {/* Descripción (scroll propio + resize) */}
      <div className="group">
        <label className="block text-sm font-bold text-gray-700 mb-3">Descripción (opcional)</label>
        <textarea
          value={form.description}
          onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
          rows={4}
          className="w-full px-5 py-4 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-300 text-gray-900 placeholder-gray-400 group-hover:border-blue-300 resize-y overflow-auto max-h-56"
          placeholder="Describe los detalles del premio..."
        />
      </div>

      {/* Stock y Orden */}
      <div className="grid grid-cols-2 gap-6">
        <div className="group">
          <label className="block text-sm font-bold text-gray-700 mb-3">Stock disponible</label>
          <div className="relative">
            <Package className="absolute left-4 top-4 h-5 w-5 text-blue-500" />
            <input
              type="number"
              min="0"
              required
              value={form.stock}
              onChange={(e) => setForm((prev) => ({ ...prev, stock: Number(e.target.value) }))}
              className="w-full pl-12 pr-5 py-4 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-300 text-gray-900 font-bold group-hover:border-blue-300"
            />
          </div>
        </div>

        <div className="group">
          <label className="block text-sm font-bold text-gray-700 mb-3">Orden (posición)</label>
          <div className="relative">
            <Medal className="absolute left-4 top-4 h-5 w-5 text-blue-500" />
            <input
              type="number"
              min="0"
              max="9999"
              value={form.position}
              onChange={(e) => setForm((prev) => ({ ...prev, position: e.target.value }))}
              className="w-full pl-12 pr-5 py-4 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-300 text-gray-900 font-bold group-hover:border-blue-300"
              placeholder="Ej. 1 (primer premio)"
            />
          </div>
        </div>
      </div>

      {/* Imagen */}
      <div className="group">
        <label className="block text-sm font-bold text-gray-700 mb-3">Imagen del premio (opcional)</label>
        <div className="flex items-start space-x-6">
          <div className="flex-1">
            <div className="relative">
              <ImageIcon className="absolute left-4 top-4 h-5 w-5 text-blue-500" />
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="w-full pl-12 pr-5 py-4 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-300 file:px-4 file:py-2 file:mr-4 file:rounded-xl file:border-0 file:cursor-pointer file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 group-hover:border-blue-300"
              />
            </div>
          </div>
          {imagePreview && (
            <div className="w-20 h-20 border-2 border-blue-200 rounded-2xl overflow-hidden shadow-lg">
              <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
            </div>
          )}
        </div>
      </div>

      {/* Activo */}
      <div className="flex items-center justify-between pt-2">
        <label className="inline-flex items-center space-x-3">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))}
            className="h-5 w-5 rounded-md border-2 border-blue-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm font-semibold text-gray-700">Activo</span>
        </label>

        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center px-6 py-3 text-sm font-bold rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg hover:shadow-xl disabled:opacity-60"
        >
          <Plus className="h-4 w-4 mr-2" />
          {loading ? "Guardando..." : "Agregar premio"}
        </button>
      </div>
    </form>
  );
};

/* ======================
 * Tarjeta de premio
 * =====================*/
const PrizeCard = ({ prize, position, onUpdate, onDelete }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: prize.name || "",
    description: prize.description || "",
    stock: Number(prize.stock) || 0,
    position: prize.display_order ?? prize.position ?? "",
    image: null,
    is_active: prize.is_active !== false,
  });

  const initialPos = prize.display_order ?? prize.position ?? null;

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        name: editForm.name?.trim() || "",
        description: editForm.description?.trim() || "",
        stock: Number(editForm.stock) || 0,
        display_order:
          editForm.position != null && editForm.position !== ""
            ? Number(editForm.position)
            : null,
        image: editForm.image || null,
        is_active: !!editForm.is_active,
      };
      await onUpdate(payload);
      setIsEditing(false);
    } catch (error) {
      console.error("Error al actualizar premio:", error);
    }
  };

  const handleDelete = () => {
    if (window.confirm(`¿Eliminar el premio "${prize.name}"?`)) {
      onDelete();
    }
  };

  const getPrizeImage = (p) => p?.image_url || p?.image || null;

  // Indicador de posición
  const getPositionIndicator = () => {
    const pos = initialPos ?? position;
    if (pos == null) return null;
    let icon = Medal;
    let color = "bg-gradient-to-r from-amber-500 to-yellow-500 text-white";
    let glow = "shadow-[0_0_0_3px_rgba(245,158,11,0.25)]";
    let label = `${pos}°`;

    if (pos === 1) {
      icon = Crown;
      color = "bg-gradient-to-r from-amber-500 via-yellow-500 to-orange-500 text-white";
      glow = "shadow-[0_0_0_3px_rgba(245,158,11,0.25)]";
      label = "1°";
    } else if (pos === 2) {
      icon = Medal;
      color = "bg-gradient-to-r from-slate-400 to-slate-600 text-white";
      glow = "shadow-[0_0_0_3px_rgba(148,163,184,0.25)]";
      label = "2°";
    } else if (pos === 3) {
      icon = Medal;
      color = "bg-gradient-to-r from-orange-500 to-orange-600 text-white";
      glow = "shadow-[0_0_0_3px_rgba(234,88,12,0.25)]";
      label = "3°";
    }
    return { icon, color, glow, label };
  };

  const positionInfo = getPositionIndicator();
  const PositionIcon = positionInfo?.icon || Medal;
  const img = getPrizeImage(prize);

  return (
    <div className="relative bg-white rounded-3xl border-2 border-gray-100 shadow-sm hover:shadow-lg transition-all duration-300 p-6">
      {positionInfo && (
        <div className={`absolute -top-3 -left-3 inline-flex items-center space-x-1 text-xs font-black px-2.5 py-1 rounded-xl border-2 shadow-lg ${positionInfo.color} ${positionInfo.glow}`}>
          <PositionIcon className="h-4 w-4" />
          <span>{positionInfo.label}</span>
        </div>
      )}

      {!isEditing ? (
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-4 mb-4">
              {img && (
                <div className="relative">
                  <img
                    src={img}
                    alt={prize.name}
                    className="w-16 h-16 object-cover rounded-2xl border-2 border-purple-200 shadow-lg"
                  />
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-t from-black/20 to-transparent" />
                </div>
              )}
              <div className="flex-1">
                <h4 className="font-bold text-xl text-gray-900 mb-2">{prize.name}</h4>
                {prize.description && (
                  <p className="text-gray-600 text-base leading-relaxed">{prize.description}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <span className="inline-flex items-center space-x-1 text-xs font-semibold text-purple-700 bg-purple-100 border border-purple-200 rounded-xl px-2.5 py-1">
                <Package className="h-3.5 w-3.5" />
                <span>{Number(prize.stock) || 0}</span>
              </span>
              {prize.is_active === false && (
                <span className="inline-flex items-center space-x-1 text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-200 rounded-xl px-2.5 py-1">
                  Inactivo
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col space-y-2 ml-6">
            <button
              onClick={() => setIsEditing(true)}
              className="group p-3 text-gray-500 hover:text-blue-600 bg-blue-50 rounded-2xl transition-all duration-300 hover:shadow-lg"
              title="Editar premio"
            >
              <Edit className="h-5 w-5 group-hover:scale-110 transition-transform duration-200" />
            </button>
            <button
              onClick={handleDelete}
              className="group p-3 text-gray-500 hover:text-red-600 bg-red-50 rounded-2xl transition-all duration-300 hover:shadow-lg"
              title="Eliminar premio"
            >
              <Trash2 className="h-5 w-5 group-hover:scale-110 transition-transform duration-200" />
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleUpdate} className="space-y-6">
          <div>
            <input
              type="text"
              value={editForm.name}
              onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-semibold text-gray-900"
              placeholder="Nombre del premio"
            />
          </div>

          <div>
            <textarea
              rows={3}
              value={editForm.description}
              onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-gray-800 resize-y overflow-auto max-h-56"
              placeholder="Descripción del premio"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Stock</label>
              <input
                type="number"
                min="0"
                value={editForm.stock}
                onChange={(e) => setEditForm((prev) => ({ ...prev, stock: Number(e.target.value) }))}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-bold text-center"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Orden</label>
              <input
                type="number"
                min="0"
                max="9999"
                value={editForm.position ?? ""}
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    position: e.target.value === "" ? null : Number(e.target.value),
                  }))
                }
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-purple-500/20 focus:border-purple-500 outline-none font-bold text-center"
                placeholder="Orden"
              />
            </div>
          </div>

          <div>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setEditForm((prev) => ({ ...prev, image: e.target.files?.[0] || null }))}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none file:px-4 file:py-2 file:mr-4 file:rounded-xl file:border-0 file:cursor-pointer file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>

          <div className="flex items-center justify-end space-x-4 pt-4">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="px-6 py-3 text-sm font-bold text-gray-700 bg-white border-2 border-gray-200 rounded-2xl hover:bg-gray-50 focus:ring-4 focus:ring-gray-300/50 transition-all duration-200"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="inline-flex items-center px-6 py-3 text-sm font-bold rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white focus:ring-4 focus:ring-blue-500/50 shadow-lg hover:shadow-xl transition-all duration-200"
            >
              <Save className="h-4 w-4 mr-2" />
              Guardar
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default PrizePanel;
