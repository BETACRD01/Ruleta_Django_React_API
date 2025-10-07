"use client"

// src/components/PrizePanel.jsx
import { useState } from "react"
import { X, Gift, Plus, Edit, Trash2, Save, Package, Trophy, Medal, Award, Crown } from "lucide-react"

/**
 * PrizePanel - Panel lateral para gestión de premios (SIN probabilidad)
 */
const PrizePanel = ({ isOpen, onClose, prizeContext, prizeLoading, onAddPrize, onUpdatePrize, onDeletePrize }) => {
  if (!isOpen) return null

  const sortedPrizes = (prizeContext?.data || []).slice().sort((a, b) => {
    const pa = a.display_order ?? a.position ?? null
    const pb = b.display_order ?? b.position ?? null
    if (pa != null && pb != null) return pa - pb
    if (pa != null && pb == null) return -1
    if (pa == null && pb != null) return 1
    return (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" })
  })

  const totalStock = (prizeContext?.data || []).reduce((sum, p) => sum + (Number(p.stock) || 0), 0)

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-full max-w-4xl h-[90vh] max-h-[92vh] rounded-2xl overflow-hidden shadow-2xl flex flex-col bg-white">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-700 to-slate-800 px-6 py-4 shrink-0 border-b border-slate-600">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-white/10 rounded-lg">
                <Gift className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">Gestión de Premios</h2>
                <p className="text-slate-300 text-sm">
                  {prizeContext?.rouletteName || `Ruleta #${prizeContext?.rouletteId}`}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Contenido */}
        <div className="flex-1 overflow-y-auto px-6 py-6 bg-gray-50">
          
          {/* Estadísticas */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Award className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-600">Total Premios</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {(prizeContext?.data || []).length}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Package className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-600">Stock Total</p>
                  <p className="text-2xl font-bold text-gray-900">{totalStock}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Formulario crear */}
          <div className="mb-6">
            <PrizeForm onSubmit={onAddPrize} loading={prizeLoading} />
          </div>

          {/* Lista de premios */}
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <Trophy className="h-5 w-5 text-gray-700" />
              <h3 className="text-lg font-semibold text-gray-900">Premios Configurados</h3>
            </div>

            {sortedPrizes.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl border-2 border-dashed border-gray-300">
                <div className="flex items-center justify-center mb-3">
                  <div className="p-4 bg-gray-100 text-gray-400 rounded-lg">
                    <Gift className="h-10 w-10" />
                  </div>
                </div>
                <p className="text-gray-800 text-base font-semibold mb-1">No hay premios configurados</p>
                <p className="text-gray-500 text-sm">
                  Agrega tu primer premio usando el formulario de arriba
                </p>
              </div>
            ) : (
              <div className="space-y-4">
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
        </div>
      </div>
    </div>
  )
}

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
  })
  const [imagePreview, setImagePreview] = useState(null)

  const handleFileChange = (e) => {
    const file = e.target.files?.[0] || null
    if (file) {
      setForm((prev) => ({ ...prev, image: file }))
      const reader = new FileReader()
      reader.onloadend = () => setImagePreview(reader.result)
      reader.readAsDataURL(file)
    } else {
      setForm((prev) => ({ ...prev, image: null }))
      setImagePreview(null)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) {
      alert("El nombre del premio es obligatorio")
      return
    }
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description?.trim() || "",
        stock: Number(form.stock) || 0,
        display_order: form.position ? Number(form.position) : null,
        image: form.image || null,
        is_active: !!form.is_active,
      }
      await onSubmit(payload)
      setForm({ name: "", description: "", stock: 1, position: "", image: null, is_active: true })
      setImagePreview(null)
    } catch (error) {
      console.error("Error al crear premio:", error)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white border border-gray-200 rounded-xl p-5 space-y-4"
    >
      <div className="flex items-center space-x-2 mb-3">
        <Plus className="h-5 w-5 text-blue-600" />
        <h4 className="text-base font-semibold text-gray-900">Agregar Nuevo Premio</h4>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Nombre del premio *</label>
        <input
          type="text"
          required
          value={form.name}
          onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none transition"
          placeholder="Ej. iPhone 15 Pro Max"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Descripción</label>
        <textarea
          value={form.description}
          onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none resize-y transition"
          placeholder="Describe los detalles del premio..."
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Stock</label>
          <input
            type="number"
            min="0"
            required
            value={form.stock}
            onChange={(e) => setForm((prev) => ({ ...prev, stock: Number(e.target.value) }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none transition"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Orden</label>
          <input
            type="number"
            min="0"
            max="9999"
            value={form.position}
            onChange={(e) => setForm((prev) => ({ ...prev, position: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none transition"
            placeholder="Ej. 1"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Imagen del premio</label>
        <div className="flex items-start space-x-3">
          <div className="flex-1">
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none file:px-3 file:py-1.5 file:mr-3 file:rounded-md file:border-0 file:cursor-pointer file:text-xs file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 transition text-sm"
            />
          </div>
          {imagePreview && (
            <div className="w-16 h-16 border border-gray-200 rounded-lg overflow-hidden">
              <img src={imagePreview || "/placeholder.svg"} alt="Preview" className="w-full h-full object-cover" />
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-gray-200">
        <label className="inline-flex items-center space-x-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
          />
          <span className="text-sm font-medium text-gray-700">
            Premio activo
          </span>
        </label>

        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center px-5 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          {loading ? "Guardando..." : "Agregar"}
        </button>
      </div>
    </form>
  )
}

/* ======================
 * Tarjeta de premio
 * =====================*/
const PrizeCard = ({ prize, position, onUpdate, onDelete }) => {
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    name: prize.name || "",
    description: prize.description || "",
    stock: Number(prize.stock) || 0,
    position: prize.display_order ?? prize.position ?? "",
    image: null,
    is_active: prize.is_active !== false,
  })

  const initialPos = prize.display_order ?? prize.position ?? null

  const handleUpdate = async (e) => {
    e.preventDefault()
    try {
      const payload = {
        name: editForm.name?.trim() || "",
        description: editForm.description?.trim() || "",
        stock: Number(editForm.stock) || 0,
        display_order: editForm.position != null && editForm.position !== "" ? Number(editForm.position) : null,
        image: editForm.image || null,
        is_active: !!editForm.is_active,
      }
      await onUpdate(payload)
      setIsEditing(false)
    } catch (error) {
      console.error("Error al actualizar premio:", error)
    }
  }

  const handleDelete = () => {
    if (window.confirm(`¿Eliminar el premio "${prize.name}"?`)) {
      onDelete()
    }
  }

  const getPrizeImage = (p) => p?.image_url || p?.image || null

  const getPositionIndicator = () => {
    const pos = initialPos ?? position
    if (pos == null) return null
    let icon = Medal
    let color = "bg-amber-100 text-amber-700 border-amber-200"
    let label = `${pos}°`

    if (pos === 1) {
      icon = Crown
      color = "bg-yellow-100 text-yellow-700 border-yellow-200"
      label = "1°"
    } else if (pos === 2) {
      icon = Medal
      color = "bg-gray-100 text-gray-700 border-gray-200"
      label = "2°"
    } else if (pos === 3) {
      icon = Medal
      color = "bg-orange-100 text-orange-700 border-orange-200"
      label = "3°"
    }
    return { icon, color, label }
  }

  const positionInfo = getPositionIndicator()
  const PositionIcon = positionInfo?.icon || Medal
  const img = getPrizeImage(prize)

  return (
    <div className="relative bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition">
      {positionInfo && (
        <div
          className={`absolute -top-2 -left-2 inline-flex items-center space-x-1 text-xs font-semibold px-2.5 py-1 rounded-md border ${positionInfo.color}`}
        >
          <PositionIcon className="h-3.5 w-3.5" />
          <span>{positionInfo.label}</span>
        </div>
      )}

      {!isEditing ? (
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-3 mb-3">
              {img && (
                <div className="relative">
                  <img
                    src={img || "/placeholder.svg"}
                    alt={prize.name}
                    className="w-16 h-16 object-cover rounded-lg border border-gray-200"
                  />
                </div>
              )}
              <div className="flex-1">
                <h4 className="font-semibold text-base text-gray-900 mb-1">{prize.name}</h4>
                {prize.description && <p className="text-gray-600 text-sm">{prize.description}</p>}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center space-x-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-md px-2.5 py-1">
                <Package className="h-3.5 w-3.5" />
                <span>Stock: {Number(prize.stock) || 0}</span>
              </span>
              {prize.is_active === false && (
                <span className="inline-flex items-center text-xs font-medium text-gray-600 bg-gray-100 border border-gray-200 rounded-md px-2.5 py-1">
                  Inactivo
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col space-y-2 ml-4">
            <button
              onClick={() => setIsEditing(true)}
              className="p-2 text-gray-600 hover:text-blue-600 bg-gray-50 hover:bg-blue-50 rounded-lg transition border border-gray-200 hover:border-blue-200"
              title="Editar premio"
            >
              <Edit className="h-4 w-4" />
            </button>
            <button
              onClick={handleDelete}
              className="p-2 text-gray-600 hover:text-red-600 bg-gray-50 hover:bg-red-50 rounded-lg transition border border-gray-200 hover:border-red-200"
              title="Eliminar premio"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleUpdate} className="space-y-3">
          <div>
            <input
              type="text"
              value={editForm.name}
              onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none transition"
              placeholder="Nombre del premio"
            />
          </div>

          <div>
            <textarea
              rows={2}
              value={editForm.description}
              onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none resize-y transition"
              placeholder="Descripción del premio"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Stock</label>
              <input
                type="number"
                min="0"
                value={editForm.stock}
                onChange={(e) => setEditForm((prev) => ({ ...prev, stock: Number(e.target.value) }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none transition"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Orden</label>
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none transition"
                placeholder="Orden"
              />
            </div>
          </div>

          <div>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setEditForm((prev) => ({ ...prev, image: e.target.files?.[0] || null }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none file:px-3 file:py-1.5 file:mr-3 file:rounded-md file:border-0 file:cursor-pointer file:text-xs file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 transition text-sm"
            />
          </div>

          <div className="flex items-center justify-end space-x-2 pt-3 border-t border-gray-200">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition"
            >
              <Save className="h-4 w-4 mr-1.5" />
              Guardar
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

export default PrizePanel