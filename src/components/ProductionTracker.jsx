import React, { useState, useEffect } from 'react';

/**
 * Composant pour suivre les pièces en production et leur statut
 */
function ProductionTracker({ apiBaseUrl = 'http://localhost:30001/api' }) {
  const [productionItems, setProductionItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshInterval, setRefreshInterval] = useState(10); // en secondes
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Fonction pour récupérer les statuts de production
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

  // Rafraîchir automatiquement les données
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
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      <div className="p-4 bg-indigo-700 text-white flex justify-between items-center">
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
      </div>
      
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
  );
}

export default ProductionTracker; 