/**
 * ChatTextarea Component
 *
 * Auto-resizing textarea for chat message input.
 * Features:
 * - Auto-resize based on content (up to max 4 lines)
 * - Enter to send, Shift+Enter for newline
 * - Disabled state during streaming
 * - Focus management
 */

import {
  forwardRef,
  useRef,
  useEffect,
  useImperativeHandle,
  type KeyboardEvent,
  type ChangeEvent,
  type TextareaHTMLAttributes,
} from 'react';
import { cn } from '../utils';
import { useAutoResizeValue } from '../hooks';

// ============================================
// Types
// ============================================

export interface ChatTextareaProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange' | 'onSubmit'> {
  /** Current value */
  value: string;
  /** Called when value changes */
  onChange: (value: string) => void;
  /** Called when Enter is pressed (without Shift) */
  onSubmit?: () => void;
  /** Whether the textarea is disabled (e.g., during streaming) */
  isDisabled?: boolean;
  /** Maximum number of lines (default: 4) */
  maxLines?: number;
  /** Minimum number of lines (default: 1) */
  minLines?: number;
  /** Whether to auto-focus on mount */
  autoFocus?: boolean;
  /** Optional className for custom styling */
  className?: string;
}

export interface ChatTextareaRef {
  /** Focus the textarea */
  focus: () => void;
  /** Blur the textarea */
  blur: () => void;
  /** Reset height to min */
  reset: () => void;
  /** Get underlying textarea element */
  getElement: () => HTMLTextAreaElement | null;
}

// Line height in pixels (assumes ~24px per line)
const LINE_HEIGHT = 24;

// ============================================
// ChatTextarea Component
// ============================================

export const ChatTextarea = forwardRef<ChatTextareaRef, ChatTextareaProps>(
  function ChatTextarea(
    {
      value,
      onChange,
      onSubmit,
      isDisabled = false,
      maxLines = 4,
      minLines = 1,
      autoFocus = true,
      className,
      placeholder = 'Nachricht eingeben...',
      ...rest
    },
    ref
  ) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Calculate height limits based on line count
    const maxHeight = maxLines * LINE_HEIGHT;
    const minHeight = minLines * LINE_HEIGHT;

    // Auto-resize hook
    const { reset } = useAutoResizeValue(textareaRef, value, {
      maxHeight,
      minHeight,
    });

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      focus: () => textareaRef.current?.focus(),
      blur: () => textareaRef.current?.blur(),
      reset: () => {
        reset();
        // Also reset scroll position
        if (textareaRef.current) {
          textareaRef.current.scrollTop = 0;
        }
      },
      getElement: () => textareaRef.current,
    }));

    // Auto-focus on mount
    useEffect(() => {
      if (autoFocus && !isDisabled) {
        // Small delay to ensure proper focus
        const timer = setTimeout(() => {
          textareaRef.current?.focus();
        }, 0);
        return () => clearTimeout(timer);
      }
      return undefined;
    }, [autoFocus, isDisabled]);

    // Re-focus when transitioning from disabled to enabled
    useEffect(() => {
      if (!isDisabled && autoFocus) {
        textareaRef.current?.focus();
      }
    }, [isDisabled, autoFocus]);

    /**
     * Handle value changes
     */
    const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
      onChange(e.target.value);
    };

    /**
     * Handle keyboard events
     * - Enter (without Shift) triggers submit
     * - Shift+Enter inserts newline (default behavior)
     */
    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (value.trim() && !isDisabled && onSubmit) {
          onSubmit();
        }
      }
    };

    return (
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        disabled={isDisabled}
        placeholder={placeholder}
        rows={minLines}
        aria-label="Chat-Nachricht eingeben"
        className={cn(
          // Base styles
          'w-full resize-none outline-none bg-transparent',
          // Text styles
          'text-base leading-6',
          // Text color (responsive to theme via CSS variables)
          'text-primary',
          // Placeholder
          'placeholder:text-secondary',
          // Disabled state
          'disabled:opacity-50 disabled:cursor-not-allowed',
          // Custom className
          className
        )}
        style={{
          minHeight: `${minHeight}px`,
          maxHeight: `${maxHeight}px`,
        }}
        {...rest}
      />
    );
  }
);

// ============================================
// ChatTextareaStandalone - Self-contained version
// ============================================

export interface ChatTextareaStandaloneProps
  extends Omit<ChatTextareaProps, 'value' | 'onChange' | 'onSubmit'> {
  /** Initial value */
  initialValue?: string;
  /** Called when value changes */
  onValueChange?: (value: string) => void;
  /** Called when submitting with the value */
  onSubmit?: (value: string) => void;
}

/**
 * Standalone version with internal state management
 * Useful for simple use cases without external state
 */
export const ChatTextareaStandalone = forwardRef<
  ChatTextareaRef & { getValue: () => string; setValue: (v: string) => void },
  ChatTextareaStandaloneProps
>(function ChatTextareaStandalone(
  { initialValue = '', onValueChange, onSubmit, ...props },
  ref
) {
  const innerRef = useRef<ChatTextareaRef>(null);
  const valueRef = useRef(initialValue);

  useImperativeHandle(ref, () => ({
    focus: () => innerRef.current?.focus(),
    blur: () => innerRef.current?.blur(),
    reset: () => {
      valueRef.current = '';
      innerRef.current?.reset();
    },
    getElement: () => innerRef.current?.getElement() ?? null,
    getValue: () => valueRef.current,
    setValue: (v: string) => {
      valueRef.current = v;
    },
  }));

  const handleChange = (newValue: string) => {
    valueRef.current = newValue;
    onValueChange?.(newValue);
  };

  const handleSubmit = () => {
    if (valueRef.current.trim() && onSubmit) {
      onSubmit(valueRef.current.trim());
      valueRef.current = '';
      innerRef.current?.reset();
    }
  };

  return (
    <ChatTextarea
      ref={innerRef}
      value={valueRef.current}
      onChange={handleChange}
      onSubmit={handleSubmit}
      {...props}
    />
  );
});

// ============================================
// ChatTextareaWithControls - With send/stop buttons
// ============================================

import { Send, Square } from 'lucide-react';

export interface ChatTextareaWithControlsProps
  extends Omit<ChatTextareaProps, 'onSubmit'> {
  /** Called when sending a message */
  onSend: (message: string) => void;
  /** Called when clicking stop */
  onStop?: () => void;
  /** Whether AI is streaming */
  isStreaming?: boolean;
  /** Show hint text below */
  showHint?: boolean;
}

/**
 * Complete input component with send/stop buttons
 */
export function ChatTextareaWithControls({
  value,
  onChange,
  onSend,
  onStop,
  isStreaming = false,
  isDisabled = false,
  showHint = true,
  className,
  ...props
}: ChatTextareaWithControlsProps) {
  const textareaRef = useRef<ChatTextareaRef>(null);

  const canSend = value.trim().length > 0 && !isStreaming && !isDisabled;

  const handleSubmit = () => {
    if (canSend) {
      onSend(value.trim());
      onChange('');
      textareaRef.current?.reset();
    }
  };

  const handleStop = () => {
    onStop?.();
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-2 p-3 rounded-xl bg-surface border border-white/10 focus-within:border-white/10">
        <ChatTextarea
          ref={textareaRef}
          value={value}
          onChange={onChange}
          onSubmit={handleSubmit}
          isDisabled={isDisabled || isStreaming}
          className={cn('flex-1 focus:outline-none focus:ring-0', className)}
          {...props}
        />

        {isStreaming ? (
          <button
            type="button"
            onClick={handleStop}
            className={cn(
              'p-2 rounded-lg transition-all flex-shrink-0',
              'bg-red-500/20 text-red-400 hover:bg-red-500/30',
              'cursor-pointer'
            )}
            title="Stoppen"
            aria-label="Nachricht-Generierung stoppen"
          >
            <Square size={18} />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSend}
            className={cn(
              'p-2 rounded-lg transition-all flex-shrink-0',
              canSend
                ? 'bg-primary text-white hover:opacity-90 cursor-pointer'
                : 'bg-white/10 text-gray-500 cursor-not-allowed'
            )}
            title="Senden"
            aria-label="Nachricht senden"
          >
            <Send size={18} />
          </button>
        )}
      </div>

      {showHint && (
        <p className="mt-1 text-xs text-gray-500 text-center">
          Enter zum Senden, Shift+Enter für neue Zeile
        </p>
      )}
    </div>
  );
}

