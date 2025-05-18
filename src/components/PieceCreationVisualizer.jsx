import React, { useState, useEffect, useRef } from "react";

/**
 * Composant pour visualiser la création d'une pièce étape par étape.
 * En mode "direct", il affiche l'état de la pièce jusqu'à `highlightStepIndex`.
 * @param {Object} props - Propriétés du composant
 * @param {Array} props.sequence - La séquence complète des étapes de création.
 * @param {number} props.highlightStepIndex - L'index (1-basé) de l'étape en cours de traitement.
 * @param {Function} props.onClose - Fonction appelée lorsque l'action de fermeture est initiée (ex: par un bouton "Fermer").
 * @param {string} [props.mode='manual'] - 'manual' pour contrôles interactifs, 'direct' pour affichage piloté.
 */
function PieceCreationVisualizer({ 
  sequence, 
  highlightStepIndex, 
  onClose, 
  mode = 'manual'
}) {
  const [zoom, setZoom] = useState(1);
  const canvasRef = useRef(null);
  const containerRef = useRef(null); // This ref might still be useful for measuring for canvas size
  
  const [canvasSize, setCanvasSize] = useState({
    width: 300, // Initial default, will be updated by resize effect
    height: 200 // Initial default
  });
  
  const initialPosition = { x: canvasSize.width / 2, y: canvasSize.height / 2, angle: 0 };
  const initialBoundingBox = { 
    minX: canvasSize.width / 2, maxX: canvasSize.width / 2, 
    minY: canvasSize.height / 2, maxY: canvasSize.height / 2 
  };

  const [points, setPoints] = useState([initialPosition]); 
  const internalBoundingBoxRef = useRef(initialBoundingBox);

  // Gérer le redimensionnement du canvas pour remplir son conteneur
  useEffect(() => {
    const resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
        // Ensure we don't get into a loop if borderBoxSize is not stable
        const newWidth = Math.max(100, entry.contentRect.width);
        const newHeight = Math.max(100, entry.contentRect.height - 60); // Subtract approx height of controls area
        
        // Only update if size has meaningfully changed to avoid rapid re-renders
        if (Math.abs(newWidth - canvasSize.width) > 1 || Math.abs(newHeight - canvasSize.height) > 1) {
          setCanvasSize({ width: newWidth, height: newHeight });
        }
      }
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      if (containerRef.current) {
        resizeObserver.unobserve(containerRef.current);
      }
      resizeObserver.disconnect();
    };
  }, [canvasSize.width, canvasSize.height]); // Rerun if canvasSize actually changes from other sources (though unlikely now)

  // Effet principal pour recalculer et redessiner la pièce
  useEffect(() => {
    if (!sequence || sequence.length === 0) {
      const newInitialPosition = { x: canvasSize.width / 2, y: canvasSize.height / 2 };
      setPoints([newInitialPosition]);
      internalBoundingBoxRef.current = {minX: newInitialPosition.x, maxX: newInitialPosition.x, minY: newInitialPosition.y, maxY: newInitialPosition.y };
      drawCanvas([newInitialPosition], internalBoundingBoxRef.current);
      return;
    }

    let currentPosition = { x: canvasSize.width / 2, y: canvasSize.height / 2, angle: 0 };
    let currentBoundingBox = { 
      minX: canvasSize.width / 2, maxX: canvasSize.width / 2, 
      minY: canvasSize.height / 2, maxY: canvasSize.height / 2 
    };
    const calculatedPoints = [{ x: currentPosition.x, y: currentPosition.y }];

    const stepsToProcess = mode === 'direct' ? (highlightStepIndex || 0) : sequence.length;

    for (let i = 0; i < stepsToProcess && i < sequence.length; i++) {
      const etape = sequence[i];
      const { action, valeur } = etape;
      let newPoint = null;
      let isMoveWithoutDraw = false;

      switch (action) {
        case 'PLIER':
          currentPosition.angle += valeur;
          break;
        case 'AVANCER':
          const angleRad = (currentPosition.angle * Math.PI) / 180;
          currentPosition.x += Math.cos(angleRad) * valeur;
          currentPosition.y += Math.sin(angleRad) * valeur;
          newPoint = { x: currentPosition.x, y: currentPosition.y };
          break;
        case 'SE_DÉPLACER':
          const moveAngleRad = (currentPosition.angle * Math.PI) / 180;
          currentPosition.x += Math.cos(moveAngleRad) * valeur;
          currentPosition.y += Math.sin(moveAngleRad) * valeur;
          newPoint = { x: currentPosition.x, y: currentPosition.y };
          isMoveWithoutDraw = true;
          break;
        case 'COUPER':
          break;
        default:
          console.warn(`Action non reconnue: ${action}`);
      }

      if (newPoint) {
        currentBoundingBox.minX = Math.min(currentBoundingBox.minX, newPoint.x);
        currentBoundingBox.maxX = Math.max(currentBoundingBox.maxX, newPoint.x);
        currentBoundingBox.minY = Math.min(currentBoundingBox.minY, newPoint.y);
        currentBoundingBox.maxY = Math.max(currentBoundingBox.maxY, newPoint.y);
        
        if (isMoveWithoutDraw) {
          calculatedPoints.push(null);
        }
        calculatedPoints.push(newPoint);
      }
    }
    
    setPoints(calculatedPoints);
    internalBoundingBoxRef.current = currentBoundingBox; 
    drawCanvas(calculatedPoints, currentBoundingBox);

  }, [sequence, highlightStepIndex, canvasSize, mode, zoom]); // Added zoom to dependencies for drawCanvas

  const drawCanvas = (currentPointsToDraw = points, currentBB = internalBoundingBoxRef.current) => {
    const canvas = canvasRef.current;
    if (!canvas || canvasSize.width <= 0 || canvasSize.height <= 0) return;
    
    canvas.width = canvasSize.width;
    canvas.height = canvasSize.height;
    
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // No background fill here, parent container in ProductionPage handles background
    // ctx.fillStyle = '#f0f0f0'; 
    // ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    const { minX, maxX, minY, maxY } = currentBB;
    const shapeWidth = maxX - minX;
    const shapeHeight = maxY - minY;
    const centerX = minX + shapeWidth / 2;
    const centerY = minY + shapeHeight / 2;

    let scaleX = 1, scaleY = 1;
    // Add a small epsilon to prevent division by zero if shapeWidth/Height is tiny but not zero
    const epsilon = 0.0001;
    if (shapeWidth > epsilon && canvasSize.width > 0) {
      scaleX = canvasSize.width / (shapeWidth * 1.2); // 20% margin
    }
    if (shapeHeight > epsilon && canvasSize.height > 0) {
      scaleY = canvasSize.height / (shapeHeight * 1.2); // 20% margin
    }
    
    const autoScale = Math.min(scaleX, scaleY, 50); // Increased max auto-zoom slightly
    const effectiveScale = zoom * autoScale;
    
    ctx.save();
    ctx.translate(canvasSize.width / 2, canvasSize.height / 2);
    ctx.scale(effectiveScale, effectiveScale);
    ctx.translate(-centerX, -centerY);
    
    // Optional: Grid can be re-added here if desired

    if (currentPointsToDraw && currentPointsToDraw.length > 0) {
      ctx.beginPath();
      let firstPoint = true;
      currentPointsToDraw.forEach(point => {
        if (point === null) {
          ctx.stroke(); 
          firstPoint = true; 
          return;
        }
        if (firstPoint) {
          ctx.moveTo(point.x, point.y);
          firstPoint = false;
        } else {
          ctx.lineTo(point.x, point.y);
        }
      });
      ctx.strokeStyle = "#333";
      ctx.lineWidth = Math.max(0.1, 2 / effectiveScale); // Ensure lineWidth is not too small or zero
      ctx.stroke();

      if (mode === 'direct' && highlightStepIndex > 0) {
        let pointCount = 0;
        let targetPoint = null;
        // Find the point that corresponds to highlightStepIndex considering nulls for SE_DEPLACER
        // The `calculatedPoints` array includes the starting point, then points for AVANCER/SE_DEPLACER.
        // `highlightStepIndex` refers to the index of the *action* in the `sequence`.
        // We need to map this action index to a visual point.
        
        let visualPointIndex = 0; // 0 is the initial point
        for (let i = 0; i < highlightStepIndex && i < sequence.length; i++) {
            const action = sequence[i].action;
            if (action === 'AVANCER' || action === 'SE_DÉPLACER') {
                visualPointIndex++;
            }
        }

        // Now find this point in currentPointsToDraw, skipping nulls
        let currentVisualPoint = 0;
        for(const p of currentPointsToDraw) {
            if (p !== null) {
                if (currentVisualPoint === visualPointIndex) {
                    targetPoint = p;
                    break;
                }
                currentVisualPoint++;
            }
        }

        if (targetPoint) {
          ctx.fillStyle = "red";
          ctx.beginPath();
          ctx.arc(targetPoint.x, targetPoint.y, Math.max(1, 5 / effectiveScale), 0, 2 * Math.PI);
          ctx.fill();
        }
      }
    }
    ctx.restore();
  };

  // Removed the modal wrapper. This component now expects to be placed within a sized container.
  return (
    <div ref={containerRef} className="w-full h-full flex flex-col items-stretch bg-gray-50 rounded-lg overflow-hidden">
      <canvas 
        ref={canvasRef} 
        className="w-full flex-grow border-b border-gray-300"
        // width and height are set by drawCanvas
      ></canvas>
      
      {/* Controls Area */} 
      <div className="p-2 bg-gray-100 border-t border-gray-200">
        {mode === 'manual' && (
          <div className="flex flex-wrap justify-between items-center gap-2">
            <button onClick={onClose} className="px-3 py-1.5 bg-red-500 text-white rounded hover:bg-red-600 transition-colors text-sm">Fermer (Manual)</button>
            <div>
              <label htmlFor="zoomManual" className="mr-1 text-xs">Zoom:</label>
              <input 
                type="range" 
                id="zoomManual" 
                min="0.1" max="10" step="0.1" 
                value={zoom} 
                onChange={(e) => setZoom(parseFloat(e.target.value))} 
                className="w-24 align-middle"
              />
            </div>
            {/* Add other manual controls here if needed */}
          </div>
        )}
        {mode === 'direct' && (
            <div className="flex justify-between items-center">
                <div>
                  <label htmlFor="zoomDirect" className="mr-1 text-xs sm:text-sm">Zoom:</label>
                  <input 
                    type="range" 
                    id="zoomDirect" 
                    min="0.1" max="10" step="0.1" 
                    value={zoom} 
                    onChange={(e) => setZoom(parseFloat(e.target.value))} 
                    className="w-24 sm:w-32 align-middle"
                  />
                </div>
                <button 
                  onClick={onClose} 
                  className="px-3 py-1.5 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors text-sm sm:text-base"
                >
                  Quitter la page
                </button>
            </div>
        )}
      </div>
    </div>
  );
}

export default PieceCreationVisualizer;
