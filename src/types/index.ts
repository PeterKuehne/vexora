/**
 * Types - TypeScript Type Definitions
 * Central export point for all types
 */

// Chat message types
export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

// Conversation types
export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
  model?: string;
}

// Model configuration
export interface ModelConfig {
  name: string;
  displayName: string;
  contextLength: number;
  temperature: number;
  topP: number;
}

// App settings
export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  fontSize: 'small' | 'medium' | 'large';
  sendOnEnter: boolean;
  showTimestamps: boolean;
  defaultModel: string;
}

// Socket events
export interface ChatMessageEvent {
  conversationId: string;
  message: Message;
}

export interface StreamTokenEvent {
  conversationId: string;
  messageId: string;
  token: string;
}

export interface StreamEndEvent {
  conversationId: string;
  messageId: string;
  fullContent: string;
}

// API response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface HealthCheckResponse {
  status: 'ok' | 'error';
  timestamp: string;
  version: string;
  websocket: string;
  ollama_url: string;
  default_model: string;
}
