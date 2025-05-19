import { V } from './vectorUtils';
import { MIN_ANGLE_FOR_PRODUCTION } from '../constants/config';

/**
 * Calcule la distance d'un point à un segment (pour la détection de clic sur un segment)
 * @param {Object} clickPoint - Point de clic {x, y}
 * @param {Object} segmentStart - Point de début du segment {x, y}
 * @param {Object} segmentEnd - Point de fin du segment {x, y}
 * @param {number} threshold - Seuil de détection
 * @returns {boolean} true si le clic est proche du segment
 */
export const isClickNearSegment = (clickPoint, segmentStart, segmentEnd, threshold) => {
  const distance = V.distancePointToSegment(clickPoint, segmentStart, segmentEnd);
  return distance <= threshold;
};

/**
 * Trouve l'index du segment le plus proche d'un clic
 * @param {Object} clickPoint - Point de clic {x, y}
 * @param {Array} points - Points de la forme
 * @param {boolean} isPolygon - Si la forme est un polygone (fermé)
 * @param {number} threshold - Seuil de détection
 * @returns {number|null} Index du segment ou null si aucun n'est trouvé
 */
export const findNearestSegmentIndex = (clickPoint, points, isPolygon, threshold) => {
  if (points.length < 2) return null;

  let minDistance = Infinity;
  let closestSegmentIndex = null;

  // Parcourir tous les segments
  for (let i = 0; i < points.length - 1; i++) {
    const distance = V.distancePointToSegment(clickPoint, points[i], points[i + 1]);
    if (distance < minDistance && distance <= threshold) {
      minDistance = distance;
      closestSegmentIndex = i;
    }
  }

  // Vérifier le segment qui ferme le polygone si nécessaire
  if (isPolygon && points.length > 2) {
    const distance = V.distancePointToSegment(clickPoint, points[points.length - 1], points[0]);
    if (distance < minDistance && distance <= threshold) {
      closestSegmentIndex = points.length - 1;
    }
  }

  return closestSegmentIndex;
};

/**
 * Calcule la longueur d'un chemin (polygone ou polyligne)
 * @param {Array} points - Points de la forme
 * @param {boolean} isPolygon - Si la forme est un polygone (fermé)
 * @returns {number} Longueur totale du chemin
 */
export const calculatePathLength = (points, isPolygon) => {
  if (points.length < 2) return 0;

  let length = 0;
  for (let i = 0; i < points.length - 1; i++) {
    length += V.distance(points[i], points[i + 1]);
  }

  // Ajouter le segment final si c'est un polygone
  if (isPolygon && points.length > 2) {
    length += V.distance(points[points.length - 1], points[0]);
  }

  return length;
};

/**
 * Calcule le nombre total de segments dans une forme
 * @param {Array} points - Points de la forme
 * @param {boolean} isPolygon - Si la forme est un polygone (fermé)
 * @returns {number} Nombre de segments
 */
export const calculateTotalSegments = (points, isPolygon) => {
  if (points.length < 2) return 0;
  return isPolygon ? points.length : points.length - 1;
};

/**
 * Insère un nouveau point sur un segment
 * @param {Array} points - Points de la forme
 * @param {number} segmentIndex - Index du segment
 * @param {Object} newPoint - Nouveau point à insérer {x, y}
 * @returns {Array} Tableau mis à jour avec le nouveau point
 */
export const insertPointOnSegment = (points, segmentIndex, newPoint) => {
  const newPoints = [...points];
  newPoints.splice(segmentIndex + 1, 0, newPoint);
  return newPoints;
};

/**
 * Crée un rectangle à partir de deux points diagonaux
 * @param {Object} startPoint - Premier coin {x, y}
 * @param {Object} endPoint - Coin opposé {x, y}
 * @returns {Array} Points du rectangle
 */
export const createRectanglePoints = (startPoint, endPoint) => {
  return [
    { x: startPoint.x, y: startPoint.y },
    { x: endPoint.x, y: startPoint.y },
    { x: endPoint.x, y: endPoint.y },
    { x: startPoint.x, y: endPoint.y },
  ];
};

/**
 * Crée un carré à partir d'un point de départ et d'une taille
 * @param {Object} startPoint - Point de départ {x, y}
 * @param {Object} endPoint - Point diagonal {x, y} (sera ajusté pour faire un carré)
 * @returns {Array} Points du carré
 */
export const createSquarePoints = (startPoint, endPoint) => {
  const dx = endPoint.x - startPoint.x;
  const dy = endPoint.y - startPoint.y;
  const size = Math.max(Math.abs(dx), Math.abs(dy));
  
  const signX = dx >= 0 ? 1 : -1;
  const signY = dy >= 0 ? 1 : -1;
  
  const adjustedEndPoint = {
    x: startPoint.x + size * signX,
    y: startPoint.y + size * signY,
  };
  
  return createRectanglePoints(startPoint, adjustedEndPoint);
};

/**
 * Crée un cercle approximé par un polygone
 * @param {Object} centerPoint - Centre du cercle {x, y}
 * @param {number} radius - Rayon du cercle
 * @param {number} numSegments - Nombre de segments pour approximer le cercle
 * @returns {Array} Points du cercle
 */
export const createCirclePoints = (centerPoint, radius, numSegments = 24) => {
  const points = [];
  for (let i = 0; i < numSegments; i++) {
    const angle = (i / numSegments) * 2 * Math.PI;
    points.push({
      x: centerPoint.x + radius * Math.cos(angle),
      y: centerPoint.y + radius * Math.sin(angle),
    });
  }
  return points;
};

/**
 * Calcule les angles entre les segments d'un polygone
 * @param {Array} points - Points du polygone
 * @returns {Array} Liste des angles et leur position
 */
export const calculateAngles = (points) => {
  if (points.length < 3) return [];

  const angles = [];
  const n = points.length;

  for (let i = 0; i < n; i++) {
    const prev = (i - 1 + n) % n;
    const curr = i;
    const next = (i + 1) % n;

    const v1 = V.subtract(points[prev], points[curr]);
    const v2 = V.subtract(points[next], points[curr]);

    // Calculer l'angle en radians entre les deux vecteurs
    const dotProduct = V.dot(v1, v2);
    const crossProduct = V.cross(v1, v2);
    const magnitudeProduct = V.magnitude(v1) * V.magnitude(v2);

    if (magnitudeProduct === 0) continue;

    // Calculer l'angle en degrés (0-180°)
    let angleRad = Math.acos(Math.max(-1, Math.min(1, dotProduct / magnitudeProduct)));
    
    // Déterminer le signe (sens horaire ou anti-horaire)
    if (crossProduct < 0) {
      angleRad = 2 * Math.PI - angleRad;
    }
    
    // Convertir en degrés
    let angleDeg = (angleRad * 180) / Math.PI;
    
    // Prendre l'angle intérieur du polygone
    angleDeg = 360 - angleDeg;
    
    // Normaliser entre 0-360°
    if (angleDeg >= 360) angleDeg -= 360;

    // Position du texte pour l'affichage
    const midPoint = {
      x: (points[prev].x + points[curr].x + points[next].x) / 3,
      y: (points[prev].y + points[curr].y + points[next].y) / 3,
    };

    angles.push({
      vertex: points[curr],
      angle: angleDeg,
      textPosition: midPoint,
      isTooSmall: angleDeg < MIN_ANGLE_FOR_PRODUCTION,
    });
  }

  return angles;
};

/**
 * Vérifie si un polygone a des angles trop petits pour la production
 * @param {Array} angles - Liste des angles calculés
 * @returns {boolean} true si au moins un angle est trop petit
 */
export const hasTooSmallAngles = (angles) => {
  return angles.some(angle => angle.isTooSmall);
};

/**
 * Applique un arrondi aux coins d'un polygone
 * @param {Array} points - Points du polygone
 * @param {number} radius - Rayon d'arrondi
 * @param {number} numSegments - Nombre de segments par coin arrondi
 * @param {number|null} selectedVertexIndex - Index du sommet sélectionné pour l'arrondi (null pour tous les sommets)
 * @returns {Array} Points du polygone avec coins arrondis
 */
export const applyCornerRounding = (points, radius, numSegments, selectedVertexIndex = null) => {
  if (points.length < 3 || radius <= 0) return points;

  const n = points.length;
  const result = [...points]; // On part d'une copie des points originaux
  
  // Si aucun vertex spécifique n'est sélectionné ou un index invalide, on retourne les points d'origine
  if (selectedVertexIndex === null || selectedVertexIndex < 0 || selectedVertexIndex >= n) {
    return points;
  }

  // On ne traite que le vertex sélectionné
  const i = selectedVertexIndex;
  const prev = (i - 1 + n) % n;
  const curr = i;
  const next = (i + 1) % n;

  const P = points[curr]; // Le point à arrondir
  const P_prev = points[prev]; // Point précédent
  const P_next = points[next]; // Point suivant

  // Vecteurs du sommet aux points adjacents
  const v_PA = V.subtract(P_prev, P);
  const v_PB = V.subtract(P_next, P);

  const len_PA = V.magnitude(v_PA);
  const len_PB = V.magnitude(v_PB);

  if (len_PA === 0 || len_PB === 0) return points;

  // Calculer l'angle entre les deux segments
  const angleP_cos = V.dot(v_PA, v_PB) / (len_PA * len_PB);
  if (Math.abs(angleP_cos) > 1) return points;
  const angleP = Math.acos(angleP_cos);

  if (isNaN(angleP) || angleP <= 0.01 || angleP >= Math.PI - 0.01) {
    return points; // Angle plat ou nul, on ne peut pas l'arrondir
  }

  // Calculer l'offset pour les points tangents
  let offset = radius / Math.tan(angleP / 2);

  // Limiter le offset maximum pour éviter de dépasser la moitié des segments
  const max_offset = Math.min(len_PA, len_PB) * 0.49;
  if (offset > max_offset) {
    offset = max_offset;
  }
  const effectiveRadius = offset * Math.tan(angleP / 2);
  if (effectiveRadius < 1) {
    return points; // Rayon trop petit pour être effectif
  }

  // Calculer les points tangents sur les segments
  const T_A = V.add(P, V.scale(V.normalize(v_PA), offset));
  const T_B = V.add(P, V.scale(V.normalize(v_PB), offset));

  // Calculer le centre de l'arc
  const dist_PC = effectiveRadius / Math.sin(angleP / 2);
  const bisector_dir_PA_PB = V.normalize(
    V.add(V.normalize(v_PA), V.normalize(v_PB))
  );
  let C = V.add(P, V.scale(bisector_dir_PA_PB, dist_PC));

  // Vérifier si le centre est du bon côté
  const cross_product_val = V.cross(v_PA, v_PB);
  if (V.dot(V.subtract(C, P), bisector_dir_PA_PB) < 0) {
    C = V.add(P, V.scale(bisector_dir_PA_PB, -dist_PC));
  }

  // Calculer les angles de début et de fin de l'arc
  let startAngleArc = V.angle(V.subtract(T_A, C));
  let endAngleArc = V.angle(V.subtract(T_B, C));

  // Ajuster les angles pour le balayage correct de l'arc
  if (cross_product_val > 0) {
    if (endAngleArc > startAngleArc) endAngleArc -= 2 * Math.PI;
  } else {
    if (endAngleArc < startAngleArc) endAngleArc += 2 * Math.PI;
  }

  const totalArcSweep = endAngleArc - startAngleArc;
  const arcPoints = [];

  // Générer les points de l'arc
  for (let j = 0; j <= numSegments; j++) {
    const ratio = j / numSegments;
    const currentAngle = startAngleArc + ratio * totalArcSweep;
    arcPoints.push({
      x: C.x + effectiveRadius * Math.cos(currentAngle),
      y: C.y + effectiveRadius * Math.sin(currentAngle),
    });
  }

  // Remplacer le point du sommet par les points de l'arc
  result.splice(curr, 1, ...arcPoints);

  return result;
};

/**
 * Transforme un sommet en angle composé de segments
 * @param {Array} points - Points du polygone
 * @param {number} curvatureAngleDegree - Angle de courbure souhaité en degrés (0-89)
 * @param {number} numSegments - Nombre de segments pour l'angle (minimum 2)
 * @param {number|null} selectedVertexIndex - Index du sommet à transformer
 * @param {boolean} isPolygon - Si true, la forme est un polygone fermé, sinon une polyligne
 * @returns {Array} Points du polygone avec le sommet transformé en angle
 */
export const transformVertexToAngle = (points, curvatureAngleDegree, numSegments, selectedVertexIndex, isPolygon = true) => {
  if (points.length < 3 || numSegments < 2) return points;
  if (curvatureAngleDegree <= 0) return points; // Pas de courbure si angle est 0 ou négatif

  const n = points.length;
  const result = [...points]; 
  
  if (selectedVertexIndex === null || selectedVertexIndex < 0 || selectedVertexIndex >= n) {
    return points;
  }
  const i = selectedVertexIndex;
  if (!isPolygon && (i === 0 || i === n - 1)) {
    return points;
  }

  const prev = isPolygon ? (i - 1 + n) % n : i - 1;
  const curr = i;
  const next = isPolygon ? (i + 1) % n : i + 1;

  const P = points[curr]; 
  const P_prev = points[prev]; 
  const P_next = points[next]; 

  const v_PA = V.subtract(P_prev, P);
  const v_PB = V.subtract(P_next, P);
  const len_PA = V.magnitude(v_PA);
  const len_PB = V.magnitude(v_PB);

  if (len_PA === 0 || len_PB === 0) return points;

  const angleP_rad = Math.acos(Math.max(-1, Math.min(1, V.dot(v_PA, v_PB) / (len_PA * len_PB))));
  if (isNaN(angleP_rad) || angleP_rad <= 0.01 || angleP_rad >= Math.PI - 0.01) {
    return points; 
  }

  // Calcul du rayon SVG effectif basé sur l'angle de courbure
  const norm_curvature = Math.min(Math.max(curvatureAngleDegree, 0), 89) / 89.0;
  const max_offset_on_segment = Math.min(len_PA, len_PB) * 0.49; // Ne pas dépasser ~la moitié du segment le plus court
  const actual_offset_on_segment = norm_curvature * max_offset_on_segment;
  
  if (actual_offset_on_segment <= 0) return points; // Si l'offset est nul, pas de transformation

  // Le rayon de l'arc lui-même. angleP_rad est l'angle *entre* les segments v_PA et v_PB.
  // L'angle au sommet du triangle isocèle formé par P et les points tangents est angleP_rad.
  // Les angles à la base de ce triangle (aux points tangents) sont (PI - angleP_rad) / 2.
  // Le rayon SVG de l'arc est offset / tan( (PI - angle_de_l_arc_au_centre) / 2 )
  // Ou plus simplement : radius_svg = offset_on_segment * tan(angleP_rad / 2) si offset_on_segment est la distance du sommet aux points tangents.
  const effectiveRadiusSVG = actual_offset_on_segment * Math.tan(angleP_rad / 2.0);

  if (effectiveRadiusSVG <= 0) return points;

  const norm_v_PA = V.normalize(v_PA);
  const norm_v_PB = V.normalize(v_PB);
  const directionMultiplier = 1; // Toujours intérieur

  const anglePoints = [];
  for (let j = 0; j <= numSegments; j++) {
    const t = j / numSegments;
    const interpolatedVector = V.normalize({
      x: norm_v_PA.x * (1 - t) + norm_v_PB.x * t,
      y: norm_v_PA.y * (1 - t) + norm_v_PB.y * t
    });
    const anglePoint = {
      x: P.x + interpolatedVector.x * effectiveRadiusSVG * directionMultiplier,
      y: P.y + interpolatedVector.y * effectiveRadiusSVG * directionMultiplier
    };
    anglePoints.push(anglePoint);
  }
  
  result.splice(curr, 1, ...anglePoints);
  return result;
};

/**
 * Calcule la longueur totale d'un chemin (polygone ou polyligne) en millimètres.
 * @param {Array} points - Points de la forme [{x, y}, ...].
 * @param {boolean} isPolygon - True si la forme est un polygone (fermé), false pour une polyligne.
 * @param {number} svgUnitsPerMm - Le ratio pour convertir les unités SVG en millimètres.
 * @returns {number} La longueur totale du chemin en millimètres, arrondie à une décimale.
 */
export const calculateTotalPathLengthMm = (points, isPolygon, svgUnitsPerMm) => {
  if (!points || points.length < 2) return 0;

  let totalLengthInSvgUnits = 0;
  const numSegments = isPolygon ? points.length : points.length - 1;
  
  for (let i = 0; i < numSegments; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length]; // Gère le dernier segment des polygones
    totalLengthInSvgUnits += V.distance(p1, p2);
  }

  const conversionFactor = svgUnitsPerMm > 0 ? 1 / svgUnitsPerMm : 1;
  const totalLengthInMm = totalLengthInSvgUnits * conversionFactor;
  
  return parseFloat(totalLengthInMm.toFixed(1));
}; 