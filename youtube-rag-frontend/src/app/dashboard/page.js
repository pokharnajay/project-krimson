'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, RefreshCw } from 'lucide-react';
import Header from '@/components/Header';
import ChatSidebar from '@/components/ChatSidebar';
import SourceCard from '@/components/SourceCard';
import { transcriptAPI } from '@/lib/api';
import { authService } from '@/lib/auth';

export default function DashboardPage() {
  const router = useRouter();
  const [sources, setSources] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
    <div className="min-h-screen bg-white">
      <ChatSidebar
        isOpen={sidebarOpen}
        onToggle={setSidebarOpen}
        currentChatId={null}
      />

      <Header sidebarOpen={sidebarOpen} />

      <main className={`max-w-6xl mx-auto px-6 py-8 transition-all duration-300 ${
        sidebarOpen ? 'ml-80' : 'ml-12'
      }`}>
        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-medium text-claude-text">Your Sources</h1>
            <p className="text-sm text-claude-muted mt-1">
              Manage and chat with your video sources
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchSources()}
              className="px-4 py-2 text-sm text-claude-muted hover:text-claude-text border border-claude-border rounded-lg hover:bg-claude-bg transition-colors flex items-center gap-2"
            >
              <RefreshCw size={16} />
              <span>Refresh</span>
            </button>

            <button
              onClick={() => router.push('/add-source')}
              className="px-4 py-2 bg-accent hover:bg-accent/90 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
            >
              <Plus size={18} />
              <span>Add Source</span>
            </button>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="text-center py-20">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-claude-border border-t-accent mb-4"></div>
            <p className="text-sm text-claude-muted">Loading sources...</p>
          </div>
        ) : sources.length === 0 ? (
          <div className="text-center py-20">
            <div className="max-w-md mx-auto">
              <p className="text-lg text-claude-text mb-2">No sources yet</p>
              <p className="text-sm text-claude-muted mb-8">
                Add your first YouTube video or playlist to get started
              </p>
              <button
                onClick={() => router.push('/add-source')}
                className="px-6 py-2.5 bg-accent hover:bg-accent/90 text-white rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-2"
              >
                <Plus size={18} />
                Add Your First Source
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sources.map((source) => (
              <SourceCard key={source.id} source={source} onUpdate={fetchSources} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
