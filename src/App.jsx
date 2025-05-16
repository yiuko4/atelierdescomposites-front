import React, { useCallback, useEffect, useRef, useState } from "react";
import SvgCanvas from "./components/SvgCanvas";
import PieceCreationVisualizer from "./components/PieceCreationVisualizer";
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

function App() {
  const [shapes, setShapes] = useState([]);
  const [currentPoints, setCurrentPoints] = useState([]);
  const [selectedShapeId, setSelectedShapeId] = useState(null);
  const [selectedPointIndex, setSelectedPointIndex] = useState(null);
  const [roundingRadius, setRoundingRadius] = useState(20);
  const [svgUnitsPerMm, setSvgUnitsPerMm] = useState(6);
  const [draggingVertexInfo, setDraggingVertexInfo] = useState(null);
  const [isOrthogonalMode, setIsOrthogonalMode] = useState(false);
  const [snappedPreviewPoint, setSnappedPreviewPoint] = useState(null); 

  // États pour l'annulation et le rétablissement
  const [history, setHistory] = useState([]); // Historique des états précédents
  const [future, setFuture] = useState([]); // Historique des états annulés (pour rétablir)
  const [isUndoRedoAction, setIsUndoRedoAction] = useState(false); // Flag pour éviter d'ajouter les actions d'annulation/rétablissement elles-mêmes à l'historique

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

    if (initialNumPoints >= 2) {
      let longestSegmentLength = -1;
      let longestSegmentIndex = -1;

      const segmentsToIterate = isInitiallyPolygon
        ? initialNumPoints
        : initialNumPoints - 1;

      if (segmentsToIterate > 0) {
        for (let i = 0; i < segmentsToIterate; i++) {
          const p1 = processedPoints[i];
          const p2 = processedPoints[(i + 1) % initialNumPoints];
          const dist = V.distance(p1, p2);
          if (dist > longestSegmentLength) {
            longestSegmentLength = dist;
            longestSegmentIndex = i;
          }
        }
      }

      if (longestSegmentIndex !== -1) {
        const pA_longest = processedPoints[longestSegmentIndex];
        const pB_longest =
          processedPoints[(longestSegmentIndex + 1) % initialNumPoints];
        const M = V.add(
          pA_longest,
          V.scale(V.subtract(pB_longest, pA_longest), 0.5)
        );

        const points_after_M_segment = processedPoints.slice(
          longestSegmentIndex + 1
        );
        const points_before_M_segment_inclusive = processedPoints.slice(
          0,
          longestSegmentIndex + 1
        );

        processedPoints = [
          M,
          ...points_after_M_segment,
          ...points_before_M_segment_inclusive,
        ];
      }
    }

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

  const handleCanvasClick = (event) => {
    if (draggingVertexInfo) return;

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
      const svgRect = svgCanvasRef.current?.getBoundingClientRect();
      if (!svgRect) return;
      const x = event.clientX - svgRect.left;
      const y = event.clientY - svgRect.top;
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

  const exportToSvg = () => {
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

    const blob = new Blob([svgString], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mon_dessin.svg";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
  
  // États pour la visualisation de la création
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [etapes, setEtapes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Charger les étapes depuis le fichier JSON
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

  return (
    <div
      className="flex flex-col items-center justify-start min-h-screen bg-gradient-to-b from-blue-50 to-indigo-100 text-slate-700 p-4 font-sans"
      onMouseMove={handleSvgMouseMove}
      onMouseUp={handleSvgMouseUp}
      onMouseLeave={handleSvgMouseUp}
    >
      <header className="w-full max-w-5xl mb-6 text-center">
        <h1 className="text-4xl font-bold mb-2 text-indigo-600 tracking-wider">
          Atelier des composites
        </h1>
      </header>

      {/* Section d'informations et contrôles principaux */}
      <div className="w-full max-w-5xl mb-4 p-4 border border-indigo-200 bg-white rounded-lg shadow-md">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {/* Informations */}
          <div className="md:col-span-1 p-3 bg-blue-50 rounded-md border border-blue-100">
            <h2 className="text-lg font-semibold text-indigo-600 mb-2">
              Informations
            </h2>
            <p className="text-sm text-slate-600">
              Échelle :{" "}
              <span className="font-bold text-indigo-600">{svgUnitsPerMm}</span>{" "}
              unités SVG / mm
            </p>
            <p className="text-sm text-slate-600">
              Segments Totaux :{" "}
              <span className="font-bold text-indigo-600">{totalSegments}</span>
            </p>
            {selectedShape &&
              (selectedShape.type === "polygon" ||
                selectedShape.type === "polyline") && (
                <p className="text-sm text-slate-600 mt-1">
                  Longueur sélectionnée :{" "}
                  <span className="font-bold text-indigo-600">
                    {calculatePathLength(
                      selectedShape.points,
                      selectedShape.type === "polygon"
                    )}{" "}
                    mm
                  </span>
                </p>
              )}
            <p className="text-xs text-slate-500 mt-3 pt-2 border-t border-blue-100">
              <span className="inline-block px-1 py-0.5 bg-indigo-100 rounded mr-1">
                Ctrl+Z
              </span>{" "}
              Annuler &nbsp;
              <span className="inline-block px-1 py-0.5 bg-indigo-100 rounded mr-1">
                Ctrl+Y
              </span>{" "}
              Rétablir
            </p>
          </div>

          {/* Actions sur la forme en cours / pièce */}
          <div className="md:col-span-2 p-3 bg-blue-50 rounded-md border border-blue-100 flex flex-col space-y-2">
            <h2 className="text-lg font-semibold text-indigo-600 mb-2">
              Actions Pièce
            </h2>
            <div className="flex flex-wrap gap-2">
              {(hasPrincipalShape || currentPoints.length > 0) && (
                <button
                  onClick={finalizeShape}
                  disabled={currentPoints.length < 2}
                  className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:bg-gray-200 disabled:text-gray-400 transition-colors duration-150 shadow-sm"
                >
                  Terminer Forme
                </button>
              )}
              <button
                onClick={resetPrincipalShape}
                disabled={!hasPrincipalShape && currentPoints.length === 0}
                className="px-4 py-2 bg-indigo-500 text-white rounded-md hover:bg-indigo-600 disabled:bg-gray-200 disabled:text-gray-400 transition-colors duration-150 shadow-sm"
              >
                {hasPrincipalShape ? "Nouvelle Pièce" : "Réinitialiser"}
              </button>
            </div>
          </div>
        </div>

        {/* Outils et options */}
        <div className="p-3 bg-blue-50 rounded-md mt-2 border border-blue-100">
          <h2 className="text-lg font-semibold text-indigo-600 mb-3">
            Outils & Options
          </h2>
          <div className="flex flex-wrap gap-2 items-center">
            <button
              onClick={exportToSvg}
              disabled={shapes.length === 0}
              className="px-4 py-2 bg-teal-500 text-white rounded-md hover:bg-teal-600 disabled:bg-gray-200 disabled:text-gray-400 transition-colors duration-150 shadow-sm"
            >
              Exporter SVG
            </button>
            <button
          onClick={() => setIsPopupOpen(prev => !prev)}
          className="bg-white text-blue-600 px-4 py-2 rounded-lg font-medium hover:bg-blue-50 transition-colors"
        >
          Visualiser la création
        </button>
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
            {/* Contrôle de l'arrondi */}
            {selectedShapeId && selectedPointIndex !== null && canRound && (
              <div className="flex items-center space-x-2 p-2 bg-blue-100 rounded-md border border-blue-200">
                <label
                  htmlFor="roundingRadius"
                  className="text-sm text-slate-600"
                >
                  Rayon Arrondi:
                </label>
                <input
                  type="number"
                  id="roundingRadius"
                  value={roundingRadius}
                  onChange={(e) =>
                    setRoundingRadius(Math.max(0, parseInt(e.target.value, 10)))
                  }
                  className="w-20 p-1 rounded bg-white text-slate-700 border border-blue-300 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <button
                  onClick={handleApplyRounding}
                  disabled={!canRound}
                  className="px-3 py-1 bg-indigo-500 text-white rounded-md hover:bg-indigo-600 disabled:bg-gray-300 transition-colors duration-150 shadow-sm"
                >
                  Arrondir Point
                </button>
              </div>
            )}
          </div>
        </div>
        
      </div>

      {/* Zone du Canevas SVG */}
      <div
        className="w-full max-w-5xl h-[500px] bg-white shadow-md cursor-crosshair rounded-lg border border-indigo-200 overflow-hidden"
        ref={svgCanvasRef}
      >
        <SvgCanvas
          shapes={shapes}
          currentPoints={currentPoints}
          onCanvasClick={handleCanvasClick}
          selectedShapeId={selectedShapeId}
          onShapeClick={handleShapeClick}
          selectedPointIndex={selectedPointIndex}
          onVertexMouseDown={handleVertexMouseDown}
          svgUnitsPerMm={svgUnitsPerMm}
          isDraggingVertex={!!draggingVertexInfo}
          snappedPreviewPoint={snappedPreviewPoint}
          isDrawing={currentPoints.length > 0 && !draggingVertexInfo}
          onSegmentRightClick={handleSegmentRightClick}
        />

<>
  {isPopupOpen && (
    <PieceCreationVisualizer
      etapes={etapes}
      onClose={() => setIsPopupOpen(false)}
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
      
      <footer className="w-full max-w-5xl mt-8 mb-4 text-center">
        <p className="text-xs text-indigo-300">
          Projet de dessin vectoriel interactif - Amélioré par IA.
        </p>
      </footer>
    </div>
  );
}

export default App;
