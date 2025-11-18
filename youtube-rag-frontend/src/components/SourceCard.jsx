'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, RefreshCw, CheckCircle, XCircle, Clock, MessageCircle } from 'lucide-react';
import { transcriptAPI, chatAPI } from '@/lib/api';

export default function SourceCard({ source, onUpdate }) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this source?')) return;

    setIsDeleting(true);
    try {
      await transcriptAPI.deleteSource(source.id);
      onUpdate();
    } catch (error) {
      alert('Failed to delete source');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await transcriptAPI.retrySource(source.id);
      onUpdate();
    } catch (error) {
      alert('Failed to retry source');
    } finally {
      setIsRetrying(false);
    }
  };

  const handleChat = () => {
    // Generate a new chat ID and navigate directly to chat page
    const chatId = crypto.randomUUID();
    router.push(`/chat/${chatId}?sourceId=${source.id}`);
  };

  const getStatusDisplay = () => {
    switch (source.status) {
      case 'ready':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs text-green-600">
            <CheckCircle size={14} />
            Ready
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs text-red-600">
            <XCircle size={14} />
            Failed
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs text-amber-600">
            <Clock size={14} className="animate-spin" />
            Processing
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="border border-claude-border rounded-lg p-4 hover:border-accent transition-colors bg-white">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0 mr-2">
          <div className="group relative">
            <h3 className="text-sm font-medium text-claude-text truncate mb-1">
              {source.title}
            </h3>
            {/* Immediate tooltip on hover */}
            <div className="invisible group-hover:visible absolute left-0 top-full mt-1 z-50 max-w-xs bg-gray-900 text-white text-xs rounded py-1 px-2 whitespace-normal break-words shadow-lg">
              {source.title}
            </div>
          </div>
          <p className="text-xs text-claude-muted">
            {source.video_ids.length} video{source.video_ids.length > 1 ? 's' : ''}
          </p>
        </div>
        {getStatusDisplay()}
      </div>

      {/* Date */}
      <p className="text-xs text-claude-muted mb-4">
        {new Date(source.created_at).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })}
      </p>

      {/* Actions */}
      <div className="flex gap-2">
        {source.status === 'ready' && (
          <button
            onClick={handleChat}
            className="flex-1 px-3 py-2 bg-accent hover:bg-accent/90 text-white rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
          >
            <MessageCircle size={14} />
            Chat
          </button>
        )}

        {source.status === 'failed' && (
          <button
            onClick={handleRetry}
            disabled={isRetrying}
            className="flex-1 px-3 py-2 border border-claude-border hover:bg-claude-bg text-claude-text rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw size={14} className={isRetrying ? 'animate-spin' : ''} />
            Retry
          </button>
        )}

        {source.status === 'processing' && (
          <div className="flex-1 px-3 py-2 bg-claude-bg text-claude-muted rounded-lg text-xs font-medium flex items-center justify-center gap-1.5">
            <RefreshCw size={14} className="animate-spin" />
            Processing
          </div>
        )}

        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="px-3 py-2 border border-red-200 hover:bg-red-50 text-red-600 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50"
        >
          <Trash2 size={14} />
          {isDeleting ? 'Deleting...' : 'Delete'}
        </button>
      </div>
    </div>
  );
}
