import React from 'react';
import Head from 'next/head';
import styles from '../styles/Main.module.css';
import AuthGuard from '../components/AuthGuard';

const MainPage: React.FC = () => {
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
            <button className={styles.pieceButton}>Pièce 1</button>
            <button className={styles.pieceButton}>Pièce 2</button>
            <button className={styles.pieceButton}>Pièce 3</button>
            <button className={styles.pieceButton}>Pièce 4</button>
            <button className={styles.importButton}>IMPORTER UNE PIECE</button>
          </aside>
          <main className={styles.viewerSection}>
            <h2>Viewer</h2>
            <div className={styles.viewerPlaceholder}>
              {/* Viewer content will go here */}
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
