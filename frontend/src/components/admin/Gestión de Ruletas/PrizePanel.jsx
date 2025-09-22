// src/components/PrizePanel.jsx
import React, { useState } from "react";
import { 
  X, Gift, Plus, Edit, Trash2, Save, Package, Percent, 
  Image as ImageIcon, Trophy, Medal, Award, Star, Crown 
} from "lucide-react";

/**
 * PrizePanel - Panel lateral mejorado para gestión de premios con indicadores de posición
 * ---------------------------------------------------------
 * Props:
 * - isOpen: boolean
 * - onClose: () => void
 * - prizeContext: { rouletteId, data, rouletteName }
 * - prizeLoading: boolean
 * - onAddPrize: (payload) => Promise<void>
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

  // Ordenar premios por posición/ranking para mostrar indicadores
  const sortedPrizes = (prizeContext.data || []).sort((a, b) => {
    // Primero por ranking/position si existe, luego por probabilidad descendente
    if (a.position && b.position) return a.position - b.position;
    if (a.position && !b.position) return -1;
    if (!a.position && b.position) return 1;
    return (b.probability || 0) - (a.probability || 0);
  });

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center p-4">
      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-black/60 via-purple-900/20 to-pink-900/20 backdrop-blur-sm" onClick={onClose} />
      
      {/* Panel */}
      <div className="relative w-full max-w-4xl h-[90vh] bg-white rounded-3xl shadow-2xl border border-white/20 overflow-hidden transform transition-all duration-300 ease-out scale-100">
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="relative bg-gradient-to-r from-blue-600 via-blue-700 to-teal-600 px-8 py-8">
            {/* Decorative elements */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-teal-400/20 rounded-full -ml-12 -mb-12"></div>
            
            <div className="relative flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="p-4 bg-white/20 rounded-2xl backdrop-blur-md shadow-lg border border-white/30">
                  <Gift className="h-8 w-8 text-white drop-shadow-sm" />
                </div>
                <div>
                  <h2 className="text-3xl font-bold text-white drop-shadow-sm">Gestión de Premios</h2>
                  <p className="text-blue-100 text-base mt-2 font-medium">
                    {prizeContext.rouletteName || `Ruleta #${prizeContext.rouletteId}`}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="group relative p-3 text-white hover:bg-white/20 focus:bg-white/20 rounded-2xl focus:outline-none focus:ring-2 focus:ring-white/50 transition-all duration-300 ease-out hover:scale-105"
              >
                <X className="h-7 w-7 transition-transform group-hover:rotate-90 duration-300" />
                <div className="absolute inset-0 bg-white/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-8 py-8 bg-gradient-to-br from-gray-50 to-white">
            {/* Stats Cards Row */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="bg-white rounded-2xl p-5 shadow-lg border border-blue-100 hover:shadow-xl transition-all duration-300">
                <div className="flex items-center space-x-3">
                  <div className="p-3 bg-blue-100 rounded-xl">
                    <Gift className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Premios</p>
                    <p className="text-2xl font-bold text-gray-900">{prizeContext.data?.length || 0}</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-2xl p-5 shadow-lg border border-teal-100 hover:shadow-xl transition-all duration-300">
                <div className="flex items-center space-x-3">
                  <div className="p-3 bg-teal-100 rounded-xl">
                    <Package className="h-6 w-6 text-teal-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Stock Total</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {(prizeContext.data || []).reduce((sum, prize) => sum + (Number(prize.stock) || 0), 0)}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-2xl p-5 shadow-lg border border-cyan-100 hover:shadow-xl transition-all duration-300">
                <div className="flex items-center space-x-3">
                  <div className="p-3 bg-cyan-100 rounded-xl">
                    <Percent className="h-6 w-6 text-cyan-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Prob. Total</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {(() => {
                        const total = (prizeContext.data || []).reduce((sum, prize) => sum + (Number(prize.probability) || 0), 0);
                        return Number(total).toFixed(1);
                      })()}%
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Formulario para agregar premio */}
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
                  <h3 className="text-2xl font-bold text-gray-900">
                    Premios Configurados
                  </h3>
                </div>
                <div className="px-4 py-2 bg-gradient-to-r from-blue-100 to-teal-100 text-blue-700 rounded-full text-sm font-bold border border-blue-200">
                  {prizeContext.data?.length || 0} premios activos
                </div>
              </div>

              {prizeLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="relative">
                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-200"></div>
                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-600 border-t-transparent absolute top-0 left-0"></div>
                  </div>
                  <span className="ml-4 text-gray-700 font-medium text-lg">Cargando premios...</span>
                </div>
              ) : sortedPrizes.length === 0 ? (
                <div className="text-center py-16">
                  <div className="relative mb-6">
                    <div className="p-6 bg-gradient-to-br from-gray-100 to-gray-200 rounded-3xl w-24 h-24 mx-auto flex items-center justify-center shadow-lg">
                      <Gift className="h-12 w-12 text-gray-400" />
                    </div>
                    <div className="absolute -top-2 -right-2 w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
                      <Plus className="h-4 w-4 text-white" />
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
                      key={prize.id}
                      prize={prize}
                      position={index + 1}
                      onUpdate={(payload) => onUpdatePrize(prize.id, payload)}
                      onDelete={() => onDeletePrize(prize.id)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Información adicional */}
            <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 border-2 border-blue-200/50 rounded-3xl p-8 mt-8 shadow-lg">
              <div className="flex items-center space-x-3 mb-4">
                <div className="p-3 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-2xl shadow-lg">
                  <Star className="h-6 w-6 text-white" />
                </div>
                <h4 className="font-bold text-xl text-blue-900">Consejos para configurar premios</h4>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-3 text-sm text-blue-800">
                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                    <p>La probabilidad se calcula automáticamente basada en el stock disponible</p>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-purple-500 rounded-full mt-2"></div>
                    <p>Los premios con stock 0 no aparecerán en el sorteo</p>
                  </div>
                </div>
                <div className="space-y-3 text-sm text-blue-800">
                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-indigo-500 rounded-full mt-2"></div>
                    <p>Puedes subir imágenes para hacer más atractivos los premios</p>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-pink-500 rounded-full mt-2"></div>
                    <p>Usa la posición para definir el ranking de importancia del premio</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * PrizeForm - Formulario para agregar nuevos premios
 */
const PrizeForm = ({ onSubmit, loading }) => {
  const [form, setForm] = useState({
    name: "",
    description: "",
    stock: 1,
    probability: 10,
    position: null,
    image: null,
  });

  const [imagePreview, setImagePreview] = useState(null);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setForm(prev => ({ ...prev, image: file }));
      
      // Crear preview
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result);
      reader.readAsDataURL(file);
    } else {
      setForm(prev => ({ ...prev, image: null }));
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
      const cleanForm = {
        ...form,
        position: form.position || null
      };
      
      await onSubmit(cleanForm);
      // Reset form
      setForm({
        name: "",
        description: "",
        stock: 1,
        probability: 10,
        position: null,
        image: null,
      });
      setImagePreview(null);
    } catch (error) {
      console.error("Error al agregar premio:", error);
    }
  };

  return (
    <div className="bg-white border-2 border-blue-200/50 rounded-3xl p-8 shadow-xl hover:shadow-2xl transition-all duration-300">
      <div className="flex items-center space-x-3 mb-6">
        <div className="p-3 bg-gradient-to-r from-blue-500 to-teal-500 rounded-2xl shadow-lg">
          <Plus className="h-6 w-6 text-white" />
        </div>
        <h3 className="text-2xl font-bold text-gray-900">Agregar Nuevo Premio</h3>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Nombre del premio */}
        <div className="group">
          <label className="block text-sm font-bold text-gray-700 mb-3">
            Nombre del premio *
          </label>
          <input
            type="text"
            required
            value={form.name}
            onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
            className="w-full px-5 py-4 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all duration-300 text-gray-900 font-medium placeholder-gray-400 group-hover:border-blue-300"
            placeholder="Ej. Gift Card de $50"
          />
        </div>

        {/* Descripción */}
        <div className="group">
          <label className="block text-sm font-bold text-gray-700 mb-3">
            Descripción
          </label>
          <textarea
            value={form.description}
            onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
            rows={4}
            className="w-full px-5 py-4 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all duration-300 resize-none text-gray-900 placeholder-gray-400 group-hover:border-blue-300"
            placeholder="Describe los detalles del premio..."
          />
        </div>

        {/* Stock, Probabilidad y Posición */}
        <div className="grid grid-cols-3 gap-6">
          <div className="group">
            <label className="block text-sm font-bold text-gray-700 mb-3">
              Stock disponible
            </label>
            <div className="relative">
              <Package className="absolute left-4 top-4 h-5 w-5 text-blue-500" />
              <input
                type="number"
                min="1"
                required
                value={form.stock}
                onChange={(e) => setForm(prev => ({ ...prev, stock: Number(e.target.value) }))}
                className="w-full pl-12 pr-5 py-4 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all duration-300 text-gray-900 font-bold group-hover:border-blue-300"
              />
            </div>
          </div>

          <div className="group">
            <label className="block text-sm font-bold text-gray-700 mb-3">
              Probabilidad (%)
            </label>
            <div className="relative">
              <Percent className="absolute left-4 top-4 h-5 w-5 text-teal-500" />
              <input
                type="number"
                min="0"
                max="100"
                value={form.probability}
                onChange={(e) => setForm(prev => ({ ...prev, probability: Number(e.target.value) }))}
                className="w-full pl-12 pr-5 py-4 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all duration-300 text-gray-900 font-bold group-hover:border-teal-300"
              />
            </div>
          </div>

          <div className="group">
            <label className="block text-sm font-bold text-gray-700 mb-3">
              Posición/Ranking
            </label>
            <div className="relative">
              <Trophy className="absolute left-4 top-4 h-5 w-5 text-cyan-500" />
              <input
                type="number"
                min="1"
                max="10"
                value={form.position || ""}
                onChange={(e) => setForm(prev => ({ ...prev, position: e.target.value ? Number(e.target.value) : null }))}
                className="w-full pl-12 pr-5 py-4 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none transition-all duration-300 text-gray-900 font-bold placeholder-gray-400 group-hover:border-cyan-300"
                placeholder="Opcional"
              />
            </div>
          </div>
        </div>

        {/* Imagen */}
        <div className="group">
          <label className="block text-sm font-bold text-gray-700 mb-3">
            Imagen del premio (opcional)
          </label>
          <div className="flex items-start space-x-6">
            <div className="flex-1">
              <div className="relative">
                <ImageIcon className="absolute left-4 top-4 h-5 w-5 text-blue-500" />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="w-full pl-12 pr-5 py-4 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all duration-300 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 group-hover:border-blue-300"
                />
              </div>
            </div>
            {imagePreview && (
              <div className="w-20 h-20 border-2 border-blue-200 rounded-2xl overflow-hidden shadow-lg">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="w-full h-full object-cover"
                />
              </div>
            )}
          </div>
        </div>

        {/* Botón de envío */}
        <div className="pt-6">
          <button
            type="submit"
            disabled={loading || !form.name.trim()}
            className="w-full inline-flex items-center justify-center px-8 py-4 text-base font-bold text-white bg-gradient-to-r from-blue-600 via-blue-700 to-teal-600 rounded-2xl hover:from-blue-700 hover:via-blue-800 hover:to-teal-700 focus:outline-none focus:ring-4 focus:ring-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98]"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-3"></div>
                Agregando premio...
              </>
            ) : (
              <>
                <Plus className="h-5 w-5 mr-3" />
                Agregar Premio
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

/**
 * PrizeCard - Tarjeta individual de premio con indicadores de posición
 */
const PrizeCard = ({ prize, position, onUpdate, onDelete }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: prize.name,
    description: prize.description || "",
    stock: prize.stock || 1,
    probability: prize.probability || 0,
    position: prize.position || null,
    image: null,
  });

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      const cleanForm = {
        ...editForm,
        position: editForm.position || null
      };
      await onUpdate(cleanForm);
      setIsEditing(false);
    } catch (error) {
      console.error("Error al actualizar premio:", error);
    }
  };

  const handleDelete = () => {
    if (window.confirm(`¿Estás seguro de que quieres eliminar el premio "${prize.name}"?`)) {
      onDelete();
    }
  };

  // Función para obtener el indicador de posición
  const getPositionIndicator = () => {
    const pos = prize.position || position;
    
    const indicators = {
      1: { icon: Crown, color: "text-yellow-600 bg-gradient-to-br from-yellow-100 to-yellow-200 border-yellow-300", label: "1er Lugar", glow: "shadow-yellow-500/30" },
      2: { icon: Trophy, color: "text-gray-600 bg-gradient-to-br from-gray-100 to-gray-200 border-gray-300", label: "2do Lugar", glow: "shadow-gray-500/30" },
      3: { icon: Medal, color: "text-amber-700 bg-gradient-to-br from-amber-100 to-amber-200 border-amber-300", label: "3er Lugar", glow: "shadow-amber-500/30" },
    };

    if (pos <= 3) {
      const indicator = indicators[pos];
      return {
        ...indicator,
        show: true
      };
    } else if (pos <= 5) {
      return {
        icon: Award,
        color: "text-indigo-600 bg-gradient-to-br from-indigo-100 to-indigo-200 border-indigo-300",
        label: `${pos}° Lugar`,
        glow: "shadow-indigo-500/30",
        show: true
      };
    } else if (pos > 5) {
      return {
        icon: Star,
        color: "text-purple-600 bg-gradient-to-br from-purple-100 to-purple-200 border-purple-300",
        label: `Puesto ${pos}`,
        glow: "shadow-purple-500/30",
        show: true
      };
    }

    return { show: false };
  };

  const positionInfo = getPositionIndicator();

  return (
    <div className={`relative bg-white border-2 rounded-3xl p-6 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-[1.02] ${
      positionInfo.show 
        ? `border-purple-200 bg-gradient-to-br from-white via-purple-50/30 to-pink-50/30 ${positionInfo.glow} shadow-lg` 
        : 'border-gray-200 hover:border-purple-300'
    }`}>
      
      {/* Indicador de posición flotante */}
      {positionInfo.show && (
        <div className={`absolute -top-3 -left-3 inline-flex items-center space-x-2 px-4 py-2 rounded-2xl text-sm font-bold border-2 shadow-lg ${positionInfo.color} ${positionInfo.glow}`}>
          <positionInfo.icon className="h-4 w-4" />
          <span>{positionInfo.label}</span>
        </div>
      )}

      {!isEditing ? (
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-4 mb-4">
              {prize.image && (
                <div className="relative">
                  <img
                    src={prize.image}
                    alt={prize.name}
                    className="w-16 h-16 object-cover rounded-2xl border-2 border-purple-200 shadow-lg"
                  />
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-t from-black/20 to-transparent"></div>
                </div>
              )}
              
              <div className="flex-1">
                <h4 className="font-bold text-xl text-gray-900 mb-2">{prize.name}</h4>
                {prize.description && (
                  <p className="text-gray-600 text-base leading-relaxed">
                    {prize.description}
                  </p>
                )}
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-blue-50 rounded-2xl p-4 border border-blue-200">
                <div className="flex items-center space-x-2 mb-1">
                  <Package className="h-4 w-4 text-blue-600" />
                  <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Stock</span>
                </div>
                <span className="text-2xl font-bold text-blue-800">{prize.stock}</span>
              </div>

              <div className="bg-green-50 rounded-2xl p-4 border border-green-200">
                <div className="flex items-center space-x-2 mb-1">
                  <Percent className="h-4 w-4 text-green-600" />
                  <span className="text-xs font-bold text-green-600 uppercase tracking-wider">Probabilidad</span>
                </div>
                <span className="text-2xl font-bold text-green-800">{prize.probability}%</span>
              </div>

              {prize.position && (
                <div className="bg-purple-50 rounded-2xl p-4 border border-purple-200">
                  <div className="flex items-center space-x-2 mb-1">
                    <Trophy className="h-4 w-4 text-purple-600" />
                    <span className="text-xs font-bold text-purple-600 uppercase tracking-wider">Posición</span>
                  </div>
                  <span className="text-2xl font-bold text-purple-800">#{prize.position}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col space-y-2 ml-6">
            <button
              onClick={() => setIsEditing(true)}
              className="group p-3 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-2xl transition-all duration-300 hover:shadow-lg"
              title="Editar premio"
            >
              <Edit className="h-5 w-5 group-hover:scale-110 transition-transform duration-200" />
            </button>
            <button
              onClick={handleDelete}
              className="group p-3 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-2xl transition-all duration-300 hover:shadow-lg"
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
              onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-semibold text-gray-900"
              placeholder="Nombre del premio"
            />
          </div>

          <div>
            <textarea
              value={editForm.description}
              onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none resize-none text-gray-900"
              placeholder="Descripción del premio"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <input
              type="number"
              min="1"
              value={editForm.stock}
              onChange={(e) => setEditForm(prev => ({ ...prev, stock: Number(e.target.value) }))}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-bold text-center"
              placeholder="Stock"
            />
            <input
              type="number"
              min="0"
              max="100"
              value={editForm.probability}
              onChange={(e) => setEditForm(prev => ({ ...prev, probability: Number(e.target.value) }))}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-green-500/20 focus:border-green-500 outline-none font-bold text-center"
              placeholder="Probabilidad %"
            />
            <input
              type="number"
              min="1"
              max="10"
              value={editForm.position || ""}
              onChange={(e) => setEditForm(prev => ({ ...prev, position: e.target.value ? Number(e.target.value) : null }))}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-purple-500/20 focus:border-purple-500 outline-none font-bold text-center"
              placeholder="Posición"
            />
          </div>

          <div>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setEditForm(prev => ({ ...prev, image: e.target.files?.[0] || null }))}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>

          <div className="flex items-center justify-end space-x-4 pt-4">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="px-6 py-3 text-sm font-bold text-gray-700 bg-white border-2 border-gray-300 rounded-2xl hover:bg-gray-50 hover:border-gray-400 focus:outline-none focus:ring-4 focus:ring-gray-300/50 transition-all duration-200"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="inline-flex items-center px-6 py-3 text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-500/50 shadow-lg hover:shadow-xl transition-all duration-200"
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