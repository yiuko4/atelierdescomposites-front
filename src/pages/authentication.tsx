import Head from "next/head";
import { useRouter } from "next/router";
import React, { useEffect, useState } from "react";
import styles from "../styles/Authentication.module.css";

const API_URL = "http://localhost:30001";

const AuthenticationPage: React.FC = () => {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Vérifier si l'utilisateur est déjà connecté
  useEffect(() => {
    const token = localStorage.getItem("authToken");
    if (token) {
      router.push("/main");
    }
  }, [router]);

  const handleLogin = async (e?: React.FormEvent) => {
    // Empêcher le comportement par défaut du formulaire
    if (e) e.preventDefault();

    // Reset error state
    setError("");

    // Validate inputs
    if (!login || !password) {
      setError("Veuillez saisir votre identifiant et mot de passe");
      return;
    }

    setIsLoading(true);

    try {
      // Call the API endpoint for authentication
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: login,
          password: password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle authentication error
        throw new Error(data.message || "Échec de l'authentification");
      }

      // Store the JWT token and user info in localStorage
      localStorage.setItem("authToken", data.token);
      localStorage.setItem(
        "userData",
        JSON.stringify({
          id: data.user.id,
          username: data.user.username,
          role: data.user.role,
        })
      );

      // Redirect to main page
      router.push("/main");
    } catch (err) {
      console.error("Login error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Une erreur est survenue lors de la connexion"
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Gérer la touche Enter
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleLogin();
    }
  };

  return (
    <>
      <Head>
        <title>Authentification - Atelier des Composites</title>
      </Head>
      <div className={styles.pageContainer}>
        <header className={styles.header}>
          <h1>Atelier des Composites</h1>
        </header>
        <main className={styles.authContainer}>
          <form className={styles.authForm} onSubmit={handleLogin}>
            <h2 className={styles.formTitle}>Connexion</h2>
            <p className={styles.formSubtitle}>
              Veuillez vous connecter pour accéder à l'application
            </p>

            {error && <div className={styles.errorMessage}>{error}</div>}

            <div>
              <input
                type="text"
                placeholder="Identifiant"
                aria-label="Identifiant"
                className={styles.inputField}
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                onKeyDown={handleKeyDown}
                autoFocus
              />
            </div>

            <div>
              <input
                type="password"
                placeholder="Mot de passe"
                aria-label="Mot de passe"
                className={styles.inputField}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
              />
            </div>

            <button
              className={styles.connectButton}
              type="submit"
              disabled={isLoading}
            >
              {isLoading ? "Connexion en cours..." : "Se connecter"}
            </button>
          </form>
        </main>
      </div>
    </>
  );
};

export default AuthenticationPage;
