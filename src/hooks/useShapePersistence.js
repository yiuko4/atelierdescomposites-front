import { useState, useEffect } from 'react';

/**
 * Hook personnalisé pour gérer la persistance des formes
 * @param {string} storageKey - Clé de stockage dans sessionStorage
 * @param {Array} defaultValue - Valeur par défaut si rien n'est trouvé dans le stockage
 * @returns {[Array, Function]} - Les formes et la fonction pour les mettre à jour
 */
export function useShapePersistence(storageKey = 'persistedShapes', defaultValue = []) {
  // Initialisation de l'état avec les données du sessionStorage, si disponibles
  const [shapes, setShapes] = useState(() => {
    const savedData = sessionStorage.getItem(storageKey);
    try {
      return savedData ? JSON.parse(savedData) : defaultValue;
    } catch (e) {
      console.error(`Failed to parse persisted ${storageKey}:`, e);
      sessionStorage.removeItem(storageKey); // Effacer les données corrompues
      return defaultValue;
    }
  });

  // Fonction pour mettre à jour les formes et les persister
  const setShapesAndPersist = (newShapesOrCallback) => {
    setShapes(prevShapes => {
      const newActualShapes = typeof newShapesOrCallback === 'function' 
        ? newShapesOrCallback(prevShapes) 
        : newShapesOrCallback;
      
      sessionStorage.setItem(storageKey, JSON.stringify(newActualShapes));
      return newActualShapes;
    });
  };

  return [shapes, setShapesAndPersist];
} 