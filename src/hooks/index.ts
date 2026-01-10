/**
 * Hooks - Custom React Hooks
 * Central export point for all hooks
 */

export { useSocket } from './useSocket';
export type { UseSocketReturn, UseSocketOptions } from './useSocket';

export { useChatStream } from './useChatStream';
export type { UseChatStreamOptions, UseChatStreamReturn } from './useChatStream';

export { useOllama } from './useOllama';
export type {
  UseOllamaOptions,
  UseOllamaReturn,
  OllamaModel,
  OllamaHealthStatus,
} from './useOllama';

export {
  useLocalStorage,
  useLocalStorageState,
  useLocalStorageFlag,
} from './useLocalStorage';
export type {
  UseLocalStorageOptions,
  UseLocalStorageReturn,
} from './useLocalStorage';

// Additional hooks will be exported here
// export { useDebounce } from './useDebounce';
