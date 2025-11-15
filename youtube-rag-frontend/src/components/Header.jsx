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
    <header className="bg-white/80 backdrop-blur-md border-b border-gray-200/50 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <button
            onClick={handleHome}
            className="flex items-center gap-3 group transition-all duration-200"
          >
            <div className="w-11 h-11 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-md group-hover:shadow-lg transition-all duration-200 group-hover:scale-105">
              <span className="text-white font-bold text-xl">Y</span>
            </div>
            <div className="hidden sm:block">
              <span className="text-xl font-bold text-gray-900 group-hover:text-accent transition-colors">
                YouTube RAG
              </span>
              <p className="text-xs text-gray-500 -mt-0.5">AI Video Assistant</p>
            </div>
          </button>

          {/* Right Section */}
          <div className="flex items-center gap-4">
            {/* Credits Badge */}
            <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-xl shadow-sm">
              <svg
                className="w-4 h-4 text-accent"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <span className="text-sm font-medium text-gray-700">
                <span className="hidden sm:inline text-gray-500">Credits: </span>
                <span className="font-bold text-accent">{credits}</span>
              </span>
            </div>

            {/* User Menu */}
            <div
              className="relative"
              onMouseEnter={() => setShowLogout(true)}
              onMouseLeave={() => setShowLogout(false)}
            >
              <button className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-semibold flex items-center justify-center hover:shadow-lg transition-all duration-200 hover:scale-105 shadow-md">
                {username.charAt(0).toUpperCase()}
              </button>

              {/* Logout Dropdown */}
              {showLogout && (
                <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden fade-in">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-sm font-semibold text-gray-900">{username}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Manage your account</p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full px-4 py-3 text-left flex items-center gap-3 text-red-600 hover:bg-red-50 transition-colors duration-150"
                  >
                    <LogOut size={18} />
                    <span className="text-sm font-medium">Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
