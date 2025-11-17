'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, ExternalLink } from 'lucide-react';
import { queryAPI } from '@/lib/api';

export default function ChatInterface({ sourceId, videoIds, onCreditsUpdate }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = {
      role: 'user',
      content: input,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await queryAPI.ask(input, videoIds);

      const assistantMessage = {
        role: 'assistant',
        responseSegments: response.data.response, // New format: array of {text, timestamp, video_id}
        sources: response.data.sources,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Update credits if the callback is provided and credits_remaining is in response
      if (onCreditsUpdate && response.data.credits_remaining !== undefined) {
        onCreditsUpdate(response.data.credits_remaining);
      }
    } catch (error) {
      console.error('Query error:', error);
      const errorMessage = {
        role: 'assistant',
        responseSegments: [{
          text: 'Sorry, I encountered an error. Please try again.',
          timestamp: null,
          video_id: null
        }],
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-180px)]">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 mt-12">
            <p className="text-lg">Start asking questions about your videos</p>
            <p className="text-sm mt-2">Try asking about the main topics, key points, or specific details</p>
          </div>
        )}

        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-3xl px-6 py-4 rounded-2xl ${
                message.role === 'user'
                  ? 'bg-accent text-white'
                  : 'bg-white border border-gray-200'
              }`}
            >
              {/* User message - simple text */}
              {message.role === 'user' && (
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {message.content}
                </p>
              )}

              {/* Assistant message - segmented with watch links */}
              {message.role === 'assistant' && message.responseSegments && (
                <div className="space-y-3">
                  {message.responseSegments.map((segment, segIdx) => (
                    <div key={segIdx} className="pb-2">
                      <p className="text-sm leading-relaxed whitespace-pre-wrap mb-1.5">
                        {segment.text}
                      </p>
                      {segment.timestamp !== null && segment.timestamp !== undefined && segment.video_id && (
                        <a
                          href={segment.youtube_link || `https://www.youtube.com/watch?v=${segment.video_id}&t=${segment.timestamp}s`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs text-accent hover:underline font-medium"
                        >
                          <ExternalLink size={12} />
                          <span>Watch at {Math.floor(segment.timestamp)}s</span>
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Fallback for old message format */}
              {message.role === 'assistant' && message.content && !message.responseSegments && (
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {message.content}
                </p>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 px-6 py-4 rounded-2xl">
              <Loader2 className="animate-spin text-accent" size={20} />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 bg-white p-6">
        <div className="flex gap-4">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask a question..."
            className="input-field flex-1"
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="btn-primary flex items-center gap-2"
          >
            <Send size={18} />
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
