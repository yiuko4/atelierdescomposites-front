import React, { useEffect } from "react";
import styles from "../styles/Notification.module.css";

export interface NotificationProps {
  message: string;
  type: "success" | "error" | "info";
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
      <button onClick={onClose} className={styles.closeButton}>
        &times;
      </button>
    </div>
  );
};

export default Notification;
