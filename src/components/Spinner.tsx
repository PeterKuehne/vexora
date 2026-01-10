/**
 * Spinner Component
 *
 * Animated loading spinner for async operations.
 */

import { Loader2 } from 'lucide-react';
import { cn } from '../utils';

// ============================================
// Spinner
// ============================================

interface SpinnerProps {
  /** Size of the spinner */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** Color variant */
  color?: 'default' | 'primary' | 'white' | 'muted';
  /** Additional CSS classes */
  className?: string;
  /** Screen reader label */
  label?: string;
}

export function Spinner({
  size = 'md',
  color = 'default',
  className,
  label = 'Wird geladen...',
}: SpinnerProps) {
  const sizeClass =
    size === 'xs'
      ? 'w-3 h-3'
      : size === 'sm'
        ? 'w-4 h-4'
        : size === 'md'
          ? 'w-5 h-5'
          : size === 'lg'
            ? 'w-6 h-6'
            : 'w-8 h-8';

  const colorClass =
    color === 'primary'
      ? 'text-primary'
      : color === 'white'
        ? 'text-white'
        : color === 'muted'
          ? 'text-gray-400 dark:text-gray-500'
          : 'text-gray-600 dark:text-gray-300';

  return (
    <Loader2
      className={cn(sizeClass, colorClass, 'animate-spin', className)}
      aria-hidden="true"
    >
      <span className="sr-only">{label}</span>
    </Loader2>
  );
}

// ============================================
// Spinner Overlay
// ============================================

interface SpinnerOverlayProps {
  /** Whether the overlay is visible */
  visible?: boolean;
  /** Size of the spinner */
  size?: SpinnerProps['size'];
  /** Label text below spinner */
  label?: string;
  /** Additional CSS classes for overlay */
  className?: string;
  /** Whether to blur the background */
  blur?: boolean;
}

export function SpinnerOverlay({
  visible = true,
  size = 'lg',
  label,
  className,
  blur = false,
}: SpinnerOverlayProps) {
  if (!visible) return null;

  return (
    <div
      className={cn(
        'absolute inset-0 flex flex-col items-center justify-center',
        'bg-white/80 dark:bg-gray-900/80',
        blur && 'backdrop-blur-sm',
        'z-50',
        className
      )}
      role="status"
      aria-live="polite"
    >
      <Spinner size={size} />
      {label && (
        <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">{label}</p>
      )}
    </div>
  );
}

// ============================================
// Inline Spinner (for buttons, etc.)
// ============================================

interface InlineSpinnerProps {
  /** Size of the spinner */
  size?: 'xs' | 'sm' | 'md';
  /** Additional CSS classes */
  className?: string;
}

export function InlineSpinner({ size = 'sm', className }: InlineSpinnerProps) {
  return <Spinner size={size} color="default" {...(className ? { className } : {})} />;
}

// ============================================
// Button Loading State
// ============================================

interface LoadingButtonContentProps {
  /** Whether loading */
  isLoading: boolean;
  /** Loading text */
  loadingText?: string;
  /** Normal content */
  children: React.ReactNode;
  /** Spinner size */
  spinnerSize?: 'xs' | 'sm' | 'md';
}

export function LoadingButtonContent({
  isLoading,
  loadingText,
  children,
  spinnerSize = 'sm',
}: LoadingButtonContentProps) {
  if (isLoading) {
    return (
      <>
        <InlineSpinner size={spinnerSize} className="mr-2" />
        {loadingText ?? 'Laden...'}
      </>
    );
  }

  return <>{children}</>;
}
