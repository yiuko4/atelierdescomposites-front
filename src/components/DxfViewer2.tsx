import { DxfParser } from "dxf-parser";
import React, { useEffect, useRef, useState } from "react";
import { Viewer as ThreeDxfViewer } from "three-dxf";

interface DxfViewerProps {
  dxfUrl?: string;
  dxfFile?: File;
  // animateFolding n'est plus nécessaire
}

const DxfViewer: React.FC<DxfViewerProps> = ({
  dxfUrl,
  dxfFile,
  // animateFolding, // Retiré
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const threeDxfViewerRef = useRef<ThreeDxfViewer | null>(null);

  // Toutes les refs et états liés à l'animation de pliage sont supprimés
  // const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  // const sceneRef = useRef<THREE.Scene | null>(null);
  // const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  // const controlsRef = useRef<OrbitControls | null>(null);
  // const animationFrameIdRef = useRef<number | null>(null);
  // const [animationProgress, setAnimationProgress] = useState(0);
  // const lineBeingAnimatedRef = useRef<THREE.Line | null>(null);
  // const fullPathRef = useRef<{
  //   points: THREE.Vector3[];
  //   totalLength: number;
  // } | null>(null);

  // La fonction getOrderedPathFromDxf et l'interface Segment sont supprimées
  // const vectorsAreEqual = (...) => { ... };
  // interface Segment { ... };
  // const getOrderedPathFromDxf = (...) => { ... };

  useEffect(() => {
    const mountNode = mountRef.current;
    if (!mountNode) return;

    // Nettoyage existant
    if (threeDxfViewerRef.current) {
      if (mountNode) {
        while (mountNode.firstChild) {
          mountNode.removeChild(mountNode.firstChild);
        }
      }
      threeDxfViewerRef.current = null;
    }
    // Pas besoin de nettoyer les refs d'animation car elles sont supprimées

    const loadDxf = async (data: string | ArrayBuffer) => {
      if (!mountNode) return;
      setError(null); // Réinitialiser l'erreur à chaque chargement

      try {
        const parser = new DxfParser();
        const dxf = parser.parseSync(
          typeof data === "string" ? data : new TextDecoder().decode(data)
        );

        if (!dxf) {
          setError("Erreur lors du parsing du fichier DXF.");
          console.error("DXF parsing returned null or undefined.");
          return;
        }

        // S'assurer que le conteneur est vide
        while (mountNode.firstChild) {
          mountNode.removeChild(mountNode.firstChild);
        }

        // Initialisation de three-dxf viewer
        // Utiliser clientWidth/clientHeight du mountNode pour la taille
        threeDxfViewerRef.current = new ThreeDxfViewer(
          dxf,
          mountNode,
          mountNode.clientWidth,
          mountNode.clientHeight,
          null // font, peut être laissé à null
        );
        console.log("DXF Viewer initialized with three-dxf");
      } catch (err) {
        console.error("Erreur lors du chargement DXF avec three-dxf:", err);
        setError(
          err instanceof Error
            ? err.message
            : "Erreur inconnue lors du chargement du DXF."
        );
      }
    };

    if (dxfFile) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          console.log(
            "Fichier DXF local chargé, taille:",
            (event.target.result as ArrayBuffer).byteLength
          );
          loadDxf(event.target.result as ArrayBuffer);
        } else {
          setError("Impossible de lire le contenu du fichier.");
          console.error("FileReader event.target.result est null.");
        }
      };
      reader.onerror = (event) => {
        setError("Erreur lors de la lecture du fichier.");
        console.error("FileReader error:", event);
      };
      reader.readAsArrayBuffer(dxfFile);
    } else if (dxfUrl) {
      console.log("Chargement du DXF depuis l'URL:", dxfUrl);
      fetch(dxfUrl)
        .then(async (res) => {
          if (!res.ok) {
            const errorText = await res.text();
            throw new Error(
              `Erreur HTTP ${res.status} (${res.statusText}) lors du chargement du DXF: ${errorText}`
            );
          }
          const text = await res.text();
          console.log("Fichier DXF distant chargé, taille:", text.length);
          return text;
        })
        .then((text) => {
          loadDxf(text);
        })
        .catch((err) => {
          console.error("Erreur lors du fetch du DXF depuis l'URL:", err);
          setError(
            err instanceof Error
              ? err.message
              : "Erreur inconnue lors du fetch du DXF."
          );
        });
    } else {
      // Aucun fichier ni URL fourni, on peut nettoyer ou afficher un message
      if (mountNode) {
        while (mountNode.firstChild) {
          mountNode.removeChild(mountNode.firstChild);
        }
      }
      setError(null); // Pas d'erreur si rien n'est fourni, juste vide
      console.log("Aucun fichier DXF ou URL fourni. Viewer vidé.");
    }

    // Fonction de nettoyage pour le useEffect
    return () => {
      if (threeDxfViewerRef.current) {
        // three-dxf ne semble pas avoir de méthode destroy publique.
        // On vide simplement le conteneur.
        if (mountNode) {
          while (mountNode.firstChild) {
            mountNode.removeChild(mountNode.firstChild);
          }
        }
        threeDxfViewerRef.current = null;
        console.log("DXF Viewer nettoyé (three-dxf).");
      }
    };
  }, [dxfUrl, dxfFile]); // animateFolding retiré des dépendances

  return (
    <div>
      {error && (
        <div
          style={{
            color: "red",
            padding: "10px",
            border: "1px solid red",
            marginBottom: "10px",
          }}
        >
          <strong>Erreur:</strong> {error}
        </div>
      )}
      <div
        ref={mountRef}
        style={{
          width: "100%",
          minHeight: "500px", // Hauteur minimale pour être visible
          height: "calc(100vh - 250px)", // Exemple de hauteur dynamique
          border: "1px solid #ccc",
          backgroundColor: "#f0f0f0", // Fond pour voir si le div est là
          position: "relative", // Nécessaire pour que three-dxf positionne correctement le canvas
        }}
      >
        {!error && !dxfFile && !dxfUrl && (
          <div
            style={{ textAlign: "center", paddingTop: "50px", color: "#777" }}
          >
            Veuillez charger un fichier DXF.
          </div>
        )}
      </div>
      {/* Les contrôles d'animation et l'affichage de la progression sont supprimés */}
    </div>
  );
};

export default DxfViewer;
