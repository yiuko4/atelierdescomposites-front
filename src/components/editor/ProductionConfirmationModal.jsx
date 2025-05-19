import React from 'react';
import { calculateTotalPathLengthMm } from '../../utils/shapeUtils';

/**
 * Modale de confirmation avant de lancer la production.
 * Affiche la longueur totale de la forme.
 */
function ProductionConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  shape,
  svgUnitsPerMm,
}) {
  if (!isOpen || !shape) return null;

  const totalLength = calculateTotalPathLengthMm(
    shape.points,
    shape.type === 'polygon',
    svgUnitsPerMm
  );

  return (
    <div className="fixed inset-0 bg-gray-800 bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
        <h2 className="text-xl font-semibold mb-4">Confirmation avant Production</h2>
        
        <div className="mb-4">
          <p className="text-sm text-gray-700 mb-2">
            Veuillez vérifier la longueur totale de la pièce avant de lancer la production :
          </p>
          {totalLength > 0 ? (
            <p className="text-lg font-medium text-indigo-600 bg-gray-50 p-3 rounded">
              Longueur totale : {totalLength} mm
            </p>
          ) : (
            <p className="text-sm text-gray-500">Impossible de calculer la longueur.</p>
          )}
        </div>

        <p className="text-sm text-red-600 mb-6">
          Êtes-vous sûr de vouloir lancer la production pour cette pièce ?
        </p>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
          >
            Confirmer et Lancer
          </button>
        </div>
      </div>
    </div>
  );
}

export default ProductionConfirmationModal; 