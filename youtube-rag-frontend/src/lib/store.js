/**
 * Global State Management with Zustand
 * Manages user, sources, and app state
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { userAPI, transcriptAPI } from './api';
import { authService } from './auth';

/**
 * User Store - Manages user authentication and profile
 */
export const useUserStore = create(
  devtools(
    (set, get) => ({
      // State
      user: null,
      credits: null,
      isLoading: false,
      error: null,

      // Actions
      setUser: (user) => set({ user }),

      setCredits: (credits) => set({ credits }),

      /**
       * Fetch user profile
       */
      fetchProfile: async () => {
        set({ isLoading: true, error: null });
        try {
          const profile = await userAPI.getProfile();
          set({ user: profile, credits: profile.credits, isLoading: false });
          authService.setUser(profile);
          return profile;
        } catch (error) {
          set({ error: error.message, isLoading: false });
          throw error;
        }
      },

      /**
       * Fetch user credits
       */
      fetchCredits: async () => {
        try {
          const data = await userAPI.getCredits();
          set({ credits: data.credits });
          return data.credits;
        } catch (error) {
          console.error('Failed to fetch credits:', error);
          throw error;
        }
      },

      /**
       * Update credits locally (optimistic update)
       */
      updateCredits: (delta) => {
        const currentCredits = get().credits;
        if (currentCredits !== null) {
          set({ credits: Math.max(0, currentCredits + delta) });
        }
      },

      /**
       * Clear user data
       */
      clearUser: () => set({ user: null, credits: null, error: null }),
    }),
    { name: 'user-store' }
  )
);

/**
 * Sources Store - Manages video sources and transcripts
 */
export const useSourcesStore = create(
  devtools(
    (set, get) => ({
      // State
      sources: [],
      currentSource: null,
      pagination: {
        page: 1,
        limit: 20,
        total: 0,
        pages: 0,
      },
      isLoading: false,
      error: null,

      // Actions
      /**
       * Fetch all sources with pagination
       */
      fetchSources: async (page = 1, limit = 20) => {
        set({ isLoading: true, error: null });
        try {
          const data = await transcriptAPI.getAllSources(page, limit);
          set({
            sources: data.sources || [],
            pagination: data.pagination || { page, limit, total: 0, pages: 0 },
            isLoading: false,
          });
          return data;
        } catch (error) {
          set({ error: error.message, isLoading: false });
          throw error;
        }
      },

      /**
       * Fetch a specific source
       */
      fetchSource: async (sourceId) => {
        set({ isLoading: true, error: null });
        try {
          const source = await transcriptAPI.getSource(sourceId);
          set({ currentSource: source, isLoading: false });
          return source;
        } catch (error) {
          set({ error: error.message, isLoading: false });
          throw error;
        }
      },

      /**
       * Add a new source (optimistic update)
       */
      addSource: (source) => {
        const sources = get().sources;
        set({ sources: [source, ...sources] });
      },

      /**
       * Update source status locally
       */
      updateSourceStatus: (sourceId, status) => {
        const sources = get().sources.map((source) =>
          source.id === sourceId ? { ...source, status } : source
        );
        set({ sources });
      },

      /**
       * Delete a source
       */
      deleteSource: async (sourceId) => {
        try {
          await transcriptAPI.deleteSource(sourceId);

          // Remove from sources list
          const sources = get().sources.filter((s) => s.id !== sourceId);
          set({ sources });

          return true;
        } catch (error) {
          console.error('Failed to delete source:', error);
          throw error;
        }
      },

      /**
       * Retry processing a failed source
       */
      retrySource: async (sourceId) => {
        try {
          // Update status to processing optimistically
          get().updateSourceStatus(sourceId, 'processing');

          const result = await transcriptAPI.retrySource(sourceId);

          // Update status based on result
          const newStatus = result.errors?.length > 0 ? 'failed' : 'ready';
          get().updateSourceStatus(sourceId, newStatus);

          return result;
        } catch (error) {
          // Revert to failed status
          get().updateSourceStatus(sourceId, 'failed');
          throw error;
        }
      },

      /**
       * Refresh sources (useful for polling)
       */
      refreshSources: async () => {
        const { page, limit } = get().pagination;
        await get().fetchSources(page, limit);
      },

      /**
       * Set current page
       */
      setPage: (page) => {
        set((state) => ({
          pagination: { ...state.pagination, page },
        }));
      },

      /**
       * Clear sources
       */
      clearSources: () => set({ sources: [], currentSource: null, error: null }),
    }),
    { name: 'sources-store' }
  )
);

/**
 * Chat Store - Manages chat messages and queries
 */
export const useChatStore = create(
  devtools(
    persist(
      (set, get) => ({
        // State
        chats: {}, // { sourceId: { messages: [], isLoading: false } }

        // Actions
        /**
         * Initialize chat for a source
         */
        initializeChat: (sourceId) => {
          const chats = get().chats;
          if (!chats[sourceId]) {
            set({
              chats: {
                ...chats,
                [sourceId]: {
                  messages: [],
                  isLoading: false,
                },
              },
            });
          }
        },

        /**
         * Add a message to chat
         */
        addMessage: (sourceId, message) => {
          const chats = get().chats;
          const chat = chats[sourceId] || { messages: [], isLoading: false };

          set({
            chats: {
              ...chats,
              [sourceId]: {
                ...chat,
                messages: [...chat.messages, message],
              },
            },
          });
        },

        /**
         * Set loading state for a chat
         */
        setChatLoading: (sourceId, isLoading) => {
          const chats = get().chats;
          const chat = chats[sourceId] || { messages: [], isLoading: false };

          set({
            chats: {
              ...chats,
              [sourceId]: {
                ...chat,
                isLoading,
              },
            },
          });
        },

        /**
         * Clear chat messages for a source
         */
        clearChat: (sourceId) => {
          const chats = get().chats;
          delete chats[sourceId];
          set({ chats: { ...chats } });
        },

        /**
         * Clear all chats
         */
        clearAllChats: () => set({ chats: {} }),

        /**
         * Get chat for a source
         */
        getChat: (sourceId) => {
          return get().chats[sourceId] || { messages: [], isLoading: false };
        },
      }),
      {
        name: 'chat-storage', // persist chat in localStorage
        partialize: (state) => ({ chats: state.chats }), // only persist chats
      }
    ),
    { name: 'chat-store' }
  )
);

/**
 * Chat Metadata Store - Manages chat history metadata (list of chats)
 * Separate from useChatStore which manages message content
 */
export const useChatMetadataStore = create(
  devtools(
    (set, get) => ({
      // State
      chatList: [], // Array of chat metadata {id, title, updated_at, source_id, sources}
      isLoading: false,
      error: null,
      lastFetched: null, // Timestamp of last fetch

      // Actions
      /**
       * Fetch chat metadata from backend
       * Uses caching - only refetches if explicitly requested or stale
       */
      fetchChatMetadata: async (forceRefresh = false) => {
        const { lastFetched } = get();
        const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

        // Skip fetch if recently fetched (unless forced)
        if (!forceRefresh && lastFetched && Date.now() - lastFetched < CACHE_DURATION) {
          return get().chatList;
        }

        set({ isLoading: true, error: null });
        try {
          const { chatAPI } = await import('./api');
          const response = await chatAPI.getChats();
          set({
            chatList: response.chats || [],
            isLoading: false,
            lastFetched: Date.now(),
          });
          return response.chats || [];
        } catch (error) {
          console.error('Failed to fetch chat metadata:', error);
          set({ error: error.message, isLoading: false });
          throw error;
        }
      },

      /**
       * Add a new chat to the list (optimistic update)
       */
      addChat: (chat) => {
        const chatList = get().chatList;
        set({ chatList: [chat, ...chatList] });
      },

      /**
       * Delete a chat from the list
       */
      deleteChat: (chatId) => {
        const chatList = get().chatList.filter((chat) => chat.id !== chatId);
        set({ chatList });
      },

      /**
       * Update chat title or metadata
       */
      updateChat: (chatId, updates) => {
        const chatList = get().chatList.map((chat) =>
          chat.id === chatId ? { ...chat, ...updates } : chat
        );
        set({ chatList });
      },

      /**
       * Search chats by title (client-side filtering)
       */
      searchChats: (query) => {
        if (!query || !query.trim()) {
          return get().chatList;
        }

        const lowerQuery = query.toLowerCase();
        return get().chatList.filter((chat) =>
          chat.title.toLowerCase().includes(lowerQuery) ||
          (chat.sources?.title && chat.sources.title.toLowerCase().includes(lowerQuery))
        );
      },

      /**
       * Clear chat metadata
       */
      clearChatMetadata: () => set({ chatList: [], error: null, lastFetched: null }),
    }),
    { name: 'chat-metadata-store' }
  )
);

/**
 * App Store - Manages global app state and UI
 */
export const useAppStore = create(
  devtools(
    (set) => ({
      // State
      isInitialized: false,
      isSidebarOpen: true,
      toast: null,

      // Actions
      setInitialized: (isInitialized) => set({ isInitialized }),

      toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),

      setSidebarOpen: (isSidebarOpen) => set({ isSidebarOpen }),

      /**
       * Show toast notification
       */
      showToast: (message, type = 'info', duration = 3000) => {
        set({ toast: { message, type, duration } });

        // Auto-hide toast after duration
        setTimeout(() => {
          set({ toast: null });
        }, duration);
      },

      /**
       * Hide toast
       */
      hideToast: () => set({ toast: null }),
    }),
    { name: 'app-store' }
  )
);

/**
 * Combined hook for easy access to all stores
 */
export const useStore = () => ({
  user: useUserStore(),
  sources: useSourcesStore(),
  chat: useChatStore(),
  app: useAppStore(),
});

export default useStore;
