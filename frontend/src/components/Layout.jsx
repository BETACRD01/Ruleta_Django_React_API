// src/components/Layout.jsx
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  Trophy, Bell, User, LogOut, Settings, 
  Menu, X, Home, RotateCcw, Users, Award,
  ChevronDown, Search, Filter
} from 'lucide-react';

const Layout = ({ children }) => {
  const { user, logout, isAdmin, loading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  // Si está cargando, mostrar spinner
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  // Si no hay usuario, no renderizar nada (el AuthContext manejará la redirección)
  if (!user) {
    return null;
  }

  const handleLogout = async () => {
    await logout();
    setUserMenuOpen(false);
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo y título */}
            <div className="flex items-center">
              <button
                className="md:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
              
              <div className="flex items-center ml-2 md:ml-0">
                <div className="bg-blue-600 rounded-full p-2">
                  <Trophy className="h-6 w-6 text-white" />
                </div>
                <div className="ml-3">
                  <h1 className="text-xl font-bold text-gray-900">
                    Sistema de Ruletas
                  </h1>
                  <div className="flex items-center space-x-2">
                    {isAdmin && (
                      <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded-full font-medium">
                        ADMIN
                      </span>
                    )}
                    <span className="text-xs text-gray-500">
                      {user?.first_name} {user?.last_name}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Navegación Desktop */}
            <nav className="hidden md:flex space-x-8">
              {isAdmin ? (
                // Menú Admin
                <>
                  <NavLink icon={Home} text="Dashboard" active />
                  <NavLink icon={Settings} text="Ruletas" />
                  <NavLink icon={RotateCcw} text="Sorteos" />
                  <NavLink icon={Users} text="Usuarios" />
                  <NavLink icon={Award} text="Reportes" />
                </>
              ) : (
                // Menú Usuario Normal
                <>
                  <NavLink icon={Home} text="Inicio" active />
                  <NavLink icon={Trophy} text="Ruletas" />
                  <NavLink icon={User} text="Mis Participaciones" />
                  <NavLink icon={Award} text="Resultados" />
                </>
              )}
            </nav>

            {/* Acciones del usuario */}
            <div className="flex items-center space-x-4">
              {/* Búsqueda (solo desktop) */}
              <button className="hidden lg:flex items-center text-sm text-gray-500 hover:text-gray-700">
                <Search className="h-5 w-5 mr-1" />
                Buscar
              </button>

              {/* Notificaciones */}
              <div className="relative">
                <button
                  onClick={() => setNotificationsOpen(!notificationsOpen)}
                  className="relative p-2 text-gray-400 hover:text-gray-500 hover:bg-gray-100 rounded-full"
                >
                  <Bell className="h-6 w-6" />
                  {/* Contador de notificaciones */}
                  <span className="absolute top-1 right-1 block h-2 w-2 rounded-full bg-red-400 ring-2 ring-white"></span>
                </button>

                {/* Panel de notificaciones */}
                {notificationsOpen && (
                  <div className="origin-top-right absolute right-0 mt-2 w-80 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50">
                    <div className="p-4">
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="text-sm font-medium text-gray-900">Notificaciones</h3>
                        <span className="text-xs text-blue-600 cursor-pointer hover:text-blue-800">
                          Marcar como leídas
                        </span>
                      </div>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        <NotificationItem 
                          title="Nueva participación"
                          message="Tu participación en 'Ruleta Navidad' fue confirmada"
                          time="Hace 5 min"
                          unread
                        />
                        <NotificationItem 
                          title="Sorteo próximo"
                          message="El sorteo de 'Super Ruleta' será mañana a las 8 PM"
                          time="Hace 1 hora"
                        />
                        <NotificationItem 
                          title="¡Felicidades!"
                          message="Ganaste el premio en 'Ruleta Gaming'"
                          time="Hace 2 horas"
                        />
                      </div>
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <button className="text-xs text-blue-600 hover:text-blue-800">
                          Ver todas las notificaciones
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Menú de usuario */}
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <div className="h-8 w-8 rounded-full bg-gradient-to-r from-blue-400 to-blue-600 flex items-center justify-center">
                    <span className="text-white font-medium text-sm">
                      {user?.first_name?.charAt(0)}{user?.last_name?.charAt(0)}
                    </span>
                  </div>
                  <ChevronDown className="ml-1 h-4 w-4 text-gray-400" />
                </button>

                {/* Dropdown menú usuario */}
                {userMenuOpen && (
                  <div className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50">
                    <div className="py-1">
                      <div className="px-4 py-2 border-b border-gray-200">
                        <p className="text-sm font-medium text-gray-900">
                          {user?.first_name} {user?.last_name}
                        </p>
                        <p className="text-xs text-gray-500">{user?.email}</p>
                      </div>
                      
                      <button className="flex items-center w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                        <User className="mr-3 h-4 w-4" />
                        Mi Perfil
                      </button>
                      
                      <button className="flex items-center w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                        <Settings className="mr-3 h-4 w-4" />
                        Configuración
                      </button>
                      
                      <div className="border-t border-gray-200">
                        <button
                          onClick={handleLogout}
                          className="flex items-center w-full text-left px-4 py-2 text-sm text-red-700 hover:bg-red-50"
                        >
                          <LogOut className="mr-3 h-4 w-4" />
                          Cerrar Sesión
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Menú móvil */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 bg-white">
            <div className="px-2 pt-2 pb-3 space-y-1">
              {isAdmin ? (
                // Menú móvil Admin
                <>
                  <MobileNavLink icon={Home} text="Dashboard" active />
                  <MobileNavLink icon={Settings} text="Ruletas" />
                  <MobileNavLink icon={RotateCcw} text="Sorteos" />
                  <MobileNavLink icon={Users} text="Usuarios" />
                  <MobileNavLink icon={Award} text="Reportes" />
                </>
              ) : (
                // Menú móvil Usuario
                <>
                  <MobileNavLink icon={Home} text="Inicio" active />
                  <MobileNavLink icon={Trophy} text="Ruletas" />
                  <MobileNavLink icon={User} text="Mis Participaciones" />
                  <MobileNavLink icon={Award} text="Resultados" />
                </>
              )}
            </div>
            <div className="pt-4 pb-3 border-t border-gray-200">
              <div className="px-4 flex items-center">
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-r from-blue-400 to-blue-600 flex items-center justify-center">
                    <span className="text-white font-medium text-sm">
                      {user?.first_name?.charAt(0)}{user?.last_name?.charAt(0)}
                    </span>
                  </div>
                </div>
                <div className="ml-3">
                  <div className="text-base font-medium text-gray-800">
                    {user?.first_name} {user?.last_name}
                  </div>
                  <div className="text-sm text-gray-500">{user?.email}</div>
                </div>
              </div>
              <div className="mt-3 px-2 space-y-1">
                <button className="block px-3 py-2 text-base font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-md w-full text-left">
                  Mi Perfil
                </button>
                <button className="block px-3 py-2 text-base font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-md w-full text-left">
                  Configuración
                </button>
                <button
                  onClick={handleLogout}
                  className="block px-3 py-2 text-base font-medium text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md w-full text-left"
                >
                  Cerrar Sesión
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Contenido principal */}
      <main className="flex-1">
        {children}
      </main>

      {/* Click fuera para cerrar menús */}
      {(userMenuOpen || notificationsOpen || mobileMenuOpen) && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setUserMenuOpen(false);
            setNotificationsOpen(false);
            setMobileMenuOpen(false);
          }}
        />
      )}
    </div>
  );
};

// Componente para enlaces de navegación desktop
const NavLink = ({ icon: Icon, text, active = false, onClick }) => (
  <button
    onClick={onClick}
    className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
      active
        ? 'text-blue-700 bg-blue-50'
        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
    }`}
  >
    <Icon className="mr-1 h-4 w-4" />
    {text}
  </button>
);

// Componente para enlaces de navegación móvil
const MobileNavLink = ({ icon: Icon, text, active = false, onClick }) => (
  <button
    onClick={onClick}
    className={`flex items-center px-3 py-2 text-base font-medium rounded-md transition-colors w-full text-left ${
      active
        ? 'text-blue-700 bg-blue-50'
        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
    }`}
  >
    <Icon className="mr-3 h-5 w-5" />
    {text}
  </button>
);

// Componente para elementos de notificación
const NotificationItem = ({ title, message, time, unread = false }) => (
  <div className={`p-2 rounded-md transition-colors hover:bg-gray-50 ${unread ? 'bg-blue-50' : ''}`}>
    <div className="flex justify-between items-start">
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${unread ? 'text-blue-900' : 'text-gray-900'}`}>
          {title}
        </p>
        <p className="text-xs text-gray-500 mt-1">{message}</p>
      </div>
      {unread && <div className="w-2 h-2 bg-blue-600 rounded-full ml-2 mt-1 flex-shrink-0" />}
    </div>
    <p className="text-xs text-gray-400 mt-1">{time}</p>
  </div>
);

export default Layout;