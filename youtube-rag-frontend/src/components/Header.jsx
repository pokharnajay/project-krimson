'use client';

import { useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { authService } from '@/lib/auth';
import { userAPI } from '@/lib/api';

const Header = forwardRef(({ sourceTitle }, ref) => {
  const router = useRouter();
  const [username, setUsername] = useState('User');
  const [credits, setCredits] = useState(0);
  const [showLogout, setShowLogout] = useState(false);
  const [hideTimeout, setHideTimeout] = useState(null);

  useEffect(() => {
    fetchCredits();
    const interval = setInterval(fetchCredits, 60000); // Refresh every 60s (1 minute)
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

  // Expose updateCredits method to parent components via ref
  useImperativeHandle(ref, () => ({
    updateCredits: (newCredits) => {
      setCredits(newCredits);
    },
    refreshCredits: fetchCredits
  }));

  const handleLogout = () => {
    authService.clearTokens();
    router.push('/login');
  };

  const handleHome = () => {
    router.push('/dashboard');
  };

  const handleMouseEnter = () => {
    if (hideTimeout) {
      clearTimeout(hideTimeout);
      setHideTimeout(null);
    }
    setShowLogout(true);
  };

  const handleMouseLeave = () => {
    const timeout = setTimeout(() => {
      setShowLogout(false);
    }, 300); // Keep visible for 300ms after mouse leaves
    setHideTimeout(timeout);
  };

  return (
    <header className="border-b border-claude-border bg-white sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        {/* Logo */}
        <button
          onClick={handleHome}
          className="text-claude-text hover:text-primary transition-colors font-medium text-sm"
        >
          YouTube RAG
        </button>

        {/* Source Title (center) */}
        {sourceTitle && (
          <div className="flex-1 px-8 text-center">
            <p className="text-sm text-claude-muted truncate max-w-md mx-auto" title={sourceTitle}>
              {sourceTitle}
            </p>
          </div>
        )}

        {/* Right Section */}
        <div className="flex items-center gap-4">
          {/* Credits */}
          <div className="flex items-center gap-2 text-sm text-claude-muted">
            <span>Credits:</span>
            <span className="text-claude-text font-medium">{credits}</span>
          </div>

          {/* User Menu */}
          <div
            className="relative"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <button className="w-8 h-8 rounded-full bg-claude-bg text-claude-text font-medium flex items-center justify-center hover:bg-claude-border transition-colors text-sm">
              {username.charAt(0).toUpperCase()}
            </button>

            {/* Logout Dropdown */}
            {showLogout && (
              <div className="absolute top-full right-0 mt-2 w-40 bg-white border border-claude-border rounded-lg shadow-lg overflow-hidden">
                <div className="px-3 py-2 border-b border-claude-border">
                  <p className="text-xs text-claude-text font-medium">{username}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full px-3 py-2 text-left flex items-center gap-2 text-red-600 hover:bg-red-50 transition-colors text-sm"
                >
                  <LogOut size={14} />
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
});

Header.displayName = 'Header';

export default Header;
