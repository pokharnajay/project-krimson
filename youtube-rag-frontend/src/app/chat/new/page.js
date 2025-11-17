'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Send, Loader2, ChevronDown } from 'lucide-react';
import Header from '@/components/Header';
import ChatSidebar from '@/components/ChatSidebar';
import { queryAPI, transcriptAPI } from '@/lib/api';

// OpenRouter models list
const MODELS = [
  { id: 'openai/gpt-oss-120b', name: 'GPT OSS 120B - Paid' },
  { id: 'openrouter/sherlock-dash-alpha', name: 'Sherlock Dash Alpha⚡️' },
  { id: 'openrouter/sherlock-think-alpha', name: 'Sherlock Think Alpha🧠' },
  { id: 'kwaipilot/kat-coder-pro:free', name: 'Kwaipilot: KAT-Coder-Pro V1 (free)' },
  { id: 'qwen/qwen3-coder:free', name: 'Llama 3.1 70B' },
  { id: 'google/gemini-2.0-flash-exp:free', name: 'Google: Gemini 2.0 Flash Experimental (free)' },
  { id: 'nvidia/nemotron-nano-9b-v2:free', name: 'NVIDIA: Nemotron Nano 9B V2 (free)' },
  { id: 'deepseek/deepseek-chat-v3.1:free', name: 'DeepSeek: DeepSeek V3.1 (free)' },
];

export default function NewChatPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sourceId = searchParams.get('sourceId');

  const [source, setSource] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState(MODELS[0]);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const messagesEndRef = useRef(null);

  // Load source information
  useEffect(() => {
    if (!sourceId) {
      router.push('/dashboard');
      return;
    }

    const loadSource = async () => {
      try {
        const sources = await transcriptAPI.getAllSources();
        const foundSource = sources.sources.find(s => s.id === sourceId);

        if (!foundSource) {
          console.error('Source not found');
          router.push('/dashboard');
          return;
        }

        if (foundSource.status !== 'ready') {
          alert('This source is not ready yet. Please wait until processing is complete.');
          router.push('/dashboard');
          return;
        }

        setSource(foundSource);
      } catch (error) {
        console.error('Failed to load source:', error);
        router.push('/dashboard');
      }
    };

    loadSource();
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
      // Send message WITHOUT chat_id - backend will create chat after getting response
      const response = await queryAPI.ask(source.id, userMessage, selectedModel.id, null);

      // Add AI response with sources
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: response.answer,
          primarySource: response.primary_source,
        },
      ]);

      // If this was the first message, redirect to the created chat
      if (response.chat_id && messages.length === 0) {
        // Replace the URL with the new chat ID
        router.replace(`/chat/${response.chat_id}`);
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'error',
          content: error.response?.data?.message || error.response?.data?.error || 'Failed to get response',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!source) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="animate-spin text-claude-muted" size={24} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <ChatSidebar
        isOpen={sidebarOpen}
        onToggle={setSidebarOpen}
        currentChatId={null}
      />

      <Header sourceTitle={source.title} />

      {/* Chat Messages Area */}
      <main className={`flex-1 overflow-y-auto transition-all duration-300 ${
        sidebarOpen ? 'ml-80' : 'ml-12'
      }`}>
        <div className="max-w-3xl mx-auto px-4 py-8">
          {messages.length === 0 && (
            <div className="text-center py-16">
              <p className="text-claude-muted text-sm mb-8">
                Ask questions about this source
              </p>
            </div>
          )}

          <div className="space-y-6">
            {messages.map((message, index) => (
              <div key={index}>
                {message.role === 'user' ? (
                  <div className="flex justify-end mb-4">
                    <div className="max-w-[80%] bg-claude-bg rounded-lg px-4 py-3 border border-claude-border">
                      <p className="text-[15px] leading-relaxed text-claude-text">{message.content}</p>
                    </div>
                  </div>
                ) : message.role === 'error' ? (
                  <div className="flex justify-start mb-4">
                    <div className="max-w-[80%] bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3">
                      <p className="text-[15px] leading-relaxed">{message.content}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-start mb-4">
                    <div className="max-w-[80%]">
                      <p className="text-[15px] leading-relaxed text-claude-text whitespace-pre-wrap mb-3">
                        {message.content}
                      </p>

                      {/* Primary Source Link */}
                      {message.primarySource && (
                        <a
                          href={message.primarySource.youtube_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs text-accent hover:underline"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                          <span>Watch at {Math.floor(message.primarySource.start_time)}s</span>
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start mb-4">
                <div className="px-4 py-3">
                  <Loader2 className="animate-spin text-claude-muted" size={16} />
                </div>
              </div>
            )}
          </div>

          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Fixed Input at Bottom */}
      <div className={`border-t border-claude-border bg-white transition-all duration-300 ${
        sidebarOpen ? 'ml-80' : 'ml-12'
      }`}>
        <div className="max-w-3xl mx-auto px-4 py-4">
          <form onSubmit={handleSubmit} className="flex items-end gap-2">
            {/* Model Selector */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowModelDropdown(!showModelDropdown)}
                className="h-10 px-3 text-xs text-claude-muted border border-claude-border rounded-lg hover:bg-claude-bg flex items-center gap-1.5 whitespace-nowrap"
              >
                <span>{selectedModel.name}</span>
                <ChevronDown size={14} />
              </button>

              {showModelDropdown && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowModelDropdown(false)}
                  />
                  <div className="absolute bottom-full left-0 mb-2 w-56 bg-white border border-claude-border rounded-lg shadow-lg overflow-hidden z-20">
                    {MODELS.map((model) => (
                      <button
                        key={model.id}
                        type="button"
                        onClick={() => {
                          setSelectedModel(model);
                          setShowModelDropdown(false);
                        }}
                        className={`w-full text-left px-4 py-2.5 text-sm hover:bg-claude-bg transition-colors ${
                          selectedModel.id === model.id ? 'bg-claude-bg text-claude-text font-medium' : 'text-claude-muted'
                        }`}
                      >
                        {model.name}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Input Field */}
            <div className="flex-1 border border-claude-border rounded-lg overflow-hidden focus-within:border-accent transition-colors">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ask a question..."
                className="w-full px-4 py-2.5 text-[15px] outline-none text-claude-text placeholder-claude-muted"
                disabled={isLoading}
                autoFocus
              />
            </div>

            {/* Send Button */}
            <button
              type="submit"
              disabled={isLoading || !inputValue.trim()}
              className="h-10 px-4 bg-accent hover:bg-accent/90 disabled:bg-claude-border disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
            >
              {isLoading ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                <>
                  <Send size={16} />
                  <span>Send</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
