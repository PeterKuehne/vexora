/**
 * API Client for Vexora Backend
 *
 * Handles communication with the Express backend,
 * including SSE streaming for chat responses.
 */

import { env } from './env';
import type { Message, MessageRole } from '../types/message';

// ============================================
// Types
// ============================================

export interface ChatMessage {
  role: MessageRole;
  content: string;
}

export interface ChatOptions {
  temperature?: number;
  top_p?: number;
  top_k?: number;
  num_predict?: number;
  stop?: string[];
}

export interface ChatRequest {
  messages: ChatMessage[];
  model?: string | undefined;
  stream?: boolean | undefined;
  options?: ChatOptions | undefined;
}

export interface StreamChunk {
  message?: {
    role: string;
    content: string;
  };
  done: boolean;
  done_reason?: string;
  total_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
}

export interface StreamCallbacks {
  onToken: (token: string) => void;
  onComplete: (fullResponse: string, metadata?: StreamMetadata) => void;
  onError: (error: Error, partialResponse?: string) => void;
  /** Optional callback for streaming progress updates */
  onProgress?: (progress: StreamProgress) => void;
  /** Optional callback for connection interruption */
  onConnectionInterrupted?: (partialResponse: string, metadata: Partial<StreamMetadata>) => void;
}

export interface StreamMetadata {
  totalDuration?: number | undefined;
  promptTokens?: number | undefined;
  completionTokens?: number | undefined;
  tokensPerSecond?: number | undefined;
  streamDuration?: number | undefined;
}

export interface StreamProgress {
  /** Number of tokens received so far */
  tokenCount: number;
  /** Time elapsed since stream started (ms) */
  elapsedMs: number;
  /** Current tokens per second */
  tokensPerSecond: number;
}

// ============================================
// API Functions
// ============================================

/**
 * Send a chat request and stream the response
 *
 * Uses Server-Sent Events (SSE) to receive streaming tokens
 * from the Ollama API via our Express backend.
 */
export async function streamChat(
  messages: Message[],
  callbacks: StreamCallbacks,
  options?: {
    model?: string | undefined;
    chatOptions?: ChatOptions | undefined;
    signal?: AbortSignal | null | undefined;
  }
): Promise<void> {
  const { onToken, onComplete, onError, onProgress } = callbacks;
  const { model, chatOptions, signal } = options ?? {};

  // Convert Message[] to ChatMessage[] (API format)
  const chatMessages: ChatMessage[] = messages.map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));

  const request: ChatRequest = {
    messages: chatMessages,
    model: model,
    stream: true,
    options: chatOptions,
  };

  // Variables to track response and metadata across try/catch blocks
  let fullResponse = '';
  let metadata: StreamMetadata = {};

  try {
    const response = await fetch(`${env.API_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
      signal: signal ?? null,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage =
        (errorData as { message?: string }).message ||
        `HTTP ${response.status}: ${response.statusText}`;
      throw new Error(errorMessage);
    }

    // Read the SSE stream
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Failed to get response stream reader');
    }

    const decoder = new TextDecoder();

    // Buffer for handling partial SSE chunks
    // SSE data can be split across multiple read() calls
    let buffer = '';

    // Progress tracking
    const streamStartTime = Date.now();
    let tokenCount = 0;

    let connectionInterrupted = false;
    let lastSuccessfulRead = Date.now();
    const CONNECTION_TIMEOUT = 30000; // 30 seconds timeout

    try {
      while (true) {
        try {
          const { done, value } = await reader.read();
          lastSuccessfulRead = Date.now();

          if (done) break;

          // Append decoded chunk to buffer
          buffer += decoder.decode(value, { stream: true });

          // Process complete lines from buffer
          const lines = buffer.split('\n');
          // Keep the last incomplete line in buffer
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            // Skip empty lines (SSE uses double newlines as separators)
            if (!line.trim()) continue;

            // SSE format: "data: {...}"
            if (line.startsWith('data: ')) {
              const data = line.slice(6); // Remove "data: " prefix

              if (data === '[DONE]') {
                // Stream complete - calculate final stats
                const streamDuration = Date.now() - streamStartTime;
                const tokensPerSecond = streamDuration > 0
                  ? (tokenCount / streamDuration) * 1000
                  : 0;

                metadata.streamDuration = streamDuration;
                metadata.tokensPerSecond = Math.round(tokensPerSecond * 10) / 10;

                onComplete(fullResponse, metadata);
                return;
              }

              try {
                const parsed: StreamChunk = JSON.parse(data);

                if (parsed.message?.content) {
                  const token = parsed.message.content;
                  fullResponse += token;
                  tokenCount++;

                  // Call token callback
                  onToken(token);

                  // Report progress if callback provided
                  if (onProgress) {
                    const elapsedMs = Date.now() - streamStartTime;
                    const tokensPerSecond = elapsedMs > 0
                      ? (tokenCount / elapsedMs) * 1000
                      : 0;

                    onProgress({
                      tokenCount,
                      elapsedMs,
                      tokensPerSecond: Math.round(tokensPerSecond * 10) / 10,
                    });
                  }
                }

                // Capture metadata from final chunk
                if (parsed.done) {
                  metadata = {
                    ...metadata,
                    totalDuration: parsed.total_duration,
                    promptTokens: parsed.prompt_eval_count,
                    completionTokens: parsed.eval_count,
                  };
                }
              } catch {
                // Skip malformed JSON (partial chunk will be handled on next read)
              }
            }
          }
        } catch (readError) {
          // Check if this is a connection interruption
          const timeSinceLastRead = Date.now() - lastSuccessfulRead;

          if (timeSinceLastRead > CONNECTION_TIMEOUT) {
            connectionInterrupted = true;

            // Call connection interrupted callback if partial response exists
            if (fullResponse.trim() && callbacks.onConnectionInterrupted) {
              const streamDuration = Date.now() - streamStartTime;
              const partialMetadata: Partial<StreamMetadata> = {
                streamDuration,
                tokensPerSecond: streamDuration > 0 ? (tokenCount / streamDuration) * 1000 : 0,
              };

              callbacks.onConnectionInterrupted(fullResponse, partialMetadata);
              return;
            }
          }

          // Re-throw the error for other error types
          throw readError;
        }
      }

      // Process any remaining buffer content
      if (buffer.trim() && buffer.startsWith('data: ')) {
        const data = buffer.slice(6);
        if (data !== '[DONE]') {
          try {
            const parsed: StreamChunk = JSON.parse(data);
            if (parsed.message?.content) {
              fullResponse += parsed.message.content;
              tokenCount++;
            }
          } catch {
            // Ignore incomplete final chunk
          }
        }
      }

      // Calculate final duration if we didn't get [DONE]
      const streamDuration = Date.now() - streamStartTime;
      const tokensPerSecond = streamDuration > 0
        ? (tokenCount / streamDuration) * 1000
        : 0;

      metadata.streamDuration = streamDuration;
      metadata.tokensPerSecond = Math.round(tokensPerSecond * 10) / 10;

      // If we get here without [DONE], check if connection was interrupted
      if (connectionInterrupted) {
        // Handle as connection interruption
        if (fullResponse.trim() && callbacks.onConnectionInterrupted) {
          callbacks.onConnectionInterrupted(fullResponse, metadata);
        } else {
          // No partial response, treat as error
          throw new Error('Connection interrupted with no partial response');
        }
      } else {
        // Normal completion without explicit [DONE]
        onComplete(fullResponse, metadata);
      }
    } finally {
      reader.releaseLock();
    }
  } catch (error) {
    if (error instanceof Error) {
      // Don't report abort errors as actual errors
      if (error.name === 'AbortError') {
        onComplete(fullResponse || '', metadata);
        return;
      }

      // Check if we have partial response to include with error
      const partialResponse = fullResponse && fullResponse.trim() ? fullResponse : undefined;
      onError(error, partialResponse);
    } else {
      // Check if we have partial response to include with error
      const partialResponse = fullResponse && fullResponse.trim() ? fullResponse : undefined;
      onError(new Error('Unknown error during chat stream'), partialResponse);
    }
  }
}

/**
 * Fetch available models from the backend
 */
export async function fetchModels(): Promise<{
  models: Array<{
    id: string;
    name: string;
    family: string;
    parameterSize: string;
    quantization: string;
    sizeGB: number;
    isDefault: boolean;
  }>;
  defaultModel: string;
}> {
  const response = await fetch(`${env.API_URL}/api/models`);

  if (!response.ok) {
    throw new Error(`Failed to fetch models: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Check backend health status
 */
export async function checkHealth(): Promise<{
  status: 'ok' | 'degraded' | 'error';
  services: {
    backend: { status: string };
    websocket: { status: string; connections: number };
    ollama: { status: string; available_models: string[] };
  };
}> {
  const response = await fetch(`${env.API_URL}/api/health`);

  if (!response.ok) {
    throw new Error(`Health check failed: ${response.statusText}`);
  }

  return response.json();
}
