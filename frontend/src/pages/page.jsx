// src/pages/Page.jsx
import React, { useState, useCallback } from "react";
import { Link } from "react-router-dom";
import Home from "./Home";
import { LogIn, UserPlus, ArrowLeft } from "lucide-react";

// Componentes de autenticación
import LoginForm from "../components/auth/LoginForm";
import RegisterForm from "../components/auth/RegisterForm";

// Logo
import logo from "../assets/HAYU24_original.png";

export default function Page() {
  const [activeView, setActiveView] = useState("home");

  const handleLoginSuccess = useCallback((userData) => {
    console.log("Usuario logueado exitosamente:", userData);
    setActiveView("home");
  }, []);

  const handleRegisterSuccess = useCallback((userData) => {
    console.log("Usuario registrado exitosamente:", userData);
    setActiveView("home");
  }, []);

  const switchToLogin = useCallback(() => setActiveView("login"), []);
  const switchToRegister = useCallback(() => setActiveView("register"), []);
  const backToHome = useCallback(() => setActiveView("home"), []);

  if (activeView === "login") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-teal-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <button
            onClick={backToHome}
            className="mb-6 inline-flex items-center gap-2 text-gray-600 hover:text-red-600 font-medium transition-colors duration-200 group"
          >
            <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform duration-200" />
            Volver al inicio
          </button>
          <LoginForm onSuccess={handleLoginSuccess} onSwitchToRegister={switchToRegister} />
        </div>
      </div>
    );
  }

  if (activeView === "register") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-blue-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <button
            onClick={backToHome}
            className="mb-6 inline-flex items-center gap-2 text-gray-600 hover:text-red-600 font-medium transition-colors duration-200 group"
          >
            <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform duration-200" />
            Volver al inicio
          </button>
          <RegisterForm onSuccess={handleRegisterSuccess} onSwitchToLogin={switchToLogin} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="sticky top-0 z-40 w-full bg-white/90 backdrop-blur-md border-b border-gray-200 shadow-sm">
        <div className="mx-auto max-w-7xl px-3 sm:px-5 lg:px-8 h-20 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 min-w-0 group" aria-label="Ir al inicio">
            <img
              src={logo}
              alt="Hayu24 Logo"
              className="h-14 sm:h-16 md:h-20 w-auto object-contain select-none shrink-0 transition-transform duration-300 group-hover:scale-105 md:group-hover:scale-110"
              draggable="false"
              loading="eager"
              decoding="async"
            />
          </Link>

          <nav className="flex items-center gap-2 sm:gap-3" aria-label="Acciones de usuario">
            <button
              onClick={switchToLogin}
              className="inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold px-3 py-2.5 sm:px-4 sm:py-2.5 text-red-600 hover:text-red-700 hover:bg-red-50 border border-transparent hover:border-red-200 transition-all duration-200 active:scale-95"
              aria-label="Ingresar a tu cuenta"
            >
              <LogIn size={18} className="shrink-0" />
              <span>Ingresar</span>
            </button>

            <button
              onClick={switchToRegister}
              className="inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold px-3 py-2.5 sm:px-4 sm:py-2.5 text-white bg-teal-600 hover:bg-teal-700 shadow-sm hover:shadow-md transition-all duration-200 active:scale-95"
              aria-label="Crear cuenta nueva"
            >
              <UserPlus size={18} className="shrink-0" />
              <span>Registrarse</span>
            </button>
          </nav>
        </div>
      </header>

      <main id="inicio" className="flex-1">
        <Home />
      </main>

      <footer className="border-t border-gray-200 bg-gray-100">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid gap-6 sm:flex sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <img src={logo} alt="Hayu24" className="h-8 w-auto object-contain" draggable="false" />
              <div className="text-sm">
                <span className="text-gray-700 font-medium">© {new Date().getFullYear()} Hayu24</span>
                <span className="text-gray-500 ml-1">Todos los derechos reservados</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-sm">
              <Link to="/terminos" className="text-gray-600 hover:text-red-600 font-medium transition-colors duration-200">
                Términos y Condiciones
              </Link>
              <Link to="/mision-vision" className="text-gray-600 hover:text-red-600 font-medium transition-colors duration-200">
                Misión y Visión
              </Link>
              <Link to="/soporte" className="text-gray-600 hover:text-red-600 font-medium transition-colors duration-200">
                Soporte
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}