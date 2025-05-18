import React, { useState, useEffect, useRef } from 'react';
import ProgressBar from './ProgressBar'; // Assurez-vous que le chemin est correct
import io from 'socket.io-client';

const EMPORTEPIECE_WS_URL = 'http://localhost:3000'; // URL du serveur WebSocket EmportePiece

/**
 * Composant pour suivre les pièces en production et leur statut,
 * et afficher la progression en temps réel pour une tâche active.
 */
function ProductionTracker({ 
  apiBaseUrl = 'http://localhost:30001/api', 
  activeProductionJobId, // ID de la tâche de production active pour la progression en temps réel
  onClose, // Fonction pour fermer le tracker (modal)
  onProductionTaskComplete // Nouvelle prop
}) {
  const [productionItems, setProductionItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshInterval, setRefreshInterval] = useState(10); // en secondes
  const [autoRefresh, setAutoRefresh] = useState(true);

  // États pour la barre de progression en temps réel
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [isProcessingProgressBar, setIsProcessingProgressBar] = useState(false);
  const [progressError, setProgressError] = useState(false);
  const socketRef = useRef(null);

  // Fonction pour récupérer les statuts de production (liste générale)
  const fetchProductionStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${apiBaseUrl}/status/production`);
      
      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        setProductionItems(data.statuses || []);
        setError(null);
      } else {
        setError(data.message || 'Erreur lors de la récupération des statuts de production');
      }
    } catch (err) {
      console.error('Erreur lors de la récupération des statuts:', err);
      setError(err.message || 'Erreur de connexion au serveur');
    } finally {
      setLoading(false);
    }
  };

  // UseEffect pour le rafraîchissement automatique de la liste des productions
  useEffect(() => {
    fetchProductionStatus();
    
    let intervalId;
    if (autoRefresh) {
      intervalId = setInterval(fetchProductionStatus, refreshInterval * 1000);
    }
    
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [refreshInterval, autoRefresh, apiBaseUrl]);

  // UseEffect pour gérer la connexion WebSocket pour la progression de la tâche active
  useEffect(() => {
    if (activeProductionJobId) {
      console.log(`ProductionTracker: Job actif détecté - ${activeProductionJobId}. Initialisation du WebSocket.`);
      setIsProcessingProgressBar(true);
      setProgress(0);
      setProgressMessage('Connexion au serveur de progression...');
      setProgressError(false);

      // Déconnexion propre si un socket précédent existait
      if (socketRef.current) {
        socketRef.current.disconnect();
      }

      socketRef.current = io(EMPORTEPIECE_WS_URL);

      socketRef.current.on('connect', () => {
        console.log('WebSocket connecté pour la progression.');
        setProgressMessage('Connecté. En attente des instructions...');
      });

      socketRef.current.on('connection_ack', (data) => {
        console.log('WebSocket ACK:', data.message);
      });

      socketRef.current.on('progress_update', (data) => {
        console.log('Progress update reçu:', data);
        setProgress(data.percentage);
        setProgressMessage(data.message || 'En cours...');
        setProgressError(data.error || false);
        if (data.error) {
            console.error('Erreur de progression WebSocket:', data.message);
        }
      });

      socketRef.current.on('instructions_complete', (data) => {
        console.log('Instructions terminées (WebSocket):', data.message);
        setProgress(100);
        setProgressMessage(data.message || 'Production terminée !');
        setProgressError(false);
        setIsProcessingProgressBar(false); 
        if (onProductionTaskComplete) onProductionTaskComplete(true); // Appeler le callback avec succès
        // Déconnexion et réinitialisation du jobID seront gérées par le changement de activeProductionJobId ou le démontage
      });

      socketRef.current.on('disconnect', (reason) => {
        console.log('WebSocket déconnecté:', reason);
        if (isProcessingProgressBar && reason !== 'io client disconnect') {
          setProgressMessage('Déconnecté. Une erreur est peut-être survenue.');
          setProgressError(true);
          setIsProcessingProgressBar(false); // Arrêter la barre car on ne sait pas si ça va reprendre
          if (onProductionTaskComplete) onProductionTaskComplete(false); // Signaler échec potentiel
        }
      });

      socketRef.current.on('connect_error', (err) => {
        console.error('Erreur de connexion WebSocket:', err);
        setProgressMessage('Impossible de se connecter au serveur de progression.');
        setProgressError(true);
        setIsProcessingProgressBar(false);
        if (onProductionTaskComplete) onProductionTaskComplete(false); // Appeler le callback avec échec
      });

    } else {
      // Si pas de job actif, ou job terminé/annulé
      if (socketRef.current) {
        console.log('ProductionTracker: Pas de job actif. Déconnexion du WebSocket.');
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setIsProcessingProgressBar(false); 
      // Ne pas appeler onProductionTaskComplete ici car cela pourrait être appelé à chaque rendu si activeJobId est null
    }

    // Fonction de nettoyage pour le démontage du composant
    return () => {
      if (socketRef.current) {
        console.log('ProductionTracker: Démontage. Déconnexion du WebSocket.');
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [activeProductionJobId, onProductionTaskComplete]); // Ce hook réagit aux changements de activeProductionJobId

  // Formatage de la date pour l'affichage
  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  // Obtenir une classe CSS selon le statut
  const getStatusClass = (status) => {
    switch (status) {
      case 'ENVOYE':
        return 'bg-yellow-100 text-yellow-800';
      case 'CONFIRME':
        return 'bg-blue-100 text-blue-800';
      case 'TERMINE':
        return 'bg-green-100 text-green-800';
      case 'ERREUR':
        return 'bg-red-100 text-red-800';
      case 'ANNULE':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-500';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden flex flex-col max-h-full">
      <div className="p-4 bg-indigo-700 text-white flex justify-between items-center flex-shrink-0">
        <h2 className="text-xl font-semibold">Suivi des pièces en production</h2>
        <div className="flex items-center space-x-3">
          <div className="flex items-center">
            <label htmlFor="refresh-interval" className="mr-2 text-sm">
              Actualisation:
            </label>
            <select
              id="refresh-interval"
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
              className="bg-indigo-600 text-white rounded px-2 py-1 text-sm"
            >
              <option value={5}>5s</option>
              <option value={10}>10s</option>
              <option value={30}>30s</option>
              <option value={60}>1min</option>
            </select>
          </div>
          <button
            onClick={fetchProductionStatus}
            className="p-1 bg-indigo-600 rounded hover:bg-indigo-500 transition-colors"
            title="Actualiser maintenant"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`p-1 rounded ${autoRefresh ? 'bg-indigo-500' : 'bg-indigo-700 border border-indigo-500'} hover:bg-indigo-600 transition-colors`}
            title={autoRefresh ? "Désactiver l'actualisation automatique" : "Activer l'actualisation automatique"}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={autoRefresh ? "M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" : "M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"} />
            </svg>
          </button>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 bg-indigo-600 rounded-full hover:bg-indigo-500 transition-colors"
          title="Fermer"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      {/* Barre de progression pour la tâche active */} 
      {isProcessingProgressBar && activeProductionJobId && (
        <div className="p-4 border-b border-gray-200 flex-shrink-0">
          <h3 className="text-md font-semibold text-gray-700 mb-2">
            Progression de la tâche : {typeof activeProductionJobId === 'string' && activeProductionJobId.startsWith('job_') ? 'Nouvelle tâche' : activeProductionJobId}
          </h3>
          <ProgressBar 
            percentage={progress} 
            message={progressMessage} 
            isError={progressError} 
          />
        </div>
      )}
      
      <div className="flex-grow overflow-y-auto">
        {loading && (
          <div className="p-8 flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-700"></div>
          </div>
        )}
        
        {error && (
          <div className="p-4 bg-red-100 text-red-800">
            <p>{error}</p>
            <button 
              onClick={fetchProductionStatus}
              className="mt-2 px-3 py-1 bg-red-200 hover:bg-red-300 rounded text-sm"
            >
              Réessayer
            </button>
          </div>
        )}
        
        {!loading && !error && productionItems.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            <p>Aucune pièce en production actuellement.</p>
          </div>
        )}
        
        {!loading && !error && productionItems.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date d'envoi</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dernière mise à jour</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {productionItems.map((item) => (
                  <tr key={item.pieceId} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {item.pieceId.substring(0, 12)}...
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusClass(item.status)}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(item.timestamp)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.confirmedAt ? formatDate(item.confirmedAt) : formatDate(item.timestamp)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button 
                        onClick={() => window.open(`${apiBaseUrl}/status/production/${item.pieceId}`, '_blank')}
                        className="text-indigo-600 hover:text-indigo-900 mr-3"
                      >
                        Détails
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default ProductionTracker; 