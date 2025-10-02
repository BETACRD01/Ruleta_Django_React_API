import React from "react";
import { ArrowLeft, FileText, Shield, Users, Award, AlertCircle, Scale } from "lucide-react";

export default function TermsAndConditions({ onBack = () => {}, isFullPage = false }) {
  const lastUpdated = "14 de febrero de 2024";

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

  return (
    <div className={containerClasses} style={{ 
      background: isFullPage ? "linear-gradient(135deg, #ffffffff 0%, #e6e6e6ff 100%)" : "transparent"
    }}>
      <div className={isFullPage ? "max-w-5xl mx-auto bg-white rounded-3xl shadow-2xl border border-gray-200 overflow-hidden" : ""}>
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-900 to-blue-700 text-white px-8 py-6">
          <button
            type="button"
            onClick={handleBackClick}
            className="inline-flex items-center gap-2 text-white hover:text-blue-100 transition-all mb-4 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-blue-900 rounded-lg px-3 py-2 hover:bg-white/10"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="font-medium">Volver</span>
          </button>
          
          <div className="flex items-start gap-4">
            <div className="rounded-xl p-3 bg-white/10 backdrop-blur-sm">
              <FileText className="h-10 w-10 text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-4xl font-bold mb-2">
                Términos y Condiciones
              </h1>
              <p className="text-blue-100 text-lg">
                Sistema de rifas en línea HAYU24
              </p>
              <p className="text-blue-200 text-sm mt-2">
                Última actualización: {lastUpdated}
              </p>
            </div>
          </div>
        </div>

        {/* Contenido Principal */}
        <div className="px-8 py-6">
          {/* Introducción */}
          <div className="mb-8 p-6 bg-blue-50 border-l-4 border-blue-600 rounded-r-lg">
            <p className="text-gray-800 leading-relaxed">
              Los presentes términos y condiciones estipulan la operación de la venta, concursos y sorteos 
              a través del <strong>sistema de rifas online HAYU24</strong>. Al utilizar nuestros servicios, 
              usted acepta en todo momento estos términos y condiciones.
            </p>
          </div>

          <div className="space-y-8">
            {/* 1. Definiciones */}
            <section className="border-l-4 border-blue-600 pl-6">
              <div className="flex items-center gap-3 mb-4">
                <Users className="h-6 w-6 text-blue-600" />
                <h2 className="text-2xl font-bold text-gray-900">1. Definiciones</h2>
              </div>
              <div className="space-y-3 text-gray-700 leading-relaxed">
                <p>
                  <strong className="text-gray-900">a) "Cliente":</strong> Individuo o entidad que utiliza HAYU24 para participar en rifas.
                </p>
                <p>
                  <strong className="text-gray-900">b) "Cliente Organizador de Rifas":</strong> Cliente que utiliza el sistema de rifas online para crear, administrar y promover rifas.
                </p>
                <p>
                  <strong className="text-gray-900">c) "Rifas":</strong> Eventos organizados a través del sistema de rifas online donde los participantes pueden comprar boletos para tener la oportunidad de ganar premios.
                </p>
              </div>
            </section>

            {/* 2. Uso del Sistema */}
            <section className="border-l-4 border-purple-600 pl-6">
              <div className="flex items-center gap-3 mb-4">
                <Shield className="h-6 w-6 text-purple-600" />
                <h2 className="text-2xl font-bold text-gray-900">2. Uso del Sistema</h2>
              </div>
              <div className="space-y-3 text-gray-700 leading-relaxed">
                <p>
                  <strong className="text-gray-900">a)</strong> El cliente puede usar el sistema de rifas online para participar en rifas organizadas por otros clientes.
                </p>
                <p>
                  <strong className="text-gray-900">b)</strong> El cliente organizador de rifas es responsable de cumplir con todas las leyes y regulaciones aplicables relacionadas con la organización y administración de las rifas.
                </p>
              </div>
            </section>

            {/* 3. Participación en Rifas */}
            <section className="border-l-4 border-green-600 pl-6">
              <div className="flex items-center gap-3 mb-4">
                <Award className="h-6 w-6 text-green-600" />
                <h2 className="text-2xl font-bold text-gray-900">3. Participación en Rifas</h2>
              </div>
              <div className="space-y-3 text-gray-700 leading-relaxed">
                <p>
                  <strong className="text-gray-900">a)</strong> Los participantes deben ser mayores de edad o cumplir con los requisitos de edad establecidos por las leyes para participar en rifas.
                </p>
                <p>
                  <strong className="text-gray-900">b)</strong> Al participar en una rifa, los participantes aceptan cumplir con todas las reglas y términos establecidos por el sistema de rifas online HAYU24.
                </p>
              </div>
            </section>

            {/* 4. Registro */}
            <section className="border-l-4 border-orange-600 pl-6">
              <div className="flex items-center gap-3 mb-4">
                <FileText className="h-6 w-6 text-orange-600" />
                <h2 className="text-2xl font-bold text-gray-900">4. Registro</h2>
              </div>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
                <p className="font-semibold text-orange-900">
                  Usted acepta en todo momento los términos y condiciones cuando utiliza el servicio.
                </p>
              </div>
              <div className="space-y-3 text-gray-700 leading-relaxed">
                <p>
                  <strong className="text-gray-900">a)</strong> Sólo podrán acceder y hacer uso del sistema de rifas online HAYU24 las personas jurídicas y las personas físicas mayores de 18 años de edad.
                </p>
                <p>
                  <strong className="text-gray-900">b)</strong> Nos reservamos el derecho de rechazar solicitudes de registro, a nuestra entera discreción y sin la obligación de proporcionar una razón específica.
                </p>
                <p>
                  <strong className="text-gray-900">c)</strong> Antes de utilizar el servicio, es necesario completar personalmente el formulario de registro y leer, así como aceptar, las condiciones publicadas en la plataforma, incluyendo los términos y condiciones.
                </p>
                <p>
                  <strong className="text-gray-900">d)</strong> HAYU24 puede solicitar cualquier documento de identificación a los "Cliente Organizador de Rifas" con el fin de verificar su identidad.
                </p>
              </div>
            </section>

            {/* 5. Compra de Boletos */}
            <section className="border-l-4 border-indigo-600 pl-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">5. Compra de Boletos</h2>
              <div className="space-y-3 text-gray-700 leading-relaxed">
                <p>
                  <strong className="text-gray-900">a)</strong> Los boletos de rifa pueden estar disponibles para su compra a través del sistema de rifas online HAYU24.
                </p>
                <p>
                  <strong className="text-gray-900">b)</strong> Los precios de los boletos y las opciones de pago serán determinados por el cliente organizador de la rifa.
                </p>
                <p>
                  <strong className="text-gray-900">c)</strong> Todas las compras de boletos son finales y no reembolsables.
                </p>
              </div>
            </section>

            {/* 6. Selección de Ganadores */}
            <section className="border-l-4 border-yellow-600 pl-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">6. Selección de Ganadores</h2>
              <div className="space-y-3 text-gray-700 leading-relaxed">
                <p>
                  <strong className="text-gray-900">a)</strong> La selección de ganadores se llevará en vivo a la fecha y hora programada en el sistema de rifas online HAYU24.
                </p>
                <p>
                  <strong className="text-gray-900">b)</strong> La selección de ganadores se llevará a cabo de manera imparcial y aleatoria, utilizando el sistema de rifas online HAYU24 por el cliente organizador de la rifa.
                </p>
                <p>
                  <strong className="text-gray-900">c)</strong> Se garantizará que todos los participantes tengan una oportunidad equitativa de ganar, independientemente de su asistencia de forma presencial o virtual al evento de entrega de premios.
                </p>
                <p>
                  <strong className="text-gray-900">d)</strong> Los ganadores serán notificados mediante el sistema de rifas y a través de medios electrónicos detallados al participar en la rifa.
                </p>
                <p>
                  <strong className="text-gray-900">e)</strong> Se harán todos los esfuerzos razonables para comunicarse con los ganadores y notificarles sobre su premio, incluso si no estuvieron presentes en el evento de entrega de premios.
                </p>
              </div>
            </section>

            {/* 7. Responsabilidades del Cliente Organizador */}
            <section className="border-l-4 border-red-600 pl-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">7. Responsabilidades del Cliente Organizador de Rifas</h2>
              <div className="space-y-3 text-gray-700 leading-relaxed">
                <p>
                  <strong className="text-gray-900">a)</strong> El cliente organizador de la rifa es el único responsable de la administración, promoción y entrega de premios de la rifa.
                </p>
                <p>
                  <strong className="text-gray-900">b)</strong> El cliente organizador de la rifa garantiza que todas las rifas organizadas a través del sistema de rifas online HAYU24 cumplirán con todas las leyes y regulaciones aplicables.
                </p>
                <p>
                  <strong className="text-gray-900">c)</strong> El cliente organizador hará todos los esfuerzos razonables para comunicarse con los ganadores y notificarles sobre su premio, incluso si no estuvieron presentes de forma presencial o virtual en el evento de entrega de premios.
                </p>
                <p>
                  <strong className="text-gray-900">d)</strong> El cliente organizador se esforzará por mantener la confianza de los participantes al garantizar que el proceso de selección y entrega de premios sea justo y equitativo para todos.
                </p>
              </div>
            </section>

            {/* 8. Prohibiciones */}
            <section className="border-l-4 border-red-700 pl-6">
              <div className="flex items-center gap-3 mb-4">
                <AlertCircle className="h-6 w-6 text-red-700" />
                <h2 className="text-2xl font-bold text-gray-900">8. Prohibiciones para Clientes</h2>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <p className="font-semibold text-red-900">
                  El incumplimiento de estas prohibiciones resultará en la cancelación inmediata de su cuenta sin derecho a reembolso.
                </p>
              </div>
              <div className="space-y-3 text-gray-700 leading-relaxed">
                <p>
                  <strong className="text-gray-900">a)</strong> El usuario es responsable de la confidencialidad de su información, de no proporcionar a terceros su cuenta, contraseña, etc. HAYU24 no se hace responsable del manejo de dicha información por terceros, por causas imputables al usuario.
                </p>
                <p>
                  <strong className="text-gray-900">b)</strong> Se prohíbe el uso de lenguaje obsceno en cualquier apartado del registro incluyendo el correo electrónico, contraseña, etc. HAYU24 se reserva el derecho a rehusar el servicio a cualquier persona que así lo realice.
                </p>
                <p>
                  <strong className="text-gray-900">c)</strong> Está totalmente prohibido el uso de cualquier tipo de trampa, listas rellenadas, premios no entregados, o cualquier tipo de estafa.
                </p>
                <p>
                  <strong className="text-gray-900">d)</strong> Si HAYU24 recibe denuncias y comprobamos que se ha hecho trampa, cancelaremos su cuenta sin derecho a reembolso y se le prohibirá como cliente de nuestra plataforma.
                </p>
              </div>
            </section>

            {/* 9. Modificaciones y Terminación */}
            <section className="border-l-4 border-gray-600 pl-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">9. Modificaciones y Terminación</h2>
              <div className="space-y-3 text-gray-700 leading-relaxed">
                <p>
                  <strong className="text-gray-900">a)</strong> El sistema de rifas online se reserva el derecho de modificar, suspender o terminar los servicios en cualquier momento y sin previo aviso.
                </p>
                <p>
                  <strong className="text-gray-900">b)</strong> Los clientes serán notificados de cualquier cambio en los términos y condiciones a través del sistema de rifas online HAYU24 y medios electrónicos.
                </p>
              </div>
            </section>

            {/* 10. Disposiciones Generales */}
            <section className="border-l-4 border-blue-800 pl-6">
              <div className="flex items-center gap-3 mb-4">
                <Scale className="h-6 w-6 text-blue-800" />
                <h2 className="text-2xl font-bold text-gray-900">10. Disposiciones Generales</h2>
              </div>
              <div className="space-y-3 text-gray-700 leading-relaxed">
                <p>
                  <strong className="text-gray-900">a)</strong> Estos términos y condiciones constituyen el acuerdo completo entre el cliente y el sistema de rifas online con respecto al uso del sistema.
                </p>
                <p>
                  <strong className="text-gray-900">b)</strong> Cualquier disputa o reclamación relacionada con el uso del sistema de rifas online se resolverá de acuerdo con las leyes aplicables.
                </p>
              </div>
            </section>
          </div>
          {/* Footer de aceptación */}
          <div className="mt-8 p-6 bg-blue-900 text-white rounded-xl text-center">
            <h3 className="text-xl font-bold mb-3">Aceptación de Términos</h3>
            <p className="leading-relaxed">
              Al registrarse y utilizar HAYU24, usted confirma que ha leído, comprendido y acepta estos términos y condiciones en su totalidad. Estos términos constituyen un acuerdo legal vinculante entre usted como usuario y HAYU24 como prestador del servicio.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}