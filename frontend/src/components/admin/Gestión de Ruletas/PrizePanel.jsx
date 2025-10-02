"use client"

// src/components/PrizePanel.jsx
import { useState } from "react"
import { X, Gift, Plus, Edit, Trash2, Save, Package, ImageIcon, Trophy, Medal, Award, Crown } from "lucide-react"

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
const PrizePanel = ({ isOpen, onClose, prizeContext, prizeLoading, onAddPrize, onUpdatePrize, onDeletePrize }) => {
  if (!isOpen) return null

  // Orden de render
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
        className="absolute inset-0 bg-gradient-to-br from-slate-900/60 via-slate-800/50 to-slate-900/60 backdrop-blur-xl"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-full max-w-5xl h-[90vh] max-h-[92vh] rounded-3xl overflow-hidden shadow-2xl ring-1 ring-white/20 flex flex-col">
        <div className="relative bg-gradient-to-br from-slate-900 via-indigo-900/40 to-slate-900 px-8 pt-8 pb-6 shrink-0 border-b border-white/10">
          <div
            className="absolute inset-0 pointer-events-none opacity-20"
            style={{
              backgroundImage:
                "radial-gradient(circle at 30% 20%, rgba(99, 102, 241, 0.3), transparent 60%), radial-gradient(circle at 70% 80%, rgba(139, 92, 246, 0.2), transparent 60%)",
            }}
          />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-4 bg-gradient-to-br from-indigo-500/30 to-purple-600/30 rounded-2xl backdrop-blur-sm shadow-xl border border-white/30 ring-2 ring-indigo-400/20">
                <Gift className="h-8 w-8 text-indigo-300 drop-shadow-2xl" />
              </div>
              <div>
                <h2 className="text-3xl font-bold text-white drop-shadow-lg tracking-tight">Gestión de Premios</h2>
                <p className="text-indigo-200 text-base mt-1 font-medium">
                  {prizeContext?.rouletteName || `Ruleta #${prizeContext?.rouletteId}`}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="group relative p-3 text-white hover:bg-white/15 active:bg-white/25 rounded-xl border border-white/20 transition-all duration-300 ease-out hover:scale-110 hover:shadow-lg"
            >
              <X className="h-6 w-6 transition-transform group-hover:rotate-90 duration-300" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-8 py-8 bg-gradient-to-br from-slate-50 via-indigo-50/30 to-slate-50">
          <div className="grid grid-cols-2 gap-5 mb-8">
            <div className="group bg-white rounded-2xl p-6 shadow-lg border border-indigo-100/60 hover:shadow-2xl transition-all duration-300 hover:scale-[1.03] hover:-translate-y-1">
              <div className="flex items-center space-x-4">
                <div className="p-3.5 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl shadow-xl group-hover:shadow-2xl group-hover:scale-110 transition-all duration-300">
                  <Award className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-600 mb-0.5">Total Premios</p>
                  <p className="text-3xl font-black text-slate-900 tracking-tight">
                    {(prizeContext?.data || []).length}
                  </p>
                </div>
              </div>
            </div>

            <div className="group bg-white rounded-2xl p-6 shadow-lg border border-emerald-100/60 hover:shadow-2xl transition-all duration-300 hover:scale-[1.03] hover:-translate-y-1">
              <div className="flex items-center space-x-4">
                <div className="p-3.5 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl shadow-xl group-hover:shadow-2xl group-hover:scale-110 transition-all duration-300">
                  <Package className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-600 mb-0.5">Stock Total</p>
                  <p className="text-3xl font-black text-slate-900 tracking-tight">{totalStock}</p>
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
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-2.5 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl shadow-lg">
                <Trophy className="h-5 w-5 text-white" />
              </div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">Premios Configurados</h3>
            </div>

            {sortedPrizes.length === 0 ? (
              <div className="text-center py-20 bg-gradient-to-br from-slate-50 to-white rounded-3xl border-2 border-dashed border-slate-200">
                <div className="flex items-center justify-center mb-4">
                  <div className="p-5 bg-gradient-to-br from-slate-100 to-slate-200 text-slate-600 rounded-2xl shadow-lg">
                    <Gift className="h-12 w-12" />
                  </div>
                </div>
                <p className="text-slate-800 text-xl font-bold mb-2">No hay premios configurados</p>
                <p className="text-slate-500 text-base max-w-md mx-auto leading-relaxed">
                  Agrega tu primer premio usando el formulario de arriba
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
      className="bg-white border-2 border-indigo-100/60 rounded-3xl p-7 shadow-xl space-y-6 hover:shadow-2xl transition-shadow duration-300"
    >
      <div className="flex items-center space-x-3 mb-4">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 shadow-lg">
          <Plus className="h-5 w-5 text-white" />
        </div>
        <h4 className="text-xl font-black text-slate-900 tracking-tight">Agregar Nuevo Premio</h4>
      </div>

      <div className="group">
        <label className="block text-sm font-bold text-slate-700 mb-2.5">Nombre del premio</label>
        <div className="relative">
          <Gift className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors duration-200" />
          <input
            type="text"
            required
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            className="w-full pl-12 pr-5 py-4 border-2 border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-300 text-slate-900 font-semibold placeholder-slate-400 group-hover:border-slate-300 hover:shadow-md"
            placeholder="Ej. iPhone 15 Pro Max"
          />
        </div>
      </div>

      <div className="group">
        <label className="block text-sm font-bold text-slate-700 mb-2.5">Descripción (opcional)</label>
        <textarea
          value={form.description}
          onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
          rows={3}
          className="w-full px-5 py-4 border-2 border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-300 text-slate-900 placeholder-slate-400 group-hover:border-slate-300 resize-y overflow-auto max-h-48 hover:shadow-md"
          placeholder="Describe los detalles del premio..."
        />
      </div>

      <div className="grid grid-cols-2 gap-5">
        <div className="group">
          <label className="block text-sm font-bold text-slate-700 mb-2.5">Stock disponible</label>
          <div className="relative">
            <Package className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-emerald-500 transition-colors duration-200" />
            <input
              type="number"
              min="0"
              required
              value={form.stock}
              onChange={(e) => setForm((prev) => ({ ...prev, stock: Number(e.target.value) }))}
              className="w-full pl-12 pr-5 py-4 border-2 border-slate-200 rounded-xl focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all duration-300 text-slate-900 font-bold group-hover:border-slate-300 hover:shadow-md"
            />
          </div>
        </div>

        <div className="group">
          <label className="block text-sm font-bold text-slate-700 mb-2.5">Orden (posición)</label>
          <div className="relative">
            <Medal className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-purple-500 transition-colors duration-200" />
            <input
              type="number"
              min="0"
              max="9999"
              value={form.position}
              onChange={(e) => setForm((prev) => ({ ...prev, position: e.target.value }))}
              className="w-full pl-12 pr-5 py-4 border-2 border-slate-200 rounded-xl focus:ring-4 focus:ring-purple-500/20 focus:border-purple-500 transition-all duration-300 text-slate-900 font-bold group-hover:border-slate-300 hover:shadow-md"
              placeholder="Ej. 1"
            />
          </div>
        </div>
      </div>

      <div className="group">
        <label className="block text-sm font-bold text-slate-700 mb-2.5">Imagen del premio (opcional)</label>
        <div className="flex items-start space-x-5">
          <div className="flex-1">
            <div className="relative">
              <ImageIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors duration-200 pointer-events-none" />
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="w-full pl-12 pr-5 py-4 border-2 border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-300 file:px-4 file:py-2.5 file:mr-4 file:rounded-lg file:border-0 file:cursor-pointer file:text-sm file:font-bold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 group-hover:border-slate-300 hover:shadow-md"
              />
            </div>
          </div>
          {imagePreview && (
            <div className="w-20 h-20 border-2 border-indigo-200 rounded-xl overflow-hidden shadow-xl ring-4 ring-indigo-500/20 hover:scale-110 transition-transform duration-300">
              <img src={imagePreview || "/placeholder.svg"} alt="Preview" className="w-full h-full object-cover" />
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 border-t-2 border-slate-100">
        <label className="inline-flex items-center space-x-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))}
            className="h-5 w-5 rounded-lg border-2 border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer transition-all"
          />
          <span className="text-sm font-bold text-slate-700 group-hover:text-slate-900 transition-colors">
            Premio activo
          </span>
        </label>

        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center px-8 py-4 text-sm font-bold rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-600 to-purple-600 text-white shadow-xl hover:shadow-2xl hover:scale-105 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-300 hover:-translate-y-0.5"
        >
          <Plus className="h-4 w-4 mr-2" />
          {loading ? "Guardando..." : "Agregar Premio"}
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
    let color = "bg-gradient-to-r from-amber-500 to-yellow-500 text-white"
    let glow = "shadow-[0_0_20px_rgba(245,158,11,0.4)]"
    let label = `${pos}°`

    if (pos === 1) {
      icon = Crown
      color = "bg-gradient-to-r from-yellow-400 via-amber-500 to-orange-500 text-white"
      glow = "shadow-[0_0_25px_rgba(245,158,11,0.5)] ring-4 ring-amber-400/30"
      label = "1°"
    } else if (pos === 2) {
      icon = Medal
      color = "bg-gradient-to-r from-slate-300 via-slate-400 to-slate-500 text-white"
      glow = "shadow-[0_0_20px_rgba(148,163,184,0.4)] ring-4 ring-slate-400/30"
      label = "2°"
    } else if (pos === 3) {
      icon = Medal
      color = "bg-gradient-to-r from-orange-400 via-orange-500 to-orange-600 text-white"
      glow = "shadow-[0_0_20px_rgba(234,88,12,0.4)] ring-4 ring-orange-400/30"
      label = "3°"
    }
    return { icon, color, glow, label }
  }

  const positionInfo = getPositionIndicator()
  const PositionIcon = positionInfo?.icon || Medal
  const img = getPrizeImage(prize)

  return (
    <div className="relative bg-white rounded-2xl border-2 border-slate-200/60 shadow-lg hover:shadow-2xl transition-all duration-300 p-6 hover:scale-[1.02] hover:-translate-y-1">
      {positionInfo && (
        <div
          className={`absolute -top-3 -left-3 inline-flex items-center space-x-1.5 text-xs font-black px-4 py-2 rounded-xl border-2 border-white shadow-xl ${positionInfo.color} ${positionInfo.glow} animate-pulse`}
        >
          <PositionIcon className="h-4 w-4" />
          <span>{positionInfo.label}</span>
        </div>
      )}

      {!isEditing ? (
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-4 mb-4">
              {img && (
                <div className="relative group">
                  <img
                    src={img || "/placeholder.svg"}
                    alt={prize.name}
                    className="w-24 h-24 object-cover rounded-xl border-2 border-indigo-200 shadow-lg group-hover:scale-110 transition-transform duration-300 ring-2 ring-indigo-100"
                  />
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-black/20 to-transparent" />
                </div>
              )}
              <div className="flex-1">
                <h4 className="font-black text-xl text-slate-900 mb-2 tracking-tight">{prize.name}</h4>
                {prize.description && <p className="text-slate-600 text-sm leading-relaxed">{prize.description}</p>}
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <span className="inline-flex items-center space-x-2 text-xs font-bold text-emerald-700 bg-emerald-50 border-2 border-emerald-200 rounded-xl px-4 py-2 shadow-md hover:shadow-lg transition-shadow">
                <Package className="h-4 w-4" />
                <span>Stock: {Number(prize.stock) || 0}</span>
              </span>
              {prize.is_active === false && (
                <span className="inline-flex items-center text-xs font-bold text-slate-600 bg-slate-100 border-2 border-slate-200 rounded-xl px-4 py-2 shadow-md">
                  Inactivo
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col space-y-2.5 ml-6">
            <button
              onClick={() => setIsEditing(true)}
              className="group p-3.5 text-slate-600 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50 rounded-xl transition-all duration-300 hover:shadow-lg border-2 border-slate-200 hover:border-indigo-200 hover:scale-110"
              title="Editar premio"
            >
              <Edit className="h-5 w-5 group-hover:scale-110 transition-transform duration-200" />
            </button>
            <button
              onClick={handleDelete}
              className="group p-3.5 text-slate-600 hover:text-red-600 bg-slate-50 hover:bg-red-50 rounded-xl transition-all duration-300 hover:shadow-lg border-2 border-slate-200 hover:border-red-200 hover:scale-110"
              title="Eliminar premio"
            >
              <Trash2 className="h-5 w-5 group-hover:scale-110 transition-transform duration-200" />
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleUpdate} className="space-y-5">
          <div>
            <input
              type="text"
              value={editForm.name}
              onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
              className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-semibold text-slate-900 transition-all"
              placeholder="Nombre del premio"
            />
          </div>

          <div>
            <textarea
              rows={3}
              value={editForm.description}
              onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
              className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-slate-800 resize-y overflow-auto max-h-48 transition-all"
              placeholder="Descripción del premio"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">Stock</label>
              <input
                type="number"
                min="0"
                value={editForm.stock}
                onChange={(e) => setEditForm((prev) => ({ ...prev, stock: Number(e.target.value) }))}
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none font-bold text-center transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">Orden</label>
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
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-4 focus:ring-purple-500/20 focus:border-purple-500 outline-none font-bold text-center transition-all"
                placeholder="Orden"
              />
            </div>
          </div>

          <div>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setEditForm((prev) => ({ ...prev, image: e.target.files?.[0] || null }))}
              className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none file:px-4 file:py-2 file:mr-4 file:rounded-lg file:border-0 file:cursor-pointer file:text-sm file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 transition-all"
            />
          </div>

          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="px-6 py-3 text-sm font-bold text-slate-700 bg-white border-2 border-slate-200 rounded-xl hover:bg-slate-50 focus:ring-4 focus:ring-slate-300/50 transition-all duration-200"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="inline-flex items-center px-6 py-3 text-sm font-bold rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-white focus:ring-4 focus:ring-blue-500/50 shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200"
            >
              <Save className="h-4 w-4 mr-2" />
              Guardar Cambios
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

export default PrizePanel
