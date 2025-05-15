import Head from "next/head";
import React, { useEffect, useState } from "react";
import AuthGuard from "../components/AuthGuard";
import DxfViewer from "../components/DxfViewer";
import styles from "../styles/Main.module.css";
//import dynamic from 'next/dynamic';

const MainPage: React.FC = () => {
  // Définir l'interface pour une pièce
  interface Piece {
    id: number;
    name: string;
    dxfData: ArrayBuffer | null;
  }

  // État pour stocker les pièces disponibles
  const [pieces, setPieces] = useState<Piece[]>([
    { id: 1, name: "Ciel", dxfData: null },
  ]);

  // État pour stocker la pièce sélectionnée
  const [selectedPiece, setSelectedPiece] = useState<number | null>(null);

  // État pour stocker les données DXF actuellement affichées
  const [currentDxfData, setCurrentDxfData] = useState<ArrayBuffer | null>(
    null
  );

  // Charger le fichier DXF par défaut au montage du composant
  useEffect(() => {
    const loadDefaultDxf = async () => {
      try {
        const response = await fetch("/fichier test.dxf"); // Les fichiers dans public sont à la racine
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${"$"}{response.status}`);
        }
        const arrayBuffer = await response.arrayBuffer();

        const defaultPieceName = "Fichier Test"; // Nom pour la pièce par défaut
        const defaultPieceId = 0; // ID unique pour la pièce par défaut (ou autre logique d'ID)

        // Créer l\'objet pièce par défaut
        const defaultPiece: Piece = {
          id: defaultPieceId,
          name: defaultPieceName,
          dxfData: arrayBuffer,
        };

        // Mettre à jour les états
        setCurrentDxfData(arrayBuffer);
        setSelectedPiece(defaultPieceId);
        // Ajouter la pièce par défaut à la liste, en s'assurant de ne pas dupliquer si déjà présente
        setPieces((prevPieces) => {
          const existingDefault = prevPieces.find(
            (p) => p.id === defaultPieceId
          );
          if (existingDefault) {
            // Remplacer si déjà existante pour mettre à jour dxfData si nécessaire
            return prevPieces.map((p) =>
              p.id === defaultPieceId ? defaultPiece : p
            );
          }
          return [
            defaultPiece,
            ...prevPieces.filter((p) => p.id !== defaultPieceId),
          ];
        });
      } catch (error) {
        console.error(
          "Erreur lors du chargement du fichier DXF par défaut:",
          error
        );
        alert("Impossible de charger le fichier DXF par défaut.");
      }
    };

    loadDefaultDxf();
  }, []); // Le tableau de dépendances vide assure que cela ne s'exécute qu'une fois au montage

  // Fonction pour gérer l'importation d'une nouvelle pièce
  const handleImportPiece = () => {
    // Créer un input de type file invisible
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".dxf";
    fileInput.style.display = "none";
    document.body.appendChild(fileInput);

    // Gérer l'événement de changement de fichier
    fileInput.onchange = async (event) => {
      const target = event.target as HTMLInputElement;
      const files = target.files;

      if (files && files.length > 0) {
        const file = files[0];
        try {
          // Lire le fichier DXF
          const fileReader = new FileReader();

          fileReader.onload = (e) => {
            if (e.target && e.target.result) {
              const dxfData = e.target.result as ArrayBuffer;

              // Créer une nouvelle pièce avec les données DXF
              const newPiece = {
                id: pieces.length + 1,
                name: file.name.split(".")[0], // Utiliser le nom du fichier sans l'extension
                dxfData: dxfData,
              };

              // Ajouter la nouvelle pièce à la liste
              setPieces([...pieces, newPiece]);

              // Sélectionner la nouvelle pièce et afficher ses données DXF
              setSelectedPiece(newPiece.id);
              setCurrentDxfData(dxfData);

              alert(`Pièce "${newPiece.name}" importée avec succès!`);
            }
          };

          fileReader.onerror = () => {
            throw new Error("Erreur lors de la lecture du fichier");
          };

          fileReader.readAsArrayBuffer(file);
        } catch (error) {
          console.error("Error importing piece:", error);
          alert(
            "Erreur lors de l'importation de la pièce. Veuillez vérifier le format du fichier."
          );
        }
      }

      // Nettoyer
      document.body.removeChild(fileInput);
    };

    // Déclencher le clic sur l'input
    fileInput.click();
  };

  // Fonction pour sélectionner une pièce
  const handleSelectPiece = (pieceId: number) => {
    setSelectedPiece(pieceId);

    // Trouver la pièce sélectionnée et afficher ses données DXF
    const selectedPieceData = pieces.find((piece) => piece.id === pieceId);
    if (selectedPieceData) {
      setCurrentDxfData(selectedPieceData.dxfData);
    }
  };
  return (
    <AuthGuard>
      <>
        <Head>
          <title>Importer / Création de la pièce</title>
        </Head>
        <div className={styles.pageContainer}>
          <header className={styles.header}>
            <h1>Importer / Création de la pièce</h1>
          </header>
          <div className={styles.mainAppContainer}>
            <aside className={styles.sidebarLeft}>
              <h2>Anciennes pièces</h2>
              {pieces.map((piece) => (
                <button
                  key={piece.id}
                  className={`${styles.pieceButton} ${
                    selectedPiece === piece.id ? styles.pieceButtonActive : ""
                  }`}
                  onClick={() => handleSelectPiece(piece.id)}
                >
                  {piece.name}
                </button>
              ))}
              <button
                className={styles.importButton}
                onClick={handleImportPiece}
              >
                IMPORTER UNE PIECE
              </button>
            </aside>
            <main className={styles.viewerSection}>
              <h2>Viewer</h2>
              <div className={`${styles.viewerPlaceholder}`}>
                <DxfViewer dxfData={currentDxfData} />
              </div>
            </main>
            <aside className={styles.sidebarRight}>
              <h2>Paramètre de lancement</h2>
              <div className={styles.paramGroup}>
                <label htmlFor="piece-num">N° de piece :</label>
                <input
                  type="text"
                  id="piece-num"
                  name="piece-num"
                  className={styles.paramInput}
                />
              </div>
              <div className={styles.paramGroup}>
                <label htmlFor="temps">Temps :</label>
                <input
                  type="text"
                  id="temps"
                  name="temps"
                  className={styles.paramInput}
                />
              </div>
              <div className={styles.paramGroup}>
                <label htmlFor="metrage">Metrage :</label>
                <input
                  type="text"
                  id="metrage"
                  name="metrage"
                  className={styles.paramInput}
                />
              </div>
              <div className={styles.paramGroup}>
                <label htmlFor="prix-matiere">Prix matière :</label>
                <input
                  type="text"
                  id="prix-matiere"
                  name="prix-matiere"
                  className={styles.paramInput}
                />
              </div>
              <button className={styles.testButton}>Tester la pièce</button>
              <button className={styles.startButton}>START</button>
            </aside>
          </div>
        </div>
      </>
    </AuthGuard>
  );
};

export default MainPage;
