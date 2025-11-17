# Outstanding Issues & Implementation Requirements

## Critical Bug Fixes

### Source Card Display Issues
- Full video title not displaying on hover in source card - needs immediate fix
- Playlist handling: When processing playlists, determine and implement logic for which video preview to display (decide on first video, most viewed, or most recent)

### Add Source Flow Problems
- Current blocking behavior: User waits on add-source page during entire processing
- Required flow:
  - User clicks "Add Source" → immediate backend request initiation
  - Backend starts async processing
  - User redirected to dashboard within 5 seconds
  - Source card appears immediately in dashboard with "Processing" status (yellow indicator)
  - Card updates to "Ready" once processing completes

### Chat History Management
- Chat history sidebar reloads metadata on every open - causing performance issues
- Implement persistent chat metadata storage:
  - Store title, creation date, and source name locally/in state
  - Only fetch full message history from Supabase when user opens specific chat
  - Eliminate redundant metadata fetching

## Major Architecture Refactor

### Frontend-Backend Separation
**Move to frontend (direct Supabase calls):**
- All user data fetching operations
- Credits balance retrieval
- Source list/status queries
- Chat history metadata
- Any read-only data operations

**Keep in backend:**
- Source creation and processing (current flow)
- Query processing and RAG operations (current flow)
- Credits deduction logic (must remain server-side for security)

### Performance Optimization - Credits Fetching
- Eliminate continuous/redundant credit balance requests
- Implement smart fetching strategy:
  - Fetch on initial page load only
  - Update locally after credit-consuming operations
  - Refresh only on specific user actions or page navigation
  - Consider implementing real-time subscription for credit updates

## Duplicate Source Prevention

- Check if YouTube video/playlist already exists in database before processing
- If source exists:
  - Create new user-source association record
  - Skip entire reprocessing pipeline
  - Use existing embeddings/metadata
- Verify if this logic currently exists - implement if missing

## Implementation Approach Required

Before making any changes:
1. Create comprehensive implementation plan with:
   - Detailed component/file modifications
   - Database schema changes (if needed)
   - API endpoint modifications
   - Frontend state management strategy
   - Error handling for all edge cases
   - Rollback strategy if issues arise

2. Identify and implement caching opportunities:
   - Frontend: React Query/SWR for data caching
   - Backend: Redis/in-memory caching where applicable
   - Database query optimization
   - Static asset caching

3. Handle all edge cases:
   - Network failures during source creation
   - Concurrent source additions
   - User navigation during processing
   - Invalid/deleted YouTube sources
   - Credit exhaustion scenarios
   - Database connection issues

Take necessary time to plan thoroughly before implementation.