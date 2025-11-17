/**
 * Loading Skeleton Components
 * Provides placeholder loading states with smooth animations
 */

export function SourceCardSkeleton() {
  return (
    <div className="card animate-pulse">
      <div className="flex items-start gap-4">
        {/* Thumbnail skeleton */}
        <div className="w-32 h-20 bg-gray-200 rounded-lg flex-shrink-0"></div>

        {/* Content skeleton */}
        <div className="flex-1 space-y-3">
          <div className="h-5 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="flex gap-2">
            <div className="h-6 bg-gray-200 rounded-full w-20"></div>
            <div className="h-6 bg-gray-200 rounded-full w-24"></div>
          </div>
        </div>

        {/* Actions skeleton */}
        <div className="flex gap-2">
          <div className="w-8 h-8 bg-gray-200 rounded"></div>
          <div className="w-8 h-8 bg-gray-200 rounded"></div>
        </div>
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(5)].map((_, i) => (
        <SourceCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function ChatMessageSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      {/* User message skeleton */}
      <div className="flex justify-end">
        <div className="bg-gray-200 rounded-2xl px-4 py-2 w-64 h-12"></div>
      </div>

      {/* Assistant message skeleton */}
      <div className="flex justify-start">
        <div className="space-y-2 w-full max-w-2xl">
          <div className="bg-gray-200 rounded-2xl px-4 py-2 h-20"></div>
          <div className="bg-gray-200 rounded-2xl px-4 py-2 h-16 w-3/4"></div>
        </div>
      </div>
    </div>
  );
}

export function HeaderSkeleton() {
  return (
    <div className="bg-primary shadow-md animate-pulse">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="h-8 bg-gray-700 rounded w-48"></div>
          <div className="flex items-center gap-6">
            <div className="h-6 bg-gray-700 rounded w-32"></div>
            <div className="w-10 h-10 bg-gray-700 rounded-full"></div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Spinner({ size = 'md', className = '' }) {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
  };

  return (
    <div className={`inline-block ${sizes[size]} ${className}`}>
      <div className="w-full h-full border-4 border-gray-200 border-t-accent rounded-full animate-spin"></div>
    </div>
  );
}

export function LoadingOverlay({ message = 'Loading...' }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 flex flex-col items-center gap-4">
        <Spinner size="lg" />
        <p className="text-gray-700 font-medium">{message}</p>
      </div>
    </div>
  );
}

export default {
  SourceCardSkeleton,
  DashboardSkeleton,
  ChatMessageSkeleton,
  HeaderSkeleton,
  Spinner,
  LoadingOverlay,
};
