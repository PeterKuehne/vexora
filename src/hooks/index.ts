/**
 * Hooks - Custom React Hooks
 * Central export point for all hooks
 */

export { useSocket } from './useSocket';
export type { UseSocketReturn, UseSocketOptions } from './useSocket';

export {
  useLocalStorage,
  useLocalStorageState,
  useLocalStorageFlag,
} from './useLocalStorage';
export type {
  UseLocalStorageOptions,
  UseLocalStorageReturn,
} from './useLocalStorage';

// Debounce & Throttle hooks
export {
  useDebounce,
  useDebouncedCallback,
  useDebouncedState,
  useThrottle,
} from './useDebounce';

// Auto-resize textarea hook
export {
  useAutoResize,
  useAutoResizeValue,
  useAutoResizeTextarea,
} from './useAutoResize';
export type {
  UseAutoResizeOptions,
  UseAutoResizeReturn,
  UseAutoResizeTextareaOptions,
  UseAutoResizeTextareaReturn,
} from './useAutoResize';
