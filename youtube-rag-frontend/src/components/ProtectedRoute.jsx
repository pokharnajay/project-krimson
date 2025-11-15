'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { authService } from '@/lib/auth';

export default function ProtectedRoute({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkAuth = () => {
      const isAuthenticated = authService.isAuthenticated();
      const isLoginPage = pathname === '/login';

      console.log('Path:', pathname);
      console.log('Is authenticated:', isAuthenticated);

      if (!isAuthenticated && !isLoginPage && pathname !== '/') {
        console.log('Not authenticated, redirecting to login');
        router.push('/login');
      } else if (isAuthenticated && isLoginPage) {
        console.log('Already authenticated, redirecting to dashboard');
        router.push('/dashboard');
      }

      setIsChecking(false);
    };

    checkAuth();
  }, [pathname, router]);

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return children;
}
