/**
 * InputArea - Fixed Bottom Input Layout Component
 *
 * Provides a consistent layout for chat input areas with:
 * - Fixed position at bottom of container
 * - Border separator from content above
 * - Padding and spacing
 * - Support for hints and additional content
 *
 * This is a layout wrapper - use with ChatInput or other input components.
 */

import { type ReactNode } from 'react';
import { useTheme } from '../../contexts';

export interface InputAreaProps {
  /** Main input content (e.g., ChatInput component) */
  children: ReactNode;
  /** Hint text displayed below input */
  hint?: string;
  /** Additional content before the input (e.g., attachments preview) */
  beforeInput?: ReactNode;
  /** Additional content after the input (e.g., extra buttons) */
  afterInput?: ReactNode;
  /** Whether to show the top border */
  showBorder?: boolean;
  /** Custom padding (default: p-4) */
  padding?: string;
  /** Custom className for container */
  className?: string;
}

export function InputArea({
  children,
  hint,
  beforeInput,
  afterInput,
  showBorder = true,
  padding = 'p-4',
  className = '',
}: InputAreaProps) {
  const { isDark } = useTheme();

  return (
    <div
      className={`
        shrink-0
        ${showBorder ? `border-t ${isDark ? 'border-white/10' : 'border-gray-200'}` : ''}
        ${isDark ? 'bg-background' : 'bg-white'}
        ${className}
      `.trim()}
    >
      {/* Before Input Content */}
      {beforeInput && (
        <div
          className={`
            px-4 pt-3 pb-2
            border-b
            ${isDark ? 'border-white/5' : 'border-gray-100'}
          `.trim()}
        >
          {beforeInput}
        </div>
      )}

      {/* Main Input Area */}
      <div className={padding}>
        {children}
      </div>

      {/* After Input Content */}
      {afterInput && (
        <div
          className={`
            px-4 pb-3 pt-0
            ${isDark ? 'text-gray-400' : 'text-gray-500'}
          `.trim()}
        >
          {afterInput}
        </div>
      )}

      {/* Hint Text */}
      {hint && (
        <div
          className={`
            px-4 pb-3 pt-0 text-xs text-center
            ${isDark ? 'text-gray-500' : 'text-gray-400'}
          `.trim()}
        >
          {hint}
        </div>
      )}
    </div>
  );
}

/**
 * InputAreaCompact - Minimal input area without extra spacing
 */
export interface InputAreaCompactProps {
  /** Main input content */
  children: ReactNode;
  /** Custom className */
  className?: string;
}

export function InputAreaCompact({ children, className = '' }: InputAreaCompactProps) {
  const { isDark } = useTheme();

  return (
    <div
      className={`
        shrink-0 p-2
        border-t
        ${isDark ? 'border-white/10 bg-background' : 'border-gray-200 bg-white'}
        ${className}
      `.trim()}
    >
      {children}
    </div>
  );
}
