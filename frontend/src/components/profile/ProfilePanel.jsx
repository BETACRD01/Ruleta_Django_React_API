// src/components/profile/ProfilePanel.jsx
import React, { useEffect, useState, useCallback } from "react";
import { X, Save, Loader2 } from "lucide-react";
import { authAPI, handleAPIError } from "../../config/api";
import "../../styles/ProfilePanel.css";

const ProfilePanel = ({ open, onClose, onSaved }) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    username: "",
    email: "",
    phone: "",
  });

  const loadProfile = useCallback(async () => {
    if (!open) return;
    try {
      setLoading(true);
      setError("");
      const detail = await authAPI.getProfileDetail(); // /auth/profile/detail/
      // Campos comunes y seguros
      setForm({
        first_name: detail?.first_name || "",
        last_name: detail?.last_name || "",
        username: detail?.username || "",
        email: detail?.email || "",
        phone: detail?.phone || "",
      });
    } catch (e) {
      setError(handleAPIError(e, "No se pudo cargar el perfil"));
    } finally {
      setLoading(false);
    }
  }, [open]);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError("");
      // /auth/profile/ PUT (JSON)
      await authAPI.updateProfile({
        first_name: form.first_name,
        last_name: form.last_name,
        username: form.username,
        phone: form.phone,
        // email normalmente es de solo lectura desde backend; si tu API permite actualizarlo, agrega form.email
      });
      if (onSaved) onSaved();
      onClose();
    } catch (e) {
      setError(handleAPIError(e, "No se pudo guardar el perfil"));
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="profile-panel-overlay">
      {/* backdrop */}
      <div className="profile-panel-backdrop" onClick={onClose} />
      {/* panel */}
      <div className="profile-panel-container">
        <div className="profile-panel-header">
          <h2 className="profile-panel-title">Mi Perfil</h2>
          <button onClick={onClose} className="profile-panel-close-btn">
            <X className="profile-panel-btn-icon" />
          </button>
        </div>

        <div className="profile-panel-content">
          {loading ? (
            <div className="profile-panel-loader">
              <Loader2 className="profile-panel-loader-icon" /> Cargando perfil...
            </div>
          ) : (
            <form onSubmit={onSubmit} className="profile-panel-form">
              {error && (
                <div className="profile-panel-error">
                  {error}
                </div>
              )}

              <div className="profile-panel-grid">
                <div className="profile-panel-field">
                  <label className="profile-panel-label">Nombres</label>
                  <input
                    name="first_name"
                    value={form.first_name}
                    onChange={onChange}
                    className="profile-panel-input"
                    placeholder="Tu nombre"
                  />
                </div>
                <div className="profile-panel-field">
                  <label className="profile-panel-label">Apellidos</label>
                  <input
                    name="last_name"
                    value={form.last_name}
                    onChange={onChange}
                    className="profile-panel-input"
                    placeholder="Tus apellidos"
                  />
                </div>
                <div className="profile-panel-field">
                  <label className="profile-panel-label">Usuario</label>
                  <input
                    name="username"
                    value={form.username}
                    onChange={onChange}
                    className="profile-panel-input"
                    placeholder="usuario"
                  />
                </div>
                <div className="profile-panel-field">
                  <label className="profile-panel-label">Email</label>
                  <input
                    name="email"
                    value={form.email}
                    readOnly
                    className="profile-panel-input"
                  />
                  <p className="profile-panel-input-note">
                    (El email suele ser de solo lectura)
                  </p>
                </div>
                <div className="profile-panel-field profile-panel-field-full">
                  <label className="profile-panel-label">Teléfono</label>
                  <input
                    name="phone"
                    value={form.phone}
                    onChange={onChange}
                    className="profile-panel-input"
                    placeholder="+593 ..."
                  />
                </div>
              </div>

              <div className="profile-panel-actions">
                <button
                  type="button"
                  onClick={onClose}
                  className="profile-panel-btn profile-panel-btn-secondary"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="profile-panel-btn profile-panel-btn-primary"
                >
                  {saving ? (
                    <Loader2 className="profile-panel-btn-icon profile-panel-btn-icon-spin" />
                  ) : (
                    <Save className="profile-panel-btn-icon" />
                  )}
                  Guardar cambios
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfilePanel;