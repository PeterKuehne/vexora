/**
 * API Client for Qwen Chat Backend
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
  onError: (error: Error) => void;
}

export interface StreamMetadata {
  totalDuration?: number | undefined;
  promptTokens?: number | undefined;
  completionTokens?: number | undefined;
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
  const { onToken, onComplete, onError } = callbacks;
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
    let fullResponse = '';
    let metadata: StreamMetadata = {};

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          // SSE format: "data: {...}"
          if (line.startsWith('data: ')) {
            const data = line.slice(6); // Remove "data: " prefix

            if (data === '[DONE]') {
              // Stream complete
              onComplete(fullResponse, metadata);
              return;
            }

            try {
              const parsed: StreamChunk = JSON.parse(data);

              if (parsed.message?.content) {
                const token = parsed.message.content;
                fullResponse += token;
                onToken(token);
              }

              // Capture metadata from final chunk
              if (parsed.done) {
                metadata = {
                  totalDuration: parsed.total_duration,
                  promptTokens: parsed.prompt_eval_count,
                  completionTokens: parsed.eval_count,
                };
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }
      }

      // If we get here without [DONE], still call onComplete
      onComplete(fullResponse, metadata);
    } finally {
      reader.releaseLock();
    }
  } catch (error) {
    if (error instanceof Error) {
      // Don't report abort errors as actual errors
      if (error.name === 'AbortError') {
        onComplete('', undefined);
        return;
      }
      onError(error);
    } else {
      onError(new Error('Unknown error during chat stream'));
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
