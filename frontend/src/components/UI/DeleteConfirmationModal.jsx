import React, { useState } from 'react';
import { AlertTriangle, Loader, X, CheckCircle } from 'lucide-react';

const DeleteConfirmationModal = ({
  isOpen,
  title = "Confirmar eliminación",
  message = "¿Estás seguro de que deseas continuar?",
  itemName = "",
  onConfirm,
  onCancel,
  isLoading = false,
  error = "",
  confirmButtonText = "Eliminar",
  confirmButtonColor = "red"
}) => {
  const [localLoading, setLocalLoading] = useState(false);
  const [localError, setLocalError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleConfirm = async () => {
    setLocalLoading(true);
    setLocalError("");
    
    try {
      if (onConfirm) {
        await onConfirm();
      }
      setSuccess(true);
      
      setTimeout(() => {
        handleClose();
      }, 1500);
    } catch (err) {
      setLocalError(err?.message || "Error al eliminar");
      setLocalLoading(false);
    }
  };

  const handleCancel = () => {
    if (!localLoading && !success) {
      handleClose();
      if (onCancel) onCancel();
    }
  };

  const handleClose = () => {
    setLocalLoading(false);
    setLocalError("");
    setSuccess(false);
    if (onCancel) onCancel();
  };

  if (!isOpen) return null;

  if (success) {
    return (
      <div className="fixed inset-0 z-[999] bg-black/50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-8 animate-in fade-in duration-200">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-green-100 rounded-full">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">
            ¡Eliminado!
          </h3>
          <p className="text-sm text-gray-600 text-center">
            El elemento ha sido eliminado exitosamente.
          </p>
        </div>
      </div>
    );
  }

  if (localLoading || isLoading) {
    return (
      <div className="fixed inset-0 z-[999] bg-black/50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-8">
          <div className="flex flex-col items-center justify-center">
            <div className="mb-4">
              <Loader className="h-8 w-8 text-blue-600 animate-spin" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">
              Eliminando...
            </h3>
            <p className="text-sm text-gray-600 text-center">
              Por favor espera mientras procesamos tu solicitud.
            </p>
            <div className="mt-6 w-full">
              <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const buttonColors = {
    red: "bg-red-600 hover:bg-red-700 focus:ring-red-500",
    orange: "bg-orange-600 hover:bg-orange-700 focus:ring-orange-500",
    blue: "bg-blue-600 hover:bg-blue-700 focus:ring-blue-500",
  };

  const accentColors = {
    red: "bg-red-50 border-red-200 text-red-700",
    orange: "bg-orange-50 border-orange-200 text-orange-700",
    blue: "bg-blue-50 border-blue-200 text-blue-700",
  };

  const buttonClass = buttonColors[confirmButtonColor] || buttonColors.red;
  const accentBg = accentColors[confirmButtonColor]?.split(' ')[0] || accentColors.red.split(' ')[0];
  const accentBorder = accentColors[confirmButtonColor]?.split(' ')[1] || accentColors.red.split(' ')[1];
  const accentText = accentColors[confirmButtonColor]?.split(' ')[2] || accentColors.red.split(' ')[2];

  return (
    <div className="fixed inset-0 z-[999] bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full animate-in fade-in duration-200 scale-in">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-200">
          <div className="flex items-start gap-3">
            <div className={`p-2.5 rounded-lg ${accentBg} ${accentBorder} border`}>
              <AlertTriangle className={`h-5 w-5 ${accentText}`} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{title}</h3>
            </div>
          </div>
          <button
            onClick={handleCancel}
            disabled={localLoading}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50 transition-colors p-1"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-sm text-gray-700 mb-4 leading-relaxed whitespace-pre-wrap">
            {message}
          </p>

          {itemName && (
            <div className={`p-3 rounded-lg border mb-4 ${accentBg} ${accentBorder} border ${accentText}`}>
              <p className="text-sm font-medium break-words">{itemName}</p>
            </div>
          )}

          {localError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 mb-4">
              <p className="text-sm text-red-700 font-medium">{localError}</p>
            </div>
          )}

          {!error && !localError && (
            <div className="p-3 rounded-lg bg-gray-50 border border-gray-200 mb-4">
              <p className="text-xs text-gray-600">
                <strong>⚠️ Nota:</strong> Esta acción no se puede deshacer.
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 p-6 border-t border-gray-200 bg-gray-50 rounded-b-lg">
          <button
            onClick={handleCancel}
            disabled={localLoading}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={localLoading}
            className={`flex-1 px-4 py-2.5 text-sm font-medium text-white rounded-lg shadow ${buttonClass} disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 inline-flex items-center justify-center gap-2`}
          >
            {localLoading ? (
              <>
                <Loader className="h-4 w-4 animate-spin" />
                Procesando...
              </>
            ) : (
              <>
                <AlertTriangle className="h-4 w-4" />
                {confirmButtonText}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmationModal;