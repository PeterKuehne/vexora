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
  useEffect,
  type ReactNode,
} from 'react';
import { useConversations } from './ConversationContext';
import { useToast } from './ToastContext';
import { useSettings } from './SettingsContext';
import { useRAG } from './RAGContext';
import { streamChat, type StreamMetadata, type StreamProgress, type RAGSource } from '../lib/api';
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
  /** Regenerate the last AI response */
  regenerateLastResponse: () => Promise<void>;
  /** Whether regeneration is possible (has AI messages) */
  canRegenerate: boolean;
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
  /** Currently selected model from parent */
  selectedModel?: string | undefined;
}

export function ChatProvider({ children, initialModel, selectedModel }: ChatProviderProps) {
  const {
    activeMessages: messages,
    addMessageToActive,
    updateMessageInActive,
    removeMessageFromActive,
  } = useConversations();

  const toast = useToast();
  const { settings } = useSettings();
  const { shouldActivateRAGForQuery } = useRAG();

  // Chat state
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamProgress, setStreamProgress] = useState<StreamProgress | null>(null);
  const [lastMetadata, setLastMetadata] = useState<StreamMetadata | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [model, setModel] = useState<string | undefined>(initialModel);

  // Refs for tracking current stream
  const abortControllerRef = useRef<AbortController | null>(null);
  const currentAssistantIdRef = useRef<string | null>(null);

  // Track model changes and show info message
  useEffect(() => {
    if (selectedModel && model && selectedModel !== model && messages.length > 0) {
      // Model changed during an active conversation
      setModel(selectedModel);

      // Create info message about model change
      const infoMessage: Message = {
        id: generateId(),
        role: 'system',
        content: `Modell gewechselt zu **${selectedModel}**. Neue Nachrichten verwenden das neue Modell.`,
        timestamp: new Date(),
        status: 'complete',
        isSystemMessage: true,
      };

      addMessageToActive(infoMessage);

      // Show toast notification
      toast.info(`Modell gewechselt zu ${selectedModel}`, {
        title: 'Modell geändert',
        duration: 3000,
      });
    } else if (selectedModel && selectedModel !== model) {
      // Initial model setting or conversation start
      setModel(selectedModel);
    }
  }, [selectedModel, model, messages.length, addMessageToActive, toast]);

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

      // PATTERN 2: Consistency Check - Cleanup hanging streaming messages
      const hangingMessages = messages.filter(msg =>
        msg.role === 'assistant' &&
        (msg.status === 'streaming' || msg.isStreaming === true)
      );

      if (hangingMessages.length > 0) {
        console.warn('🧹 Cleaning up hanging messages before new send:', hangingMessages.length);

        hangingMessages.forEach(msg => {
          updateMessageInActive(msg.id, {
            status: 'error',
            isStreaming: false,
            error: 'Response interrupted by new message',
          });
        });

        toast.warning('Previous response was interrupted', {
          duration: 3000,
        });
      }

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
      let allMessages = [...messages, userMessage];

      // Prepend system prompt if configured
      if (settings.systemPrompt && settings.systemPrompt.trim()) {
        // Check if there's already a system message (to avoid duplicates)
        const hasSystemMessage = allMessages.some(msg => msg.role === 'system' && !msg.isSystemMessage);

        if (!hasSystemMessage) {
          // Add system prompt as first message
          const systemMessage: Message = {
            id: generateId(),
            role: 'system',
            content: settings.systemPrompt.trim(),
            timestamp: new Date(),
            status: 'complete',
          };
          allMessages = [systemMessage, ...allMessages];
        }
      }

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
            onSources: (sources: RAGSource[], hasRelevantSources: boolean) => {
              // Update the assistant message with RAG sources
              if (currentAssistantIdRef.current) {
                updateMessageInActive(currentAssistantIdRef.current, {
                  sources,
                  hasRAGSources: hasRelevantSources,
                });
              }
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
            ...(shouldActivateRAGForQuery(content) && {
              ragOptions: {
                enabled: true,
                query: content.trim(), // Use the user's message as query
                searchLimit: settings.ragTopK ?? 5,
                searchThreshold: 0.1, // Low threshold to get more candidates for reranking
                hybridAlpha: settings.hybridSearchAlpha ?? 0.3, // 0.3 optimized for German texts
              }
            }),
          }
        );
      } catch (err) {
        // PATTERN 3: Abort Error Handling
        // AbortError is NOT an error - user consciously cancelled
        if (err instanceof Error && (err.name === 'AbortError' || err.message.includes('aborted'))) {
          console.log('✅ Stream aborted by user - this is normal, no error');

          // Mark message as complete with partial content (NOT error)
          if (currentAssistantIdRef.current) {
            updateMessageInActive(currentAssistantIdRef.current, {
              status: 'complete',
              isStreaming: false,
            });
            currentAssistantIdRef.current = null;
          }

          setIsStreaming(false);
          setStreamProgress(null);

          // NO error toast - user cancelled intentionally
          return;
        }

        // Real errors - show to user
        if (err instanceof Error) {
          setError(err);
          showErrorToast(err);
        }
        setIsStreaming(false);
      }
    },
    [messages, isStreaming, model, settings.systemPrompt, settings.hybridSearchAlpha, settings.ragTopK, shouldActivateRAGForQuery, addMessageToActive, updateMessageInActive, showErrorToast]
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

    console.log('🛑 Stream stopped - isStreaming reset to false');
  }, [updateMessageInActive]);

  // PATTERN 1: Safety Timeout - Auto-reset streaming state after 5 minutes
  useEffect(() => {
    if (!isStreaming) return;

    console.log('⏱️ Starting 5-minute safety timeout for stream');

    const timeoutId = setTimeout(() => {
      console.warn('⚠️ Stream timeout detected after 5 minutes - forcing cleanup');

      // Abort any pending request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }

      // Mark hanging message as error
      if (currentAssistantIdRef.current) {
        updateMessageInActive(currentAssistantIdRef.current, {
          status: 'error',
          isStreaming: false,
          error: 'Response timeout after 5 minutes. Please try again.',
        });
        currentAssistantIdRef.current = null;
      }

      // Reset streaming state
      setIsStreaming(false);
      setStreamProgress(null);

      // Show error toast
      toast.error('Response timeout after 5 minutes. Please try again.', {
        title: 'Timeout',
        duration: 8000,
      });
    }, 5 * 60 * 1000); // 5 minutes

    // Cleanup on unmount or when streaming stops
    return () => {
      console.log('⏹️ Clearing safety timeout');
      clearTimeout(timeoutId);
    };
  }, [isStreaming, updateMessageInActive, toast]);

  /**
   * Check if regeneration is possible
   */
  const canRegenerate = useMemo(() => {
    if (isStreaming || messages.length === 0) return false;

    // Find the last assistant message
    const lastAiMessage = messages
      .slice()
      .reverse()
      .find(msg => msg.role === 'assistant');

    // Can regenerate if there's an AI message and it's completed (not streaming)
    return Boolean(lastAiMessage && !lastAiMessage.isStreaming);
  }, [messages, isStreaming]);

  /**
   * Regenerate the last AI response
   */
  const regenerateLastResponse = useCallback(
    async () => {
      if (!canRegenerate || isStreaming) return;

      // Find the last AI message and the corresponding user message before it
      const lastAiMessageIndex = messages
        .map((msg, index) => ({ msg, index }))
        .reverse()
        .find(({ msg }) => msg.role === 'assistant')?.index;

      if (lastAiMessageIndex === undefined) return;

      const lastAiMessage = messages[lastAiMessageIndex];
      const userMessageBeforeAi = messages
        .slice(0, lastAiMessageIndex)
        .reverse()
        .find(msg => msg.role === 'user');

      if (!userMessageBeforeAi) return;

      // Remove the last AI message
      removeMessageFromActive(lastAiMessage.id);

      // Wait a bit for state to update
      await new Promise(resolve => setTimeout(resolve, 100));

      // Resend the user message (which will generate a new AI response)
      await sendMessage(userMessageBeforeAi.content);
    },
    [canRegenerate, isStreaming, messages, removeMessageFromActive, sendMessage]
  );

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
      regenerateLastResponse,
      canRegenerate,
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
      regenerateLastResponse,
      canRegenerate,
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
