// src/components/settings/AccountSettingsPanel.jsx
import React, { useEffect, useState } from "react";
import { X, Save, Shield, Loader2 } from "lucide-react";
import { authAPI, notificationAPI, handleAPIError } from "../../config/api";
import "../../styles/AccountSettingsPanel.css";

const AccountSettingsPanel = ({ open, onClose, onSaved, isAdmin = false }) => {
  const [savingPwd, setSavingPwd] = useState(false);
  const [pwdErr, setPwdErr] = useState("");
  const [pwdOk, setPwdOk] = useState("");
  const [pwd, setPwd] = useState({ old_password: "", new_password: "", confirm: "" });

  // Preferencias de notificaciones (solo admin si tu backend lo expone)
  const [prefsLoading, setPrefsLoading] = useState(false);
  const [prefsSaving, setPrefsSaving] = useState(false);
  const [prefsErr, setPrefsErr] = useState("");
  const [prefsOk, setPrefsOk] = useState("");
  const [prefs, setPrefs] = useState({
    email_enabled: true,
    push_enabled: true,
    urgent_only: false,
  });

  useEffect(() => {
    const loadPrefs = async () => {
      if (!open || !isAdmin) return;
      try {
        setPrefsLoading(true);
        setPrefsErr("");
        const data = await notificationAPI.getAdminPreferences(); // /notifications/admin-preferences/
        setPrefs({
          email_enabled: !!data?.email_enabled,
          push_enabled: !!data?.push_enabled,
          urgent_only: !!data?.urgent_only,
        });
      } catch (e) {
        setPrefsErr(handleAPIError(e, "No se pudieron cargar las preferencias"));
      } finally {
        setPrefsLoading(false);
      }
    };
    loadPrefs();
  }, [open, isAdmin]);

  if (!open) return null;

  const savePassword = async (e) => {
    e.preventDefault();
    if (pwd.new_password !== pwd.confirm) {
      setPwdErr("La confirmación no coincide");
      return;
    }
    try {
      setPwdErr("");
      setPwdOk("");
      setSavingPwd(true);
      await authAPI.changePassword({
        old_password: pwd.old_password,
        new_password: pwd.new_password,
      }); // /auth/change-password/
      setPwdOk("Contraseña actualizada");
      setPwd({ old_password: "", new_password: "", confirm: "" });
      if (onSaved) onSaved();
    } catch (e) {
      setPwdErr(handleAPIError(e, "No se pudo cambiar la contraseña"));
    } finally {
      setSavingPwd(false);
    }
  };

  const savePrefs = async (e) => {
    e.preventDefault();
    try {
      setPrefsSaving(true);
      setPrefsErr("");
      setPrefsOk("");
      await notificationAPI.updateAdminPreferences(prefs); // PATCH
      setPrefsOk("Preferencias guardadas");
      if (onSaved) onSaved();
    } catch (e) {
      setPrefsErr(handleAPIError(e, "No se pudieron guardar las preferencias"));
    } finally {
      setPrefsSaving(false);
    }
  };

  return (
    <div className="account-settings-overlay">
      {/* backdrop */}
      <div className="account-settings-backdrop" onClick={onClose} />
      {/* panel */}
      <div className="account-settings-container">
        <div className="account-settings-header">
          <h2 className="account-settings-title">Configuración de la cuenta</h2>
          <button onClick={onClose} className="account-settings-close-btn">
            <X className="account-settings-btn-icon" />
          </button>
        </div>

        <div className="account-settings-content">
          {/* Seguridad / contraseña */}
          <section className="account-settings-section">
            <h3 className="account-settings-section-title">
              <Shield className="account-settings-section-icon" /> Seguridad
            </h3>

            <form onSubmit={savePassword} className="account-settings-form">
              {pwdErr && (
                <div className="account-settings-message account-settings-error">
                  {pwdErr}
                </div>
              )}
              {pwdOk && (
                <div className="account-settings-message account-settings-success">
                  {pwdOk}
                </div>
              )}

              <div className="account-settings-field">
                <label className="account-settings-label">Contraseña actual</label>
                <input
                  type="password"
                  value={pwd.old_password}
                  onChange={(e) => setPwd((p) => ({ ...p, old_password: e.target.value }))}
                  className="account-settings-input"
                  required
                />
              </div>
              <div className="account-settings-field">
                <label className="account-settings-label">Nueva contraseña</label>
                <input
                  type="password"
                  value={pwd.new_password}
                  onChange={(e) => setPwd((p) => ({ ...p, new_password: e.target.value }))}
                  className="account-settings-input"
                  required
                />
              </div>
              <div className="account-settings-field">
                <label className="account-settings-label">Confirmar nueva contraseña</label>
                <input
                  type="password"
                  value={pwd.confirm}
                  onChange={(e) => setPwd((p) => ({ ...p, confirm: e.target.value }))}
                  className="account-settings-input"
                  required
                />
              </div>

              <div className="account-settings-actions">
                <button
                  type="submit"
                  disabled={savingPwd}
                  className="account-settings-btn account-settings-btn-primary"
                >
                  {savingPwd ? (
                    <Loader2 className="account-settings-btn-icon account-settings-btn-icon-spin" />
                  ) : (
                    <Save className="account-settings-btn-icon" />
                  )}
                  Guardar contraseña
                </button>
              </div>
            </form>
          </section>

          {/* Preferencias de notificaciones (opcional para admin) */}
          {isAdmin && (
            <section className="account-settings-section">
              <h3 className="account-settings-section-title">Notificaciones (Admin)</h3>
              {prefsLoading ? (
                <div className="account-settings-loader">
                  <Loader2 className="account-settings-loader-icon" /> Cargando preferencias...
                </div>
              ) : (
                <form onSubmit={savePrefs} className="account-settings-form">
                  {prefsErr && (
                    <div className="account-settings-message account-settings-error">
                      {prefsErr}
                    </div>
                  )}
                  {prefsOk && (
                    <div className="account-settings-message account-settings-success">
                      {prefsOk}
                    </div>
                  )}

                  <label className="account-settings-checkbox-group">
                    <input
                      type="checkbox"
                      checked={prefs.email_enabled}
                      onChange={(e) => setPrefs((p) => ({ ...p, email_enabled: e.target.checked }))}
                      className="account-settings-checkbox"
                    />
                    <span className="account-settings-checkbox-label">Recibir por email</span>
                  </label>

                  <label className="account-settings-checkbox-group">
                    <input
                      type="checkbox"
                      checked={prefs.push_enabled}
                      onChange={(e) => setPrefs((p) => ({ ...p, push_enabled: e.target.checked }))}
                      className="account-settings-checkbox"
                    />
                    <span className="account-settings-checkbox-label">Recibir push</span>
                  </label>

                  <label className="account-settings-checkbox-group">
                    <input
                      type="checkbox"
                      checked={prefs.urgent_only}
                      onChange={(e) => setPrefs((p) => ({ ...p, urgent_only: e.target.checked }))}
                      className="account-settings-checkbox"
                    />
                    <span className="account-settings-checkbox-label">Solo urgentes</span>
                  </label>

                  <div className="account-settings-actions">
                    <button
                      type="submit"
                      disabled={prefsSaving}
                      className="account-settings-btn account-settings-btn-primary"
                    >
                      {prefsSaving ? (
                        <Loader2 className="account-settings-btn-icon account-settings-btn-icon-spin" />
                      ) : (
                        <Save className="account-settings-btn-icon" />
                      )}
                      Guardar preferencias
                    </button>
                  </div>
                </form>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
};

export default AccountSettingsPanel;