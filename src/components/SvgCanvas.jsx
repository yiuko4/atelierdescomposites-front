import React, { useRef } from "react";

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

function SvgCanvas({
  shapes,
  currentPoints,
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
}) {
  const currentPathPoints = currentPoints.map((p) => `${p.x},${p.y}`).join(" ");
  const svgRef = useRef(null);

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
    : {};

  // Points pour la prévisualisation de la forme en cours de dessin
  let previewShapePoints = [];
  if (isDrawing && currentPoints.length > 0 && snappedPreviewPoint) {
    previewShapePoints = [...currentPoints, snappedPreviewPoint];
  }
  const previewPathString = previewShapePoints
    .map((p) => `${p.x},${p.y}`)
    .join(" ");

  return (
    <div className="w-full h-full border border-gray-300">
      <svg
        width="100%"
        height="100%"
        onClick={onCanvasClick}
        style={svgStyle}
        ref={svgRef}
      >
        {/* Affichage des formes finalisées */}
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
                  if (onSegmentRightClick && svgRef.current) {
                    const svgRect = svgRef.current.getBoundingClientRect();
                    const x = e.clientX - svgRect.left;
                    const y = e.clientY - svgRect.top;
                    onSegmentRightClick(shape.id, { x, y });
                  }
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
                  if (onSegmentRightClick && svgRef.current) {
                    const svgRect = svgRef.current.getBoundingClientRect();
                    const x = e.clientX - svgRect.left;
                    const y = e.clientY - svgRect.top;
                    onSegmentRightClick(shape.id, { x, y });
                  }
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
                    if (onSegmentRightClick && svgRef.current) {
                      const svgRect = svgRef.current.getBoundingClientRect();
                      const x = e.clientX - svgRect.left;
                      const y = e.clientY - svgRect.top;
                      onSegmentRightClick(shape.id, { x, y });
                    }
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
                    if (onSegmentRightClick && svgRef.current) {
                      const svgRect = svgRef.current.getBoundingClientRect();
                      const x = e.clientX - svgRect.left;
                      const y = e.clientY - svgRect.top;
                      onSegmentRightClick(shape.id, { x, y });
                    }
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
                    onMouseDown={(e) => onVertexMouseDown(shape.id, index, e)}
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
      </svg>
    </div>
  );
}

export default SvgCanvas;
