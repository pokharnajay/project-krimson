-- Migration: Create user_sources table for multi-user source sharing
-- Purpose: Allow multiple users to share the same source without reprocessing
-- Date: 2025-11-17

-- Create user_sources junction table
CREATE TABLE IF NOT EXISTS user_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source_id UUID NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, source_id)  -- Prevent duplicate associations
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_sources_user_id ON user_sources(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sources_source_id ON user_sources(source_id);

-- Create GIN index on sources.video_ids for duplicate detection
CREATE INDEX IF NOT EXISTS idx_sources_video_ids ON sources USING GIN(video_ids);

-- Migrate existing sources to user_sources table (backward compatibility)
-- For each existing source, create a user_sources entry linking the user to the source
INSERT INTO user_sources (user_id, source_id, created_at)
SELECT user_id, id, created_at
FROM sources
ON CONFLICT (user_id, source_id) DO NOTHING;

COMMENT ON TABLE user_sources IS 'Junction table linking users to sources for multi-user sharing';
COMMENT ON COLUMN user_sources.user_id IS 'User who has access to this source';
COMMENT ON COLUMN user_sources.source_id IS 'Source that the user has access to';
