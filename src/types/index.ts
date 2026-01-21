/**
 * Types - TypeScript Type Definitions
 * Central export point for all types
 *
 * Import types from this file:
 * import type { Message, Conversation, AppSettings } from '@/types';
 */

// Message types
export type { Message, MessageRole, MessageStatus, CreateMessageInput, MessageWithMeta } from './message';

// Conversation types
export type {
  Conversation,
  CreateConversationInput,
  ConversationSummary,
  ConversationState,
  ConversationFilterOptions,
} from './conversation';

// Settings types
export type { Theme, FontSize, AppSettings, ModelConfig, GenerationParams, ModelProfile } from './settings';
export { DEFAULT_SETTINGS, DEFAULT_GENERATION_PARAMS, MODEL_PROFILES } from './settings';

// API types
export type {
  ApiResponse,
  HealthCheckResponse,
  ChatMessageEvent,
  ChatMessageAckEvent,
  StreamStartEvent,
  StreamTokenEvent,
  StreamEndEvent,
  StreamErrorEvent,
  ClientToServerEvents,
  ServerToClientEvents,
} from './api';

// Ollama API types
export type {
  OllamaModel,
  OllamaModelDetails,
  OllamaTagsResponse,
  OllamaChatMessage,
  OllamaGenerationOptions,
  OllamaChatRequest,
  OllamaChatResponse,
  OllamaChatStreamChunk,
  OllamaChatStreamFinal,
  OllamaGenerateRequest,
  OllamaGenerateResponse,
  OllamaPullRequest,
  OllamaPullResponse,
  OllamaShowRequest,
  OllamaShowResponse,
  OllamaErrorResponse,
} from './ollama';
export { isOllamaError, calculateTokensPerSecond } from './ollama';
