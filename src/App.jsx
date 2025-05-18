import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from 'react-router-dom';
import PieceCreationVisualizer from "./components/PieceCreationVisualizer";
import SvgCanvas from "./components/SvgCanvas";
import ProductionTracker from "./components/ProductionTracker";
import SaveSVGModal from './components/SaveSVGModal';
import SVGLibraryPanel from './components/SVGLibraryPanel';
import "./index.css";

// Base URLs from environment variables with fallbacks
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:30001';
const EMPORTEPIECE_WS_URL = import.meta.env.VITE_EMPORTEPIECE_WS_URL || 'http://localhost:3000';

// --- Fonctions utilitaires pour la géométrie vectorielle ---
const V = {
  subtract: (p1, p2) => ({ x: p1.x - p2.x, y: p1.y - p2.y }),
  add: (p1, p2) => ({ x: p1.x + p2.x, y: p1.y + p2.y }),
  scale: (p, s) => ({ x: p.x * s, y: p.y * s }),
  magnitude: (p) => Math.sqrt(p.x * p.x + p.y * p.y),
  normalize: (p) => {
    const m = V.magnitude(p);
    return m === 0 ? { x: 0, y: 0 } : V.scale(p, 1 / m);
  },
  dot: (p1, p2) => p1.x * p2.x + p1.y * p2.y,
  distance: (p1, p2) => V.magnitude(V.subtract(p1, p2)),
  // Perpendiculaire (rotation 90 deg CCW)
  perpendicular: (p) => ({ x: -p.y, y: p.x }),
  // Angle d'un vecteur par rapport à l'axe X positif
  angle: (p) => Math.atan2(p.y, p.x),
  // Produit vectoriel 2D (z-component du produit vectoriel 3D)
  // Positif si p1 -> p2 est une rotation CCW
  cross: (p1, p2) => p1.x * p2.y - p1.y * p2.x,
  // Projette le point P sur le segment [A, B]
  projectPointOnSegment: (P, A, B) => {
    const l2 = V.distance(A, B) * V.distance(A, B);
    if (l2 === 0) return A; // A et B sont confondus
    let t = ((P.x - A.x) * (B.x - A.x) + (P.y - A.y) * (B.y - A.y)) / l2;
    t = Math.max(0, Math.min(1, t)); // Clamp t pour que la projection soit sur le segment
    return {
      x: A.x + t * (B.x - A.x),
      y: A.y + t * (B.y - A.y),
    };
  },
  // Calcule la distance du point P au segment [A, B]
  distancePointToSegment: (P, A, B) => {
    const projection = V.projectPointOnSegment(P, A, B);
    return V.distance(P, projection);
  },
};
// --- Fin des fonctions utilitaires ---

const MOVE_THRESHOLD = 5; // Pixels
const HOLD_DELAY = 100; // Millisecondes

const TEXT_OFFSET_FOR_ANGLES = 15; // Décalage pour l'affichage du texte des angles
const MIN_ANGLE_FOR_PRODUCTION = 65; // Angle minimum requis pour la production

function App() {
  const navigate = useNavigate();
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [etapes, setEtapes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/etape-test.json")
      .then((res) => {
        if (!res.ok) throw new Error("Erreur chargement JSON");
        return res.json();
      })
      .then((data) => {
        setEtapes(data);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError(err.message);
        setIsLoading(false);
      });
  }, []);

  const [shapes, setShapes] = useState(() => {
    const savedShapes = sessionStorage.getItem('persistedShapes');
    try {
      return savedShapes ? JSON.parse(savedShapes) : [];
    } catch (e) {
      console.error("Failed to parse persisted shapes:", e);
      sessionStorage.removeItem('persistedShapes'); // Clear corrupted data
      return [];
    }
  });

  const [currentPoints, setCurrentPoints] = useState([]);
  const [selectedShapeId, setSelectedShapeId] = useState(null);
  const [selectedPointIndex, setSelectedPointIndex] = useState(null);
  const [roundingRadius, setRoundingRadius] = useState(5);
  const [svgUnitsPerMm, setSvgUnitsPerMm] = useState(6);
  const [draggingVertexInfo, setDraggingVertexInfo] = useState(null);
  const [isOrthogonalMode, setIsOrthogonalMode] = useState(false);
  const [snappedPreviewPoint, setSnappedPreviewPoint] = useState(null);
  const [isInProduction, setIsInProduction] = useState(false); // Nouvel état pour la production
  const [showProductionTracker, setShowProductionTracker] = useState(false); // État pour afficher le suivi de production
  const [showSaveModal, setShowSaveModal] = useState(false); // État pour afficher le modal de sauvegarde SVG
  const [showSVGLibrary, setShowSVGLibrary] = useState(true); // État pour afficher la bibliothèque SVG dans le panneau de gauche

  // États pour l'annulation et le rétablissement
  const [history, setHistory] = useState([]); // Historique des états précédents
  const [future, setFuture] = useState([]); // Historique des états annulés (pour rétablir)
  const [isUndoRedoAction, setIsUndoRedoAction] = useState(false); // Flag pour éviter d'ajouter les actions d'annulation/rétablissement elles-mêmes à l'historique
  const [displayedAngles, setDisplayedAngles] = useState([]);
  const [hasTooSmallAngles, setHasTooSmallAngles] = useState(false); // Nouvel état pour les angles trop petits

  const [activeProductionJobId, setActiveProductionJobId] = useState(null); // Nouvel état pour la tâche active

  // États pour les outils de dessin de formes prédéfinies (restaurés)
  const [drawingToolMode, setDrawingToolMode] = useState(null); // 'rectangle', 'square', 'circle', ou null
  const [shapeCreationStartPoint, setShapeCreationStartPoint] = useState(null); // {x, y}
  const [previewShape, setPreviewShape] = useState(null); // Object décrivant la forme en prévisualisation

  const svgCanvasRef = useRef(null);
  const vertexPressTimer = useRef(null); // Pour le délai du clic maintenu
  const vertexMouseDownInfo = useRef(null); // { shapeId, pointIndex, clientX, clientY }

  const SEGMENT_CLICK_THRESHOLD = 10; // En unités SVG

  // Fonction pour ajouter l'état actuel à l'historique
  const addToHistory = useCallback(
    (currentState) => {
      if (isUndoRedoAction) return;
      setHistory((prev) => [...prev, currentState]);
      setFuture([]);
    },
    [isUndoRedoAction]
  );

  useEffect(() => {
    const savedShapes = sessionStorage.getItem('persistedShapes');
    if (savedShapes) {
      try {
        const parsedShapes = JSON.parse(savedShapes);
        if (parsedShapes.length > 0 && history.length === 0) {
            // If history is empty and we have shapes, consider this the initial state for history
            // This avoids an empty undo step if shapes are loaded from storage.
            // Note: This might need adjustment based on how/when addToHistory is first called.
        }
      } catch (e) {
        // already handled by useState initializer
      }
    }
  }, []); // Run once on mount

  const setShapesAndPersist = (newShapesOrCallback) => {
    setShapes(prevShapes => {
      const newActualShapes = typeof newShapesOrCallback === 'function' ? newShapesOrCallback(prevShapes) : newShapesOrCallback;
      sessionStorage.setItem('persistedShapes', JSON.stringify(newActualShapes));
      return newActualShapes;
    });
  };

  const resetDrawingState = useCallback(() => {
    setCurrentPoints([]);
    setSnappedPreviewPoint(null);
  }, []);

  const finalizeShape = useCallback(() => {
    if (currentPoints.length < 2) return;

    if (!isUndoRedoAction) {
      addToHistory({
        type: "shapes",
        shapes: JSON.parse(JSON.stringify(shapes)),
      });
    }

    let processedPoints = [...currentPoints];
    const initialNumPoints = currentPoints.length;
    const isInitiallyPolygon = initialNumPoints >= 3;

    const newShape = {
      id: `shape${shapes.length + 1}`,
      type: isInitiallyPolygon ? "polygon" : "polyline",
      points: processedPoints,
      fill: isInitiallyPolygon ? "rgba(0, 200, 100, 0.3)" : "none",
      stroke: "black",
      strokeWidth: 2,
    };

    const otherShapes = shapes.filter(
      (s) => s.type !== "polygon" && s.type !== "polyline"
    );

    setShapesAndPersist([...otherShapes, newShape]);
    setSelectedShapeId(newShape.id);
    resetDrawingState();
  }, [
    currentPoints,
    shapes,
    resetDrawingState,
    addToHistory,
    isUndoRedoAction,
  ]);

  // Fonctions d'annulation et de rétablissement
  const handleUndo = useCallback(() => {
    if (history.length === 0) return;

    setIsUndoRedoAction(true);

    const lastAction = history[history.length - 1];
    const newHistory = history.slice(0, -1);

    // Sauvegarder l'état actuel (avant l'annulation) pour le rétablissement (redo)
    setFuture((prev) => [
      ...prev,
      {
        type: lastAction.type,
        data:
          lastAction.type === "drawing"
            ? [...currentPoints] // État actuel de currentPoints
            : JSON.parse(JSON.stringify(shapes)), // État actuel de shapes
      },
    ]);

    if (lastAction.type === "drawing") {
      // Restaurer l'état précédent des points directement
      setCurrentPoints(lastAction.points);
    } else if (lastAction.type === "shapes") {
      // Si c'est une action sur les formes, on revient à l'état précédent des formes
      // Il faut trouver la dernière entrée 'shapes' dans le nouvel historique
      const previousShapeState = newHistory
        .filter((h) => h.type === "shapes")
        .pop();
      if (previousShapeState) {
        setShapesAndPersist(previousShapeState.shapes);
      } else {
        // S'il n'y a pas d'état de forme précédent dans l'historique (ex: on a annulé jusqu'au début du dessin des formes)
        // On cherche le premier état de forme dans l'historique original s'il y en avait un, sinon on vide.
        const firstShapeStateInHistory = history.find(
          (h) => h.type === "shapes"
        );
        if (newHistory.length === 0 && !firstShapeStateInHistory) {
          setShapesAndPersist([]); // Aucune forme dans l'historique initial
        } else if (newHistory.filter((h) => h.type === "shapes").length === 0) {
          // Si le newHistory ne contient plus de 'shapes', cela veut dire qu'on a annulé toutes les modifs de shapes
          // Il faut potentiellement revenir à un état où shapes était vide ou à son état initial si enregistré.
          // Pour l'instant, si aucun 'shapes' dans newHistory, on vide. On pourrait affiner.
          setShapesAndPersist([]);
        }
        // Si previousShapeState est null mais newHistory contient encore des actions de dessin,
        // on ne change pas les shapes, car elles ont pu être établies avant ces actions de dessin.
      }
    }

    setHistory(newHistory);

    setTimeout(() => setIsUndoRedoAction(false), 10);
  }, [history, currentPoints, shapes, addToHistory]);

  const handleRedo = useCallback(() => {
    if (future.length === 0) return;

    setIsUndoRedoAction(true);

    const nextAction = future[future.length - 1];
    const newFuture = future.slice(0, -1);

    if (nextAction.type === "drawing") {
      setCurrentPoints(nextAction.data);
    } else if (nextAction.type === "shapes") {
      setShapesAndPersist(nextAction.data);
    }

    setFuture(newFuture);

    // Réinitialiser le flag après un court délai
    setTimeout(() => setIsUndoRedoAction(false), 10);
  }, [future, shapes, addToHistory]);

  // Gestionnaire pour les raccourcis clavier (combiné et corrigé)
  useEffect(() => {
    const handleKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "z") {
        event.preventDefault();
        handleUndo();
      }

      if ((event.ctrlKey || event.metaKey) && event.key === "y") {
        event.preventDefault();
        handleRedo();
      }

      if (event.key === "Enter") {
        if (
          currentPoints.length >= 2 &&
          !draggingVertexInfo &&
          !selectedShapeId // S'assurer qu'aucune forme n'est déjà sélectionnée pour finaliser (évite conflit avec sélection)
        ) {
          finalizeShape(); // Maintenant défini avant cet useEffect
          event.preventDefault();
        }
      }

      // Logique pour supprimer un sommet sélectionné
      // Vérifier si l'on est dans un élément de saisie (input, textarea, etc.)
      const targetTagName = event.target.tagName.toLowerCase();
      const isEditingInput =
        targetTagName === "input" ||
        targetTagName === "textarea" ||
        event.target.isContentEditable;

      if (
        !isEditingInput && // Ne pas supprimer de sommet si on est en train d'éditer un champ
        (event.key === "Backspace" || event.key === "Delete") &&
        selectedShapeId &&
        selectedPointIndex !== null
      ) {
        event.preventDefault();

        if (!isUndoRedoAction) {
          addToHistory({
            type: "shapes",
            shapes: JSON.parse(JSON.stringify(shapes)),
          });
        }

        setShapesAndPersist(prevShapes => {
          const newShapes = prevShapes.map((shape) => {
            if (shape.id === selectedShapeId) {
              const newPoints = [...shape.points];
              newPoints.splice(selectedPointIndex, 1);

              // Si la forme a trop peu de points, la supprimer
              if (
                (shape.type === "polyline" && newPoints.length < 2) ||
                (shape.type === "polygon" && newPoints.length < 3)
              ) {
                return null; // Marquer pour suppression
              }
              return { ...shape, points: newPoints };
            }
            return shape;
          });
          return newShapes.filter((shape) => shape !== null); // Filtrer les formes marquées pour suppression
        });

        // Désélectionner le point et potentiellement la forme si elle a été supprimée
        setSelectedPointIndex(null);
        if (!shapes.find((s) => s && s.id === selectedShapeId)) {
          setSelectedShapeId(null);
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    currentPoints,
    draggingVertexInfo,
    selectedShapeId,
    finalizeShape,
    handleUndo,
    handleRedo,
    selectedPointIndex,
    shapes,
    addToHistory,
    isUndoRedoAction,
  ]); // finalizeShape est dans les deps

  useEffect(() => {
    // Si on change de forme sélectionnée, ou si on désélectionne la forme,
    // on désélectionne le point.
    setSelectedPointIndex(null);
  }, [selectedShapeId]);

  useEffect(() => {
    // Gérer le snappedPreviewPoint en fonction du drag et de l'état de dessin
    if (!draggingVertexInfo && currentPoints.length === 0) {
      setSnappedPreviewPoint(null);
    } else if (draggingVertexInfo) {
      // Si on drague un sommet, pas de snapped preview point
      setSnappedPreviewPoint(null);
    }
  }, [draggingVertexInfo, currentPoints]);

  // Fonction pour calculer les angles d'une forme donnée
  const calculateAnglesForShape = useCallback(
    (shapePoints, isPolygon, shapeId) => {
      if (!shapePoints || shapePoints.length < (isPolygon ? 3 : 2)) {
        return [];
      }

      const angles = [];
      const numPoints = shapePoints.length;

      for (let i = 0; i < numPoints; i++) {
        if (!isPolygon && (i === 0 || i === numPoints - 1)) {
          // Pas d'angle aux extrémités d'une polyligne
          continue;
        }

        const P = shapePoints[i];
        const P_prev =
          shapePoints[isPolygon ? (i - 1 + numPoints) % numPoints : i - 1];
        const P_next = shapePoints[isPolygon ? (i + 1) % numPoints : i + 1];

        if (!P_prev || !P_next) continue;

        const v1 = V.subtract(P_prev, P);
        const v2 = V.subtract(P_next, P);

        const mag_v1 = V.magnitude(v1);
        const mag_v2 = V.magnitude(v2);

        if (mag_v1 === 0 || mag_v2 === 0) continue;

        const norm_v1 = V.normalize(v1);
        const norm_v2 = V.normalize(v2);

        const dotProduct = V.dot(norm_v1, norm_v2);
        const clampedDotProduct = Math.max(-1, Math.min(1, dotProduct));
        const angleRad = Math.acos(clampedDotProduct);
        const angleDeg = parseFloat((angleRad * (180 / Math.PI)).toFixed(1));

        const bisector_sum = V.add(norm_v1, norm_v2);
        let text_pos_offset_dir = V.normalize(bisector_sum);

        if (text_pos_offset_dir.x === 0 && text_pos_offset_dir.y === 0) {
          text_pos_offset_dir = V.normalize(V.perpendicular(norm_v1));
        }

        const textPos = V.add(
          P,
          V.scale(text_pos_offset_dir, -TEXT_OFFSET_FOR_ANGLES)
        );

        angles.push({
          id: "angle-" + shapeId + "-p" + i,
          x: textPos.x,
          y: textPos.y,
          value: angleDeg,
          pointBeingAnnotated: P,
        });
      }
      return angles;
    },
    []
  );

  // useEffect pour calculer les angles lorsque les formes changent
  useEffect(() => {
    const allAngles = [];
    shapes.forEach((shape) => {
      if (
        (shape.type === "polygon" || shape.type === "polyline") &&
        shape.points
      ) {
        const shapeAngles = calculateAnglesForShape(
          shape.points,
          shape.type === "polygon",
          shape.id
        );
        allAngles.push(...shapeAngles);
      }
    });
    setDisplayedAngles(allAngles);

    // Vérifier si des angles sont trop petits pour la production
    let smallAngleFound = false;
    for (const angle of allAngles) {
      if (angle.value < MIN_ANGLE_FOR_PRODUCTION) {
        smallAngleFound = true;
        break;
      }
    }
    setHasTooSmallAngles(smallAngleFound);
  }, [shapes, calculateAnglesForShape]);

  const addRectangle = () => {
    const newRect = {
      id: `rect${shapes.length + 1}`,
      type: "rect",
      x: Math.random() * 300, // Position aléatoire pour l'exemple
      y: Math.random() * 200,
      width: 50 + Math.random() * 100, // Taille aléatoire
      height: 50 + Math.random() * 50,
      fill: `hsl(${Math.random() * 360}, 70%, 70%)`, // Couleur aléatoire
      stroke: "blue",
      strokeWidth: 1,
    };
    setShapesAndPersist([...shapes, newRect]);
  };

  const hasPrincipalShape = shapes.some(
    (s) => s.type === "polygon" || s.type === "polyline"
  );

  // Nouveau gestionnaire pour le clic (après mousedown + mouseup)
  const handleCanvasClick = (event) => {
    if (draggingVertexInfo) return;

    // Si un outil de forme est actif, ne pas traiter les clics (géré par mousedown/mousemove/mouseup)
    if (drawingToolMode) return;

    const svgRect = svgCanvasRef.current?.getBoundingClientRect();
    if (!svgRect) return;
    const x = event.clientX - svgRect.left;
    const y = event.clientY - svgRect.top;

    // Si on est en train de dessiner, on continue à ajouter des points
    if (currentPoints.length > 0) {
      if (snappedPreviewPoint) {
        const newPoints = [...currentPoints, { ...snappedPreviewPoint }];
        // Ajouter à l'historique avant de modifier l'état
        if (!isUndoRedoAction) {
          addToHistory({
            type: "drawing",
            points: [...currentPoints], // Points avant l'ajout
          });
        }
        setCurrentPoints(newPoints);
      }
      return;
    }

    // Si pas de forme principale ou si on démarre le dessin
    if (!hasPrincipalShape) {
      // Ajouter à l'historique avant de modifier l'état
      if (!isUndoRedoAction && currentPoints.length === 0) {
        addToHistory({
          type: "drawing",
          points: [], // Points avant l'ajout (aucun)
        });
      }
      setCurrentPoints([{ x, y }]);
      setSnappedPreviewPoint({ x, y });
      return;
    }

    // Ici, on a une forme principale mais on n'est pas en train de dessiner
    // On va vérifier si on clique sur le fond ou sur un élément
    if (event.target === event.currentTarget) {
      // Clic sur le fond mais on ne désélectionne plus la forme
      // On garde la sélection pour continuer à pouvoir éditer
      return;
    }
  };

  const handleCanvasMouseDown = (event) => {
    if (draggingVertexInfo) return;

    const svgRect = svgCanvasRef.current?.getBoundingClientRect();
    if (!svgRect) return;
    const x = event.clientX - svgRect.left;
    const y = event.clientY - svgRect.top;

    // Le mouseDown est principalement utilisé pour le début du dessin de forme
    if (drawingToolMode) {
      // Si un outil de forme est actif (rectangle, carré, cercle)
      if (!shapeCreationStartPoint) {
        // Premier clic : définir le point de départ de la forme
        setShapeCreationStartPoint({ x, y });
        setPreviewShape({ type: drawingToolMode, x1: x, y1: y, x2: x, y2: y }); // Initialiser la prévisualisation
      }
      event.stopPropagation(); // Empêcher que le clic soit traité comme un clic normal
    }
    // Si ce n'est pas un outil de forme, le clic sera traité par handleCanvasClick
  };

  const deleteAllShapes = () => {
    if (!isUndoRedoAction) {
        addToHistory({ type: "shapes", shapes: JSON.parse(JSON.stringify(shapes)) });
    }
    setShapesAndPersist([]);
    setCurrentPoints([]);
    setSelectedShapeId(null);
    setSelectedPointIndex(null);
    setDrawingToolMode(null);
    setPreviewShape(null);
    setDisplayedAngles([]);
    sessionStorage.removeItem('persistedShapes'); // Clear from storage
  };

  const resetPrincipalShape = () => {
    if (!isUndoRedoAction) {
        addToHistory({ type: "shapes", shapes: JSON.parse(JSON.stringify(shapes)) });
    }
    // This function seems to imply a single "principal" shape concept not fully fleshed out
    // For now, it behaves like deleteAllShapes for simplicity of persistence.
    setShapesAndPersist([]); // MODIFIED
    setCurrentPoints([]);
    setSelectedShapeId(null);
    setSelectedPointIndex(null);
    setDrawingToolMode(null);
    setPreviewShape(null);
    setDisplayedAngles([]);
    sessionStorage.removeItem('persistedShapes'); // Clear from storage
  };

  const handleShapeClick = (shapeId) => {
    if (draggingVertexInfo) return;
    if (currentPoints.length > 0) return;

    // On ne permet plus de désélectionner la forme principale
    // Si on clique sur la forme, on la sélectionne toujours
    setSelectedShapeId(shapeId);

    // L'ancienne implémentation permettait de basculer :
    // setSelectedShapeId((prevId) => (prevId === shapeId ? null : shapeId));
  };

  const handleVertexMouseDown = (shapeId, pointIndex, event) => {
    event.stopPropagation();
    if (currentPoints.length > 0) return; // Ne pas interférer avec le dessin

    setSelectedShapeId(shapeId);
    setSelectedPointIndex(pointIndex);
    setDraggingVertexInfo(null); // Important: pas de drag au début

    vertexMouseDownInfo.current = {
      shapeId,
      pointIndex,
      clientX: event.clientX,
      clientY: event.clientY,
    };

    if (vertexPressTimer.current) {
      clearTimeout(vertexPressTimer.current);
    }

    vertexPressTimer.current = setTimeout(() => {
      // S'assurer que mouseup ou un mouvement n'a pas déjà annulé l'intention
      if (
        vertexMouseDownInfo.current &&
        vertexMouseDownInfo.current.shapeId === shapeId &&
        vertexMouseDownInfo.current.pointIndex === pointIndex
      ) {
        setDraggingVertexInfo({ shapeId, pointIndex }); // Activer le drag
      }
      vertexPressTimer.current = null;
    }, HOLD_DELAY);
  };

  const handleSvgMouseMove = (event) => {
    // Gestion du délai pour le drag de sommet
    if (vertexPressTimer.current && vertexMouseDownInfo.current) {
      const { clientX: initialX, clientY: initialY } =
        vertexMouseDownInfo.current;
      const dx = event.clientX - initialX;
      const dy = event.clientY - initialY;
      if (Math.sqrt(dx * dx + dy * dy) > MOVE_THRESHOLD) {
        clearTimeout(vertexPressTimer.current);
        vertexPressTimer.current = null;
        vertexMouseDownInfo.current = null; // Annule l'intention de drag par maintien
        // Le point reste sélectionné pour l'arrondi.
      }
    }

    if (draggingVertexInfo) {
      const { shapeId, pointIndex } = draggingVertexInfo;
      const svgRect = svgCanvasRef.current?.getBoundingClientRect();
      if (!svgRect) return;

      const x = event.clientX - svgRect.left;
      const y = event.clientY - svgRect.top;

      setShapesAndPersist(prevShapes =>
        prevShapes.map((shape) => {
          if (shape.id === shapeId && shape.points) {
            const newPoints = [...shape.points];
            if (pointIndex >= 0 && pointIndex < newPoints.length) {
              newPoints[pointIndex] = { x, y };
              return { ...shape, points: newPoints };
            }
          }
          return shape;
        })
      );
      return;
    }

    if (drawingToolMode && shapeCreationStartPoint) {
      const svgRect = svgCanvasRef.current?.getBoundingClientRect();
      if (!svgRect) return;
      const mouseX = event.clientX - svgRect.left;
      const mouseY = event.clientY - svgRect.top;

      if (drawingToolMode === "rectangle") {
        setPreviewShape({
          type: "rectangle",
          x: Math.min(shapeCreationStartPoint.x, mouseX),
          y: Math.min(shapeCreationStartPoint.y, mouseY),
          width: Math.abs(mouseX - shapeCreationStartPoint.x),
          height: Math.abs(mouseY - shapeCreationStartPoint.y),
          // Stocker les points originaux peut être utile aussi pour le carré/cercle plus tard
          x1: shapeCreationStartPoint.x,
          y1: shapeCreationStartPoint.y,
          x2: mouseX,
          y2: mouseY,
        });
      } else if (drawingToolMode === "square") {
        const dx = mouseX - shapeCreationStartPoint.x;
        const dy = mouseY - shapeCreationStartPoint.y;
        const side = Math.max(Math.abs(dx), Math.abs(dy)); // Pour un carré inscrit dans le rect du drag
        // Ou side = Math.min(Math.abs(dx), Math.abs(dy)) pour un carré qui ne dépasse pas;
        // Ou d'autres logiques (ex: distance au centre)
        // Pour l'instant, faisons un carré basé sur la plus grande dimension du geste
        const actualX2 = shapeCreationStartPoint.x + (dx > 0 ? side : -side);
        const actualY2 = shapeCreationStartPoint.y + (dy > 0 ? side : -side);

        setPreviewShape({
          type: "square",
          x: Math.min(shapeCreationStartPoint.x, actualX2),
          y: Math.min(shapeCreationStartPoint.y, actualY2),
          width: side,
          height: side,
          x1: shapeCreationStartPoint.x,
          y1: shapeCreationStartPoint.y,
          x2: mouseX,
          y2: mouseY, // Garder les points du curseur pour feedback
        });
      } else if (drawingToolMode === "circle") {
        const radius = V.distance(shapeCreationStartPoint, {
          x: mouseX,
          y: mouseY,
        });
        setPreviewShape({
          type: "circle",
          cx: shapeCreationStartPoint.x,
          cy: shapeCreationStartPoint.y,
          r: radius,
          x1: shapeCreationStartPoint.x,
          y1: shapeCreationStartPoint.y,
          x2: mouseX,
          y2: mouseY,
        });
      }
      // Pas de snappedPreviewPoint si on dessine une forme
      setSnappedPreviewPoint(null);
      return; // Empêcher la logique de snappedPreviewPoint pour polylignes
    }

    if (currentPoints.length > 0) {
      const svgRect = svgCanvasRef.current?.getBoundingClientRect();
      if (!svgRect) {
        setSnappedPreviewPoint(null);
        return;
      }
      const mouseX = event.clientX - svgRect.left;
      const mouseY = event.clientY - svgRect.top;

      if (isOrthogonalMode) {
        const P_last = currentPoints[currentPoints.length - 1];
        const dx = mouseX - P_last.x;
        const dy = mouseY - P_last.y;
        if (Math.abs(dx) > Math.abs(dy)) {
          setSnappedPreviewPoint({ x: mouseX, y: P_last.y });
        } else {
          setSnappedPreviewPoint({ x: P_last.x, y: mouseY });
        }
      } else {
        setSnappedPreviewPoint({ x: mouseX, y: mouseY });
      }
    } else {
      setSnappedPreviewPoint(null);
    }
  };

  const handleSvgMouseUp = () => {
    if (vertexPressTimer.current) {
      clearTimeout(vertexPressTimer.current);
      vertexPressTimer.current = null;
      // Clic court, pas de drag. selectedPointIndex est déjà setté.
      // draggingVertexInfo n'a pas été activé par le timer.
    }
    if (draggingVertexInfo) {
      // Ajouter à l'historique après avoir modifié les points par drag
      if (!isUndoRedoAction) {
        addToHistory({
          type: "shapes",
          shapes: JSON.parse(JSON.stringify(shapes)),
        });
      }
      setDraggingVertexInfo(null); // Termine le drag
    }
    vertexMouseDownInfo.current = null; // Nettoyer dans tous les cas

    if (drawingToolMode && shapeCreationStartPoint && previewShape) {
      let pointsToConvert = [];
      if (previewShape.type === "rectangle" || previewShape.type === "square") {
        pointsToConvert = [
          { x: previewShape.x, y: previewShape.y },
          { x: previewShape.x + previewShape.width, y: previewShape.y },
          {
            x: previewShape.x + previewShape.width,
            y: previewShape.y + previewShape.height,
          },
          { x: previewShape.x, y: previewShape.y + previewShape.height },
        ];
      } else if (previewShape.type === "circle") {
        const numSegments = 24; // Discrétisation du cercle
        for (let i = 0; i < numSegments; i++) {
          const angle = (i / numSegments) * 2 * Math.PI;
          pointsToConvert.push({
            x: previewShape.cx + previewShape.r * Math.cos(angle),
            y: previewShape.cy + previewShape.r * Math.sin(angle),
          });
        }
      }

      if (
        pointsToConvert.length > 0 &&
        ((previewShape.type === "rectangle" &&
          (previewShape.width > 0 || previewShape.height > 0)) ||
          (previewShape.type === "square" && previewShape.width > 0) ||
          (previewShape.type === "circle" && previewShape.r > 0))
      ) {
        // Utiliser la fonction addPredefinedShape existante ou une version adaptée
        // addPredefinedShape remplace les formes existantes, ce qui est le comportement souhaité ici
        addPredefinedShape(pointsToConvert); // La fonction addPredefinedShape gère déjà l'historique
      }

      // Réinitialiser les états de dessin de forme
      setShapeCreationStartPoint(null);
      setPreviewShape(null);
      // Optionnel : désactiver l'outil après usage, ou le laisser actif.
      // Pour l'instant, laissons le actif.
      // setDrawingToolMode(null);
    }
  };

  const handleApplyRounding = () => {
    if (
      selectedShapeId === null ||
      selectedPointIndex === null ||
      roundingRadius <= 0
    )
      return;

    // Ajouter à l'historique avant de modifier l'état
    if (!isUndoRedoAction) {
      addToHistory({
        type: "shapes",
        shapes: JSON.parse(JSON.stringify(shapes)),
      });
    }

    const shapeIndex = shapes.findIndex((s) => s.id === selectedShapeId);
    if (shapeIndex === -1) return;

    const shapeToModify = { ...shapes[shapeIndex] };
    if (
      !shapeToModify.points ||
      (shapeToModify.type !== "polygon" && shapeToModify.type !== "polyline")
    )
      return;

    let points = [...shapeToModify.points];
    const numPoints = points.length;

    if (numPoints < 2) return;

    if (
      shapeToModify.type === "polyline" &&
      (selectedPointIndex === 0 || selectedPointIndex === numPoints - 1)
    ) {
      alert(
        "L'arrondi des extrémités d'une polyligne n'est pas encore supporté."
      );
      return;
    }
    if (shapeToModify.type === "polygon" && numPoints < 3) return;

    const P_idx = selectedPointIndex;
    const P = points[P_idx];
    const P_prev =
      points[
        shapeToModify.type === "polygon"
          ? (P_idx - 1 + numPoints) % numPoints
          : P_idx - 1
      ];
    const P_next =
      points[
        shapeToModify.type === "polygon" ? (P_idx + 1) % numPoints : P_idx + 1
      ];

    if (!P_prev || !P_next) return;

    const v_PA = V.subtract(P_prev, P);
    const v_PB = V.subtract(P_next, P);

    const len_PA = V.magnitude(v_PA);
    const len_PB = V.magnitude(v_PB);

    if (len_PA === 0 || len_PB === 0) return;

    const angleP_cos = V.dot(v_PA, v_PB) / (len_PA * len_PB);
    if (Math.abs(angleP_cos) > 1) return;
    const angleP = Math.acos(angleP_cos);

    if (isNaN(angleP) || angleP <= 0.01 || angleP >= Math.PI - 0.01) {
      alert("Impossible d'arrondir un angle plat ou nul.");
      return;
    }

    let offset = roundingRadius / Math.tan(angleP / 2);

    const max_offset = Math.min(len_PA, len_PB) * 0.49;
    if (offset > max_offset) {
      offset = max_offset;
    }
    const effectiveRadius = offset * Math.tan(angleP / 2);
    if (effectiveRadius < 1) {
      alert("Le rayon d'arrondi est trop petit pour cet angle/ces segments.");
      return;
    }

    const T_A = V.add(P, V.scale(V.normalize(v_PA), offset));
    const T_B = V.add(P, V.scale(V.normalize(v_PB), offset));

    const dist_PC = effectiveRadius / Math.sin(angleP / 2);
    const bisector_dir_PA_PB = V.normalize(
      V.add(V.normalize(v_PA), V.normalize(v_PB))
    );
    let C = V.add(P, V.scale(bisector_dir_PA_PB, dist_PC));

    const cross_product_val = V.cross(v_PA, v_PB);
    if (V.dot(V.subtract(C, P), bisector_dir_PA_PB) < 0) {
      C = V.add(P, V.scale(bisector_dir_PA_PB, -dist_PC));
    }

    let startAngleArc = V.angle(V.subtract(T_A, C));
    let endAngleArc = V.angle(V.subtract(T_B, C));

    const NUM_ARC_SEGMENTS = 10;
    const arcPoints = [];

    if (cross_product_val > 0) {
      if (endAngleArc > startAngleArc) endAngleArc -= 2 * Math.PI;
    } else {
      if (endAngleArc < startAngleArc) endAngleArc += 2 * Math.PI;
    }

    const totalArcSweep = endAngleArc - startAngleArc;

    for (let i = 0; i <= NUM_ARC_SEGMENTS; i++) {
      const ratio = i / NUM_ARC_SEGMENTS;
      const currentAngle = startAngleArc + ratio * totalArcSweep;
      arcPoints.push({
        x: C.x + effectiveRadius * Math.cos(currentAngle),
        y: C.y + effectiveRadius * Math.sin(currentAngle),
      });
    }

    const newPoints = [
      ...points.slice(0, P_idx),
      ...arcPoints,
      ...points.slice(P_idx + 1),
    ];

    const updatedShapes = shapes.map((s, idx) =>
      idx === shapeIndex ? { ...s, points: newPoints } : s
    );
    setShapesAndPersist(updatedShapes);
    setSelectedPointIndex(null);
  };

  // Callback pour ProductionTracker pour signaler la fin d'une tâche
  const handleProductionTaskCompletion = (success) => {
    console.log(`App.jsx: Production task ended from tracker. Success: ${success}`);
    setIsInProduction(false);
    // setActiveProductionJobId(null); // Le tracker ne le fait plus, donc App pourrait le faire si nécessaire
                                     // ou laisser l\'utilisateur naviguer ailleurs pour \"effacer\" le job.
  };

  const exportToSvg = async () => {
    const selectedShape = shapes.find((s) => s.id === selectedShapeId);
    if (!selectedShape || !selectedShape.points || selectedShape.points.length < 2) {
      alert(
        "Veuillez sélectionner une forme valide avec au moins 2 points pour l\'exportation."
      );
      return;
    }

    setIsInProduction(true);

    try {
      const svgPoints = selectedShape.points.map((p) => (`${p.x},${p.y}`)).join(' ');
      const svgWidth = 800;
      const svgHeight = 600;
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
        // --- MODIFICATION: Persist shapes before navigating ---
        // No explicit save needed here if setShapesAndPersist is used everywhere shapes are modified.
        // The latest shapes should already be in sessionStorage.
        // However, to be absolutely sure, an explicit save can be done:
        sessionStorage.setItem('persistedShapes', JSON.stringify(shapes));

        navigate(`/production/${jobId}`);
      } else {
        console.error("Erreur d\'export API:", data.message);
        alert(`Erreur lors de l\'exportation (API): ${data.message}`);
        setIsInProduction(false);
      }
    } catch (error) {
      console.error("Erreur lors de l\'export (catch):", error);
      alert("Une erreur est survenue lors de l\'exportation.");
      setIsInProduction(false);
    }
  };

  const calculatePathLength = (points, isPolygon) => {
    if (!points || points.length < 2) return 0;
    let lengthInSvgUnits = 0;
    for (let i = 0; i < points.length - 1; i++) {
      lengthInSvgUnits += V.distance(points[i], points[i + 1]);
    }
    if (isPolygon && points.length > 1) {
      lengthInSvgUnits += V.distance(points[points.length - 1], points[0]);
    }
    const lengthInMm = lengthInSvgUnits / svgUnitsPerMm;
    return lengthInMm.toFixed(2);
  };

  const calculateTotalSegments = () => {
    let total = 0;
    shapes.forEach((shape) => {
      if (shape.type === "rect") {
        total += 4;
      } else if (
        shape.type === "polygon" &&
        shape.points &&
        shape.points.length >= 3
      ) {
        total += shape.points.length;
      } else if (
        shape.type === "polyline" &&
        shape.points &&
        shape.points.length >= 2
      ) {
        total += shape.points.length - 1;
      }
    });
    return total;
  };

  const totalSegments = calculateTotalSegments();

  const selectedShape = shapes.find((s) => s.id === selectedShapeId);
  const canRound =
    selectedShape &&
    (selectedShape.type === "polygon" || selectedShape.type === "polyline") &&
    selectedPointIndex !== null &&
    !(
      selectedShape.type === "polyline" &&
      (selectedPointIndex === 0 ||
        selectedPointIndex === (selectedShape.points?.length || 0) - 1)
    );

  const handleSegmentRightClick = (shapeId, clickCoordsSvg) => {
    // Ajouter à l'historique avant de modifier l'état
    if (!isUndoRedoAction) {
      addToHistory({
        type: "shapes",
        shapes: JSON.parse(JSON.stringify(shapes)),
      });
    }

    setShapesAndPersist(prevShapes => {
      const shapeIndex = prevShapes.findIndex((s) => s.id === shapeId);
      if (shapeIndex === -1) return prevShapes;

      const shape = prevShapes[shapeIndex];
      if (
        !shape.points ||
        (shape.type !== "polygon" && shape.type !== "polyline") ||
        shape.points.length < 2
      ) {
        return prevShapes;
      }

      let minDist = Infinity;
      let closestSegmentIndex = -1;
      let closestPointOnSegment = null;
      const points = shape.points;
      const numPoints = points.length;

      for (let i = 0; i < numPoints; i++) {
        const p1 = points[i];
        let p2;
        if (shape.type === "polygon") {
          p2 = points[(i + 1) % numPoints];
        } else {
          // polyline
          if (i === numPoints - 1) continue; // Pas de segment après le dernier point d'une polyligne
          p2 = points[i + 1];
        }

        const projected = V.projectPointOnSegment(clickCoordsSvg, p1, p2);
        const dist = V.distance(clickCoordsSvg, projected);

        if (dist < minDist) {
          minDist = dist;
          closestSegmentIndex = i; // Index du premier point du segment
          closestPointOnSegment = projected;
        }
      }

      if (closestPointOnSegment && minDist < SEGMENT_CLICK_THRESHOLD) {
        const newPoints = [...points];
        newPoints.splice(closestSegmentIndex + 1, 0, closestPointOnSegment);

        const updatedShapes = [...prevShapes];
        updatedShapes[shapeIndex] = { ...shape, points: newPoints };
        return updatedShapes;
      }
      return prevShapes;
    });
  };

  // --- Fonctions pour ajouter des formes prédéfinies ---
  const addPredefinedShape = (newPoints, shapeType = "polygon") => {
    const hasExistingPrincipalShape = shapes.some(s => s.type === 'polygon' || s.type === 'polyline');

    if (hasExistingPrincipalShape) {
      if (!window.confirm("Une forme principale existe déjà. Voulez-vous la remplacer par cette nouvelle forme ?")) {
        return; // User cancelled
      }
    }

    if (!isUndoRedoAction) {
      addToHistory({
        type: "shapes",
        shapes: JSON.parse(JSON.stringify(shapes)), // Capture state before replacement
      });
    }

    const newShape = {
      id: `shape${shapes.length + 1 + Date.now()}`, // Ajout de Date.now() pour unicité si suppression/ajout rapide
      type: shapeType,
      points: newPoints,
      fill: "rgba(0, 200, 100, 0.3)",
      stroke: "black",
      strokeWidth: 2,
    };

    setShapesAndPersist(prevShapes => {
      // Filter out any existing polygons or polylines from prevShapes
      const nonPrincipalShapes = prevShapes.filter(
        (s) => s.type !== "polygon" && s.type !== "polyline"
      );
      return [...nonPrincipalShapes, newShape]; // Add the new shape, replacing old principal ones
    });

    setSelectedShapeId(newShape.id);
    resetDrawingState(); // Efface currentPoints etc.
    setSelectedPointIndex(null);
  };

  const handleAddPredefinedRectangle = () => {
    const svgRect = svgCanvasRef.current?.getBoundingClientRect();
    const centerX = (svgRect?.width || 600) / 2;
    const centerY = (svgRect?.height || 400) / 2;
    const rectWidth = 150;
    const rectHeight = 100;

    const points = [
      { x: centerX - rectWidth / 2, y: centerY - rectHeight / 2 },
      { x: centerX + rectWidth / 2, y: centerY - rectHeight / 2 },
      { x: centerX + rectWidth / 2, y: centerY + rectHeight / 2 },
      { x: centerX - rectWidth / 2, y: centerY + rectHeight / 2 },
    ];
    addPredefinedShape(points);
  };

  const handleAddPredefinedSquare = () => {
    const svgRect = svgCanvasRef.current?.getBoundingClientRect();
    const centerX = (svgRect?.width || 600) / 2;
    const centerY = (svgRect?.height || 400) / 2;
    const sideLength = 120;

    const points = [
      { x: centerX - sideLength / 2, y: centerY - sideLength / 2 },
      { x: centerX + sideLength / 2, y: centerY - sideLength / 2 },
      { x: centerX + sideLength / 2, y: centerY + sideLength / 2 },
      { x: centerX - sideLength / 2, y: centerY + sideLength / 2 },
    ];
    addPredefinedShape(points);
  };

  const handleAddPredefinedCircle = (numSegments = 24) => {
    const svgRect = svgCanvasRef.current?.getBoundingClientRect();
    const centerX = (svgRect?.width || 600) / 2;
    const centerY = (svgRect?.height || 400) / 2;
    const radius = 75;
    const points = [];
    for (let i = 0; i < numSegments; i++) {
      const angle = (i / numSegments) * 2 * Math.PI;
      points.push({
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
      });
    }
    addPredefinedShape(points);
  };
  // --- Fin des fonctions pour formes prédéfinies ---

  // --- Fonctions pour activer les outils de dessin de formes ---
  const activateShapeTool = (toolName) => {
    setDrawingToolMode((prevTool) => (prevTool === toolName ? null : toolName)); // Bascule l'outil, ou désactive si reclic
    setCurrentPoints([]); // Arrêter le dessin de polyligne en cours
    setSelectedShapeId(null); // Désélectionner toute forme
    setShapeCreationStartPoint(null);
    setPreviewShape(null);
  };
  // --- Fin des fonctions pour activer les outils ---

  // Mode de dessin par points (polyligne)
  const activatePointsMode = () => {
    // Désactiver tous les autres outils de dessin
    setDrawingToolMode(null);
    setShapeCreationStartPoint(null);
    setPreviewShape(null);
    setSelectedShapeId(null);
    // On ne vide pas currentPoints car on pourrait vouloir continuer un dessin en cours
  };

  // Fonction pour générer le contenu SVG de la forme sélectionnée
  const generateSvgContent = () => {
    const selectedShape = shapes.find((s) => s.id === selectedShapeId);
    if (!selectedShape) return null;
    
    const svgPoints = selectedShape.points.map((p) => ({
      x: p.x,
      y: p.y,
    }));

    // Prepare SVG content
    const svgWidth = 800;
    const svgHeight = 600;
    return `
    <svg width="${svgWidth}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg">
      <polygon points="${svgPoints
        .map((p) => `${p.x},${p.y}`)
        .join(" ")}" fill="none" stroke="black" />
    </svg>
    `;
  };
  
  // Fonction pour sauvegarder la forme actuelle dans la bibliothèque
  const handleSaveToLibrary = () => {
    const selectedShape = shapes.find((s) => s.id === selectedShapeId);
    
    if (!selectedShape) {
      // Inform user to create or select a shape first
      alert(
        "Vous devez d'abord créer ou sélectionner une forme pour la sauvegarder."
      );
      return;
    }
    
    setShowSaveModal(true);
  };
  
  // Callback lorsque la sauvegarde est réussie
  const handleSaveSuccess = (savedPiece) => {
    // Affiche un message de succès
    alert(`La pièce "${savedPiece.name}" a été sauvegardée avec succès dans la bibliothèque.`);
    // Rafraîchit la bibliothèque si elle est visible
    setShowSVGLibrary(true);
  };
  
  // Fonction pour charger une forme depuis la bibliothèque
  const handleSelectSVGFromLibrary = (piece) => {
    const existingPrincipalShape = shapes.find(s => s.type === 'polygon' || s.type === 'polyline');
    if (existingPrincipalShape) {
      if (!window.confirm("Une forme principale existe déjà. Voulez-vous la remplacer par la pièce de la bibliothèque ?")) {
        return; // User cancelled
      }
    }

    try {
      // Parse SVG content
      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(piece.svgContent, "image/svg+xml");
      const polygon = svgDoc.querySelector("polygon");
      
      if (!polygon) {
        throw new Error("Format SVG non supporté. Seuls les polygones simples sont pris en charge.");
      }
      
      // Extract points from polygon
      const pointsStr = polygon.getAttribute("points");
      const pointPairs = pointsStr.trim().split(" ");
      const points = pointPairs.map(pair => {
        const [x, y] = pair.split(",");
        return { x: parseFloat(x), y: parseFloat(y) };
      });
      
      // Create a new shape from the SVG
      const newShape = {
        id: `shape-lib-${Date.now().toString()}`, // Ensure unique ID
        type: "polygon",
        points: points,
        fill: "rgba(0, 120, 255, 0.1)", // Distinct fill for library items might be nice
        stroke: "black",
        strokeWidth: 2,
      };
      
      // Add the shape and select it
      addToHistory({ // Capture state before replacement
        type: "shapes",
        shapes: JSON.parse(JSON.stringify(shapes))
      });

      setShapesAndPersist(prevShapes => {
        const nonPrincipalShapes = prevShapes.filter(
          (s) => s.type !== "polygon" && s.type !== "polyline"
        );
        return [...nonPrincipalShapes, newShape]; // Replace principal shapes
      });
      setSelectedShapeId(newShape.id);
      setCurrentPoints([]); // Clear any ongoing drawing
      setDrawingToolMode(null); // Deactivate any drawing tool
      setPreviewShape(null);
      
      // Display success message
      alert(`La pièce "${piece.name}" a été chargée avec succès.`);
    } catch (error) {
      console.error("Erreur lors du chargement de la pièce:", error);
      alert(`Erreur lors du chargement de la pièce: ${error.message}`);
    }
  };

  return (
    <div className="bg-gray-100 min-h-screen flex flex-col">
      {/* Header Bar */}
      <header className="bg-indigo-700 text-white p-3 shadow-md">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold tracking-tight">
            Atelier des Composites
          </h1>
          <div className="flex space-x-2">
            <button
              onClick={() => {
                  setShowProductionTracker(prev => !prev); // Bascule la visibilité
                  if (!showProductionTracker) { // Si on l\'ouvre
                    // On pourrait vouloir rafraîchir le job actif si on le ré-ouvre
                    // Pour l\'instant, le tracker gérera sa propre logique de socket au montage / changement de prop
                  }
              }}
              className="px-3 py-1.5 rounded-md transition-colors text-sm bg-indigo-600 hover:bg-indigo-500"
            >
              {showProductionTracker ? "Cacher Suivi" : "Afficher Suivi"}
            </button>
            <button
              onClick={() => setShowSVGLibrary(!showSVGLibrary)}
              className="px-3 py-1.5 rounded-md transition-colors text-sm bg-indigo-600 hover:bg-indigo-500"
            >
              Bibliothèque
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-grow flex">
        {/* Left panel - conditional display */}
        {showSVGLibrary && (
          <div className="w-72 p-3 bg-white border-r border-gray-200">
            <SVGLibraryPanel 
              onSelectSVG={handleSelectSVGFromLibrary}
              apiBaseUrl={`${API_BASE_URL}/api`}
            />
          </div>
        )}

        {/* Center panel - canvas */}
        <div className="flex-grow flex flex-col">
          {/* Canvas */}
          <div 
            className="flex-grow bg-white shadow-sm cursor-crosshair overflow-hidden"
            ref={svgCanvasRef}
            onMouseMove={handleSvgMouseMove}
            onMouseUp={handleSvgMouseUp}
            onMouseLeave={handleSvgMouseUp}
          >
            <SvgCanvas
              shapes={shapes}
              currentPoints={currentPoints}
              onCanvasMouseDown={handleCanvasMouseDown}
              selectedShapeId={selectedShapeId}
              onShapeClick={handleShapeClick}
              selectedPointIndex={selectedPointIndex}
              onVertexMouseDown={handleVertexMouseDown}
              svgUnitsPerMm={svgUnitsPerMm}
              isDraggingVertex={!!draggingVertexInfo}
              snappedPreviewPoint={snappedPreviewPoint}
              isDrawing={currentPoints.length > 0 && !draggingVertexInfo}
              onSegmentRightClick={handleSegmentRightClick}
              displayedAngles={displayedAngles}
              previewShape={previewShape}
              onCanvasClick={handleCanvasClick}
            />
          </div>

          {/* Bottom toolbar */}
          <div className="bg-gray-100 p-2 border-t border-gray-300 flex justify-between items-center">
            <div className="flex gap-1">
              {/* Drawing tools */}
              <div className="bg-white p-1 rounded shadow-sm flex gap-1">
                <button
                  onClick={activatePointsMode}
                  title="Mode Points"
                  className={`p-1.5 rounded-md ${!drawingToolMode ? "bg-blue-100 text-blue-700" : "text-gray-600 hover:bg-gray-100"}`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                  </svg>
                </button>
                <button
                  onClick={() => activateShapeTool("rectangle")}
                  title="Rectangle"
                  className={`p-1.5 rounded-md ${drawingToolMode === "rectangle" ? "bg-blue-100 text-blue-700" : "text-gray-600 hover:bg-gray-100"}`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5 4a3 3 0 00-3 3v10a3 3 0 003 3h10a3 3 0 003-3V7a3 3 0 00-3-3H5z" clipRule="evenodd" />
                  </svg>
                </button>
                <button
                  onClick={() => activateShapeTool("square")}
                  title="Carré"
                  className={`p-1.5 rounded-md ${drawingToolMode === "square" ? "bg-blue-100 text-blue-700" : "text-gray-600 hover:bg-gray-100"}`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M5 3a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V5a2 2 0 00-2-2H5z" />
                  </svg>
                </button>
                <button
                  onClick={() => activateShapeTool("circle")}
                  title="Cercle"
                  className={`p-1.5 rounded-md ${drawingToolMode === "circle" ? "bg-blue-100 text-blue-700" : "text-gray-600 hover:bg-gray-100"}`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm0-2a6 6 0 100-12 6 6 0 000 12z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
              
              {/* Edit tools */}
              <div className="bg-white p-1 rounded shadow-sm flex gap-1 ml-2">
                <button
                  onClick={finalizeShape}
                  disabled={currentPoints.length < 2}
                  title="Terminer la forme"
                  className={`p-1.5 rounded-md ${currentPoints.length >= 2 ? "text-green-700 hover:bg-gray-100" : "text-gray-400"}`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
                <button
                  onClick={() => setIsOrthogonalMode(!isOrthogonalMode)}
                  title={isOrthogonalMode ? "Désactiver Mode Ortho" : "Activer Mode Ortho"}
                  className={`p-1.5 rounded-md ${isOrthogonalMode ? "bg-indigo-100 text-indigo-700" : "text-gray-600 hover:bg-gray-100"}`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M5 3a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V5a2 2 0 00-2-2H5zm0 2h5v5H5V5zm0 7h5v3H5v-3zm7 3h3v-3h-3v3zm0-5h3V5h-3v5z" />
                  </svg>
                </button>
                <button
                  onClick={resetPrincipalShape}
                  disabled={!hasPrincipalShape && currentPoints.length === 0}
                  title="Réinitialiser"
                  className={`p-1.5 rounded-md ${hasPrincipalShape || currentPoints.length > 0 ? "text-red-700 hover:bg-gray-100" : "text-gray-400"}`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
              
              {/* Rounding tools - only shown when a vertex is selected */}
              {canRound && (
                <div className="bg-white p-1 rounded shadow-sm flex items-center gap-1 ml-2">
                  <div className="text-xs text-gray-600">Arrondi:</div>
                  <input
                    type="number"
                    value={roundingRadius}
                    onChange={(e) => setRoundingRadius(Math.max(0, parseInt(e.target.value, 10)))}
                    className="w-12 p-1 text-xs border border-gray-300 rounded"
                  />
                  <button
                    onClick={handleApplyRounding}
                    className="p-1.5 rounded-md text-indigo-700 hover:bg-gray-100"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
            
            {/* Production tools */}
            <div className="flex gap-1">
              {selectedShapeId && (
                <button
                  onClick={handleSaveToLibrary}
                  className="px-2 py-1 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-500 transition-colors"
                >
                  Sauvegarder
                </button>
              )}
              <button
                onClick={exportToSvg}
                disabled={shapes.length === 0 || isInProduction || hasTooSmallAngles}
                className={`px-2 py-1 text-sm rounded transition-colors ${shapes.length === 0 || isInProduction || hasTooSmallAngles ? "bg-gray-400 text-gray-200" : "bg-teal-600 text-white hover:bg-teal-500"}`}
              >
                {isInProduction ? "EN COURS..." : hasTooSmallAngles ? `Angle < ${MIN_ANGLE_FOR_PRODUCTION}°` : "PRODUCTION"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {/* Production Tracker Modal */}
      {showProductionTracker && (
        <div className="fixed inset-0 bg-gray-800 bg-opacity-50 flex items-center justify-center p-4 z-30">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[80vh] flex flex-col">
            <ProductionTracker 
              apiBaseUrl={`${API_BASE_URL}/api`} 
              activeProductionJobId={activeProductionJobId} 
              onClose={() => setShowProductionTracker(false)}
              onProductionTaskComplete={handleProductionTaskCompletion} 
            />
          </div>
        </div>
      )}

      {/* Save SVG Modal */}
      {showSaveModal && (
        <SaveSVGModal
          isOpen={showSaveModal}
          onClose={() => setShowSaveModal(false)}
          svgContent={generateSvgContent()}
          onSaveSuccess={handleSaveSuccess}
        />
      )}

      {/* Loading and error states */}
      {isLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-20 flex items-center justify-center">
          <div className="bg-white p-4 rounded-lg shadow-lg">
            <p className="text-blue-600">Chargement des étapes...</p>
          </div>
        </div>
      )}

      {error && (
        <div className="fixed inset-0 bg-black bg-opacity-20 flex items-center justify-center">
          <div className="bg-white p-4 rounded-lg shadow-lg">
            <p className="text-red-600">Erreur : {error}</p>
          </div>
        </div>
      )}
      
      {/* Footer - simplified */}
      <footer className="py-2 text-center text-xs text-gray-400">
        <span>Atelier des Composites © {new Date().getFullYear()}</span>
      </footer>
    </div>
  );
}

export default App;
