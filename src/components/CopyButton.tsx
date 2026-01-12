/**
 * CopyButton Component
 *
 * Reusable button component for copying content to clipboard with:
 * - Copy Icon with success feedback
 * - Clipboard API integration
 * - Success state (Copied!)
 * - Loading state support
 * - Multiple variants and sizes
 */

import { Copy, Check, Loader2 } from 'lucide-react';
import { useState, useCallback } from 'react';
import { useTheme } from '../contexts';
import { cn } from '../utils';

// ============================================
// Types
// ============================================

export interface CopyButtonProps {
  /** Content to copy to clipboard */
  content: string;
  /** Button size */
  size?: 'sm' | 'md' | 'lg';
  /** Visual variant */
  variant?: 'default' | 'ghost' | 'outline';
  /** Show text label */
  showLabel?: boolean;
  /** Custom text label */
  label?: string;
  /** Custom copied text */
  copiedText?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Loading state */
  loading?: boolean;
  /** Callback when copy succeeds */
  onCopySuccess?: (content: string) => void;
  /** Callback when copy fails */
  onCopyError?: (error: Error) => void;
  /** Duration to show success state (ms) */
  successDuration?: number;
  /** Optional className */
  className?: string;
  /** Custom title/tooltip */
  title?: string;
}

// ============================================
// CopyButton Component
// ============================================

export function CopyButton({
  content,
  size = 'md',
  variant = 'default',
  showLabel = false,
  label = 'Kopieren',
  copiedText = 'Kopiert!',
  disabled = false,
  loading = false,
  onCopySuccess,
  onCopyError,
  successDuration = 2000,
  className,
  title,
}: CopyButtonProps) {
  const { isDark } = useTheme();
  const [copied, setCopied] = useState(false);

  // Handle copy to clipboard
  const handleCopy = useCallback(async () => {
    if (!content || disabled || loading) return;

    try {
      // Use modern Clipboard API
      await navigator.clipboard.writeText(content);
      setCopied(true);
      onCopySuccess?.(content);

      // Reset copied state after duration
      setTimeout(() => setCopied(false), successDuration);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      onCopyError?.(error as Error);
    }
  }, [content, disabled, loading, onCopySuccess, onCopyError, successDuration]);

  // Size classes
  const sizeClasses = {
    sm: {
      button: 'p-1.5 text-xs',
      icon: 12,
      gap: 'gap-1.5',
    },
    md: {
      button: 'p-2 text-sm',
      icon: 14,
      gap: 'gap-2',
    },
    lg: {
      button: 'p-2.5 text-base',
      icon: 16,
      gap: 'gap-2.5',
    },
  };

  // Variant classes
  const variantClasses = {
    default: isDark
      ? 'bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white'
      : 'bg-gray-200 hover:bg-gray-300 text-gray-600 hover:text-gray-800',
    ghost: isDark
      ? 'hover:bg-white/10 text-gray-400 hover:text-gray-300'
      : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700',
    outline: isDark
      ? 'border border-white/20 hover:bg-white/10 text-gray-300 hover:text-white'
      : 'border border-gray-300 hover:bg-gray-50 text-gray-600 hover:text-gray-800',
  };

  const currentSize = sizeClasses[size];
  const currentVariant = variantClasses[variant];

  // Display states
  const isSuccess = copied;
  const isLoading = loading;
  const currentLabel = isSuccess ? copiedText : label;

  return (
    <button
      onClick={handleCopy}
      disabled={disabled || loading || !content}
      title={title || (isSuccess ? copiedText : label)}
      className={cn(
        // Base styles
        'inline-flex items-center justify-center rounded-md transition-all duration-200',
        'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        // Size and variant
        currentSize.button,
        currentVariant,
        showLabel && currentSize.gap,
        // Success state
        isSuccess && isDark && 'bg-green-600/20 text-green-400',
        isSuccess && !isDark && 'bg-green-100 text-green-700',
        className
      )}
      aria-label={currentLabel}
      data-testid="copy-button"
    >
      {/* Icon */}
      {isSuccess ? (
        <Check
          size={currentSize.icon}
          className="flex-shrink-0"
        />
      ) : isLoading ? (
        <Loader2
          size={currentSize.icon}
          className="flex-shrink-0 animate-spin"
        />
      ) : (
        <Copy
          size={currentSize.icon}
          className="flex-shrink-0"
        />
      )}

      {/* Label */}
      {showLabel && (
        <span className="font-medium">{currentLabel}</span>
      )}
    </button>
  );
}

// ============================================
// Variants
// ============================================

/**
 * Icon-only copy button
 */
export function CopyButtonIcon(props: Omit<CopyButtonProps, 'showLabel'>) {
  return <CopyButton {...props} showLabel={false} />;
}

/**
 * Copy button with text label
 */
export function CopyButtonWithLabel(props: Omit<CopyButtonProps, 'showLabel'>) {
  return <CopyButton {...props} showLabel={true} />;
}

/**
 * Small copy button for inline use
 */
export function CopyButtonSmall(props: Omit<CopyButtonProps, 'size'>) {
  return <CopyButton {...props} size="sm" />;
}

/**
 * Large copy button for prominent actions
 */
export function CopyButtonLarge(props: Omit<CopyButtonProps, 'size'>) {
  return <CopyButton {...props} size="lg" />;
}

/**
 * Ghost copy button (minimal styling)
 */
export function CopyButtonGhost(props: Omit<CopyButtonProps, 'variant'>) {
  return <CopyButton {...props} variant="ghost" />;
}

/**
 * Outline copy button
 */
export function CopyButtonOutline(props: Omit<CopyButtonProps, 'variant'>) {
  return <CopyButton {...props} variant="outline" />;
}