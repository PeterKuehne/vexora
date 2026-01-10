/**
 * useLocalStorage Hook - Type-safe LocalStorage with React State
 *
 * Features:
 * - Generic type support for any JSON-serializable value
 * - Automatic JSON parsing and serialization
 * - SSR-safe (works with server-side rendering)
 * - Cross-tab synchronization via storage events
 * - Optional TTL (time-to-live) support
 * - Lazy initialization to avoid hydration mismatches
 */

import { useState, useEffect, useCallback } from 'react';
import { storage, type StorageKey } from '../lib/storage';

// ============================================
// Types
// ============================================

/**
 * Options for useLocalStorage hook
 */
export interface UseLocalStorageOptions<T> {
  /**
   * Time-to-live in milliseconds (optional)
   * Value will be considered expired after this duration
   */
  ttl?: number;

  /**
   * Custom serializer function (optional)
   * Default: JSON.stringify
   */
  serialize?: (value: T) => string;

  /**
   * Custom deserializer function (optional)
   * Default: JSON.parse
   */
  deserialize?: (raw: string) => T;

  /**
   * Enable cross-tab synchronization (default: true)
   */
  syncTabs?: boolean;
}

/**
 * Return type for useLocalStorage hook
 */
export interface UseLocalStorageReturn<T> {
  /** Current value (or default if not set) */
  value: T;

  /** Update the stored value */
  setValue: (value: T | ((prev: T) => T)) => void;

  /** Remove the value from storage */
  removeValue: () => void;

  /** Check if storage is available */
  isAvailable: boolean;

  /** Refresh value from storage (useful after external changes) */
  refresh: () => void;
}

// ============================================
// Hook Implementation
// ============================================

/**
 * Custom hook for type-safe LocalStorage with React state
 *
 * @param key - Storage key (use STORAGE_KEYS constants for type safety)
 * @param defaultValue - Default value when key doesn't exist
 * @param options - Optional configuration
 * @returns Object with value, setValue, removeValue, and utilities
 *
 * @example
 * ```tsx
 * // Basic usage
 * const { value, setValue } = useLocalStorage('user-name', 'Guest');
 *
 * // With typed key
 * const { value, setValue } = useLocalStorage(STORAGE_KEYS.THEME, 'dark');
 *
 * // With TTL (expires after 1 hour)
 * const { value, setValue } = useLocalStorage('session-token', '', { ttl: 3600000 });
 *
 * // With functional update
 * setValue(prev => prev + 1);
 * ```
 */
export function useLocalStorage<T>(
  key: string | StorageKey,
  defaultValue: T,
  options: UseLocalStorageOptions<T> = {}
): UseLocalStorageReturn<T> {
  const { ttl, syncTabs = true } = options;

  // Track if we're on client side
  const isClient = typeof window !== 'undefined';

  // Check storage availability
  const isAvailable = isClient && storage.isAvailable();

  // Lazy initializer for state - returns default on server, reads from storage on client
  const getInitialValue = useCallback((): T => {
    if (!isAvailable) {
      return defaultValue;
    }

    try {
      const storedValue = storage.get<T>(key);
      return storedValue !== null ? storedValue : defaultValue;
    } catch (error) {
      console.error(`useLocalStorage: Failed to read key "${key}":`, error);
      return defaultValue;
    }
  }, [key, defaultValue, isAvailable]);

  // State with lazy initialization - reads from storage on first render
  const [storedValue, setStoredValue] = useState<T>(() => {
    // On server, always return default
    if (!isClient) {
      return defaultValue;
    }
    return getInitialValue();
  });

  // Set value in both state and storage
  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      try {
        // Handle functional updates
        const valueToStore =
          value instanceof Function ? value(storedValue) : value;

        // Update state
        setStoredValue(valueToStore);

        // Update storage
        if (isAvailable) {
          const setOptions = ttl !== undefined ? { ttl } : undefined;
          storage.set(key, valueToStore, setOptions);
        }
      } catch (error) {
        console.error(`useLocalStorage: Failed to set key "${key}":`, error);
      }
    },
    [key, storedValue, isAvailable, ttl]
  );

  // Remove value from storage and reset to default
  const removeValue = useCallback(() => {
    try {
      setStoredValue(defaultValue);

      if (isAvailable) {
        storage.remove(key);
      }
    } catch (error) {
      console.error(`useLocalStorage: Failed to remove key "${key}":`, error);
    }
  }, [key, defaultValue, isAvailable]);

  // Refresh value from storage
  const refresh = useCallback(() => {
    const currentValue = getInitialValue();
    setStoredValue(currentValue);
  }, [getInitialValue]);

  // Subscribe to cross-tab changes
  useEffect(() => {
    if (!isAvailable || !syncTabs) return;

    const unsubscribe = storage.subscribe<T>(key, (newValue) => {
      // Update state when storage changes in another tab
      setStoredValue(newValue !== null ? newValue : defaultValue);
    });

    return unsubscribe;
  }, [key, defaultValue, isAvailable, syncTabs]);

  return {
    value: storedValue,
    setValue,
    removeValue,
    isAvailable,
    refresh,
  };
}

// ============================================
// Convenience Hooks
// ============================================

/**
 * Simplified hook that returns just [value, setValue] like useState
 * For simpler use cases where you don't need remove/refresh
 *
 * @example
 * ```tsx
 * const [count, setCount] = useLocalStorageState('counter', 0);
 * ```
 */
export function useLocalStorageState<T>(
  key: string | StorageKey,
  defaultValue: T,
  options?: UseLocalStorageOptions<T>
): [T, (value: T | ((prev: T) => T)) => void] {
  const { value, setValue } = useLocalStorage(key, defaultValue, options);
  return [value, setValue];
}

/**
 * Hook for boolean flags in localStorage
 *
 * @example
 * ```tsx
 * const { isEnabled, toggle, enable, disable } = useLocalStorageFlag('dark-mode', false);
 * ```
 */
export function useLocalStorageFlag(
  key: string | StorageKey,
  defaultValue = false
): {
  isEnabled: boolean;
  toggle: () => void;
  enable: () => void;
  disable: () => void;
  setValue: (value: boolean) => void;
} {
  const { value, setValue } = useLocalStorage(key, defaultValue);

  const toggle = useCallback(() => setValue((prev) => !prev), [setValue]);
  const enable = useCallback(() => setValue(true), [setValue]);
  const disable = useCallback(() => setValue(false), [setValue]);

  return {
    isEnabled: value,
    toggle,
    enable,
    disable,
    setValue,
  };
}
