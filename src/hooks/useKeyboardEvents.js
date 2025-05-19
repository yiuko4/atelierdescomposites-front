import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Hook personnalisé pour gérer les événements clavier globaux
 * @param {Object} options - Options de configuration
 * @param {Function} options.onUndo - Callback pour l'annulation (Ctrl+Z)
 * @param {Function} options.onRedo - Callback pour le rétablissement (Ctrl+Y)
 * @param {Function} options.onDelete - Callback pour la suppression (Delete)
 * @param {Function} options.onEscape - Callback pour la touche Échap
 * @param {Function} options.onEnter - Callback pour la touche Entrée
 * @returns {Object} État des touches spéciales (Ctrl, Shift, Alt)
 */
export function useKeyboardEvents({ 
  onUndo, 
  onRedo, 
  onDelete,
  onEscape,
  onEnter
}) {
  const [isCtrlKeyPressed, setIsCtrlKeyPressed] = useState(false);
  const [isShiftKeyPressed, setIsShiftKeyPressed] = useState(false);
  const [isAltKeyPressed, setIsAltKeyPressed] = useState(false);
  
  // Refs pour accès synchrone dans les event listeners
  const isCtrlKeyPressedRef = useRef(false);
  const isShiftKeyPressedRef = useRef(false);
  const isAltKeyPressedRef = useRef(false);

  // Gestionnaire de touche enfoncée
  const handleKeyDown = useCallback((event) => {
    // Mise à jour des états des touches de modification
    if (event.key === 'Control') {
      setIsCtrlKeyPressed(true);
      isCtrlKeyPressedRef.current = true;
    } else if (event.key === 'Shift') {
      setIsShiftKeyPressed(true);
      isShiftKeyPressedRef.current = true;
    } else if (event.key === 'Alt') {
      setIsAltKeyPressed(true);
      isAltKeyPressedRef.current = true;
    }

    // Vérifier si on est dans un élément de saisie
    const targetTagName = event.target.tagName.toLowerCase();
    const isEditingInput =
      targetTagName === "input" ||
      targetTagName === "textarea" ||
      event.target.isContentEditable;

    // Gestion des raccourcis clavier
    if (isCtrlKeyPressedRef.current) {
      if (event.key === 'z' && onUndo) {
        event.preventDefault();
        onUndo();
      } else if (event.key === 'y' && onRedo) {
        event.preventDefault();
        onRedo();
      }
    } else if (event.key === 'Delete' && onDelete) {
      onDelete();
    } else if (event.key === 'Escape' && onEscape) {
      onEscape();
    } else if (event.key === 'Enter' && onEnter && !isEditingInput) {
      event.preventDefault();
      onEnter();
    }
  }, [onUndo, onRedo, onDelete, onEscape, onEnter]);

  // Gestionnaire de touche relâchée
  const handleKeyUp = useCallback((event) => {
    if (event.key === 'Control') {
      setIsCtrlKeyPressed(false);
      isCtrlKeyPressedRef.current = false;
    } else if (event.key === 'Shift') {
      setIsShiftKeyPressed(false);
      isShiftKeyPressedRef.current = false;
    } else if (event.key === 'Alt') {
      setIsAltKeyPressed(false);
      isAltKeyPressedRef.current = false;
    }
  }, []);

  // Mise en place des écouteurs d'événements lors du montage du composant
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    // Nettoyage des écouteurs lors du démontage
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  return {
    isCtrlKeyPressed,
    isShiftKeyPressed,
    isAltKeyPressed,
    isCtrlKeyPressedRef,
    isShiftKeyPressedRef,
    isAltKeyPressedRef
  };
} 