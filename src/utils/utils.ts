// Types pour les polygones et points
interface Point {
  x: number;
  y: number;
}

interface Polygon {
  type: string;
  points: Point[];
}

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  top: number;
  left: number;
  right: number;
  bottom: number;
}

interface SegmentDimension {
  lengthMm: number;
  midX: number;
  midY: number;
  angle: number;
  p1Index: number;
  p2Index: number;
}

interface AngleDimension {
  angle: number;
  degrees: number;
  centerX: number;
  centerY: number;
  radius: number;
  pointIndex: number;
}

export function getPolygonBoundingBox(polygon: Polygon | null): BoundingBox {
  if (!polygon || polygon.type !== 'polygon' || polygon.points.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 };
  }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  polygon.points.forEach(p => {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  });
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY, top: minY, left: minX, right: maxX, bottom: maxY };
}

export function getPolygonSegmentDimensions(polygon: Polygon | null, pixelsPerMm: number): SegmentDimension[] {
  if (!polygon || polygon.type !== 'polygon' || polygon.points.length < 2) return [];
  const dimensions: SegmentDimension[] = [];
  for (let i = 0; i < polygon.points.length; i++) {
    const p1 = polygon.points[i];
    const p2 = polygon.points[(i + 1) % polygon.points.length];
    const lengthPx = Math.sqrt((p2.x - p1.x)**2 + (p2.y - p1.y)**2);
    const lengthMm = lengthPx / pixelsPerMm;
    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;
    let angle = Math.atan2(p2.y - p1.y, p2.x - p1.x) * (180 / Math.PI);
    // Adjust angle for text readability (e.g., always upright)
    if (angle > 90) { angle -= 180; }
    else if (angle < -90) { angle += 180; }
    dimensions.push({ lengthMm, midX, midY, angle, p1Index: i, p2Index: (i + 1) % polygon.points.length });
  }
  return dimensions;
}

export function getPolygonAngleDimensions(polygon: Polygon | null): AngleDimension[] {
  if (!polygon || polygon.type !== 'polygon' || polygon.points.length < 3) return [];
  const angleData: AngleDimension[] = [];
  const points = polygon.points;
  const len = points.length;

  for (let i = 0; i < len; i++) {
    const p1 = points[i]; 
    const p0 = points[(i - 1 + len) % len];
    const p2 = points[(i + 1) % len];

    const v1x = p0.x - p1.x;
    const v1y = p0.y - p1.y;
    const v2x = p2.x - p1.x;
    const v2y = p2.y - p1.y;

    const mag1 = Math.sqrt(v1x * v1x + v1y * v1y);
    const mag2 = Math.sqrt(v2x * v2x + v2y * v2y);

    // Avoid division by zero
    if (mag1 === 0 || mag2 === 0) continue;

    // Dot product and angle calculation
    const dotProduct = v1x * v2x + v1y * v2y;
    const cosAngle = dotProduct / (mag1 * mag2);
    
    // Clamp to handle floating point errors
    const clampedCosAngle = Math.max(-1, Math.min(1, cosAngle));
    const radians = Math.acos(clampedCosAngle);
    const degrees = radians * (180 / Math.PI);

    // Cross product to determine if angle is concave or convex
    const crossProduct = v1x * v2y - v1y * v2x;
    const adjustedDegrees = crossProduct < 0 ? 360 - degrees : degrees;

    // Calculate a point for the angle arc display
    const radius = Math.min(mag1, mag2) * 0.3; // 30% of the shorter edge
    
    angleData.push({
      angle: radians,
      degrees: adjustedDegrees,
      centerX: p1.x,
      centerY: p1.y,
      radius,
      pointIndex: i
    });
  }
  
  return angleData;
}

export function distanceToSegment(p: Point, p1: Point, p2: Point): number {
  const A = p.x - p1.x;
  const B = p.y - p1.y;
  const C = p2.x - p1.x;
  const D = p2.y - p1.y;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;
  if (lenSq !== 0) param = dot / lenSq;

  let xx, yy;
  if (param < 0) {
    xx = p1.x;
    yy = p1.y;
  } else if (param > 1) {
    xx = p2.x;
    yy = p2.y;
  } else {
    xx = p1.x + param * C;
    yy = p1.y + param * D;
  }

  const dx = p.x - xx;
  const dy = p.y - yy;
  return Math.sqrt(dx * dx + dy * dy);
}

export function formatPoints(pointsArray: Point[]): string {
  return pointsArray.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
}

export function getRectangleHandles(shape: any): Point[] {
  if (!shape || shape.type !== 'rectangle') return [];
  const { x, y, width, height } = shape;
  return [
    { x, y }, // top-left
    { x: x + width, y }, // top-right
    { x: x + width, y: y + height }, // bottom-right
    { x, y: y + height } // bottom-left
  ];
}
