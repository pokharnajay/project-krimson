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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 px-4">
      <div className="bg-white/80 backdrop-blur-sm p-10 md:p-12 rounded-3xl shadow-2xl w-full max-w-md border border-gray-100 fade-in">
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-blue-500/30 animate-float">
            <span className="text-white font-bold text-3xl">Y</span>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">YouTube RAG</h1>
          <p className="text-gray-600">AI-Powered Video Q&A Assistant</p>
          <p className="text-sm text-gray-500 mt-1">Sign in to continue</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-5 py-4 rounded-xl text-sm fade-in flex items-start gap-3">
              <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-accent focus:ring-4 focus:ring-accent/10 outline-none transition-all duration-200 text-gray-900 placeholder-gray-400"
              placeholder="Enter your username"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-accent focus:ring-4 focus:ring-accent/10 outline-none transition-all duration-200 text-gray-900 placeholder-gray-400"
              placeholder="Enter your password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-accent hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-xl px-6 py-4 flex items-center justify-center gap-3 font-semibold text-lg transition-all duration-200 active:scale-[0.98] shadow-lg shadow-blue-500/30 disabled:shadow-none mt-8"
          >
            {isLoading && <Loader2 className="animate-spin" size={22} />}
            <span>{isLoading ? 'Signing in...' : 'Sign In'}</span>
          </button>
        </form>

        <div className="mt-8 p-5 bg-gradient-to-br from-gray-50 to-blue-50 border border-gray-200 rounded-xl">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">Test Credentials:</p>
              <div className="space-y-1">
                <p className="text-sm text-gray-600"><span className="font-medium">Username:</span> admin</p>
                <p className="text-sm text-gray-600"><span className="font-medium">Password:</span> admin123</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
