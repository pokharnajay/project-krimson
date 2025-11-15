'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { authService } from '@/lib/auth';
import { userAPI } from '@/lib/api';

export default function Header() {
  const router = useRouter();
  const [username, setUsername] = useState('User');
  const [credits, setCredits] = useState(0);
  const [showLogout, setShowLogout] = useState(false);

  useEffect(() => {
    fetchCredits();
    const interval = setInterval(fetchCredits, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const fetchCredits = async () => {
    try {
      const response = await userAPI.getCredits();
      console.log('Credits response:', response);

      // API returns { credits: number }
      setCredits(response.credits || 0);

      // Get username from auth service
      const user = authService.getUser();
      if (user) {
        setUsername(user.username || 'User');
      }
    } catch (error) {
      console.error('Failed to fetch credits:', error);
    }
  };

  const handleLogout = () => {
    authService.clearTokens();
    router.push('/login');
  };

  const handleHome = () => {
    router.push('/dashboard');
  };

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <button 
          onClick={handleHome}
          className="flex items-center gap-3 hover:opacity-80 transition-opacity"
        >
          <div className="w-10 h-10 bg-accent rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-xl">Y</span>
          </div>
          <span className="text-xl font-semibold text-gray-900">YouTube RAG</span>
        </button>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg">
            <span className="text-sm text-gray-600">Credits:</span>
            <span className="font-semibold text-accent">{credits}</span>
          </div>

          <div 
            className="relative"
            onMouseEnter={() => setShowLogout(true)}
            onMouseLeave={() => setShowLogout(false)}
          >
            <button className="w-11 h-11 rounded-full bg-accent text-white font-medium flex items-center justify-center hover:bg-blue-600 transition-colors">
              {username.charAt(0).toUpperCase()}
            </button>

            {showLogout && (
              <button
                onClick={handleLogout}
                className="absolute top-0 left-0 w-11 h-11 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors"
              >
                <LogOut size={20} />
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
