/**
 * InlineCode Component
 *
 * Renders inline code with consistent styling across the app.
 * Features:
 * - Background color for visibility
 * - Monospace font (JetBrains Mono)
 * - Theme-aware styling (dark/light mode)
 * - Rounded corners
 * - Proper padding for readability
 */

import { type ReactNode } from 'react';
import { useTheme } from '../contexts';

export interface InlineCodeProps {
  /** The code content to display */
  children: ReactNode;
  /** Additional CSS classes */
  className?: string;
  /** Custom color scheme (overrides theme) */
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'error';
}

/**
 * InlineCode component for displaying code snippets within text
 *
 * @example
 * ```tsx
 * <p>Use the <InlineCode>console.log()</InlineCode> function to debug.</p>
 * ```
 */
export function InlineCode({
  children,
  className = '',
  variant = 'default',
}: InlineCodeProps) {
  const { isDark } = useTheme();

  // Base styles for all inline code
  const baseStyles = 'px-1.5 py-0.5 rounded text-sm font-code whitespace-nowrap';

  // Variant-specific styles
  const variantStyles = {
    default: isDark
      ? 'bg-white/10 text-pink-400'
      : 'bg-gray-100 text-pink-600',
    primary: isDark
      ? 'bg-primary/20 text-primary'
      : 'bg-primary/10 text-primary',
    success: isDark
      ? 'bg-green-500/20 text-green-400'
      : 'bg-green-100 text-green-700',
    warning: isDark
      ? 'bg-yellow-500/20 text-yellow-400'
      : 'bg-yellow-100 text-yellow-700',
    error: isDark
      ? 'bg-red-500/20 text-red-400'
      : 'bg-red-100 text-red-700',
  };

  return (
    <code className={`${baseStyles} ${variantStyles[variant]} ${className}`}>
      {children}
    </code>
  );
}

/**
 * InlineCodePrimary - Blue/primary colored inline code
 */
export function InlineCodePrimary({
  children,
  className = '',
}: Omit<InlineCodeProps, 'variant'>) {
  return (
    <InlineCode variant="primary" className={className}>
      {children}
    </InlineCode>
  );
}

/**
 * InlineCodeSuccess - Green colored inline code (for success states)
 */
export function InlineCodeSuccess({
  children,
  className = '',
}: Omit<InlineCodeProps, 'variant'>) {
  return (
    <InlineCode variant="success" className={className}>
      {children}
    </InlineCode>
  );
}

/**
 * InlineCodeWarning - Yellow/orange colored inline code (for warnings)
 */
export function InlineCodeWarning({
  children,
  className = '',
}: Omit<InlineCodeProps, 'variant'>) {
  return (
    <InlineCode variant="warning" className={className}>
      {children}
    </InlineCode>
  );
}

/**
 * InlineCodeError - Red colored inline code (for errors)
 */
export function InlineCodeError({
  children,
  className = '',
}: Omit<InlineCodeProps, 'variant'>) {
  return (
    <InlineCode variant="error" className={className}>
      {children}
    </InlineCode>
  );
}

/**
 * InlineCodePlain - Minimal styling, just monospace font
 */
export function InlineCodePlain({
  children,
  className = '',
}: Omit<InlineCodeProps, 'variant'>) {
  const { isDark } = useTheme();

  return (
    <code
      className={`font-code text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'} ${className}`}
    >
      {children}
    </code>
  );
}
