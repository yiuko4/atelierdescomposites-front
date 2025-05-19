import React, { useState, useEffect } from 'react';

/**
 * Component for displaying the SVG library
 * @param {Object} props
 * @param {function} props.onSelectPiece - Callback when a piece is selected
 * @param {string} props.apiBaseUrl - Base URL for API calls
 */
function SVGLibraryPanel({ onSelectPiece, apiBaseUrl = 'http://localhost:30001/api' }) {
  const [pieces, setPieces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTags, setSelectedTags] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Fetch all pieces from the library
  const fetchPieces = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${apiBaseUrl}/library/pieces`);
      
      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        setPieces(data.pieces || []);
        setError(null);
      } else {
        setError(data.message || 'Erreur lors de la récupération des pièces');
      }
    } catch (err) {
      console.error('Erreur lors de la récupération des pièces:', err);
      setError(err.message || 'Erreur de connexion au serveur');
    } finally {
      setLoading(false);
    }
  };
  
  // Fetch pieces on component mount
  useEffect(() => {
    fetchPieces();
  }, [apiBaseUrl]);
  
  // Get all unique tags from pieces
  const allTags = [...new Set(pieces.flatMap(piece => piece.tags || []))];
  
  // Filter pieces based on search term and selected tags
  const filteredPieces = pieces.filter(piece => {
    // Filter by search term
    const matchesSearch = searchTerm === '' || 
      piece.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (piece.description && piece.description.toLowerCase().includes(searchTerm.toLowerCase()));
    
    // Filter by selected tags
    const matchesTags = selectedTags.length === 0 || 
      selectedTags.every(tag => piece.tags && piece.tags.includes(tag));
    
    return matchesSearch && matchesTags;
  });
  
  // Format date for display
  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    return date.toLocaleDateString();
  };
  
  // Handle selecting a piece
  const handleSelectPiece = async (pieceId) => {
    try {
      const response = await fetch(`${apiBaseUrl}/library/pieces/${pieceId}`);
      
      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success && data.piece && data.piece.svgContent) {
        onSelectPiece(data.piece);
      } else {
        throw new Error('Contenu SVG non disponible');
      }
    } catch (err) {
      console.error('Erreur lors de la récupération du contenu SVG:', err);
      setError(err.message || 'Erreur lors de la récupération du contenu SVG');
    }
  };
  
  // Toggle a tag selection
  const toggleTag = (tag) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };
  
  return (
    <div className="flex flex-col h-full">
      {/* Header with search and refresh */}
      <div className="p-3 bg-blue-50 rounded-md border border-blue-100 flex flex-col gap-2">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold text-indigo-600">
            Bibliothèque de pièces
          </h2>
          <button 
            onClick={fetchPieces}
            className="p-1 rounded-full hover:bg-blue-100"
            title="Actualiser la liste"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
        
        {/* Search input */}
        <div className="relative">
          <input
            type="text"
            placeholder="Rechercher une pièce..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full p-2 pr-8 border border-gray-300 rounded-md"
          />
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 absolute right-2 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        
        {/* Tags filter */}
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {allTags.map(tag => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`px-2 py-1 text-xs rounded-full ${
                  selectedTags.includes(tag)
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>
      
      {/* Error message */}
      {error && (
        <div className="p-3 mt-3 bg-red-100 text-red-700 rounded-md">
          <p>{error}</p>
          <button 
            onClick={fetchPieces}
            className="mt-2 px-3 py-1 bg-red-200 hover:bg-red-300 rounded text-sm"
          >
            Réessayer
          </button>
        </div>
      )}
      
      {/* Loading indicator */}
      {loading && (
        <div className="flex-grow flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-700"></div>
        </div>
      )}
      
      {/* Empty state */}
      {!loading && !error && filteredPieces.length === 0 && (
        <div className="flex-grow flex flex-col items-center justify-center text-gray-500 p-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          {searchTerm || selectedTags.length > 0 ? (
            <p className="text-center">Aucune pièce ne correspond à votre recherche</p>
          ) : (
            <p className="text-center">Aucune pièce dans la bibliothèque</p>
          )}
        </div>
      )}
      
      {/* Pieces list */}
      {!loading && !error && filteredPieces.length > 0 && (
        <div className="flex-grow overflow-y-auto mt-3 bg-gray-50 rounded-md p-2 border border-gray-100">
          <div className="grid grid-cols-1 gap-2">
            {filteredPieces.map(piece => (
              <div 
                key={piece.id}
                className="p-3 bg-white rounded-md border border-gray-200 hover:border-indigo-300 transition-colors cursor-pointer"
                onClick={() => handleSelectPiece(piece.id)}
              >
                <div className="flex justify-between items-start">
                  <h3 className="font-medium text-gray-800">{piece.name}</h3>
                  <span className="text-xs text-gray-500">{formatDate(piece.createdAt)}</span>
                </div>
                
                {piece.description && (
                  <p className="text-sm text-gray-600 mt-1 line-clamp-2">{piece.description}</p>
                )}
                
                {piece.tags && piece.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {piece.tags.map(tag => (
                      <span
                        key={`${piece.id}-${tag}`}
                        className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default SVGLibraryPanel; 