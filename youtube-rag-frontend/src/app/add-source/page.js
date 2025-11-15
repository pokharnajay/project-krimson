'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Loader2, Video } from 'lucide-react';
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
  const [videoId, setVideoId] = useState(null);
  const [playlistVideos, setPlaylistVideos] = useState([]);
  const [isPlaylist, setIsPlaylist] = useState(false);

  const extractVideoId = (url) => {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
    return match ? match[1] : null;
  };

  const extractPlaylistId = (url) => {
    const match = url.match(/[&?]list=([^&\s]+)/);
    return match ? match[1] : null;
  };

  const handleUrlChange = async (e) => {
    const newUrl = e.target.value;
    setUrl(newUrl);
    setError('');
    setVideoId(null);
    setPlaylistVideos([]);
    setIsPlaylist(false);

    if (!newUrl) return;

    // Check if playlist
    const playlistId = extractPlaylistId(newUrl);
    if (playlistId) {
      setIsPlaylist(true);
      try {
        // Fetch playlist info (using YouTube oEmbed or your backend)
        const response = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(newUrl)}&format=json`);
        const data = await response.json();
        
        // For demo, show placeholder videos
        // In production, call your backend to get actual playlist videos
        setPlaylistVideos([
          { id: '1', title: 'Loading playlist videos...' },
          { id: '2', title: 'Please wait...' }
        ]);
      } catch (err) {
        setError('Invalid playlist URL');
      }
    } else {
      // Single video
      const vidId = extractVideoId(newUrl);
      if (vidId) {
        setVideoId(vidId);
      } else {
        setError('Invalid YouTube URL');
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setIsSubmitting(true);

    try {
      const response = await transcriptAPI.processVideos({
        url: url,
        title: title || undefined
      });

      console.log('Process response:', response);

      // Success! Show message and start countdown
      setSourceId(response.source_id);
      setSuccess(true);
      setIsSubmitting(false);

      // Start countdown timer
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
      console.error('Process error:', err);
      setError(err.response?.data?.message || err.response?.data?.error || 'Failed to process video');
      setIsSubmitting(false);
    }
  };
  

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-4xl mx-auto px-6 py-8">
        <button
          onClick={() => router.push('/dashboard')}
          className="btn-secondary flex items-center gap-2 mb-6"
        >
          <ArrowLeft size={20} />
          Back to Dashboard
        </button>

        <div className="bg-white rounded-xl shadow-md p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Add New Source</h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {success && (
              <div className="bg-green-50 border-2 border-green-500 px-6 py-4 rounded-lg">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                      <path d="M5 13l4 4L19 7"></path>
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-green-800">Source Created Successfully!</p>
                    <p className="text-sm text-green-700">Your video is now being processed in the background.</p>
                  </div>
                </div>
                <div className="mt-3 p-3 bg-white rounded border border-green-200">
                  <p className="text-xs text-gray-600 font-mono">Source ID: {sourceId}</p>
                  <p className="text-xs text-gray-600 mt-1">Status: <span className="font-semibold text-yellow-600">Processing</span></p>
                </div>
                <div className="mt-4 text-center">
                  <p className="text-sm text-green-700">
                    Redirecting to dashboard in <span className="font-bold text-lg">{countdown}</span> seconds...
                  </p>
                  <button
                    type="button"
                    onClick={() => router.push('/dashboard')}
                    className="mt-2 text-sm text-green-600 hover:text-green-800 underline"
                  >
                    Go to dashboard now
                  </button>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                YouTube URL *
              </label>
              <input
                type="url"
                value={url}
                onChange={handleUrlChange}
                className="input-field"
                placeholder="https://www.youtube.com/watch?v=..."
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Supports both individual videos and playlists
              </p>
            </div>

            {/* Video Preview */}
            {videoId && !isPlaylist && (
              <div className="border-2 border-gray-200 rounded-lg p-4">
                <p className="text-sm font-medium text-gray-700 mb-3">Video Preview:</p>
                <div className="aspect-video bg-black rounded-lg overflow-hidden">
                  <iframe
                    width="100%"
                    height="100%"
                    src={`https://www.youtube.com/embed/${videoId}`}
                    title="YouTube video player"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  ></iframe>
                </div>
              </div>
            )}

            {/* Playlist Preview */}
            {isPlaylist && playlistVideos.length > 0 && (
              <div className="border-2 border-gray-200 rounded-lg p-4">
                <p className="text-sm font-medium text-gray-700 mb-3">
                  Playlist (showing first 10 videos):
                </p>
                <div className="space-y-2">
                  {playlistVideos.slice(0, 10).map((video, idx) => (
                    <div key={video.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded">
                      <Video size={16} className="text-gray-400" />
                      <span className="text-sm text-gray-700">{idx + 1}. {video.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Custom Title (Optional)
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="input-field"
                placeholder="My Video Collection"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !url}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  Processing...
                </>
              ) : (
                <>
                  <Plus size={20} />
                  Add Source
                </>
              )}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
