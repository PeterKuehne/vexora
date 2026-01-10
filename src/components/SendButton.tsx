/**
 * SendButton Component
 *
 * Button for sending chat messages.
 * Supports disabled state when empty, loading state during streaming,
 * and a stop variant for canceling generation.
 */

import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Send, Square, Loader2 } from 'lucide-react';
import { cn } from '../utils';

// ============================================================================
// Types
// ============================================================================

export type SendButtonSize = 'sm' | 'md' | 'lg';
export type SendButtonVariant = 'primary' | 'secondary' | 'ghost';

export interface SendButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Size of the button */
  size?: SendButtonSize;
  /** Visual variant */
  variant?: SendButtonVariant;
  /** Whether the input has content (enables button) */
  hasContent?: boolean;
  /** Whether the AI is currently generating */
  isStreaming?: boolean;
  /** Whether the button is in loading state (shows spinner) */
  isLoading?: boolean;
  /** Custom label (default: "Senden" / "Stoppen") */
  label?: string;
  /** Whether to show the label text */
  showLabel?: boolean;
  /** Called when stop button is clicked */
  onStop?: () => void;
}

export type SendButtonIconProps = Omit<SendButtonProps, 'showLabel' | 'label'>;

export interface StopButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Size of the button */
  size?: SendButtonSize;
  /** Custom label (default: "Stoppen") */
  label?: string;
  /** Whether to show the label text */
  showLabel?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const sizeStyles: Record<SendButtonSize, { button: string; icon: number }> = {
  sm: { button: 'p-1.5', icon: 14 },
  md: { button: 'p-2', icon: 18 },
  lg: { button: 'p-3', icon: 22 },
};

const variantStyles: Record<
  SendButtonVariant,
  { enabled: string; disabled: string }
> = {
  primary: {
    enabled: 'bg-primary text-white hover:opacity-90',
    disabled: 'bg-white/10 text-gray-500',
  },
  secondary: {
    enabled: 'bg-surface text-white hover:bg-surface-hover border border-white/10',
    disabled: 'bg-surface/50 text-gray-500 border border-white/5',
  },
  ghost: {
    enabled: 'bg-transparent text-white hover:bg-white/10',
    disabled: 'bg-transparent text-gray-500',
  },
};

// ============================================================================
// SendButton Component
// ============================================================================

/**
 * SendButton - Primary send button for chat input
 *
 * Features:
 * - Send icon with optional label
 * - Disabled state when no content
 * - Loading state with spinner
 * - Streaming state transforms into stop button
 */
export const SendButton = forwardRef<HTMLButtonElement, SendButtonProps>(
  (
    {
      size = 'md',
      variant = 'primary',
      hasContent = true,
      isStreaming = false,
      isLoading = false,
      label,
      showLabel = false,
      onStop,
      disabled,
      className,
      onClick,
      ...props
    },
    ref
  ) => {
    const sizeConfig = sizeStyles[size];
    const variantConfig = variantStyles[variant];

    // If streaming, show stop button
    if (isStreaming) {
      return (
        <StopButton
          ref={ref}
          size={size}
          showLabel={showLabel}
          label={label ?? 'Stoppen'}
          onClick={(e) => {
            e.preventDefault();
            onStop?.();
          }}
          className={className}
          {...props}
        />
      );
    }

    const isDisabled = disabled || !hasContent || isLoading;
    const buttonLabel = label ?? 'Senden';

    return (
      <button
        ref={ref}
        type="submit"
        disabled={isDisabled}
        onClick={onClick}
        className={cn(
          'rounded-lg transition-all duration-200',
          'inline-flex items-center justify-center gap-1.5',
          sizeConfig.button,
          isDisabled
            ? cn(variantConfig.disabled, 'cursor-not-allowed')
            : cn(variantConfig.enabled, 'cursor-pointer'),
          className
        )}
        title={buttonLabel}
        aria-label={buttonLabel}
        {...props}
      >
        {isLoading ? (
          <Loader2 size={sizeConfig.icon} className="animate-spin" />
        ) : (
          <Send size={sizeConfig.icon} />
        )}
        {showLabel && <span className="text-sm font-medium">{buttonLabel}</span>}
      </button>
    );
  }
);

SendButton.displayName = 'SendButton';

// ============================================================================
// SendButtonIcon Component
// ============================================================================

/**
 * SendButtonIcon - Icon-only variant of SendButton
 */
export const SendButtonIcon = forwardRef<HTMLButtonElement, SendButtonIconProps>(
  (props, ref) => {
    return <SendButton ref={ref} showLabel={false} {...props} />;
  }
);

SendButtonIcon.displayName = 'SendButtonIcon';

// ============================================================================
// StopButton Component
// ============================================================================

/**
 * StopButton - Button to stop AI generation
 *
 * Red-styled button with square icon to indicate stopping.
 */
export const StopButton = forwardRef<HTMLButtonElement, StopButtonProps>(
  (
    { size = 'md', label = 'Stoppen', showLabel = false, className, ...props },
    ref
  ) => {
    const sizeConfig = sizeStyles[size];

    return (
      <button
        ref={ref}
        type="button"
        className={cn(
          'rounded-lg transition-all duration-200',
          'inline-flex items-center justify-center gap-1.5',
          'bg-red-500/20 text-red-400 hover:bg-red-500/30',
          'cursor-pointer',
          sizeConfig.button,
          className
        )}
        title={label}
        aria-label={label}
        {...props}
      >
        <Square size={sizeConfig.icon} />
        {showLabel && <span className="text-sm font-medium">{label}</span>}
      </button>
    );
  }
);

StopButton.displayName = 'StopButton';

// ============================================================================
// SendButtonWithLoading Component
// ============================================================================

export interface SendButtonWithLoadingProps extends SendButtonProps {
  /** Loading text to show */
  loadingText?: string;
}

/**
 * SendButtonWithLoading - SendButton with explicit loading state display
 */
export const SendButtonWithLoading = forwardRef<
  HTMLButtonElement,
  SendButtonWithLoadingProps
>(({ isLoading = false, loadingText = 'Senden...', showLabel = true, label, ...props }, ref) => {
  const displayLabel = isLoading ? loadingText : (label ?? 'Senden');
  return (
    <SendButton
      ref={ref}
      isLoading={isLoading}
      showLabel={showLabel}
      label={displayLabel}
      {...props}
    />
  );
});

SendButtonWithLoading.displayName = 'SendButtonWithLoading';

export default SendButton;
