'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MessageSquare, Search, X, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { chatAPI } from '@/lib/api';

export default function ChatSidebar({ isOpen, onToggle, currentChatId }) {
  const router = useRouter();
  const [chats, setChats] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchChats();
    }
  }, [isOpen, searchQuery]);

  const fetchChats = async () => {
    setIsLoading(true);
    try {
      const response = await chatAPI.getChats(searchQuery);
      setChats(response.chats || []);
    } catch (error) {
      console.error('Failed to fetch chats:', error);
      setChats([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteChat = async (chatId, e) => {
    e.stopPropagation();
    if (!confirm('Delete this chat?')) return;

    try {
      await chatAPI.deleteChat(chatId);
      setChats(chats.filter(chat => chat.id !== chatId));

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

      {/* Permanent Vertical Bar */}
      <div className="fixed top-0 left-0 h-full w-12 bg-white border-r border-claude-border z-50 flex items-center justify-center">
        {/* Toggle Button with Tooltip */}
        <div className="relative">
          <button
            onClick={() => onToggle(!isOpen)}
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            className="p-2 hover:bg-claude-bg rounded-lg transition-colors group"
            aria-label={isOpen ? 'Close sidebar' : 'Open sidebar'}
          >
            {isOpen ? (
              <ChevronLeft size={20} className="text-claude-muted group-hover:text-claude-text transition-colors" />
            ) : (
              <ChevronRight size={20} className="text-claude-muted group-hover:text-claude-text transition-colors" />
            )}
          </button>

          {/* Tooltip */}
          {showTooltip && (
            <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap pointer-events-none z-50">
              {isOpen ? 'Close sidebar' : 'Open sidebar'}
              <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900"></div>
            </div>
          )}
        </div>
      </div>

      {/* Sidebar Content */}
      <div
        className={`fixed top-0 left-12 h-full bg-white border-r border-claude-border z-50 transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } w-80 flex flex-col`}
      >
        {/* Header */}
        <div className="h-14 border-b border-claude-border flex items-center px-4 flex-shrink-0">
          <div className="flex items-center gap-2">
            <MessageSquare size={18} className="text-claude-muted" />
            <span className="text-sm font-medium text-claude-text">Chat History</span>
          </div>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-claude-border flex-shrink-0">
          <div className="relative">
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
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-center text-sm text-claude-muted">
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-claude-border border-t-accent mb-2"></div>
              <p>Loading chats...</p>
            </div>
          ) : chats.length === 0 ? (
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
              {chats.map((chat) => (
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
    </>
  );
}
