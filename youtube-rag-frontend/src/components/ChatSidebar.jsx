'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { MessageSquare, Search, X, Trash2, PanelRightOpen, PanelRight } from 'lucide-react';
import { useChatMetadataStore } from '@/lib/store';
import { authService } from '@/lib/auth';
import { deleteChat } from '@/lib/supabase';

export default function ChatSidebar({ isOpen, onToggle, currentChatId }) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');

  // Use Zustand store for chat metadata (cached)
  const { chatList, isLoading, fetchChatMetadata, deleteChat: deleteChatFromStore, searchChats } = useChatMetadataStore();

  // Fetch chat metadata once when component mounts
  useEffect(() => {
    fetchChatMetadata(); // Will use cache if recently fetched
  }, [fetchChatMetadata]);

  // Client-side search filtering
  const filteredChats = useMemo(() => {
    return searchChats(searchQuery);
  }, [searchQuery, chatList, searchChats]);

  const handleDeleteChat = async (chatId, e) => {
    e.stopPropagation();
    if (!confirm('Delete this chat?')) return;

    try {
      const user = authService.getUser();
      if (!user || !user.id) {
        throw new Error('User not authenticated');
      }

      // Delete from Supabase directly
      await deleteChat(chatId, user.id);
      deleteChatFromStore(chatId); // Update store

      // If currently viewing the deleted chat, redirect to dashboard
      if (currentChatId === chatId) {
        router.push('/dashboard');
      }
    } catch (error) {
      console.error('Failed to delete chat:', error);
      alert('Failed to delete chat. Please try again.');
    }
  };

  const handleChatClick = (chatId) => {
    router.push(`/chat/${chatId}`);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

    if (diffInDays === 0) return 'Today';
    if (diffInDays === 1) return 'Yesterday';
    if (diffInDays < 7) return `${diffInDays} days ago`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-40 lg:hidden"
          onClick={() => onToggle(false)}
        />
      )}

      {/* Sidebar with smooth width transition */}
      <div className={`fixed top-14 left-0 h-[calc(100vh-3.5rem)] bg-white border-r border-claude-border z-40 flex flex-col transition-all duration-300 ${
        isOpen ? 'w-80' : 'w-12'
      }`}>
        {/* Open Button - Only visible when closed */}
        {!isOpen && (
          <div className="flex flex-col items-center pt-4">
            <button
              onClick={() => onToggle(true)}
              className="p-2 hover:bg-claude-bg rounded-lg transition-colors group relative"
              aria-label="Open sidebar"
            >
              <PanelRight size={20} className="text-claude-muted group-hover:text-claude-text transition-colors" />

              {/* Tooltip */}
              <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap pointer-events-none z-50 opacity-0 group-hover:opacity-100 transition-opacity">
                Open sidebar
                <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900"></div>
              </div>
            </button>
          </div>
        )}

        {/* Sidebar Content - Only visible when open */}
        {isOpen && (
          <div className="flex flex-col h-full">
          {/* Search with Close Button */}
          <div className="p-3 border-b border-claude-border flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-claude-muted" />
                <input
                  type="text"
                  placeholder="Search chats..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 text-sm border border-claude-border rounded-lg focus:outline-none focus:border-accent transition-colors"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-claude-bg rounded"
                    aria-label="Clear search"
                  >
                    <X size={14} className="text-claude-muted" />
                  </button>
                )}
              </div>

              {/* Close Sidebar Button */}
              <button
                onClick={() => onToggle(false)}
                className="p-2 hover:bg-claude-bg rounded-lg transition-colors group relative flex-shrink-0"
                aria-label="Close sidebar"
              >
                <PanelRightOpen size={18} className="text-claude-muted group-hover:text-claude-text transition-colors" />

                {/* Tooltip */}
                <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap pointer-events-none z-50 opacity-0 group-hover:opacity-100 transition-opacity">
                  Close sidebar
                  <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900"></div>
                </div>
              </button>
            </div>
          </div>

          {/* Chat List */}
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="p-4 text-center text-sm text-claude-muted">
                <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-claude-border border-t-accent mb-2"></div>
                <p>Loading chats...</p>
              </div>
            ) : filteredChats.length === 0 ? (
              <div className="p-4 text-center text-sm text-claude-muted">
                {searchQuery ? (
                  <div>
                    <p className="mb-1">No chats found</p>
                    <p className="text-xs">Try a different search term</p>
                  </div>
                ) : (
                  <div>
                    <MessageSquare size={32} className="mx-auto mb-2 opacity-30" />
                    <p className="mb-1">No chats yet</p>
                    <p className="text-xs">Start a conversation with a source</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-1">
                {filteredChats.map((chat) => (
                  <button
                    key={chat.id}
                    onClick={() => handleChatClick(chat.id)}
                    className={`w-full px-4 py-3 hover:bg-claude-bg transition-colors flex items-start justify-between group text-left ${
                      currentChatId === chat.id ? 'bg-claude-bg border-l-2 border-l-accent' : ''
                    }`}
                  >
                    <div className="flex-1 min-w-0 pr-2">
                      <p
                        className="text-sm text-claude-text truncate mb-1 font-medium"
                        title={chat.title}
                      >
                        {chat.title}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-claude-muted">
                        <span>{formatDate(chat.updated_at)}</span>
                        {chat.sources && chat.sources.title && (
                          <>
                            <span>•</span>
                            <span className="truncate" title={chat.sources.title}>
                              {chat.sources.title}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={(e) => handleDeleteChat(chat.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-50 rounded transition-all flex-shrink-0"
                      aria-label="Delete chat"
                    >
                      <Trash2 size={14} className="text-red-600" />
                    </button>
                  </button>
                ))}
              </div>
            )}
          </div>
          </div>
        )}
      </div>
    </>
  );
}
