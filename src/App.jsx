import React, { useState, useCallback } from "react";
import { useNavigate } from 'react-router-dom';
import PieceCreationVisualizer from "./components/PieceCreationVisualizer";
import ShapeEditor from "./components/editor/ShapeEditor";
import ProductionTracker from "./components/ProductionTracker";
import SaveSVGModal from './components/SaveSVGModal';
import SVGLibraryPanel from './components/SVGLibraryPanel';
import "./index.css";

/**
 * Composant principal de l'application
 * @returns {JSX.Element}
 */
function App() {
  const navigate = useNavigate();
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // États pour les différentes fonctionnalités
  const [showProductionTracker, setShowProductionTracker] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showSVGLibrary, setShowSVGLibrary] = useState(true);
  const [activeProductionJobId, setActiveProductionJobId] = useState(null);
  const [svgContentToSave, setSvgContentToSave] = useState(null);

  /**
   * Gère la fermeture du modal de sauvegarde
   */
  const handleCloseSaveModal = useCallback(() => {
    setShowSaveModal(false);
    setSvgContentToSave(null);
  }, []);

  /**
   * Gère l'ouverture du modal de sauvegarde
   * @param {string} svgContent - Contenu SVG à sauvegarder
   */
  const handleShowSaveModal = useCallback((svgContent) => {
    setSvgContentToSave(svgContent);
    setShowSaveModal(true);
  }, []);

  /**
   * Gère le basculement de l'affichage de la bibliothèque SVG
   */
  const handleToggleSVGLibrary = useCallback(() => {
    setShowSVGLibrary(prev => !prev);
  }, []);

  /**
   * Gère le succès de la sauvegarde d'une pièce
   * @param {Object} savedPiece - Pièce sauvegardée
   */
  const handleSaveSuccess = useCallback((savedPiece) => {
    setShowSaveModal(false);
    setSvgContentToSave(null);
    // Rafraîchir la bibliothèque si nécessaire
  }, []);

  /**
   * Gère la sélection d'une pièce depuis la bibliothèque
   * @param {Object} piece - Pièce sélectionnée
   */
  const handleSelectSVGFromLibrary = useCallback((piece) => {
    // À implémenter: charger la pièce dans l'éditeur
    console.log("Pièce sélectionnée:", piece);
  }, []);

  /**
   * Gère la fin d'une tâche de production
   * @param {boolean} success - Si la tâche a réussi
   */
  const handleProductionTaskCompletion = useCallback((success) => {
    setActiveProductionJobId(null);
    setShowProductionTracker(false);
    // Afficher un message de succès ou d'échec
  }, []);

  return (
    <div className="app-container h-screen flex flex-col">
      {/* En-tête de l'application */}
      <header className="bg-gray-800 text-white p-4">
        <h1 className="text-xl font-bold">Atelier des Composites - Éditeur de Formes</h1>
      </header>

      {/* Contenu principal */}
      <main className="flex-grow flex">
        {/* Panneau de bibliothèque SVG */}
        {showSVGLibrary && (
          <div className="library-panel w-64">
            <SVGLibraryPanel onSelectPiece={handleSelectSVGFromLibrary} />
          </div>
        )}

        {/* Éditeur de formes */}
        <div className="flex-grow overflow-hidden">
          <ShapeEditor
            onShowSaveModal={handleShowSaveModal}
            onToggleSVGLibrary={handleToggleSVGLibrary}
            showSVGLibrary={showSVGLibrary}
            onSaveSuccess={handleSaveSuccess}
          />
        </div>

        {/* Visualiseur de création de pièce (popup) */}
        {isPopupOpen && (
          <PieceCreationVisualizer
            onClose={() => setIsPopupOpen(false)}
          />
        )}
      </main>

      {/* Modals et trackers */}
      {showProductionTracker && (
        <ProductionTracker
          jobId={activeProductionJobId}
          onTaskCompletion={handleProductionTaskCompletion}
          onClose={() => setShowProductionTracker(false)}
        />
      )}

      {showSaveModal && (
        <SaveSVGModal
          isOpen={showSaveModal}
          onClose={handleCloseSaveModal}
          svgContent={svgContentToSave}
          onSaveSuccess={handleSaveSuccess}
        />
      )}
    </div>
  );
}

export default App; 