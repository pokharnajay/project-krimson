'use client';

import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';

export default function VideoList({ videos, onAddToStore }) {
  return (
    <div className="space-y-3">
      {videos.map((video) => (
        <div
          key={video.id}
          className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:shadow-sm transition-shadow"
        >
          <div className="flex items-center gap-4">
            <img
              src={video.thumbnail || `https://img.youtube.com/vi/${video.id}/default.jpg`}
              alt={video.title}
              className="w-24 h-16 rounded object-cover"
            />
            <div>
              <h4 className="font-medium text-gray-900 text-sm">{video.title || video.id}</h4>
              <p className="text-xs text-gray-500 mt-1">{video.id}</p>
            </div>
          </div>

          {video.status === 'processing' && (
            <Loader2 className="animate-spin text-yellow-600" size={20} />
          )}
          {video.status === 'ready' && (
            <CheckCircle2 className="text-green-600" size={20} />
          )}
          {video.status === 'error' && (
            <XCircle className="text-red-600" size={20} />
          )}
        </div>
      ))}
    </div>
  );
}
