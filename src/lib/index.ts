/**
 * Lib - Core Libraries and Configurations
 * Central export point for all library modules
 */

export { env } from './env';
export {
  getSocket,
  connectSocket,
  disconnectSocket,
  isSocketConnected,
  sendChatMessage,
  onChatMessageAck,
  onChatStreamStart,
  onChatStreamToken,
  onChatStreamEnd,
} from './socket';

export type {
  ChatMessagePayload,
  ChatMessageAck,
  ChatStreamToken,
  ChatStreamEvent,
} from './socket';

// API Client
export {
  streamChat,
  fetchModels,
  checkHealth,
} from './api';

export type {
  ChatMessage,
  ChatOptions,
  ChatRequest,
  StreamChunk,
  StreamCallbacks,
  StreamMetadata,
} from './api';

// Storage Service
export { StorageService, storage, STORAGE_KEYS } from './storage';
export type { StorageKey } from './storage';
