'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Send, Loader2, ExternalLink } from 'lucide-react';
import Header from '@/components/Header';
import { queryAPI, transcriptAPI } from '@/lib/api';

export default function ChatPage({ params }) {  // ✅ Get params as prop
  const router = useRouter();
  const sourceId = params.chatid; // ✅ Access chatid from params prop
  
  const [source, setSource] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Fetch source details
  useEffect(() => {
    if (!sourceId) return;  // ✅ Guard clause
    
    const fetchSource = async () => {
      try {
        const response = await transcriptAPI.getSource(sourceId);
        setSource(response.data);
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
      const response = await queryAPI.ask(userMessage, source.video_ids, null);
      
      // Add AI response with sources
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: response.data.answer,
          sources: response.data.sources,
          primarySource: response.data.primary_source,
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

      <main className="flex-1 flex flex-col max-w-4xl w-full mx-auto px-6 py-8">
        <button
          onClick={() => router.push('/dashboard')}
          className="btn-secondary flex items-center gap-2 mb-6 self-start"
        >
          <ArrowLeft size={20} />
          Back to Dashboard
        </button>

        <div className="bg-white rounded-xl shadow-md flex-1 flex flex-col overflow-hidden">
          {/* Chat Header */}
          <div className="p-6 border-b">
            <h1 className="text-2xl font-bold text-gray-900">{source.title}</h1>
            <p className="text-sm text-gray-500 mt-1">
              Ask anything about {source.video_ids.length} video(s)
            </p>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.length === 0 && (
              <div className="text-center text-gray-500 py-12">
                <p className="text-lg">Start asking questions!</p>
                <p className="text-sm mt-2">I'll provide answers with YouTube timestamp links.</p>
              </div>
            )}

            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-4 ${
                    message.role === 'user'
                      ? 'bg-accent text-white'
                      : message.role === 'error'
                      ? 'bg-red-50 text-red-600'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>

                  {/* Show primary source link if available */}
                  {message.primarySource && (
                    <a
                      href={message.primarySource.youtube_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex items-center gap-2 text-sm text-blue-600 hover:underline"
                    >
                      <ExternalLink size={14} />
                      Watch at {Math.floor(message.primarySource.start_time)}s
                    </a>
                  )}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-lg p-4">
                  <Loader2 className="animate-spin text-gray-600" size={20} />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} className="p-6 border-t">
            <div className="flex gap-3">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ask a question..."
                className="input-field flex-1"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={isLoading || !inputValue.trim()}
                className="btn-primary flex items-center gap-2"
              >
                <Send size={20} />
                Send
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
