// src/contexts/PreferencesContext.jsx
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNotification } from './NotificationContext';

const PreferencesContext = createContext();

export const PreferencesProvider = ({ children }) => {
  const { showSuccess } = useNotification();
  
  // Función para aplicar el tema (definida primero)
  const applyTheme = useCallback((theme) => {
    const root = document.documentElement;
    
    if (theme === 'dark') {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
    } else if (theme === 'light') {
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
    } else if (theme === 'auto') {
      // Detectar preferencia del sistema
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        root.classList.add('dark');
        root.style.colorScheme = 'dark';
      } else {
        root.classList.remove('dark');
        root.style.colorScheme = 'light';
      }
    }
  }, []);
  
  // Cargar preferencias guardadas o usar valores por defecto
  const [preferences, setPreferences] = useState(() => {
    try {
      const saved = localStorage.getItem('userPreferences');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (error) {
      console.error('Error al cargar preferencias:', error);
    }
    
    return {
      theme: 'light',
      language: 'es',
      emailNotifications: true,
      pushNotifications: true
    };
  });

  // Aplicar tema al cargar
  useEffect(() => {
    applyTheme(preferences.theme);
  }, [applyTheme, preferences.theme]);

  // Actualizar una preferencia individual
  const updatePreference = useCallback((key, value) => {
    setPreferences(prev => {
      const updated = { ...prev, [key]: value };
      
      // Guardar en localStorage
      try {
        localStorage.setItem('userPreferences', JSON.stringify(updated));
      } catch (error) {
        console.error('Error al guardar preferencias:', error);
      }
      
      // Si es el tema, aplicarlo inmediatamente
      if (key === 'theme') {
        applyTheme(value);
      }
      
      return updated;
    });
  }, [applyTheme]);

  // Actualizar múltiples preferencias a la vez
  const updatePreferences = useCallback((newPreferences) => {
    setPreferences(prev => {
      const updated = { ...prev, ...newPreferences };
      
      // Guardar en localStorage
      try {
        localStorage.setItem('userPreferences', JSON.stringify(updated));
      } catch (error) {
        console.error('Error al guardar preferencias:', error);
      }
      
      // Si cambió el tema, aplicarlo
      if (newPreferences.theme && newPreferences.theme !== prev.theme) {
        applyTheme(newPreferences.theme);
      }
      
      return updated;
    });
  }, [applyTheme]);

  // Guardar preferencias (puede conectarse al backend después)
  const savePreferences = useCallback(async (prefsToSave) => {
    try {
      updatePreferences(prefsToSave);
      
      // TODO: Aquí puedes agregar la llamada al backend
      // await authAPI.updatePreferences(prefsToSave);
      
      showSuccess(
        'Tus preferencias han sido guardadas correctamente',
        'Preferencias actualizadas'
      );
      
      return { success: true };
    } catch (error) {
      console.error('Error al guardar preferencias:', error);
      return { success: false, error: error.message };
    }
  }, [updatePreferences, showSuccess]);

  // Resetear a valores por defecto
  const resetPreferences = useCallback(() => {
    const defaults = {
      theme: 'light',
      language: 'es',
      emailNotifications: true,
      pushNotifications: true
    };
    
    updatePreferences(defaults);
    showSuccess('Preferencias restauradas a valores por defecto', 'Preferencias reseteadas');
  }, [updatePreferences, showSuccess]);

  // Escuchar cambios en la preferencia del sistema (para tema auto)
  useEffect(() => {
    if (preferences.theme === 'auto') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      
      const handleChange = (e) => {
        applyTheme('auto');
      };
      
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [preferences.theme, applyTheme]);

  const value = {
    preferences,
    updatePreference,
    updatePreferences,
    savePreferences,
    resetPreferences,
    
    // Helpers útiles
    isDarkMode: preferences.theme === 'dark' || 
                (preferences.theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches),
    currentLanguage: preferences.language,
    notificationsEnabled: preferences.emailNotifications || preferences.pushNotifications
  };

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
};

export const usePreferences = () => {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error('usePreferences debe usarse dentro de PreferencesProvider');
  }
  return context;
};

export default PreferencesContext;