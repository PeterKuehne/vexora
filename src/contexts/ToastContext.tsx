/**
 * Toast Context - Toast Notifications für Netzwerk-Fehler
 *
 * Provides a global toast notification system for displaying
 * error messages, warnings, and success notifications.
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';

// ============================================
// Types
// ============================================

export type ToastType = 'error' | 'warning' | 'success' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  title?: string | undefined;
  /** Duration in ms before auto-dismiss (0 = no auto-dismiss) */
  duration?: number | undefined;
  /** Optional retry callback for retryable errors */
  onRetry?: (() => void) | undefined;
  /** Whether this toast can be dismissed by clicking */
  dismissible?: boolean | undefined;
}

interface ToastOptions {
  title?: string | undefined;
  duration?: number | undefined;
  onRetry?: (() => void) | undefined;
  dismissible?: boolean | undefined;
}

interface ToastContextValue {
  toasts: Toast[];
  /** Add a new toast */
  addToast: (type: ToastType, message: string, options?: ToastOptions) => string;
  /** Remove a toast by ID */
  removeToast: (id: string) => void;
  /** Clear all toasts */
  clearToasts: () => void;
  /** Convenience methods */
  error: (message: string, options?: ToastOptions) => string;
  warning: (message: string, options?: ToastOptions) => string;
  success: (message: string, options?: ToastOptions) => string;
  info: (message: string, options?: ToastOptions) => string;
}

// ============================================
// Constants
// ============================================

const DEFAULT_DURATION: Record<ToastType, number> = {
  error: 8000,
  warning: 6000,
  success: 4000,
  info: 5000,
};

const MAX_TOASTS = 5;

// ============================================
// Context
// ============================================

const ToastContext = createContext<ToastContextValue | null>(null);

// ============================================
// Provider
// ============================================

interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Cleanup timers on unmount
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  // Remove toast by ID
  const removeToast = useCallback((id: string) => {
    // Clear timer if exists
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }

    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  // Add a new toast
  const addToast = useCallback(
    (type: ToastType, message: string, options?: ToastOptions): string => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const duration = options?.duration ?? DEFAULT_DURATION[type];

      const newToast: Toast = {
        id,
        type,
        message,
        title: options?.title,
        duration,
        onRetry: options?.onRetry,
        dismissible: options?.dismissible ?? true,
      };

      setToasts((prev) => {
        // Remove oldest toasts if we exceed MAX_TOASTS
        const updated = [...prev, newToast];
        if (updated.length > MAX_TOASTS) {
          const removed = updated.slice(0, updated.length - MAX_TOASTS);
          removed.forEach((toast) => {
            const timer = timersRef.current.get(toast.id);
            if (timer) {
              clearTimeout(timer);
              timersRef.current.delete(toast.id);
            }
          });
          return updated.slice(-MAX_TOASTS);
        }
        return updated;
      });

      // Auto-dismiss after duration (if > 0)
      if (duration > 0) {
        const timer = setTimeout(() => {
          removeToast(id);
        }, duration);
        timersRef.current.set(id, timer);
      }

      return id;
    },
    [removeToast]
  );

  // Clear all toasts
  const clearToasts = useCallback(() => {
    timersRef.current.forEach((timer) => clearTimeout(timer));
    timersRef.current.clear();
    setToasts([]);
  }, []);

  // Convenience methods
  const error = useCallback(
    (message: string, options?: ToastOptions) => addToast('error', message, options),
    [addToast]
  );

  const warning = useCallback(
    (message: string, options?: ToastOptions) => addToast('warning', message, options),
    [addToast]
  );

  const success = useCallback(
    (message: string, options?: ToastOptions) => addToast('success', message, options),
    [addToast]
  );

  const info = useCallback(
    (message: string, options?: ToastOptions) => addToast('info', message, options),
    [addToast]
  );

  const value: ToastContextValue = {
    toasts,
    addToast,
    removeToast,
    clearToasts,
    error,
    warning,
    success,
    info,
  };

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

// ============================================
// Hooks
// ============================================

/**
 * Use the toast context
 */
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

/**
 * Get just the toasts array (for Toast container)
 */
export function useToasts(): Toast[] {
  const { toasts } = useToast();
  return toasts;
}
