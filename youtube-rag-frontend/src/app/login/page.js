'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { authAPI, userAPI } from '@/lib/api';
import { authService } from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Check if already logged in
    if (authService.isAuthenticated()) {
      console.log('Already authenticated, redirecting to dashboard');
      router.push('/dashboard');
    }
  }, [router]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    console.log('Login attempt:', { username });

    try {
      const data = await authAPI.login(username, password);
      console.log('Login successful');

      // Store tokens
      authService.setTokens(data);
      authService.initializeAutoRefresh();

      // Fetch and store user profile
      try {
        const profile = await userAPI.getProfile();
        authService.setUser(profile);
        console.log('User profile stored:', profile);
      } catch (profileErr) {
        console.error('Failed to fetch profile:', profileErr);
        // Continue anyway, profile will be fetched by components
      }

      console.log('Redirecting to dashboard...');

      // Force hard redirect
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 100);

    } catch (err) {
      console.error('Login error:', err);
      const errorMessage = err.response?.data?.message || err.response?.data?.error || 'Login failed. Please check your credentials.';
      setError(errorMessage);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-claude-bg px-4">
      <div className="w-full max-w-md">
        <div className="bg-white border border-claude-border rounded-lg p-8 shadow-sm">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-medium text-claude-text mb-2">YouTube RAG</h1>
            <p className="text-sm text-claude-muted">Sign in to continue</p>
          </div>

        <form onSubmit={handleLogin} className="space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-claude-text mb-2">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-2.5 border border-claude-border rounded-lg focus:outline-none focus:border-accent transition-colors text-claude-text text-sm"
              placeholder="Enter your username"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-claude-text mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 border border-claude-border rounded-lg focus:outline-none focus:border-accent transition-colors text-claude-text text-sm"
              placeholder="Enter your password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full px-4 py-2.5 bg-accent hover:bg-accent/90 disabled:bg-claude-border disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
          >
            {isLoading && <Loader2 className="animate-spin" size={16} />}
            <span>{isLoading ? 'Signing in...' : 'Sign In'}</span>
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-claude-border">
          <p className="text-xs text-claude-muted text-center mb-2">Test Credentials:</p>
          <div className="text-xs text-center space-y-1">
            <p className="text-claude-text"><span className="text-claude-muted">Username:</span> admin</p>
            <p className="text-claude-text"><span className="text-claude-muted">Password:</span> admin123</p>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
