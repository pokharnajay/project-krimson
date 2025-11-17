-- Migration: Enable Row Level Security (RLS) for all tables
-- Purpose: Allow frontend to directly query Supabase with proper data isolation
-- Date: 2025-11-17
--
-- IMPORTANT: This migration enables RLS policies that allow the frontend
-- to query Supabase directly using the anon key while maintaining data security.
-- Each user can only access their own data.

-- =============================================================================
-- 1. ENABLE RLS ON ALL TABLES
-- =============================================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 2. USERS TABLE POLICIES
-- =============================================================================

-- Users can only read their own profile
CREATE POLICY "Users can read own profile"
ON users
FOR SELECT
USING (auth.uid()::text = id::text);

-- Users can update their own profile (for credits, etc.)
CREATE POLICY "Users can update own profile"
ON users
FOR UPDATE
USING (auth.uid()::text = id::text)
WITH CHECK (auth.uid()::text = id::text);

-- =============================================================================
-- 3. SOURCES TABLE POLICIES
-- =============================================================================

-- Users can read sources they have access to via user_sources
CREATE POLICY "Users can read accessible sources"
ON sources
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_sources
    WHERE user_sources.source_id = sources.id
    AND user_sources.user_id::text = auth.uid()::text
  )
);

-- Only service role can create/update/delete sources (via backend)
-- This prevents users from bypassing backend processing logic

-- =============================================================================
-- 4. USER_SOURCES TABLE POLICIES
-- =============================================================================

-- Users can read their own source associations
CREATE POLICY "Users can read own source associations"
ON user_sources
FOR SELECT
USING (user_id::text = auth.uid()::text);

-- Only service role can create/update/delete associations (via backend)
-- This prevents users from accessing sources they shouldn't have

-- =============================================================================
-- 5. CHATS TABLE POLICIES
-- =============================================================================

-- Users can read their own chats
CREATE POLICY "Users can read own chats"
ON chats
FOR SELECT
USING (user_id::text = auth.uid()::text);

-- Users can update their own chats (title changes)
CREATE POLICY "Users can update own chats"
ON chats
FOR UPDATE
USING (user_id::text = auth.uid()::text)
WITH CHECK (user_id::text = auth.uid()::text);

-- Users can delete their own chats
CREATE POLICY "Users can delete own chats"
ON chats
FOR DELETE
USING (user_id::text = auth.uid()::text);

-- Only service role can create chats (via backend)
-- This ensures proper initialization and validation

-- =============================================================================
-- 6. MESSAGES TABLE POLICIES
-- =============================================================================

-- Users can read messages from their own chats
CREATE POLICY "Users can read messages from own chats"
ON messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM chats
    WHERE chats.id = messages.chat_id
    AND chats.user_id::text = auth.uid()::text
  )
);

-- Only service role can create/update/delete messages (via backend)
-- This prevents users from spoofing AI responses or tampering with history

-- =============================================================================
-- 7. HELPER FUNCTIONS (Optional - for better RLS performance)
-- =============================================================================

-- Function to check if user has access to a source
CREATE OR REPLACE FUNCTION user_has_source_access(source_uuid uuid, user_uuid uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_sources
    WHERE source_id = source_uuid
    AND user_id = user_uuid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user owns a chat
CREATE OR REPLACE FUNCTION user_owns_chat(chat_uuid uuid, user_uuid uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM chats
    WHERE id = chat_uuid
    AND user_id = user_uuid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 8. GRANT PERMISSIONS
-- =============================================================================

-- Grant SELECT permission to authenticated users (anon key)
GRANT SELECT ON users TO anon, authenticated;
GRANT SELECT ON sources TO anon, authenticated;
GRANT SELECT ON user_sources TO anon, authenticated;
GRANT SELECT ON chats TO anon, authenticated;
GRANT SELECT ON messages TO anon, authenticated;

-- Grant UPDATE permission for specific tables
GRANT UPDATE ON users TO anon, authenticated;
GRANT UPDATE ON chats TO anon, authenticated;

-- Grant DELETE permission for chats
GRANT DELETE ON chats TO anon, authenticated;

-- =============================================================================
-- 9. VERIFICATION QUERIES (Run these to test RLS)
-- =============================================================================

-- Test as a specific user (replace with actual user ID):
-- SET LOCAL ROLE authenticated;
-- SET LOCAL request.jwt.claims TO '{"sub": "user-id-here"}';
--
-- SELECT * FROM sources;  -- Should only show sources user has access to
-- SELECT * FROM chats;    -- Should only show user's chats
-- SELECT * FROM messages; -- Should only show messages from user's chats

-- =============================================================================
-- ROLLBACK INSTRUCTIONS
-- =============================================================================

-- To rollback this migration:
/*
-- Drop all policies
DROP POLICY IF EXISTS "Users can read own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Users can read accessible sources" ON sources;
DROP POLICY IF EXISTS "Users can read own source associations" ON user_sources;
DROP POLICY IF EXISTS "Users can read own chats" ON chats;
DROP POLICY IF EXISTS "Users can update own chats" ON chats;
DROP POLICY IF EXISTS "Users can delete own chats" ON chats;
DROP POLICY IF EXISTS "Users can read messages from own chats" ON messages;

-- Drop helper functions
DROP FUNCTION IF EXISTS user_has_source_access(uuid, uuid);
DROP FUNCTION IF EXISTS user_owns_chat(uuid, uuid);

-- Disable RLS
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE sources DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_sources DISABLE ROW LEVEL SECURITY;
ALTER TABLE chats DISABLE ROW LEVEL SECURITY;
ALTER TABLE messages DISABLE ROW LEVEL SECURITY;

-- Revoke permissions
REVOKE ALL ON users FROM anon, authenticated;
REVOKE ALL ON sources FROM anon, authenticated;
REVOKE ALL ON user_sources FROM anon, authenticated;
REVOKE ALL ON chats FROM anon, authenticated;
REVOKE ALL ON messages FROM anon, authenticated;
*/

-- =============================================================================
-- IMPORTANT NOTES
-- =============================================================================

/*
1. After running this migration, the frontend can directly query Supabase
   using the anon key without compromising security.

2. RLS policies ensure users can only access their own data.

3. Mutations (INSERT/UPDATE/DELETE) for sources, user_sources, and messages
   are restricted to the service role (backend API only).

4. Users can delete their own chats and update chat titles directly from frontend.

5. To use this with JWT auth from your backend:
   - Frontend must set the JWT token: supabase.auth.setSession({ access_token: token })
   - JWT must include 'sub' claim with user ID
   - Token must be signed with the same secret as Supabase expects

6. Test thoroughly in development before deploying to production!
*/
