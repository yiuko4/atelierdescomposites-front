import { useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/router';

interface AuthGuardProps {
  children: ReactNode;
}

const AuthGuard = ({ children }: AuthGuardProps) => {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user is authenticated
    // This is a simple example - in a real app, you would check a token in localStorage,
    // or make an API call to validate the session
    const checkAuth = () => {
      const token = localStorage.getItem('authToken');
      if (!token) {
        router.replace('/authentication');
      } else {
        setIsAuthenticated(true);
      }
      setIsLoading(false);
    };

    checkAuth();
  }, [router]);

  // Show nothing while checking authentication
  if (isLoading) {
    return <div>Loading...</div>;
  }

  // If authenticated, show the protected content
  return isAuthenticated ? <>{children}</> : null;
};

export default AuthGuard;
