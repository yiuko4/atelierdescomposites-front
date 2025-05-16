import React, { useCallback, useEffect, useRef, useState } from "react";
import PieceCreationVisualizer from "./components/PieceCreationVisualizer";
import SvgCanvas from "./components/SvgCanvas";
import "./index.css";

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

  const [shapes, setShapes] = useState([]);
  const [currentPoints, setCurrentPoints] = useState([]);
  const [selectedShapeId, setSelectedShapeId] = useState(null);
  const [selectedPointIndex, setSelectedPointIndex] = useState(null);
  const [roundingRadius, setRoundingRadius] = useState(5);
  const [svgUnitsPerMm, setSvgUnitsPerMm] = useState(6);
  const [draggingVertexInfo, setDraggingVertexInfo] = useState(null);
  const [isOrthogonalMode, setIsOrthogonalMode] = useState(false);
  const [snappedPreviewPoint, setSnappedPreviewPoint] = useState(null);
  const [isInProduction, setIsInProduction] = useState(false); // Nouvel état pour la production

  // États pour l'annulation et le rétablissement
  const [history, setHistory] = useState([]); // Historique des états précédents
  const [future, setFuture] = useState([]); // Historique des états annulés (pour rétablir)
  const [isUndoRedoAction, setIsUndoRedoAction] = useState(false); // Flag pour éviter d'ajouter les actions d'annulation/rétablissement elles-mêmes à l'historique
  const [displayedAngles, setDisplayedAngles] = useState([]);
  const [hasTooSmallAngles, setHasTooSmallAngles] = useState(false); // Nouvel état pour les angles trop petits
  const [productionSequence, setProductionSequence] = useState(null); // Pour stocker les étapes de production
  const [showProductionVisualizer, setShowProductionVisualizer] =
    useState(false); // Pour ouvrir le visualiseur avec les étapes de prod

  // Nouveaux états pour les outils de dessin de formes prédéfinies
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

    setShapes([...otherShapes, newShape]);
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
        setShapes(previousShapeState.shapes);
      } else {
        // S'il n'y a pas d'état de forme précédent dans l'historique (ex: on a annulé jusqu'au début du dessin des formes)
        // On cherche le premier état de forme dans l'historique original s'il y en avait un, sinon on vide.
        const firstShapeStateInHistory = history.find(
          (h) => h.type === "shapes"
        );
        if (newHistory.length === 0 && !firstShapeStateInHistory) {
          setShapes([]); // Aucune forme dans l'historique initial
        } else if (newHistory.filter((h) => h.type === "shapes").length === 0) {
          // Si le newHistory ne contient plus de 'shapes', cela veut dire qu'on a annulé toutes les modifs de shapes
          // Il faut potentiellement revenir à un état où shapes était vide ou à son état initial si enregistré.
          // Pour l'instant, si aucun 'shapes' dans newHistory, on vide. On pourrait affiner.
          setShapes([]);
        }
        // Si previousShapeState est null mais newHistory contient encore des actions de dessin,
        // on ne change pas les shapes, car elles ont pu être établies avant ces actions de dessin.
      }
    }

    setHistory(newHistory);

    setTimeout(() => setIsUndoRedoAction(false), 10);
  }, [history, currentPoints, shapes]);

  const handleRedo = useCallback(() => {
    if (future.length === 0) return;

    setIsUndoRedoAction(true);

    const nextAction = future[future.length - 1];
    const newFuture = future.slice(0, -1);

    if (nextAction.type === "drawing") {
      setCurrentPoints(nextAction.data);
    } else if (nextAction.type === "shapes") {
      setShapes(nextAction.data);
    }

    setFuture(newFuture);

    // Réinitialiser le flag après un court délai
    setTimeout(() => setIsUndoRedoAction(false), 10);
  }, [future]);

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

        setShapes((prevShapes) => {
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
    setShapes([...shapes, newRect]);
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
    setShapes(shapes.filter((s) => s.type === "rect"));
    setSelectedShapeId(null);
    resetDrawingState();
  };

  const resetPrincipalShape = () => {
    // Ajouter à l'historique avant de modifier l'état
    if (!isUndoRedoAction) {
      addToHistory({
        type: "shapes",
        shapes: JSON.parse(JSON.stringify(shapes)),
      });
    }

    setShapes(shapes.filter((s) => s.type === "rect"));
    setSelectedShapeId(null);
    resetDrawingState();
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

      setShapes((prevShapes) =>
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
    setShapes(updatedShapes);
    setSelectedPointIndex(null);
  };

  const exportToSvg = async () => {
    // Vérification des angles avant de continuer
    for (const shape of shapes) {
      if (
        (shape.type === "polygon" || shape.type === "polyline") &&
        shape.points
      ) {
        const anglesOfShape = calculateAnglesForShape(
          shape.points,
          shape.type === "polygon",
          shape.id
        );
        for (const angleInfo of anglesOfShape) {
          if (angleInfo.value < MIN_ANGLE_FOR_PRODUCTION) {
            alert(
              `Production impossible : La forme "${
                shape.id
              }" contient un angle de ${
                angleInfo.value
              }° au sommet près du point (${angleInfo.pointBeingAnnotated.x.toFixed(
                1
              )}, ${angleInfo.pointBeingAnnotated.y.toFixed(
                1
              )}). L'angle minimum requis est de ${MIN_ANGLE_FOR_PRODUCTION}°.`
            );
            return; // Arrêter le processus d'exportation
          }
        }
      }
    }

    const svgWidth =
      document.querySelector(".bg-white.shadow-lg svg")?.clientWidth || 600;
    const svgHeight =
      document.querySelector(".bg-white.shadow-lg svg")?.clientHeight || 400;

    let svgString = `<svg width="${svgWidth}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg">\n`;

    shapes.forEach((shape) => {
      if (shape.type === "rect") {
        svgString += `  <rect x="${shape.x}" y="${shape.y}" width="${
          shape.width
        }" height="${shape.height}" fill="${shape.fill}" stroke="${
          shape.stroke || "none"
        }" stroke-width="${shape.strokeWidth || 0}" />\n`;
      } else if (shape.type === "polygon" && shape.points) {
        const pointsStr = shape.points.map((p) => `${p.x},${p.y}`).join(" ");
        svgString += `  <polygon points="${pointsStr}" fill="${
          shape.fill
        }" stroke="${shape.stroke || "black"}" stroke-width="${
          shape.strokeWidth || 1
        }" />\n`;
      } else if (shape.type === "polyline" && shape.points) {
        const pointsStr = shape.points.map((p) => `${p.x},${p.y}`).join(" ");
        svgString += `  <polyline points="${pointsStr}" fill="${
          shape.fill || "none"
        }" stroke="${shape.stroke || "black"}" stroke-width="${
          shape.strokeWidth || 1
        }" />\n`;
      }
    });

    svgString += `</svg>`;

    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "";
    const apiUrlPath = `${apiBaseUrl}/api/direct/svg-to-sequence`;

    const svgBlob = new Blob([svgString], { type: "image/svg+xml" });
    const formData = new FormData();
    formData.append("svgfile", svgBlob, "atelier_export.svg"); // 'svgfile' est le nom du champ attendu par l'API
    formData.append("sendToApi", "true"); // Envoyer comme chaîne, le backend devrait le convertir en booléen
    formData.append("closePolygons", "true"); // Valeur par défaut, peut être rendue configurable

    try {
      const response = await fetch(apiUrlPath, {
        method: "POST",
        // NE PAS définir Content-Type ici, le navigateur le fera pour multipart/form-data
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        console.log(
          "SVG envoyé et traité avec succès par l'API (direct):",
          result
        );
        alert(
          `Opération réussie: ${result.message}
Fichier original: ${result.originalFilename}
Séquence: ${result.sequenceFile}`
        );
        setIsInProduction(true); // Mettre à jour l'état de production

        // Supposons que result.sequenceData contient les étapes pour le visualiseur
        // Vous devrez ajuster "result.sequenceData" à la clé réelle de votre API
        // MISE À JOUR : Selon la documentation, la clé est "actions"
        if (result.actions && Array.isArray(result.actions)) {
          setProductionSequence(result.actions); // Utiliser result.actions
          setShowProductionVisualizer(true); // Ouvrir le visualiseur avec les nouvelles étapes
        } else if (result.sequenceFile) {
          // Si result.actions n'est pas là, mais sequenceFile l'est,
          // cela pourrait indiquer un problème ou une réponse API inattendue.
          // Pour l'instant, affichons un avertissement.
          console.warn(
            "result.actions non trouvé ou n'est pas un tableau. Les étapes de production ne peuvent pas être visualisées directement. Fichier de séquence disponible:",
            result.sequenceFile
          );
          setProductionSequence(null); // Assurer qu'on n'utilise pas d'anciennes données
          setShowProductionVisualizer(false); // Ne pas tenter d'ouvrir le visualiseur
        } else {
          // Ni sequenceData ni sequenceFile, ou format incorrect
          console.warn(
            "Aucune donnée de séquence valide reçue de l'API pour la visualisation."
          );
          setProductionSequence(null);
          setShowProductionVisualizer(false);
        }
      } else {
        console.error(
          "Erreur de l'API lors du traitement direct du SVG:",
          result
        );
        alert(
          `Erreur ${response.status} de l\'API: ${
            result.message || "Erreur inconnue du serveur"
          }`
        );
        setProductionSequence(null); // Effacer les anciennes séquences en cas d'erreur
        setShowProductionVisualizer(false);
        // Laisser isInProduction à false ou le remettre à false si nécessaire (déjà géré plus bas pour API stop)
      }
    } catch (error) {
      console.error(
        "Erreur de connexion ou lors de l'envoi direct du SVG:",
        error
      );
      alert(`Erreur de connexion au serveur: ${error.message}`);
      setProductionSequence(null); // Effacer les anciennes séquences en cas d'erreur
      setShowProductionVisualizer(false);
      // Laisser isInProduction à false ou le remettre à false si nécessaire (déjà géré plus bas pour API stop)
    }
  };

  const handleStopProduction = async () => {
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "";
    const apiUrlPath = `${apiBaseUrl}/api/emergency/stop`;

    console.log("Tentative d'arrêt de la production via API...");

    try {
      const response = await fetch(apiUrlPath, {
        method: "POST",
        // Pas de corps nécessaire si l'API n'en attend pas pour un simple arrêt
        // Headers peuvent être ajoutés si nécessaire (ex: Authorization)
      });

      if (response.ok) {
        const result = await response.json().catch(() => ({})); // Essayer de parser JSON, sinon objet vide
        console.log("Arrêt de production réussi (API):", result);
        alert(result.message || "La production a été arrêtée avec succès.");
        setIsInProduction(false);
      } else {
        const errorResult = await response.json().catch(() => ({
          message: `Erreur ${response.status} lors de l'arrêt de la production.`,
        }));
        console.error(
          "Erreur de l'API lors de l'arrêt de production:",
          errorResult
        );
        alert(
          errorResult.message ||
            `Erreur ${response.status} de l\'API lors de la tentative d\'arrêt.`
        );
        // Optionnel: garder isInProduction à true si l'arrêt API échoue et qu'on veut forcer une nouvelle tentative.
        // Pour l'instant, on le remet à false pour débloquer l'UI.
        setIsInProduction(false);
      }
    } catch (error) {
      console.error(
        "Erreur de connexion lors de la tentative d'arrêt de production:",
        error
      );
      alert(
        `Erreur de connexion au serveur lors de la tentative d\'arrêt: ${error.message}`
      );
      // Idem, on remet à false pour débloquer l'UI
      setIsInProduction(false);
    }
  };

  const handleOpenVisualizer = () => {
    // Priorité aux données de production si elles existent et ne sont pas vides
    if (productionSequence && productionSequence.length > 0) {
      setShowProductionVisualizer(true); // Ouvre le visualiseur avec les données de production
      setIsPopupOpen(false); // S'assure que l'autre condition de rendu pour le visualiseur est fausse
    } else {
      // Sinon, utilise les étapes par défaut (etape-test.json)
      setIsPopupOpen((prev) => !prev); // Bascule l'état pour le visualiseur par défaut
      setShowProductionVisualizer(false); // S'assure que la condition pour le visualiseur de prod est fausse
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

    setShapes((prevShapes) => {
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
    if (!isUndoRedoAction) {
      addToHistory({
        type: "shapes",
        shapes: JSON.parse(JSON.stringify(shapes)),
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

    // Conserver les formes qui ne sont ni des polygones ni des polylignes (ex: les "rect" d'exemple)
    const otherShapes = shapes.filter(
      (s) => s.type !== "polygon" && s.type !== "polyline"
    );

    setShapes([...otherShapes, newShape]);
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

  return (
    <div className="flex flex-col items-center justify-start h-screen bg-gradient-to-b from-blue-50 to-indigo-100 text-slate-700 p-4 font-sans">
      <header className="w-full max-w-5xl mb-3 text-center">
        <h1 className="text-4xl font-bold mb-2 text-indigo-600 tracking-wider">
          Atelier des composites
        </h1>
      </header>

      {/* Conteneur principal pour le canvas et les panneaux latéraux */}
      <div
        className="w-full max-w-7xl flex flex-col md:flex-row gap-4 flex-1"
        style={{ height: "calc(100vh - 150px)" }}
      >
        {/* Colonne de gauche : Historique des pièces */}
        <div className="md:w-[20%] w-full" style={{ height: "100%" }}>
          <div className="p-4 border border-indigo-200 bg-white rounded-lg shadow-md flex flex-col h-full gap-4">
            {/* En-tête du panneau */}
            <div className="p-3 bg-blue-50 rounded-md border border-blue-100">
              <h2 className="text-lg font-semibold text-indigo-600 mb-2">
                Historique
              </h2>
              <p className="text-sm text-slate-600">Pièces enregistrées</p>
            </div>

            {/* Contenu à remplir plus tard */}
            <div className="flex-grow bg-gray-50 rounded-md p-2 border border-gray-100">
              {/* Emplacement futur pour l'historique des pièces SVG */}
              <p className="text-sm text-gray-400 italic text-center mt-4">
                L'historique des pièces sera affiché ici
              </p>
            </div>
          </div>
        </div>

        {/* Colonne centrale : Canevas SVG */}
        <div
          className="md:w-[60%] w-full bg-white shadow-md cursor-crosshair rounded-lg border border-indigo-200 overflow-hidden"
          style={{ height: "100%" }}
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

        {/* Colonne de droite : Panneau de contrôle unique */}
        <div className="md:w-[20%] w-full" style={{ height: "100%" }}>
          {/* Panneau de contrôle unique regroupant tout */}
          <div className="p-4 border border-indigo-200 bg-white rounded-lg shadow-md flex flex-col h-full gap-4">
            {/* Section Actions Pièce */}
            <div className="p-3 bg-blue-50 rounded-md border border-blue-100">
              <h2 className="text-lg font-semibold text-indigo-600 mb-2">
                Actions Pièce
              </h2>
              <div className="flex flex-wrap gap-2 mb-2">
                <button
                  onClick={resetPrincipalShape}
                  disabled={!hasPrincipalShape && currentPoints.length === 0}
                  className="px-3 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 disabled:bg-gray-200 disabled:text-gray-400 transition-colors duration-150 shadow-sm flex items-center gap-1"
                  title="Réinitialiser"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>Réinitialiser</span>
                </button>
                {(hasPrincipalShape || currentPoints.length > 0) && (
                  <button
                    onClick={finalizeShape}
                    disabled={currentPoints.length < 2}
                    className="px-3 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:bg-gray-200 disabled:text-gray-400 transition-colors duration-150 shadow-sm flex items-center gap-1"
                    title="Terminer la forme"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span>Terminer</span>
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={activatePointsMode}
                  title="Mode Points (dessiner librement)"
                  className={`px-3 py-2 text-white rounded-md hover:bg-blue-600 transition-colors duration-150 shadow-sm flex items-center gap-1 ${
                    !drawingToolMode
                      ? "bg-blue-700 ring-2 ring-blue-300"
                      : "bg-blue-500"
                  }`}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                  </svg>
                  <span>Points</span>
                </button>
                <button
                  onClick={() => activateShapeTool("rectangle")}
                  title="Dessiner Rectangle"
                  className={`px-3 py-2 text-white rounded-md hover:bg-blue-600 transition-colors duration-150 shadow-sm flex items-center gap-1 ${
                    drawingToolMode === "rectangle"
                      ? "bg-blue-700 ring-2 ring-blue-300"
                      : "bg-blue-500"
                  }`}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5 4a3 3 0 00-3 3v10a3 3 0 003 3h10a3 3 0 003-3V7a3 3 0 00-3-3H5zm0 2a1 1 0 00-1 1v10a1 1 0 001 1h10a1 1 0 001-1V7a1 1 0 00-1-1H5z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>Rectangle</span>
                </button>
                <button
                  onClick={() => activateShapeTool("square")}
                  title="Dessiner Carré"
                  className={`px-3 py-2 text-white rounded-md hover:bg-blue-600 transition-colors duration-150 shadow-sm flex items-center gap-1 ${
                    drawingToolMode === "square"
                      ? "bg-blue-700 ring-2 ring-blue-300"
                      : "bg-blue-500"
                  }`}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path d="M5 3a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V5a2 2 0 00-2-2H5z" />
                  </svg>
                  <span>Carré</span>
                </button>
                <button
                  onClick={() => activateShapeTool("circle")}
                  title="Dessiner Cercle"
                  className={`px-3 py-2 text-white rounded-md hover:bg-blue-600 transition-colors duration-150 shadow-sm flex items-center gap-1 ${
                    drawingToolMode === "circle"
                      ? "bg-blue-700 ring-2 ring-blue-300"
                      : "bg-blue-500"
                  }`}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm0-2a6 6 0 100-12 6 6 0 000 12z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>Cercle</span>
                </button>
              </div>
            </div>

            {/* Section Outils et Options (sans export) */}
            <div className="p-3 bg-blue-50 rounded-md border border-blue-100">
              <h2 className="text-lg font-semibold text-indigo-600 mb-3">
                Outils & Options
              </h2>
              <div className="flex flex-wrap gap-2 items-center">
                <button
                  onClick={() => setIsOrthogonalMode(!isOrthogonalMode)}
                  className={`px-4 py-2 rounded-md transition-colors duration-150 shadow-sm ${
                    isOrthogonalMode
                      ? "bg-indigo-500 text-white"
                      : "bg-blue-100 text-indigo-600 hover:bg-blue-200"
                  }`}
                  title={
                    isOrthogonalMode
                      ? "Désactiver Mode Ortho"
                      : "Activer Mode Ortho"
                  }
                >
                  Mode Ortho: {isOrthogonalMode ? "ON" : "OFF"}
                </button>
                {/* Contrôle de l'arrondi - redesign */}
                {selectedShapeId && selectedPointIndex !== null && canRound && (
                  <div className="bg-blue-100 rounded-md border border-blue-200 p-3">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <label
                          htmlFor="roundingRadius"
                          className="text-sm font-medium text-indigo-700"
                        >
                          Rayon Arrondi:
                        </label>
                        <input
                          type="number"
                          id="roundingRadius"
                          value={roundingRadius}
                          onChange={(e) =>
                            setRoundingRadius(
                              Math.max(0, parseInt(e.target.value, 10))
                            )
                          }
                          className="w-24 p-2 rounded bg-white text-slate-700 border border-blue-300 focus:ring-indigo-500 focus:border-indigo-500 text-right"
                        />
                      </div>
                      <button
                        onClick={handleApplyRounding}
                        className="w-full py-2 mt-1 bg-indigo-500 text-white rounded-md hover:bg-indigo-600 disabled:bg-gray-300 transition-colors duration-150 shadow-sm font-medium"
                      >
                        Arrondir Point
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Bouton Exporter SVG poussé en bas */}
            <div className="mt-auto p-3 bg-blue-50 rounded-md border border-blue-100 flex flex-col gap-2">
              <button
                onClick={handleOpenVisualizer}
                className="px-4 py-2 bg-purple-500 text-white rounded-md hover:bg-purple-600 transition-colors duration-150 shadow-sm"
              >
                Visualiser la création
              </button>
              <button
                onClick={exportToSvg}
                disabled={
                  shapes.length === 0 || isInProduction || hasTooSmallAngles
                }
                className="w-full px-4 py-2 bg-teal-500 text-white rounded-md hover:bg-teal-600 disabled:bg-gray-400 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors duration-150 shadow-sm"
              >
                {isInProduction
                  ? "PRODUCTION EN COURS..."
                  : hasTooSmallAngles
                  ? `Angle(s) < ${MIN_ANGLE_FOR_PRODUCTION}°!`
                  : "PRODUCTION"}
              </button>
              <button
                onClick={handleStopProduction}
                className="w-full px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors duration-150 shadow-sm"
              >
                STOP
              </button>
            </div>
          </div>
        </div>
        <>
          {isPopupOpen && !showProductionVisualizer && (
            <PieceCreationVisualizer
              etapes={etapes}
              onClose={() => setIsPopupOpen(false)}
            />
          )}

          {showProductionVisualizer && productionSequence && (
            <PieceCreationVisualizer
              etapes={productionSequence}
              onClose={() => {
                setShowProductionVisualizer(false);
              }}
            />
          )}

          {isLoading && (
            <p className="text-center mt-4 text-blue-600">
              Chargement des étapes...
            </p>
          )}

          {error && (
            <p className="text-center mt-4 text-red-600">Erreur : {error}</p>
          )}
        </>
      </div>

      <footer className="w-full max-w-5xl mt-3 mb-2 text-center">
        <p className="text-xs text-indigo-300">
          By{" "}
          <a
            href="https://glowsoft.fr"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-indigo-200 transition-colors"
          >
            Glowsoft
          </a>
        </p>
      </footer>
    </div>
  );
}

export default App;
