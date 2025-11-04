import React from "react";
import { ArrowLeft, Mail, Phone, MessageCircle, Clock, MapPin, HelpCircle } from "lucide-react";

export default function Support({ onBack = () => {}, isFullPage = false }) {
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

  const contactMethods = [
    {
      icon: Mail,
      title: "Correo Electrónico",
      value: "soporte@hayu24.com",
      description: "Respuesta en 24-48 horas",
      color: "#0b56a7"
    },
    {
      icon: Phone,
      title: "Teléfono",
      value: "+593 XX XXX XXXX",
      description: "Lun - Vie: 9:00 AM - 6:00 PM",
      color: "#389fae"
    },
    {
      icon: MessageCircle,
      title: "Chat en Vivo",
      value: "Disponible en la plataforma",
      description: "Horario de oficina",
      color: "#4dc9b1"
    }
  ];

  const faqs = [
    {
      question: "¿Cómo puedo participar en una rifa?",
      answer: "Para participar, regístrate en nuestra plataforma, selecciona la rifa de tu interés y adquiere tus boletos siguiendo las instrucciones en pantalla."
    },
    {
      question: "¿Los pagos son seguros?",
      answer: "Sí, utilizamos sistemas de pago seguros y encriptados para proteger tu información financiera en todo momento."
    },
    {
      question: "¿Cómo sabré si gané?",
      answer: "Los ganadores son notificados automáticamente a través de correo electrónico y mensajes dentro de la plataforma."
    },
    {
      question: "¿Puedo organizar mi propia rifa?",
      answer: "Sí, puedes crear tu cuenta como organizador y configurar tu propia rifa siguiendo las políticas de nuestra plataforma."
    }
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
            style={{ borderColor: "rgba(255,255,255,0.2)" }}
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="font-medium">Volver</span>
          </button>
          
          <div className="flex items-start gap-4">
            <div className="rounded-lg p-3 bg-white/10 backdrop-blur-sm">
              <HelpCircle className="h-8 w-8 text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold mb-1">Centro de Soporte</h1>
              <p className="text-gray-100 text-base">Estamos aquí para ayudarte</p>
            </div>
          </div>
        </div>

        {/* Contenido Principal */}
        <div className="px-8 py-8" style={{ backgroundColor: "#fafafa" }}>
          {/* Introducción */}
          <div className="mb-8 p-5 bg-white border-l-4 rounded-r-lg shadow-sm" style={{ borderColor: "#207ba8" }}>
            <p className="text-gray-700 text-base leading-relaxed">
              Nuestro equipo de soporte está disponible para responder tus preguntas y ayudarte con 
              cualquier inquietud sobre HAYU24. Contáctanos a través de cualquiera de nuestros canales.
            </p>
          </div>

          {/* Métodos de Contacto */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Canales de Contacto</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {contactMethods.map((method, index) => {
                const IconComponent = method.icon;
                return (
                  <div
                    key={index}
                    className="bg-white border-l-4 rounded-r-lg p-5 shadow-sm hover:shadow-md transition-all duration-300"
                    style={{ borderColor: method.color }}
                  >
                    <div className="inline-flex rounded-lg p-2.5 mb-3" style={{ backgroundColor: `${method.color}15` }}>
                      <IconComponent className="h-5 w-5" style={{ color: method.color }} />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-1">
                      {method.title}
                    </h3>
                    <p className="text-gray-800 font-semibold text-sm mb-1">
                      {method.value}
                    </p>
                    <p className="text-gray-600 text-sm">
                      {method.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Horario de Atención */}
          <section className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="rounded-lg p-2.5" style={{ background: "#d62829" }}>
                <Clock className="h-6 w-6 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Horario de Atención</h2>
            </div>

            <div className="bg-white border-l-4 rounded-r-lg p-5 shadow-sm" style={{ borderColor: "#d62829" }}>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-gray-800 text-sm">Lunes a Viernes:</span>
                  <span className="text-gray-700 text-sm">9:00 AM - 6:00 PM</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-gray-800 text-sm">Sábados:</span>
                  <span className="text-gray-700 text-sm">10:00 AM - 2:00 PM</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-gray-800 text-sm">Domingos y Festivos:</span>
                  <span className="text-gray-700 text-sm">Cerrado</span>
                </div>
              </div>
            </div>
          </section>

          {/* Preguntas Frecuentes */}
          <section className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="rounded-lg p-2.5" style={{ background: "#389fae" }}>
                <MessageCircle className="h-6 w-6 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Preguntas Frecuentes</h2>
            </div>

            <div className="space-y-3">
              {faqs.map((faq, index) => (
                <div
                  key={index}
                  className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all duration-300"
                >
                  <h3 className="text-base font-bold text-gray-900 mb-2 flex items-start gap-2">
                    <span style={{ color: "#389fae" }} className="shrink-0">Q:</span>
                    {faq.question}
                  </h3>
                  <p className="text-gray-700 leading-relaxed text-sm pl-5">
                    <span style={{ color: "#389fae" }} className="font-semibold">R:</span> {faq.answer}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Ubicación */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="rounded-lg p-2.5" style={{ background: "#4dc9b1" }}>
                <MapPin className="h-6 w-6 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Ubicación</h2>
            </div>

            <div className="bg-white border-l-4 rounded-r-lg p-5 shadow-sm" style={{ borderColor: "#4dc9b1" }}>
              <p className="text-gray-700 leading-relaxed text-sm">
                <strong className="block mb-1 text-gray-900">Digital Educas</strong>
                Quito, Ecuador<br />
                Sistema de Rifas Online HAYU24
              </p>
            </div>
          </section>

          {/* Footer de contacto */}
          <div className="mt-8 p-5 bg-white rounded-lg shadow-sm border-l-4" style={{ borderColor: "#0b56a7" }}>
            <h3 className="text-lg font-bold mb-2 text-gray-900">¿Necesitas más ayuda?</h3>
            <p className="leading-relaxed mb-4 text-gray-700 text-sm">
              No dudes en contactarnos. Nuestro equipo de soporte está listo para asistirte 
              y resolver cualquier duda que tengas sobre nuestros servicios.
            </p>
            <a
              href="mailto:soporte@hayu24.com"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-white transition-colors duration-200 text-sm"
              style={{ backgroundColor: "#0b56a7" }}
              onMouseEnter={(e) => e.target.style.backgroundColor = "#207ba8"}
              onMouseLeave={(e) => e.target.style.backgroundColor = "#0b56a7"}
            >
              <Mail className="h-4 w-4" />
              Enviar Correo
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}