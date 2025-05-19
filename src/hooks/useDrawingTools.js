import { useState, useCallback } from 'react';

/**
 * Hook personnalisé pour gérer les outils de dessin de formes prédéfinies
 * @param {Function} addShape - Fonction pour ajouter une forme à l'état
 * @returns {Object} - Fonctions et états pour manipuler les outils de dessin
 */
export function useDrawingTools(addShape) {
  // État de l'outil de dessin actif
  const [drawingToolMode, setDrawingToolMode] = useState(null); // 'rectangle', 'square', 'circle', ou null
  
  // État du point de départ de la création de forme
  const [shapeCreationStartPoint, setShapeCreationStartPoint] = useState(null);
  
  // État de la prévisualisation de la forme en cours de création
  const [previewShape, setPreviewShape] = useState(null);

  /**
   * Active un outil de dessin de forme prédéfinie
   * @param {string} toolName - Nom de l'outil ('rectangle', 'square', 'circle')
   */
  const activateShapeTool = useCallback((toolName) => {
    setDrawingToolMode(prev => prev === toolName ? null : toolName);
    setShapeCreationStartPoint(null);
    setPreviewShape(null);
  }, []);

  /**
   * Désactive l'outil de dessin de forme prédéfinie actif
   */
  const deactivateShapeTool = useCallback(() => {
    setDrawingToolMode(null);
    setShapeCreationStartPoint(null);
    setPreviewShape(null);
  }, []);

  /**
   * Démarre le dessin d'une forme prédéfinie
   * @param {Object} point - Point de départ {x, y}
   */
  const handleShapeToolStart = useCallback((point) => {
    if (!drawingToolMode) return;
    
    setShapeCreationStartPoint(point);

    // Initialiser la prévisualisation avec le point de départ
    if (drawingToolMode === 'rectangle' || drawingToolMode === 'square') {
      setPreviewShape({
        type: drawingToolMode,
        x: point.x,
        y: point.y,
        width: 0,
        height: 0,
        x1: point.x,
        y1: point.y,
        x2: point.x,
        y2: point.y
      });
    } else if (drawingToolMode === 'circle') {
      setPreviewShape({
        type: 'circle',
        cx: point.x,
        cy: point.y,
        r: 0,
        x1: point.x,
        y1: point.y,
        x2: point.x,
        y2: point.y
      });
    }
  }, [drawingToolMode]);

  /**
   * Met à jour la prévisualisation de la forme en cours de création
   * @param {Object} point - Point actuel de la souris {x, y}
   */
  const updateShapePreview = useCallback((point) => {
    if (!drawingToolMode || !shapeCreationStartPoint) return;

    if (drawingToolMode === 'rectangle') {
      setPreviewShape({
        type: 'rectangle',
        x: Math.min(shapeCreationStartPoint.x, point.x),
        y: Math.min(shapeCreationStartPoint.y, point.y),
        width: Math.abs(point.x - shapeCreationStartPoint.x),
        height: Math.abs(point.y - shapeCreationStartPoint.y),
        x1: shapeCreationStartPoint.x,
        y1: shapeCreationStartPoint.y,
        x2: point.x,
        y2: point.y
      });
    } else if (drawingToolMode === 'square') {
      const side = Math.max(
        Math.abs(point.x - shapeCreationStartPoint.x),
        Math.abs(point.y - shapeCreationStartPoint.y)
      );
      
      const xSign = point.x >= shapeCreationStartPoint.x ? 1 : -1;
      const ySign = point.y >= shapeCreationStartPoint.y ? 1 : -1;
      
      const x2 = shapeCreationStartPoint.x + side * xSign;
      const y2 = shapeCreationStartPoint.y + side * ySign;

      setPreviewShape({
        type: 'square',
        x: Math.min(shapeCreationStartPoint.x, x2),
        y: Math.min(shapeCreationStartPoint.y, y2),
        width: side,
        height: side,
        x1: shapeCreationStartPoint.x,
        y1: shapeCreationStartPoint.y,
        x2: point.x, // Pour feedback visuel
        y2: point.y
      });
    } else if (drawingToolMode === 'circle') {
      const dx = point.x - shapeCreationStartPoint.x;
      const dy = point.y - shapeCreationStartPoint.y;
      const radius = Math.sqrt(dx * dx + dy * dy);

      setPreviewShape({
        type: 'circle',
        cx: shapeCreationStartPoint.x,
        cy: shapeCreationStartPoint.y,
        r: radius,
        x1: shapeCreationStartPoint.x,
        y1: shapeCreationStartPoint.y,
        x2: point.x,
        y2: point.y
      });
    }
  }, [drawingToolMode, shapeCreationStartPoint]);

  /**
   * Finalise la création d'une forme
   */
  const finalizeShape = useCallback(() => {
    if (!previewShape || !drawingToolMode || !shapeCreationStartPoint) return;

    // Convertir la forme prédéfinie en polygon
    let points = [];

    if (previewShape.type === 'rectangle' || previewShape.type === 'square') {
      if (previewShape.width === 0 || previewShape.height === 0) {
        // Ne pas créer de forme si les dimensions sont nulles
        setShapeCreationStartPoint(null);
        setPreviewShape(null);
        return;
      }
      
      // Rectangle ou carré -> 4 points
      points = [
        { x: previewShape.x, y: previewShape.y },
        { x: previewShape.x + previewShape.width, y: previewShape.y },
        { x: previewShape.x + previewShape.width, y: previewShape.y + previewShape.height },
        { x: previewShape.x, y: previewShape.y + previewShape.height }
      ];
    } else if (previewShape.type === 'circle') {
      if (previewShape.r === 0) {
        // Ne pas créer de cercle si le rayon est nul
        setShapeCreationStartPoint(null);
        setPreviewShape(null);
        return;
      }
      
      // Cercle -> discrétiser en points
      const numSegments = 24;
      for (let i = 0; i < numSegments; i++) {
        const angle = (i / numSegments) * 2 * Math.PI;
        points.push({
          x: previewShape.cx + previewShape.r * Math.cos(angle),
          y: previewShape.cy + previewShape.r * Math.sin(angle)
        });
      }
    }

    // Ajouter la forme finale
    addShape({
      id: `shape_${drawingToolMode}_${Date.now()}`,
      type: 'polygon', // Toutes les formes sont converties en polygones
      points: points,
      fill: previewShape.fill || 'rgba(0, 200, 100, 0.3)',
      stroke: previewShape.stroke || 'black',
      strokeWidth: previewShape.strokeWidth || 2,
    });

    // Réinitialiser l'état pour permettre de dessiner une nouvelle forme
    // mais garder le mode de dessin actif
    setShapeCreationStartPoint(null);
    setPreviewShape(null);
    
    // On garde drawingToolMode actif pour permettre de dessiner plusieurs formes
  }, [previewShape, drawingToolMode, shapeCreationStartPoint, addShape]);

  /**
   * Annule la création d'une forme en cours
   */
  const cancelShape = useCallback(() => {
    setShapeCreationStartPoint(null);
    setPreviewShape(null);
    // Ne pas désactiver l'outil pour permettre de recommencer
  }, []);

  // Vérifie si on est en train de dessiner une forme
  const isDrawingShape = shapeCreationStartPoint !== null && previewShape !== null;

  return {
    drawingToolMode,
    previewShape,
    activateShapeTool,
    deactivateShapeTool,
    handleShapeToolStart,
    updateShapePreview,
    finalizeShape,
    cancelShape,
    isDrawingShape
  };
} 