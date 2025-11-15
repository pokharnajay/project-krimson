'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, RefreshCw, Video, Clock, CheckCircle, XCircle, MessageCircle } from 'lucide-react';
import { transcriptAPI } from '@/lib/api';

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
    // Navigate to dynamic chat page with source ID
    router.push(`/chat/${source.id}`);
  };

  const getStatusIcon = () => {
    switch (source.status) {
      case 'ready':
        return <CheckCircle className="text-green-500" size={20} />;
      case 'failed':
        return <XCircle className="text-red-500" size={20} />;
      case 'processing':
        return <Clock className="text-yellow-500 animate-pulse" size={20} />;
      default:
        return null;
    }
  };

  const getStatusText = () => {
    switch (source.status) {
      case 'ready':
        return 'Ready';
      case 'failed':
        return 'Failed';
      case 'processing':
        return 'Processing...';
      default:
        return 'Unknown';
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <Video className="text-accent" size={24} />
          <div>
            <h3 className="font-semibold text-lg text-gray-900">{source.title}</h3>
            <p className="text-sm text-gray-500">{source.video_ids.length} video(s)</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <span className="text-sm font-medium">{getStatusText()}</span>
        </div>
      </div>

      <div className="text-sm text-gray-600 mb-4">
        Created: {new Date(source.created_at).toLocaleDateString()}
      </div>

      <div className="flex gap-2">
        {/* Chat Button - Only show when ready */}
        {source.status === 'ready' && (
          <button
            onClick={handleChat}
            className="btn-primary flex items-center gap-2 flex-1"
          >
            <MessageCircle size={16} />
            Chat
          </button>
        )}

        {/* Retry Button - Only show when failed */}
        {source.status === 'failed' && (
          <button
            onClick={handleRetry}
            disabled={isRetrying}
            className="btn-secondary flex items-center gap-2 flex-1"
          >
            <RefreshCw size={16} className={isRetrying ? 'animate-spin' : ''} />
            {isRetrying ? 'Retrying...' : 'Retry'}
          </button>
        )}
        
        {/* Delete Button - Always show */}
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="btn-danger flex items-center gap-2"
        >
          <Trash2 size={16} />
          {isDeleting ? 'Deleting...' : 'Delete'}
        </button>
      </div>
    </div>
  );
}
