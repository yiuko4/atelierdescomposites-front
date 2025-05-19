// Fonctions utilitaires pour la géométrie vectorielle
export const V = {
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