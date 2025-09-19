// src/components/admin/Gestión de Ruletas/PrizePanel.jsx
import React, { useState, useEffect } from "react";
import {
  X, Gift, Plus, Edit, Trash2, Save, Package, Percent,
  Trophy, Medal, Award, Star, AlertCircle, CheckCircle, Upload, Eye
} from "lucide-react";

/**
 * PrizePanel – Gestión de Premios (alineado a display_order / image_url)
 * Backend devuelve: { id, name, description, image, image_url, stock, probability, display_order, is_active, ... }
 * (ver RoulettePrizeSerializer). 
 */

const PrizePanel = ({
  isOpen,
  onClose,
  prizeContext,     // { rouletteId, rouletteName, data: Prize[] }
  prizeLoading,
  onAddPrize,       // (formData|obj) => Promise
  onUpdatePrize,    // (id, payload) => Promise
  onDeletePrize     // (id) => Promise
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Auto clear messages
  useEffect(() => {
    if (error || success) {
      const t = setTimeout(() => { setError(null); setSuccess(null); }, 3500);
      return () => clearTimeout(t);
    }
  }, [error, success]);

  if (!isOpen) return null;

  const handleAddPrize = async (payload) => {
    setLoading(true); setError(null);
    try {
      await onAddPrize(payload);
      setSuccess("¡Premio agregado exitosamente!");
    } catch (e) {
      setError(e?.message || "Error al agregar el premio");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePrize = async (id, payload) => {
    setLoading(true); setError(null);
    try {
      await onUpdatePrize(id, payload);
      setSuccess("¡Premio actualizado exitosamente!");
    } catch (e) {
      setError(e?.message || "Error al actualizar el premio");
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePrize = async (id, name) => {
    if (!window.confirm(`¿Eliminar "${name}"? Esta acción no se puede deshacer.`)) return;
    setLoading(true); setError(null);
    try {
      await onDeletePrize(id);
      setSuccess("Premio eliminado correctamente");
    } catch (e) {
      setError(e?.message || "Error al eliminar el premio");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                <Gift className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Gestión de Premios</h1>
                <p className="text-purple-100 mt-1">
                  {prizeContext?.rouletteName || `Ruleta #${prizeContext?.rouletteId}`}
                </p>
                <div className="flex items-center space-x-4 mt-2">
                  <span className="px-3 py-1 bg-white/20 rounded-full text-white text-sm font-medium">
                    {prizeContext?.data?.length || 0} premios configurados
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-xl p-3 text-white hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white transition-all"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Messages */}
        {(error || success) && (
          <div className="px-8 py-4">
            {error && (
              <div className="flex items-center space-x-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <p className="text-red-800 font-medium">{error}</p>
              </div>
            )}
            {success && (
              <div className="flex items-center space-x-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <p className="text-green-800 font-medium">{success}</p>
              </div>
            )}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-8 space-y-8">
            <PrizeForm
              onSubmit={handleAddPrize}
              loading={loading || prizeLoading}
              existingPrizes={prizeContext?.data || []}
            />

            {/* Lista */}
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Premios Configurados</h2>
              </div>

              {prizeLoading ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-200 border-t-purple-600"></div>
                  <span className="mt-4 text-gray-600 text-lg">Cargando premios...</span>
                </div>
              ) : (prizeContext?.data || []).length === 0 ? (
                <div className="text-center py-16">
                  <div className="p-6 bg-gradient-to-br from-purple-50 to-blue-50 rounded-2xl w-24 h-24 mx-auto mb-6 flex items-center justify-center">
                    <Gift className="h-12 w-12 text-purple-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">No hay premios configurados</h3>
                  <p className="text-gray-600 text-lg max-w-md mx-auto">
                    Comienza agregando tu primer premio. Define el orden y las probabilidades para una experiencia increíble.
                  </p>
                </div>
              ) : (
                <div className="grid gap-6">
                  {(prizeContext.data || [])
                    .slice()
                    .sort((a, b) => (a.display_order ?? 9999) - (b.display_order ?? 9999))
                    .map((prize) => (
                      <PrizeCard
                        key={prize.id}
                        prize={prize}
                        onUpdate={(payload) => handleUpdatePrize(prize.id, payload)}
                        onDelete={() => handleDeletePrize(prize.id, prize.name)}
                        loading={loading}
                      />
                    ))}
                </div>
              )}
            </div>

            {/* Tips */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6">
              <div className="flex items-start space-x-4">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <AlertCircle className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h4 className="font-bold text-blue-900 text-lg mb-3">Consejos para configurar premios</h4>
                  <ul className="text-blue-800 space-y-2 text-base">
                    <li>• <strong>Orden:</strong> usa <code>display_order</code> (1°, 2°, 3°…) para fijar la prioridad.</li>
                    <li>• <strong>Stock:</strong> con stock 0, el premio queda inactivo.</li>
                    <li>• <strong>Probabilidades:</strong> 0–100% (no necesitan sumar 100 exacto).</li>
                    <li>• <strong>Imágenes:</strong> &lt; 5MB (PNG/JPG/WEBP).</li>
                  </ul>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

/** ---- Form Crear ---- */
const PrizeForm = ({ onSubmit, loading, existingPrizes = [] }) => {
  const [form, setForm] = useState({
    name: "",
    description: "",
    display_order: "",    // <- alineado a backend
    stock: 1,
    probability: 10,
    image: null,
  });
  const [imagePreview, setImagePreview] = useState(null);
  const [formErrors, setFormErrors] = useState({});

  const getAvailableOrders = () => {
    const used = existingPrizes.map(p => p.display_order).filter(v => v !== null && v !== undefined);
    const options = [];
    for (let i = 1; i <= 50; i++) {
      options.push({ value: i, label: `${i}° Premio`, disabled: used.includes(i) });
    }
    return options;
  };

  const validateForm = () => {
    const errors = {};
    if (!form.name.trim()) errors.name = "El nombre del premio es obligatorio";
    if (form.stock < 0) errors.stock = "El stock no puede ser negativo";
    if (form.probability < 0 || form.probability > 100) errors.probability = "La probabilidad debe estar entre 0 y 100";
    if (form.image && form.image.size > 5 * 1024 * 1024) errors.image = "La imagen debe ser menor a 5MB";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) {
      setForm(prev => ({ ...prev, image: null }));
      setImagePreview(null);
      return;
    }
    if (!file.type.startsWith("image/")) {
      setFormErrors(prev => ({ ...prev, image: "Solo se permiten archivos de imagen" }));
      return;
    }
    setForm(prev => ({ ...prev, image: file }));
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);
    if (formErrors.image) {
      setFormErrors(prev => {
        const next = { ...prev };
        delete next.image;
        return next;
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    // Construir payload (si tu onSubmit espera FormData, cámbialo aquí)
    const payload = {
      name: form.name,
      description: form.description,
      stock: form.stock,
      probability: form.probability,
      display_order: form.display_order || 0, // por si lo dejan vacío
      image: form.image,
    };

    await onSubmit(payload);

    // Reset
    setForm({
      name: "",
      description: "",
      display_order: "",
      stock: 1,
      probability: 10,
      image: null,
    });
    setImagePreview(null);
    setFormErrors({});
  };

  const options = getAvailableOrders();

  return (
    <div className="bg-white border-2 border-gray-200 rounded-2xl p-8 shadow-sm">
      <div className="flex items-center space-x-3 mb-6">
        <div className="p-3 bg-purple-100 rounded-xl">
          <Plus className="h-6 w-6 text-purple-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">Agregar Nuevo Premio</h2>
          <p className="text-gray-600">Completa los detalles del premio que quieres agregar</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* nombre + orden */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Nombre del premio <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
              required
              className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none ${
                formErrors.name ? "border-red-300 bg-red-50" : "border-gray-300"
              }`}
              placeholder="Ej. Gift Card $100, Bicicleta…"
            />
            {formErrors.name && <p className="mt-2 text-sm text-red-600">{formErrors.name}</p>}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Orden (display_order)</label>
            <select
              value={form.display_order}
              onChange={(e) => setForm(prev => ({ ...prev, display_order: Number(e.target.value) || "" }))}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
            >
              <option value="">Sin orden específico</option>
              {options.map(opt => (
                <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                  {opt.label} {opt.disabled ? "(ya usado)" : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* descripción */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Descripción</label>
          <textarea
            rows={4}
            value={form.description}
            onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none resize-none"
            placeholder="Detalles del premio…"
          />
        </div>

        {/* stock + prob */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Stock</label>
            <div className="relative">
              <Package className="absolute left-4 top-3.5 h-5 w-5 text-gray-400" />
              <input
                type="number"
                min="0"
                value={form.stock}
                onChange={(e) => setForm(prev => ({ ...prev, stock: Number(e.target.value) || 0 }))}
                className={`w-full pl-12 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none ${
                  formErrors.stock ? "border-red-300 bg-red-50" : "border-gray-300"
                }`}
              />
            </div>
            {formErrors.stock && <p className="mt-2 text-sm text-red-600">{formErrors.stock}</p>}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Probabilidad (%)</label>
            <div className="relative">
              <Percent className="absolute left-4 top-3.5 h-5 w-5 text-gray-400" />
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={form.probability}
                onChange={(e) => setForm(prev => ({ ...prev, probability: Number(e.target.value) || 0 }))}
                className={`w-full pl-12 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none ${
                  formErrors.probability ? "border-red-300 bg-red-50" : "border-gray-300"
                }`}
              />
            </div>
            {formErrors.probability && <p className="mt-2 text-sm text-red-600">{formErrors.probability}</p>}
          </div>
        </div>

        {/* imagen */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Imagen (opcional)</label>
          <div className="flex items-start space-x-6">
            <div className="flex-1">
              <input id="prize-image" type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
              <label
                htmlFor="prize-image"
                className={`w-full flex items-center justify-center px-4 py-6 border-2 border-dashed rounded-xl cursor-pointer transition ${
                  formErrors.image ? "border-red-300 bg-red-50 hover:bg-red-100" : "border-gray-300 hover:border-purple-400 hover:bg-purple-50"
                }`}
              >
                <div className="text-center">
                  <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-600 font-medium">Haz clic para subir una imagen</p>
                  <p className="text-gray-500 text-sm mt-1">PNG/JPG/WEBP hasta 5MB</p>
                </div>
              </label>
              {formErrors.image && <p className="mt-2 text-sm text-red-600">{formErrors.image}</p>}
            </div>

            {imagePreview && (
              <div className="flex flex-col items-center space-y-2">
                <div className="w-24 h-24 border-2 border-gray-300 rounded-xl overflow-hidden">
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                </div>
                <button
                  type="button"
                  onClick={() => { setForm(prev => ({ ...prev, image: null })); setImagePreview(null); }}
                  className="text-sm text-red-600 hover:text-red-800 font-medium"
                >
                  Quitar
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={loading || !form.name.trim()}
            className="w-full inline-flex items-center justify-center px-8 py-4 text-lg font-semibold text-white bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl hover:from-purple-700 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent mr-3"></div>
                Agregando premio…
              </>
            ) : (
              <>
                <Plus className="h-6 w-6 mr-3" />
                Agregar Premio
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

/** ---- Card / Editar ---- */
const PrizeCard = ({ prize, onUpdate, onDelete, loading }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: prize.name || "",
    description: prize.description || "",
    display_order: prize.display_order ?? "",
    stock: prize.stock ?? 1,
    probability: Number(prize.probability ?? 0),
    image: null,
  });
  const [imagePreview, setImagePreview] = useState(prize.image_url || prize.image || null);

  const getOrderBadge = (n) => {
    if (!n && n !== 0) return null;
    const map = {
      1: { label: "1° Premio", icon: Trophy, color: "text-yellow-700 bg-yellow-100" },
      2: { label: "2° Premio", icon: Medal, color: "text-gray-700 bg-gray-100" },
      3: { label: "3° Premio", icon: Award, color: "text-amber-700 bg-amber-100" },
    };
    return map[n] || { label: `${n}° Premio`, icon: Star, color: "text-purple-700 bg-purple-100" };
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setEditForm(prev => ({ ...prev, image: file }));
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    const payload = {
      name: editForm.name,
      description: editForm.description,
      stock: editForm.stock,
      probability: editForm.probability,
      display_order: editForm.display_order || 0,
      image: editForm.image, // opcional
    };
    await onUpdate(payload);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="bg-white border-2 border-blue-200 rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Editando premio</h3>
          <button onClick={() => setIsEditing(false)} className="text-gray-500 hover:text-gray-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleUpdate} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="text"
              value={editForm.name}
              onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Nombre del premio"
            />

            <select
              value={editForm.display_order}
              onChange={(e) => setEditForm(prev => ({ ...prev, display_order: Number(e.target.value) || "" }))}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Sin orden</option>
              {Array.from({ length: 50 }, (_, i) => i + 1).map(n => (
                <option key={n} value={n}>{n}° Premio</option>
              ))}
            </select>
          </div>

          <textarea
            rows={3}
            value={editForm.description}
            onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
            placeholder="Descripción"
          />

          <div className="grid grid-cols-2 gap-4">
            <input
              type="number"
              min="0"
              value={editForm.stock}
              onChange={(e) => setEditForm(prev => ({ ...prev, stock: Number(e.target.value) || 0 }))}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Stock"
            />
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={editForm.probability}
              onChange={(e) => setEditForm(prev => ({ ...prev, probability: Number(e.target.value) || 0 }))}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Probabilidad %"
            />
          </div>

          <div className="flex items-center space-x-4">
            <input type="file" accept="image/*" onChange={handleImageChange}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
            {imagePreview && <img src={imagePreview} alt="Preview" className="w-12 h-12 object-cover rounded-lg" />}
          </div>

          <div className="flex items-center justify-end space-x-3 pt-4 border-t">
            <button type="button" onClick={() => setIsEditing(false)}
              className="px-6 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
              Cancelar
            </button>
            <button type="submit" disabled={loading}
              className="inline-flex items-center px-6 py-3 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
              <Save className="h-4 w-4 mr-2" /> {loading ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    );
  }

  const badge = getOrderBadge(prize.display_order);
  const Icon = badge?.icon;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-start space-x-4 mb-4">
            {(prize.image_url || prize.image) && (
              <img
                src={prize.image_url || prize.image}
                alt={prize.name}
                className="w-16 h-16 object-cover rounded-xl border border-gray-200"
              />
            )}

            <div className="flex-1">
              <div className="flex items-center space-x-3 mb-2">
                {badge && (
                  <div className={`inline-flex items-center space-x-2 px-3 py-1 rounded-full text-sm font-semibold ${badge.color}`}>
                    {Icon && <Icon className="h-4 w-4" />}
                    <span>{badge.label}</span>
                  </div>
                )}
                <h4 className="font-bold text-gray-900 text-xl">{prize.name}</h4>
              </div>

              {prize.description && (
                <p className="text-gray-600 text-base leading-relaxed mb-3">{prize.description}</p>
              )}

              <div className="flex items-center gap-6">
                <span className="text-sm text-gray-600">
                  Stock: <span className="font-semibold text-gray-900">{prize.stock}</span>
                </span>
                <span className="text-sm text-gray-600">
                  Probabilidad: <span className="font-semibold text-gray-900">{Number(prize.probability)}%</span>
                </span>
                <span className="text-sm text-gray-600">
                  Estado:{" "}
                  <span className={`font-semibold ${prize.stock > 0 ? "text-green-700" : "text-red-700"}`}>
                    {prize.stock > 0 ? "Disponible" : "Agotado"}
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Acciones */}
        <div className="flex items-center space-x-2 ml-4">
          <button onClick={() => setIsEditing(true)} disabled={loading}
            className="p-3 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl disabled:opacity-50" title="Editar">
            <Edit className="h-5 w-5" />
          </button>
          <button onClick={onDelete} disabled={loading}
            className="p-3 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-xl disabled:opacity-50" title="Eliminar">
            <Trash2 className="h-5 w-5" />
          </button>
          {(prize.image_url || prize.image) && (
            <button onClick={() => window.open(prize.image_url || prize.image, "_blank")}
              className="p-3 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-xl" title="Ver imagen">
              <Eye className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {/* Aviso stock bajo */}
      {prize.stock > 0 && prize.stock <= 3 && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 text-yellow-600" />
            <span className="text-yellow-800 font-medium">
              Stock bajo: Solo quedan {prize.stock} {prize.stock === 1 ? "unidad" : "unidades"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default PrizePanel;