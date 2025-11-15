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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50/30">
      <Header />

      <main className="max-w-4xl mx-auto px-6 py-10">
        <button
          onClick={() => router.push('/dashboard')}
          className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 hover:border-gray-300 rounded-xl px-5 py-2.5 flex items-center gap-2 font-medium transition-all duration-200 active:scale-95 shadow-sm mb-8 fade-in"
        >
          <ArrowLeft size={18} />
          <span>Back to Dashboard</span>
        </button>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 md:p-10 fade-in">
          <div className="mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-blue-500/30">
              <Plus className="text-white" size={32} />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Add New Source</h1>
            <p className="text-gray-600">Process YouTube videos or playlists for AI-powered Q&A</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-5 py-4 rounded-xl text-sm fade-in flex items-start gap-3">
                <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-300 px-6 py-6 rounded-2xl fade-in shadow-lg">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg">
                    <svg className="w-6 h-6 text-white" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                      <path d="M5 13l4 4L19 7"></path>
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-green-900 text-lg">Source Created Successfully!</p>
                    <p className="text-sm text-green-700 mt-1">Your video is now being processed in the background. You can start chatting once it's ready!</p>
                  </div>
                </div>
                <div className="mt-4 p-4 bg-white rounded-xl border border-green-200 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Source ID</p>
                      <p className="text-sm text-gray-900 font-mono">{sourceId}</p>
                    </div>
                    <div className="px-3 py-1.5 bg-yellow-50 border border-yellow-200 rounded-full">
                      <p className="text-xs font-semibold text-yellow-700">Processing...</p>
                    </div>
                  </div>
                </div>
                <div className="mt-6 text-center">
                  <p className="text-sm text-green-800 mb-3">
                    Redirecting to dashboard in <span className="inline-flex items-center justify-center w-8 h-8 bg-green-500 text-white font-bold text-lg rounded-full mx-1">{countdown}</span> seconds
                  </p>
                  <button
                    type="button"
                    onClick={() => router.push('/dashboard')}
                    className="text-sm text-green-700 hover:text-green-900 font-medium underline decoration-2 underline-offset-2 transition-colors"
                  >
                    Go to dashboard now →
                  </button>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                YouTube URL <span className="text-red-500">*</span>
              </label>
              <input
                type="url"
                value={url}
                onChange={handleUrlChange}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-accent focus:ring-4 focus:ring-accent/10 outline-none transition-all duration-200 text-gray-900 placeholder-gray-400"
                placeholder="https://www.youtube.com/watch?v=..."
                required
              />
              <p className="text-xs text-gray-500 mt-2 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
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
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Custom Title <span className="text-gray-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-accent focus:ring-4 focus:ring-accent/10 outline-none transition-all duration-200 text-gray-900 placeholder-gray-400"
                placeholder="My Video Collection"
              />
              <p className="text-xs text-gray-500 mt-2 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                Leave blank to auto-fetch the video's title
              </p>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !url}
              className="w-full bg-accent hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-xl px-6 py-4 flex items-center justify-center gap-3 font-semibold text-lg transition-all duration-200 active:scale-[0.98] shadow-lg shadow-blue-500/30 disabled:shadow-none"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="animate-spin" size={24} />
                  <span>Processing Video...</span>
                </>
              ) : (
                <>
                  <Plus size={24} />
                  <span>Add Source</span>
                </>
              )}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
