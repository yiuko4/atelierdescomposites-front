import React from 'react';

/**
 * Composant de la barre d'outils pour l'éditeur
 * @param {Object} props - Propriétés du composant
 * @param {string} props.activeTool - Outil actif ('draw', 'pan', 'rectangle', 'square', 'circle')
 * @param {Function} props.setActiveTool - Fonction pour définir l'outil actif
 * @param {Function} props.onUndo - Fonction pour annuler la dernière action
 * @param {Function} props.onRedo - Fonction pour rétablir une action annulée
 * @param {Function} props.onDeleteAll - Fonction pour supprimer toutes les formes
 * @param {Function} props.onResetShape - Fonction pour réinitialiser la forme principale
 * @param {Function} props.onApplyRounding - Fonction pour appliquer l'arrondi
 * @param {Function} props.onTransformToAngle - Fonction pour transformer un sommet en angle composé
 * @param {number} props.roundingRadius - Rayon d'arrondi
 * @param {Function} props.setRoundingRadius - Fonction pour définir le rayon d'arrondi
 * @param {number} props.numSegmentsForCornerRounding - Nombre de segments pour l'arrondi
 * @param {Function} props.setNumSegmentsForCornerRounding - Fonction pour définir le nombre de segments
 * @param {boolean} props.isOrthogonalMode - Mode orthogonal activé
 * @param {Function} props.setIsOrthogonalMode - Fonction pour activer/désactiver le mode orthogonal
 * @param {boolean} props.hasTooSmallAngles - A des angles trop petits
 * @param {boolean} props.showProductionTracker - Afficher le suivi de production
 * @param {Function} props.setShowProductionTracker - Fonction pour afficher/masquer le suivi
 * @param {Function} props.onShowSaveModal - Fonction pour afficher le modal de sauvegarde
 * @param {Function} props.onStartProduction - Fonction pour lancer la production
 * @param {Function} props.onToggleSVGLibrary - Fonction pour afficher/masquer la bibliothèque SVG
 * @param {boolean} props.showSVGLibrary - Affichage de la bibliothèque SVG
 * @param {boolean} props.showGrid - Afficher la grille
 * @param {Function} props.setShowGrid - Fonction pour définir l'affichage de la grille
 * @param {boolean} props.showAxes - Afficher les axes
 * @param {Function} props.setShowAxes - Fonction pour définir l'affichage des axes
 * @param {boolean} props.showOriginMarker - Afficher l'origine
 * @param {Function} props.setShowOriginMarker - Fonction pour définir l'affichage de l'origine
 * @param {number} props.gridSpacingMm - Espacement de la grille en millimètres
 * @param {Function} props.setGridSpacingMm - Fonction pour définir l'espacement de la grille
 * @param {boolean} props.canFinishShape - Indique si une forme peut être finalisée
 * @param {Function} props.onFinishShape - Fonction pour finaliser une forme
 * @param {boolean} props.isInProduction - Indique si la forme est en cours de production
 * @returns {JSX.Element} Barre d'outils
 */
function Toolbar({
  activeTool,
  setActiveTool,
  onUndo,
  onRedo,
  onDeleteAll,
  onResetShape,
  onApplyRounding,
  onTransformToAngle,
  roundingRadius,
  setRoundingRadius,
  numSegmentsForCornerRounding,
  setNumSegmentsForCornerRounding,
  isOrthogonalMode,
  setIsOrthogonalMode,
  hasTooSmallAngles,
  showProductionTracker,
  setShowProductionTracker,
  onShowSaveModal,
  onStartProduction,
  onToggleSVGLibrary,
  showSVGLibrary,
  showGrid,
  setShowGrid,
  showAxes,
  setShowAxes,
  showOriginMarker,
  setShowOriginMarker,
  gridSpacingMm,
  setGridSpacingMm,
  canFinishShape,
  onFinishShape,
  isInProduction
}) {
  return (
    <div className="toolbar flex flex-col p-2 bg-gray-100 border-r border-gray-300 h-full overflow-y-auto">
      <div className="tools-group mb-4">
        <h3 className="font-bold text-sm mb-2">Navigation & Outils</h3>
        <div className="grid grid-cols-3 gap-2">
          <button
            className={`tool-btn p-2 rounded ${activeTool === 'selection' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
            onClick={() => setActiveTool('selection')}
            title="Sélectionner et modifier des formes"
          >
            Sélection
          </button>
          <button
            className={`tool-btn p-2 rounded ${activeTool === 'draw' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
            onClick={() => setActiveTool('draw')}
            title="Dessin à main levée"
          >
            Dessin
          </button>
          <button
            className={`tool-btn p-2 rounded ${activeTool === 'pan' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
            onClick={() => setActiveTool('pan')}
            title="Panoramique - Déplacer la vue"
          >
            Pan
          </button>
        </div>
      </div>

      <div className="history-group mb-4">
        <h3 className="font-bold text-sm mb-2">Historique</h3>
        <div className="grid grid-cols-2 gap-2">
          <button
            className="tool-btn p-2 rounded bg-gray-200"
            onClick={onUndo}
            title="Annuler (Ctrl+Z)"
          >
            Annuler
          </button>
          <button
            className="tool-btn p-2 rounded bg-gray-200"
            onClick={onRedo}
            title="Rétablir (Ctrl+Y)"
          >
            Rétablir
          </button>
        </div>
      </div>

      <div className="edit-group mb-4">
        <h3 className="font-bold text-sm mb-2">Édition</h3>
        <div className="grid grid-cols-2 gap-2">
          <button
            className="tool-btn p-2 rounded bg-gray-200"
            onClick={onDeleteAll}
            title="Supprimer toutes les formes"
          >
            Tout supprimer
          </button>
          <button
            className={`tool-btn p-2 rounded ${isOrthogonalMode ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
            onClick={() => setIsOrthogonalMode(!isOrthogonalMode)}
            title="Activer/désactiver le mode orthogonal"
          >
            Mode ortho
          </button>
        </div>
      </div>

      {/* Section pour finaliser une forme, visible uniquement quand une forme est en cours de dessin */}
      {canFinishShape && (
        <div className="finish-shape-group mb-4">
          <h3 className="font-bold text-sm mb-2">Actions</h3>
          <div className="flex flex-col gap-2">
            <button
              className="tool-btn p-2 rounded bg-green-500 text-white"
              onClick={onFinishShape}
              title="Finaliser la forme en cours de dessin (Entrée)"
            >
              Terminer Forme
            </button>
          </div>
        </div>
      )}

      <div className="rounding-group mb-4">
        <h3 className="font-bold text-sm mb-2">Arrondi des coins</h3>
        <div className="flex flex-col gap-2">
          <div className="flex items-center">
            <label className="mr-2 text-sm">Courbure (°):</label>
            <input
              type="number"
              min="0"
              max="89"
              value={roundingRadius}
              onChange={(e) => setRoundingRadius(Number(e.target.value))}
              className="p-1 border rounded w-full"
              title="Angle de 0° (pas de courbure) à 89° (courbure maximale)."
            />
          </div>
          <div className="flex items-center">
            <label className="mr-2 text-sm">Segments:</label>
            <input
              type="number"
              min="1"
              max="10"
              value={numSegmentsForCornerRounding}
              onChange={(e) => setNumSegmentsForCornerRounding(Number(e.target.value))}
              className="p-1 border rounded w-full"
            />
          </div>
          <button
            className="tool-btn p-2 rounded bg-gray-200 mt-1"
            onClick={onApplyRounding}
            title="Appliquer l'arrondi aux coins"
          >
            Appliquer l'arrondi
          </button>
        </div>
      </div>

      {/* Nouveau sous-menu pour la transformation des sommets en angles composés de segments */}
      <div className="angle-group mb-4">
        <h3 className="font-bold text-sm mb-2">Angles Composés</h3>
        <div className="flex flex-col gap-2">
          <div className="flex items-center">
            <label className="mr-2 text-sm">Courbure d'Angle (°):</label>
            <input
              type="number"
              min="0"
              max="89"
              value={roundingRadius}
              onChange={(e) => setRoundingRadius(Number(e.target.value))}
              className="p-1 border rounded w-full"
              title="Angle de 0° (pas de courbure) à 89° (courbure maximale)."
            />
          </div>
          <div className="flex items-center">
            <label className="mr-2 text-sm">Segments:</label>
            <input
              type="number"
              min="2"
              max="20"
              value={numSegmentsForCornerRounding}
              onChange={(e) => setNumSegmentsForCornerRounding(Number(e.target.value))}
              className="p-1 border rounded w-full"
            />
          </div>
          <button
            className="tool-btn p-2 rounded bg-indigo-600 text-white mt-1"
            onClick={onTransformToAngle}
            title="Transformer le sommet sélectionné en angle composé de segments"
          >
            Transformer en angle
          </button>
          <p className="text-xs text-gray-500 mt-1">
            Sélectionnez un sommet, puis transformez-le en angle composé de segments.
          </p>
        </div>
      </div>

      <div className="production-group mb-4">
        <h3 className="font-bold text-sm mb-2">Production</h3>
        <div className="flex flex-col gap-2">
          <button
            className={`tool-btn p-2 rounded ${
              isInProduction 
                ? 'bg-yellow-500 text-white'
                : hasTooSmallAngles 
                  ? 'bg-red-500 text-white' 
                  : 'bg-green-500 text-white'
            }`}
            onClick={onStartProduction}
            disabled={isInProduction || hasTooSmallAngles}
            title="Lancer la production de la forme"
          >
            {isInProduction 
              ? 'PRODUCTION EN COURS...' 
              : hasTooSmallAngles 
                ? 'ANGLES TROP PETITS' 
                : 'LANCER PRODUCTION'}
          </button>
        </div>
      </div>

      <div className="grid-group mb-4">
        <h3 className="font-bold text-sm mb-2">Grille & Affichage</h3>
        <div className="flex flex-col gap-2">
          <div className="flex items-center">
            <input
              type="checkbox"
              id="showGrid"
              checked={showGrid}
              onChange={(e) => setShowGrid(e.target.checked)}
              className="mr-2"
            />
            <label htmlFor="showGrid" className="text-sm">Afficher la grille</label>
          </div>
          
          <div className="flex items-center">
            <label className="mr-2 text-sm">Espacement (mm):</label>
            <input
              type="number"
              min="1"
              max="50"
              value={gridSpacingMm}
              onChange={(e) => setGridSpacingMm(Number(e.target.value))}
              className="p-1 border rounded w-full"
            />
          </div>
        </div>
      </div>

      <div className="library-group mb-4">
        <h3 className="font-bold text-sm mb-2">Bibliothèque</h3>
        <div className="flex flex-col gap-2">
          <button
            className="tool-btn p-2 rounded bg-gray-200"
            onClick={onShowSaveModal}
            title="Sauvegarder la forme actuelle"
          >
            Sauvegarder SVG
          </button>
          <button
            className={`tool-btn p-2 rounded ${showSVGLibrary ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
            onClick={onToggleSVGLibrary}
            title="Afficher/masquer la bibliothèque SVG"
          >
            {showSVGLibrary ? 'Masquer biblio' : 'Afficher biblio'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Toolbar; 