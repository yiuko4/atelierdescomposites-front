import { useState, useCallback } from 'react';

/**
 * Hook personnalisé pour gérer le viewBox SVG (zoom et pan)
 * @param {Object} initialViewBox - ViewBox initial {x, y, width, height}
 * @returns {Object} - Fonctions et états pour manipuler le viewBox
 */
export function useViewBox(initialViewBox = { x: 0, y: 0, width: 800, height: 600 }) {
  const [viewBoxCoords, setViewBoxCoords] = useState(initialViewBox);
  const [isPanning, setIsPanning] = useState(false);
  const [panStartPoint, setPanStartPoint] = useState({
    screenX: 0,
    screenY: 0,
    initialViewBoxX: 0,
    initialViewBoxY: 0,
  });

  /**
   * Démarre le panoramique (pan)
   * @param {Object} event - Événement de souris
   */
  const startPan = useCallback((event) => {
    setIsPanning(true);
    setPanStartPoint({
      screenX: event.clientX,
      screenY: event.clientY,
      initialViewBoxX: viewBoxCoords.x,
      initialViewBoxY: viewBoxCoords.y,
    });
  }, [viewBoxCoords]);

  /**
   * Effectue le panoramique (pan)
   * @param {Object} event - Événement de souris
   * @param {HTMLElement} svgElement - Élément SVG de référence
   */
  const doPan = useCallback((event, svgElement) => {
    if (!isPanning || !svgElement) return;

    const rect = svgElement.getBoundingClientRect();
    const svgWidth = rect.width;
    const svgHeight = rect.height;

    // Calculer les facteurs d'échelle
    const scaleX = viewBoxCoords.width / svgWidth;
    const scaleY = viewBoxCoords.height / svgHeight;

    // Calculer le déplacement
    const dx = (event.clientX - panStartPoint.screenX) * scaleX;
    const dy = (event.clientY - panStartPoint.screenY) * scaleY;

    // Mettre à jour le viewBox
    setViewBoxCoords({
      ...viewBoxCoords,
      x: panStartPoint.initialViewBoxX - dx,
      y: panStartPoint.initialViewBoxY - dy,
    });
  }, [isPanning, panStartPoint, viewBoxCoords]);

  /**
   * Termine le panoramique (pan)
   */
  const endPan = useCallback(() => {
    setIsPanning(false);
  }, []);

  /**
   * Effectue un zoom
   * @param {Object} event - Événement de molette
   * @param {HTMLElement} svgElement - Élément SVG de référence
   */
  const handleZoom = useCallback((event, svgElement) => {
    event.preventDefault();
    
    if (!svgElement) return;

    // Facteur de zoom, négatif pour inverser le sens du défilement
    const zoomFactor = event.deltaY > 0 ? 1.1 : 0.9;

    // Obtenir les coordonnées du curseur par rapport au SVG
    const rect = svgElement.getBoundingClientRect();
    const svgPointX = event.clientX - rect.left;
    const svgPointY = event.clientY - rect.top;

    // Convertir les coordonnées en points dans le système de coordonnées du viewBox
    const scaleX = viewBoxCoords.width / rect.width;
    const scaleY = viewBoxCoords.height / rect.height;
    const viewBoxX = viewBoxCoords.x + svgPointX * scaleX;
    const viewBoxY = viewBoxCoords.y + svgPointY * scaleY;

    // Calculer la nouvelle taille du viewBox
    const newWidth = viewBoxCoords.width * zoomFactor;
    const newHeight = viewBoxCoords.height * zoomFactor;

    // Calculer la nouvelle position du viewBox pour maintenir le point sous le curseur
    const newViewBoxX = viewBoxX - (viewBoxX - viewBoxCoords.x) * zoomFactor;
    const newViewBoxY = viewBoxY - (viewBoxY - viewBoxCoords.y) * zoomFactor;

    // Mettre à jour le viewBox
    setViewBoxCoords({
      x: newViewBoxX,
      y: newViewBoxY,
      width: newWidth,
      height: newHeight,
    });
  }, [viewBoxCoords]);

  /**
   * Réinitialise le viewBox à sa taille initiale
   */
  const resetViewBox = useCallback(() => {
    setViewBoxCoords(initialViewBox);
  }, [initialViewBox]);

  /**
   * Convertit les coordonnées de l'écran en coordonnées SVG
   * @param {Object} screenCoords - Coordonnées écran {clientX, clientY}
   * @param {HTMLElement} svgElement - Élément SVG de référence
   * @returns {Object} Coordonnées SVG {x, y}
   */
  const screenToSvgCoords = useCallback((screenCoords, svgElement) => {
    if (!svgElement) {
      return { x: 0, y: 0 };
    }
    
    const rect = svgElement.getBoundingClientRect();
    const scaleX = viewBoxCoords.width / rect.width;
    const scaleY = viewBoxCoords.height / rect.height;

    // Créer un point SVG pour une conversion précise tenant compte de toutes les transformations
    const point = svgElement.createSVGPoint();
    point.x = screenCoords.clientX;
    point.y = screenCoords.clientY;
    
    // Convertir le point en utilisant la matrice de transformation du SVG
    try {
      // Obtenir la matrice de transformation inverse du SVG
      const CTM = svgElement.getScreenCTM();
      if (CTM) {
        const inverseCTM = CTM.inverse();
        const transformedPoint = point.matrixTransform(inverseCTM);
        return {
          x: transformedPoint.x,
          y: transformedPoint.y
        };
      }
    } catch (e) {
      console.error("Erreur lors de la conversion des coordonnées :", e);
    }
    
    // Fallback à la méthode manuelle si la méthode avec SVGMatrix échoue
    return {
      x: viewBoxCoords.x + (screenCoords.clientX - rect.left) * scaleX,
      y: viewBoxCoords.y + (screenCoords.clientY - rect.top) * scaleY,
    };
  }, [viewBoxCoords]);

  return {
    viewBoxCoords,
    isPanning,
    startPan,
    doPan,
    endPan,
    handleZoom,
    resetViewBox,
    screenToSvgCoords,
  };
} 