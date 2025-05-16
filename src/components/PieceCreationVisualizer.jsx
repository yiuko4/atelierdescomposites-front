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
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  
  // Dimensions du canvas
  const canvasWidth = 800;
  const canvasHeight = 600;
  
  // Position et orientation actuelles (au centre du canvas)
  const positionRef = useRef({ x: canvasWidth / 2, y: canvasHeight / 2, angle: 0 });
  
  // Historique des points pour dessiner le tracé
  const [points, setPoints] = useState([{ x: canvasWidth / 2, y: canvasHeight / 2 }]);
  
  // Réinitialiser l'animation quand le composant est monté
  useEffect(() => {
    setCurrentStep(0);
    setPoints([{ x: canvasWidth / 2, y: canvasHeight / 2 }]);
    positionRef.current = { x: canvasWidth / 2, y: canvasHeight / 2, angle: 0 };
    drawCanvas();
    
    return () => {
      if (animationRef.current) {
        clearTimeout(animationRef.current);
      }
    };
  }, []);
  
  // Mettre à jour le canvas quand les points changent
  useEffect(() => {
    drawCanvas();
  }, [points]);
  
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
        
        // Ajouter le nouveau point au tracé
        setPoints(prev => [...prev, { x: position.x, y: position.y }]);
        positionRef.current = position;
        break;
        
      case 'SE_DÉPLACER':
        // Déplacer sans tracer (lever le crayon)
        const moveAngleRad = (position.angle * Math.PI) / 180;
        position.x += Math.cos(moveAngleRad) * valeur;
        position.y += Math.sin(moveAngleRad) * valeur;
        
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
    
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Dessiner le fond
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Calculer le décalage pour centrer sur la position actuelle
    const offsetX = canvasWidth / 2 - positionRef.current.x;
    const offsetY = canvasHeight / 2 - positionRef.current.y;
    
    // Appliquer la translation pour centrer sur la position actuelle
    ctx.save();
    ctx.translate(offsetX, offsetY);
    
    // Dessiner les axes
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 1;
    
    // Axe horizontal
    ctx.beginPath();
    ctx.moveTo(0, canvasHeight / 2 - offsetY);
    ctx.lineTo(canvasWidth, canvasHeight / 2 - offsetY);
    ctx.stroke();
    
    // Axe vertical
    ctx.beginPath();
    ctx.moveTo(canvasWidth / 2 - offsetX, 0);
    ctx.lineTo(canvasWidth / 2 - offsetX, canvasHeight);
    ctx.stroke();
    
    // Dessiner le tracé
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 2;
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
    
    // Dessiner la position actuelle
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(positionRef.current.x, positionRef.current.y, 5, 0, Math.PI * 2);
    ctx.fill();
    
    // Dessiner la direction
    const dirLength = 20;
    const dirX = positionRef.current.x + Math.cos(positionRef.current.angle * Math.PI / 180) * dirLength;
    const dirY = positionRef.current.y + Math.sin(positionRef.current.angle * Math.PI / 180) * dirLength;
    
    ctx.strokeStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(positionRef.current.x, positionRef.current.y);
    ctx.lineTo(dirX, dirY);
    ctx.stroke();
    
    // Restaurer le contexte
    ctx.restore();
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
      setPoints([{ x: canvasWidth / 2, y: canvasHeight / 2 }]);
      positionRef.current = { x: canvasWidth / 2, y: canvasHeight / 2, angle: 0 };
      
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
    setPoints([{ x: canvasWidth / 2, y: canvasHeight / 2 }]);
    positionRef.current = { x: canvasWidth / 2, y: canvasHeight / 2, angle: 0 };
    setIsPlaying(false);
  };
  
  // Changer la vitesse de l'animation
  const handleSpeedChange = (e) => {
    setSpeed(parseFloat(e.target.value));
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-xl font-semibold">Création de pièce - Étape {currentStep + 1}/{etapes.length}</h2>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="p-4 flex-grow overflow-auto">
          <div className="mb-4 p-4 bg-gray-50 rounded-lg">
            {etapes[currentStep] && (
              <div className="flex flex-col">
                <div className="text-lg font-medium">
                  Action: <span className="text-blue-600">{etapes[currentStep].action}</span>
                </div>
                {etapes[currentStep].valeur !== undefined && (
                  <div className="text-lg">
                    Valeur: <span className="text-blue-600">{etapes[currentStep].valeur}</span>
                  </div>
                )}
              </div>
            )}
          </div>
          
          <div className="flex justify-center">
            <canvas 
              ref={canvasRef} 
              width={canvasWidth} 
              height={canvasHeight}
              className="border border-gray-300 rounded-lg"
            />
          </div>
        </div>
        
        <div className="p-4 border-t">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <button
                onClick={handleReset}
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded"
              >
                Réinitialiser
              </button>
              <button
                onClick={handlePrevStep}
                disabled={currentStep === 0}
                className={`px-4 py-2 rounded ${
                  currentStep === 0 
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-800'
                }`}
              >
                Précédent
              </button>
              <button
                onClick={togglePlay}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
              >
                {isPlaying ? 'Pause' : 'Lecture'}
              </button>
              <button
                onClick={handleNextStep}
                disabled={currentStep === etapes.length - 1}
                className={`px-4 py-2 rounded ${
                  currentStep === etapes.length - 1 
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-800'
                }`}
              >
                Suivant
              </button>
            </div>
            
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">Vitesse:</span>
              <input
                type="range"
                min="0.5"
                max="3"
                step="0.5"
                value={speed}
                onChange={handleSpeedChange}
                className="w-24"
              />
              <span className="text-sm font-medium">{speed}x</span>
            </div>
          </div>
          
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div 
              className="bg-blue-600 h-2.5 rounded-full" 
              style={{ width: `${(currentStep / (etapes.length - 1)) * 100}%` }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PieceCreationVisualizer;
