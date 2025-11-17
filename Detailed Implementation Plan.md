# Project Refactor & Bug Fix - Detailed Implementation Plan

## Phase 1: Critical Bug Investigation & Fixes

### 1.1 Duplicate Source Logic Audit (HIGHEST PRIORITY)
**Issue:** User A creates source for YouTube video X. User B attempts to create source for same video X → gets stuck on "Processing" indefinitely.

**Investigation Steps:**
- Review backend source creation endpoint
- Check if duplicate detection logic exists in codebase
- Verify database schema supports multi-user source sharing
- Test current behavior: same video, different users

**Implementation Requirements:**
- When user initiates source creation:
  1. Query database for existing source with same YouTube URL
  2. If exists: Create `user_sources` association record linking user to existing source
  3. If exists: Return immediate success, skip all processing (transcription, embedding, chunking)
  4. If not exists: Proceed with full processing pipeline
- Add proper error handling for race conditions (two users adding same video simultaneously)
- Implement database transactions to prevent duplicate processing
- Add logging to track duplicate source reuse

**Testing Checklist:**
- [ ] User A adds video → processes successfully
- [ ] User B adds same video → completes instantly without reprocessing
- [ ] Both users can query the source independently
- [ ] Source appears in both users' dashboards
- [ ] Credits deducted only once (for User A)
- [ ] Concurrent additions by multiple users handled correctly

### 1.2 Source Card UI Improvements

**Remove Thumbnail Display:**
- Locate source card component in dashboard
- Remove thumbnail rendering logic
- Adjust card layout/spacing to accommodate removal
- Ensure card remains visually balanced

**Instant Tooltip on Title Hover:**
- Current issue: Tooltip has delay before appearing
- Solution: Set tooltip delay to 0ms or use CSS-only tooltip
- Implementation:
  - If using library (Radix, MUI): Set `delayDuration={0}` or equivalent
  - If custom: Remove setTimeout/transition delays
  - Add `title` attribute as fallback for native browser tooltip
- Test tooltip appears instantly on hover across browsers

**Playlist Preview Decision:**
- Choose preview strategy for playlists (pick one):
  - Option A: First video in playlist
  - Option B: Most viewed video in playlist
  - Option C: Most recent video in playlist
- Implement selected logic in source processing
- Document decision in code comments

### 1.3 Add Source Flow Refactor

**Current Broken Flow:**
1. User clicks "Add Source"
2. Frontend makes request to backend
3. User stuck on add-source page waiting
4. Backend processes (transcription, embedding, etc.)
5. Backend returns success
6. User sees source in dashboard

**Required Async Flow:**
1. User clicks "Add Source" button
2. Frontend immediately sends request to backend
3. Backend validates input, creates database record with status="processing"
4. Backend returns immediate response (within 1-2 seconds) with source_id
5. Frontend redirects user to dashboard within 5 seconds max
6. Backend continues processing asynchronously in background
7. Dashboard shows source card with yellow "Processing" badge
8. Periodic polling or websocket updates card status to "Ready" when complete

**Implementation Tasks:**
- Modify backend endpoint to return immediately after creating DB record
- Move processing logic to background task (Celery, Bull, or async function)
- Add source status field to database: "processing" | "ready" | "failed"
- Implement dashboard polling (every 10-15 seconds) to check status updates
- Or implement WebSocket/SSE for real-time status updates
- Add error handling: if processing fails, show "Failed" status with retry option
- Show optimistic UI: source card appears immediately after API response

**Edge Cases to Handle:**
- User navigates away during processing → processing continues in background
- User closes browser → processing continues, status visible on next login
- Processing fails → show error state, allow retry
- Network timeout on initial request → show error, allow retry

### 1.4 Chat History Performance Fix

**Current Issue:**
- Every time user opens chat sidebar, metadata is fetched from Supabase
- Causes slow loading and unnecessary API calls
- Full message history loaded even when just browsing chats

**Required Behavior:**
- Chat metadata (title, creation date, source name) persists in frontend state
- No refetching when opening/closing sidebar
- Full message history only fetched when user clicks specific chat

**Implementation:**
- Use React Context or Zustand store for chat metadata persistence
- On app initialization or dashboard load, fetch all chat metadata once
- Store in state: `{ id, title, created_at, source_name }[]`
- Display chat list from cached metadata
- When user clicks chat:
  - Check if messages already cached
  - If not: fetch from Supabase `messages` table where `chat_id = selected_chat_id`
  - Cache messages in state
- Only refetch metadata when:
  - New chat created
  - User manually refreshes
  - Real-time update received (if using subscriptions)

## Phase 2: Architecture Refactor - Frontend Data Fetching

### 2.1 Complete Code Audit

**Objective:** Verify all data fetching moved from backend API to direct Supabase calls in frontend.

**Audit Checklist:**
- [ ] Sources list fetching → Frontend Supabase query
- [ ] Individual source details → Frontend Supabase query
- [ ] Credits balance retrieval → Frontend Supabase query
- [ ] Chat history metadata → Frontend Supabase query
- [ ] User profile data → Frontend Supabase query
- [ ] All read-only operations → Frontend Supabase query

**Files to Review:**
- All API route files (Next.js: `app/api/**`, `pages/api/**`)
- All React components making fetch/axios calls
- All custom hooks (useQuery, useFetch, etc.)
- Supabase client configuration and usage

**Document Findings:**
- Create spreadsheet listing each data operation
- Mark as "Frontend" or "Backend"
- If still in backend, note reason and plan migration

### 2.2 Migration Tasks (If Not Complete)

**For each backend data fetch endpoint:**
1. Install/configure Supabase client in frontend
2. Replace backend API call with direct Supabase query
3. Update TypeScript types for Supabase responses
4. Add Row Level Security (RLS) policies in Supabase:
   - Users can only read their own data
   - Proper filters on `user_id` column
5. Test authorization: User A cannot access User B's data
6. Remove backend endpoint once verified working
7. Update error handling for direct Supabase errors

**Keep in Backend (Verify These Remain):**
- `/api/sources/create` - Source creation and processing
- `/api/query` or `/api/chat` - RAG query processing
- `/api/credits/deduct` - Credit deduction logic
- Any mutation operations requiring server-side validation

### 2.3 Credits Fetching Optimization

**Current Issue:**
- Credits balance fetched on every page load
- Fetched after every user action
- Excessive database queries

**Implementation:**
- Create centralized credits store (Context or Zustand)
- Fetch credits once on app initialization
- Update local state after operations that consume credits:
  - After source creation: `credits -= SOURCE_CREATION_COST`
  - After query: `credits -= QUERY_COST`
- Optionally implement Supabase real-time subscription:

supabase
.channel('credits')
.on('postgres_changes',
{ event: 'UPDATE', schema: 'public', table: 'users', filter: id=eq.${userId} },
(payload) => updateCredits(payload.new.credits)
)
.subscribe()

- Refresh button in UI for manual refresh
- Auto-refresh only on navigation to credits/billing page

**Remove Credits Fetching From:**
- [ ] Dashboard page load
- [ ] Source creation completion
- [ ] Chat message send
- [ ] Every component mount
- [ ] Periodic intervals

## Phase 3: Caching Implementation

### 3.1 Frontend Caching

**React Query / SWR Setup:**
- Install React Query or SWR
- Wrap app with QueryClientProvider
- Configure default cache times:
- Sources list: 5 minutes
- Chat metadata: 10 minutes
- User profile: 15 minutes
- Implement cache invalidation on mutations

**Component-Level Caching:**
- Use `useMemo` for expensive computations
- Use `useCallback` for stable function references
- Implement virtual scrolling for long chat histories (react-window)

### 3.2 Backend Caching (If Applicable)

**Redis Implementation:**
- Cache expensive operations:
- Vector similarity searches (if not using Supabase vector)
- Processed embeddings (if reprocessing same queries)
- Set appropriate TTLs (Time To Live)
- Implement cache warming for common queries

**Database Query Optimization:**
- Add indexes on frequently queried columns:
- `user_id` on all user-scoped tables
- `youtube_url` on sources table (for duplicate detection)
- `status` on sources table
- `created_at` on chats table
- Use `EXPLAIN ANALYZE` to identify slow queries
- Implement database connection pooling

## Phase 4: Testing & Edge Cases

### 4.1 Duplicate Source Multi-User Testing
- [ ] Sequential: User A → User B (same video)
- [ ] Concurrent: User A and B simultaneously add same video
- [ ] Three+ users adding same video
- [ ] User adds video, deletes, re-adds
- [ ] Invalid YouTube URL handling
- [ ] Private/deleted YouTube video handling

### 4.2 Add Source Flow Testing
- [ ] Normal flow: add source, redirect, see processing card
- [ ] Close browser during processing → status persists
- [ ] Network failure during initial request
- [ ] Network failure during background processing
- [ ] Multiple sources added in quick succession
- [ ] Source fails processing → shows error state

### 4.3 Frontend Authorization Testing
- [ ] User A cannot see User B's sources
- [ ] User A cannot see User B's chats
- [ ] User A cannot access User B's credits
- [ ] Direct Supabase query fails without auth token
- [ ] RLS policies properly enforced

### 4.4 Performance Testing
- [ ] Dashboard loads in <2 seconds with 50+ sources
- [ ] Chat sidebar opens instantly
- [ ] Credits not fetched unnecessarily (check network tab)
- [ ] Tooltip appears with 0ms delay
- [ ] No memory leaks from unclosed subscriptions

## Phase 5: Implementation Order

**Day 1-2: Investigation & Planning**
1. Audit duplicate source logic (2 hours)
2. Complete frontend/backend separation audit (3 hours)
3. Document all findings and create detailed task breakdown (1 hour)

**Day 3-4: Critical Bugs**
1. Fix duplicate source detection (4 hours)
2. Remove thumbnail, fix tooltip (1 hour)
3. Test multi-user scenarios (2 hours)

**Day 5-6: Add Source Flow**
1. Implement async backend processing (3 hours)
2. Add status polling/websockets to frontend (3 hours)
3. Test redirect and status updates (2 hours)

**Day 7: Chat History**
1. Implement metadata caching (2 hours)
2. Implement lazy message loading (2 hours)
3. Test performance improvements (1 hour)

**Day 8-9: Credits & Caching**
1. Centralize credits management (2 hours)
2. Implement React Query for data caching (3 hours)
3. Add database indexes (1 hour)
4. Test and verify all optimizations (2 hours)

**Day 10: Final Testing & Polish**
1. Complete all testing checklists
2. Fix any discovered issues
3. Document changes and new architecture
4. Deploy to staging for final verification

## Success Criteria

- [ ] Duplicate source creates association instantly without reprocessing
- [ ] Source card shows no thumbnail, instant tooltip
- [ ] Add source redirects within 5 seconds, shows processing status
- [ ] Chat sidebar opens instantly with no metadata refetch
- [ ] All data fetching uses direct Supabase (except mutations)
- [ ] Credits fetched maximum once per session
- [ ] All edge cases handled gracefully
- [ ] Performance meets targets (load times, response times)
- [ ] No security vulnerabilities from frontend data access