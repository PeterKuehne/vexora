/**
 * ChatContainer Component
 *
 * Main chat interface that combines:
 * - Message list
 * - Chat input
 * - Streaming state management
 */

import { useRef, useEffect } from 'react';
import { MessageBubble } from './MessageBubble';
import { ChatInput } from './ChatInput';
import { useChatStream } from '../hooks/useChatStream';
import { Bot } from 'lucide-react';

export interface ChatContainerProps {
  /** Model to use for chat */
  model?: string | undefined;
}

export function ChatContainer({ model }: ChatContainerProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    isStreaming,
    error,
    sendMessage,
    stopStream,
  } = useChatStream({
    model,
    onError: (err) => {
      console.error('Chat error:', err);
    },
  });

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex flex-col h-full">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {messages.length === 0 ? (
          // Empty State
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
              <Bot size={32} />
            </div>
            <h2 className="text-xl font-medium text-white mb-2">
              Willkommen bei Qwen Chat
            </h2>
            <p className="text-sm max-w-md text-center">
              Starte eine Unterhaltung mit dem KI-Assistenten.
              Deine Nachrichten werden lokal verarbeitet.
            </p>
          </div>
        ) : (
          // Message List
          <div className="py-4">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="mx-4 mb-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          <strong>Fehler:</strong> {error.message}
        </div>
      )}

      {/* Input Area */}
      <div className="p-4 border-t border-white/10">
        <ChatInput
          onSend={sendMessage}
          onStop={stopStream}
          isStreaming={isStreaming}
          placeholder="Schreibe eine Nachricht..."
        />
      </div>
    </div>
  );
}
