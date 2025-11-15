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
      setSources(response.data.sources || []);
    } catch (error) {
      console.error('Failed to fetch sources:', error);
      
      // Mock data for testing
      setSources([
        {
          id: 'source_1',
          video_ids: ['dQw4w9WgXcQ'],
          status: 'ready',
          created_at: new Date().toISOString(),
          title: 'Sample Video 1',
        },
        {
          id: 'source_2',
          video_ids: ['dQw4w9WgXcQ', 'jNQXAC9IVRw'],
          status: 'processing',
          created_at: new Date().toISOString(),
          title: 'Sample Playlist',
        },
      ]);
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-500 mt-1">Manage your video sources</p>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => fetchSources()}
              className="btn-secondary flex items-center gap-2"
            >
              <RefreshCw size={18} />
              Refresh
            </button>
            
            <button
              onClick={() => router.push('/add-source')}
              className="btn-primary flex items-center gap-2"
            >
              <Plus size={20} />
              Add Source
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto mb-4"></div>
            <p className="text-gray-400">Loading sources...</p>
          </div>
        ) : sources.length === 0 ? (
          <div className="text-center py-12">
            <div className="max-w-md mx-auto">
              <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Plus className="text-gray-400" size={40} />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No sources yet</h3>
              <p className="text-gray-500 mb-6">
                Add your first YouTube video or playlist to get started
              </p>
              <button
                onClick={() => router.push('/add-source')}
                className="btn-primary"
              >
                Add Your First Source
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sources.map((source) => (
                <SourceCard 
                key={source.id} 
                source={source}
                onUpdate={fetchSources}  // Refresh sources after update
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
