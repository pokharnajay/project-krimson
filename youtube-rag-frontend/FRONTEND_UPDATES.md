# Frontend Updates - YouTube Transcript RAG

## Summary of Changes

This document outlines all the updates made to connect the frontend with the restructured backend API.

## ✅ Completed Updates

### 1. Core API Integration (`/src/lib/`)

**Created `/src/lib/api.js`**
- Complete axios configuration with interceptors
- Automatic JWT token injection in request headers
- Token refresh logic on 401 responses
- Rate limiting error handling
- All API methods matching backend endpoints:
  - `authAPI.login()`, `authAPI.refresh()`
  - `userAPI.getCredits()`, `userAPI.getProfile()`
  - `transcriptAPI.getAllSources()`, `getSource()`, `processVideos()`, `deleteSource()`, `retrySource()`
  - `queryAPI.ask()`
  - `healthAPI.check()`

**Created `/src/lib/auth.js`**
- Token management service
- Secure localStorage handling
- Automatic token refresh mechanism
- Token expiry tracking
- User session management
- Auto-refresh initialization

**Created `/src/lib/store.js`**
- Zustand global state management
- Four stores implemented:
  - `useUserStore` - User profile and credits
  - `useSourcesStore` - Video sources and pagination
  - `useChatStore` - Chat messages (persisted)
  - `useAppStore` - UI state and toasts
- Optimistic updates
- Dev tools integration

### 2. Environment Configuration

**Created `.env.example`**
- Template with all configuration options
- Documented each variable
- Safe for version control

**Created `.env.local`**
- Development configuration
- API_URL set to localhost:5000
- Feature flags enabled

### 3. UI Components

**Created `/src/components/LoadingSkeleton.jsx`**
- `SourceCardSkeleton` - Animated placeholder for source cards
- `DashboardSkeleton` - Full dashboard loading state
- `ChatMessageSkeleton` - Chat loading animation
- `HeaderSkeleton` - Header placeholder
- `Spinner` - Reusable spinner component (sm, md, lg, xl sizes)
- `LoadingOverlay` - Full-screen loading modal

### 4. Styling & Animations

**Updated `/src/app/globals.css`**
- Enhanced button styles with active states
- Improved input field transitions
- Interactive card variants
- Status badge components (processing, ready, failed)
- Custom animations:
  - `fade-in` - Smooth entry animation
  - `slide-in-right` - Side entry animation
  - `scale-in` - Scale up animation
  - `pulse-slow` - Subtle pulse effect
  - `shimmer` - Skeleton loading effect
  - `loading-dots` - Animated dots
- Glass morphism utility
- Custom scrollbar styles
- Smooth transitions throughout

### 5. Authentication Updates

**Updated `/src/app/login/page.js`**
- Fixed API response handling
- Improved error messages
- Auto-refresh initialization on login
- Better loading states

**Existing `/src/components/ProtectedRoute.jsx`**
- Already properly implemented
- Uses authService for auth checks
- Handles redirects correctly

## 🔄 Remaining Component Updates Needed

While the core infrastructure is complete, the following page components need minor updates to use the new API and stores:

### Priority 1: Dashboard Page
**File**: `/src/app/dashboard/page.js`

**Required Changes**:
```javascript
// Replace useState with Zustand store
import { useSourcesStore } from '@/lib/store';

// Use store methods
const { sources, pagination, isLoading, fetchSources, setPage } = useSourcesStore();

// Add pagination controls
<PaginationControls
  currentPage={pagination.page}
  totalPages={pagination.pages}
  onPageChange={setPage}
/>
```

### Priority 2: Header Component
**File**: `/src/components/Header.jsx`

**Required Changes**:
```javascript
// Use Zustand store for credits
import { useUserStore } from '@/lib/store';
const { credits, fetchCredits } = useUserStore();

// Initialize auto-refresh on mount
useEffect(() => {
  authService.initializeAutoRefresh();
  return () => authService.stopAutoRefresh();
}, []);
```

### Priority 3: SourceCard Component
**File**: `/src/components/SourceCard.jsx`

**Required Changes**:
```javascript
// Use store for delete/retry
import { useSourcesStore } from '@/lib/store';
const { deleteSource, retrySource, updateSourceStatus } = useSourcesStore();

// Add smooth animations
className="card fade-in"

// Optimistic updates
onClick={async () => {
  updateSourceStatus(source.id, 'processing'); // Immediate UI update
  await retrySource(source.id); // API call
}}
```

### Priority 4: Chat Page
**File**: `/src/app/chat/[chatId]/page.js`

**Required Changes**:
```javascript
// Use chat store
import { useChatStore } from '@/lib/store';
const { getChat, addMessage, setChatLoading } = useChatStore();

// Persist chat messages
const chat = getChat(sourceId);

// Add message to store
addMessage(sourceId, { role: 'user', content: question });
addMessage(sourceId, { role: 'assistant', content: answer });
```

### Priority 5: Add Source Page
**File**: `/src/app/add-source/page.js`

**Required Changes**:
```javascript
// Use sources store
import { useSourcesStore } from '@/lib/store';
const { addSource } = useSourcesStore();

// Add to store after creation
const result = await transcriptAPI.processVideos({ url, title });
addSource(result);
```

## 📦 Additional Components to Create

### Toast Notification Component
**Create**: `/src/components/Toast.jsx`

```javascript
import { useAppStore } from '@/lib/store';

export default function Toast() {
  const { toast, hideToast } = useAppStore();

  if (!toast) return null;

  return (
    <div className="fixed bottom-4 right-4 fade-in">
      <div className={`px-6 py-4 rounded-lg shadow-lg ${
        toast.type === 'success' ? 'bg-green-500' :
        toast.type === 'error' ? 'bg-red-500' :
        'bg-blue-500'
      } text-white`}>
        {toast.message}
      </div>
    </div>
  );
}
```

### Error Boundary
**Create**: `/src/components/ErrorBoundary.jsx`

```javascript
'use client';
import { Component } from 'react';

export default class ErrorBoundary extends Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600">Something went wrong</h1>
            <button onClick={() => window.location.reload()} className="btn-primary mt-4">
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
```

### Pagination Controls
**Create**: `/src/components/Pagination.jsx`

```javascript
export default function Pagination({ currentPage, totalPages, onPageChange }) {
  return (
    <div className="flex justify-center gap-2 mt-6">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="btn-secondary"
      >
        Previous
      </button>

      <span className="px-4 py-2 text-gray-700">
        Page {currentPage} of {totalPages}
      </span>

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="btn-secondary"
      >
        Next
      </button>
    </div>
  );
}
```

## 🚀 Quick Start Guide

### 1. Install Dependencies
```bash
cd youtube-rag-frontend
npm install
```

### 2. Configure Environment
```bash
# .env.local is already created with default values
# Update NEXT_PUBLIC_API_URL if backend is not on localhost:5000
```

### 3. Start Backend API
```bash
cd ../youtube-transcript-rag
python run.py
```

### 4. Start Frontend
```bash
cd ../youtube-rag-frontend
npm run dev
```

### 5. Access Application
Open http://localhost:3000

## 🔧 Configuration

### API URL
Update `NEXT_PUBLIC_API_URL` in `.env.local` to point to your backend:
- Local: `http://localhost:5000`
- Production: `https://your-api-domain.com`

### Token Expiry
Match frontend token expiry with backend:
- Backend: `JWT_ACCESS_TOKEN_EXPIRES=3600` (1 hour)
- Frontend: `NEXT_PUBLIC_TOKEN_EXPIRY=3600` (1 hour)

## 📊 Architecture

```
Frontend Architecture:
├── API Layer (/src/lib/api.js)
│   ├── Axios instance with interceptors
│   ├── Automatic token injection
│   └── Token refresh on 401
│
├── Auth Layer (/src/lib/auth.js)
│   ├── Token management
│   ├── Session handling
│   └── Auto-refresh mechanism
│
├── State Layer (/src/lib/store.js)
│   ├── User Store (Zustand)
│   ├── Sources Store (Zustand)
│   ├── Chat Store (Zustand + Persist)
│   └── App Store (Zustand)
│
├── UI Layer
│   ├── Pages (Next.js App Router)
│   ├── Components (React)
│   └── Styles (Tailwind CSS)
│
└── Utilities
    ├── Loading Skeletons
    ├── Error Boundary
    └── Toast Notifications
```

## 🔐 Security Features

- JWT tokens in localStorage (consider httpOnly cookies for production)
- Automatic token refresh
- Request/response interceptors
- Protected routes
- CORS handling
- Rate limiting awareness

## 🎨 Design System

### Colors
- Primary: `#0f172a` (Slate 900)
- Accent: `#3b82f6` (Blue 500)
- Success: Green 500/600
- Error: Red 500/600
- Warning: Yellow 500

### Animations
- Fade in: 0.3s ease-in
- Slide in: 0.4s ease-out
- Scale in: 0.3s ease-out
- Button active: scale-95
- Hover effects: shadow transitions

## 📝 Development Notes

### State Management
- Zustand is now properly configured and ready to use
- Stores include dev tools for debugging
- Chat messages persist in localStorage
- Optimistic updates for better UX

### Error Handling
- Global axios interceptors
- Token refresh on 401
- User-friendly error messages
- Loading states for all operations

### Performance
- Pagination on source lists
- Lazy loading for images
- Optimized re-renders with Zustand
- Skeleton screens for perceived performance

## 🐛 Known Issues & TODO

1. Need to update dashboard page to use new pagination
2. Need to integrate toast notifications
3. Consider adding WebSocket for real-time status updates
4. Add E2E tests
5. Implement proper error boundary
6. Add request caching for frequently accessed data

## 📚 Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Zustand Documentation](https://zustand-demo.pmnd.rs/)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Axios Documentation](https://axios-http.com/)

## 🤝 Contributing

When making changes:
1. Update this document
2. Follow existing code style
3. Test thoroughly
4. Update type definitions if using TypeScript

---

**Last Updated**: 2025-11-15
**Version**: 1.0.0
**Status**: Core infrastructure complete, minor component updates needed
