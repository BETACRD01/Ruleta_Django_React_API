// src/components/settings/AccountSettingsPanel.jsx
import React, { useState } from 'react';
import { 
  X, Settings, Lock, Eye, EyeOff, Shield, 
  AlertTriangle, Check, Loader, Bell, Mail,
  Monitor, Moon, Sun, Globe, KeyRound
} from 'lucide-react';
import { useNotification } from '../../contexts/NotificationContext';
import { usePreferences } from '../../contexts/PreferencesContext'; // ✅ Importar
import { authAPI, setGlobalAuthToken } from '../../config/api';

const AccountSettingsPanel = ({ open, onClose, onSaved }) => {
  const { showSuccess, showError } = useNotification();
  const { preferences, updatePreference, savePreferences } = usePreferences(); // ✅ Usar contexto
  const [activeTab, setActiveTab] = useState('security');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // Password change state
  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({ ...prev, [name]: value }));
    setError(null);
    setSuccess(false);
  };

  const handlePreferenceChange = (key, value) => {
    updatePreference(key, value);
  };

  const validatePassword = () => {
    if (!passwordData.current_password) {
      throw new Error('Ingresa tu contraseña actual');
    }
    if (passwordData.new_password.length < 8) {
      throw new Error('La nueva contraseña debe tener al menos 8 caracteres');
    }
    if (passwordData.new_password !== passwordData.confirm_password) {
      throw new Error('Las contraseñas no coinciden');
    }
    if (passwordData.current_password === passwordData.new_password) {
      throw new Error('La nueva contraseña debe ser diferente a la actual');
    }

    // Validar complejidad
    const hasUpperCase = /[A-Z]/.test(passwordData.new_password);
    const hasLowerCase = /[a-z]/.test(passwordData.new_password);
    const hasNumbers = /\d/.test(passwordData.new_password);

    if (!hasUpperCase || !hasLowerCase || !hasNumbers) {
      throw new Error('La contraseña debe contener mayúsculas, minúsculas y números');
    }
  };

  const handleChangePassword = async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      validatePassword();

      const response = await authAPI.changePassword({
        current_password: passwordData.current_password,
        new_password: passwordData.new_password,
        confirm_password: passwordData.confirm_password
      });

      if (response?.success) {
        // IMPORTANTE: Actualizar el token si viene uno nuevo
        if (response.new_token) {
          setGlobalAuthToken(response.new_token);
          authAPI.setAuthToken(response.new_token);
        }

        setSuccess(true);
        
        // ✅ Mostrar notificación global
        showSuccess(
          'Tu contraseña ha sido actualizada correctamente. Se recomienda cerrar sesión y volver a iniciar.',
          'Contraseña cambiada exitosamente',
          { duration: 5000 }
        );

        setPasswordData({
          current_password: '',
          new_password: '',
          confirm_password: ''
        });

        setTimeout(() => {
          setSuccess(false);
          if (onSaved) onSaved();
        }, 2000);
      }
    } catch (err) {
      console.error('Error changing password:', err);
      
      // ✅ Mostrar error con notificación global
      let errorMessage = 'Error al cambiar la contraseña. Verifica tu contraseña actual.';
      
      if (err.message) {
        errorMessage = err.message;
      } else if (err.response?.data?.errors) {
        const errors = err.response.data.errors;
        errorMessage = Object.values(errors).flat().join('. ') || errorMessage;
      }
      
      setError(errorMessage);
      showError(errorMessage, 'Error al cambiar contraseña');
    } finally {
      setLoading(false);
    }
  };

  const handleSavePreferences = async () => {
    setLoading(true);
    try {
      await savePreferences(preferences);
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        if (onSaved) onSaved();
      }, 2000);
    } catch (error) {
      showError('Error al guardar preferencias', 'Error');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setError(null);
      setSuccess(false);
      setPasswordData({
        current_password: '',
        new_password: '',
        confirm_password: ''
      });
      onClose();
    }
  };

  if (!open) return null;

  const getPasswordStrength = (password) => {
    if (!password) return { strength: 0, label: '', color: '' };
    
    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) strength++;

    if (strength <= 2) return { strength, label: 'Débil', color: 'bg-red-500' };
    if (strength <= 3) return { strength, label: 'Media', color: 'bg-yellow-500' };
    if (strength <= 4) return { strength, label: 'Buena', color: 'bg-blue-500' };
    return { strength, label: 'Excelente', color: 'bg-green-500' };
  };

  const passwordStrength = getPasswordStrength(passwordData.new_password);

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
            <div className="h-10 w-10 rounded-full bg-gradient-to-r from-purple-400 to-purple-600 flex items-center justify-center">
              <Settings className="h-5 w-5 text-white" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Configuración</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            disabled={loading}
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 px-6">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab('security')}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'security'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Seguridad
              </div>
            </button>
            <button
              onClick={() => setActiveTab('preferences')}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'preferences'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <Monitor className="h-4 w-4" />
                Preferencias
              </div>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 flex items-start gap-2">
              <Check className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>
                {activeTab === 'security' 
                  ? 'Contraseña cambiada exitosamente'
                  : 'Preferencias guardadas exitosamente'
                }
              </span>
            </div>
          )}

          {/* Security Tab */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Lock className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <h3 className="font-medium text-blue-900 text-sm">Cambiar Contraseña</h3>
                    <p className="text-xs text-blue-700 mt-1">
                      Tu contraseña debe tener al menos 8 caracteres, incluir mayúsculas, minúsculas y números.
                    </p>
                  </div>
                </div>
              </div>

              {/* Current Password */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <KeyRound className="h-4 w-4" />
                  Contraseña Actual
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    name="current_password"
                    value={passwordData.current_password}
                    onChange={handlePasswordChange}
                    placeholder="Ingresa tu contraseña actual"
                    className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <Lock className="h-4 w-4" />
                  Nueva Contraseña
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    name="new_password"
                    value={passwordData.new_password}
                    onChange={handlePasswordChange}
                    placeholder="Ingresa tu nueva contraseña"
                    className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                {/* Password Strength Indicator */}
                {passwordData.new_password && (
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-gray-600">Fortaleza:</span>
                      <span className={`font-medium ${
                        passwordStrength.strength <= 2 ? 'text-red-600' :
                        passwordStrength.strength <= 3 ? 'text-yellow-600' :
                        passwordStrength.strength <= 4 ? 'text-blue-600' :
                        'text-green-600'
                      }`}>
                        {passwordStrength.label}
                      </span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-300 ${passwordStrength.color}`}
                        style={{ width: `${(passwordStrength.strength / 5) * 100}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <Lock className="h-4 w-4" />
                  Confirmar Nueva Contraseña
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    name="confirm_password"
                    value={passwordData.confirm_password}
                    onChange={handlePasswordChange}
                    placeholder="Confirma tu nueva contraseña"
                    className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Password Requirements */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Requisitos de contraseña:</h4>
                <ul className="space-y-1 text-xs text-gray-600">
                  <li className="flex items-center gap-2">
                    <div className={`h-1.5 w-1.5 rounded-full ${passwordData.new_password.length >= 8 ? 'bg-green-500' : 'bg-gray-300'}`} />
                    Al menos 8 caracteres
                  </li>
                  <li className="flex items-center gap-2">
                    <div className={`h-1.5 w-1.5 rounded-full ${/[A-Z]/.test(passwordData.new_password) ? 'bg-green-500' : 'bg-gray-300'}`} />
                    Una letra mayúscula
                  </li>
                  <li className="flex items-center gap-2">
                    <div className={`h-1.5 w-1.5 rounded-full ${/[a-z]/.test(passwordData.new_password) ? 'bg-green-500' : 'bg-gray-300'}`} />
                    Una letra minúscula
                  </li>
                  <li className="flex items-center gap-2">
                    <div className={`h-1.5 w-1.5 rounded-full ${/\d/.test(passwordData.new_password) ? 'bg-green-500' : 'bg-gray-300'}`} />
                    Un número
                  </li>
                  <li className="flex items-center gap-2">
                    <div className={`h-1.5 w-1.5 rounded-full ${passwordData.new_password === passwordData.confirm_password && passwordData.confirm_password ? 'bg-green-500' : 'bg-gray-300'}`} />
                    Las contraseñas coinciden
                  </li>
                </ul>
              </div>

              {/* Submit Button */}
              <button
                onClick={handleChangePassword}
                disabled={loading || !passwordData.current_password || !passwordData.new_password || !passwordData.confirm_password}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {loading ? (
                  <>
                    <Loader className="h-5 w-5 animate-spin" />
                    Cambiando contraseña...
                  </>
                ) : (
                  <>
                    <Lock className="h-5 w-5" />
                    Cambiar Contraseña
                  </>
                )}
              </button>
            </div>
          )}

          {/* Preferences Tab */}
          {activeTab === 'preferences' && (
            <div className="space-y-6">
              {/* Notifications Section */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Bell className="h-4 w-4" />
                  Notificaciones
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Mail className="h-4 w-4 text-gray-600" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Email</p>
                        <p className="text-xs text-gray-500">Recibir notificaciones por correo</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handlePreferenceChange('emailNotifications', !preferences.emailNotifications)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        preferences.emailNotifications ? 'bg-purple-600' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          preferences.emailNotifications ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Bell className="h-4 w-4 text-gray-600" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Push</p>
                        <p className="text-xs text-gray-500">Notificaciones en el navegador</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handlePreferenceChange('pushNotifications', !preferences.pushNotifications)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        preferences.pushNotifications ? 'bg-purple-600' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          preferences.pushNotifications ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>

              {/* Theme Section */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Monitor className="h-4 w-4" />
                  Apariencia
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => handlePreferenceChange('theme', 'light')}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      preferences.theme === 'light'
                        ? 'border-purple-600 bg-purple-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Sun className="h-5 w-5 mx-auto mb-1 text-gray-700" />
                    <p className="text-xs font-medium text-gray-900">Claro</p>
                  </button>

                  <button
                    onClick={() => handlePreferenceChange('theme', 'dark')}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      preferences.theme === 'dark'
                        ? 'border-purple-600 bg-purple-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Moon className="h-5 w-5 mx-auto mb-1 text-gray-700" />
                    <p className="text-xs font-medium text-gray-900">Oscuro</p>
                  </button>

                  <button
                    onClick={() => handlePreferenceChange('theme', 'auto')}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      preferences.theme === 'auto'
                        ? 'border-purple-600 bg-purple-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Monitor className="h-5 w-5 mx-auto mb-1 text-gray-700" />
                    <p className="text-xs font-medium text-gray-900">Auto</p>
                  </button>
                </div>
              </div>

              {/* Language Section */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  Idioma
                </h3>
                <select
                  value={preferences.language}
                  onChange={(e) => handlePreferenceChange('language', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="es">Español</option>
                  <option value="en">English</option>
                  <option value="pt">Português</option>
                </select>
              </div>

              {/* Save Button */}
              <button
                onClick={handleSavePreferences}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader className="h-5 w-5 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Check className="h-5 w-5" />
                    Guardar Preferencias
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

export default AccountSettingsPanel;