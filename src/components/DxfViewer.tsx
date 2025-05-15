import React, { useEffect, useRef, useState } from "react";
// const DxfParser = require("dxf-parser").DxfParser; // Gardé pour référence, mais nous allons utiliser l'import ES6 si possible ou le require structuré.
import { Viewer } from "three-dxf"; // Classe principale de three-dxf pour la visualisation
// THREE est généralement un peer dependency ou est inclus par three-dxf, mais importons-le si nécessaire pour les types ou utilitaires.
// import * as THREE from 'three'; // Décommenter si explicitement nécessaire pour FontLoader par ex.

// On garde le require pour DxfParser car il a fonctionné ainsi précédemment et gère bien les modules CJS.
const DxfParser = require("dxf-parser").DxfParser;

interface DxfViewerProps {
  dxfData: ArrayBuffer | null;
}

const DxfViewer: React.FC<DxfViewerProps> = ({ dxfData }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerInstanceRef = useRef<any | null>(null); // Utilisation de 'any' car les types de three-dxf peuvent ne pas être disponibles
  const [isContainerReady, setIsContainerReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showControls, setShowControls] = useState(false);

  useEffect(() => {
    const currentContainer = containerRef.current;
    if (!currentContainer) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setIsContainerReady(true);
          if (viewerInstanceRef.current) {
            viewerInstanceRef.current.resize(width, height);
          }
        } else {
          setIsContainerReady(false);
        }
      }
    });
    resizeObserver.observe(currentContainer);

    return () => {
      resizeObserver.unobserve(currentContainer);
      resizeObserver.disconnect();
      setIsContainerReady(false);
    };
  }, []);

  useEffect(() => {
    const currentContainer = containerRef.current;

    const cleanupViewer = () => {
      if (viewerInstanceRef.current) {
        viewerInstanceRef.current.controls?.dispose(); // Important pour les OrbitControls
        if (
          viewerInstanceRef.current.renderer?.domElement?.parentNode ===
          currentContainer
        ) {
          currentContainer?.removeChild(
            viewerInstanceRef.current.renderer.domElement
          );
        }
      }
      viewerInstanceRef.current = null;
    };

    if (!dxfData || !currentContainer || !isContainerReady) {
      cleanupViewer();
      return;
    }

    setIsLoading(true);
    setError(null);
    cleanupViewer(); // Nettoyer l'instance précédente avant d'en créer une nouvelle

    const parser = new DxfParser();
    let parsedDxf;
    try {
      const text = new TextDecoder().decode(dxfData);
      parsedDxf = parser.parseSync(text);
    } catch (error) {
      console.error("Erreur lors du parsing DXF pour three-dxf:", error);
      setError(
        "Impossible de lire ce fichier DXF. Format non valide ou corrompu."
      );
      setIsLoading(false);
      return;
    }

    if (!parsedDxf) {
      setError("Les données DXF n'ont pas pu être parsées.");
      setIsLoading(false);
      return;
    }

    const width = currentContainer.clientWidth;
    const height = currentContainer.clientHeight;

    if (width === 0 || height === 0) {
      setError(
        "Les dimensions du conteneur sont nulles, impossible d'initialiser le visualiseur."
      );
      setIsLoading(false);
      return;
    }

    try {
      // Le dernier argument est la police, que nous laissons à null pour l'instant.
      // three-dxf affichera un avertissement si des entités TEXT sont présentes sans police.
      const viewer = new Viewer(
        parsedDxf,
        currentContainer,
        width,
        height,
        null
      );

      viewerInstanceRef.current = viewer;
      setShowControls(true);
      setIsLoading(false);
    } catch (error) {
      console.error("Erreur lors de la création du Viewer three-dxf:", error);
      setError("Une erreur est survenue lors de l'affichage du fichier DXF.");
      cleanupViewer(); // S'assurer que tout est nettoyé en cas d'erreur de création
      setIsLoading(false);
    }

    return cleanupViewer; // Nettoyage lors du démontage ou si les dépendances changent
  }, [dxfData, isContainerReady]); // Dépend de dxfData et de la préparation du conteneur

  const resetView = () => {
    if (viewerInstanceRef.current && viewerInstanceRef.current.controls) {
      viewerInstanceRef.current.controls.reset();
    }
  };

  const zoomIn = () => {
    if (viewerInstanceRef.current && viewerInstanceRef.current.controls) {
      const controls = viewerInstanceRef.current.controls;
      controls.dollyIn(1.2);
      controls.update();
    }
  };

  const zoomOut = () => {
    if (viewerInstanceRef.current && viewerInstanceRef.current.controls) {
      const controls = viewerInstanceRef.current.controls;
      controls.dollyOut(1.2);
      controls.update();
    }
  };

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        borderRadius: "var(--border-radius)",
        overflow: "hidden",
      }}
    >
      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: "100%",
          backgroundColor: "#f8f9fa",
        }}
      />

      {/* Contrôles de navigation */}
      {showControls && (
        <div
          style={{
            position: "absolute",
            bottom: "20px",
            right: "20px",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            zIndex: 100,
          }}
        >
          <button
            onClick={zoomIn}
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "50%",
              background: "var(--color-bg-section)",
              border: "none",
              boxShadow: "var(--box-shadow)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "var(--color-primary)",
              fontSize: "18px",
              fontWeight: "bold",
            }}
            title="Zoom avant"
          >
            +
          </button>
          <button
            onClick={zoomOut}
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "50%",
              background: "var(--color-bg-section)",
              border: "none",
              boxShadow: "var(--box-shadow)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "var(--color-primary)",
              fontSize: "18px",
              fontWeight: "bold",
            }}
            title="Zoom arrière"
          >
            -
          </button>
          <button
            onClick={resetView}
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "50%",
              background: "var(--color-bg-section)",
              border: "none",
              boxShadow: "var(--box-shadow)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "var(--color-primary)",
              fontSize: "16px",
            }}
            title="Réinitialiser la vue"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="1 4 1 10 7 10"></polyline>
              <polyline points="23 20 23 14 17 14"></polyline>
              <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path>
            </svg>
          </button>
        </div>
      )}

      {/* État de chargement */}
      {isLoading && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            color: "var(--color-text-light)",
            textAlign: "center",
            padding: "20px",
            borderRadius: "var(--border-radius)",
            backgroundColor: "rgba(255, 255, 255, 0.8)",
            boxShadow: "var(--box-shadow)",
          }}
        >
          <div
            style={{
              border: "3px solid rgba(0, 0, 0, 0.1)",
              borderTop: "3px solid var(--color-primary)",
              borderRadius: "50%",
              width: "30px",
              height: "30px",
              animation: "spin 1s linear infinite",
              margin: "0 auto 10px",
            }}
          />
          Chargement du fichier DXF...
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      )}

      {/* Message d'erreur */}
      {error && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            color: "var(--color-danger)",
            textAlign: "center",
            padding: "20px",
            borderRadius: "var(--border-radius)",
            backgroundColor: "rgba(255, 255, 255, 0.9)",
            boxShadow: "var(--box-shadow)",
            maxWidth: "80%",
            border: "1px solid rgba(220, 53, 69, 0.3)",
          }}
        >
          <svg
            style={{ margin: "0 auto 10px", display: "block" }}
            width="30"
            height="30"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          {error}
        </div>
      )}

      {/* Placeholder quand aucun fichier n'est chargé */}
      {!dxfData && !isLoading && !error && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            color: "var(--color-text-light)",
            textAlign: "center",
            maxWidth: "80%",
          }}
        >
          <svg
            style={{ margin: "0 auto 15px", display: "block", opacity: 0.5 }}
            width="50"
            height="50"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
            <polyline points="13 2 13 9 20 9"></polyline>
          </svg>
          Importez un fichier DXF pour le visualiser ici
        </div>
      )}
    </div>
  );
};

export default DxfViewer;
