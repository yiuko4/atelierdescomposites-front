import React, { useCallback, useEffect, useRef, useState } from "react";
import SvgCanvas from "../SvgCanvas";
import Toolbar from "./Toolbar";
import Grid from "./Grid";
import { useNavigate } from 'react-router-dom';
import { useShapePersistence } from "../../hooks/useShapePersistence";
import { useKeyboardEvents } from "../../hooks/useKeyboardEvents";
import { useGrid } from "../../hooks/useGrid";
import { useViewBox } from "../../hooks/useViewBox";
import { useDrawingTools } from "../../hooks/useDrawingTools";
import { V } from "../../utils/vectorUtils";
import { 
  findNearestSegmentIndex, 
  isClickNearSegment, 
  insertPointOnSegment,
  calculateAngles,
  hasTooSmallAngles as checkTooSmallAngles,
  applyCornerRounding,
  transformVertexToAngle
} from "../../utils/shapeUtils";
import { 
  generateSvgContent, 
  saveSvgToLibrary 
} from "../../utils/svgUtils";
import { 
  SEGMENT_CLICK_THRESHOLD, 
  MOVE_THRESHOLD, 
  HOLD_DELAY,
  API_BASE_URL,
  MIN_ANGLE_FOR_PRODUCTION
} from "../../constants/config";

/**
 * Composant principal de l'éditeur de formes
 * @param {Object} props - Propriétés du composant
 * @param {Function} props.onShowSaveModal - Fonction pour afficher le modal de sauvegarde
 * @param {Function} props.onToggleSVGLibrary - Fonction pour afficher/masquer la bibliothèque SVG
 * @param {boolean} props.showSVGLibrary - Affichage de la bibliothèque SVG
 * @param {Function} props.onSaveSuccess - Fonction appelée après sauvegarde réussie
 * @returns {JSX.Element} Éditeur de formes
 */
function ShapeEditor({ 
  onShowSaveModal, 
  onToggleSVGLibrary,
  showSVGLibrary,
  onSaveSuccess
}) {
  const navigate = useNavigate();
  const svgCanvasRef = useRef(null);
  const vertexPressTimer = useRef(null);
  const vertexMouseDownInfo = useRef(null);
  const previousToolRef = useRef(null);
  
  // Tous les useState d'abord
  const [activeTool, setActiveTool] = useState('selection');
  const [isDrawingShape, setIsDrawingShape] = useState(false);
  const [currentPoints, setCurrentPoints] = useState([]);
  const [draggingVertexInfo, setDraggingVertexInfo] = useState(null);
  const [shapes, setShapesAndPersist] = useShapePersistence('persistedShapes', []);
  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);
  const [isUndoRedoAction, setIsUndoRedoAction] = useState(false);
  const [selectedShapeId, setSelectedShapeId] = useState(null);
  const [selectedPointIndex, setSelectedPointIndex] = useState(null);
  const [displayedAngles, setDisplayedAngles] = useState([]);
  const [snappedPreviewPoint, setSnappedPreviewPoint] = useState(null);
  const [isOrthogonalMode, setIsOrthogonalMode] = useState(false);
  const [previewShape, setPreviewShape] = useState(null);
  const [hasTooSmallAngles, setHasTooSmallAngles] = useState(false);
  const [roundingRadius, setRoundingRadius] = useState(5);
  const [numSegmentsForCornerRounding, setNumSegmentsForCornerRounding] = useState(4);
  const [isInProduction, setIsInProduction] = useState(false);
  const [svgUnitsPerMm, setSvgUnitsPerMm] = useState(6);
  const [tempPanActive, setTempPanActive] = useState(false);
  
  // Les hooks custom
  const { 
    showGrid, 
    setShowGrid,
    gridSpacingMm, 
    setGridSpacingMm,
    showAxes, 
    setShowAxes,
    showOriginMarker, 
    setShowOriginMarker,
    snapToGrid,
    calculateActualGridSpacing 
  } = useGrid();

  const {
    viewBoxCoords,
    isPanning,
    startPan,
    doPan,
    endPan,
    handleZoom,
    screenToSvgCoords
  } = useViewBox();

  // Fonction pour ajouter à l'historique
  const addToHistory = useCallback((currentState) => {
    if (isUndoRedoAction) return;
    setHistory(prev => [...prev, currentState]);
    setFuture([]);
  }, [isUndoRedoAction]);
  
  // Action d'annulation
  const handleUndo = useCallback(() => {
    if (history.length === 0) return;

    setIsUndoRedoAction(true);

    const lastAction = history[history.length - 1];
    const newHistory = history.slice(0, -1);

    setFuture(prev => [lastAction, ...prev]);
    setHistory(newHistory);

    // Traitement spécifique selon le type d'action
    if (lastAction.type === "shapes") {
      setShapesAndPersist(lastAction.shapes);
    }

    // Réinitialiser le flag après un court délai
    setTimeout(() => {
      setIsUndoRedoAction(false);
    }, 0);
  }, [history, setShapesAndPersist]);

  // Action de rétablissement
  const handleRedo = useCallback(() => {
    if (future.length === 0) return;

    setIsUndoRedoAction(true);

    const nextAction = future[0];
    const newFuture = future.slice(1);

    setHistory(prev => [...prev, nextAction]);
    setFuture(newFuture);

    // Traitement spécifique selon le type d'action
    if (nextAction.type === "shapes") {
      setShapesAndPersist(nextAction.shapes);
    }

    // Réinitialiser le flag après un court délai
    setTimeout(() => {
      setIsUndoRedoAction(false);
    }, 0);
  }, [future, setShapesAndPersist]);

  // Suppression de la forme sélectionnée (pour useKeyboardEvents)
  const deleteSelectedShape = useCallback(() => {
    if (!selectedShapeId) return;

    if (!window.confirm("Voulez-vous vraiment supprimer cette forme ?")) {
      return;
    }

    if (!isUndoRedoAction) {
      addToHistory({
        type: "shapes",
        shapes: JSON.parse(JSON.stringify(shapes)),
      });
    }

    setShapesAndPersist(prevShapes => 
      prevShapes.filter(shape => shape.id !== selectedShapeId)
    );
    
    setSelectedShapeId(null);
    setSelectedPointIndex(null);
  }, [selectedShapeId, shapes, addToHistory, isUndoRedoAction, setShapesAndPersist]);

  // Réinitialiser l'état du dessin en cours
  const resetDrawingState = useCallback(() => {
    setCurrentPoints([]);
    setSnappedPreviewPoint(null);
  }, []);

  const {
    drawingToolMode,
    activateShapeTool,
    deactivateShapeTool,
    handleShapeToolStart,
    updateShapePreview,
    finalizeShape: finalizeShapeTool,
    cancelShape,
  } = useDrawingTools((newShape) => {
    if (!isUndoRedoAction) {
      addToHistory({
        type: "shapes",
        shapes: JSON.parse(JSON.stringify(shapes)),
      });
    }
    setShapesAndPersist([...shapes, newShape]);
  });
  
  // Créer une ref pour isCtrlKeyPressed qui sera définie plus tard
  const isCtrlKeyPressedRef = useRef(false);

  // Le mode Pan effectif est soit le mode sélectionné, soit le mode temporaire
  const effectiveActiveTool = tempPanActive ? 'pan' : activeTool;

  // Mettre à jour les angles affichés quand les formes changent
  useEffect(() => {
    // Trouver la forme principale (polygone)
    const mainShape = shapes.find(shape => shape.type === 'polygon');
    
    if (mainShape && mainShape.points.length >= 3) {
      const angles = calculateAngles(mainShape.points);
      setDisplayedAngles(angles);
      setHasTooSmallAngles(checkTooSmallAngles(angles));
    } else {
      setDisplayedAngles([]);
      setHasTooSmallAngles(false);
    }
  }, [shapes]);

  // Effet pour gérer les événements de souris globaux lors du pan temporaire
  useEffect(() => {
    // Gestionnaire global pour le mousemove pendant le pan temporaire
    const handleGlobalMouseMove = (e) => {
      if (tempPanActive) {
        doPan(e, svgCanvasRef.current);
      }
    };

    // Gestionnaire global pour le mouseup pendant le pan temporaire
    const handleGlobalMouseUp = (e) => {
      if (tempPanActive && e.button === 1) {
        setTempPanActive(false);
        endPan();
      }
    };

    // Ajouter les écouteurs d'événements si le mode pan temporaire est actif
    if (tempPanActive) {
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);
    }

    // Nettoyer les écouteurs d'événements lors du démontage
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [tempPanActive, doPan, endPan]);

  // Finaliser la forme dessinée
  const finalizeShape = useCallback(() => {
    if (currentPoints.length < 2) return;

    const existingPrincipalShape = shapes.find(s => s.type === 'polygon' || s.type === 'polyline');
    if (existingPrincipalShape) {
      if (!window.confirm("Une forme principale existe déjà. Voulez-vous la remplacer par la nouvelle forme dessinée ?")) {
        return; // L'utilisateur a annulé le remplacement
      }
    }

    if (!isUndoRedoAction) {
      addToHistory({
        type: "shapes",
        shapes: JSON.parse(JSON.stringify(shapes)),
      });
    }

    let processedPoints = [...currentPoints];
    const isPolygon = processedPoints.length >= 3;

    const newShape = {
      id: `shape_drawn_${Date.now()}`,
      type: isPolygon ? "polygon" : "polyline",
      points: processedPoints,
      fill: isPolygon ? "rgba(0, 200, 100, 0.3)" : "none",
      stroke: "black",
      strokeWidth: 2,
    };

    setShapesAndPersist(prevShapes => {
      // Filtrer les anciennes formes principales
      const nonPrincipalShapes = prevShapes.filter(
        (s) => s.type !== "polygon" && s.type !== "polyline"
      );
      return [...nonPrincipalShapes, newShape];
    });

    setSelectedShapeId(newShape.id);
    resetDrawingState();
    
    // Passer automatiquement en mode sélection après la finalisation
    setActiveTool('selection');
  }, [
    currentPoints,
    shapes,
    resetDrawingState,
    addToHistory,
    isUndoRedoAction,
    setShapesAndPersist,
    setActiveTool
  ]);

  // Événement de clic sur le canevas
  const handleCanvasClick = useCallback((event) => {
    console.log("Canvas Click - Mode actif:", activeTool, "| Mode dessin:", drawingToolMode);
    
    // Vérifions si le clic provient d'un élément interactif comme un sommet
    // Si l'événement a une cible qui n'est pas le canvas lui-même, on ignore
    const targetElement = event.target;
    if (targetElement && targetElement.tagName && 
        ['circle', 'polygon', 'polyline', 'path'].includes(targetElement.tagName.toLowerCase())) {
      console.log("Clic sur un élément SVG interactif, pas sur le canvas");
      return; // Ne pas traiter comme un clic sur le canvas
    }
    
    // Si l'outil de dessin à main levée est actif
    if (activeTool === 'draw') {
      const svgCoords = screenToSvgCoords(event, svgCanvasRef.current);
      
      // Snap to grid si nécessaire
      const actualGridSpacing = calculateActualGridSpacing(svgUnitsPerMm);
      const snappedPoint = snapToGrid(svgCoords, actualGridSpacing, false, isCtrlKeyPressedRef.current);
      
      console.log("Dessin point:", snappedPoint);
      setCurrentPoints(prev => [...prev, snappedPoint]);
      return;
    }
    
    // Si un outil de dessin prédéfini est actif
    if (drawingToolMode) {
      const svgCoords = screenToSvgCoords(event, svgCanvasRef.current);
      
      // Snap to grid si nécessaire
      const actualGridSpacing = calculateActualGridSpacing(svgUnitsPerMm);
      const snappedPoint = snapToGrid(svgCoords, actualGridSpacing, false, isCtrlKeyPressedRef.current);
      
      if (!isDrawingShape) {
        console.log("Début dessin forme:", drawingToolMode);
        // Démarrer le dessin de la forme
        handleShapeToolStart(snappedPoint);
      } else {
        console.log("Finalisation forme:", drawingToolMode);
        // Finaliser la forme
        finalizeShapeTool();
        // Passer en mode sélection après avoir finalisé la forme
        setActiveTool('selection');
      }
      return;
    }
    
    // Si ni le mode dessin ni un outil de forme n'est actif, désélectionner la forme actuelle
    // Mais seulement si on a vraiment cliqué sur le canvas et pas sur un élément interactif
    if (activeTool === 'selection' && 
        event.target === event.currentTarget) { // Vérifier que la cible est le canvas lui-même
      console.log("Désélection - clic sur le fond du canvas");
      setSelectedShapeId(null);
      setSelectedPointIndex(null);
    }
  }, [
    activeTool, 
    drawingToolMode,
    isDrawingShape,
    screenToSvgCoords, 
    snapToGrid, 
    calculateActualGridSpacing, 
    svgUnitsPerMm, 
    isCtrlKeyPressedRef,
    handleShapeToolStart,
    finalizeShapeTool,
    setActiveTool
  ]);

  // Événement d'appui de souris sur le canevas
  const handleCanvasMouseDown = useCallback((event) => {
    if (activeTool === 'pan') {
      startPan(event);
    }
  }, [activeTool, startPan]);

  // Supprimer toutes les formes
  const deleteAllShapes = useCallback(() => {
    if (shapes.length === 0) return;
    
    if (!window.confirm("Voulez-vous vraiment supprimer toutes les formes ?")) {
      return;
    }

    if (!isUndoRedoAction) {
      addToHistory({
        type: "shapes",
        shapes: JSON.parse(JSON.stringify(shapes)),
      });
    }

    setShapesAndPersist([]);
    setSelectedShapeId(null);
    setSelectedPointIndex(null);
  }, [shapes, addToHistory, isUndoRedoAction, setShapesAndPersist]);

  // Réinitialiser la forme principale
  const resetPrincipalShape = useCallback(() => {
    const principalShape = shapes.find(s => s.type === 'polygon' || s.type === 'polyline');
    if (!principalShape) return;

    if (!window.confirm("Voulez-vous vraiment réinitialiser la forme principale ?")) {
      return;
    }

    if (!isUndoRedoAction) {
      addToHistory({
        type: "shapes",
        shapes: JSON.parse(JSON.stringify(shapes)),
      });
    }

    setShapesAndPersist(prevShapes => 
      prevShapes.filter(s => s.id !== principalShape.id)
    );
    
    setSelectedShapeId(null);
    setSelectedPointIndex(null);
  }, [shapes, addToHistory, isUndoRedoAction, setShapesAndPersist]);

  // Gérer le clic sur une forme
  const handleShapeClick = useCallback((shapeId) => {
    console.log("Clic sur forme:", shapeId, "| Mode actif:", activeTool);
    if (activeTool === 'selection') {
      setSelectedShapeId(shapeId);
      setSelectedPointIndex(null);
    }
  }, [activeTool]);

  // Gérer l'appui de souris sur un sommet
  const handleVertexMouseDown = useCallback((shapeId, pointIndex, event) => {
    if (activeTool === 'pan') return;
    
    event.stopPropagation();

    setSelectedShapeId(shapeId);
    setSelectedPointIndex(pointIndex);

    vertexMouseDownInfo.current = {
      shapeId,
      pointIndex,
      clientX: event.clientX,
      clientY: event.clientY,
    };

    // Démarrer le timer pour détecter un clic maintenu
    vertexPressTimer.current = setTimeout(() => {
      // Démarrer le glisser-déposer de vertex
      const selectedShape = shapes.find(s => s.id === shapeId);
      if (selectedShape) {
        setDraggingVertexInfo({
          shapeId,
          pointIndex,
          initialPos: { ...selectedShape.points[pointIndex] },
        });
      }
      vertexPressTimer.current = null;
    }, HOLD_DELAY);
  }, [activeTool, shapes]);

  // Gérer le déplacement de la souris sur le canevas
  const handleCanvasMouseMove = useCallback((event) => {
    // Si l'outil de panoramique est actif et en cours d'utilisation
    if (isPanning || tempPanActive) {
      doPan(event, svgCanvasRef.current);
      return;
    }

    const svgCoords = screenToSvgCoords(event, svgCanvasRef.current);
    const actualGridSpacing = calculateActualGridSpacing(svgUnitsPerMm);
    
    // Si un outil de dessin prédéfini est actif et en cours d'utilisation
    if (isDrawingShape) {
      const snappedPoint = snapToGrid(svgCoords, actualGridSpacing, false, isCtrlKeyPressedRef.current);
      updateShapePreview(snappedPoint);
      return;
    }

    // Gestion du glisser-déposer de vertex
    if (draggingVertexInfo) {
      const { shapeId, pointIndex } = draggingVertexInfo;
      
      // Snap to grid si nécessaire
      const snappedPoint = snapToGrid(svgCoords, actualGridSpacing, false, isCtrlKeyPressedRef.current);
      
      // Mise à jour de la position du vertex
      setShapesAndPersist(prevShapes => {
        return prevShapes.map(shape => {
          if (shape.id === shapeId) {
            const newPoints = [...shape.points];
            newPoints[pointIndex] = snappedPoint;
            return { ...shape, points: newPoints };
          }
          return shape;
        });
      });
      return;
    }

    // Annuler le timer de clic maintenu si la souris a bougé au-delà du seuil
    if (vertexMouseDownInfo.current && vertexPressTimer.current) {
      const dx = event.clientX - vertexMouseDownInfo.current.clientX;
      const dy = event.clientY - vertexMouseDownInfo.current.clientY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance > MOVE_THRESHOLD) {
        clearTimeout(vertexPressTimer.current);
        vertexPressTimer.current = null;
      }
    }

    // Gestion du point de prévisualisation pour l'outil de dessin à main levée
    if (activeTool === 'draw' && currentPoints.length > 0) {      
      // Calculer le point prévisualisé
      let previewPoint = { ...svgCoords };
      
      // Mode orthogonal
      if (isOrthogonalMode && currentPoints.length > 0) {
        const lastPoint = currentPoints[currentPoints.length - 1];
        const dx = Math.abs(svgCoords.x - lastPoint.x);
        const dy = Math.abs(svgCoords.y - lastPoint.y);
        
        if (dx > dy) {
          // Horizontal
          previewPoint = { x: svgCoords.x, y: lastPoint.y };
        } else {
          // Vertical
          previewPoint = { x: lastPoint.x, y: svgCoords.y };
        }
      }
      
      const snappedPoint = snapToGrid(previewPoint, actualGridSpacing, false, isCtrlKeyPressedRef.current);
      setSnappedPreviewPoint(snappedPoint);
    } else {
      setSnappedPreviewPoint(null);
    }
  }, [
    isPanning, 
    tempPanActive,
    doPan, 
    isDrawingShape, 
    screenToSvgCoords, 
    draggingVertexInfo, 
    activeTool, 
    isOrthogonalMode, 
    currentPoints, 
    snapToGrid, 
    calculateActualGridSpacing, 
    svgUnitsPerMm, 
    isCtrlKeyPressedRef,
    updateShapePreview,
    setShapesAndPersist
  ]);

  // Gérer l'appui sur un bouton de la souris
  const handleMouseDown = useCallback((event) => {
    // Détecter si c'est le bouton du milieu (roulette, button === 1)
    if (event.button === 1) {
      event.preventDefault(); // Empêcher le comportement par défaut du navigateur (souvent le scroll)
      
      // Sauvegarder l'outil actuel
      previousToolRef.current = activeTool;
      
      // Activer temporairement le mode pan
      setTempPanActive(true);
      
      // Simuler l'appui sur le canvas comme si on était en mode Pan
      startPan(event);
    }
  }, [activeTool, startPan]);

  // Gérer le relâchement d'un bouton de la souris
  const handleMouseUp = useCallback((event) => {
    // Si relâchement du bouton du milieu ET mode pan temporaire est actif
    if (event.button === 1 && tempPanActive) {
      // Restaurer l'outil précédent
      setTempPanActive(false);
      
      // Arrêter le mode pan
      endPan();
    }
    
    // Arrêter le timer de clic maintenu
    if (vertexPressTimer.current) {
      clearTimeout(vertexPressTimer.current);
      vertexPressTimer.current = null;
    }

    // Arrêter le glisser-déposer de vertex
    if (draggingVertexInfo) {
      if (!isUndoRedoAction) {
        // Ajouter à l'historique après déplacement complet
        addToHistory({
          type: "shapes",
          shapes: JSON.parse(JSON.stringify(shapes)),
        });
      }
      setDraggingVertexInfo(null);
    }

    // Arrêter le panoramique normal (pas celui temporaire)
    if (isPanning && !tempPanActive) {
      endPan();
    }
  }, [
    tempPanActive,
    draggingVertexInfo, 
    shapes, 
    addToHistory, 
    isUndoRedoAction, 
    isPanning, 
    endPan
  ]);

  // Gérer le clic droit sur un segment
  const handleSegmentRightClick = useCallback((shapeId, clickCoordsSvg) => {
    if (activeTool === 'pan') return;
    
    const shape = shapes.find(s => s.id === shapeId);
    if (!shape) return;

    // Trouver le segment le plus proche
    const segmentIndex = findNearestSegmentIndex(
      clickCoordsSvg,
      shape.points,
      shape.type === 'polygon',
      SEGMENT_CLICK_THRESHOLD
    );

    if (segmentIndex === null) return;

    // Déterminer la position du nouveau point
    let startPoint, endPoint;
    if (segmentIndex === shape.points.length - 1 && shape.type === 'polygon') {
      startPoint = shape.points[segmentIndex];
      endPoint = shape.points[0];
    } else {
      startPoint = shape.points[segmentIndex];
      endPoint = shape.points[segmentIndex + 1];
    }

    // Projeter le point de clic sur le segment
    const newPoint = V.projectPointOnSegment(clickCoordsSvg, startPoint, endPoint);

    // Ajouter le point dans la forme
    if (!isUndoRedoAction) {
      addToHistory({
        type: "shapes",
        shapes: JSON.parse(JSON.stringify(shapes)),
      });
    }

    setShapesAndPersist(prevShapes => {
      return prevShapes.map(s => {
        if (s.id === shapeId) {
          const newPoints = insertPointOnSegment(s.points, segmentIndex, newPoint);
          return { ...s, points: newPoints };
        }
        return s;
      });
    });

    // Sélectionner le nouveau point
    setSelectedShapeId(shapeId);
    setSelectedPointIndex(segmentIndex + 1);
  }, [activeTool, shapes, addToHistory, isUndoRedoAction, setShapesAndPersist]);

  // Appliquer l'arrondi aux coins de la forme
  const handleApplyRounding = useCallback(() => {
    if (!selectedShapeId) {
      alert("Veuillez sélectionner une forme pour appliquer l'arrondi.");
      return;
    }

    if (selectedPointIndex === null) {
      alert("Veuillez sélectionner un sommet à arrondir.");
      return;
    }

    const selectedShape = shapes.find(s => s.id === selectedShapeId);
    if (!selectedShape || (selectedShape.type !== 'polygon' && selectedShape.type !== 'polyline')) {
      alert("L'arrondi ne peut être appliqué qu'à un polygone ou une polyligne.");
      return;
    }

    // Vérifier si c'est une extrémité de polyligne (non supporté)
    if (selectedShape.type === 'polyline' && 
        (selectedPointIndex === 0 || selectedPointIndex === selectedShape.points.length - 1)) {
      alert("L'arrondi des extrémités d'une polyligne n'est pas encore supporté.");
      return;
    }

    if (!isUndoRedoAction) {
      addToHistory({
        type: "shapes",
        shapes: JSON.parse(JSON.stringify(shapes)),
      });
    }

    // Appliquer l'arrondi seulement au sommet sélectionné
    const roundedPoints = applyCornerRounding(
      selectedShape.points,
      roundingRadius,
      numSegmentsForCornerRounding,
      selectedPointIndex // Passer l'index du sommet sélectionné
    );

    // Mettre à jour la forme
    setShapesAndPersist(prevShapes => {
      return prevShapes.map(shape => {
        if (shape.id === selectedShapeId) {
          return { ...shape, points: roundedPoints };
        }
        return shape;
      });
    });
    
    // Désélectionner le point après l'arrondi
    setSelectedPointIndex(null);
  }, [
    selectedShapeId, 
    selectedPointIndex,
    shapes, 
    roundingRadius, 
    numSegmentsForCornerRounding, 
    addToHistory, 
    isUndoRedoAction, 
    setShapesAndPersist
  ]);

  // Transformer un sommet en angle composé de segments
  const handleTransformToAngle = useCallback(() => {
    if (!selectedShapeId) {
      alert("Veuillez sélectionner une forme pour transformer l'angle.");
      return;
    }

    if (selectedPointIndex === null) {
      alert("Veuillez sélectionner un sommet à transformer en angle.");
      return;
    }

    const selectedShape = shapes.find(s => s.id === selectedShapeId);
    if (!selectedShape || (selectedShape.type !== 'polygon' && selectedShape.type !== 'polyline')) {
      alert("La transformation d'angle ne peut être appliquée qu'à un polygone ou une polyligne.");
      return;
    }

    if (!isUndoRedoAction) {
      addToHistory({
        type: "shapes",
        shapes: JSON.parse(JSON.stringify(shapes)),
      });
    }

    // Transformer le sommet sélectionné en angle composé de segments
    const transformedPoints = transformVertexToAngle(
      selectedShape.points,
      roundingRadius,
      numSegmentsForCornerRounding,
      selectedPointIndex,
      selectedShape.type === 'polygon' // isPolygon
    );

    // Mettre à jour la forme
    setShapesAndPersist(prevShapes => {
      return prevShapes.map(shape => {
        if (shape.id === selectedShapeId) {
          return { ...shape, points: transformedPoints };
        }
        return shape;
      });
    });
    
    setSelectedPointIndex(null);
  }, [
    selectedShapeId, 
    selectedPointIndex,
    shapes, 
    roundingRadius, 
    numSegmentsForCornerRounding, 
    addToHistory, 
    isUndoRedoAction, 
    setShapesAndPersist
  ]);

  // Gérer le changement d'outil actif
  const handleToolChange = useCallback((toolName) => {
    // Réinitialiser l'état du dessin en cours
    resetDrawingState();
    
    if (toolName === 'rectangle' || toolName === 'square' || toolName === 'circle') {
      // Activer l'outil de forme prédéfinie
      activateShapeTool(toolName);
    } else {
      // Désactiver tout outil de forme prédéfinie si on passe à un autre outil
      deactivateShapeTool();
    }
    
    setActiveTool(toolName);
  }, [activateShapeTool, deactivateShapeTool, resetDrawingState]);

  /**
   * Génère le contenu SVG et affiche le modal de sauvegarde
   */
  const handleShowSaveModal = useCallback(() => {
    const svgContent = generateSvgContent(shapes, viewBoxCoords);
    if (!svgContent) {
      alert("Aucune forme à exporter.");
      return;
    }
    onShowSaveModal(svgContent);
  }, [shapes, viewBoxCoords, onShowSaveModal]);

  /**
   * Exporte la forme sélectionnée au format SVG et envoie à l'API pour production
   */
  const exportToSvg = async () => {
    const selectedShape = shapes.find((s) => s.id === selectedShapeId);
    if (!selectedShape || !selectedShape.points || selectedShape.points.length < 2) {
      alert(
        "Veuillez sélectionner une forme valide avec au moins 2 points pour l'exportation."
      );
      return;
    }
    
    if (hasTooSmallAngles) {
      alert("La forme contient des angles trop aigus. Veuillez les corriger avant de lancer la production.");
      return;
    }

    setIsInProduction(true);

    try {
      const svgPoints = selectedShape.points.map((p) => (`${p.x},${p.y}`)).join(' ');
      const svgWidth = viewBoxCoords.width;
      const svgHeight = viewBoxCoords.height;
      const svgContent = `<svg width="${svgWidth}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg"><polygon points="${svgPoints}" fill="none" stroke="black" /></svg>`;
      
      const blob = new Blob([svgContent], { type: "image/svg+xml" });
      const file = new File([blob], "shape.svg", { type: "image/svg+xml" });
      
      const formData = new FormData();
      formData.append("svgfile", file);
      formData.append("sendToApi", "true");
      formData.append("closePolygons", "true");

      const response = await fetch(
        `${API_BASE_URL}/api/direct/svg-to-sequence`,
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();

      if (data.success) {
        console.log("Export API réussi:", data);
        const jobId = data.pieceId || `job_${Date.now()}`;
        // Sauvegarder les formes avant de naviguer
        sessionStorage.setItem('persistedShapes', JSON.stringify(shapes));

        // Si onShowSaveModal est fourni, l'appeler pour permettre à l'utilisateur de sauvegarder la forme
        if (onShowSaveModal) {
          onShowSaveModal(svgContent);
        }
        
        // Rediriger vers la page de production
        navigate(`/production/${jobId}`);
      } else {
        console.error("Erreur d'export API:", data.message);
        alert(`Erreur lors de l'exportation (API): ${data.message}`);
        setIsInProduction(false);
      }
    } catch (error) {
      console.error("Erreur lors de l'export (catch):", error);
      alert("Une erreur est survenue lors de l'exportation.");
      setIsInProduction(false);
    }
  };

  // Sauvegarder dans la bibliothèque
  const handleSaveToLibrary = useCallback(async (pieceData) => {
    const svgContent = generateSvgContent(shapes, viewBoxCoords);
    if (!svgContent) {
      alert("Aucune forme à sauvegarder.");
      return;
    }

    try {
      const savedPiece = await saveSvgToLibrary(pieceData, svgContent);
      onSaveSuccess(savedPiece);
    } catch (error) {
      alert(`Erreur lors de la sauvegarde: ${error.message}`);
    }
  }, [shapes, viewBoxCoords, onSaveSuccess]);

  // Gérer le double-clic pour terminer un dessin à main levée
  const handleDoubleClick = useCallback((event) => {
    if (activeTool === 'draw' && currentPoints.length >= 2) {
      finalizeShape();
    }
  }, [activeTool, currentPoints, finalizeShape]);

  // Maintenant que toutes les fonctions sont définies, on peut utiliser le hook useKeyboardEvents
  useEffect(() => {
    const keyboardHandlers = {
      onUndo: handleUndo,
      onRedo: handleRedo,
      onDelete: () => {
        if (selectedShapeId) {
          deleteSelectedShape();
        }
      },
      onEscape: () => {
        // Si un outil de forme prédéfinie est en cours d'utilisation, annuler la forme
        if (isDrawingShape) {
          cancelShape();
        } 
        // Si on est en train de dessiner à main levée, réinitialiser les points
        else if (activeTool === 'draw' && currentPoints.length > 0) {
          resetDrawingState();
        } 
        // Sinon, revenir à l'outil de dessin
        else {
          deactivateShapeTool();
          setActiveTool('draw');
        }
      },
      onEnter: () => {
        // Finaliser une forme en cours de dessin à main levée
        if (activeTool === 'draw' && currentPoints.length >= 2) {
          finalizeShape();
        }
        // Finaliser une forme prédéfinie en cours de dessin
        else if (isDrawingShape) {
          finalizeShapeTool();
          setActiveTool('selection');
        }
      }
    };

    const handleKeyDown = (event) => {
      isCtrlKeyPressedRef.current = event.ctrlKey || event.metaKey;

      // Ctrl+Z pour annuler
      if ((event.ctrlKey || event.metaKey) && event.key === 'z' && !event.shiftKey) {
        event.preventDefault();
        keyboardHandlers.onUndo();
      }
      // Ctrl+Y ou Ctrl+Shift+Z pour rétablir
      else if (((event.ctrlKey || event.metaKey) && event.key === 'y') || 
               ((event.ctrlKey || event.metaKey) && event.key === 'z' && event.shiftKey)) {
        event.preventDefault();
        keyboardHandlers.onRedo();
      }
      // Supprimer/Delete pour supprimer
      else if (event.key === 'Delete' || event.key === 'Backspace') {
        keyboardHandlers.onDelete();
      }
      // Échap pour annuler/réinitialiser
      else if (event.key === 'Escape') {
        keyboardHandlers.onEscape();
      }
      // Entrée pour finaliser
      else if (event.key === 'Enter') {
        keyboardHandlers.onEnter();
      }
    };

    const handleKeyUp = (event) => {
      isCtrlKeyPressedRef.current = event.ctrlKey || event.metaKey;
    };

    // Ajouter les écouteurs d'événements
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Nettoyer les écouteurs d'événements lors du démontage
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [
    handleUndo, 
    handleRedo, 
    selectedShapeId, 
    deleteSelectedShape, 
    isDrawingShape, 
    cancelShape,
    activeTool, 
    currentPoints, 
    resetDrawingState, 
    deactivateShapeTool, 
    setActiveTool, 
    finalizeShape,
    finalizeShapeTool
  ]);

  return (
    <div className="editor-container flex h-full">
      {/* Barre d'outils */}
      <Toolbar
        activeTool={effectiveActiveTool}
        setActiveTool={handleToolChange}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onDeleteAll={deleteAllShapes}
        onResetShape={resetPrincipalShape}
        onApplyRounding={handleApplyRounding}
        onTransformToAngle={handleTransformToAngle}
        roundingRadius={roundingRadius}
        setRoundingRadius={setRoundingRadius}
        numSegmentsForCornerRounding={numSegmentsForCornerRounding}
        setNumSegmentsForCornerRounding={setNumSegmentsForCornerRounding}
        isOrthogonalMode={isOrthogonalMode}
        setIsOrthogonalMode={setIsOrthogonalMode}
        hasTooSmallAngles={hasTooSmallAngles}
        showProductionTracker={false}
        setShowProductionTracker={() => {}}
        onShowSaveModal={handleShowSaveModal}
        onStartProduction={exportToSvg}
        onToggleSVGLibrary={onToggleSVGLibrary}
        showSVGLibrary={showSVGLibrary}
        showGrid={showGrid}
        setShowGrid={setShowGrid}
        showAxes={showAxes}
        setShowAxes={setShowAxes}
        showOriginMarker={showOriginMarker}
        setShowOriginMarker={setShowOriginMarker}
        gridSpacingMm={gridSpacingMm}
        setGridSpacingMm={setGridSpacingMm}
        canFinishShape={(activeTool === 'draw' && currentPoints.length >= 2) || isDrawingShape}
        onFinishShape={() => {
          if (activeTool === 'draw' && currentPoints.length >= 2) {
            finalizeShape();
          } else if (isDrawingShape) {
            finalizeShapeTool();
            setActiveTool('selection');
          }
        }}
        isInProduction={isInProduction}
      />

      {/* Canvas SVG */}
      <div className="flex-grow relative">
        <SvgCanvas
          ref={svgCanvasRef}
          shapes={shapes}
          currentPoints={currentPoints}
          onCanvasMouseDown={handleCanvasMouseDown}
          onCanvasClick={handleCanvasClick}
          selectedShapeId={selectedShapeId}
          onShapeClick={handleShapeClick}
          selectedPointIndex={selectedPointIndex}
          onVertexMouseDown={handleVertexMouseDown}
          onSegmentRightClick={handleSegmentRightClick}
          onDoubleClick={handleDoubleClick}
          onFinishShape={finalizeShape}
          svgUnitsPerMm={svgUnitsPerMm}
          isDraggingVertex={!!draggingVertexInfo}
          snappedPreviewPoint={snappedPreviewPoint}
          isDrawing={activeTool === 'draw' || drawingToolMode !== null}
          displayedAngles={displayedAngles.map(angle => ({
            id: `angle-${angle.vertex.x}-${angle.vertex.y}`,
            x: angle.textPosition.x,
            y: angle.textPosition.y,
            value: Math.round(angle.angle)
          }))}
          previewShape={previewShape}
          showGrid={showGrid}
          gridSpacing={calculateActualGridSpacing(svgUnitsPerMm)}
          minAngleForProduction={MIN_ANGLE_FOR_PRODUCTION}
          showAxes={showAxes}
          showOriginMarker={showOriginMarker}
          viewBox={viewBoxCoords}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleMouseUp}
          gridConfig={{
            showGrid,
            gridSpacing: calculateActualGridSpacing(svgUnitsPerMm),
            showAxes,
            showOriginMarker
          }}
          activeTool={effectiveActiveTool}
          isPanning={isPanning}
        />
        {/* Capture des événements de souris sur toute la zone de l'éditeur */}
        <div 
          className="absolute inset-0" 
          style={{ pointerEvents: "none" }}
          onMouseDown={(e) => {
            // Ne capturer que les événements du bouton du milieu (molette)
            if (e.button === 1) {
              e.stopPropagation();
              e.preventDefault();
              e.currentTarget.style.pointerEvents = "auto";
              handleMouseDown(e);
            }
          }}
          onMouseUp={(e) => {
            // Ne capturer que les événements du bouton du milieu (molette)
            if (e.button === 1) {
              e.stopPropagation();
              e.preventDefault();
              e.currentTarget.style.pointerEvents = "none";
              handleMouseUp(e);
            }
          }}
          onMouseMove={(e) => {
            // Ne gérer le mousemove que si tempPanActive est true
            if (tempPanActive) {
              e.stopPropagation();
              handleCanvasMouseMove(e);
            }
          }}
        />
      </div>
    </div>
  );
}

export default ShapeEditor; 