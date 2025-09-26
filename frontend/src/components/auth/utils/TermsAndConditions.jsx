import React from "react";
import { ArrowLeft, FileText } from "lucide-react";

export default function TermsAndConditions({ onBack = () => {}, isFullPage = false }) {
  const lastUpdated = new Date().toLocaleDateString("es-ES", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const handleBackClick = () => {
    if (isFullPage) {
      if (window.history.length > 1) window.history.back();
      else window.close();
    } else {
      onBack();
    }
  };

  const containerClasses = isFullPage
    ? "min-h-screen py-6 px-4" 
    : "w-full max-w-4xl mx-auto bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden";

  return (
    <div className={containerClasses} style={{ 
      background: isFullPage ? "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 50%, #f1f5f9 100%)" : "transparent"
    }}>
      <div className={isFullPage ? "max-w-4xl mx-auto bg-white rounded-3xl shadow-xl border border-gray-200 overflow-hidden" : ""}>
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={handleBackClick}
              className="inline-flex items-center gap-3 text-gray-700 hover:text-gray-900 transition-all focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 rounded-lg px-3 py-2 hover:bg-gray-50"
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="font-medium">Volver</span>
            </button>
          </div>
        </div>

        {/* Título */}
        <div className="px-6 py-8">
          <div className="flex items-start gap-4 mb-6">
            <div className="rounded-xl p-3 bg-blue-900 shadow-sm">
              <FileText className="h-8 w-8 text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Términos de Servicio y Política de Privacidad
              </h1>
              <p className="text-gray-600">
                Última actualización: {lastUpdated}
              </p>
            </div>
          </div>
        </div>

        {/* Contenido */}
        <div className="px-6 pb-8 max-h-[70vh] overflow-y-auto">
          <div className="space-y-8">
            {/* Privacidad y protección de datos */}
            <section className="rounded-xl p-6 bg-gray-50 border border-gray-200">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Privacidad y protección de datos
              </h2>
              <div className="space-y-4 text-gray-700 leading-relaxed">
                <p>
                  <strong>Recopilación de información:</strong> Al registrarte en nuestra plataforma, recopilamos información personal necesaria para la prestación del servicio, incluyendo nombre completo, apellido, dirección de correo electrónico, número de teléfono y contraseña cifrada mediante algoritmos de seguridad de nivel bancario. Esta información es almacenada de forma segura en servidores protegidos con certificaciones de seguridad internacionales.
                </p>
                <p>
                  <strong>Finalidad del tratamiento:</strong> Los datos personales recopilados son utilizados exclusivamente para la gestión de tu cuenta de usuario, la administración y ejecución de sorteos de manera transparente, el envío de notificaciones importantes relacionadas con el servicio, y el cumplimiento de obligaciones legales y regulatorias aplicables. No compartimos tu información personal con terceros sin tu consentimiento explícito, excepto cuando sea requerido por ley.
                </p>
                <p>
                  <strong>Derechos de control:</strong> Mantienes control total sobre tus datos personales en todo momento. Puedes solicitar el acceso, rectificación, actualización o eliminación completa de tu información personal contactándonos através del correo electrónico oficial indicado al final de este documento. Procesaremos tu solicitud conforme a la legislación vigente de protección de datos y te proporcionaremos confirmación por escrito del procesamiento de tu solicitud.
                </p>
                <p>
                  <strong>Seguridad y cifrado:</strong> Implementamos medidas de seguridad técnicas y organizativas de nivel empresarial para proteger tu información contra accesos no autorizados, alteración, divulgación o destrucción. Utilizamos cifrado SSL/TLS para todas las transmisiones de datos y algoritmos de hash seguros para el almacenamiento de contraseñas.
                </p>
              </div>
            </section>

            {/* Condiciones de uso */}
            <section className="rounded-xl p-6 bg-gray-50 border border-gray-200">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Condiciones de uso responsable
              </h2>
              <div className="space-y-4 text-gray-700 leading-relaxed">
                <p>
                  <strong>Elegibilidad del usuario:</strong> Para utilizar nuestros servicios, debes ser mayor de edad según la legislación vigente en tu país de residencia y poseer la capacidad legal necesaria para celebrar contratos vinculantes. Al registrarte, confirmas que cumples con estos requisitos y que toda la información proporcionada es verídica, precisa y está actualizada.
                </p>
                <p>
                  <strong>Uso apropiado de la plataforma:</strong> Te comprometes a utilizar nuestros servicios de manera responsable y conforme a estos términos. Está estrictamente prohibido cualquier intento de manipular resultados de sorteos, crear múltiples cuentas de usuario, utilizar software automatizado para participar en sorteos, o cualquier otra actividad que pueda comprometer la integridad del sistema o perjudicar a otros usuarios.
                </p>
                <p>
                  <strong>Comportamiento y conducta:</strong> Mantienes la responsabilidad de mantener un comportamiento respetuoso y apropiado hacia otros usuarios y hacia nuestro equipo de soporte. No toleramos el acoso, la discriminación, el lenguaje ofensivo o cualquier forma de comportamiento disruptivo en nuestra plataforma.
                </p>
                <p>
                  <strong>Consecuencias del incumplimiento:</strong> El incumplimiento de estas condiciones puede resultar en la suspensión temporal o permanente de tu cuenta, la descalificación de sorteos en curso, y la pérdida de cualquier premio pendiente. Nos reservamos el derecho de tomar las medidas legales apropiadas en casos de violaciones graves de estos términos.
                </p>
                <p>
                  <strong>Responsabilidad del usuario:</strong> Eres responsable de mantener la confidencialidad de tus credenciales de acceso y de todas las actividades que ocurran bajo tu cuenta. Debes notificarnos inmediatamente cualquier uso no autorizado de tu cuenta o cualquier otra brecha de seguridad.
                </p>
              </div>
            </section>

            {/* Sorteos y transparencia */}
            <section className="rounded-xl p-6 bg-gray-50 border border-gray-200">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Sorteos y transparencia
              </h2>
              <div className="space-y-4 text-gray-700 leading-relaxed">
                <p>
                  <strong>Transparencia total en los procesos:</strong> Nos comprometemos a mantener la máxima transparencia en todos nuestros sorteos. Publicamos las reglas completas y detalladas de cada sorteo antes de su inicio, incluyendo fechas exactas de inicio y finalización, criterios de elegibilidad, métodos de selección de ganadores, y cualquier restricción aplicable. Esta información permanece disponible públicamente durante todo el proceso del sorteo.
                </p>
                <p>
                  <strong>Mecánicas de selección aleatoria:</strong> Utilizamos algoritmos de generación de números aleatorios certificados y auditados por terceros independientes para garantizar la imparcialidad absoluta en la selección de ganadores. Los procesos de sorteo son registrados y documentados meticulosamente, permitiendo la verificación posterior de todos los resultados.
                </p>
                <p>
                  <strong>Verificación y auditoría independiente:</strong> Mantenemos registros completos y detallados de todos los procesos de sorteo, incluyendo timestamps, participantes, y metodologías utilizadas. Para sorteos de alto valor, contratamos empresas de auditoría independientes y certificadas para supervisar el proceso completo y emitir certificaciones de integridad.
                </p>
                <p>
                  <strong>Notificación y comunicación con ganadores:</strong> Los ganadores son contactados inmediatamente a través de múltiples canales de comunicación, incluyendo correo electrónico, notificaciones en la plataforma, y cuando sea posible, contacto telefónico. Proporcionamos un plazo razonable para que los ganadores reclamen sus premios, después del cual podemos proceder con sorteos secundarios según las reglas específicas de cada concurso.
                </p>
                <p>
                  <strong>Disputas y resolución:</strong> En caso de disputas relacionadas con los resultados de sorteos, mantenemos un proceso formal de revisión que incluye la evaluación de toda la documentación relevante y, cuando sea necesario, la intervención de auditores independientes para resolver cualquier controversia de manera justa e imparcial.
                </p>
              </div>
            </section>

            {/* Retención y seguridad */}
            <section className="rounded-xl p-6 bg-gray-50 border border-gray-200">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Retención y seguridad de datos
              </h2>
              <div className="space-y-4 text-gray-700 leading-relaxed">
                <p>
                  <strong>Períodos de retención:</strong> Conservamos tus datos personales únicamente durante el tiempo estrictamente necesario para cumplir con las finalidades para las cuales fueron recopilados, incluyendo la prestación de nuestros servicios, el cumplimiento de obligaciones legales, y la resolución de disputas. Los datos de participación en sorteos se conservan por períodos más extensos para fines de auditoría y transparencia, conforme a las mejores prácticas de la industria.
                </p>
                <p>
                  <strong>Medidas de seguridad implementadas:</strong> Implementamos controles de seguridad técnicos y organizativos de nivel empresarial para proteger tu información personal contra accesos no autorizados, alteración, divulgación accidental o destrucción no autorizada. Nuestros sistemas utilizan cifrado de grado militar AES-256 para datos en reposo y protocolos TLS 1.3 para datos en tránsito.
                </p>
                <p>
                  <strong>Infraestructura y respaldo:</strong> Nuestros servidores están alojados en centros de datos certificados con estándares internacionales de seguridad, incluyendo controles de acceso físico, monitoreo 24/7, sistemas de respaldo de energía, y protección contra desastres naturales. Realizamos copias de seguridad automatizadas y cifradas de todos los datos críticos con redundancia geográfica.
                </p>
                <p>
                  <strong>Acceso y control interno:</strong> El acceso a datos personales está estrictamente limitado a personal autorizado que requiere dicha información para el desempeño de sus funciones laborales. Todo el personal con acceso a datos personales ha firmado acuerdos de confidencialidad y recibe capacitación regular sobre protección de datos y seguridad de la información.
                </p>
                <p>
                  <strong>Eliminación segura:</strong> Al solicitar el cierre de tu cuenta, procedemos a la eliminación segura de todos tus datos personales, sujeto a los períodos de retención legales obligatorios. La eliminación se realiza utilizando métodos certificados de destrucción de datos que garantizan la irrecuperabilidad de la información eliminada.
                </p>
              </div>
            </section>

            {/* Derechos del usuario */}
            <section className="rounded-xl p-6 bg-gray-50 border border-gray-200">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Derechos fundamentales del usuario
              </h2>
              <div className="space-y-4 text-gray-700 leading-relaxed">
                <p>
                  <strong>Derechos de acceso y transparencia:</strong> Tienes el derecho fundamental de conocer qué información personal tenemos sobre ti, cómo la utilizamos, con quién la compartimos, y durante cuánto tiempo la conservamos. Puedes solicitar una copia completa de todos tus datos personales en nuestro poder en un formato estructurado y de uso común.
                </p>
                <p>
                  <strong>Derechos de rectificación y actualización:</strong> Si identificas información incorrecta, incompleta o desactualizada en tu perfil, tienes el derecho de solicitar su corrección inmediata. Nos comprometemos a procesar estas solicitudes de manera expedita y a notificarte una vez completada la actualización.
                </p>
                <p>
                  <strong>Derechos de eliminación y olvido:</strong> Bajo ciertas circunstancias, tienes el derecho de solicitar la eliminación completa de tus datos personales de nuestros sistemas. Evaluaremos cada solicitud individualmente, considerando nuestras obligaciones legales y los derechos de terceros, y procederemos con la eliminación cuando sea legalmente permisible.
                </p>
                <p>
                  <strong>Derechos de portabilidad:</strong> Tienes el derecho de recibir los datos personales que nos has proporcionado en un formato estructurado, de uso común y legible por máquina, y de transmitir esos datos a otro responsable del tratamiento cuando sea técnicamente factible.
                </p>
                <p>
                  <strong>Derechos de oposición y limitación:</strong> Puedes oponerte al procesamiento de tus datos personales en ciertas circunstancias, particularmente cuando el procesamiento se base en intereses legítimos. También puedes solicitar la limitación del procesamiento mientras se resuelve una disputa sobre la exactitud o legalidad del procesamiento.
                </p>
                <p>
                  <strong>Ejercicio de derechos:</strong> Para ejercer cualquiera de estos derechos, contáctanos desde la dirección de correo electrónico asociada a tu cuenta utilizando la información de contacto proporcionada al final de este documento. Responderemos a tu solicitud dentro de los plazos establecidos por la legislación aplicable y te proporcionaremos información clara sobre las acciones tomadas.
                </p>
              </div>
            </section>

            {/* Cambios y contacto */}
            <section className="rounded-xl p-6 bg-gray-50 border border-gray-200">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Modificaciones y contacto oficial
              </h2>
              <div className="space-y-4 text-gray-700 leading-relaxed">
                <p>
                  <strong>Política de actualizaciones:</strong> Nos reservamos el derecho de modificar estos términos y condiciones periódicamente para reflejar cambios en nuestros servicios, mejoras tecnológicas, actualizaciones en la legislación aplicable, o cambios en nuestras prácticas comerciales. Cualquier modificación material será comunicada a los usuarios con al menos treinta (30) días de antelación a través de correo electrónico y notificaciones prominentes en nuestra plataforma.
                </p>
                <p>
                  <strong>Notificación y aceptación de cambios:</strong> Las modificaciones entrarán en vigor en la fecha especificada en la notificación. El uso continuado de nuestros servicios después de la fecha de entrada en vigor constituirá tu aceptación de los términos modificados. Si no estás de acuerdo con las modificaciones, puedes cancelar tu cuenta antes de la fecha de entrada en vigor.
                </p>
                <p>
                  <strong>Archivo de versiones anteriores:</strong> Mantenemos un archivo de todas las versiones anteriores de estos términos y condiciones para fines de transparencia y referencia histórica. Puedes solicitar acceso a versiones anteriores contactándonos através de los medios oficiales proporcionados.
                </p>
                
                <div className="rounded-lg p-4 bg-white border-2 border-gray-300 mt-6">
                  <p className="font-semibold mb-3 text-gray-900">
                    Información de contacto oficial:
                  </p>
                  <div className="space-y-2">
                    <a
                      href="mailto:soporte@rifasystem.com"
                      className="block font-mono text-lg text-blue-900 hover:underline"
                    >
                      soporte@rifasystem.com
                    </a>
                    <p className="text-sm text-gray-600">
                      Tiempo estimado de respuesta: 24-48 horas hábiles
                    </p>
                    <p className="text-sm text-gray-600">
                      Para consultas urgentes relacionadas con sorteos activos: respuesta prioritaria en 12 horas hábiles
                    </p>
                  </div>
                </div>

                <p>
                  <strong>Jurisdicción y ley aplicable:</strong> Estos términos se rigen por las leyes aplicables en nuestra jurisdicción de operación. Cualquier disputa relacionada con estos términos será resuelta mediante los procedimientos legales establecidos en dicha jurisdicción, sin perjuicio de tus derechos como consumidor bajo la legislación local aplicable.
                </p>
              </div>
            </section>

            {/* Footer de aceptación */}
            <div className="rounded-xl p-6 bg-gray-100 border border-gray-300 text-center">
              <div className="max-w-2xl mx-auto">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Aceptación de términos
                </h3>
                <p className="text-gray-700 leading-relaxed mb-4">
                  Al crear una cuenta y utilizar nuestros servicios, confirmas que has leído, comprendido y aceptas estos términos de servicio y política de privacidad en su totalidad. Estos términos constituyen un acuerdo legal vinculante entre tú como usuario y RifaSystem como prestador del servicio.
                </p>
                <p className="text-sm text-gray-600">
                  Si tienes preguntas sobre estos términos o necesitas aclaraciones adicionales, no dudes en contactarnos utilizando la información proporcionada anteriormente.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}