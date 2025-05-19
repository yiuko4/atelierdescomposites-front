import React, { useRef, useState, useEffect, forwardRef } from "react";
import PropTypes from "prop-types";

// Réutiliser les fonctions vectorielles de App.jsx si nécessaire pour les calculs
// Pour simplifier ici, on va juste passer les props nécessaires ou recalculer basiquement.
const V_canvas = {
  // Copie simplifiée pour SvgCanvas, idéalement à partager
  subtract: (p1, p2) => ({ x: p1.x - p2.x, y: p1.y - p2.y }),
  add: (p1, p2) => ({ x: p1.x + p2.x, y: p1.y + p2.y }),
  scale: (p, s) => ({ x: p.x * s, y: p.y * s }),
  magnitude: (p) => Math.sqrt(p.x * p.x + p.y * p.y),
  distance: (p1, p2) => V_canvas.magnitude(V_canvas.subtract(p1, p2)),
  normalize: (p) => {
    const m = V_canvas.magnitude(p);
    return m === 0 ? { x: 0, y: 0 } : V_canvas.scale(p, 1 / m);
  },
  perpendicular: (p) => ({ x: -p.y, y: p.x }),
};

const SvgCanvas = forwardRef((props, ref) => {
  const {
    shapes,
    currentPoints,
    onCanvasMouseDown,
    onCanvasClick,
    selectedShapeId,
    onShapeClick,
    selectedPointIndex,
    onVertexMouseDown,
    svgUnitsPerMm,
    isDraggingVertex,
    snappedPreviewPoint,
    isDrawing,
    onSegmentRightClick,
    displayedAngles,
    previewShape,
    showGrid = false,
    gridSpacing = 20,
    minAngleForProduction = 65,
    showAxes = true,
    showOriginMarker = true,
    viewBox,
    onDoubleClick,
    onMouseMove,
    onMouseUp,
    onFinishShape,
    gridConfig,
    activeTool,
    isPanning,
  } = props;

  const viewBoxString = viewBox ? `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}` : "0 0 800 600";
  const actualGridSpacing = gridConfig?.gridSpacing || gridSpacing;
  const showGridActual = gridConfig?.showGrid !== undefined ? gridConfig.showGrid : showGrid;
  const showAxesActual = gridConfig?.showAxes !== undefined ? gridConfig.showAxes : showAxes;
  const showOriginMarkerActual = gridConfig?.showOriginMarker !== undefined ? gridConfig.showOriginMarker : showOriginMarker;

  const currentPathPoints = currentPoints.map((p) => `${p.x},${p.y}`).join(" ");
  const internalSvgRef = useRef(null);
  const actualRef = ref || internalSvgRef;

  const handleLocalShapeClick = (e, shapeId) => {
    e.stopPropagation(); // Empêche le clic de se propager au SVG parent (qui désélectionnerait)
    onShapeClick(shapeId);
  };

  // Style commun pour les textes de mesure
  const measurementTextStyle = {
    fontSize: "10px",
    fill: "#333",
    pointerEvents: "none", // Pour que le texte ne gêne pas les clics
    textAnchor: "middle",
  };

  // Style du canevas SVG pendant le glissement d'un sommet
  const svgStyle = isDraggingVertex
    ? { cursor: "grabbing" }
    : isDrawing
    ? { cursor: "crosshair" }
    : activeTool === 'pan' || isPanning 
    ? { cursor: "grab" } // Main ouverte pour le mode Pan (devient 'grabbing' lors du drag)
    : {};

  // Points pour la prévisualisation de la forme en cours de dessin
  let previewShapePoints = [];
  if (isDrawing && currentPoints.length > 0 && snappedPreviewPoint) {
    previewShapePoints = [...currentPoints, snappedPreviewPoint];
  }
  const previewPathString = previewShapePoints
    .map((p) => `${p.x},${p.y}`).join(" ");

  // Style pour la prévisualisation des formes (rectangle, cercle, etc.)
  const previewElementStyle = {
    fill: "none",
    stroke: "dodgerblue",
    strokeWidth: 1.5,
    strokeDasharray: "4,4",
    pointerEvents: "none", // Important pour ne pas interférer avec les autres événements souris
  };

  const getPathData = (points, type) => {
    // Implementation of getPathData function
  };

  // Fonction pour générer les lignes de la grille
  const renderGridLines = () => {
    if (!showGridActual || actualGridSpacing <= 0) return null;

    console.log("Rendering grid with spacing:", actualGridSpacing, "showGrid:", showGridActual);
    
    const [vx, vy, vWidth, vHeight] = viewBoxString.split(" ").map(Number);

    const lines = [];

    // Lignes verticales de la grille
    for (let x = Math.floor(vx / actualGridSpacing) * actualGridSpacing; x < vx + vWidth; x += actualGridSpacing) {
      if (x === 0 && showAxesActual) continue; // Ne pas redessiner l'axe Y si showAxes est vrai
      lines.push(
        <line
          key={`grid-v-${x}`}
          x1={x}
          y1={vy}
          x2={x}
          y2={vy + vHeight}
          stroke="#e0e0e0"
          strokeWidth="0.5"
        />
      );
    }
    // Lignes horizontales de la grille
    for (let y = Math.floor(vy / actualGridSpacing) * actualGridSpacing; y < vy + vHeight; y += actualGridSpacing) {
      if (y === 0 && showAxesActual) continue; // Ne pas redessiner l'axe X si showAxes est vrai
      lines.push(
        <line
          key={`grid-h-${y}`}
          x1={vx}
          y1={y}
          x2={vx + vWidth}
          y2={y}
          stroke="#e0e0e0"
          strokeWidth="0.5"
        />
      );
    }
    return lines;
  };

  const renderAxes = () => {
    if (!showAxesActual) return null;
    const [vx, vy, vWidth, vHeight] = viewBoxString.split(" ").map(Number);
    const axisStyle = { stroke: "#888888", strokeWidth: 1 }; // Style pour les axes

    return (
      <g>
        {/* Axe X */}
        <line x1={vx} y1={0} x2={vx + vWidth} y2={0} {...axisStyle} />
        {/* Axe Y */}
        <line x1={0} y1={vy} x2={0} y2={vy + vHeight} {...axisStyle} />
      </g>
    );
  };

  const renderOriginMarker = () => {
    if (!showOriginMarkerActual) return null;
    const originMarkerStyle = { fill: "#ff0000", stroke: "#cc0000", strokeWidth: 0.5 }; // Style pour le marqueur d'origine

    return (
      <circle cx={0} cy={0} r={3} {...originMarkerStyle} />
    );
  };

  // Gérer le double-clic pour terminer une forme
  const handleDoubleClick = (e) => {
    if (onDoubleClick) {
      // Passer l'événement original pour une conversion précise des coordonnées
      onDoubleClick(e);
    }
    
    if (currentPoints.length >= 3 && onFinishShape) {
      onFinishShape();
    }
  };

  return (
    <div className="w-full h-full no-text-select" style={{
      userSelect: "none",
      WebkitUserSelect: "none",
      MozUserSelect: "none",
      msUserSelect: "none"
    }}>
      <svg
        ref={actualRef}
        width="100%"
        height="100%"
        viewBox={viewBoxString}
        onMouseDown={(e) => {
          if (onCanvasMouseDown) {
            // Passer l'événement original pour une conversion précise des coordonnées
            onCanvasMouseDown(e);
          }
        }}
        onClick={(e) => {
          // Vérifier si le clic est sur le SVG lui-même et non un élément enfant
          if (e.target === e.currentTarget && onCanvasClick) {
            // Passer l'événement original pour une conversion précise des coordonnées
            onCanvasClick(e);
          }
        }}
        onDoubleClick={handleDoubleClick}
        onMouseMove={(e) => {
          if (onMouseMove) {
            // Passer l'événement original pour une conversion précise des coordonnées
            onMouseMove(e);
          }
        }}
        onMouseUp={(e) => {
          if (onMouseUp) {
            // Passer l'événement original pour une conversion précise des coordonnées
            onMouseUp(e);
          }
        }}
        style={{ 
          ...svgStyle, 
          display: "block",
          userSelect: "none"
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* Rendu de la grille en premier pour qu'elle soit en arrière-plan */}
        {renderGridLines()}
        {/* Rendu des axes */}
        {renderAxes()}
        {/* Rendu du marqueur d'origine */}
        {renderOriginMarker()}

        {shapes.map((shape) => {
          const pointsString = shape.points
            ? shape.points.map((p) => `${p.x},${p.y}`).join(" ")
            : "";
          const isSelected = shape.id === selectedShapeId;
          const styleProps = {
            stroke: isSelected ? "deepskyblue" : shape.stroke || "black",
            strokeWidth: isSelected
              ? (shape.strokeWidth || 2) + 1
              : shape.strokeWidth || 2,
            cursor: "pointer",
            pointerEvents:
              currentPoints.length > 0 || isDraggingVertex ? "none" : "auto",
          };

          let renderedShape = null;
          let measurementTexts = []; // Tableau pour stocker les éléments <text> de mesure

          if (shape.type === "rect") {
            renderedShape = (
              <rect
                key={shape.id}
                x={shape.x}
                y={shape.y}
                width={shape.width}
                height={shape.height}
                fill={shape.fill}
                {...styleProps}
                onClick={(e) => handleLocalShapeClick(e, shape.id)}
              />
            );
            const widthInMm = (shape.width / svgUnitsPerMm).toFixed(1);
            const heightInMm = (shape.height / svgUnitsPerMm).toFixed(1);
            measurementTexts.push(
              <text
                key={`rect-width-${shape.id}`}
                x={shape.x + shape.width / 2}
                y={shape.y - 5}
                {...measurementTextStyle}
                style={{
                  userSelect: "none",
                  cursor: "default"
                }}
              >
                {widthInMm} mm
              </text>,
              <text
                key={`rect-height-${shape.id}`}
                x={shape.x - 5}
                y={shape.y + shape.height / 2}
                {...measurementTextStyle}
                textAnchor="end"
                dominantBaseline="middle"
                style={{
                  userSelect: "none",
                  cursor: "default"
                }}
              >
                {heightInMm} mm
              </text>
            );
          } else if (shape.type === "polygon") {
            renderedShape = (
              <polygon
                key={shape.id}
                points={pointsString}
                fill={shape.fill}
                {...styleProps}
                onClick={(e) => handleLocalShapeClick(e, shape.id)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log("Segment right-click on polygon");
                  if (onSegmentRightClick && actualRef.current) {
                    const svgRect = actualRef.current.getBoundingClientRect();
                    const svgPoint = actualRef.current.createSVGPoint();
                    svgPoint.x = e.clientX;
                    svgPoint.y = e.clientY;
                    
                    // Utiliser getScreenCTM pour une conversion précise
                    const CTM = actualRef.current.getScreenCTM();
                    if (CTM) {
                      const transformedPoint = svgPoint.matrixTransform(CTM.inverse());
                      onSegmentRightClick(shape.id, {
                        x: transformedPoint.x,
                        y: transformedPoint.y
                      });
                    }
                  }
                }}
                style={{
                  ...styleProps,
                  pointerEvents: isDraggingVertex ? "none" : "auto"
                }}
              />
            );
          } else if (shape.type === "polyline") {
            renderedShape = (
              <polyline
                key={shape.id}
                points={pointsString}
                fill={shape.fill || "none"}
                {...styleProps}
                onClick={(e) => handleLocalShapeClick(e, shape.id)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log("Segment right-click on polyline");
                  if (onSegmentRightClick && actualRef.current) {
                    const svgRect = actualRef.current.getBoundingClientRect();
                    const svgPoint = actualRef.current.createSVGPoint();
                    svgPoint.x = e.clientX;
                    svgPoint.y = e.clientY;
                    
                    // Utiliser getScreenCTM pour une conversion précise
                    const CTM = actualRef.current.getScreenCTM();
                    if (CTM) {
                      const transformedPoint = svgPoint.matrixTransform(CTM.inverse());
                      onSegmentRightClick(shape.id, {
                        x: transformedPoint.x,
                        y: transformedPoint.y
                      });
                    }
                  }
                }}
                style={{
                  ...styleProps,
                  pointerEvents: isDraggingVertex ? "none" : "auto"
                }}
              />
            );
          }

          if (
            (shape.type === "polygon" || shape.type === "polyline") &&
            shape.points &&
            shape.points.length >= 2
          ) {
            const pointsStr = shape.points
              .map((p) => `${p.x},${p.y}`)
              .join(" ");
            if (shape.type === "polygon") {
              renderedShape = (
                <polygon
                  key={shape.id}
                  points={pointsStr}
                  fill={shape.fill}
                  {...styleProps}
                  onClick={(e) => handleLocalShapeClick(e, shape.id)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log("Segment right-click on polygon");
                    if (onSegmentRightClick && actualRef.current) {
                      const svgRect = actualRef.current.getBoundingClientRect();
                      const svgPoint = actualRef.current.createSVGPoint();
                      svgPoint.x = e.clientX;
                      svgPoint.y = e.clientY;
                      
                      // Utiliser getScreenCTM pour une conversion précise
                      const CTM = actualRef.current.getScreenCTM();
                      if (CTM) {
                        const transformedPoint = svgPoint.matrixTransform(CTM.inverse());
                        onSegmentRightClick(shape.id, {
                          x: transformedPoint.x,
                          y: transformedPoint.y
                        });
                      }
                    }
                  }}
                  style={{
                    ...styleProps,
                    pointerEvents: isDraggingVertex ? "none" : "auto"
                  }}
                />
              );
            } else {
              renderedShape = (
                <polyline
                  key={shape.id}
                  points={pointsStr}
                  fill={shape.fill || "none"}
                  {...styleProps}
                  onClick={(e) => handleLocalShapeClick(e, shape.id)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log("Segment right-click on polyline");
                    if (onSegmentRightClick && actualRef.current) {
                      const svgRect = actualRef.current.getBoundingClientRect();
                      const svgPoint = actualRef.current.createSVGPoint();
                      svgPoint.x = e.clientX;
                      svgPoint.y = e.clientY;
                      
                      // Utiliser getScreenCTM pour une conversion précise
                      const CTM = actualRef.current.getScreenCTM();
                      if (CTM) {
                        const transformedPoint = svgPoint.matrixTransform(CTM.inverse());
                        onSegmentRightClick(shape.id, {
                          x: transformedPoint.x,
                          y: transformedPoint.y
                        });
                      }
                    }
                  }}
                  style={{
                    ...styleProps,
                    pointerEvents: isDraggingVertex ? "none" : "auto"
                  }}
                />
              );
            }
            // Afficher la longueur de chaque segment
            const MIN_DISPLAY_LENGTH_MM = 1.0; // Seuil : ne pas afficher si moins de 1.0 mm
            for (let i = 0; i < shape.points.length; i++) {
              const p1 = shape.points[i];
              const p2 =
                shape.points[
                  (i + 1) %
                    (shape.type === "polygon" ? shape.points.length : Infinity)
                ]; // Boucle pour polygone, pas pour polyligne ouverte à la fin

              if (shape.type === "polyline" && i === shape.points.length - 1)
                break; // Pas de segment après le dernier point d'une polyligne

              const lengthInSvgUnits = V_canvas.distance(p1, p2);
              const lengthInMmValue = lengthInSvgUnits / svgUnitsPerMm;

              if (lengthInMmValue >= MIN_DISPLAY_LENGTH_MM) {
                const midX = (p1.x + p2.x) / 2;
                const midY = (p1.y + p2.y) / 2;
                let offsetVector = V_canvas.normalize(
                  V_canvas.perpendicular(V_canvas.subtract(p2, p1))
                );
                let textPosX = midX + offsetVector.x * 10;
                let textPosY = midY + offsetVector.y * 10;

                measurementTexts.push(
                  <text
                    key={`segment-${shape.id}-${i}`}
                    x={textPosX}
                    y={textPosY}
                    {...measurementTextStyle}
                    pointerEvents="none"
                    style={{
                      userSelect: "none",
                      cursor: "default"
                    }}
                  >
                    {lengthInMmValue.toFixed(1)} mm
                  </text>
                );
              }
            }
          }

          return (
            <g key={`group-${shape.id}-draggable`}>
              {renderedShape}
              {measurementTexts} {/* Afficher les textes de mesure */}
              {isSelected &&
                (shape.type === "polygon" || shape.type === "polyline") &&
                shape.points &&
                shape.points.map((point, index) => (
                  <circle
                    key={`vertex-${shape.id}-${index}`}
                    cx={point.x}
                    cy={point.y}
                    r={selectedPointIndex === index ? "6" : "4"}
                    fill={
                      selectedPointIndex === index
                        ? isDraggingVertex
                          ? "purple"
                          : "orange"
                        : "red"
                    }
                    stroke="white"
                    strokeWidth="1"
                    style={{
                      cursor:
                        isDraggingVertex && selectedPointIndex === index
                          ? "grabbing"
                          : "grab",
                      pointerEvents: "auto",
                    }}
                    onMouseDown={(e) => {
                      e.stopPropagation(); // Empêcher la propagation de l'événement au SVG parent
                      onVertexMouseDown(shape.id, index, e);
                    }}
                    onClick={(e) => {
                      e.stopPropagation(); // Empêcher la propagation de l'événement au SVG parent
                    }}
                  />
                ))}
            </g>
          );
        })}

        {/* Affichage de la forme en cours de création (prévisualisation) */}
        {isDrawing &&
          previewShapePoints.length >= 2 &&
          (previewShapePoints.length >= 3 ? (
            <polygon
              points={previewPathString}
              fill="rgba(0, 100, 200, 0.2)"
              stroke="rgba(0, 0, 0, 0.5)"
              strokeWidth="1.5"
              strokeDasharray="4,4"
              style={{ pointerEvents: "none" }}
            />
          ) : (
            <line
              x1={previewShapePoints[0].x}
              y1={previewShapePoints[0].y}
              x2={previewShapePoints[1].x}
              y2={previewShapePoints[1].y}
              stroke="rgba(0, 0, 0, 0.5)"
              strokeWidth="1.5"
              strokeDasharray="4,4"
              style={{ pointerEvents: "none" }}
            />
          ))}

        {/* Affichage des points cliqués pour la forme en cours (currentPoints) */}
        {isDrawing &&
          currentPoints.map((point, index) => (
            <circle
              key={`point-current-${index}`}
              cx={point.x}
              cy={point.y}
              r="3"
              fill="darkblue"
              style={{ pointerEvents: "none" }}
            />
          ))}

        {/* Affichage du snappedPreviewPoint (le prochain point potentiel) */}
        {isDrawing && currentPoints.length > 0 && snappedPreviewPoint && (
          <circle
            cx={snappedPreviewPoint.x}
            cy={snappedPreviewPoint.y}
            r="3.5"
            fill="rgba(255, 0, 0, 0.7)"
            stroke="white"
            strokeWidth="1"
            style={{ pointerEvents: "none" }}
          />
        )}

        {/* Rendu des angles */}
        {displayedAngles &&
          displayedAngles.map((angle) => (
            <text
              key={angle.id}
              x={angle.x}
              y={angle.y}
              fontSize="10"
              fill={angle.value < minAngleForProduction ? "red" : "black"}
              textAnchor="middle"
              dominantBaseline="middle"
              pointerEvents="none"
            >
              {angle.value}°
            </text>
          ))}

        {/* Prévisualisation de la forme en cours de dessin (rectangle, cercle...) */}
        {previewShape && previewShape.type === "rectangle" && (
          <rect
            key="preview-rectangle"
            x={previewShape.x}
            y={previewShape.y}
            width={previewShape.width}
            height={previewShape.height}
            {...previewElementStyle}
          />
        )}
        {previewShape && previewShape.type === "square" && (
          <rect
            key="preview-square"
            x={previewShape.x}
            y={previewShape.y}
            width={previewShape.width}
            height={previewShape.height}
            {...previewElementStyle}
          />
        )}
        {previewShape && previewShape.type === "circle" && (
          <circle
            key="preview-circle"
            cx={previewShape.cx}
            cy={previewShape.cy}
            r={previewShape.r}
            {...previewElementStyle}
          />
        )}
      </svg>
    </div>
  );
});

SvgCanvas.displayName = 'SvgCanvas';

SvgCanvas.propTypes = {
  shapes: PropTypes.arrayOf(PropTypes.object).isRequired,
  currentPoints: PropTypes.arrayOf(PropTypes.object).isRequired,
  onCanvasMouseDown: PropTypes.func.isRequired,
  selectedShapeId: PropTypes.string,
  onShapeClick: PropTypes.func.isRequired,
  selectedPointIndex: PropTypes.number,
  onVertexMouseDown: PropTypes.func.isRequired,
  svgUnitsPerMm: PropTypes.number,
  isDraggingVertex: PropTypes.bool,
  snappedPreviewPoint: PropTypes.object,
  isDrawing: PropTypes.bool,
  onSegmentRightClick: PropTypes.func,
  displayedAngles: PropTypes.arrayOf(PropTypes.object),
  previewShape: PropTypes.object,
  onCanvasClick: PropTypes.func.isRequired,
  showGrid: PropTypes.bool,
  gridSpacing: PropTypes.number,
  minAngleForProduction: PropTypes.number,
  showAxes: PropTypes.bool,
  showOriginMarker: PropTypes.bool,
  viewBox: PropTypes.object,
  viewBoxString: PropTypes.string,
  onDoubleClick: PropTypes.func,
  onMouseMove: PropTypes.func,
  onMouseUp: PropTypes.func,
  onFinishShape: PropTypes.func,
  gridConfig: PropTypes.object,
  activeTool: PropTypes.string,
  isPanning: PropTypes.bool,
};

export default SvgCanvas;
