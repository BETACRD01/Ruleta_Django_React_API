// src/App.jsx - ACTUALIZADO con ruta de reset password
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';

import Page from './pages/page';           
import Layout from './components/Layout';  
import AdminDashboard from './components/AdminDashboard';
import UserDashboard from './components/UserDashboard';
import TermsPage from './pages/TermsPage';
import PasswordResetForm from './components/auth/PasswordResetForm'; // ⬅️ IMPORTAR

import RouletteParticipate from './components/user/Ruletas Disponibles/RouletteParticipate';

// --- Guards simples ---
const RequireAuth = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-lg text-gray-600">Cargando sistema...</p>
      </div>
    </div>
  );
  return user ? children : <Navigate to="/" replace />;
};

const AppContent = () => {
  const { user, isAdmin } = useAuth();

  return (
    <Routes>
      {/* Página raíz: Page contiene Home + Login/Register */}
      <Route path="/" element={user ? <Navigate to="/dashboard" replace /> : <Page />} />

      {/* ⬅️ NUEVA RUTA PARA RESET PASSWORD */}
      <Route 
        path="/reset-password" 
        element={
          <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600">
            <PasswordResetForm onBackToLogin={() => window.location.href = '/'} />
          </div>
        } 
      />

      {/* Página pública de términos y condiciones */}
      <Route path="/terminos" element={<TermsPage />} />

      {/* Dashboard por rol */}
      <Route
        path="/dashboard"
        element={
          <RequireAuth>
            <Layout>
              {isAdmin ? <AdminDashboard /> : <UserDashboard />}
            </Layout>
          </RequireAuth>
        }
      />

      {/* Pantalla de participación */}
      <Route
        path="/ruletas/:id/participar"
        element={
          <RequireAuth>
            <Layout>
              <RouletteParticipate />
            </Layout>
          </RequireAuth>
        }
      />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

const App = () => {
  return (
    <div className="App">
      <NotificationProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </NotificationProvider>
    </div>
  );
};

export default App;