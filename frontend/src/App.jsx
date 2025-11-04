// src/App.jsx
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { PreferencesProvider } from './contexts/PreferencesContext';
import './styles/darkTheme.css';

// Pages & Components
import Page from './pages/page';
import Layout from './components/Layout';
import AdminDashboard from './components/AdminDashboard';
import UserDashboard from './components/UserDashboard';
import TermsPage from './pages/TermsPage';
import MissionVisionPage from './pages/MissionVisionPage';
import SupportPage from './pages/SupportPage';
import PasswordResetForm from './components/auth/PasswordResetForm';
import RouletteParticipate from './components/user/Ruletas Disponibles/RouletteParticipate';

// ============================================================================
// PROTECTED ROUTE GUARD
// ============================================================================
const RequireAuth = ({ children }) => {
  const { user, loading } = useAuth();
  
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
  
  return user ? children : <Navigate to="/" replace />;
};

// ============================================================================
// APP ROUTES
// ============================================================================
const AppContent = () => {
  const { user, isAdmin } = useAuth();
  
  return (
    <Routes>
      {/* ===== PUBLIC ROUTES ===== */}
      
      {/* Home: Redirige a dashboard si está autenticado */}
      <Route 
        path="/" 
        element={user ? <Navigate to="/dashboard" replace /> : <Page />} 
      />
      
      {/* Password Reset */}
      <Route 
        path="/reset-password" 
        element={
          <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600">
            <PasswordResetForm onBackToLogin={() => window.location.href = '/'} />
          </div>
        } 
      />
      
      {/* Info Pages */}
      <Route path="/terminos" element={<TermsPage />} />
      <Route path="/mision-vision" element={<MissionVisionPage />} />
      <Route path="/soporte" element={<SupportPage />} />
      
      {/* ===== PROTECTED ROUTES ===== */}
      
      {/* Dashboard - Redirect by role */}
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
      
      {/* Roulette Participation */}
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
      
      {/* ===== FALLBACK ===== */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

// ============================================================================
// MAIN APP COMPONENT
// ============================================================================
const App = () => {
  return (
    <div className="App">
      <NotificationProvider>
        <AuthProvider>
          <PreferencesProvider>
            <AppContent />
          </PreferencesProvider>
        </AuthProvider>
      </NotificationProvider>
    </div>
  );
};

export default App;