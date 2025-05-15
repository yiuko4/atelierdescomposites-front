import React from 'react';
import Head from 'next/head';
import styles from '../styles/Main.module.css';
import AuthGuard from '../components/AuthGuard';
//import dynamic from 'next/dynamic';

const MainPage: React.FC = () => {
  // État pour stocker les pièces disponibles
  const [pieces, setPieces] = React.useState([
    { id: 1, name: 'Pièce 1' },
    { id: 2, name: 'Pièce 2' },
    { id: 3, name: 'Pièce 3' },
    { id: 4, name: 'Pièce 4' }
  ]);
  
  // État pour stocker la pièce sélectionnée
  const [selectedPiece, setSelectedPiece] = React.useState<number | null>(null);
  
  // Fonction pour gérer l'importation d'une nouvelle pièce
  const handleImportPiece = () => {
    // Créer un input de type file invisible
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.dxf,.stl,.obj';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);

    // Gérer l'événement de changement de fichier
    fileInput.onchange = async (event) => {
      const target = event.target as HTMLInputElement;
      const files = target.files;
      
      if (files && files.length > 0) {
        const file = files[0];
        try {
          // Simuler l'importation d'une nouvelle pièce
          const newPiece = {
            id: pieces.length + 1,
            name: file.name.split('.')[0] // Utiliser le nom du fichier sans l'extension
          };
          
          // Ajouter la nouvelle pièce à la liste
          setPieces([...pieces, newPiece]);
          
          // Sélectionner la nouvelle pièce
          setSelectedPiece(newPiece.id);
          
          alert(`Pièce "${newPiece.name}" importée avec succès!`);
          
        } catch (error) {
          console.error('Error importing piece:', error);
          alert('Erreur lors de l\'importation de la pièce. Veuillez vérifier le format du fichier.');
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
            {pieces.map(piece => (
              <button 
                key={piece.id}
                className={`${styles.pieceButton} ${selectedPiece === piece.id ? styles.pieceButtonActive : ''}`}
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
            <div className={styles.viewerPlaceholder}>
              <Viewer />
            </div>
          </main>
          <aside className={styles.sidebarRight}>
            <h2>Paramètre de lancement</h2>
            <div className={styles.paramGroup}>
              <label htmlFor="piece-num">N° de piece :</label>
              <input type="text" id="piece-num" name="piece-num" className={styles.paramInput} />
            </div>
            <div className={styles.paramGroup}>
              <label htmlFor="temps">Temps :</label>
              <input type="text" id="temps" name="temps" className={styles.paramInput} />
            </div>
            <div className={styles.paramGroup}>
              <label htmlFor="metrage">Metrage :</label>
              <input type="text" id="metrage" name="metrage" className={styles.paramInput} />
            </div>
            <div className={styles.paramGroup}>
              <label htmlFor="prix-matiere">Prix matière :</label>
              <input type="text" id="prix-matiere" name="prix-matiere" className={styles.paramInput} />
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
