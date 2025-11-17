/**
 * Supabase Client Configuration
 * Direct database access for read operations (replaces backend API calls)
 */

import { createClient } from '@supabase/supabase-js';

// Get configuration from environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY'
  );
}

/**
 * Create Supabase client instance
 * Uses anon key with Row Level Security (RLS) for data protection
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false, // We manage auth via JWT tokens in localStorage
    autoRefreshToken: false, // Manual token management
  },
  global: {
    headers: {
      'X-Client-Info': 'youtube-rag-frontend',
    },
  },
});

/**
 * Set authentication token for Supabase client
 * Call this after user login to enable RLS-protected queries
 *
 * @param {string} accessToken - JWT access token from backend auth
 */
export const setSupabaseAuth = (accessToken) => {
  if (accessToken) {
    supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: '', // Not needed for our use case
    });
  }
};

/**
 * Clear authentication from Supabase client
 * Call this on logout
 */
export const clearSupabaseAuth = async () => {
  await supabase.auth.signOut();
};

/**
 * Database query helpers with automatic error handling
 */

/**
 * Fetch sources for the current user
 * @param {string} userId - User ID
 * @param {number} limit - Number of results
 * @param {number} offset - Offset for pagination
 * @returns {Promise<Array>} List of sources
 */
export const fetchUserSources = async (userId, limit = 20, offset = 0) => {
  const { data, error } = await supabase
    .from('user_sources')
    .select(`
      source_id,
      created_at,
      sources (
        id,
        title,
        video_ids,
        status,
        created_at,
        metadata
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('Error fetching sources:', error);
    throw error;
  }

  // Extract source objects from joined data
  return data?.map(item => item.sources).filter(Boolean) || [];
};

/**
 * Get total count of sources for a user
 * @param {string} userId - User ID
 * @returns {Promise<number>} Total count
 */
export const fetchUserSourcesCount = async (userId) => {
  const { count, error } = await supabase
    .from('user_sources')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (error) {
    console.error('Error fetching sources count:', error);
    throw error;
  }

  return count || 0;
};

/**
 * Fetch a specific source by ID
 * @param {string} sourceId - Source ID
 * @param {string} userId - User ID (for authorization check)
 * @returns {Promise<Object>} Source object
 */
export const fetchSourceById = async (sourceId, userId) => {
  // First check if user has access via user_sources
  const { data: association } = await supabase
    .from('user_sources')
    .select('source_id')
    .eq('user_id', userId)
    .eq('source_id', sourceId)
    .single();

  if (!association) {
    throw new Error('Source not found or access denied');
  }

  // Fetch full source details
  const { data, error } = await supabase
    .from('sources')
    .select('*')
    .eq('id', sourceId)
    .single();

  if (error) {
    console.error('Error fetching source:', error);
    throw error;
  }

  return data;
};

/**
 * Fetch all chats for a user
 * @param {string} userId - User ID
 * @param {string} searchQuery - Optional search query
 * @returns {Promise<Object>} Chats list with metadata
 */
export const fetchUserChats = async (userId, searchQuery = '') => {
  let query = supabase
    .from('chats')
    .select(`
      id,
      title,
      source_id,
      created_at,
      updated_at,
      sources (
        title
      )
    `)
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  // Apply search filter if provided
  if (searchQuery && searchQuery.trim()) {
    query = query.ilike('title', `%${searchQuery}%`);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error('Error fetching chats:', error);
    throw error;
  }

  return {
    chats: data || [],
    total: count || data?.length || 0,
  };
};

/**
 * Fetch messages for a specific chat
 * @param {string} chatId - Chat ID
 * @param {string} userId - User ID (for authorization)
 * @returns {Promise<Array>} List of messages
 */
export const fetchChatMessages = async (chatId, userId) => {
  // First verify user owns this chat
  const { data: chat } = await supabase
    .from('chats')
    .select('user_id')
    .eq('id', chatId)
    .single();

  if (!chat || chat.user_id !== userId) {
    throw new Error('Chat not found or access denied');
  }

  // Fetch messages
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching messages:', error);
    throw error;
  }

  return data || [];
};

/**
 * Fetch user credits
 * @param {string} userId - User ID
 * @returns {Promise<number>} Credits balance
 */
export const fetchUserCredits = async (userId) => {
  const { data, error } = await supabase
    .from('users')
    .select('credits')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Error fetching credits:', error);
    throw error;
  }

  return data?.credits || 0;
};

/**
 * Fetch user profile
 * @param {string} userId - User ID
 * @returns {Promise<Object>} User profile
 */
export const fetchUserProfile = async (userId) => {
  const { data, error } = await supabase
    .from('users')
    .select('id, username, credits, created_at')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Error fetching user profile:', error);
    throw error;
  }

  return data;
};

/**
 * Delete a chat (mutation - requires backend API)
 * This is kept in backend because it has cascade delete logic
 * @param {string} chatId - Chat ID
 * @param {string} userId - User ID
 * @returns {Promise<void>}
 */
export const deleteChat = async (chatId, userId) => {
  // Verify ownership
  const { data: chat } = await supabase
    .from('chats')
    .select('user_id')
    .eq('id', chatId)
    .single();

  if (!chat || chat.user_id !== userId) {
    throw new Error('Chat not found or access denied');
  }

  // Delete chat (cascade will delete messages)
  const { error } = await supabase
    .from('chats')
    .delete()
    .eq('id', chatId);

  if (error) {
    console.error('Error deleting chat:', error);
    throw error;
  }
};

/**
 * Real-time subscription helpers
 */

/**
 * Subscribe to source status changes
 * @param {string} userId - User ID
 * @param {Function} callback - Callback function (payload) => void
 * @returns {Object} Subscription object with unsubscribe method
 */
export const subscribeToSourceChanges = (userId, callback) => {
  const subscription = supabase
    .channel(`sources:${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'sources',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        callback(payload);
      }
    )
    .subscribe();

  return subscription;
};

/**
 * Subscribe to credits changes
 * @param {string} userId - User ID
 * @param {Function} callback - Callback function (newCredits) => void
 * @returns {Object} Subscription object with unsubscribe method
 */
export const subscribeToCreditsChanges = (userId, callback) => {
  const subscription = supabase
    .channel(`credits:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'users',
        filter: `id=eq.${userId}`,
      },
      (payload) => {
        if (payload.new && payload.new.credits !== undefined) {
          callback(payload.new.credits);
        }
      }
    )
    .subscribe();

  return subscription;
};

export default supabase;
