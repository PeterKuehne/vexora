/**
 * ChatContext
 *
 * Manages the current chat state including:
 * - Messages from active conversation
 * - Streaming state and progress
 * - Send/Stop message actions
 * - Error handling
 */

import {
  createContext,
  useContext,
  useCallback,
  useRef,
  useState,
  useMemo,
  type ReactNode,
} from 'react';
import { useConversations } from './ConversationContext';
import { useToast } from './ToastContext';
import { streamChat, type StreamMetadata, type StreamProgress } from '../lib/api';
import { parseError } from '../lib/errorHandler';
import { generateId } from '../utils';
import type { Message } from '../types/message';

// ============================================
// Context Types
// ============================================

interface ChatContextValue {
  /** Current messages in the active conversation */
  messages: Message[];
  /** Whether the AI is currently streaming a response */
  isStreaming: boolean;
  /** Current streaming progress (tokens, time, speed) */
  streamProgress: StreamProgress | null;
  /** Metadata from the last completed stream */
  lastMetadata: StreamMetadata | null;
  /** Current error, if any */
  error: Error | null;
  /** Send a message and get AI response */
  sendMessage: (content: string) => Promise<void>;
  /** Stop the current streaming response */
  stopStream: () => void;
  /** Clear the current error */
  clearError: () => void;
  /** Current model being used */
  model: string | undefined;
  /** Set the model to use for chat */
  setModel: (model: string | undefined) => void;
}

// ============================================
// Context
// ============================================

const ChatContext = createContext<ChatContextValue | null>(null);

// ============================================
// Provider Component
// ============================================

interface ChatProviderProps {
  children: ReactNode;
  /** Initial model to use */
  initialModel?: string | undefined;
}

export function ChatProvider({ children, initialModel }: ChatProviderProps) {
  const {
    activeMessages: messages,
    addMessageToActive,
    updateMessageInActive,
  } = useConversations();

  const toast = useToast();

  // Chat state
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamProgress, setStreamProgress] = useState<StreamProgress | null>(null);
  const [lastMetadata, setLastMetadata] = useState<StreamMetadata | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [model, setModel] = useState<string | undefined>(initialModel);

  // Refs for tracking current stream
  const abortControllerRef = useRef<AbortController | null>(null);
  const currentAssistantIdRef = useRef<string | null>(null);

  /**
   * Clear the current error
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Show error as toast notification
   */
  const showErrorToast = useCallback(
    (err: Error, onRetry?: () => void, partialResponse?: string) => {
      const parsed = parseError(err, partialResponse);

      // Use different toast type for stream interruption
      const toastType = parsed.category === 'stream_interrupted' ? 'warning' : 'error';
      const toastTitle = parsed.category === 'stream_interrupted' ? 'Stream unterbrochen'
        : parsed.category === 'network' ? 'Netzwerkfehler'
        : 'Fehler';

      toast[toastType](parsed.userMessage, {
        title: toastTitle,
        onRetry: parsed.isRetryable ? onRetry : undefined,
        duration: parsed.isRetryable ? 0 : 8000, // Don't auto-dismiss if retryable
      });
    },
    [toast]
  );

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
      setLastMetadata(null);

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
            onError: (err, partialResponse) => {
              setError(err);

              // Parse error to get better information
              const parsed = parseError(err, partialResponse);

              // If we have a partial response and it's a stream interrupted error,
              // keep the message with the partial content
              if (partialResponse && parsed.category === 'stream_interrupted') {
                if (currentAssistantIdRef.current) {
                  updateMessageInActive(currentAssistantIdRef.current, {
                    content: partialResponse,
                    status: 'complete', // Mark as complete with partial content
                    isStreaming: false,
                  });
                }
              } else {
                // Mark assistant message as error
                if (currentAssistantIdRef.current) {
                  updateMessageInActive(currentAssistantIdRef.current, {
                    status: 'error',
                    isStreaming: false,
                    error: err.message,
                  });
                }
              }

              // Show toast notification for the error
              showErrorToast(err, () => {
                // Retry: resend the last user message
                const lastUserMessage = allMessages[allMessages.length - 1];
                if (lastUserMessage?.role === 'user') {
                  sendMessage(lastUserMessage.content);
                }
              }, partialResponse);

              setIsStreaming(false);
              setStreamProgress(null);
              currentAssistantIdRef.current = null;
            },
            onConnectionInterrupted: (partialResponse, metadata) => {
              // Handle connection interrupted gracefully
              if (currentAssistantIdRef.current) {
                updateMessageInActive(currentAssistantIdRef.current, {
                  content: partialResponse,
                  status: 'complete',
                  isStreaming: false,
                  tokenCount: metadata.tokensPerSecond ? Math.round(metadata.tokensPerSecond) : undefined,
                });
              }

              setIsStreaming(false);
              setStreamProgress(null);
              setLastMetadata(metadata as StreamMetadata);

              // Show info toast about interruption
              toast.info('Verbindung unterbrochen - bisherige Antwort wurde gespeichert', {
                title: 'Stream unterbrochen',
                onRetry: () => {
                  const lastUserMessage = allMessages[allMessages.length - 1];
                  if (lastUserMessage?.role === 'user') {
                    sendMessage(lastUserMessage.content);
                  }
                },
              });

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
          showErrorToast(err);
        }
        setIsStreaming(false);
      }
    },
    [messages, isStreaming, model, addMessageToActive, updateMessageInActive, showErrorToast]
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

  const value: ChatContextValue = useMemo(
    () => ({
      messages,
      isStreaming,
      streamProgress,
      lastMetadata,
      error,
      sendMessage,
      stopStream,
      clearError,
      model,
      setModel,
    }),
    [
      messages,
      isStreaming,
      streamProgress,
      lastMetadata,
      error,
      sendMessage,
      stopStream,
      clearError,
      model,
    ]
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

// ============================================
// Main Hook
// ============================================

/**
 * Hook to access the chat context
 *
 * @example
 * ```tsx
 * function ChatComponent() {
 *   const { messages, sendMessage, isStreaming, stopStream } = useChat();
 *
 *   const handleSend = (text: string) => {
 *     sendMessage(text);
 *   };
 *
 *   return (
 *     <div>
 *       {messages.map(msg => <Message key={msg.id} {...msg} />)}
 *       {isStreaming && <button onClick={stopStream}>Stop</button>}
 *     </div>
 *   );
 * }
 * ```
 */
export function useChat(): ChatContextValue {
  const context = useContext(ChatContext);

  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }

  return context;
}

// ============================================
// Convenience Hooks
// ============================================

/**
 * Hook to access only the messages
 */
export function useChatMessages(): Message[] {
  const { messages } = useChat();
  return messages;
}

/**
 * Hook to access streaming state
 */
export function useChatStreaming(): {
  isStreaming: boolean;
  streamProgress: StreamProgress | null;
  lastMetadata: StreamMetadata | null;
} {
  const { isStreaming, streamProgress, lastMetadata } = useChat();
  return { isStreaming, streamProgress, lastMetadata };
}

/**
 * Hook to access chat error state
 */
export function useChatError(): {
  error: Error | null;
  clearError: () => void;
} {
  const { error, clearError } = useChat();
  return { error, clearError };
}

/**
 * Hook to access chat actions only
 */
export function useChatActions(): {
  sendMessage: (content: string) => Promise<void>;
  stopStream: () => void;
} {
  const { sendMessage, stopStream } = useChat();
  return { sendMessage, stopStream };
}

// ============================================
// Type Exports
// ============================================

export type { ChatContextValue };
