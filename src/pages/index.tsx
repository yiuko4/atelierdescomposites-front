import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/authentication');
  }, [router]);

  return null; // No UI needed as we're redirecting
}
