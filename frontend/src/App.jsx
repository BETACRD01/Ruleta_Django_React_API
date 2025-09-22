// src/App.jsx - ACTUALIZADO con Router + rutas protegidas
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';

import Home from './pages/Home';           // pantalla pública
import Layout from './components/Layout';  // layout común (navbar, etc.)
import AdminDashboard from './components/AdminDashboard';
import UserDashboard from './components/UserDashboard';

// IMPORT con espacios en la ruta del archivo:
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
      {/* Pública: Home si no hay sesión; si hay sesión, manda al dashboard */}
      <Route path="/" element={user ? <Navigate to="/dashboard" replace /> : <Home />} />

      {/* Dashboard por rol dentro del Layout */}
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

      {/* Pantalla de participación (requiere login) */}
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
