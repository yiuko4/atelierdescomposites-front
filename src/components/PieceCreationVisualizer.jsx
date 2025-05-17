import React, { useState, useEffect, useRef } from "react";

/**
 * Composant pour visualiser la création d'une pièce étape par étape
 * @param {Object} props - Propriétés du composant
 * @param {Array} props.etapes - Liste des étapes de création de la pièce
 * @param {Function} props.onClose - Fonction appelée pour fermer le popup
 */
function PieceCreationVisualizer({ etapes, onClose }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [zoom, setZoom] = useState(1); // Niveau de zoom
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const containerRef = useRef(null);
  
  // Dimensions du canvas (dynamiques pour le plein écran)
  const [canvasSize, setCanvasSize] = useState({
    width: window.innerWidth * 0.8,
    height: window.innerHeight * 0.6
  });
  
  // Position et orientation actuelles (au centre du canvas)
  const positionRef = useRef({ 
    x: canvasSize.width / 2, 
    y: canvasSize.height / 2, 
    angle: 0 
  });
  
  // Historique des points pour dessiner le tracé
  const [points, setPoints] = useState([{ 
    x: canvasSize.width / 2, 
    y: canvasSize.height / 2 
  }]);
  
  // Pour le calcul de l'échelle automatique
  const boundingBoxRef = useRef({ 
    minX: canvasSize.width / 2, 
    maxX: canvasSize.width / 2, 
    minY: canvasSize.height / 2, 
    maxY: canvasSize.height / 2 
  });
  
  // Gérer le redimensionnement de la fenêtre
  useEffect(() => {
    const handleResize = () => {
      // Recalculer la taille du canvas
      if (containerRef.current) {
        const containerWidth = containerRef.current.clientWidth - 32; // Soustraction du padding
        const containerHeight = window.innerHeight * 0.65; // 65% de la hauteur de la fenêtre
        
        setCanvasSize({
          width: containerWidth,
          height: containerHeight
        });
      }
    };
    
    // Exécuter une fois au démarrage
    handleResize();
    
    // Ajouter l'écouteur d'événement de redimensionnement
    window.addEventListener('resize', handleResize);
    
    // Nettoyer l'écouteur lorsque le composant est démonté
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);
  
  // Réinitialiser l'animation quand le composant est monté ou quand la taille du canvas change
  useEffect(() => {
    setCurrentStep(0);
    setPoints([{ x: canvasSize.width / 2, y: canvasSize.height / 2 }]);
    positionRef.current = { x: canvasSize.width / 2, y: canvasSize.height / 2, angle: 0 };
    boundingBoxRef.current = { 
      minX: canvasSize.width / 2, 
      maxX: canvasSize.width / 2, 
      minY: canvasSize.height / 2, 
      maxY: canvasSize.height / 2 
    };
    drawCanvas();
    
    return () => {
      if (animationRef.current) {
        clearTimeout(animationRef.current);
      }
    };
  }, [canvasSize]);
  
  // Mettre à jour le canvas quand les points changent
  useEffect(() => {
    drawCanvas();
  }, [points, zoom]);
  
  // Gérer la lecture automatique des étapes
  useEffect(() => {
    if (isPlaying && currentStep < etapes.length - 1) {
      animationRef.current = setTimeout(() => {
        setCurrentStep(prev => prev + 1);
        executeStep(currentStep + 1);
      }, 1000 / speed);
      
      return () => {
        if (animationRef.current) {
          clearTimeout(animationRef.current);
        }
      };
    } else if (currentStep >= etapes.length - 1) {
      setIsPlaying(false);
    }
  }, [isPlaying, currentStep, etapes, speed]);
  
  // Calcule l'échelle appropriée pour afficher toute la forme
  const calculateScale = () => {
    const { minX, maxX, minY, maxY } = boundingBoxRef.current;
    const width = maxX - minX;
    const height = maxY - minY;
    
    if (width <= 0 || height <= 0) return 1;
    
    // Ajouter une marge de 20%
    const margin = 0.2;
    const scaleX = canvasSize.width / (width * (1 + margin));
    const scaleY = canvasSize.height / (height * (1 + margin));
    
    // Utiliser l'échelle la plus petite pour s'assurer que tout est visible
    return Math.min(scaleX, scaleY);
  };
  
  // Exécuter une étape spécifique
  const executeStep = (stepIndex) => {
    if (!etapes || stepIndex >= etapes.length) return;
    
    const etape = etapes[stepIndex];
    const { action, valeur } = etape;
    const position = { ...positionRef.current };
    
    switch (action) {
      case 'PLIER':
        // Changer l'angle de direction
        position.angle += valeur;
        positionRef.current = position;
        break;
        
      case 'AVANCER':
        // Calculer la nouvelle position en fonction de l'angle et de la distance
        const angleRad = (position.angle * Math.PI) / 180;
        position.x += Math.cos(angleRad) * valeur;
        position.y += Math.sin(angleRad) * valeur;
        
        // Mettre à jour la bounding box
        boundingBoxRef.current.minX = Math.min(boundingBoxRef.current.minX, position.x);
        boundingBoxRef.current.maxX = Math.max(boundingBoxRef.current.maxX, position.x);
        boundingBoxRef.current.minY = Math.min(boundingBoxRef.current.minY, position.y);
        boundingBoxRef.current.maxY = Math.max(boundingBoxRef.current.maxY, position.y);
        
        // Ajouter le nouveau point au tracé
        setPoints(prev => [...prev, { x: position.x, y: position.y }]);
        positionRef.current = position;
        break;
        
      case 'SE_DÉPLACER':
        // Déplacer sans tracer (lever le crayon)
        const moveAngleRad = (position.angle * Math.PI) / 180;
        position.x += Math.cos(moveAngleRad) * valeur;
        position.y += Math.sin(moveAngleRad) * valeur;
        
        // Mettre à jour la bounding box
        boundingBoxRef.current.minX = Math.min(boundingBoxRef.current.minX, position.x);
        boundingBoxRef.current.maxX = Math.max(boundingBoxRef.current.maxX, position.x);
        boundingBoxRef.current.minY = Math.min(boundingBoxRef.current.minY, position.y);
        boundingBoxRef.current.maxY = Math.max(boundingBoxRef.current.maxY, position.y);
        
        // Commencer un nouveau segment
        setPoints(prev => [...prev, null, { x: position.x, y: position.y }]);
        positionRef.current = position;
        break;
        
      case 'COUPER':
        // Fin de la création
        break;
        
      default:
        console.warn(`Action non reconnue: ${action}`);
    }
  };
  
  // Dessiner sur le canvas
  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Ajuster la taille physique du canvas
    canvas.width = canvasSize.width;
    canvas.height = canvasSize.height;
    
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Dessiner le fond
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Calculer le centre de la forme
    const { minX, maxX, minY, maxY } = boundingBoxRef.current;
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    
    // Calculer l'échelle automatique si nécessaire
    const autoScale = calculateScale();
    const effectiveScale = zoom * autoScale;
    
    // Appliquer la translation pour centrer la forme
    ctx.save();
    ctx.translate(canvasSize.width / 2, canvasSize.height / 2);
    ctx.scale(effectiveScale, effectiveScale);
    ctx.translate(-centerX, -centerY);
    
    // Dessiner une grille de référence
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 0.5 / effectiveScale;
    
    const gridSize = 50; // Taille de la grille
    const gridExtent = Math.max(
      Math.abs(minX - centerX), 
      Math.abs(maxX - centerX),
      Math.abs(minY - centerY),
      Math.abs(maxY - centerY)
    ) * 2;
    
    // Grille horizontale
    for (let i = -gridExtent; i <= gridExtent; i += gridSize) {
      ctx.beginPath();
      ctx.moveTo(centerX - gridExtent, centerY + i);
      ctx.lineTo(centerX + gridExtent, centerY + i);
      ctx.stroke();
    }
    
    // Grille verticale
    for (let i = -gridExtent; i <= gridExtent; i += gridSize) {
      ctx.beginPath();
      ctx.moveTo(centerX + i, centerY - gridExtent);
      ctx.lineTo(centerX + i, centerY + gridExtent);
      ctx.stroke();
    }
    
    // Axes principaux (plus épais)
    ctx.strokeStyle = '#aaa';
    ctx.lineWidth = 1 / effectiveScale;
    
    // Axe horizontal
    ctx.beginPath();
    ctx.moveTo(centerX - gridExtent, centerY);
    ctx.lineTo(centerX + gridExtent, centerY);
    ctx.stroke();
    
    // Axe vertical
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - gridExtent);
    ctx.lineTo(centerX, centerY + gridExtent);
    ctx.stroke();
    
    // Dessiner le tracé complet (plus fin, en gris)
    ctx.strokeStyle = '#aaa';
    ctx.lineWidth = 1.5 / effectiveScale;
    ctx.beginPath();
    
    let isPenDown = true;
    
    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      
      if (point === null) {
        // Lever le crayon
        isPenDown = false;
        continue;
      }
      
      if (isPenDown) {
        ctx.lineTo(point.x, point.y);
      } else {
        ctx.stroke(); // Terminer le segment précédent
        ctx.beginPath();
        ctx.moveTo(point.x, point.y);
        isPenDown = true;
      }
    }
    
    ctx.stroke();
    
    // Tracer à nouveau le tracé jusqu'à l'étape actuelle (plus épais, en bleu)
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 3 / effectiveScale;
    ctx.beginPath();
    
    isPenDown = true;
    const currentPoints = points.slice(0, getCurrentPointIndex() + 1);
    
    for (let i = 0; i < currentPoints.length; i++) {
      const point = currentPoints[i];
      
      if (point === null) {
        // Lever le crayon
        isPenDown = false;
        continue;
      }
      
      if (isPenDown) {
        ctx.lineTo(point.x, point.y);
      } else {
        ctx.stroke(); // Terminer le segment précédent
        ctx.beginPath();
        ctx.moveTo(point.x, point.y);
        isPenDown = true;
      }
    }
    
    ctx.stroke();
    
    // Dessiner la position actuelle
    const currentPos = positionRef.current;
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(currentPos.x, currentPos.y, 5 / effectiveScale, 0, Math.PI * 2);
    ctx.fill();
    
    // Dessiner la direction
    const dirLength = 20 / effectiveScale;
    const dirX = currentPos.x + Math.cos(currentPos.angle * Math.PI / 180) * dirLength;
    const dirY = currentPos.y + Math.sin(currentPos.angle * Math.PI / 180) * dirLength;
    
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2 / effectiveScale;
    ctx.beginPath();
    ctx.moveTo(currentPos.x, currentPos.y);
    ctx.lineTo(dirX, dirY);
    ctx.stroke();
    
    // Ajouter une flèche au bout de la direction
    const arrowSize = 5 / effectiveScale;
    const angle = currentPos.angle * Math.PI / 180;
    ctx.beginPath();
    ctx.moveTo(dirX, dirY);
    ctx.lineTo(
      dirX - arrowSize * Math.cos(angle - Math.PI / 6),
      dirY - arrowSize * Math.sin(angle - Math.PI / 6)
    );
    ctx.lineTo(
      dirX - arrowSize * Math.cos(angle + Math.PI / 6),
      dirY - arrowSize * Math.sin(angle + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fillStyle = '#ef4444';
    ctx.fill();
    
    // Restaurer le contexte
    ctx.restore();
    
    // Afficher les informations de l'étape courante
    if (currentStep < etapes.length) {
      const etape = etapes[currentStep];
      const { action, valeur } = etape;
      
      // Dessiner un bandeau d'information en haut du canvas
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(0, 0, canvas.width, 40);
      
      ctx.fillStyle = 'white';
      ctx.font = '14px Arial';
      ctx.textAlign = 'center';
      
      let actionText = action;
      switch (action) {
        case 'PLIER':
          actionText = `ROTATION: ${valeur > 0 ? '+' : ''}${valeur.toFixed(1)}°`;
          break;
        case 'AVANCER':
          actionText = `AVANCER: ${valeur.toFixed(1)} unités`;
          break;
        case 'COUPER':
          actionText = 'FIN DE LA DÉCOUPE';
          break;
        default:
          actionText = `${action}: ${valeur || ''}`;
      }
      
      ctx.fillText(actionText, canvas.width / 2, 25);
    }
  };
  
  // Obtenir l'index du point correspondant à l'étape courante
  const getCurrentPointIndex = () => {
    let pointIndex = 0;
    
    for (let i = 0; i <= currentStep; i++) {
      if (i >= etapes.length) break;
      
      const etape = etapes[i];
      switch (etape.action) {
        case 'AVANCER':
        case 'SE_DÉPLACER':
          pointIndex++;
          break;
        default:
          break;
      }
    }
    
    return Math.min(pointIndex, points.length - 1);
  };
  
  // Passer à l'étape suivante manuellement
  const handleNextStep = () => {
    if (currentStep < etapes.length - 1) {
      setCurrentStep(prev => prev + 1);
      executeStep(currentStep + 1);
    }
  };
  
  // Passer à l'étape précédente manuellement
  const handlePrevStep = () => {
    if (currentStep > 0) {
      // Pour revenir en arrière, on doit réexécuter toutes les étapes depuis le début
      setCurrentStep(prev => prev - 1);
      setPoints([{ x: canvasSize.width / 2, y: canvasSize.height / 2 }]);
      positionRef.current = { x: canvasSize.width / 2, y: canvasSize.height / 2, angle: 0 };
      boundingBoxRef.current = { 
        minX: canvasSize.width / 2, 
        maxX: canvasSize.width / 2, 
        minY: canvasSize.height / 2, 
        maxY: canvasSize.height / 2 
      };
      
      // Réexécuter toutes les étapes jusqu'à la nouvelle étape courante
      for (let i = 0; i <= currentStep - 1; i++) {
        executeStep(i);
      }
    }
  };
  
  // Démarrer/Pauser l'animation
  const togglePlay = () => {
    setIsPlaying(prev => !prev);
  };
  
  // Réinitialiser l'animation
  const handleReset = () => {
    setCurrentStep(0);
    setPoints([{ x: canvasSize.width / 2, y: canvasSize.height / 2 }]);
    positionRef.current = { x: canvasSize.width / 2, y: canvasSize.height / 2, angle: 0 };
    boundingBoxRef.current = { 
      minX: canvasSize.width / 2, 
      maxX: canvasSize.width / 2, 
      minY: canvasSize.height / 2, 
      maxY: canvasSize.height / 2 
    };
    setIsPlaying(false);
  };
  
  // Changer la vitesse de l'animation
  const handleSpeedChange = (e) => {
    setSpeed(parseFloat(e.target.value));
  };
  
  // Mettre à jour le zoom
  const handleZoomChange = (e) => {
    setZoom(parseFloat(e.target.value));
  };
  
  // Faire défiler jusqu'à une étape spécifique
  const handleSeek = (e) => {
    const newStep = parseInt(e.target.value, 10);
    
    if (newStep < currentStep) {
      // Si on recule, on doit tout réinitialiser et rejouer jusqu'à la nouvelle étape
      setPoints([{ x: canvasSize.width / 2, y: canvasSize.height / 2 }]);
      positionRef.current = { x: canvasSize.width / 2, y: canvasSize.height / 2, angle: 0 };
      boundingBoxRef.current = { 
        minX: canvasSize.width / 2, 
        maxX: canvasSize.width / 2, 
        minY: canvasSize.height / 2, 
        maxY: canvasSize.height / 2 
      };
      
      // Exécuter toutes les étapes jusqu'à la nouvelle position
      for (let i = 0; i <= newStep; i++) {
        executeStep(i);
      }
    } else if (newStep > currentStep) {
      // Si on avance, on exécute les étapes depuis la position actuelle
      for (let i = currentStep + 1; i <= newStep; i++) {
        executeStep(i);
      }
    }
    
    setCurrentStep(newStep);
  };
  
  // Calcul du pourcentage de progression
  const progressPercentage = etapes.length > 0 
    ? (currentStep / (etapes.length - 1)) * 100 
    : 0;

  // Vérifier si nous avons des données à visualiser
  if (!etapes || etapes.length === 0) {
    return null;
  }
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-[95vw] h-[95vh] flex flex-col" ref={containerRef}>
        <div className="p-4 border-b flex justify-between items-center bg-indigo-700 text-white rounded-t-lg">
          <h2 className="text-xl font-semibold">Visualisation des étapes de production</h2>
          <button 
            onClick={onClose}
            className="text-white hover:text-indigo-200 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="p-4 flex-grow overflow-auto flex flex-col">
          <div className="bg-gray-100 rounded-lg p-4 mb-4">
            <div className="flex justify-between items-center mb-2">
              <div className="font-semibold text-indigo-800">
                Étape {currentStep + 1} sur {etapes.length}
              </div>
              <div className="text-sm text-gray-600">
                {currentStep < etapes.length && (
                  <span>
                    Action: <span className="font-medium">{etapes[currentStep].action}</span>
                    {etapes[currentStep].valeur !== undefined && (
                      <span> | Valeur: <span className="font-medium">{etapes[currentStep].valeur}</span></span>
                    )}
                  </span>
                )}
              </div>
            </div>
            
            {/* Barre de progression */}
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-indigo-600 transition-all duration-300 ease-out"
                style={{ width: `${progressPercentage}%` }}
              ></div>
            </div>
          </div>
          
          <div className="flex flex-col items-center flex-grow">
            {/* Le canvas prend tout l'espace disponible */}
            <div className="w-full flex-grow flex justify-center items-center">
              <canvas 
                ref={canvasRef}
                className="border border-gray-300 rounded-md shadow-sm bg-white"
              />
            </div>
            
            <div className="w-full mt-4 flex flex-col gap-3">
              {/* Contrôles de l'animation */}
              <div className="flex justify-center gap-3 mb-2">
                <button
                  onClick={handleReset}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors duration-150 flex items-center gap-1"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                  </svg>
                  <span>Réinitialiser</span>
                </button>
                <button
                  onClick={handlePrevStep}
                  disabled={currentStep === 0}
                  className="px-4 py-2 bg-indigo-500 text-white rounded-md hover:bg-indigo-600 disabled:bg-gray-300 disabled:text-gray-500 transition-colors duration-150 flex items-center gap-1"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>Précédent</span>
                </button>
                <button
                  onClick={togglePlay}
                  className={`px-4 py-2 rounded-md transition-colors duration-150 flex items-center gap-1 ${
                    isPlaying ? 'bg-orange-500 hover:bg-orange-600 text-white' : 'bg-green-500 hover:bg-green-600 text-white'
                  }`}
                >
                  {isPlaying ? (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      <span>Pause</span>
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                      </svg>
                      <span>Lecture</span>
                    </>
                  )}
                </button>
                <button
                  onClick={handleNextStep}
                  disabled={currentStep >= etapes.length - 1}
                  className="px-4 py-2 bg-indigo-500 text-white rounded-md hover:bg-indigo-600 disabled:bg-gray-300 disabled:text-gray-500 transition-colors duration-150 flex items-center gap-1"
                >
                  <span>Suivant</span>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
              
              {/* Contrôles avancés */}
              <div className="grid grid-cols-2 gap-6">
                {/* Slider de position */}
                <div className="p-3 bg-gray-50 rounded-md border border-gray-200">
                  <label htmlFor="seek" className="block text-sm font-medium text-gray-700 mb-1">
                    Position
                  </label>
                  <input
                    id="seek"
                    type="range"
                    min="0"
                    max={etapes.length - 1}
                    value={currentStep}
                    onChange={handleSeek}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                </div>
                
                {/* Contrôle de la vitesse */}
                <div className="p-3 bg-gray-50 rounded-md border border-gray-200">
                  <label htmlFor="speed" className="block text-sm font-medium text-gray-700 mb-1">
                    Vitesse: {speed}x
                  </label>
                  <input
                    id="speed"
                    type="range"
                    min="0.25"
                    max="5"
                    step="0.25"
                    value={speed}
                    onChange={handleSpeedChange}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                </div>
                
                {/* Contrôle du zoom */}
                <div className="col-span-2 p-3 bg-gray-50 rounded-md border border-gray-200">
                  <label htmlFor="zoom" className="block text-sm font-medium text-gray-700 mb-1">
                    Zoom: {zoom.toFixed(1)}x
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">0.5x</span>
                    <input
                      id="zoom"
                      type="range"
                      min="0.5"
                      max="5"
                      step="0.1"
                      value={zoom}
                      onChange={handleZoomChange}
                      className="flex-grow h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                    <span className="text-sm">5x</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PieceCreationVisualizer;
