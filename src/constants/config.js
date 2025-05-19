// Configuration de l'application

// Base URLs from environment variables with fallbacks
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:30001';
export const EMPORTEPIECE_WS_URL = import.meta.env.VITE_EMPORTEPIECE_WS_URL || 'http://localhost:3000';

// Constantes pour la manipulation des formes
export const MOVE_THRESHOLD = 5; // Pixels
export const HOLD_DELAY = 100; // Millisecondes
export const SEGMENT_CLICK_THRESHOLD = 10; // En unités SVG

// Constantes pour l'affichage et la validation
export const TEXT_OFFSET_FOR_ANGLES = 15; // Décalage pour l'affichage du texte des angles
export const MIN_ANGLE_FOR_PRODUCTION = 65; // Angle minimum requis pour la production 