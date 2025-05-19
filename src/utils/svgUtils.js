import { API_BASE_URL } from '../constants/config';

/**
 * Génère le contenu SVG d'une forme
 * @param {Object} shape - Forme à convertir en SVG
 * @returns {string} Markup SVG
 */
export const generateShapeSvgMarkup = (shape) => {
  if (!shape || !shape.points || shape.points.length === 0) return '';

  const { id, type, points, fill, stroke, strokeWidth } = shape;

  if (type === 'polygon' && points.length >= 3) {
    const pointsStr = points.map(p => `${p.x},${p.y}`).join(' ');
    return `<polygon id="${id}" points="${pointsStr}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
  } else if (type === 'polyline' && points.length >= 2) {
    const pointsStr = points.map(p => `${p.x},${p.y}`).join(' ');
    return `<polyline id="${id}" points="${pointsStr}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
  } else if (type === 'circle' && points.length === 2) {
    const [center, radiusPoint] = points;
    const radius = Math.sqrt(
      Math.pow(radiusPoint.x - center.x, 2) + Math.pow(radiusPoint.y - center.y, 2)
    );
    return `<circle id="${id}" cx="${center.x}" cy="${center.y}" r="${radius}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
  }

  return '';
};

/**
 * Génère le contenu SVG complet de l'éditeur
 * @param {Array} shapes - Liste des formes à inclure
 * @param {Object} viewBox - Dimensions du viewBox
 * @returns {string} Document SVG complet
 */
export const generateSvgContent = (shapes, viewBox) => {
  if (!shapes || shapes.length === 0) return '';

  const svgShapes = shapes
    .map(shape => generateShapeSvgMarkup(shape))
    .filter(markup => markup !== '');

  if (svgShapes.length === 0) return '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}">
    ${svgShapes.join('\n    ')}
  </svg>`;
};

/**
 * Sauvegarde une pièce SVG sur le serveur
 * @param {Object} pieceData - Données de la pièce
 * @param {string} svgContent - Contenu SVG
 * @returns {Promise} Promesse avec les données sauvegardées
 */
export const saveSvgToLibrary = async (pieceData, svgContent) => {
  const { name, description } = pieceData;
  
  try {
    const response = await fetch(`${API_BASE_URL}/pieces`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        description,
        svgContent,
      }),
    });

    if (!response.ok) {
      throw new Error(`Erreur lors de la sauvegarde: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Erreur lors de la sauvegarde de la pièce:', error);
    throw error;
  }
};

/**
 * Charge les pièces SVG depuis le serveur
 * @returns {Promise} Promesse avec la liste des pièces
 */
export const fetchSvgLibrary = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/pieces`);
    
    if (!response.ok) {
      throw new Error(`Erreur lors du chargement de la bibliothèque: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Erreur lors du chargement de la bibliothèque:', error);
    throw error;
  }
};

/**
 * Analyse le contenu SVG pour extraire les formes
 * @param {string} svgContent - Contenu SVG à analyser
 * @returns {Array} Liste des formes extraites
 */
export const parseSvgContent = (svgContent) => {
  const parser = new DOMParser();
  const svgDoc = parser.parseFromString(svgContent, 'image/svg+xml');
  const shapes = [];

  // Extraire les polygones
  const polygons = svgDoc.querySelectorAll('polygon');
  polygons.forEach((polygon) => {
    const pointsAttr = polygon.getAttribute('points');
    if (!pointsAttr) return;

    const pointsList = pointsAttr.trim().split(' ').map((point) => {
      const [x, y] = point.split(',').map(Number);
      return { x, y };
    });

    if (pointsList.length < 3) return;

    shapes.push({
      id: polygon.getAttribute('id') || `polygon_${Date.now()}_${shapes.length}`,
      type: 'polygon',
      points: pointsList,
      fill: polygon.getAttribute('fill') || 'rgba(0, 200, 100, 0.3)',
      stroke: polygon.getAttribute('stroke') || 'black',
      strokeWidth: Number(polygon.getAttribute('stroke-width')) || 2,
    });
  });

  // Extraire les polylignes
  const polylines = svgDoc.querySelectorAll('polyline');
  polylines.forEach((polyline) => {
    const pointsAttr = polyline.getAttribute('points');
    if (!pointsAttr) return;

    const pointsList = pointsAttr.trim().split(' ').map((point) => {
      const [x, y] = point.split(',').map(Number);
      return { x, y };
    });

    if (pointsList.length < 2) return;

    shapes.push({
      id: polyline.getAttribute('id') || `polyline_${Date.now()}_${shapes.length}`,
      type: 'polyline',
      points: pointsList,
      fill: polyline.getAttribute('fill') || 'none',
      stroke: polyline.getAttribute('stroke') || 'black',
      strokeWidth: Number(polyline.getAttribute('stroke-width')) || 2,
    });
  });

  // Extraire les cercles
  const circles = svgDoc.querySelectorAll('circle');
  circles.forEach((circle) => {
    const cx = Number(circle.getAttribute('cx'));
    const cy = Number(circle.getAttribute('cy'));
    const r = Number(circle.getAttribute('r'));

    if (isNaN(cx) || isNaN(cy) || isNaN(r)) return;

    // Pour un cercle, nous stockons le centre et un point sur le cercle
    const points = [
      { x: cx, y: cy }, // Centre
      { x: cx + r, y: cy }, // Point sur le cercle (à droite du centre)
    ];

    shapes.push({
      id: circle.getAttribute('id') || `circle_${Date.now()}_${shapes.length}`,
      type: 'circle',
      points,
      fill: circle.getAttribute('fill') || 'rgba(0, 200, 100, 0.3)',
      stroke: circle.getAttribute('stroke') || 'black',
      strokeWidth: Number(circle.getAttribute('stroke-width')) || 2,
    });
  });

  return shapes;
}; 