import Head from "next/head";
import React, { useEffect, useRef, useState } from "react";
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

  // Ajouter un nouvel état pour le nombre de pièces
  const [pieceCount, setPieceCount] = useState<number>(1);

  // Ajouter une constante pour limiter le nombre de pièces visibles
  const MAX_VISIBLE_PIECES = 3;

  // Références pour la zone de drop
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Fonction pour incrémenter ou décrémenter le nombre de pièces
  const incrementPieceCount = (increment: number) => {
    setPieceCount((prevCount) => Math.max(1, prevCount + increment));
  };

  // Fonction pour extraire le timestamp du nom de fichier
  const parseTimestampFromName = (filename: string): number | null => {
    // Tenter d'extraire une date de type YYYY-MM-DDTHH-MM-SS
    const match = filename.match(/(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})/);
    if (match && match[1]) {
      const timestampStr = match[1].replace(/-/g, ""); // Enlever les séparateurs non standards pour Date.parse
      const date = new Date(
        parseInt(timestampStr.substring(0, 4), 10), // Année
        parseInt(timestampStr.substring(4, 6), 10) - 1, // Mois (0-indexé)
        parseInt(timestampStr.substring(6, 8), 10), // Jour
        parseInt(timestampStr.substring(9, 11), 10), // Heure
        parseInt(timestampStr.substring(11, 13), 10), // Minute
        parseInt(timestampStr.substring(13, 15), 10) // Seconde
      );
      if (!isNaN(date.getTime())) {
        return date.getTime();
      }
    }
    // Tenter de parser directement si le format est plus standard après le T
    const standardMatch = filename.match(
      /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/
    );
    if (standardMatch && standardMatch[1]) {
      const date = new Date(standardMatch[1]);
      if (!isNaN(date.getTime())) {
        return date.getTime();
      }
    }
    return null;
  };

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
        "Content-Type": "application/json",
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
  const refreshServerFiles = async (fileToSelect?: string) => {
    console.log(
      "[DEBUG] Rafraîchissement des fichiers DXF depuis le serveur...",
      fileToSelect ? `Fichier à sélectionner: ${fileToSelect}` : ""
    );
    const serverFiles = await fetchImportedDxfFilesFromServer();
    console.log(
      "[SERVER FILES DEBUG] Fichiers récupérés (refresh):",
      serverFiles
    );

    if (serverFiles.length > 0) {
      const currentTimeForNonDatedFiles = Date.now(); // Pour les fichiers sans date valide dans le nom

      const updatedPieces: Piece[] = serverFiles.map((file, index) => {
        let id: number;
        const timestampFromName = parseTimestampFromName(file.name);

        if (fileToSelect && file.name === fileToSelect) {
          // Pour la pièce nouvellement importée, s'assurer qu'elle a l'ID le plus élevé
          // On peut utiliser le timestamp actuel ou celui du fichier s'il est plus récent.
          id = Math.max(timestampFromName || 0, Date.now()) + 100000; // Ajoute un grand nombre pour être sûr
          console.log(
            `[DEBUG] Pièce à sélectionner (${file.name}) ID (prioritaire): ${id}`
          );
        } else if (timestampFromName !== null) {
          id = timestampFromName;
          console.log(
            `[DEBUG] Pièce (${file.name}) ID (depuis nom de fichier): ${id}`
          );
        } else {
          // Pour les fichiers sans timestamp valide dans le nom, utiliser un ID basé sur currentTime et l'index
          // pour les classer de manière cohérente mais après ceux avec timestamp.
          // On leur donne des IDs plus petits pour qu'ils apparaissent en bas après le tri décroissant.
          id =
            currentTimeForNonDatedFiles -
            index * 1000 -
            serverFiles.length * 1000; // Assure qu'ils sont plus anciens
          console.log(
            `[DEBUG] Pièce (${file.name}) ID (fallback, pas de date dans nom): ${id}`
          );
        }

        return {
          id: id,
          name: file.name,
          dxfData: null, // Pas de données DXF chargées initialement
        };
      });

      console.log(
        "[DEBUG] Liste des pièces avant tri:",
        updatedPieces.map((p) => `${p.name} (ID: ${p.id})`)
      );

      // Trier les pièces pour avoir les plus récentes en haut (ID plus grand en premier)
      updatedPieces.sort((a, b) => b.id - a.id);

      console.log(
        "[DEBUG] Liste des pièces après tri:",
        updatedPieces.map((p) => `${p.name} (ID: ${p.id})`)
      );

      // Mettre à jour l'état avec les nouvelles pièces
      setPieces(updatedPieces);

      // Si un nom de fichier est spécifié, trouver et sélectionner cette pièce
      if (fileToSelect) {
        // Recherche exacte
        const exactMatch = updatedPieces.find((p) => p.name === fileToSelect);
        if (exactMatch) {
          console.log(
            `[DEBUG] Sélection de la pièce exacte: ${fileToSelect}, ID: ${exactMatch.id}`
          );

          // Utiliser setTimeout pour s'assurer que setState a bien été appliqué
          setTimeout(() => {
            setSelectedPiece(exactMatch.id);
          }, 100);
        }
        // Si nous ne trouvons pas correspondance exacte, nous sélectionnons simplement la première pièce
        // qui devrait être la plus récente en raison du tri
        else if (updatedPieces.length > 0) {
          console.log(
            `[DEBUG] Pas de correspondance exacte, sélection de la première pièce: ${updatedPieces[0].name}`
          );

          // Utiliser setTimeout pour s'assurer que setState a bien été appliqué
          setTimeout(() => {
            setSelectedPiece(updatedPieces[0].id);
          }, 100);
        }
      }
    } else {
      // Pas de fichiers disponibles, réinitialiser l'état
      setPieces([]);
      setSelectedPiece(null);
      setCurrentDxfData(null);
    }
  };

  // Effet pour charger les fichiers depuis le serveur au chargement initial
  useEffect(() => {
    refreshServerFiles();
  }, []);

  // Effet pour charger le contenu DXF lorsqu'une pièce est sélectionnée
  useEffect(() => {
    if (selectedPiece !== null) {
      const selectedPieceData = pieces.find((p) => p.id === selectedPiece);
      if (selectedPieceData && selectedPieceData.name) {
        console.log(
          `[DEBUG] Chargement du contenu DXF pour la pièce: ${selectedPieceData.name}`
        );
        loadPieceContent(selectedPieceData.name);
      }
    } else {
      // Aucune pièce sélectionnée, effacer les données actuelles
      setCurrentDxfData(null);
    }
  }, [selectedPiece]);

  // Fonction pour charger le contenu d'une pièce depuis le serveur
  const loadPieceContent = async (pieceName: string) => {
    console.log(
      `[DEBUG] Tentative de chargement du contenu pour: ${pieceName}`
    );
    const dxfContent = await fetchDxfFileContentFromServer(pieceName);
    if (dxfContent && dxfContent.content) {
      // Créer un ArrayBuffer à partir du contenu textuel pour le visualiseur
      const textEncoder = new TextEncoder();
      const encodedData = textEncoder.encode(dxfContent.content);
      const dxfDataArrayBuffer = encodedData.buffer;
      setCurrentDxfData(dxfDataArrayBuffer as ArrayBuffer);
    } else {
      setCurrentDxfData(null);
      showNotification(
        `Impossible de charger le contenu de la pièce: ${pieceName}`,
        "error"
      );
    }
  };

  // Fonction pour gérer l'importation d'un fichier
  const handleFileImport = async (file: File) => {
    if (!file || !file.name.toLowerCase().endsWith(".dxf")) {
      showNotification("Seuls les fichiers DXF sont acceptés", "error");
      return;
    }

    console.log(`[DEBUG] Fichier sélectionné pour import: ${file.name}`);

    // Extraire le nom de base du fichier sans le chemin complet (pour les navigateurs qui incluent le chemin)
    const fileName = file.name.split("\\").pop()?.split("/").pop() || file.name;
    console.log(`[DEBUG] Nom de fichier extrait: ${fileName}`);

    // Créer un objet FormData pour l'upload
    const formData = new FormData();
    formData.append("dxfFile", file); // IMPORTANT: 'dxfFile', pas 'file'
    formData.append("numArcSegments", "24"); // Valeur par défaut

    try {
      const authToken = localStorage.getItem("authToken");
      const headers: HeadersInit = {};
      if (authToken) {
        headers["Authorization"] = `Bearer ${authToken}`;
      }

      // Envoyer le fichier au serveur
      const response = await fetch("http://localhost:30001/api/import-dxf", {
        method: "POST",
        headers: headers,
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ message: response.statusText }));
        const errorMessage =
          errorData.message || `Échec de l'import du fichier: ${fileName}`;
        console.error("[DEBUG] Erreur lors de l'import:", errorMessage);
        showNotification(errorMessage, "error");
      } else {
        const data = await response.json();
        console.log("[DEBUG] Import réussi:", data);

        // Obtenir le nom du fichier tel que stocké sur le serveur (s'il est retourné)
        let fileNameToSelect = fileName;
        if (data && data.filename) {
          fileNameToSelect = data.filename;
          console.log(
            `[DEBUG] Nom du fichier tel que stocké sur le serveur: ${fileNameToSelect}`
          );
        }

        showNotification(`Fichier ${fileName} importé avec succès!`, "success");

        // Rafraîchir la liste des fichiers du serveur et sélectionner la nouvelle pièce
        await refreshServerFiles(fileNameToSelect);
      }
    } catch (error) {
      console.error("[DEBUG] Erreur réseau lors de l'import:", error);
      showNotification(
        "Erreur lors de la communication avec le serveur",
        "error"
      );
    }
  };

  // Fonction pour importer une nouvelle pièce (déclenchée par le bouton d'import)
  const handleImportPiece = () => {
    // Créer un élément d'input de type fichier
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".dxf";
    fileInput.style.display = "none";

    // Ajouter l'élément au DOM
    document.body.appendChild(fileInput);

    // Gérer l'événement de changement (quand un fichier est sélectionné)
    fileInput.addEventListener("change", async (event) => {
      const target = event.target as HTMLInputElement;
      const files = target.files;

      if (files && files.length > 0) {
        await handleFileImport(files[0]);
      }

      // Nettoyer
      document.body.removeChild(fileInput);
    });

    // Déclencher l'ouverture du sélecteur de fichier
    fileInput.click();
  };

  // Fonction pour sélectionner une pièce
  const handleSelectPiece = async (pieceId: number) => {
    setSelectedPiece(pieceId);
  };

  // Fonction pour démarrer la fabrication (envoi à la machine)
  const handleStartManufacture = async () => {
    if (selectedPiece === null) {
      showNotification(
        "Veuillez sélectionner une pièce avant de démarrer la fabrication",
        "error"
      );
      return;
    }

    // Trouver la pièce sélectionnée
    const pieceToManufacture = pieces.find((p) => p.id === selectedPiece);
    if (!pieceToManufacture) {
      showNotification("Pièce introuvable", "error");
      return;
    }

    // Confirmer l'action avec l'utilisateur
    showConfirmationModal({
      title: "Démarrer la fabrication",
      message: `Êtes-vous sûr de vouloir fabriquer ${pieceCount} exemplaire${
        pieceCount > 1 ? "s" : ""
      } de la pièce "${pieceToManufacture.name}" ?`,
      confirmLabel: "Démarrer",
      cancelLabel: "Annuler",
      confirmButtonClassName: styles.startButton,
      onConfirmAction: async () => {
        if (!currentDxfData) {
          showNotification(
            "Les données du fichier DXF ne sont pas chargées. Veuillez réessayer.",
            "error"
          );
          return;
        }

        try {
          const authToken = localStorage.getItem("authToken");
          const headers: HeadersInit = {}; // Ne pas définir Content-Type ici
          if (authToken) {
            headers["Authorization"] = `Bearer ${authToken}`;
          }

          const formData = new FormData();
          // Crée un objet File à partir de l'ArrayBuffer
          const dxfFileObject = new File(
            [currentDxfData],
            pieceToManufacture.name,
            {
              type: "application/octet-stream", // Type MIME générique, le backend devrait l'ignorer ou le parser
            }
          );
          formData.append("dxfFile", dxfFileObject);
          formData.append("filename", pieceToManufacture.name); // Peut être utile pour le backend
          formData.append("quantity", pieceCount.toString());

          // Envoyer la requête pour démarrer la fabrication
          const response = await fetch(
            "http://localhost:30001/api/manufacture",
            {
              method: "POST",
              headers: headers, // Contient uniquement Authorization si présent
              body: formData, // FormData au lieu de JSON.stringify
            }
          );

          if (!response.ok) {
            const errorData = await response
              .json()
              .catch(() => ({ message: response.statusText }));
            const errorMessage =
              errorData.message ||
              "Impossible de démarrer la fabrication. Veuillez réessayer.";
            console.error(
              "[DEBUG] Erreur lors du démarrage de la fabrication:",
              errorMessage
            );
            showNotification(errorMessage, "error");
          } else {
            const data = await response.json();
            console.log("[DEBUG] Fabrication démarrée avec succès:", data);
            showNotification(
              `Fabrication de ${pieceCount} exemplaire${
                pieceCount > 1 ? "s" : ""
              } de "${pieceToManufacture.name}" démarrée avec succès!`,
              "success",
              5000
            );
          }
        } catch (error) {
          console.error(
            "[DEBUG] Erreur réseau lors du démarrage de la fabrication:",
            error
          );
          showNotification(
            "Erreur lors de la communication avec le serveur",
            "error"
          );
        }
      },
    });
  };

  // Fonction pour supprimer un fichier DXF du serveur
  const deleteDxfFileFromServer = async (
    filename: string
  ): Promise<boolean> => {
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
          method: "DELETE",
          headers: headers,
        }
      );

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ message: response.statusText }));
        const errorMessage =
          errorData.message ||
          `Impossible de supprimer le fichier '${filename}'.`;
        console.error(
          `[DEBUG] Erreur lors de la suppression du fichier DXF '${filename}':`,
          errorMessage
        );
        showNotification(errorMessage, "error");
        return false;
      }

      console.log(`[DEBUG] Fichier '${filename}' supprimé avec succès.`);
      return true; // Suppression réussie
    } catch (error) {
      const errorMessage = `Erreur réseau lors de la suppression du fichier '${filename}'.`;
      console.error(
        `[DEBUG] Erreur réseau lors de la suppression du fichier DXF '${filename}':`,
        error
      );
      showNotification(errorMessage, "error");
      return false; // Échec de la suppression
    }
  };

  // Fonction pour supprimer une pièce
  const handleDeletePiece = async (pieceIdToDelete: number) => {
    // Trouver la pièce à supprimer
    const pieceToDelete = pieces.find((p) => p.id === pieceIdToDelete);
    if (!pieceToDelete) {
      showNotification("Pièce introuvable", "error");
      return;
    }

    // Confirmer la suppression
    showConfirmationModal({
      title: "Supprimer la pièce",
      message: `Êtes-vous sûr de vouloir supprimer la pièce "${pieceToDelete.name}" ?`,
      confirmLabel: "Supprimer",
      cancelLabel: "Annuler",
      confirmButtonClassName: "btn btn-danger",
      onConfirmAction: async () => {
        // Si c'est la pièce actuellement sélectionnée, désélectionner
        if (selectedPiece === pieceIdToDelete) {
          setSelectedPiece(null);
          setCurrentDxfData(null);
        }

        // Supprimer le fichier du serveur
        const success = await deleteDxfFileFromServer(pieceToDelete.name);
        if (success) {
          // Mettre à jour l'état local en supprimant la pièce
          setPieces((prevPieces) =>
            prevPieces.filter((p) => p.id !== pieceIdToDelete)
          );
          showNotification(
            `Pièce "${pieceToDelete.name}" supprimée avec succès!`,
            "success"
          );
        }
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

  // Fonction pour fermer la notification
  const closeNotification = () => {
    setNotification(null);
  };

  // Fonction pour afficher un modal de confirmation
  const showConfirmationModal = (data: ConfirmationModalData) => {
    setConfirmationModalData(data);
    setIsConfirmationModalOpen(true);
  };

  // Fonction pour gérer la confirmation du modal
  const handleConfirm = async () => {
    setIsConfirmationModalOpen(false);
    if (confirmationModalData?.onConfirmAction) {
      await confirmationModalData.onConfirmAction();
    }
  };

  // Fonction pour gérer l'annulation du modal
  const handleCancel = async () => {
    setIsConfirmationModalOpen(false);
    if (confirmationModalData?.onCancelAction) {
      await confirmationModalData.onCancelAction();
    }
  };

  // Fonction pour gérer la déconnexion
  const handleLogout = () => {
    // Montrer un modal de confirmation pour la déconnexion
    showConfirmationModal({
      title: "Déconnexion",
      message: "Êtes-vous sûr de vouloir vous déconnecter ?",
      confirmLabel: "Déconnexion",
      cancelLabel: "Annuler",
      confirmButtonClassName: styles.logoutButton,
      onConfirmAction: () => {
        // Supprimer les informations d'authentification
        localStorage.removeItem("authToken");
        localStorage.removeItem("userData");

        // Rediriger vers la page d'authentification
        window.location.href = "/authentication";
      },
    });
  };

  // Rendu de la liste des pièces
  const renderPiecesList = () => {
    if (pieces.length === 0) {
      // Afficher un message si aucune pièce n'est disponible
      return (
        <div className={styles.emptyList}>
          <p>Aucune pièce disponible</p>
          <p>Importez une pièce pour commencer</p>
        </div>
      );
    }

    // Trier les pièces pour avoir les plus récentes en haut (en considérant que l'id contient un timestamp)
    const sortedPieces = [...pieces].sort((a, b) => b.id - a.id);

    return (
      <>
        {sortedPieces.map((piece) => (
          <button
            key={piece.id}
            className={`${styles.pieceButton} ${
              selectedPiece === piece.id ? styles.pieceButtonActive : ""
            }`}
            onClick={() => handleSelectPiece(piece.id)}
          >
            {piece.name}
            <button
              className={styles.deleteButton}
              onClick={(e) => {
                e.stopPropagation(); // Empêche le déclenchement du onClick du parent
                handleDeletePiece(piece.id);
              }}
              aria-label={`Supprimer ${piece.name}`}
            >
              ×
            </button>
          </button>
        ))}
      </>
    );
  };

  // Gestionnaires d'événements pour le drag and drop
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      handleFileImport(file);
    }
  };

  return (
    <AuthGuard>
      <Head>
        <title>Application de Découpe - Atelier des Composites</title>
      </Head>
      <div
        className={styles.pageContainer}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        ref={dropZoneRef}
      >
        {isDragging && (
          <div className={styles.dropOverlay}>
            <div className={styles.dropMessage}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
              </svg>
              <p>Déposez votre fichier DXF ici</p>
            </div>
          </div>
        )}
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <h1>Atelier des Composites</h1>
          </div>
          <div className={styles.headerRight}>
            <button
              className={styles.logoutButton}
              onClick={handleLogout}
              aria-label="Se déconnecter"
            >
              Se déconnecter
            </button>
          </div>
        </header>
        <div className={styles.mainAppContainer}>
          <aside className={styles.sidebarLeft}>
            <h2>Anciennes pièces</h2>
            <div className={styles.piecesList}>{renderPiecesList()}</div>
            <button
              className={styles.importButton}
              onClick={handleImportPiece}
              aria-label="Importer une nouvelle pièce"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
              </svg>
              <span>Importer</span>
            </button>
          </aside>
          <section className={styles.viewerSection}>
            <h2>Visualisation de pièce</h2>
            {currentDxfData ? (
              <DxfViewer dxfData={currentDxfData} />
            ) : (
              <div className={styles.viewerPlaceholder}>
                <p>Sélectionnez une pièce pour la visualiser</p>
              </div>
            )}
          </section>
          <aside className={styles.sidebarRight}>
            <h2>Paramètre de lancement</h2>
            <div className={styles.paramGroup}>
              <label htmlFor="pieceCount">Nombre de pièces :</label>
              <div className={styles.counterContainer}>
                <div className={styles.counterButtons}>
                  <button
                    className={styles.counterButton}
                    onClick={() => incrementPieceCount(-1)}
                    disabled={pieceCount <= 1}
                    aria-label="Diminuer le nombre de pièces"
                  >
                    -
                  </button>
                  <input
                    id="pieceCount"
                    type="number"
                    min="1"
                    value={pieceCount}
                    onChange={(e) =>
                      setPieceCount(Math.max(1, parseInt(e.target.value) || 1))
                    }
                    className={styles.paramInput}
                    aria-label="Nombre de pièces à fabriquer"
                  />
                  <button
                    className={styles.counterButton}
                    onClick={() => incrementPieceCount(1)}
                    aria-label="Augmenter le nombre de pièces"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
            <div className={styles.actionButtons}>
              <button
                className={styles.startButton}
                onClick={handleStartManufacture}
                disabled={selectedPiece === null}
                aria-label="Démarrer la fabrication"
              >
                Démarrer la fabrication
              </button>
            </div>
          </aside>
        </div>
        {notification && (
          <Notification
            message={notification.message}
            type={notification.type}
            duration={notification.duration}
            onClose={closeNotification}
          />
        )}
        {isConfirmationModalOpen && confirmationModalData && (
          <ConfirmationModal
            isOpen={isConfirmationModalOpen}
            title={confirmationModalData.title}
            message={confirmationModalData.message}
            confirmLabel={confirmationModalData.confirmLabel}
            cancelLabel={confirmationModalData.cancelLabel}
            confirmButtonClassName={
              confirmationModalData.confirmButtonClassName
            }
            onConfirm={handleConfirm}
            onCancel={handleCancel}
          />
        )}
      </div>
    </AuthGuard>
  );
};

export default MainPage;
