import React, { useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import styles from '../styles/Authentication.module.css';

const AuthenticationPage: React.FC = () => {
  const router = useRouter();
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = () => {
    // In a real application, you would validate credentials against a backend
    // This is a simple example for demonstration purposes
    if (login && password) {
      // Store auth token in localStorage
      localStorage.setItem('authToken', 'demo-token');
      // Redirect to main page
      router.push('/main');
    } else {
      setError('Please enter both login and password');
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
            >
              Connect
            </button>
          </div>
        </main>
      </div>
    </>
  );
};

export default AuthenticationPage;
