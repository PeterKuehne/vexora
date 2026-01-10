/**
 * useDebounce Hook
 *
 * Debounces a value or callback with configurable delay.
 * Useful for search inputs, auto-save, and rate-limiting API calls.
 */

import { useState, useEffect, useRef, useCallback } from 'react';

// ============================================
// useDebounce - Debounce a value
// ============================================

/**
 * Debounces a value by delaying updates until after the specified delay.
 *
 * @param value - The value to debounce
 * @param delay - Delay in milliseconds (default: 300ms)
 * @returns The debounced value
 *
 * @example
 * ```tsx
 * const [searchTerm, setSearchTerm] = useState('');
 * const debouncedSearch = useDebounce(searchTerm, 500);
 *
 * useEffect(() => {
 *   // This only runs 500ms after the user stops typing
 *   fetchResults(debouncedSearch);
 * }, [debouncedSearch]);
 * ```
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Set up the timeout
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Clean up on value/delay change or unmount
    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

// ============================================
// useDebouncedCallback - Debounce a callback
// ============================================

/**
 * Creates a debounced version of a callback function.
 * The callback will only be invoked after the specified delay
 * has passed since the last call.
 *
 * @param callback - The function to debounce
 * @param delay - Delay in milliseconds (default: 300ms)
 * @returns Object with debounced callback, cancel, and flush functions
 *
 * @example
 * ```tsx
 * const { debouncedCallback, cancel, flush } = useDebouncedCallback(
 *   (value: string) => saveToServer(value),
 *   500
 * );
 *
 * // Call the debounced version
 * debouncedCallback('new value');
 *
 * // Cancel pending call
 * cancel();
 *
 * // Execute immediately
 * flush();
 * ```
 */
export function useDebouncedCallback<T extends (...args: unknown[]) => void>(
  callback: T,
  delay: number = 300
): {
  debouncedCallback: (...args: Parameters<T>) => void;
  cancel: () => void;
  flush: () => void;
  isPending: boolean;
} {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(callback);
  const argsRef = useRef<Parameters<T> | null>(null);
  const [isPending, setIsPending] = useState(false);

  // Update callback ref on change
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Cancel function
  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
      argsRef.current = null;
      setIsPending(false);
    }
  }, []);

  // Flush function - execute immediately
  const flush = useCallback(() => {
    if (timeoutRef.current && argsRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
      callbackRef.current(...(argsRef.current as Parameters<T>));
      argsRef.current = null;
      setIsPending(false);
    }
  }, []);

  // Debounced callback
  const debouncedCallback = useCallback(
    (...args: Parameters<T>) => {
      // Store args for potential flush
      argsRef.current = args;
      setIsPending(true);

      // Clear existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Set new timeout
      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
        timeoutRef.current = null;
        argsRef.current = null;
        setIsPending(false);
      }, delay);
    },
    [delay]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return { debouncedCallback, cancel, flush, isPending };
}

// ============================================
// useDebouncedState - useState with debounced setter
// ============================================

/**
 * Like useState, but with a debounced setter.
 * Useful for controlled inputs that trigger expensive operations.
 *
 * @param initialValue - Initial state value
 * @param delay - Delay in milliseconds (default: 300ms)
 * @returns Tuple of [immediateValue, debouncedValue, setValue]
 *
 * @example
 * ```tsx
 * const [value, debouncedValue, setValue] = useDebouncedState('', 500);
 *
 * // Use value for input (immediate)
 * // Use debouncedValue for API calls (debounced)
 * <input
 *   value={value}
 *   onChange={(e) => setValue(e.target.value)}
 * />
 * ```
 */
export function useDebouncedState<T>(
  initialValue: T,
  delay: number = 300
): [T, T, (value: T) => void] {
  const [value, setValue] = useState<T>(initialValue);
  const debouncedValue = useDebounce(value, delay);

  return [value, debouncedValue, setValue];
}

// ============================================
// useThrottle - Throttle a value (bonus)
// ============================================

/**
 * Throttles a value by limiting updates to once per interval.
 * Unlike debounce, throttle ensures regular updates during continuous changes.
 *
 * @param value - The value to throttle
 * @param interval - Minimum interval between updates in milliseconds
 * @returns The throttled value
 *
 * @example
 * ```tsx
 * const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
 * const throttledPos = useThrottle(mousePos, 100);
 *
 * // throttledPos updates at most every 100ms
 * ```
 */
export function useThrottle<T>(value: T, interval: number = 300): T {
  const [throttledValue, setThrottledValue] = useState<T>(value);
  const lastUpdated = useRef<number>(Date.now());

  useEffect(() => {
    const now = Date.now();
    const timeSinceLastUpdate = now - lastUpdated.current;

    if (timeSinceLastUpdate >= interval) {
      // Enough time has passed, update immediately
      lastUpdated.current = now;
      setThrottledValue(value);
      return;
    }

    // Schedule update for remaining time
    const timer = setTimeout(() => {
      lastUpdated.current = Date.now();
      setThrottledValue(value);
    }, interval - timeSinceLastUpdate);

    return () => clearTimeout(timer);
  }, [value, interval]);

  return throttledValue;
}
