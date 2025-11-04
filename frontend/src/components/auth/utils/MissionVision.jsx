import React from "react";
import { ArrowLeft, Target, Eye, Heart, Shield, Users, Award, TrendingUp, CheckCircle } from "lucide-react";
import logo from "../../../assets/HAYU24_original.png";

export default function MissionVision({ onBack = () => {}, isFullPage = false }) {
  const lastUpdated = "13 de febrero de 2024";

  const handleBackClick = () => {
    if (isFullPage) {
      if (window.history.length > 1) window.history.back();
      else window.close();
    } else {
      onBack();
    }
  };

  const containerClasses = isFullPage
    ? "min-h-screen py-8 px-4" 
    : "w-full max-w-5xl mx-auto bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden";

  const valores = [
    { icon: Heart, name: "Solidaridad", description: "Compromiso con el apoyo mutuo y la ayuda comunitaria" },
    { icon: Shield, name: "Transparencia", description: "Operaciones claras y honestas en todos nuestros procesos" },
    { icon: CheckCircle, name: "Equidad", description: "Oportunidades justas e iguales para todos los participantes" },
    { icon: Award, name: "Responsabilidad", description: "Cumplimiento de nuestros compromisos con la comunidad" },
    { icon: Users, name: "Compromiso con la Comunidad", description: "Dedicación al bienestar y desarrollo social" },
    { icon: TrendingUp, name: "Impacto Positivo", description: "Generación de cambios beneficiosos en la sociedad" }
  ];

  return (
    <div className={containerClasses} style={{ 
      background: isFullPage ? "#f8f9fa" : "transparent"
    }}>
      <div className={isFullPage ? "max-w-5xl mx-auto bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden" : ""}>
        {/* Header */}
        <div style={{ background: "linear-gradient(135deg, #0b56a7 0%, #207ba8 100%)" }} className="text-white px-8 py-6">
          <button
            type="button"
            onClick={handleBackClick}
            className="inline-flex items-center gap-2 text-white hover:text-gray-100 transition-all mb-4 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 rounded-lg px-3 py-2 hover:bg-white/10"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="font-medium">Volver</span>
          </button>
          
          <div className="flex items-start gap-4">
            <div className="rounded-lg px-4 py-2 bg-white/95 backdrop-blur-sm">
              <img 
                src={logo} 
                alt="HAYU24 Logo" 
                className="h-14 w-auto object-contain"
                draggable="false"
              />
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold mb-1">Misión y Visión</h1>
              <p className="text-gray-100 text-base">Sistema de rifas en línea HAYU24</p>
              <p className="text-gray-200 text-sm mt-1">Última actualización: {lastUpdated}</p>
            </div>
          </div>
        </div>

        {/* Contenido Principal */}
        <div className="px-8 py-8" style={{ backgroundColor: "#fafafa" }}>
          {/* Misión */}
          <section className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="rounded-lg p-2.5" style={{ background: "#389fae" }}>
                <Target className="h-6 w-6 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Misión</h2>
            </div>
            
            <div className="bg-white border-l-4 rounded-r-lg p-5 shadow-sm" style={{ borderColor: "#389fae" }}>
              <p className="text-gray-700 text-base leading-relaxed">
                "Facilitar el acceso equitativo a oportunidades de apoyo y solidaridad a través de nuestro 
                sistema de rifas online. Estamos comprometidos en promover la ayuda social al brindar una 
                plataforma inclusiva y transparente donde la comunidad pueda contribuir y beneficiarse 
                mutuamente, creando un impacto positivo en la sociedad"
              </p>
            </div>
          </section>

          {/* Visión */}
          <section className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="rounded-lg p-2.5" style={{ background: "#0b56a7" }}>
                <Eye className="h-6 w-6 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Visión</h2>
            </div>
            
            <div className="bg-white border-l-4 rounded-r-lg p-5 shadow-sm" style={{ borderColor: "#0b56a7" }}>
              <p className="text-gray-700 text-base leading-relaxed">
                "Ser la principal plataforma de rifas online reconocido a nivel nacional e internacional por 
                nuestro compromiso inquebrantable con la ayuda social y la solidaridad."
              </p>
            </div>
          </section>

          {/* Valores */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="rounded-lg p-2.5" style={{ background: "#4dc9b1" }}>
                <Heart className="h-6 w-6 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Nuestros Valores</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {valores.map((valor, index) => {
                const IconComponent = valor.icon;
                return (
                  <div
                    key={index}
                    className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all duration-300"
                  >
                    <div className="flex items-start gap-3">
                      <div className="rounded-lg p-2 shrink-0" style={{ backgroundColor: "#f0f9ff" }}>
                        <IconComponent className="h-5 w-5" style={{ color: "#207ba8" }} />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-base font-bold text-gray-900 mb-1">
                          {valor.name}
                        </h3>
                        <p className="text-gray-600 text-sm leading-relaxed">
                          {valor.description}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Footer informativo */}
          <div className="mt-8 p-5 bg-white rounded-lg shadow-sm border-l-4" style={{ borderColor: "#d62829" }}>
            <div className="flex items-start gap-3">
              <Users className="h-5 w-5 shrink-0 mt-1" style={{ color: "#d62829" }} />
              <div>
                <h3 className="text-lg font-bold mb-2 text-gray-900">Nuestro Compromiso</h3>
                <p className="leading-relaxed text-gray-700 text-sm mb-3">
                  En HAYU24, trabajamos día a día para mantener estos valores como el centro de nuestras 
                  operaciones, asegurando que cada rifa contribuya positivamente a nuestra comunidad y 
                  genere oportunidades de solidaridad y apoyo mutuo.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}