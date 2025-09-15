// src/components/ParticipationModal.jsx
import React, { useState, useRef } from 'react';
import { 
  Upload, X, CheckCircle, AlertCircle, 
  FileText, Image, Eye, Trash2 
} from 'lucide-react';
import { Modal, Button, Alert, LoadingSpinner } from './UI';
import { participantsAPI } from '../config/api';

const ParticipationModal = ({ isOpen, onClose, roulette, onSuccess }) => {
  const [step, setStep] = useState(1); // 1: Upload, 2: Terms, 3: Success
  const [selectedFile, setSelectedFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [participationResult, setParticipationResult] = useState(null);
  const fileInputRef = useRef(null);

  // Reset modal state when opened/closed
  React.useEffect(() => {
    if (isOpen) {
      resetModal();
    }
  }, [isOpen]);

  const resetModal = () => {
    setStep(1);
    setSelectedFile(null);
    setDragActive(false);
    setUploading(false);
    setError(null);
    setAcceptTerms(false);
    setParticipationResult(null);
  };

  // Validar archivo
  const validateFile = (file) => {
    const maxSize = 5 * 1024 * 1024; // 5MB
    const allowedTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 
      'application/pdf', 'text/plain'
    ];

    if (file.size > maxSize) {
      return 'El archivo debe ser menor a 5MB';
    }

    if (!allowedTypes.includes(file.type)) {
      return 'Formato no válido. Usa JPG, PNG o PDF';
    }

    return null;
  };

  // Manejar selección de archivo
  const handleFileSelect = (file) => {
    const error = validateFile(file);
    if (error) {
      setError(error);
      return;
    }

    setSelectedFile(file);
    setError(null);
  };

  // Drag and drop handlers
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  // Ir al siguiente paso
  const handleNextStep = () => {
    if (step === 1 && selectedFile) {
      setStep(2);
    }
  };

  // Procesar participación
  const handleParticipate = async () => {
    if (!acceptTerms) {
      setError('Debes aceptar los términos y condiciones');
      return;
    }

    try {
      setUploading(true);
      setError(null);

      const result = await participantsAPI.participate(roulette.id, selectedFile);
      
      setParticipationResult(result);
      setStep(3);
      
      // Llamar callback de éxito después de un delay para mostrar la animación
      setTimeout(() => {
        if (onSuccess) onSuccess();
      }, 2000);

    } catch (error) {
      console.error('Error participando:', error);
      setError(error.message || 'Error al procesar la participación');
    } finally {
      setUploading(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (file) => {
    if (file.type.startsWith('image/')) return Image;
    if (file.type === 'application/pdf') return FileText;
    return FileText;
  };

  if (!roulette) return null;

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose}
      title={step === 3 ? "¡Participación Exitosa!" : `Participar en ${roulette.title}`}
      size="lg"
    >
      {step === 1 && (
        <div className="space-y-6">
          {/* Información de la ruleta */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2">{roulette.title}</h4>
            <p className="text-blue-700 text-sm mb-3">{roulette.description}</p>
            <div className="flex items-center justify-between text-sm text-blue-600">
              <span>{roulette.participants_count} participantes</span>
              {roulette.scheduled_date && (
                <span>Sorteo: {new Date(roulette.scheduled_date).toLocaleDateString()}</span>
              )}
            </div>
          </div>

          {/* Upload area */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Subir Comprobante de Compra
            </label>
            <div
              className={`
                relative border-2 border-dashed rounded-lg p-8 text-center transition-colors
                ${dragActive 
                  ? 'border-blue-400 bg-blue-50' 
                  : 'border-gray-300 hover:border-gray-400'
                }
              `}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              {selectedFile ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-center">
                    <div className="bg-green-100 p-3 rounded-full">
                      <CheckCircle className="h-8 w-8 text-green-600" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-center space-x-2">
                      {React.createElement(getFileIcon(selectedFile), { className: "h-4 w-4 text-gray-400" })}
                      <span className="font-medium text-gray-900">{selectedFile.name}</span>
                    </div>
                    <p className="text-sm text-gray-500">
                      {formatFileSize(selectedFile.size)} • {selectedFile.type}
                    </p>
                  </div>
                  <div className="flex justify-center space-x-2">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="h-4 w-4 mr-1" />
                      Cambiar
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => setSelectedFile(null)}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Eliminar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                    <Upload className="h-8 w-8 text-gray-400" />
                  </div>
                  <div>
                    <p className="text-lg font-medium text-gray-900">
                      Arrastra tu comprobante aquí
                    </p>
                    <p className="text-gray-600">o haz clic para seleccionar</p>
                  </div>
                  <Button 
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Seleccionar Archivo
                  </Button>
                  <p className="text-xs text-gray-500">
                    Formatos: JPG, PNG, PDF • Máximo 5MB
                  </p>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/jpeg,image/jpg,image/png,application/pdf"
                onChange={handleFileInput}
              />
            </div>
          </div>

          {error && (
            <Alert type="error" title="Error">
              {error}
            </Alert>
          )}

          {/* Botones */}
          <div className="flex justify-between">
            <Button variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button 
              onClick={handleNextStep}
              disabled={!selectedFile}
            >
              Continuar
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          {/* Resumen */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-3">Resumen de Participación</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Ruleta:</span>
                <span className="font-medium">{roulette.title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Comprobante:</span>
                <span className="font-medium">{selectedFile?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Participantes actuales:</span>
                <span className="font-medium">{roulette.participants_count}</span>
              </div>
            </div>
          </div>

          {/* Términos y condiciones */}
          <div className="space-y-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h4 className="font-medium text-yellow-800 mb-2">Términos y Condiciones</h4>
              <div className="text-sm text-yellow-700 space-y-2">
                <p>• Al participar confirmas que el comprobante es auténtico y válido.</p>
                <p>• La participación es irreversible una vez confirmada.</p>
                <p>• El sorteo se realizará en la fecha programada.</p>
                <p>• Los resultados son definitivos e inapelables.</p>
                <p>• Te notificaremos el resultado por email.</p>
              </div>
            </div>

            <label className="flex items-start space-x-3">
              <input
                type="checkbox"
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mt-0.5"
              />
              <span className="text-sm text-gray-700">
                Acepto los términos y condiciones y confirmo que mi comprobante es válido
              </span>
            </label>
          </div>

          {error && (
            <Alert type="error" title="Error">
              {error}
            </Alert>
          )}

          {/* Botones */}
          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setStep(1)}>
              Atrás
            </Button>
            <Button 
              onClick={handleParticipate}
              disabled={!acceptTerms || uploading}
              loading={uploading}
            >
              {uploading ? 'Procesando...' : 'Confirmar Participación'}
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="text-center space-y-6">
          {/* Animación de éxito */}
          <div className="mx-auto w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle className="h-12 w-12 text-green-600" />
          </div>

          <div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              ¡Participación Confirmada!
            </h3>
            <p className="text-gray-600">
              Tu participación ha sido registrada exitosamente
            </p>
          </div>

          {/* Información del resultado */}
          {participationResult && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Tu número:</span>
                  <span className="font-bold text-green-700">
                    #{participationResult.participation_number}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total participantes:</span>
                  <span className="font-medium">{participationResult.total_participants}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Estado:</span>
                  <span className="font-medium text-green-700">Confirmado</span>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2 text-sm text-gray-600">
            <p>• Te notificaremos cuando sea el sorteo</p>
            <p>• Puedes ver tu participación en "Mis Participaciones"</p>
            <p>• ¡Buena suerte! 🍀</p>
          </div>

          <Button onClick={onClose} className="w-full">
            Entendido
          </Button>
        </div>
      )}
    </Modal>
  );
};

export default ParticipationModal;