'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Send, Loader2, ChevronDown } from 'lucide-react';
import Header from '@/components/Header';
import ChatSidebar from '@/components/ChatSidebar';
import { queryAPI, chatAPI } from '@/lib/api';

// OpenRouter models list
const MODELS = [
  { id: 'openai/gpt-4o', name: 'GPT-4o' },
  { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' },
  { id: 'anthropic/claude-3-opus', name: 'Claude 3 Opus' },
  { id: 'google/gemini-pro-1.5', name: 'Gemini Pro 1.5' },
  { id: 'meta-llama/llama-3.1-70b-instruct', name: 'Llama 3.1 70B' },
  { id: 'mistralai/mistral-large', name: 'Mistral Large' },
  { id: 'perplexity/llama-3.1-sonar-huge-128k-online', name: 'Sonar Huge' },
  { id: 'cohere/command-r-plus', name: 'Command R+' },
];

export default function ChatPage({ params }) {
  const router = useRouter();
  const chatId = params.chatId;

  const [chat, setChat] = useState(null);
  const [source, setSource] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState(MODELS[0]);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const messagesEndRef = useRef(null);

  // Load chat and messages
  useEffect(() => {
    if (!chatId) return;

    const loadChat = async () => {
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
      } catch (error) {
        console.error('Failed to load chat:', error);
        router.push('/dashboard');
      }
    };

    loadChat();
  }, [chatId, router]);

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

  if (!source || !chat) {
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
