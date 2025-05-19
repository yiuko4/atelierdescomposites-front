import { useState, useCallback } from 'react';

/**
 * Hook personnalisé pour gérer un état avec historique (annulation/rétablissement)
 * @param {any} initialState - État initial
 * @returns {Object} - Méthodes et états pour gérer l'historique
 */
export function useHistoryState(initialState) {
  const [state, setState] = useState(initialState);
  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);
  const [isUndoRedoAction, setIsUndoRedoAction] = useState(false);

  // Ajoute l'état actuel à l'historique
  const addToHistory = useCallback(
    (currentState) => {
      if (isUndoRedoAction) return;
      setHistory((prev) => [...prev, currentState]);
      setFuture([]);
    },
    [isUndoRedoAction]
  );

  // Action d'annulation
  const undo = useCallback(() => {
    if (history.length === 0) return;

    setIsUndoRedoAction(true);

    const lastAction = history[history.length - 1];
    const newHistory = history.slice(0, -1);

    setFuture((prev) => [lastAction, ...prev]);
    setHistory(newHistory);

    // Traitement spécifique selon le type d'action
    if (lastAction.type === "shapes") {
      setState(lastAction.shapes);
    }

    // Réinitialiser le flag après un court délai
    setTimeout(() => {
      setIsUndoRedoAction(false);
    }, 0);
  }, [history]);

  // Action de rétablissement
  const redo = useCallback(() => {
    if (future.length === 0) return;

    setIsUndoRedoAction(true);

    const nextAction = future[0];
    const newFuture = future.slice(1);

    setHistory((prev) => [...prev, nextAction]);
    setFuture(newFuture);

    // Traitement spécifique selon le type d'action
    if (nextAction.type === "shapes") {
      setState(nextAction.shapes);
    }

    // Réinitialiser le flag après un court délai
    setTimeout(() => {
      setIsUndoRedoAction(false);
    }, 0);
  }, [future]);

  return {
    state,
    setState,
    history,
    future,
    isUndoRedoAction,
    addToHistory,
    undo,
    redo
  };
} 