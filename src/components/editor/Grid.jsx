import React from 'react';

/**
 * Composant pour afficher une grille et des axes dans un SVG
 * @param {Object} props - Propriétés du composant
 * @param {boolean} props.showGrid - Afficher la grille
 * @param {boolean} props.showAxes - Afficher les axes
 * @param {boolean} props.showOriginMarker - Afficher le marqueur d'origine
 * @param {number} props.gridSpacing - Espacement de la grille en unités SVG
 * @param {Object} props.viewBox - Dimensions du viewBox {x, y, width, height}
 * @returns {JSX.Element} Grille SVG
 */
function Grid({
  showGrid = true,
  showAxes = true,
  showOriginMarker = true,
  gridSpacing = 10,
  viewBox = { x: 0, y: 0, width: 800, height: 600 },
}) {
  if (!showGrid && !showAxes && !showOriginMarker) return null;

  // Calculer les limites de la grille
  const startX = Math.floor(viewBox.x / gridSpacing) * gridSpacing;
  const endX = Math.ceil((viewBox.x + viewBox.width) / gridSpacing) * gridSpacing;
  const startY = Math.floor(viewBox.y / gridSpacing) * gridSpacing;
  const endY = Math.ceil((viewBox.y + viewBox.height) / gridSpacing) * gridSpacing;

  // Générer les lignes verticales
  const verticalLines = showGrid
    ? Array.from(
        { length: Math.floor((endX - startX) / gridSpacing) + 1 },
        (_, i) => {
          const x = startX + i * gridSpacing;
          const isAxis = Math.abs(x) < 0.1; // x = 0 est l'axe Y
          
          // Skip l'axe si showAxes est true (car il sera dessiné séparément)
          if (isAxis && showAxes) return null;
          
          return (
            <line
              key={`v-${i}`}
              x1={x}
              y1={startY}
              x2={x}
              y2={endY}
              stroke={isAxis ? "#0066cc" : "#eaeaea"}
              strokeWidth={isAxis ? 1 : 0.5}
            />
          );
        }
      ).filter(Boolean)
    : [];

  // Générer les lignes horizontales
  const horizontalLines = showGrid
    ? Array.from(
        { length: Math.floor((endY - startY) / gridSpacing) + 1 },
        (_, i) => {
          const y = startY + i * gridSpacing;
          const isAxis = Math.abs(y) < 0.1; // y = 0 est l'axe X
          
          // Skip l'axe si showAxes est true (car il sera dessiné séparément)
          if (isAxis && showAxes) return null;
          
          return (
            <line
              key={`h-${i}`}
              x1={startX}
              y1={y}
              x2={endX}
              y2={y}
              stroke={isAxis ? "#0066cc" : "#eaeaea"}
              strokeWidth={isAxis ? 1 : 0.5}
            />
          );
        }
      ).filter(Boolean)
    : [];

  // Dessiner les axes principaux X et Y
  const axes = showAxes ? (
    <>
      <line
        x1={startX}
        y1={0}
        x2={endX}
        y2={0}
        stroke="#0066cc"
        strokeWidth={1.5}
      />
      <line
        x1={0}
        y1={startY}
        x2={0}
        y2={endY}
        stroke="#0066cc"
        strokeWidth={1.5}
      />
    </>
  ) : null;

  // Dessiner le marqueur d'origine
  const originMarker = showOriginMarker ? (
    <circle cx={0} cy={0} r={3} fill="#ff3300" />
  ) : null;

  return (
    <g className="grid">
      {verticalLines}
      {horizontalLines}
      {axes}
      {originMarker}
    </g>
  );
}

export default Grid; 