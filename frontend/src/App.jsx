// src/App.jsx
import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { NotificationProvider, useNotification } from "./contexts/NotificationContext";
import APIClient, { notificationManager } from "./config/api";

import Home from "./pages/Home";
import Layout from "./components/Layout";
import AdminDashboard from "./components/AdminDashboard";
import UserDashboard from "./components/UserDashboard";
import RouletteSpinPage from "./components/admin/RouletteSpinPage";
import RouletteParticipate from "./components/user/Ruletas Disponibles/RouletteParticipate";

function AppBootstrap() {
  const { showInfo, showError } = useNotification();

  React.useEffect(() => {
    APIClient.init({
      enableNotificationPolling: true,
      notificationPollInterval: 15000,
    });

    // Escucha eventos del manager y muéstralos como toasts
    const off = notificationManager.addListener((event, data) => {
      if (event === "refresh") {
        const n = data?.results?.[0];
        if (n) showInfo(n.title || "Nueva notificación", n.message || n.body || "");
      }
      if (event === "error") {
        showError("No se pudieron cargar notificaciones del servidor", "Notificaciones");
      }
    });

    return off;
  }, [showInfo, showError]);

  return null;
}

const RequireAuth = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-lg text-gray-600">Cargando sistema...</p>
        </div>
      </div>
    );
  }
  return user ? children : <Navigate to="/" replace />;
};

const RequireAdmin = ({ children }) => {
  const { user, isAdmin, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-lg text-gray-600">Verificando permisos...</p>
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/" replace />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return children;
};

const AppContent = () => {
  const { user, isAdmin } = useAuth();
  return (
    <Routes>
      <Route path="/" element={user ? <Navigate to="/dashboard" replace /> : <Home />} />
      <Route
        path="/dashboard"
        element={
          <RequireAuth>
            <Layout>{isAdmin ? <AdminDashboard /> : <UserDashboard />}</Layout>
          </RequireAuth>
        }
      />
      <Route
        path="/roulettes/:id/participate"
        element={
          <RequireAuth>
            <Layout><RouletteParticipate /></Layout>
          </RequireAuth>
        }
      />
      <Route
        path="/admin/roulettes/:id/spin"
        element={
          <RequireAdmin>
            <Layout><RouletteSpinPage /></Layout>
          </RequireAdmin>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

const App = () => (
  <NotificationProvider>
    <AuthProvider>
      <AppBootstrap />
      <AppContent />
    </AuthProvider>
  </NotificationProvider>
);

export default App;
