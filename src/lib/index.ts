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
} from './socket';

// API Client
export {
  fetchModels,
  checkHealth,
} from './api';

// Storage Service
export { StorageService, storage, STORAGE_KEYS } from './storage';
export type { StorageKey } from './storage';

// Conversation Storage
export {
  ConversationStorage,
  conversationStorage,
} from './conversationStorage';
export type { ConversationUpdate } from './conversationStorage';

// Settings Storage
export { SettingsStorage, settingsStorage } from './settingsStorage';
export type { SerializedSettings } from './settingsStorage';

// Storage Quota
export {
  getStorageUsage,
  getStorageBreakdown,
  checkStorageQuota,
  getCleanupSuggestions,
  performAutomaticCleanup,
  formatBytes,
  formatUsageBar,
  STORAGE_LIMIT_MB,
  WARNING_THRESHOLD_MB,
  CRITICAL_THRESHOLD_MB,
} from './storageQuota';
export type {
  StorageUsage,
  StorageBreakdown,
  CleanupSuggestion,
} from './storageQuota';

// Error Handler
export {
  parseError,
  isRetryableError,
  isNetworkError,
  isOllamaError,
  getUserFriendlyMessage,
  withRetry,
} from './errorHandler';
export type {
  ErrorCategory,
  ParsedError,
  RetryOptions,
} from './errorHandler';
