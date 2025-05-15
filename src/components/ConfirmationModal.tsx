import React from "react";
import styles from "../styles/ConfirmationModal.module.css";

export interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  // La prop confirmButtonColor n'est plus nécessaire avec les modules CSS si le style est fixe
  // Si vous voulez la garder pour surcharger les styles, il faudra l'adapter
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = "Confirmer",
  cancelText = "Annuler",
}) => {
  // console.log('[TAILWIND MODAL] Rendu du modal Tailwind, isOpen:', isOpen); // TEMPORAIREMENT COMMENTÉ
  if (!isOpen) {
    return null;
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <h3 className={styles.title}>{title}</h3>
        <p className={styles.message}>{message}</p>
        <div className={styles.actions}>
          <button
            onClick={onCancel}
            className={`${styles.button} ${styles.cancelButton}`}
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`${styles.button} ${styles.confirmButton}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
