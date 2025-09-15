// src/App.jsx - ACTUALIZADO con notificaciones
import React from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import Home from './pages/Home'; // ✅ CAMBIAR: usar Home en lugar de LoginForm
import Layout from './components/Layout';
import AdminDashboard from './components/AdminDashboard';
import UserDashboard from './components/UserDashboard';

// Componente principal que maneja la lógica de navegación
const AppContent = () => {
  const { user, loading, isAdmin } = useAuth();

  // Mostrar loading mientras se inicializa
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-lg text-gray-600">Cargando sistema...</p>
        </div>
      </div>
    );
  }

  // Si no hay usuario autenticado, mostrar Home (que tiene el diseño bonito)
  if (!user) {
    return <Home />; // ✅ CAMBIAR: Home en lugar de LoginForm
  }

  // Usuario autenticado: mostrar dashboard correspondiente según rol
  return (
    <Layout>
      {isAdmin ? <AdminDashboard /> : <UserDashboard />}
    </Layout>
  );
};

// Componente App principal con providers
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