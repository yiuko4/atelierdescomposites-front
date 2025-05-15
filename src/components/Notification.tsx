import React, { useEffect } from "react";
import styles from "../styles/Notification.module.css";

export interface NotificationProps {
  message: string;
  type: "success" | "error" | "info" | "warning";
  onClose: () => void;
  duration?: number; // Durée en ms avant fermeture automatique
}

const Notification: React.FC<NotificationProps> = ({
  message,
  type,
  onClose,
  duration = 5000,
}) => {
  useEffect(() => {
    if (type !== "error" && duration) {
      // Les erreurs ne se ferment pas automatiquement par défaut
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [type, duration, onClose]);

  if (!message) {
    return null;
  }

  return (
    <div className={`${styles.notification} ${styles[type]}`}>
      <span className={styles.message}>{message}</span>
      <button
        onClick={onClose}
        className={styles.closeButton}
        aria-label="Fermer"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
  );
};

export default Notification;
