import React, { useState, useEffect } from "react";
import "./index.css";
import PieceCreationVisualizer from "./components/PieceCreationVisualizer";

function App() {
  const [etapes, setEtapes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isPopupOpen, setIsPopupOpen] = useState(false);

  // Charger les étapes depuis le fichier JSON
  useEffect(() => {
    fetch('/etape-test.json')
      .then(response => {
        if (!response.ok) {
          throw new Error('Erreur lors du chargement du fichier JSON');
        }
        return response.json();
      })
      .then(data => {
        setEtapes(data);
        setIsLoading(false);
      })
      .catch(error => {
        console.error('Erreur:', error);
        setError(error.message);
        setIsLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-blue-50">
      <header className="bg-blue-600 text-white p-4 shadow-md flex justify-between items-center">
        <h1 className="text-2xl font-bold">Atelier des Composites</h1>
        <button
          onClick={() => setIsPopupOpen(prev => !prev)}
          className="bg-white text-blue-600 px-4 py-2 rounded-lg font-medium hover:bg-blue-50 transition-colors"
        >
          Visualiser la création
        </button>
      </header>
      
      <main className="container mx-auto p-6">
        {isLoading ? (
          <div className="text-center py-10">
            <p className="text-lg text-gray-600">Chargement des données...</p>
          </div>
        ) : error ? (
          <div className="text-center py-10">
            <p className="text-lg text-red-600">Erreur: {error}</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-blue-800 mb-4">Informations sur la pièce</h2>
            <p className="text-gray-700">
              Cette pièce contient {etapes.length} étapes de création.
            </p>
            
            {isPopupOpen && <PieceCreationVisualizer etapes={etapes} onClose={() => setIsPopupOpen(false)} />}
          </div>
        )}
      </main>
    </div>
  );
}



export default App;
