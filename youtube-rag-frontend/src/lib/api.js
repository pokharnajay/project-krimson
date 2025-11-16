/**
 * API Client Configuration and Methods
 * Connects to YouTube Transcript RAG Backend API
 */

import axios from 'axios';
import { authService } from './auth';

// Get API base URL from environment variable
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// Create axios instance with default configuration
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 seconds
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - Add auth token to all requests
apiClient.interceptors.request.use(
  (config) => {
    const token = authService.getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - Handle token refresh and errors
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If error is 401 and we haven't retried yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Try to refresh the token
        const newToken = await authService.refreshToken();
        if (newToken) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return apiClient(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed, logout user
        authService.clearTokens();
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      }
    }

    // Handle rate limiting
    if (error.response?.status === 429) {
      console.error('Rate limit exceeded. Please try again later.');
    }

    return Promise.reject(error);
  }
);

// ============================================================================
// AUTHENTICATION API
// ============================================================================

export const authAPI = {
  /**
   * Login user with username and password
   * @param {string} username
   * @param {string} password
   * @returns {Promise<{access_token: string, refresh_token: string}>}
   */
  login: async (username, password) => {
    const response = await apiClient.post('/api/auth/login', {
      username,
      password,
    });
    return response.data;
  },

  /**
   * Refresh access token using refresh token
   * @param {string} refreshToken
   * @returns {Promise<{access_token: string}>}
   */
  refresh: async (refreshToken) => {
    const response = await apiClient.post(
      '/api/auth/refresh',
      {},
      {
        headers: {
          Authorization: `Bearer ${refreshToken}`,
        },
      }
    );
    return response.data;
  },
};

// ============================================================================
// USER API
// ============================================================================

export const userAPI = {
  /**
   * Get user's current credit balance
   * @returns {Promise<{credits: number}>}
   */
  getCredits: async () => {
    const response = await apiClient.get('/api/user/credits');
    return response.data;
  },

  /**
   * Get user profile information
   * @returns {Promise<{id: string, username: string, credits: number, created_at: string}>}
   */
  getProfile: async () => {
    const response = await apiClient.get('/api/user/profile');
    return response.data;
  },
};

// ============================================================================
// TRANSCRIPT/SOURCE API
// ============================================================================

export const transcriptAPI = {
  /**
   * Get all sources for the authenticated user (with pagination)
   * @param {number} page - Page number (default: 1)
   * @param {number} limit - Items per page (default: 20)
   * @returns {Promise<{sources: Array, pagination: Object}>}
   */
  getAllSources: async (page = 1, limit = 20) => {
    const response = await apiClient.get('/api/transcripts/sources', {
      params: { page, limit },
    });
    return response.data;
  },

  /**
   * Get a specific source by ID
   * @param {string} sourceId - Source UUID
   * @returns {Promise<Object>}
   */
  getSource: async (sourceId) => {
    const response = await apiClient.get(`/api/transcripts/sources/${sourceId}`);
    return response.data;
  },

  /**
   * Process YouTube video(s) or playlist
   * @param {Object} data - {url: string, title?: string}
   * @returns {Promise<{source_id: string, status: string, message: string}>}
   */
  processVideos: async (data) => {
    const response = await apiClient.post('/api/transcripts/process', data);
    return response.data;
  },

  /**
   * Delete a source and its embeddings
   * @param {string} sourceId - Source UUID
   * @returns {Promise<{message: string}>}
   */
  deleteSource: async (sourceId) => {
    const response = await apiClient.delete(`/api/transcripts/sources/${sourceId}`);
    return response.data;
  },

  /**
   * Retry processing a failed source
   * @param {string} sourceId - Source UUID
   * @returns {Promise<{success: boolean, processed: number, errors: Array}>}
   */
  retrySource: async (sourceId) => {
    const response = await apiClient.post(`/api/transcripts/sources/${sourceId}/retry`);
    return response.data;
  },
};

// ============================================================================
// QUERY/CHAT API
// ============================================================================

export const queryAPI = {
  /**
   * Ask a question about processed videos using RAG
   * @param {string} sourceId - Source UUID
   * @param {string} question - Question to ask
   * @param {string} model - OpenRouter model ID (optional)
   * @param {string} chatId - Existing chat ID (optional, creates new chat if not provided)
   * @returns {Promise<{chat_id: string, answer: string, sources: Array, credits_remaining: number}>}
   */
  ask: async (sourceId, question, model = null, chatId = null) => {
    const response = await apiClient.post('/api/query/ask', {
      source_id: sourceId,
      question,
      ...(model && { model }),
      ...(chatId && { chat_id: chatId }),
    });
    return response.data;
  },
};

// ============================================================================
// CHAT HISTORY API
// ============================================================================

export const chatAPI = {
  /**
   * Get all chats for current user
   * @param {string} search - Search keyword (optional)
   * @param {number} limit - Items per page (default: 50)
   * @param {number} offset - Offset for pagination (default: 0)
   * @returns {Promise<{chats: Array, total: number, limit: number, offset: number}>}
   */
  getChats: async (search = '', limit = 50, offset = 0) => {
    const params = new URLSearchParams({ limit: limit.toString(), offset: offset.toString() });
    if (search) params.append('search', search);
    const response = await apiClient.get(`/api/chats?${params}`);
    return response.data;
  },

  /**
   * Get specific chat with all messages
   * @param {string} chatId - Chat UUID
   * @returns {Promise<{id: string, title: string, messages: Array, source: Object}>}
   */
  getChat: async (chatId) => {
    const response = await apiClient.get(`/api/chats/${chatId}`);
    return response.data;
  },

  /**
   * Create new chat
   * @param {string} sourceId - Source UUID
   * @param {string} title - Chat title (optional)
   * @returns {Promise<{id: string, user_id: string, source_id: string, title: string}>}
   */
  createChat: async (sourceId, title = 'New Chat') => {
    const response = await apiClient.post('/api/chats', {
      source_id: sourceId,
      title,
    });
    return response.data;
  },

  /**
   * Delete a chat and all its messages
   * @param {string} chatId - Chat UUID
   * @returns {Promise<{message: string}>}
   */
  deleteChat: async (chatId) => {
    const response = await apiClient.delete(`/api/chats/${chatId}`);
    return response.data;
  },

  /**
   * Get messages for a specific chat
   * @param {string} chatId - Chat UUID
   * @param {number} limit - Items per page (default: 100)
   * @param {number} offset - Offset for pagination (default: 0)
   * @returns {Promise<{messages: Array, chat_id: string}>}
   */
  getMessages: async (chatId, limit = 100, offset = 0) => {
    const params = new URLSearchParams({ limit: limit.toString(), offset: offset.toString() });
    const response = await apiClient.get(`/api/chats/${chatId}/messages?${params}`);
    return response.data;
  },
};

// ============================================================================
// HEALTH CHECK API
// ============================================================================

export const healthAPI = {
  /**
   * Check if the API server is healthy
   * @returns {Promise<{status: string, service: string, version: string}>}
   */
  check: async () => {
    const response = await apiClient.get('/health');
    return response.data;
  },
};

// Export the configured axios instance for custom requests
export default apiClient;
