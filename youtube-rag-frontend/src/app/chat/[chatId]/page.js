'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Send, Loader2, ExternalLink } from 'lucide-react';
import Header from '@/components/Header';
import { queryAPI, transcriptAPI } from '@/lib/api';

export default function ChatPage({ params }) {
  const router = useRouter();
  const sourceId = params.chatId; // Access chatId from params prop (Next.js uses camelCase)
  
  const [source, setSource] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Fetch source details
  useEffect(() => {
    if (!sourceId) return;

    const fetchSource = async () => {
      try {
        const response = await transcriptAPI.getSource(sourceId);
        setSource(response); // Backend returns object directly, not wrapped in .data
      } catch (error) {
        console.error('Failed to fetch source:', error);
        alert('Failed to load source');
        router.push('/dashboard');
      }
    };

    fetchSource();
  }, [sourceId, router]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading || !source) return;

    const userMessage = inputValue.trim();
    setInputValue('');

    // Add user message
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await queryAPI.ask(sourceId, userMessage);

      // Add AI response with sources
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: response.answer,
          sources: response.sources,
          primarySource: response.primary_source,
        },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'error',
          content: error.response?.data?.error || 'Failed to get response',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!source) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="animate-spin text-accent" size={48} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />

      {/* Chat Header with Source Info */}
      <div className="bg-white border-b border-gray-200 sticky top-16 z-40 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.push('/dashboard')}
              className="text-gray-600 hover:text-gray-900 transition-colors flex items-center gap-2"
            >
              <ArrowLeft size={18} />
              <span className="text-sm font-medium">Dashboard</span>
            </button>
            <div className="flex-1 text-center px-6">
              <h2 className="text-lg font-semibold text-gray-900 truncate">{source.title}</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {source.video_ids.length} video{source.video_ids.length > 1 ? 's' : ''}
              </p>
            </div>
            <div className="w-24"></div> {/* Spacer for symmetry */}
          </div>
        </div>
      </div>

      {/* Chat Messages Area */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-6">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 px-4">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg">
                <span className="text-white font-bold text-2xl">Y</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Ask me anything</h3>
              <p className="text-gray-500 text-center max-w-md">
                I'll search through the video transcripts and provide answers with timestamp links
              </p>
              <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl w-full">
                <div className="bg-white border border-gray-200 rounded-lg p-4 hover:border-accent transition-colors cursor-pointer">
                  <p className="text-sm text-gray-700">💡 "Summarize the main points"</p>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-4 hover:border-accent transition-colors cursor-pointer">
                  <p className="text-sm text-gray-700">🔍 "What was said about..."</p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-6">
            {messages.map((message, index) => (
              <div key={index} className="fade-in">
                {message.role === 'user' ? (
                  <div className="flex justify-end">
                    <div className="max-w-[85%] bg-accent text-white rounded-2xl px-5 py-3 shadow-sm">
                      <p className="text-[15px] leading-relaxed">{message.content}</p>
                    </div>
                  </div>
                ) : message.role === 'error' ? (
                  <div className="flex justify-start">
                    <div className="max-w-[85%] bg-red-50 border border-red-200 text-red-700 rounded-2xl px-5 py-3">
                      <p className="text-[15px] leading-relaxed">{message.content}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-start">
                    <div className="max-w-[85%]">
                      <div className="bg-white border border-gray-200 rounded-2xl px-5 py-4 shadow-sm">
                        <p className="text-[15px] leading-relaxed text-gray-800 whitespace-pre-wrap">
                          {message.content}
                        </p>

                        {/* Primary Source Link */}
                        {message.primarySource && (
                          <div className="mt-4 pt-3 border-t border-gray-100">
                            <a
                              href={message.primarySource.youtube_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 text-sm text-accent hover:text-blue-700 font-medium transition-colors group"
                            >
                              <ExternalLink size={16} className="group-hover:translate-x-0.5 transition-transform" />
                              <span>Watch at {Math.floor(message.primarySource.start_time)}s</span>
                            </a>
                          </div>
                        )}

                        {/* Additional Sources */}
                        {message.sources && message.sources.length > 1 && (
                          <details className="mt-3 pt-3 border-t border-gray-100">
                            <summary className="text-sm text-gray-600 cursor-pointer hover:text-gray-900 transition-colors">
                              View {message.sources.length - 1} more source{message.sources.length > 2 ? 's' : ''}
                            </summary>
                            <div className="mt-2 space-y-2">
                              {message.sources.slice(1, 4).map((src, idx) => (
                                <a
                                  key={idx}
                                  href={src.youtube_link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block text-sm text-blue-600 hover:text-blue-800 transition-colors"
                                >
                                  → {Math.floor(src.start_time)}s
                                </a>
                              ))}
                            </div>
                          </details>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start fade-in">
                <div className="bg-white border border-gray-200 rounded-2xl px-5 py-4 shadow-sm">
                  <Loader2 className="animate-spin text-accent" size={20} />
                </div>
              </div>
            )}
          </div>

          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Fixed Input at Bottom */}
      <div className="bg-white border-t border-gray-200 sticky bottom-0 z-40 shadow-lg">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <form onSubmit={handleSubmit}>
            <div className="flex items-center gap-3 bg-gray-50 rounded-2xl px-4 py-2 border border-gray-200 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20 transition-all">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ask a question..."
                className="flex-1 bg-transparent outline-none text-[15px] text-gray-900 placeholder-gray-400"
                disabled={isLoading}
                autoFocus
              />
              <button
                type="submit"
                disabled={isLoading || !inputValue.trim()}
                className="bg-accent hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-xl px-4 py-2 flex items-center gap-2 transition-all duration-200 active:scale-95"
              >
                {isLoading ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <>
                    <Send size={18} />
                    <span className="text-sm font-medium">Send</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
