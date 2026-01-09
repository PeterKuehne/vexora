/**
 * useChatStream Hook
 *
 * Manages the chat streaming flow:
 * - Sends user messages to the API
 * - Handles streaming responses
 * - Manages message state
 */

import { useState, useCallback, useRef } from 'react';
import { streamChat, type StreamMetadata } from '../lib/api';
import { generateId } from '../utils';
import type { Message } from '../types/message';

export interface UseChatStreamOptions {
  /** Model to use for generation */
  model?: string | undefined;
  /** Initial messages (e.g., system prompt) */
  initialMessages?: Message[] | undefined;
  /** Callback when response starts */
  onStreamStart?: (() => void) | undefined;
  /** Callback for each token */
  onToken?: ((token: string) => void) | undefined;
  /** Callback when response completes */
  onComplete?: ((response: string, metadata?: StreamMetadata) => void) | undefined;
  /** Callback on error */
  onError?: ((error: Error) => void) | undefined;
}

export interface UseChatStreamReturn {
  /** All messages in the conversation */
  messages: Message[];
  /** Whether a response is currently streaming */
  isStreaming: boolean;
  /** Current error, if any */
  error: Error | null;
  /** Send a new message */
  sendMessage: (content: string) => Promise<void>;
  /** Stop the current stream */
  stopStream: () => void;
  /** Clear all messages */
  clearMessages: () => void;
  /** Add a message manually (e.g., system prompt) */
  addMessage: (message: Message) => void;
  /** The current streaming response text */
  streamingContent: string;
}

export function useChatStream(
  options: UseChatStreamOptions = {}
): UseChatStreamReturn {
  const {
    model,
    initialMessages = [],
    onStreamStart,
    onToken,
    onComplete,
    onError,
  } = options;

  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [streamingContent, setStreamingContent] = useState('');

  // AbortController for cancelling streams
  const abortControllerRef = useRef<AbortController | null>(null);
  // Track the current assistant message ID
  const currentAssistantIdRef = useRef<string | null>(null);

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

      // Add both messages to state
      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      setIsStreaming(true);
      setStreamingContent('');
      onStreamStart?.();

      // Create abort controller for this request
      abortControllerRef.current = new AbortController();

      // Get all messages for context (including the new user message)
      const allMessages = [...messages, userMessage];

      try {
        await streamChat(
          allMessages,
          {
            onToken: (token) => {
              setStreamingContent((prev) => prev + token);

              // Update the assistant message with new content
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === currentAssistantIdRef.current
                    ? { ...msg, content: msg.content + token }
                    : msg
                )
              );

              onToken?.(token);
            },
            onComplete: (fullResponse, metadata) => {
              // Finalize the assistant message
              setMessages((prev) =>
                prev.map((msg): Message =>
                  msg.id === currentAssistantIdRef.current
                    ? {
                        ...msg,
                        content: fullResponse,
                        status: 'complete',
                        isStreaming: false,
                        tokenCount: metadata?.completionTokens ?? undefined,
                      }
                    : msg
                )
              );

              setIsStreaming(false);
              setStreamingContent('');
              currentAssistantIdRef.current = null;
              onComplete?.(fullResponse, metadata);
            },
            onError: (err) => {
              setError(err);

              // Mark assistant message as error
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === currentAssistantIdRef.current
                    ? {
                        ...msg,
                        status: 'error' as const,
                        isStreaming: false,
                        error: err.message,
                      }
                    : msg
                )
              );

              setIsStreaming(false);
              setStreamingContent('');
              currentAssistantIdRef.current = null;
              onError?.(err);
            },
          },
          {
            model,
            signal: abortControllerRef.current.signal,
          }
        );
      } catch (err) {
        // Handle unexpected errors
        const error = err instanceof Error ? err : new Error('Unknown error');
        setError(error);
        setIsStreaming(false);
        onError?.(error);
      }
    },
    [messages, isStreaming, model, onStreamStart, onToken, onComplete, onError]
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
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === currentAssistantIdRef.current
            ? { ...msg, status: 'complete' as const, isStreaming: false }
            : msg
        )
      );
      currentAssistantIdRef.current = null;
    }

    setIsStreaming(false);
    setStreamingContent('');
  }, []);

  /**
   * Clear all messages
   */
  const clearMessages = useCallback(() => {
    stopStream();
    setMessages(initialMessages);
    setError(null);
  }, [stopStream, initialMessages]);

  /**
   * Add a message manually
   */
  const addMessage = useCallback((message: Message) => {
    setMessages((prev) => [...prev, message]);
  }, []);

  return {
    messages,
    isStreaming,
    error,
    sendMessage,
    stopStream,
    clearMessages,
    addMessage,
    streamingContent,
  };
}
