'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Send, Loader2, ChevronDown } from 'lucide-react';
import Header from '@/components/Header';
import ChatSidebar from '@/components/ChatSidebar';
import { queryAPI, chatAPI, transcriptAPI } from '@/lib/api';

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

export default function ChatPage({ params }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const chatId = params.chatId;
  const sourceId = searchParams.get('sourceId');

  const [chat, setChat] = useState(null);
  const [source, setSource] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState(MODELS[0]);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const messagesEndRef = useRef(null);

  // Load chat and messages, or source if it's a new chat
  useEffect(() => {
    if (!chatId) return;

    const loadChatOrSource = async () => {
      try {
        // First, try to load existing chat
        try {
          const response = await chatAPI.getChat(chatId);
          setChat(response);
          setSource(response.sources);

          // Convert database messages to UI format
          const formattedMessages = (response.messages || []).map((msg) => ({
            role: msg.role,
            content: msg.content,
            primarySource: msg.primary_source,
          }));
          setMessages(formattedMessages);
          return; // Successfully loaded chat
        } catch (chatError) {
          // Chat doesn't exist yet, check if we have sourceId for new chat
          if (sourceId) {
            // Load source for new chat
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
            setMessages([]); // New chat, no messages yet
          } else {
            // No chat found and no sourceId provided
            console.error('Chat not found and no sourceId provided');
            router.push('/dashboard');
          }
        }
      } catch (error) {
        console.error('Failed to load chat or source:', error);
        router.push('/dashboard');
      }
    };

    loadChatOrSource();
  }, [chatId, sourceId, router]);

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
      // Pass the selected model and chatId to the backend
      const response = await queryAPI.ask(source.id, userMessage, selectedModel.id, chatId);

      // Add AI response with sources
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: response.answer,
          primarySource: response.primary_source,
        },
      ]);

      // If this was the first message (new chat), clean up the URL
      if (sourceId && messages.length === 0) {
        // Remove sourceId from URL after first message
        router.replace(`/chat/${chatId}`, { scroll: false });
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
        currentChatId={chatId}
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
                    <div className="max-w-[80%] bg-claude-bg rounded-lg px-4 border border-claude-border py-3">
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
                    <div className="max-w-[80%] space-y-3 bg-claude-bg py-3 rounded-lg border border-claude-border">
                      {(() => {
                        // Try to parse content as JSON with response array
                        try {
                          const parsed = typeof message.content === 'string'
                            ? JSON.parse(message.content)
                            : message.content;

                          if (parsed.response && Array.isArray(parsed.response)) {
                            // Display each response item separately with its own YouTube link
                            return parsed.response.map((item, idx) => (
                              <div key={idx} className="bg-transparent rounded-lg px-4">
                                <p className="text-[15px] leading-relaxed text-claude-text whitespace-pre-wrap mb-0">
                                  {item.text}
                                </p>
                                {item.youtube_link && (
                                  <a
                                    href={item.youtube_link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 text-xs text-accent hover:underline font-medium"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                                      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                                    </svg>
                                    <span>Watch on YouTube at {item.timestamp}s</span>
                                  </a>
                                )}
                              </div>
                            ));
                          }
                        } catch (e) {
                          // Not JSON or doesn't have response array, fall through to default
                        }

                        // Default: display as plain text with optional primarySource
                        return (
                          <div className="bg-transparent rounded-lg px-4">
                            <p className="text-[15px] leading-relaxed text-claude-text whitespace-pre-wrap mb-2">
                              {message.content}
                            </p>
                            {message.primarySource && (
                              <a
                                href={message.primarySource.youtube_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-xs text-accent hover:underline font-medium"
                              >
                                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                                </svg>
                                <span>Watch on YouTube at {Math.floor(message.primarySource.start_time)}s</span>
                              </a>
                            )}
                          </div>
                        );
                      })()}
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
