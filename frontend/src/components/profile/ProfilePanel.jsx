// src/components/profile/ProfilePanel.jsx
import React, { useState, useEffect } from 'react';
import { X, User, Mail, Phone, Calendar, FileText, Camera, Save, Loader, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { authAPI, resolveMediaUrl } from '../../config/api';

const ProfilePanel = ({ open, onClose, onSaved }) => {
  const { user, updateUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);

  const [formData, setFormData] = useState({
    username: '',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    bio: '',
    birth_date: ''
  });

  useEffect(() => {
    if (open && user) {
      loadProfileData();
    }
  }, [open, user]);

  const loadProfileData = async () => {
    try {
      setLoading(true);
      setError(null);
      const profileData = await authAPI.getProfileDetail();
      
      setFormData({
        username: profileData.username || '',
        first_name: profileData.first_name || '',
        last_name: profileData.last_name || '',
        email: profileData.email || '',
        phone: profileData.profile?.phone || '',
        bio: profileData.profile?.bio || '',
        birth_date: profileData.profile?.birth_date || ''
      });

      if (profileData.profile?.avatar) {
        setAvatarPreview(resolveMediaUrl(profileData.profile.avatar));
      }
    } catch (err) {
      console.error('Error loading profile:', err);
      setError('Error al cargar el perfil');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError(null);
    setSuccess(false);
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validar tamaño (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('La imagen no debe superar 5MB');
        return;
      }

      // Validar tipo
      if (!file.type.startsWith('image/')) {
        setError('Solo se permiten imágenes');
        return;
      }

      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
      setError(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      // Validaciones básicas
      if (!formData.first_name.trim() || !formData.last_name.trim()) {
        throw new Error('Nombre y apellido son obligatorios');
      }

      // Validar teléfono si está presente
      if (formData.phone && !formData.phone.startsWith('+')) {
        throw new Error('El teléfono debe incluir el código de país (ej: +593)');
      }

      // Preparar datos - USAR authAPI con multipart
      const updateData = {
        username: formData.username,
        first_name: formData.first_name,
        last_name: formData.last_name,
      };

      // Agregar campos opcionales solo si tienen valor
      if (formData.phone) {
        updateData.phone = formData.phone;
      }
      if (formData.bio) {
        updateData.bio = formData.bio;
      }
      if (formData.birth_date) {
        updateData.birth_date = formData.birth_date;
      }

      // Agregar avatar si se seleccionó uno nuevo
      if (avatarFile) {
        updateData.avatar = avatarFile;
      }

      // Usar authAPI.updateProfile que ya maneja multipart correctamente
      const result = await authAPI.updateProfile(updateData);
      
      setSuccess(true);
      if (updateUser) {
        updateUser(result);
      }
      
      // Limpiar el archivo temporal
      setAvatarFile(null);
      
      setTimeout(() => {
        if (onSaved) onSaved();
        setSuccess(false);
      }, 2000);
    } catch (err) {
      console.error('Error updating profile:', err);
      setError(err.message || 'Error al actualizar el perfil');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setError(null);
      setSuccess(false);
      setAvatarFile(null);
      onClose();
    }
  };

  if (!open) return null;

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-50 transition-opacity"
        onClick={handleClose}
      />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 w-full sm:w-96 bg-white shadow-2xl z-50 transform transition-transform overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-400 to-blue-600 flex items-center justify-center">
              <User className="h-5 w-5 text-white" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Mi Perfil</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            disabled={loading}
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
              Perfil actualizado exitosamente
            </div>
          )}

          {loading && !success ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader className="h-8 w-8 text-blue-600 animate-spin mb-3" />
              <p className="text-gray-600">Cargando perfil...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Avatar */}
              <div className="flex flex-col items-center">
                <div className="relative">
                  <div className="h-24 w-24 rounded-full bg-gradient-to-r from-blue-400 to-blue-600 flex items-center justify-center overflow-hidden border-4 border-white shadow-lg">
                    {avatarPreview ? (
                      <img 
                        src={avatarPreview} 
                        alt="Avatar" 
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          e.target.onerror = null;
                          setAvatarPreview(null);
                        }}
                      />
                    ) : (
                      <span className="text-white font-semibold text-2xl">
                        {formData.first_name?.[0]}{formData.last_name?.[0]}
                      </span>
                    )}
                  </div>
                  <label className="absolute bottom-0 right-0 h-8 w-8 bg-blue-600 rounded-full flex items-center justify-center cursor-pointer hover:bg-blue-700 transition-colors shadow-lg border-2 border-white">
                    <Camera className="h-4 w-4 text-white" />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarChange}
                      className="hidden"
                      disabled={loading}
                    />
                  </label>
                </div>
                <p className="mt-2 text-xs text-gray-500 text-center">
                  Haz clic en el ícono para cambiar tu foto<br />
                  Máximo 5MB (JPG, PNG, GIF)
                </p>
                {avatarFile && (
                  <p className="mt-1 text-xs text-blue-600 font-medium">
                    Nueva imagen seleccionada: {avatarFile.name}
                  </p>
                )}
              </div>

              {/* Username */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <User className="h-4 w-4" />
                  Nombre de usuario
                </label>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={loading}
                  required
                />
              </div>

              {/* First Name */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <User className="h-4 w-4" />
                  Nombre
                </label>
                <input
                  type="text"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={loading}
                  required
                />
              </div>

              {/* Last Name */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <User className="h-4 w-4" />
                  Apellido
                </label>
                <input
                  type="text"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={loading}
                  required
                />
              </div>

              {/* Email (read-only) */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <Mail className="h-4 w-4" />
                  Correo electrónico
                </label>
                <input
                  type="email"
                  value={formData.email}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed"
                  disabled
                />
                <p className="mt-1 text-xs text-gray-500">
                  El correo no se puede modificar
                </p>
              </div>

              {/* Phone */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <Phone className="h-4 w-4" />
                  Teléfono
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+593987654321"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={loading}
                />
                <p className="mt-1 text-xs text-gray-500">
                  Incluye el código de país (ej: +593)
                </p>
              </div>

              {/* Birth Date */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <Calendar className="h-4 w-4" />
                  Fecha de nacimiento
                </label>
                <input
                  type="date"
                  name="birth_date"
                  value={formData.birth_date}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={loading}
                />
              </div>

              {/* Bio */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <FileText className="h-4 w-4" />
                  Biografía
                </label>
                <textarea
                  name="bio"
                  value={formData.bio}
                  onChange={handleChange}
                  rows={4}
                  maxLength={500}
                  placeholder="Cuéntanos algo sobre ti..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  disabled={loading}
                />
                <p className="mt-1 text-xs text-gray-500 text-right">
                  {formData.bio.length}/500
                </p>
              </div>

              {/* Submit Button */}
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {loading ? (
                  <>
                    <Loader className="h-5 w-5 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="h-5 w-5" />
                    Guardar Cambios
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default ProfilePanel;