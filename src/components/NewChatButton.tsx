/**
 * NewChatButton Component
 *
 * Prominent button for creating a new conversation.
 * Features:
 * - Plus icon
 * - Primary styling
 * - Multiple size variants
 * - Optional label
 */

import { Plus } from 'lucide-react';
import { cn } from '../utils';

// ============================================
// Types
// ============================================

export interface NewChatButtonProps {
  /** Click handler */
  onClick: () => void;
  /** Button size */
  size?: 'sm' | 'md' | 'lg';
  /** Whether to show label */
  showLabel?: boolean;
  /** Custom label text */
  label?: string;
  /** Whether the button is disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Button variant */
  variant?: 'primary' | 'secondary' | 'ghost';
}

// ============================================
// NewChatButton Component
// ============================================

export function NewChatButton({
  onClick,
  size = 'md',
  showLabel = true,
  label = 'Neu',
  disabled = false,
  className,
  variant = 'primary',
}: NewChatButtonProps) {
  // Size classes
  const sizeClasses = {
    sm: 'px-2.5 py-1.5 text-xs gap-1',
    md: 'px-3 py-2 text-sm gap-1.5',
    lg: 'px-4 py-2.5 text-base gap-2',
  };

  // Icon size
  const iconSize = {
    sm: 14,
    md: 16,
    lg: 18,
  };

  // Variant classes
  const variantClasses = {
    primary: cn(
      'bg-primary text-white',
      'hover:bg-primary/90 active:bg-primary/80',
      'shadow-sm hover:shadow'
    ),
    secondary: cn(
      'bg-white/10 text-white',
      'hover:bg-white/20 active:bg-white/15',
      'dark:bg-white/10 dark:hover:bg-white/20',
      'light:bg-black/5 light:text-gray-900 light:hover:bg-black/10'
    ),
    ghost: cn(
      'text-gray-400 hover:text-white',
      'hover:bg-white/10 active:bg-white/5',
      'dark:text-gray-400 dark:hover:text-white',
      'light:text-gray-600 light:hover:text-gray-900 light:hover:bg-black/5'
    ),
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        // Base styles
        'inline-flex items-center justify-center',
        'rounded-lg font-medium',
        'transition-all duration-150',
        'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-transparent',
        // Size
        sizeClasses[size],
        // Variant
        variantClasses[variant],
        // Disabled state
        disabled && 'opacity-50 cursor-not-allowed pointer-events-none',
        // Custom classes
        className
      )}
      title="Neue Unterhaltung"
      aria-label="Neue Unterhaltung erstellen"
    >
      <Plus size={iconSize[size]} className="flex-shrink-0" />
      {showLabel && <span>{label}</span>}
    </button>
  );
}

// ============================================
// Icon-only variant
// ============================================

export interface NewChatButtonIconProps {
  /** Click handler */
  onClick: () => void;
  /** Button size */
  size?: 'sm' | 'md' | 'lg';
  /** Whether the button is disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
}

export function NewChatButtonIcon({
  onClick,
  size = 'md',
  disabled = false,
  className,
}: NewChatButtonIconProps) {
  return (
    <NewChatButton
      onClick={onClick}
      size={size}
      showLabel={false}
      disabled={disabled}
      variant="ghost"
      {...(className ? { className } : {})}
    />
  );
}

// ============================================
// Floating Action Button variant
// ============================================

export interface NewChatFABProps {
  /** Click handler */
  onClick: () => void;
  /** Whether the button is disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Position */
  position?: 'bottom-right' | 'bottom-left' | 'bottom-center';
}

export function NewChatFAB({
  onClick,
  disabled = false,
  className,
  position = 'bottom-right',
}: NewChatFABProps) {
  const positionClasses = {
    'bottom-right': 'bottom-6 right-6',
    'bottom-left': 'bottom-6 left-6',
    'bottom-center': 'bottom-6 left-1/2 -translate-x-1/2',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'fixed z-50',
        positionClasses[position],
        // Circle shape
        'w-14 h-14 rounded-full',
        // Primary styling
        'bg-primary text-white',
        'hover:bg-primary/90 active:bg-primary/80',
        // Shadow
        'shadow-lg hover:shadow-xl',
        // Animation
        'transition-all duration-200',
        'hover:scale-105 active:scale-95',
        // Focus
        'focus:outline-none focus:ring-4 focus:ring-primary/30',
        // Disabled
        disabled && 'opacity-50 cursor-not-allowed pointer-events-none',
        className
      )}
      title="Neue Unterhaltung"
      aria-label="Neue Unterhaltung erstellen"
    >
      <Plus size={24} className="mx-auto" />
    </button>
  );
}
