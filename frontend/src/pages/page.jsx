// src/pages/Page.jsx
import React, { useState } from "react";
import { Link } from "react-router-dom";
import Home from "./Home";
import { LogIn, UserPlus } from "lucide-react";

// ✨ Importar tus componentes existentes
import LoginForm from "../components/auth/LoginForm";
import RegisterForm from "../components/auth/RegisterForm";

// Tu logo
import logo from "../assets/HAYU24_original.png";

export default function Page() {
  const [active, setActive] = useState("login");
  // ✨ Estados para controlar qué mostrar
  const [showLoginForm, setShowLoginForm] = useState(false);
  const [showRegisterForm, setShowRegisterForm] = useState(false);

  // ✨ Función para manejar login exitoso
  const handleLoginSuccess = (userData) => {
    console.log("Usuario logueado exitosamente:", userData);
    setShowLoginForm(false);
    // Redirigir / guardar en contexto / mostrar toast...
  };

  // ✨ Función para manejar registro exitoso
  const handleRegisterSuccess = (userData) => {
    console.log("Usuario registrado exitosamente:", userData);
    setShowRegisterForm(false);
    // Redirigir / etc.
  };

  // ✨ Si está mostrando formulario de login
  if (showLoginForm) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Botón para volver */}
          <button
            onClick={() => setShowLoginForm(false)}
            className="mb-4 text-red-600 hover:text-red-700 flex items-center gap-2"
          >
            ← Volver al inicio
          </button>

          {/* Tu LoginForm existente */}
          <LoginForm
            onSuccess={handleLoginSuccess}
            onSwitchToRegister={() => {
              setShowLoginForm(false);
              setShowRegisterForm(true);
            }}
          />
        </div>
      </div>
    );
  }

  // ✨ Si está mostrando formulario de registro
  if (showRegisterForm) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <button
            onClick={() => setShowRegisterForm(false)}
            className="mb-4 text-red-600 hover:text-red-700 flex items-center gap-2"
          >
            ← Volver al inicio
          </button>

          {/* Tu RegisterForm existente */}
          <RegisterForm
            onSuccess={handleRegisterSuccess}
            onSwitchToLogin={() => {
              setShowRegisterForm(false);
              setShowLoginForm(true);
            }}
          />
        </div>
      </div>
    );
  }

  // ✨ Página principal (EXACTAMENTE como te funciona)
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* HEADER */}
      <header className="sticky top-0 z-40 w-full bg-white/80 backdrop-blur border-b">
        {/* Altura del header a h-20 para que respire el logo grande */}
        <div className="mx-auto max-w-7xl px-3 sm:px-5 lg:px-8 h-20 flex items-center justify-between">
          {/* Logo (mismo tamaño que en Layout.jsx) */}
          <Link to="/" className="flex items-center gap-3 min-w-0">
            <img
              src={logo}
              alt="Hayu24 Logo"
              className="h-14 sm:h-16 md:h-20 w-auto object-contain select-none shrink-0 transition-all duration-300 hover:scale-105 md:hover:scale-110"
              draggable="false"
              loading="eager"
              decoding="async"
            />
          </Link>

          {/* Acciones - usar tus formularios */}
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => {
                setActive("login");
                setShowLoginForm(true);
              }}
              aria-pressed={active === "login"}
              className={`inline-flex items-center rounded-lg text-sm font-semibold px-3 py-2 sm:px-4 transition-all duration-200 ${
                active === "login"
                  ? "text-red-600 bg-red-50 border border-red-200"
                  : "text-red-600 hover:bg-red-50 hover:border-red-200 border border-transparent"
              }`}
              title="Ingresar"
            >
              <LogIn size={18} className="sm:mr-1" />
              <span className="hidden sm:inline">Ingresar</span>
            </button>

            <button
              onClick={() => {
                setActive("register");
                setShowRegisterForm(true);
              }}
              aria-pressed={active === "register"}
              className={`inline-flex items-center rounded-lg text-sm font-semibold px-3 py-2 sm:px-4 shadow-sm transition-all duration-200 ${
                active === "register"
                  ? "text-white bg-teal-700 shadow-md"
                  : "text-white bg-teal-600 hover:bg-teal-700 hover:shadow-md"
              }`}
              title="Registrarse"
            >
              <UserPlus size={18} className="sm:mr-1" />
              <span className="hidden sm:inline">Registrarse</span>
            </button>
          </div>
        </div>
      </header>

      {/* CONTENIDO: HOME PÚBLICO */}
      <main id="inicio" className="flex-1">
        <Home />
      </main>

      {/* FOOTER */}
      <footer className="border-t bg-gray-100">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 grid gap-4 sm:flex sm:items-center sm:justify-between text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <img
              src={logo}
              alt="LuckySpin"
              className="h-6 w-auto object-contain"
              draggable="false"
            />
            <span className="text-gray-700 font-medium">
              © {new Date().getFullYear()}{" "}
              <span className="text-gray-500">Todos los derechos reservados.</span>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <Link
              to="/terminos"
              className="hover:text-red-600 transition-colors duration-200"
            >
              Términos y Condiciones
            </Link>
            <a
              href="mailto:soporte@luckyspin.com"
              className="hover:text-red-600 transition-colors duration-200"
            >
              Soporte
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
