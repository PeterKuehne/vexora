/**
 * Toast Component - Toast Notification UI
 *
 * Displays toast notifications with support for different types,
 * auto-dismiss, retry buttons, and dismissible interactions.
 */

import { useEffect, useState } from 'react';
import {
  X,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Info,
  RefreshCw,
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import type { Toast as ToastType, ToastType as ToastVariant } from '../contexts/ToastContext';

// ============================================
// Types
// ============================================

interface ToastProps {
  toast: ToastType;
  onDismiss: (id: string) => void;
}

interface ToastContainerProps {
  toasts: ToastType[];
  onDismiss: (id: string) => void;
}

// ============================================
// Styles
// ============================================

const TOAST_STYLES_DARK: Record<
  ToastVariant,
  {
    bg: string;
    border: string;
    icon: string;
    title: string;
    text: string;
    button: string;
  }
> = {
  error: {
    bg: 'bg-red-950/90',
    border: 'border-red-500/50',
    icon: 'text-red-400',
    title: 'text-red-200',
    text: 'text-red-300',
    button: 'bg-red-600 hover:bg-red-500 text-white',
  },
  warning: {
    bg: 'bg-yellow-950/90',
    border: 'border-yellow-500/50',
    icon: 'text-yellow-400',
    title: 'text-yellow-200',
    text: 'text-yellow-300',
    button: 'bg-yellow-600 hover:bg-yellow-500 text-white',
  },
  success: {
    bg: 'bg-green-950/90',
    border: 'border-green-500/50',
    icon: 'text-green-400',
    title: 'text-green-200',
    text: 'text-green-300',
    button: 'bg-green-600 hover:bg-green-500 text-white',
  },
  info: {
    bg: 'bg-blue-950/90',
    border: 'border-blue-500/50',
    icon: 'text-blue-400',
    title: 'text-blue-200',
    text: 'text-blue-300',
    button: 'bg-blue-600 hover:bg-blue-500 text-white',
  },
};

const TOAST_STYLES_LIGHT: Record<
  ToastVariant,
  {
    bg: string;
    border: string;
    icon: string;
    title: string;
    text: string;
    button: string;
  }
> = {
  error: {
    bg: 'bg-red-50',
    border: 'border-red-300',
    icon: 'text-red-600',
    title: 'text-red-900',
    text: 'text-red-800',
    button: 'bg-red-600 hover:bg-red-700 text-white',
  },
  warning: {
    bg: 'bg-yellow-50',
    border: 'border-yellow-300',
    icon: 'text-yellow-600',
    title: 'text-yellow-900',
    text: 'text-yellow-800',
    button: 'bg-yellow-600 hover:bg-yellow-700 text-white',
  },
  success: {
    bg: 'bg-green-50',
    border: 'border-green-400',
    icon: 'text-green-700',
    title: 'text-green-900',
    text: 'text-green-800',
    button: 'bg-green-600 hover:bg-green-700 text-white',
  },
  info: {
    bg: 'bg-blue-50',
    border: 'border-blue-300',
    icon: 'text-blue-600',
    title: 'text-blue-900',
    text: 'text-blue-800',
    button: 'bg-blue-600 hover:bg-blue-700 text-white',
  },
};

const TOAST_ICONS: Record<ToastVariant, typeof AlertCircle> = {
  error: AlertCircle,
  warning: AlertTriangle,
  success: CheckCircle,
  info: Info,
};

const TOAST_TITLES: Record<ToastVariant, string> = {
  error: 'Fehler',
  warning: 'Warnung',
  success: 'Erfolgreich',
  info: 'Info',
};

// ============================================
// Single Toast Component
// ============================================

export function Toast({ toast, onDismiss }: ToastProps) {
  const { isDark } = useTheme();
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  const styles = isDark ? TOAST_STYLES_DARK[toast.type] : TOAST_STYLES_LIGHT[toast.type];
  const Icon = TOAST_ICONS[toast.type];
  const defaultTitle = TOAST_TITLES[toast.type];

  // Animate in on mount
  useEffect(() => {
    // Small delay for animation
    const timer = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    setIsExiting(true);
    // Wait for exit animation
    setTimeout(() => {
      onDismiss(toast.id);
    }, 200);
  };

  const handleRetry = async () => {
    if (!toast.onRetry) return;
    setIsRetrying(true);
    try {
      await toast.onRetry();
      // If retry succeeds, dismiss the toast
      handleDismiss();
    } catch {
      // If retry fails, just stop loading
      setIsRetrying(false);
    }
  };

  return (
    <div
      className={`
        relative flex items-start gap-3 p-4 rounded-lg border shadow-lg backdrop-blur-sm
        transition-all duration-200 ease-out
        ${styles.bg} ${styles.border}
        ${isVisible && !isExiting ? 'translate-x-0 opacity-100' : 'translate-x-8 opacity-0'}
        max-w-sm w-full
      `}
      role="alert"
      aria-live="assertive"
    >
      {/* Icon */}
      <div className={`flex-shrink-0 mt-0.5 ${styles.icon}`}>
        <Icon size={20} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Title */}
        <p className={`font-medium text-sm ${styles.title}`}>
          {toast.title || defaultTitle}
        </p>

        {/* Message */}
        <p className={`mt-1 text-sm ${styles.text} break-words`}>{toast.message}</p>

        {/* Retry Button */}
        {toast.onRetry && (
          <button
            onClick={handleRetry}
            disabled={isRetrying}
            className={`
              mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
              rounded transition-colors ${styles.button}
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
          >
            <RefreshCw size={12} className={isRetrying ? 'animate-spin' : ''} />
            {isRetrying ? 'Versuche...' : 'Erneut versuchen'}
          </button>
        )}
      </div>

      {/* Dismiss Button */}
      {toast.dismissible !== false && (
        <button
          onClick={handleDismiss}
          className={`
            flex-shrink-0 p-1 rounded-full transition-colors
            ${styles.icon} hover:bg-white/10
          `}
          aria-label="Schließen"
        >
          <X size={16} />
        </button>
      )}

      {/* Progress bar for auto-dismiss */}
      {toast.duration && toast.duration > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/10 rounded-b-lg overflow-hidden">
          <div
            className={`h-full ${styles.icon.replace('text-', 'bg-')} opacity-50`}
            style={{
              animation: `shrink ${toast.duration}ms linear forwards`,
            }}
          />
        </div>
      )}
    </div>
  );
}

// ============================================
// Toast Container Component
// ============================================

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none"
      aria-live="polite"
      aria-label="Benachrichtigungen"
    >
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <Toast toast={toast} onDismiss={onDismiss} />
        </div>
      ))}

      {/* Animation keyframe for progress bar */}
      <style>{`
        @keyframes shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
}
