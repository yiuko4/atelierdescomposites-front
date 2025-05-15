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

    cleanupViewer(); // Nettoyer l'instance précédente avant d'en créer une nouvelle

    const parser = new DxfParser();
    let parsedDxf;
    try {
      const text = new TextDecoder().decode(dxfData);
      parsedDxf = parser.parseSync(text);
    } catch (error) {
      console.error("Erreur lors du parsing DXF pour three-dxf:", error);
      // Afficher une erreur à l'utilisateur pourrait être une bonne amélioration ici
      return;
    }

    if (!parsedDxf) {
      console.error("Les données DXF n'ont pas pu être parsées.");
      return;
    }

    const width = currentContainer.clientWidth;
    const height = currentContainer.clientHeight;

    if (width === 0 || height === 0) {
      console.warn(
        "Les dimensions du conteneur sont nulles, impossible d'initialiser DxfViewer."
      );
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
      viewer.draw(); // Dessine les entités DXF dans la scène
      // viewer.animate(); // Non nécessaire, OrbitControls gère la boucle de rendu via les événements 'change'

      viewerInstanceRef.current = viewer;
    } catch (error) {
      console.error("Erreur lors de la création du Viewer three-dxf:", error);
      cleanupViewer(); // S'assurer que tout est nettoyé en cas d'erreur de création
    }

    return cleanupViewer; // Nettoyage lors du démontage ou si les dépendances changent
  }, [dxfData, isContainerReady]); // Dépend de dxfData et de la préparation du conteneur

  const resetView = () => {
    if (viewerInstanceRef.current && viewerInstanceRef.current.controls) {
      viewerInstanceRef.current.controls.reset();
    }
  };

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "absolute", // Conserve le positionnement du composant DxfViewer lui-même
        top: 0,
        left: 0,
      }}
    >
      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: "100%",
          // backgroundColor: "#f0f0f0", // three-dxf Viewer définit son propre fond (par défaut 0xeeeeee)
          // Le curseur sera géré par OrbitControls sur le canvas de three-dxf
        }}
      />
      {!dxfData && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            color: "#666",
            textAlign: "center", // Centrer le texte
          }}
        >
          Importez un fichier DXF pour le visualiser ici
        </div>
      )}
      {/* Afficher le bouton Reset uniquement si des données DXF sont chargées */}
      {dxfData && viewerInstanceRef.current && (
        <div style={{ position: "absolute", bottom: 10, right: 10, zIndex: 1 }}>
          <button
            onClick={resetView}
            style={{
              padding: "5px 10px",
              backgroundColor: "#007bff",
              color: "white",
              border: "none",
              borderRadius: 3,
              cursor: "pointer",
            }}
          >
            Reset
          </button>
        </div>
      )}
    </div>
  );
};

export default DxfViewer;
