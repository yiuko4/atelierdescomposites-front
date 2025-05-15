import Head from "next/head";
import React, { useEffect, useState } from "react";
import AuthGuard from "../components/AuthGuard";
import ConfirmationModal, {
  ConfirmationModalProps,
} from "../components/ConfirmationModal";
import DxfViewer from "../components/DxfViewer";
import Notification, { NotificationProps } from "../components/Notification";
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
  const [pieces, setPieces] = useState<Piece[]>([]);

  // État pour stocker la pièce sélectionnée
  const [selectedPiece, setSelectedPiece] = useState<number | null>(null);

  // État pour stocker les données DXF actuellement affichées
  const [currentDxfData, setCurrentDxfData] = useState<ArrayBuffer | null>(
    null
  );

  // États pour la notification
  const [notification, setNotification] = useState<Omit<
    NotificationProps,
    "onClose"
  > | null>(null);

  // États pour le modal de confirmation
  type ConfirmationModalData = Omit<
    ConfirmationModalProps,
    "isOpen" | "onCancel" | "onConfirm"
  > & {
    onConfirmAction: () => void | Promise<void>; // Callback pour l'action de confirmation
    onCancelAction?: () => void | Promise<void>; // Callback optionnel pour l'action d'annulation
  };
  const [confirmationModalData, setConfirmationModalData] =
    useState<ConfirmationModalData | null>(null);
  const [isConfirmationModalOpen, setIsConfirmationModalOpen] = useState(false);

  // Interface pour la réponse de l'API de contenu de fichier DXF
  interface DxfFileContentResponse {
    name: string;
    content: string; // Contenu textuel du fichier DXF
  }

  // Fonction pour récupérer le contenu d'un fichier DXF spécifique depuis le serveur
  const fetchDxfFileContentFromServer = async (
    filename: string
  ): Promise<DxfFileContentResponse | null> => {
    try {
      const authToken = localStorage.getItem("authToken");
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };
      if (authToken) {
        headers["Authorization"] = `Bearer ${authToken}`;
      }

      const encodedFilename = encodeURIComponent(filename);
      const response = await fetch(
        `http://localhost:30001/api/dxf/imported-files/${encodedFilename}`,
        {
          method: "GET",
          headers: headers,
        }
      );

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ message: response.statusText }));
        const errorMessage =
          errorData.message ||
          `Impossible de récupérer le contenu du fichier '${filename}'.`;
        console.error(
          `[DEBUG] Erreur lors de la récupération du contenu du fichier DXF '${filename}':`,
          errorMessage
        );
        showNotification(errorMessage, "error");
        return null;
      }

      const data = await response.json(); // Ceci est l'objet enveloppant {status, message, data: {name, content}}
      if (
        data &&
        data.data &&
        typeof data.data.content === "string" &&
        typeof data.data.name === "string"
      ) {
        // Retourner l'objet {name, content} qui est dans data.data
        return data.data as DxfFileContentResponse;
      } else {
        const errorMessage = `Réponse invalide pour le contenu du fichier DXF '${filename}'.`;
        console.error(
          `[DEBUG] Réponse invalide pour le contenu du fichier DXF '${filename}': structure attendue non trouvée dans data.data. Reçu:`,
          data
        );
        showNotification(errorMessage, "error");
        return null;
      }
    } catch (error) {
      const errorMessage = `Erreur réseau lors du chargement du contenu du fichier '${filename}'.`;
      console.error(
        `[DEBUG] Erreur réseau ou de parsing JSON pour le contenu du fichier DXF '${filename}':`,
        error
      );
      showNotification(errorMessage, "error");
      return null;
    }
  };

  // Fonction pour récupérer les fichiers DXF importés depuis le serveur
  const fetchImportedDxfFilesFromServer = async (): Promise<
    { name: string }[]
  > => {
    try {
      const authToken = localStorage.getItem("authToken");
      const headers: HeadersInit = {
        "Content-Type": "application/json", // Bonne pratique, même si pas toujours requis pour GET
      };
      if (authToken) {
        headers["Authorization"] = `Bearer ${authToken}`;
      }

      const response = await fetch(
        "http://localhost:30001/api/dxf/imported-files",
        {
          method: "GET",
          headers: headers,
        }
      );

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ message: response.statusText }));
        const errorMessage =
          errorData.message ||
          "Impossible de récupérer la liste des fichiers DXF.";
        console.error(
          "[DEBUG] Erreur lors de la récupération des fichiers DXF importés:",
          errorMessage
        );
        showNotification(errorMessage, "error");
        return [];
      }

      const data = await response.json();
      console.log(
        "[API DATA] Fichiers DXF reçus du serveur:",
        JSON.stringify(data)
      ); // Log des données brutes
      // S'assurer que la réponse a bien une propriété data qui est un tableau
      if (data && data.data && Array.isArray(data.data)) {
        return data.data as { name: string }[];
      }
      console.error(
        "[DEBUG] La réponse de l'API ne contient pas de tableau 'data' valide.",
        data
      );
      return []; // Retourner un tableau vide si la structure n'est pas celle attendue
    } catch (error) {
      console.error(
        "[DEBUG] Erreur réseau ou de parsing JSON lors de la récupération des fichiers DXF:",
        error
      );
      return [];
    }
  };

  // Charger les fichiers du serveur au montage du composant
  // et potentiellement après des actions comme l'import.
  // Pour pouvoir appeler cette logique depuis handleImportPiece, nous allons l'extraire.
  const refreshServerFiles = async () => {
    console.log(
      "[DEBUG] Rafraîchissement des fichiers DXF depuis le serveur..."
    );
    const serverFiles = await fetchImportedDxfFilesFromServer();
    console.log(
      "[SERVER FILES DEBUG] Fichiers récupérés (refresh):",
      JSON.stringify(serverFiles)
    );

    // Réinitialiser pieces à un tableau vide avant de le peupler avec les fichiers du serveur
    // pour éviter les doublons ou les états incohérents si des ID changent.
    // Ou, si vous voulez une fusion plus intelligente, il faudrait adapter.
    // Pour l'instant, une réinitialisation simple est plus robuste après un import.

    let newPieces: Piece[] = [];
    if (serverFiles.length > 0) {
      newPieces = serverFiles.map((sf, index) => ({
        id: index, // ID simples basés sur l'ordre du serveur après rafraîchissement
        name: sf.name,
        dxfData: null,
      }));
      console.log(
        "[SERVER FILES DEBUG] Nouvelles pièces formatées (refresh):",
        JSON.stringify(newPieces)
      );
    }
    setPieces(newPieces);

    // Optionnel: Si le viewer affichait quelque chose, le vider car la sélection pourrait ne plus être valide.
    // setSelectedPiece(null);
    // setCurrentDxfData(null);
  };

  useEffect(() => {
    // Remplacer l'ancien contenu de loadInitialData par un appel à refreshServerFiles
    refreshServerFiles();
  }, []);

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

        // Étape 1: Lire le fichier en ArrayBuffer pour l'affichage local et le stockage
        const fileReader = new FileReader();
        fileReader.readAsArrayBuffer(file);

        fileReader.onload = async (e) => {
          if (e.target && e.target.result) {
            const dxfDataArrayBuffer = e.target.result as ArrayBuffer;

            // Étape 2: Envoyer le fichier à l'API /api/import-dxf
            const formData = new FormData();
            formData.append("dxfFile", file);
            // formData.append('numArcSegments', '24'); // Exemple pour numArcSegments si nécessaire

            const authToken = localStorage.getItem("authToken");
            const headers: HeadersInit = {};
            if (authToken) {
              headers["Authorization"] = `Bearer ${authToken}`;
            }

            try {
              const response = await fetch(
                "http://localhost:30001/api/import-dxf",
                {
                  method: "POST",
                  headers: headers,
                  body: formData,
                }
              );

              const apiData = await response.json();

              if (!response.ok) {
                console.error(
                  "Erreur lors de l'importation via l'API:",
                  apiData.message || response.statusText
                );
                showNotification(
                  apiData.message ||
                    "Erreur lors de l'importation DXF via API.",
                  "error"
                );
                return;
              }

              console.log("DXF importé avec succès via API:", apiData);
              // Ici, vous pouvez utiliser apiData.shapeData et apiData.pixelsPerMm si besoin

              showNotification(
                `Pièce "${file.name
                  .split(".")
                  .slice(0, -1)
                  .join(
                    "."
                  )}" envoyée à l'API avec succès. Rafraîchissement de la liste...`,
                "success"
              );

              // Rafraîchir la liste des pièces depuis le serveur
              await refreshServerFiles();
            } catch (error) {
              console.error(
                "Erreur réseau ou de parsing JSON lors de l'importation DXF:",
                error
              );
              showNotification(
                "Erreur de communication avec le serveur d'importation DXF.",
                "error"
              );
            }
          }
        };

        fileReader.onerror = () => {
          console.error("Erreur lors de la lecture du fichier DXF localement.");
          showNotification(
            "Erreur interne lors de la lecture du fichier.",
            "error"
          );
        };
      } else {
        // Nettoyage si aucun fichier n'est sélectionné (bien que l'input devrait le gérer)
        if (document.body.contains(fileInput)) {
          document.body.removeChild(fileInput);
        }
      }
      // Nettoyage de l'input après la tentative d'importation
      // Déplacé ici pour s'assurer qu'il est enlevé même si files est null ou length 0 initialement
      // ou si l'utilisateur annule la sélection.
      if (document.body.contains(fileInput)) {
        document.body.removeChild(fileInput);
      }
    };

    // Déclencher le clic sur l'input
    fileInput.click();
  };

  // Fonction pour sélectionner une pièce
  const handleSelectPiece = async (pieceId: number) => {
    setSelectedPiece(pieceId);

    const pieceInState = pieces.find((piece) => piece.id === pieceId);
    if (pieceInState) {
      if (pieceInState.dxfData === null) {
        // Le contenu du fichier DXF n'est pas chargé (vient du listing serveur)
        // Afficher un état de chargement si vous en avez un (ex: setIsLoading(true))
        try {
          console.log(
            `[DEBUG] Chargement du contenu pour : ${pieceInState.name}`
          );
          const fileData = await fetchDxfFileContentFromServer(
            pieceInState.name
          );

          if (fileData && fileData.content) {
            const dxfStringContent = fileData.content;
            const encoder = new TextEncoder(); // Utilise UTF-8 par défaut, ce qui est généralement correct pour DXF
            const arrayBuffer: ArrayBuffer = encoder.encode(dxfStringContent)
              .buffer as ArrayBuffer;

            setCurrentDxfData(arrayBuffer);
            // Mettre à jour la pièce dans l'état pour éviter de re-fetcher
            setPieces((prevPieces) =>
              prevPieces.map((p) =>
                p.id === pieceId ? { ...p, dxfData: arrayBuffer } : p
              )
            );
            console.log(
              `[DEBUG] Contenu de '${pieceInState.name}' chargé et mis à jour dans l'état.`
            );
            // Optionnel: alert('Contenu du fichier chargé avec succès!');
          } else {
            // Notification d'erreur déjà gérée par fetchDxfFileContentFromServer si fileData est null
            // Mais si fileData est ok mais fileData.content est manquant (cas moins probable avec la logique actuelle de fetchDxfFileContentFromServer)
            if (fileData && !fileData.content) {
              showNotification(
                `Contenu manquant dans la réponse pour '${pieceInState.name}'.`,
                "error"
              );
            }
            setCurrentDxfData(null);
          }
        } catch (error) {
          // Les erreurs spécifiques à fetchDxfFileContentFromServer sont déjà logguées et notifiées dans cette fonction
          // Ce catch est pour des erreurs imprévues dans ce bloc try de handleSelectPiece
          const errorMessage = `Erreur inattendue lors du traitement du fichier '${pieceInState.name}'.`;
          console.error(
            `[DEBUG] Échec global du chargement du contenu pour '${pieceInState.name}':`,
            error
          );
          showNotification(errorMessage, "error");
          setCurrentDxfData(null);
        } finally {
          // Cacher l'état de chargement (ex: setIsLoading(false))
        }
      } else {
        // Le contenu DXF est disponible (pièce par défaut ou importée localement et déjà chargée)
        console.log(
          `[DEBUG] Affichage du contenu déjà chargé pour : ${pieceInState.name}`
        );
        setCurrentDxfData(pieceInState.dxfData);
      }
    }
  };

  // Fonction pour lancer la fabrication via l'API
  const handleStartManufacture = async () => {
    if (!currentDxfData) {
      showNotification(
        "Aucun fichier DXF n'est actuellement chargé pour la fabrication.",
        "info"
      );
      return;
    }

    let fileName = "default_manufacture_piece.dxf";
    if (selectedPiece !== null) {
      const piece = pieces.find((p) => p.id === selectedPiece);
      if (piece && piece.name) {
        fileName = piece.name.toLowerCase().endsWith(".dxf")
          ? piece.name
          : `${piece.name}.dxf`;
      }
    }

    const dxfFile = new File([currentDxfData], fileName, {
      type: "application/dxf",
    });
    const formData = new FormData();
    formData.append("dxfFile", dxfFile);

    try {
      const authToken = localStorage.getItem("authToken");
      const headers: HeadersInit = {};

      if (authToken) {
        headers["Authorization"] = `Bearer ${authToken}`;
      }

      const response = await fetch("http://localhost:30001/api/manufacture", {
        method: "POST",
        headers: headers,
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        console.error(
          "Erreur lors du lancement de la fabrication:",
          data.message || response.statusText
        );
        showNotification(
          `Erreur de fabrication: ${data.message || response.statusText}`,
          "error"
        );
        return;
      }

      console.log("Processus de fabrication terminé:", data);
      showNotification(
        "Fabrication lancée avec succès! G-code généré.",
        "success"
      );
      // Afficher des informations de 'data' à l'utilisateur si pertinent
      // Par exemple, data.gcode, data.arduinoResponse.message
    } catch (error) {
      console.error(
        "Erreur réseau ou de parsing JSON lors de la communication avec l'API de fabrication:",
        error
      );
      showNotification(
        "Erreur de communication avec le serveur de fabrication.",
        "error"
      );
    }
  };

  // Fonction pour supprimer un fichier DXF du serveur
  const deleteDxfFileFromServer = async (
    filename: string
  ): Promise<boolean> => {
    try {
      const authToken = localStorage.getItem("authToken");
      const headers: HeadersInit = {};
      if (authToken) {
        headers["Authorization"] = `Bearer ${authToken}`;
      }

      const encodedFilename = encodeURIComponent(filename);
      const response = await fetch(
        `http://localhost:30001/api/dxf/imported-files/${encodedFilename}`,
        {
          method: "DELETE",
          headers: headers,
        }
      );

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ message: response.statusText }));
        const errorMessage =
          errorData.message || "Impossible de supprimer le fichier du serveur.";
        console.error(
          `[DEBUG] Erreur lors de la suppression du fichier DXF '${filename}' sur le serveur:`,
          errorMessage
        );
        showNotification(errorMessage, "error");
        return false;
      }

      console.log(
        `[DEBUG] Fichier DXF '${filename}' supprimé avec succès du serveur.`
      );
      return true;
    } catch (error) {
      const errorMessage =
        "Erreur de communication lors de la tentative de suppression du fichier.";
      console.error(
        `[DEBUG] Erreur réseau ou de parsing JSON lors de la suppression du fichier DXF '${filename}':`,
        error
      );
      showNotification(errorMessage, "error");
      return false;
    }
  };

  // Fonction pour gérer la suppression d'une pièce
  const handleDeletePiece = async (pieceIdToDelete: number) => {
    console.log(
      `[DEBUG] handleDeletePiece: Début pour pieceId: ${pieceIdToDelete}`
    );
    const pieceToDelete = pieces.find((p) => p.id === pieceIdToDelete);
    console.log(
      `[DEBUG] handleDeletePiece: pieceToDelete (après find):`,
      pieceToDelete
    );

    if (!pieceToDelete) {
      console.error(
        "[DEBUG] handleDeletePiece: Pièce non trouvée dans l'état. ID:",
        pieceIdToDelete
      );
      showNotification(
        "Erreur: Pièce non trouvée pour la suppression.",
        "error"
      );
      return;
    }
    console.log("[DEBUG] handleDeletePiece: Pièce trouvée.");

    console.log(
      "[DEBUG] handleDeletePiece: Avant affichage modal de confirmation."
    );

    showConfirmationModal({
      title: "Confirmation de suppression",
      message: `Êtes-vous sûr de vouloir supprimer la pièce "${pieceToDelete.name}" ? Cette action est irréversible.`,
      confirmText: "Supprimer",
      cancelText: "Annuler",
      onConfirmAction: async () => {
        console.log(
          "[DEBUG] handleDeletePiece (modal): Utilisateur a confirmé. Appel de deleteDxfFileFromServer."
        );
        const success = await deleteDxfFileFromServer(pieceToDelete.name);
        if (success) {
          console.log(
            "[DEBUG] handleDeletePiece (modal): Suppression serveur réussie. Mise à jour de l'état."
          );
          setPieces((prevPieces) =>
            prevPieces.filter((p) => p.id !== pieceIdToDelete)
          );
          if (selectedPiece === pieceIdToDelete) {
            setSelectedPiece(null);
            setCurrentDxfData(null);
          }
          showNotification(
            `Pièce "${pieceToDelete.name}" supprimée avec succès.`,
            "success"
          );
        } else {
          console.log(
            "[DEBUG] handleDeletePiece (modal): Suppression serveur échouée. Notification déjà gérée par deleteDxfFileFromServer."
          );
        }
      },
      onCancelAction: () => {
        console.log(
          "[DEBUG] handleDeletePiece (modal): Utilisateur a annulé la suppression."
        );
        showNotification("Suppression annulée.", "info", 3000);
      },
    });
  };

  // Fonction pour afficher une notification
  const showNotification = (
    message: string,
    type: NotificationProps["type"],
    duration?: number
  ) => {
    setNotification({ message, type, duration });
  };

  const closeNotification = () => {
    setNotification(null);
  };

  // Fonction pour afficher le modal de confirmation
  const showConfirmationModal = (data: ConfirmationModalData) => {
    console.log("[DEBUG] showConfirmationModal: Appelée avec data:", data);
    // Assurez-vous que confirmButtonColor n'est pas passé si le modal CSS ne l'utilise pas
    const { confirmButtonColor, ...restData } = data as any; // Astuce pour enlever une prop
    setConfirmationModalData(restData);
    setIsConfirmationModalOpen(true);
    console.log(
      "[DEBUG] showConfirmationModal: isConfirmationModalOpen devrait être true maintenant."
    );
  };

  const handleConfirm = async () => {
    if (confirmationModalData?.onConfirmAction) {
      await confirmationModalData.onConfirmAction();
    }
    setIsConfirmationModalOpen(false);
    setConfirmationModalData(null);
  };

  const handleCancel = async () => {
    if (confirmationModalData?.onCancelAction) {
      await confirmationModalData.onCancelAction();
    }
    setIsConfirmationModalOpen(false);
    setConfirmationModalData(null);
  };

  return (
    <AuthGuard>
      <>
        <Head>
          <title>Importer / Création de la pièce</title>
        </Head>

        {/* Affichage de la Notification */}
        {notification && (
          <Notification
            message={notification.message}
            type={notification.type}
            duration={notification.duration}
            onClose={closeNotification}
          />
        )}

        {/* Affichage du Modal de Confirmation */}
        {isConfirmationModalOpen && confirmationModalData && (
          <ConfirmationModal
            isOpen={isConfirmationModalOpen}
            title={confirmationModalData.title || "Titre de Confirmation"}
            message={confirmationModalData.message || "Êtes-vous sûr ?"}
            confirmText={confirmationModalData.confirmText}
            cancelText={confirmationModalData.cancelText}
            onConfirm={handleConfirm}
            onCancel={handleCancel}
          />
        )}

        <div className={styles.pageContainer}>
          <header className={styles.header}>
            <h1>Importer / Création de la pièce</h1>
          </header>
          <div className={styles.mainAppContainer}>
            <aside className={styles.sidebarLeft}>
              <h2>Anciennes pièces</h2>
              {pieces.map((piece) => (
                <div key={piece.id} className={styles.pieceEntry}>
                  <button
                    className={`${styles.pieceButton} ${
                      selectedPiece === piece.id ? styles.pieceButtonActive : ""
                    }`}
                    onClick={() => handleSelectPiece(piece.id)}
                  >
                    {piece.name}
                  </button>
                  <button
                    className={styles.deletePieceButton}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeletePiece(piece.id);
                    }}
                    title={`Supprimer ${piece.name}`}
                  >
                    🗑️
                  </button>
                </div>
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
              <button
                className={styles.startButton}
                onClick={handleStartManufacture}
              >
                START
              </button>
            </aside>
          </div>
        </div>
      </>
    </AuthGuard>
  );
};

export default MainPage;
