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
    <div className="group bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 border border-gray-100 hover:border-accent/30 flex flex-col h-[280px]">
      {/* Card Header with Status Badge */}
      <div className="p-5 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-sm">
              <Video className="text-white" size={20} />
            </div>
            <div className="flex-1 min-w-0">
              {/* Title with tooltip */}
              <div className="group/title relative">
                <h3
                  className="font-semibold text-base text-gray-900 truncate cursor-default"
                  title={source.title}
                >
                  {source.title}
                </h3>
                {/* Tooltip - shows on hover if title is truncated */}
                {source.title.length > 30 && (
                  <div className="absolute left-0 top-full mt-1 hidden group-hover/title:block z-50 bg-gray-900 text-white text-xs px-3 py-2 rounded-lg shadow-xl max-w-xs whitespace-normal">
                    {source.title}
                    <div className="absolute -top-1 left-4 w-2 h-2 bg-gray-900 transform rotate-45"></div>
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {source.video_ids.length} video{source.video_ids.length > 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>

        {/* Status Badge */}
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
          source.status === 'ready'
            ? 'bg-green-50 text-green-700 border border-green-200'
            : source.status === 'failed'
            ? 'bg-red-50 text-red-700 border border-red-200'
            : 'bg-yellow-50 text-yellow-700 border border-yellow-200'
        }`}>
          {getStatusIcon()}
          <span>{getStatusText()}</span>
        </div>
      </div>

      {/* Card Body */}
      <div className="p-5 flex-1 flex flex-col justify-between">
        <div className="text-xs text-gray-500 mb-4">
          <div className="flex items-center gap-2">
            <Clock size={14} />
            <span>Created {new Date(source.created_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            })}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2">
          {/* Chat Button - Only show when ready */}
          {source.status === 'ready' && (
            <button
              onClick={handleChat}
              className="w-full bg-accent hover:bg-blue-600 text-white rounded-lg px-4 py-2.5 flex items-center justify-center gap-2 font-medium transition-all duration-200 active:scale-95 shadow-sm"
            >
              <MessageCircle size={18} />
              <span>Start Chat</span>
            </button>
          )}

          {/* Retry Button - Only show when failed */}
          {source.status === 'failed' && (
            <button
              onClick={handleRetry}
              disabled={isRetrying}
              className="w-full bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-300 text-white rounded-lg px-4 py-2.5 flex items-center justify-center gap-2 font-medium transition-all duration-200 active:scale-95 shadow-sm"
            >
              <RefreshCw size={18} className={isRetrying ? 'animate-spin' : ''} />
              <span>{isRetrying ? 'Retrying...' : 'Retry Processing'}</span>
            </button>
          )}

          {/* Processing State */}
          {source.status === 'processing' && (
            <div className="w-full bg-gray-100 text-gray-500 rounded-lg px-4 py-2.5 flex items-center justify-center gap-2 font-medium">
              <RefreshCw size={18} className="animate-spin" />
              <span>Processing...</span>
            </div>
          )}

          {/* Delete Button - Always show */}
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="w-full bg-white hover:bg-red-50 text-red-600 border border-red-200 hover:border-red-300 rounded-lg px-4 py-2 flex items-center justify-center gap-2 font-medium transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2 size={16} />
            <span className="text-sm">{isDeleting ? 'Deleting...' : 'Delete'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
