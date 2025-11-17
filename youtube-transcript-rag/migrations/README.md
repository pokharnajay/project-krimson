# Database Migrations

This directory contains SQL migrations for the project database schema.

## Running Migrations

### Prerequisites
- Access to Supabase SQL Editor (recommended) OR
- Direct PostgreSQL access with `psql` CLI

### Method 1: Supabase SQL Editor (Recommended)

1. Log into your Supabase project dashboard
2. Navigate to SQL Editor (left sidebar)
3. Click "New Query"
4. Copy the contents of the migration file
5. Paste into the SQL editor
6. Click "Run" to execute

### Method 2: PostgreSQL CLI

```bash
# Using psql with connection string
psql "postgresql://postgres:[YOUR-PASSWORD]@[YOUR-HOST]:5432/postgres" -f migrations/001_create_user_sources_table.sql
```

## Migration History

### 001_create_user_sources_table.sql
**Date:** 2025-11-17
**Purpose:** Implement multi-user source sharing

**Changes:**
- Creates `user_sources` junction table for many-to-many user-source relationships
- Adds indexes for performance (`user_id`, `source_id`)
- Adds GIN index on `sources.video_ids` for duplicate detection
- Migrates existing sources to `user_sources` table (backward compatibility)

**Benefits:**
- Prevents duplicate processing when multiple users add the same video
- Instant source creation for duplicate videos (reuses existing embeddings)
- Reduces costs and processing time
- Maintains backward compatibility with existing sources

**Testing:**
After running this migration, test the following scenarios:
1. User A adds a YouTube video → processes normally
2. User B adds the same video → completes instantly, reuses User A's source
3. Both users can see the source in their dashboard
4. Both users can chat with the source independently
5. Deleting source as User B doesn't affect User A's access
6. Credits only deducted for User A (first processing)

## Rollback

To rollback migration 001:

```sql
-- Drop user_sources table
DROP TABLE IF EXISTS user_sources CASCADE;

-- Drop indexes
DROP INDEX IF EXISTS idx_sources_video_ids;
```

**Warning:** Rollback will remove multi-user sharing capability. Users who were sharing sources will no longer see those sources in their dashboard.

## Future Migrations

When creating new migrations:
1. Name files with incremental numbers: `002_description.sql`, `003_description.sql`
2. Include rollback instructions in comments
3. Update this README with migration details
4. Test migrations on a staging database first
5. Always include backward compatibility considerations
