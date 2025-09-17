// src/components/PrizePanel.jsx
import React, { useState } from "react";
import { X, Gift, Plus, Edit, Trash2, Save, Package, Percent, Image as ImageIcon } from "lucide-react";

/**
 * PrizePanel - Panel lateral mejorado para gestión de premios
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

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose} />
      
      {/* Panel */}
      <div className="absolute right-0 top-0 h-full w-full max-w-2xl bg-white shadow-2xl">
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-white bg-opacity-20 rounded-lg backdrop-blur-sm">
                  <Gift className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Gestión de Premios</h2>
                  <p className="text-purple-100 text-sm mt-1">
                    {prizeContext.rouletteName || `Ruleta #${prizeContext.rouletteId}`}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="rounded-lg p-2 text-white hover:bg-white hover:bg-opacity-20 focus:outline-none focus:ring-2 focus:ring-white transition-all duration-200"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Formulario para agregar premio */}
            <PrizeForm onSubmit={onAddPrize} loading={prizeLoading} />

            {/* Lista de premios */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Premios Configurados
                </h3>
                <div className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
                  {prizeContext.data?.length || 0} premios
                </div>
              </div>

              {prizeLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                  <span className="ml-3 text-gray-600">Cargando premios...</span>
                </div>
              ) : (prizeContext.data || []).length === 0 ? (
                <div className="text-center py-12">
                  <div className="p-4 bg-gray-100 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                    <Gift className="h-8 w-8 text-gray-400" />
                  </div>
                  <p className="text-gray-600 text-lg mb-2">No hay premios configurados</p>
                  <p className="text-gray-500">Agrega tu primer premio usando el formulario de arriba</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {prizeContext.data.map((prize) => (
                    <PrizeCard
                      key={prize.id}
                      prize={prize}
                      onUpdate={(payload) => onUpdatePrize(prize.id, payload)}
                      onDelete={() => onDeletePrize(prize.id)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Información adicional */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4">
              <h4 className="font-semibold text-blue-900 mb-2">💡 Consejos para configurar premios</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• La probabilidad se calcula automáticamente basada en el stock disponible</li>
                <li>• Los premios con stock 0 no aparecerán en el sorteo</li>
                <li>• Puedes subir imágenes para hacer más atractivos los premios</li>
                <li>• La suma de probabilidades no necesita ser exactamente 100%</li>
              </ul>
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
      await onSubmit(form);
      // Reset form
      setForm({
        name: "",
        description: "",
        stock: 1,
        probability: 10,
        image: null,
      });
      setImagePreview(null);
    } catch (error) {
      console.error("Error al agregar premio:", error);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
      <div className="flex items-center space-x-2 mb-4">
        <Plus className="h-5 w-5 text-purple-600" />
        <h3 className="text-lg font-semibold text-gray-900">Agregar Nuevo Premio</h3>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Nombre del premio */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Nombre del premio *
          </label>
          <input
            type="text"
            required
            value={form.name}
            onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all duration-200"
            placeholder="Ej. Gift Card de $50"
          />
        </div>

        {/* Descripción */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Descripción
          </label>
          <textarea
            value={form.description}
            onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
            rows={3}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all duration-200 resize-none"
            placeholder="Describe los detalles del premio..."
          />
        </div>

        {/* Stock y Probabilidad */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Stock disponible
            </label>
            <div className="relative">
              <Package className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
              <input
                type="number"
                min="1"
                required
                value={form.stock}
                onChange={(e) => setForm(prev => ({ ...prev, stock: Number(e.target.value) }))}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all duration-200"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Probabilidad (%)
            </label>
            <div className="relative">
              <Percent className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
              <input
                type="number"
                min="0"
                max="100"
                value={form.probability}
                onChange={(e) => setForm(prev => ({ ...prev, probability: Number(e.target.value) }))}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all duration-200"
              />
            </div>
          </div>
        </div>

        {/* Imagen */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Imagen del premio (opcional)
          </label>
          <div className="flex items-start space-x-4">
            <div className="flex-1">
              <div className="relative">
                <ImageIcon className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all duration-200"
                />
              </div>
            </div>
            {imagePreview && (
              <div className="w-16 h-16 border border-gray-300 rounded-lg overflow-hidden">
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
        <div className="pt-4">
          <button
            type="submit"
            disabled={loading || !form.name.trim()}
            className="w-full inline-flex items-center justify-center px-6 py-3 text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg hover:from-purple-700 hover:to-pink-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg transition-all duration-200"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Agregando...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
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
 * PrizeCard - Tarjeta individual de premio
 */
const PrizeCard = ({ prize, onUpdate, onDelete }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: prize.name,
    description: prize.description || "",
    stock: prize.stock || 1,
    probability: prize.probability || 0,
    image: null,
  });

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      await onUpdate(editForm);
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

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-all duration-200">
      {!isEditing ? (
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-3 mb-2">
              {prize.image && (
                <img
                  src={prize.image}
                  alt={prize.name}
                  className="w-12 h-12 object-cover rounded-lg border border-gray-200"
                />
              )}
              <div>
                <h4 className="font-semibold text-gray-900 text-lg">{prize.name}</h4>
                {prize.description && (
                  <p className="text-gray-600 text-sm mt-1 leading-relaxed">
                    {prize.description}
                  </p>
                )}
              </div>
            </div>
            
            <div className="flex items-center space-x-6 mt-3">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <span className="text-sm text-gray-600">
                  Stock: <span className="font-semibold text-gray-900">{prize.stock}</span>
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="text-sm text-gray-600">
                  Probabilidad: <span className="font-semibold text-gray-900">{prize.probability}%</span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2 ml-4">
            <button
              onClick={() => setIsEditing(true)}
              className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200"
              title="Editar premio"
            >
              <Edit className="h-4 w-4" />
            </button>
            <button
              onClick={handleDelete}
              className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200"
              title="Eliminar premio"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleUpdate} className="space-y-4">
          <div>
            <input
              type="text"
              value={editForm.name}
              onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              placeholder="Nombre del premio"
            />
          </div>

          <div>
            <textarea
              value={editForm.description}
              onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
              placeholder="Descripción del premio"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <input
              type="number"
              min="1"
              value={editForm.stock}
              onChange={(e) => setEditForm(prev => ({ ...prev, stock: Number(e.target.value) }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              placeholder="Stock"
            />
            <input
              type="number"
              min="0"
              max="100"
              value={editForm.probability}
              onChange={(e) => setEditForm(prev => ({ ...prev, probability: Number(e.target.value) }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              placeholder="Probabilidad %"
            />
          </div>

          <div>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setEditForm(prev => ({ ...prev, image: e.target.files?.[0] || null }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          <div className="flex items-center justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <Save className="h-4 w-4 mr-1" />
              Guardar
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default PrizePanel;