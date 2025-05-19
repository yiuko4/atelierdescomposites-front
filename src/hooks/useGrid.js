import { useState, useCallback } from 'react';

/**
 * Hook personnalisé pour gérer la grille et le snap-to-grid
 * @returns {Object} - Fonctions et états pour manipuler la grille
 */
export function useGrid() {
  const [showGrid, setShowGrid] = useState(true);
  const [gridSpacingMm, setGridSpacingMm] = useState(10);
  const [showAxes, setShowAxes] = useState(true);
  const [showOriginMarker, setShowOriginMarker] = useState(true);

  /**
   * Calcule l'espacement réel de la grille en unités SVG
   * @param {number} svgUnitsPerMm - Facteur de conversion entre mm et unités SVG
   * @returns {number} - Espacement de la grille en unités SVG
   */
  const calculateActualGridSpacing = useCallback((svgUnitsPerMm) => {
    return gridSpacingMm * svgUnitsPerMm;
  }, [gridSpacingMm]);

  /**
   * Applique un snap-to-grid à un point
   * @param {Object} point - Point à snapper {x, y}
   * @param {number} actualGridSpacing - Espacement de la grille en unités SVG
   * @param {boolean} forceSnap - Forcer le snap même si isCtrlPressed est false
   * @param {boolean} isCtrlPressed - Indique si la touche Ctrl est enfoncée
   * @returns {Object} - Point snappé {x, y}
   */
  const snapToGrid = useCallback((point, actualGridSpacing, forceSnap = false, isCtrlPressed = false) => {
    if (!showGrid || (!forceSnap && !isCtrlPressed) || actualGridSpacing <= 0) {
      return point;
    }
    
    return {
      x: Math.round(point.x / actualGridSpacing) * actualGridSpacing,
      y: Math.round(point.y / actualGridSpacing) * actualGridSpacing,
    };
  }, [showGrid]);

  return {
    showGrid,
    setShowGrid,
    gridSpacingMm,
    setGridSpacingMm,
    showAxes,
    setShowAxes,
    showOriginMarker,
    setShowOriginMarker,
    calculateActualGridSpacing,
    snapToGrid,
  };
} 