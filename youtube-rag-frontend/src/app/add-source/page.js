'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import Header from '@/components/Header';
import { transcriptAPI } from '@/lib/api';

export default function AddSourcePage() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [sourceId, setSourceId] = useState(null);
  const [countdown, setCountdown] = useState(5);
  const [videoPreview, setVideoPreview] = useState(null);

  // Extract video ID from YouTube URL
  const extractVideoId = (url) => {
    if (!url) return null;

    // Handle different YouTube URL formats
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/,
      /youtube\.com\/embed\/([^&\n?#]+)/,
      /youtube\.com\/v\/([^&\n?#]+)/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return null;
  };

  // Update video preview when URL changes
  useEffect(() => {
    const videoId = extractVideoId(url);
    if (videoId) {
      setVideoPreview({
        id: videoId,
        thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      });
    } else {
      setVideoPreview(null);
    }
  }, [url]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!url.trim()) {
      setError('Please enter a YouTube URL');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const response = await transcriptAPI.processVideos({
        url,
        title: title.trim() || undefined,
      });

      setSourceId(response.source_id);
      setSuccess(true);

      // Countdown redirect
      let timeLeft = 5;
      const timer = setInterval(() => {
        timeLeft -= 1;
        setCountdown(timeLeft);
        if (timeLeft <= 0) {
          clearInterval(timer);
          router.push('/dashboard');
        }
      }, 1000);
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Failed to process video');
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <main className="max-w-2xl mx-auto px-6 py-16 text-center">
          <div className="mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mb-4">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-medium text-claude-text mb-2">Source Created</h2>
            <p className="text-sm text-claude-muted">Processing started in the background</p>
          </div>

          <div className="bg-claude-bg border border-claude-border rounded-lg p-4 mb-6">
            <p className="text-xs text-claude-muted mb-1">Source ID</p>
            <p className="text-sm font-mono text-claude-text">{sourceId}</p>
          </div>

          <p className="text-sm text-claude-muted mb-4">
            Redirecting to dashboard in {countdown}s
          </p>

          <button
            onClick={() => router.push('/dashboard')}
            className="text-sm text-accent hover:underline"
          >
            Go to dashboard now →
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <Header />

      <main className="max-w-2xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-medium text-claude-text mb-2">Add New Source</h1>
          <p className="text-sm text-claude-muted">
            Process YouTube videos or playlists for Q&A
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-claude-text mb-2">
              YouTube URL *
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full px-4 py-2.5 border border-claude-border rounded-lg focus:outline-none focus:border-accent transition-colors text-claude-text text-sm"
              placeholder="https://www.youtube.com/watch?v=..."
              required
            />
            <p className="text-xs text-claude-muted mt-1.5">
              Supports both individual videos and playlists
            </p>

            {/* Video Preview */}
            {videoPreview && (
              <div className="mt-4 border border-claude-border rounded-lg overflow-hidden bg-white">
                <div className="flex items-start gap-3 p-3">
                  <img
                    src={videoPreview.thumbnail}
                    alt="Video thumbnail"
                    className="w-32 h-24 object-cover rounded"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-green-600 font-medium mb-1">
                      ✓ Valid YouTube URL detected
                    </p>
                    <p className="text-xs text-claude-muted">
                      Video ID: {videoPreview.id}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-claude-text mb-2">
              Custom Title <span className="text-claude-muted font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2.5 border border-claude-border rounded-lg focus:outline-none focus:border-accent transition-colors text-claude-text text-sm"
              placeholder="My Video Collection"
            />
            <p className="text-xs text-claude-muted mt-1.5">
              Leave blank to auto-fetch the video's title
            </p>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !url.trim()}
            className="w-full px-4 py-2.5 bg-accent hover:bg-accent/90 disabled:bg-claude-border disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="animate-spin" size={16} />
                <span>Processing...</span>
              </>
            ) : (
              <span>Add Source</span>
            )}
          </button>
        </form>
      </main>
    </div>
  );
}
