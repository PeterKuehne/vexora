/**
 * API Types
 * Defines types for API requests, responses, and socket events
 */

import type { Message } from './message';

// ============================================
// HTTP API Types
// ============================================

/**
 * Generic API response wrapper
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  /** Optional error code for programmatic handling */
  errorCode?: string;
}

/**
 * Health check endpoint response
 */
export interface HealthCheckResponse {
  status: 'ok' | 'error';
  timestamp: string;
  version: string;
  websocket: string;
  ollama_url: string;
  default_model: string;
}

// Note: Ollama-specific types are now in ./ollama.ts
// Import from there or from the central ./index.ts export

// ============================================
// WebSocket Event Types
// ============================================

/**
 * Client-to-server: Send a chat message
 */
export interface ChatMessageEvent {
  conversationId: string;
  message: Message;
}

/**
 * Server-to-client: Message acknowledgment
 */
export interface ChatMessageAckEvent {
  conversationId: string;
  messageId: string;
  status: 'received' | 'processing' | 'error';
  error?: string;
}

/**
 * Server-to-client: Stream started
 */
export interface StreamStartEvent {
  conversationId: string;
  messageId: string;
}

/**
 * Server-to-client: Stream token
 */
export interface StreamTokenEvent {
  conversationId: string;
  messageId: string;
  token: string;
}

/**
 * Server-to-client: Stream ended
 */
export interface StreamEndEvent {
  conversationId: string;
  messageId: string;
  fullContent: string;
  /** Token usage statistics */
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Server-to-client: Stream error
 */
export interface StreamErrorEvent {
  conversationId: string;
  messageId: string;
  error: string;
  errorCode?: string;
}

// ============================================
// Socket.io Event Map
// ============================================

/**
 * Events sent from client to server
 */
export interface ClientToServerEvents {
  'chat:message': (data: ChatMessageEvent) => void;
  'chat:stop': (data: { conversationId: string; messageId: string }) => void;
}

/**
 * Events sent from server to client
 */
export interface ServerToClientEvents {
  'chat:message:ack': (data: ChatMessageAckEvent) => void;
  'chat:stream:start': (data: StreamStartEvent) => void;
  'chat:stream:token': (data: StreamTokenEvent) => void;
  'chat:stream:end': (data: StreamEndEvent) => void;
  'chat:stream:error': (data: StreamErrorEvent) => void;
}
