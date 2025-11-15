'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, RefreshCw } from 'lucide-react';
import Header from '@/components/Header';
import SourceCard from '@/components/SourceCard';
import { transcriptAPI } from '@/lib/api';
import { authService } from '@/lib/auth';

export default function DashboardPage() {
  const router = useRouter();
  const [sources, setSources] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Double check authentication
    if (!authService.isAuthenticated()) {
      console.log('Not authenticated in dashboard, redirecting');
      router.push('/login');
      return;
    }

    fetchSources();
    
    const interval = setInterval(() => {
      fetchSources(true);
    }, 8000);
    
    return () => clearInterval(interval);
  }, [router]);

  const fetchSources = async (silent = false) => {
    if (!silent) setIsLoading(true);

    try {
      const response = await transcriptAPI.getAllSources();
      console.log('Fetch sources response:', response);

      // API returns { sources: [...], pagination: {...} }
      setSources(response.sources || []);
    } catch (error) {
      console.error('Failed to fetch sources:', error);
      setSources([]);
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50/30">
      <Header />

      <main className="max-w-7xl mx-auto px-6 py-10">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-10">
          <div className="fade-in">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Dashboard</h1>
            <p className="text-gray-600">
              Manage and chat with your video sources
            </p>
          </div>

          <div className="flex items-center gap-3 fade-in">
            <button
              onClick={() => fetchSources()}
              className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 hover:border-gray-300 rounded-xl px-5 py-2.5 flex items-center gap-2 font-medium transition-all duration-200 active:scale-95 shadow-sm"
            >
              <RefreshCw size={18} />
              <span>Refresh</span>
            </button>

            <button
              onClick={() => router.push('/add-source')}
              className="bg-accent hover:bg-blue-600 text-white rounded-xl px-6 py-2.5 flex items-center gap-2 font-medium transition-all duration-200 active:scale-95 shadow-lg shadow-blue-500/30"
            >
              <Plus size={20} />
              <span>Add Source</span>
            </button>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="text-center py-20 fade-in">
            <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-gray-200 border-t-accent mb-6"></div>
            <p className="text-gray-500 font-medium">Loading your sources...</p>
          </div>
        ) : sources.length === 0 ? (
          <div className="text-center py-20 fade-in">
            <div className="max-w-lg mx-auto">
              <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-blue-500/30">
                <Plus className="text-white" size={48} />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">No sources yet</h3>
              <p className="text-gray-600 mb-8 leading-relaxed">
                Get started by adding your first YouTube video or playlist.<br />
                I'll process the transcripts and you can start asking questions!
              </p>
              <button
                onClick={() => router.push('/add-source')}
                className="bg-accent hover:bg-blue-600 text-white rounded-xl px-8 py-3 font-semibold transition-all duration-200 active:scale-95 shadow-lg shadow-blue-500/30"
              >
                Add Your First Source
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sources.map((source, index) => (
              <div
                key={source.id}
                className="fade-in"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <SourceCard source={source} onUpdate={fetchSources} />
              </div>
            ))}
          </div>
        )}

        {/* Stats Section - Optional */}
        {sources.length > 0 && (
          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 fade-in">
            <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
                  <Video className="text-accent" size={24} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Sources</p>
                  <p className="text-2xl font-bold text-gray-900">{sources.length}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center">
                  <RefreshCw className="text-green-600" size={24} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Ready to Chat</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {sources.filter(s => s.status === 'ready').length}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-yellow-50 rounded-lg flex items-center justify-center">
                  <RefreshCw className="text-yellow-600 animate-pulse" size={24} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Processing</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {sources.filter(s => s.status === 'processing').length}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
