import Head from "next/head";
import { useRouter } from "next/router";
import React, { useState } from "react";
import styles from "../styles/Authentication.module.css";

const API_URL = "http://localhost:30001";

const AuthenticationPage: React.FC = () => {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
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

  return (
    <>
      <Head>
        <title>Authentification</title>
      </Head>
      <div className={styles.pageContainer}>
        <header className={styles.header}>
          <h1>Authentification</h1>
        </header>
        <main className={styles.authContainer}>
          <div className={styles.authForm}>
            {error && <div className={styles.errorMessage}>{error}</div>}
            <input
              type="text"
              placeholder="Login"
              aria-label="Login"
              className={styles.inputField}
              value={login}
              onChange={(e) => setLogin(e.target.value)}
            />
            <input
              type="password"
              placeholder="Password"
              aria-label="Password"
              className={styles.inputField}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              className={styles.connectButton}
              onClick={handleLogin}
              disabled={isLoading}
            >
              {isLoading ? "Connexion..." : "Se connecter"}
            </button>
          </div>
        </main>
      </div>
    </>
  );
};

export default AuthenticationPage;
