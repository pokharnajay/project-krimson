# Chat History Implementation Plan

## Overview
This plan outlines the implementation of persistent chat history, configurable prompts, and a chat sidebar for the YouTube RAG application.

---

## 📋 Requirements Summary

### 1. Configuration Management
- ✅ Create local JSON file for AI prompts (easy modification)
- ✅ Make query cost configurable via ENV variable

### 2. Chat History System
- ✅ Persistent chat history per user
- ✅ Each chat linked to a source_id
- ✅ Load all messages when opening a chat
- ✅ Chat titles auto-generated from first message

### 3. Dashboard UI Enhancement
- ✅ Left sidebar with chat history (pull-out/collapsible)
- ✅ Chat search functionality
- ✅ Maintain minimal Claude AI aesthetic

---

## 🏗️ Implementation Phases

---

## **PHASE 1: Configuration & Prompt Management**

### 1.1 Create Prompt Configuration File
**Location:** `youtube-transcript-rag/config/prompts.json`

```json
{
  "system_prompt": "You are a knowledgeable assistant that provides clear, accurate answers based on YouTube video transcripts. Your answers should be natural and conversational, without any source citations, links, or timestamp references in the text itself. Answer questions directly and concisely.",

  "user_prompt_template": "You are answering a question based on YouTube video transcript excerpts provided below.\n\nIMPORTANT INSTRUCTIONS:\n- Provide a clear, natural, and conversational answer based on the context\n- DO NOT include source numbers (like [Source 1]) in your answer\n- DO NOT include YouTube links or timestamps in your answer text\n- DO NOT mention \"in the video\" or reference timestamps explicitly\n- Focus on delivering the information in a helpful, direct way\n- If the context doesn't fully answer the question, acknowledge what you can answer from the available information\n\nContext from video transcripts:\n{context}\n\nQuestion: {query}\n\nProvide a helpful answer based solely on the information in the transcripts above. Keep your answer concise and natural.",

  "max_tokens": 500,
  "temperature": 0.7,

  "metadata": {
    "version": "1.0.0",
    "last_updated": "2025-11-16",
    "description": "AI prompts for YouTube RAG chat responses"
  }
}
```

### 1.2 Update Environment Variables
**Add to:** `youtube-transcript-rag/.env.example` and `.env`

```bash
# Query Cost Configuration
CREDITS_PER_QUERY=1

# Prompt Configuration (optional - defaults to prompts.json)
PROMPTS_CONFIG_PATH=config/prompts.json
```

### 1.3 Update AI Service
**File:** `youtube-transcript-rag/app/services/ai_service.py`

**Changes:**
- Load prompts from JSON file instead of hardcoded
- Use ENV variable for credits cost
- Add prompt reloading capability
- Add fallback to default prompts if file not found

---

## **PHASE 2: Database Schema Design**

### 2.1 New Table: `chats`
**Purpose:** Store individual chat sessions

```sql
CREATE TABLE chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source_id UUID NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    title VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_chats_user_id ON chats(user_id);
CREATE INDEX idx_chats_source_id ON chats(source_id);
CREATE INDEX idx_chats_updated_at ON chats(updated_at DESC);
```

**Fields:**
- `id`: Unique chat identifier
- `user_id`: Owner of the chat
- `source_id`: Which video source this chat is about
- `title`: Auto-generated from first message (first 50 chars)
- `created_at`: When chat was created
- `updated_at`: Last message timestamp (for sorting)

### 2.2 New Table: `messages`
**Purpose:** Store individual messages within chats

```sql
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    model_used VARCHAR(100),
    primary_source JSONB,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_messages_chat_id ON messages(chat_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);
```

**Fields:**
- `id`: Unique message identifier
- `chat_id`: Which chat this message belongs to
- `role`: 'user' or 'assistant' or 'system'
- `content`: The message text
- `model_used`: Which LLM model generated this (for assistant messages)
- `primary_source`: JSONB containing video_id, start_time, youtube_link
- `metadata`: Additional data (tokens used, etc.)
- `created_at`: Message timestamp

### 2.3 Database Migration Strategy

**Create:** `youtube-transcript-rag/migrations/001_add_chat_tables.sql`

```sql
-- Migration: Add chat history tables
-- Date: 2025-11-16

-- Create chats table
CREATE TABLE IF NOT EXISTS chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source_id UUID NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    title VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chats_user_id ON chats(user_id);
CREATE INDEX IF NOT EXISTS idx_chats_source_id ON chats(source_id);
CREATE INDEX IF NOT EXISTS idx_chats_updated_at ON chats(updated_at DESC);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    model_used VARCHAR(100),
    primary_source JSONB,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

-- Update function to automatically update chats.updated_at
CREATE OR REPLACE FUNCTION update_chat_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE chats SET updated_at = NOW() WHERE id = NEW.chat_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_chat_on_message
AFTER INSERT ON messages
FOR EACH ROW
EXECUTE FUNCTION update_chat_timestamp();
```

---

## **PHASE 3: Backend API Implementation**

### 3.1 New Supabase Service Functions
**File:** `youtube-transcript-rag/app/services/supabase_service.py`

**New Functions:**

```python
# Chat Operations
def create_chat(user_id, source_id, title):
    """Create a new chat session"""

def get_chat_by_id(chat_id):
    """Get specific chat details"""

def get_chats_by_user(user_id, limit=50, offset=0, search=None):
    """
    Get all chats for a user with optional search
    - Orders by updated_at DESC (most recent first)
    - Supports text search on title
    - Returns pagination info
    """

def update_chat_title(chat_id, title):
    """Update chat title"""

def delete_chat(chat_id):
    """Delete chat and all messages (cascade)"""

# Message Operations
def create_message(chat_id, role, content, model_used=None, primary_source=None, metadata=None):
    """Create a new message in a chat"""

def get_messages_by_chat(chat_id, limit=100, offset=0):
    """Get all messages for a chat, ordered by created_at"""

def get_chat_with_messages(chat_id):
    """Get chat details and all messages in one call"""
```

### 3.2 New API Routes
**File:** `youtube-transcript-rag/app/routes/chat_routes.py`

```python
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

chat_bp = Blueprint('chat', __name__)

@chat_bp.route('', methods=['GET'])
@jwt_required()
def get_chats():
    """
    Get all chats for current user
    Query params: ?search=keyword&limit=50&offset=0
    """

@chat_bp.route('/<chat_id>', methods=['GET'])
@jwt_required()
def get_chat(chat_id):
    """Get specific chat with all messages"""

@chat_bp.route('', methods=['POST'])
@jwt_required()
def create_new_chat():
    """
    Create new chat
    Body: { source_id: uuid }
    """

@chat_bp.route('/<chat_id>', methods=['DELETE'])
@jwt_required()
def delete_chat_endpoint(chat_id):
    """Delete a chat"""

@chat_bp.route('/<chat_id>/messages', methods=['GET'])
@jwt_required()
def get_chat_messages(chat_id):
    """Get messages for a chat (with pagination)"""
```

### 3.3 Update Query Route
**File:** `youtube-transcript-rag/app/routes/query_routes.py`

**Modifications:**
```python
@query_bp.route('/ask', methods=['POST'])
@jwt_required()
def ask_question():
    # ... existing code ...

    # NEW: Get or create chat
    chat_id = data.get('chat_id')

    if not chat_id:
        # Create new chat with auto-generated title
        title = question[:50] + ("..." if len(question) > 50 else "")
        chat = create_chat(user_id, source_id, title)
        chat_id = chat['id']

    # Save user message
    create_message(chat_id, 'user', question)

    # ... existing RAG logic ...

    # Save assistant message
    create_message(
        chat_id,
        'assistant',
        result['answer'],
        model_used=model,
        primary_source=result.get('primary_source')
    )

    # Deduct credits using ENV variable
    credits_cost = int(os.getenv('CREDITS_PER_QUERY', 1))
    credits_left = update_credits(user['username'], -credits_cost)

    return jsonify({
        'chat_id': chat_id,
        'answer': result.get('answer', ''),
        'primary_source': result.get('primary_source'),
        'credits_remaining': credits_left
    }), 200
```

### 3.4 Register Chat Routes
**File:** `youtube-transcript-rag/app/__init__.py`

```python
from app.routes.chat_routes import chat_bp

def create_app():
    # ... existing code ...

    app.register_blueprint(chat_bp, url_prefix='/api/chats')

    # ... existing code ...
```

---

## **PHASE 4: Frontend Implementation**

### 4.1 Update API Client
**File:** `youtube-rag-frontend/src/lib/api.js`

**New Functions:**
```javascript
export const chatAPI = {
  // Get all chats for current user
  getChats: async (search = '', limit = 50, offset = 0) => {
    const params = new URLSearchParams({ limit, offset });
    if (search) params.append('search', search);
    const response = await apiClient.get(`/api/chats?${params}`);
    return response.data;
  },

  // Get specific chat with messages
  getChat: async (chatId) => {
    const response = await apiClient.get(`/api/chats/${chatId}`);
    return response.data;
  },

  // Create new chat
  createChat: async (sourceId) => {
    const response = await apiClient.post('/api/chats', { source_id: sourceId });
    return response.data;
  },

  // Delete chat
  deleteChat: async (chatId) => {
    const response = await apiClient.delete(`/api/chats/${chatId}`);
    return response.data;
  },
};

// Update existing queryAPI.ask to include chat_id
export const queryAPI = {
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
```

### 4.2 Create Chat Sidebar Component
**File:** `youtube-rag-frontend/src/components/ChatSidebar.jsx`

```jsx
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

      if (currentChatId === chatId) {
        router.push('/dashboard');
      }
    } catch (error) {
      console.error('Failed to delete chat:', error);
    }
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

      {/* Sidebar */}
      <div
        className={`fixed top-0 left-0 h-full bg-white border-r border-claude-border z-50 transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } w-80`}
      >
        {/* Header */}
        <div className="h-14 border-b border-claude-border flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <MessageSquare size={18} className="text-claude-muted" />
            <span className="text-sm font-medium text-claude-text">Chat History</span>
          </div>
          <button
            onClick={() => onToggle(false)}
            className="p-1 hover:bg-claude-bg rounded transition-colors"
          >
            <ChevronLeft size={18} className="text-claude-muted" />
          </button>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-claude-border">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-claude-muted" />
            <input
              type="text"
              placeholder="Search chats..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-claude-border rounded-lg focus:outline-none focus:border-accent"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2"
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
              Loading...
            </div>
          ) : chats.length === 0 ? (
            <div className="p-4 text-center text-sm text-claude-muted">
              {searchQuery ? 'No chats found' : 'No chats yet'}
            </div>
          ) : (
            <div className="py-2">
              {chats.map((chat) => (
                <button
                  key={chat.id}
                  onClick={() => router.push(`/chat/${chat.id}`)}
                  className={`w-full px-4 py-3 hover:bg-claude-bg transition-colors flex items-start justify-between group ${
                    currentChatId === chat.id ? 'bg-claude-bg' : ''
                  }`}
                >
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm text-claude-text truncate mb-1">
                      {chat.title}
                    </p>
                    <p className="text-xs text-claude-muted">
                      {new Date(chat.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={(e) => handleDeleteChat(chat.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 rounded transition-all"
                  >
                    <Trash2 size={14} className="text-red-600" />
                  </button>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Toggle Button (when closed) */}
      {!isOpen && (
        <button
          onClick={() => onToggle(true)}
          className="fixed top-20 left-0 z-40 p-2 bg-white border border-l-0 border-claude-border rounded-r-lg hover:bg-claude-bg transition-colors"
        >
          <ChevronRight size={18} className="text-claude-muted" />
        </button>
      )}
    </>
  );
}
```

### 4.3 Update Dashboard Page
**File:** `youtube-rag-frontend/src/app/dashboard/page.js`

**Changes:**
```jsx
import ChatSidebar from '@/components/ChatSidebar';

export default function DashboardPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ... existing code ...

  return (
    <div className="min-h-screen bg-white">
      <ChatSidebar isOpen={sidebarOpen} onToggle={setSidebarOpen} />

      <Header />

      {/* Add padding when sidebar is open */}
      <main className={`max-w-6xl mx-auto px-6 py-8 transition-all ${
        sidebarOpen ? 'lg:ml-80' : ''
      }`}>
        {/* ... existing content ... */}
      </main>
    </div>
  );
}
```

### 4.4 Update Chat Page
**File:** `youtube-rag-frontend/src/app/chat/[chatId]/page.js`

**Major Changes:**
```jsx
import ChatSidebar from '@/components/ChatSidebar';
import { chatAPI } from '@/lib/api';

export default function ChatPage({ params }) {
  const chatId = params.chatId;
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [chat, setChat] = useState(null);

  // Load chat and messages on mount
  useEffect(() => {
    const loadChat = async () => {
      try {
        const response = await chatAPI.getChat(chatId);
        setChat(response);
        setMessages(response.messages || []);
        setSource(response.source);
      } catch (error) {
        console.error('Failed to load chat:', error);
        router.push('/dashboard');
      }
    };

    loadChat();
  }, [chatId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    // ... existing logic ...

    // Pass chatId to backend
    const response = await queryAPI.ask(
      source.id,
      userMessage,
      selectedModel.id,
      chatId
    );

    // ... rest of logic ...
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <ChatSidebar
        isOpen={sidebarOpen}
        onToggle={setSidebarOpen}
        currentChatId={chatId}
      />

      <Header sourceTitle={chat?.source?.title} />

      {/* Add margin when sidebar is open */}
      <main className={`flex-1 overflow-y-auto transition-all ${
        sidebarOpen ? 'lg:ml-80' : ''
      }`}>
        {/* ... existing chat UI ... */}
      </main>
    </div>
  );
}
```

---

## **PHASE 5: Data Flow & Integration**

### 5.1 New Chat Flow
```
User clicks source → Frontend calls chatAPI.createChat(sourceId)
                  → Backend creates chat with temp title
                  → Returns chat_id
                  → Frontend navigates to /chat/{chat_id}
                  → Chat page loads with empty messages
                  → User sends first message
                  → Backend updates chat title to first 50 chars of message
                  → Chat appears in sidebar
```

### 5.2 Existing Chat Flow
```
User clicks chat in sidebar → Frontend navigates to /chat/{chat_id}
                           → Frontend calls chatAPI.getChat(chatId)
                           → Backend returns chat + messages + source
                           → Frontend displays all messages
                           → User continues conversation
                           → New messages saved to same chat_id
```

### 5.3 Search Flow
```
User types in search bar → Frontend debounces input
                        → Calls chatAPI.getChats(searchQuery)
                        → Backend filters chats by title
                        → Frontend displays filtered results
```

---

## **PHASE 6: Testing & Edge Cases**

### 6.1 Test Scenarios
- ✅ Create new chat from source
- ✅ Load existing chat with messages
- ✅ Delete chat (verify cascade to messages)
- ✅ Search chats by keyword
- ✅ Multiple chats for same source
- ✅ Empty chat list state
- ✅ Sidebar responsive on mobile
- ✅ Credits deduction with ENV value
- ✅ Prompt loading from JSON
- ✅ Fallback to default prompts if JSON missing

### 6.2 Edge Cases to Handle
- Chat deleted while user is viewing it
- Source deleted (should cascade delete chats)
- User deleted (should cascade delete chats)
- Invalid chat_id in URL
- Concurrent messages to same chat
- Very long chat titles (truncate)
- Empty search results

---

## 📊 Database Schema Summary

```
users
  ├── id (PK)
  ├── username
  ├── password_hash
  ├── credits
  └── created_at

sources
  ├── id (PK)
  ├── user_id (FK → users.id)
  ├── video_ids[]
  ├── title
  ├── status
  └── created_at

chats (NEW)
  ├── id (PK)
  ├── user_id (FK → users.id, CASCADE)
  ├── source_id (FK → sources.id, CASCADE)
  ├── title
  ├── created_at
  └── updated_at

messages (NEW)
  ├── id (PK)
  ├── chat_id (FK → chats.id, CASCADE)
  ├── role
  ├── content
  ├── model_used
  ├── primary_source (JSONB)
  ├── metadata (JSONB)
  └── created_at
```

---

## 🎨 UI/UX Design Guidelines

### Colors (from tailwind.config.js)
- Background: `bg-white`
- Borders: `border-claude-border` (#e5e5e6)
- Text: `text-claude-text` (#2d2d2d)
- Muted: `text-claude-muted` (#73738c)
- Accent: `bg-accent` (#6b4edb)
- Hover: `hover:bg-claude-bg` (#f7f7f8)

### Sidebar Design
- Width: 320px (w-80)
- Fixed position on desktop
- Slide-out on mobile with overlay
- Smooth transitions (300ms)
- Minimal shadows, border-based design
- Compact list items with hover states

### Chat List Items
- Title: 1 line, truncated with ellipsis
- Date: Small, muted text below title
- Delete button: Only visible on hover
- Active state: Light background
- Click entire item to navigate

---

## 📁 New Files to Create

### Backend
1. `youtube-transcript-rag/config/prompts.json` - AI prompt configuration
2. `youtube-transcript-rag/migrations/001_add_chat_tables.sql` - Database migration
3. `youtube-transcript-rag/app/routes/chat_routes.py` - Chat API endpoints
4. `youtube-transcript-rag/app/services/prompt_service.py` - Prompt loader service

### Frontend
1. `youtube-rag-frontend/src/components/ChatSidebar.jsx` - Chat history sidebar
2. `youtube-rag-frontend/src/hooks/useChats.js` - Chat management hook (optional)

### Files to Modify

#### Backend
1. `youtube-transcript-rag/app/__init__.py` - Register chat routes
2. `youtube-transcript-rag/app/services/ai_service.py` - Load prompts from JSON
3. `youtube-transcript-rag/app/services/supabase_service.py` - Add chat/message functions
4. `youtube-transcript-rag/app/routes/query_routes.py` - Integrate chat history
5. `youtube-transcript-rag/config/settings.py` - Add new ENV variables
6. `youtube-transcript-rag/.env.example` - Document new variables

#### Frontend
1. `youtube-rag-frontend/src/lib/api.js` - Add chatAPI functions
2. `youtube-rag-frontend/src/app/dashboard/page.js` - Add sidebar
3. `youtube-rag-frontend/src/app/chat/[chatId]/page.js` - Load chat history
4. `youtube-rag-frontend/src/components/SourceCard.jsx` - Update chat navigation

---

## 🚀 Implementation Order

### Priority 1: Core Infrastructure
1. Create prompts.json
2. Add ENV variables
3. Run database migration
4. Add supabase_service functions

### Priority 2: Backend API
5. Create chat_routes.py
6. Update query_routes.py
7. Update ai_service.py
8. Register routes in __init__.py

### Priority 3: Frontend Components
9. Update api.js with chatAPI
10. Create ChatSidebar component
11. Update chat page
12. Update dashboard page

### Priority 4: Polish
13. Test all flows
14. Handle edge cases
15. Add loading states
16. Responsive design tweaks

---

## ⏱️ Estimated Time
- **Phase 1:** 30 minutes (config files)
- **Phase 2:** 45 minutes (database design + migration)
- **Phase 3:** 2-3 hours (backend API)
- **Phase 4:** 3-4 hours (frontend components)
- **Phase 5:** 1 hour (integration)
- **Phase 6:** 1-2 hours (testing)

**Total: 8-11 hours of focused development**

---

## ✅ Success Criteria

1. ✅ Users can create new chats from sources
2. ✅ All messages persist and load correctly
3. ✅ Chat sidebar displays on dashboard and chat pages
4. ✅ Search filters chats by title
5. ✅ Chat titles auto-generate from first message
6. ✅ Delete chat removes all messages
7. ✅ Source deletion cascades to chats
8. ✅ Prompts load from JSON file
9. ✅ Credits per query configurable via ENV
10. ✅ UI maintains minimal Claude aesthetic
11. ✅ Responsive design works on mobile
12. ✅ No breaking changes to existing functionality

---

## 🔄 Migration Strategy

### For Existing Users
- Existing sources continue to work
- First query to a source creates a new chat
- Old "stateless" queries still work (creates ephemeral chat)
- No data loss or breaking changes

### Rollback Plan
- Migration can be rolled back by dropping tables
- Backend gracefully handles missing tables
- Frontend falls back to source-only navigation

---

This plan maintains your beautiful minimal UI while adding powerful chat history functionality. Ready to proceed with implementation?
