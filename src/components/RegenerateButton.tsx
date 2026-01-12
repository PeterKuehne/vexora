/**
 * RegenerateButton Component
 *
 * Button to regenerate the last AI response
 * - RotateCcw Icon
 * - Loading state during regeneration
 * - Hover animations
 * - Disabled state
 */

import { RotateCcw, Loader2 } from 'lucide-react';
import { useTheme } from '../contexts';
import { cn } from '../utils';

// ============================================
// Types
// ============================================

export interface RegenerateButtonProps {
  /** Called when button is clicked */
  onRegenerate: () => void;
  /** Whether regeneration is in progress */
  isRegenerating?: boolean;
  /** Whether button is disabled */
  disabled?: boolean;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Visual variant */
  variant?: 'default' | 'ghost' | 'outline';
  /** Show text label */
  showLabel?: boolean;
  /** Optional className */
  className?: string;
}

// ============================================
// RegenerateButton Component
// ============================================

export function RegenerateButton({
  onRegenerate,
  isRegenerating = false,
  disabled = false,
  size = 'md',
  variant = 'default',
  showLabel = true,
  className = '',
}: RegenerateButtonProps) {
  const { isDark } = useTheme();

  const isDisabled = disabled || isRegenerating;

  // Size classes
  const sizeClasses = {
    sm: 'px-2 py-1 text-xs gap-1.5',
    md: 'px-3 py-1.5 text-sm gap-2',
    lg: 'px-4 py-2 text-base gap-2.5',
  }[size];

  // Icon sizes
  const iconSize = {
    sm: 12,
    md: 14,
    lg: 16,
  }[size];

  // Variant classes
  const variantClasses = {
    default: isDark
      ? 'bg-white/10 hover:bg-white/20 text-gray-300 border border-white/20'
      : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200',
    ghost: isDark
      ? 'hover:bg-white/10 text-gray-400 hover:text-gray-300'
      : 'hover:bg-gray-100 text-gray-600 hover:text-gray-700',
    outline: isDark
      ? 'border border-white/30 hover:bg-white/10 text-gray-300 hover:border-white/40'
      : 'border border-gray-300 hover:bg-gray-50 text-gray-700 hover:border-gray-400',
  }[variant];

  return (
    <button
      onClick={onRegenerate}
      disabled={isDisabled}
      className={cn(
        'inline-flex items-center justify-center rounded-md font-medium transition-all',
        'focus:outline-none focus:ring-2 focus:ring-primary/20',
        sizeClasses,
        variantClasses,
        isDisabled && 'opacity-50 cursor-not-allowed',
        !isDisabled && 'hover:scale-105 active:scale-95',
        className
      )}
      title={isRegenerating ? 'Regeneriere Antwort...' : 'Antwort regenerieren'}
      aria-label={isRegenerating ? 'Regeneriere Antwort...' : 'Antwort regenerieren'}
    >
      {/* Icon */}
      {isRegenerating ? (
        <Loader2 size={iconSize} className="animate-spin" />
      ) : (
        <RotateCcw size={iconSize} />
      )}

      {/* Label */}
      {showLabel && (
        <span>
          {isRegenerating ? 'Regeneriere...' : 'Regenerieren'}
        </span>
      )}
    </button>
  );
}

// ============================================
// RegenerateButtonIcon - Icon only variant
// ============================================

export interface RegenerateButtonIconProps {
  /** Called when button is clicked */
  onRegenerate: () => void;
  /** Whether regeneration is in progress */
  isRegenerating?: boolean;
  /** Whether button is disabled */
  disabled?: boolean;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Optional className */
  className?: string;
}

export function RegenerateButtonIcon({
  onRegenerate,
  isRegenerating = false,
  disabled = false,
  size = 'md',
  className = '',
}: RegenerateButtonIconProps) {
  const { isDark } = useTheme();

  const isDisabled = disabled || isRegenerating;

  // Size classes
  const sizeClasses = {
    sm: 'p-1',
    md: 'p-1.5',
    lg: 'p-2',
  }[size];

  // Icon sizes
  const iconSize = {
    sm: 12,
    md: 14,
    lg: 16,
  }[size];

  return (
    <button
      onClick={onRegenerate}
      disabled={isDisabled}
      className={cn(
        'inline-flex items-center justify-center rounded-md transition-all',
        'focus:outline-none focus:ring-2 focus:ring-primary/20',
        sizeClasses,
        isDark
          ? 'hover:bg-white/10 text-gray-400 hover:text-gray-300'
          : 'hover:bg-gray-100 text-gray-600 hover:text-gray-700',
        isDisabled && 'opacity-50 cursor-not-allowed',
        !isDisabled && 'hover:scale-110 active:scale-95',
        className
      )}
      title={isRegenerating ? 'Regeneriere Antwort...' : 'Antwort regenerieren'}
      aria-label={isRegenerating ? 'Regeneriere Antwort...' : 'Antwort regenerieren'}
    >
      {isRegenerating ? (
        <Loader2 size={iconSize} className="animate-spin" />
      ) : (
        <RotateCcw size={iconSize} />
      )}
    </button>
  );
}

// ============================================
// RegenerateButtonCompact - Small inline variant
// ============================================

export interface RegenerateButtonCompactProps {
  /** Called when button is clicked */
  onRegenerate: () => void;
  /** Whether regeneration is in progress */
  isRegenerating?: boolean;
  /** Whether button is disabled */
  disabled?: boolean;
  /** Optional className */
  className?: string;
}

export function RegenerateButtonCompact({
  onRegenerate,
  isRegenerating = false,
  disabled = false,
  className = '',
}: RegenerateButtonCompactProps) {
  return (
    <RegenerateButtonIcon
      onRegenerate={onRegenerate}
      isRegenerating={isRegenerating}
      disabled={disabled}
      size="sm"
      className={className}
    />
  );
}