/**
 * ChatContainer Component
 *
 * Main chat interface that combines:
 * - Message list
 * - Chat input
 * - Streaming state management
 * - Conversation persistence via context
 */

import { useRef, useEffect, useCallback, useState } from 'react';
import { MessageBubble } from './MessageBubble';
import { ChatInput } from './ChatInput';
import { useConversations } from '../contexts';
import { streamChat, type StreamMetadata, type StreamProgress } from '../lib/api';
import { generateId } from '../utils';
import { Bot, Zap, Timer } from 'lucide-react';
import type { Message } from '../types/message';

export interface ChatContainerProps {
  /** Model to use for chat */
  model?: string | undefined;
}

export function ChatContainer({ model }: ChatContainerProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const currentAssistantIdRef = useRef<string | null>(null);

  const {
    activeMessages: messages,
    addMessageToActive,
    updateMessageInActive,
  } = useConversations();

  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [streamProgress, setStreamProgress] = useState<StreamProgress | null>(null);
  const [lastMetadata, setLastMetadata] = useState<StreamMetadata | null>(null);

  // Format milliseconds to readable time
  const formatTime = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /**
   * Send a user message and stream the AI response
   */
  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isStreaming) return;

      setError(null);

      // Create user message
      const userMessage: Message = {
        id: generateId(),
        role: 'user',
        content: content.trim(),
        timestamp: new Date(),
        status: 'complete',
      };

      // Create placeholder assistant message
      const assistantMessage: Message = {
        id: generateId(),
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        status: 'streaming',
        isStreaming: true,
      };

      currentAssistantIdRef.current = assistantMessage.id;

      // Add messages to conversation context
      addMessageToActive(userMessage);
      addMessageToActive(assistantMessage);

      setIsStreaming(true);
      setStreamProgress(null);

      // Create abort controller for this request
      abortControllerRef.current = new AbortController();

      // Get all messages for context (including the new user message)
      const allMessages = [...messages, userMessage];

      try {
        let currentContent = '';

        await streamChat(
          allMessages,
          {
            onToken: (token) => {
              currentContent += token;

              // Update the assistant message in context
              if (currentAssistantIdRef.current) {
                updateMessageInActive(currentAssistantIdRef.current, {
                  content: currentContent,
                });
              }
            },
            onProgress: (progress) => {
              setStreamProgress(progress);
            },
            onComplete: (fullResponse, metadata) => {
              // Finalize the assistant message
              if (currentAssistantIdRef.current) {
                updateMessageInActive(currentAssistantIdRef.current, {
                  content: fullResponse,
                  status: 'complete',
                  isStreaming: false,
                  tokenCount: metadata?.completionTokens,
                });
              }

              setIsStreaming(false);
              setStreamProgress(null);
              setLastMetadata(metadata ?? null);
              currentAssistantIdRef.current = null;
            },
            onError: (err) => {
              setError(err);

              // Mark assistant message as error
              if (currentAssistantIdRef.current) {
                updateMessageInActive(currentAssistantIdRef.current, {
                  status: 'error',
                  isStreaming: false,
                  error: err.message,
                });
              }

              setIsStreaming(false);
              setStreamProgress(null);
              currentAssistantIdRef.current = null;
            },
          },
          {
            model,
            signal: abortControllerRef.current.signal,
          }
        );
      } catch (err) {
        // Handle unexpected errors (like abort)
        if (err instanceof Error && err.name !== 'AbortError') {
          setError(err);
        }
        setIsStreaming(false);
      }
    },
    [messages, isStreaming, model, addMessageToActive, updateMessageInActive]
  );

  /**
   * Stop the current stream
   */
  const stopStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // Mark current assistant message as complete (with partial content)
    if (currentAssistantIdRef.current) {
      updateMessageInActive(currentAssistantIdRef.current, {
        status: 'complete',
        isStreaming: false,
      });
      currentAssistantIdRef.current = null;
    }

    setIsStreaming(false);
    setStreamProgress(null);
  }, [updateMessageInActive]);

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

      {/* Streaming Stats Display */}
      {isStreaming && streamProgress && (
        <div className="mx-4 mb-2 flex items-center gap-4 text-xs text-gray-400">
          <div className="flex items-center gap-1.5">
            <Zap size={12} className="text-yellow-500" />
            <span>{streamProgress.tokensPerSecond} tokens/s</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Timer size={12} className="text-blue-400" />
            <span>{formatTime(streamProgress.elapsedMs)}</span>
          </div>
          <div className="text-gray-500">
            {streamProgress.tokenCount} tokens
          </div>
        </div>
      )}

      {/* Last Response Stats */}
      {!isStreaming && lastMetadata && lastMetadata.tokensPerSecond && (
        <div className="mx-4 mb-2 flex items-center gap-4 text-xs text-gray-500">
          <div className="flex items-center gap-1.5">
            <Zap size={12} className="text-gray-500" />
            <span>{lastMetadata.tokensPerSecond} tokens/s</span>
          </div>
          {lastMetadata.streamDuration && (
            <div className="flex items-center gap-1.5">
              <Timer size={12} className="text-gray-500" />
              <span>{formatTime(lastMetadata.streamDuration)}</span>
            </div>
          )}
          {lastMetadata.completionTokens && (
            <span>{lastMetadata.completionTokens} tokens generiert</span>
          )}
        </div>
      )}

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
