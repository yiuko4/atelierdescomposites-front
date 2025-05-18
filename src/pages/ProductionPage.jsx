import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import ProgressBar from '../components/ProgressBar';
import PieceCreationVisualizer from '../components/PieceCreationVisualizer';

const EMPORTEPIECE_WS_URL = import.meta.env.VITE_EMPORTEPIECE_WS_URL || 'http://localhost:3000';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3002';

function ProductionPage() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const socketRef = useRef(null);

  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('En attente du démarrage de la production...');
  const [isProcessing, setIsProcessing] = useState(true);
  const [progressError, setProgressError] = useState(null);
  const [stopError, setStopError] = useState(null);
  const [totalInstructions, setTotalInstructions] = useState(0);
  const [currentInstruction, setCurrentInstruction] = useState(0);

  const [productionSequence, setProductionSequence] = useState(null);
  const [sequenceError, setSequenceError] = useState(null);
  const [isLoadingSequence, setIsLoadingSequence] = useState(true);
  const [showVisualizer, setShowVisualizer] = useState(false);

  useEffect(() => {
    const fetchSequence = async () => {
      if (!jobId) {
        setIsLoadingSequence(false);
        return;
      }
      setIsLoadingSequence(true);
      setSequenceError(null);
      try {
        const response = await fetch(`${API_BASE_URL}/api/production-jobs/${jobId}/sequence`);
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: `Erreur HTTP: ${response.status}` }));
          throw new Error(errorData.message || `Erreur HTTP: ${response.status}`);
        }
        const data = await response.json();
        if (data.success && data.actions) {
          setProductionSequence(data.actions);
          setShowVisualizer(true);
        } else {
          throw new Error(data.message || 'Séquence non trouvée ou invalide.');
        }
      } catch (error) {
        console.error("Erreur lors de la récupération de la séquence de production:", error);
        setSequenceError(error.message);
        setProductionSequence(null);
        setShowVisualizer(false);
      } finally {
        setIsLoadingSequence(false);
      }
    };
    fetchSequence();
  }, [jobId]);

  useEffect(() => {
    if (!jobId) return;

    socketRef.current = io(EMPORTEPIECE_WS_URL, {
      query: { jobId },
      reconnectionAttempts: 5,
    });

    socketRef.current.on('connect', () => {
      console.log(`Connecté au WebSocket pour le job ${jobId}`);
      setProgressMessage('Connecté, en attente des instructions...');
      setProgressError(null);
      setStopError(null);
      setIsProcessing(true);
    });

    socketRef.current.on('progress_update', (data) => {
      setProgress(data.percentage);
      setProgressMessage(data.message);
      setTotalInstructions(data.totalInstructions || 0);
      setCurrentInstruction(data.currentInstruction || 0);
      if (!data.error) {
        setIsProcessing(true);
      }
      setProgressError(data.error ? data.message : null);
      if (data.error) {
        setIsProcessing(false);
      }
    });

    socketRef.current.on('instructions_complete', (data) => {
      setProgress(100);
      setProgressMessage(data.message || 'Production terminée avec succès.');
      setIsProcessing(false);
      setProgressError(null);
      if (productionSequence) setCurrentInstruction(productionSequence.length);
    });

    socketRef.current.on('connect_error', (err) => {
      console.error('Erreur de connexion WebSocket:', err);
      setProgressMessage(`Erreur de connexion: ${err.message}`);
      setProgressError('Impossible de se connecter au serveur de production.');
      setIsProcessing(false);
    });
    
    socketRef.current.on('disconnect', (reason) => {
      console.log('Déconnecté du WebSocket:', reason);
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [jobId, productionSequence]);

  const handleVisualizerClose = () => {
    navigate('/');
  };

  const handleEmergencyStop = async () => {
    setStopError(null);
    setProgressMessage("Tentative d'arrêt d'urgence...");
    try {
      const response = await fetch(`${API_BASE_URL}/api/emergency-stop`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || `Erreur HTTP ${response.status} lors de l'arrêt d'urgence.`);
      }
      setProgressMessage(data.message || "Arrêt d'urgence demandé avec succès.");
      setIsProcessing(false);
      setProgressError("Arrêt d'urgence activé.");
      if (socketRef.current) {
        // socketRef.current.disconnect();
      }
    } catch (error) {
      console.error("Erreur lors de l'arrêt d'urgence:", error);
      setStopError(error.message);
      setProgressMessage("Échec de la tentative d'arrêt d'urgence.");
    }
  };

  if (isLoadingSequence) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
        <div className="text-2xl font-semibold text-gray-700">Chargement de la séquence de production...</div>
      </div>
    );
  }

  if (sequenceError && !productionSequence) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4 text-center">
        <div className="bg-white p-8 rounded-lg shadow-xl">
          <h1 className="text-3xl font-bold text-red-600 mb-4">Erreur de Production</h1>
          <p className="text-lg text-gray-700 mb-2">Impossible de charger la séquence pour le Job ID: <span className="font-semibold">{jobId}</span></p>
          <p className="text-md text-red-700 mb-6">Détail: {sequenceError}</p>
          <button 
            onClick={() => navigate('/')} 
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded text-lg transition-colors"
          >
            Retour à l'accueil
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col min-h-screen bg-gray-100">
      <header className="bg-white shadow-md p-4">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-800">Suivi de Production</h1>
          <span className="text-sm text-gray-600">Job ID: {jobId}</span>
        </div>
      </header>

      <main className="flex-grow container mx-auto p-4 flex flex-col lg:flex-row gap-6">
        <section className="lg:flex-grow lg:w-2/3 bg-white p-1 rounded-lg shadow-lg flex flex-col">
          {productionSequence && showVisualizer ? (
            <PieceCreationVisualizer 
              sequence={productionSequence}
              highlightStepIndex={currentInstruction}
              onClose={handleVisualizerClose} 
              mode="direct"
            />
          ) : (
            <div className="flex-grow flex items-center justify-center">
              <p className="text-xl text-gray-500">En attente des données de visualisation...</p>
            </div>
          )}
        </section>

        <aside className="lg:w-1/3 bg-white p-6 rounded-lg shadow-lg flex flex-col gap-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-700 mb-3">Progression</h2>
            <ProgressBar 
              percentage={progress}
              message={progressMessage}
              error={progressError || stopError}
              currentStep={currentInstruction}
              totalSteps={totalInstructions}
            />
            {(isProcessing || progress < 100) && currentInstruction > 0 && totalInstructions > 0 && (
              <p className="text-sm text-gray-600 mt-2 text-center">
                Étape: {currentInstruction} / {totalInstructions}
              </p>
            )}
          </div>

          {isProcessing && (
            <button
              onClick={handleEmergencyStop}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded text-lg transition-colors flex items-center justify-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                 <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              ARRÊT D'URGENCE
            </button>
          )}
          {stopError && !isProcessing && <p className="text-sm text-red-600 mt-2 text-center">{stopError}</p>}

          {!isProcessing && (
            <div className="mt-auto pt-4 border-t border-gray-200">
              <button 
                onClick={() => navigate('/')} 
                className={`w-full font-bold py-3 px-4 rounded text-lg transition-colors ${progressError || stopError ? 'bg-red-500 hover:bg-red-700 text-white' : 'bg-green-500 hover:bg-green-700 text-white'}`}
              >
                {progressError || stopError ? 'Erreur - Retour' : 'Termine - Retour'}
              </button>
            </div>
          )}
        </aside>
      </main>
    </div>
  );
}

export default ProductionPage; 