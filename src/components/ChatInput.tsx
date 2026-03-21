/**
 * ChatInput Component
 *
 * Text input with send button for chat messages.
 * Supports Enter to send, Shift+Enter for newlines.
 * Refined Monochrome design with subtle borders and rounded-xl.
 */

import { useState, useRef, useEffect, type KeyboardEvent, type FormEvent } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { cn } from '../utils';
import { SendButton } from './SendButton';

export interface ChatInputProps {
  /** Called when user sends a message */
  onSend: (message: string) => void;
  /** Called when user clicks stop */
  onStop?: () => void;
  /** Whether the AI is currently generating a response */
  isStreaming?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Whether the input is disabled */
  disabled?: boolean;
}

export function ChatInput({
  onSend,
  onStop,
  isStreaming = false,
  placeholder = 'Nachricht eingeben...',
  disabled = false,
}: ChatInputProps) {
  const { isDark } = useTheme();
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [input]);

  // Focus textarea on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isStreaming && !disabled) {
      onSend(input.trim());
      setInput('');
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter without Shift sends the message
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleStop = () => {
    onStop?.();
  };

  return (
    <form onSubmit={handleSubmit} className="relative">
      <div className={cn(
        'flex items-center gap-2 p-3 md:p-4 rounded-xl',
        'transition-colors duration-200',
        isDark
          ? 'bg-white/[0.03] border border-white/[0.08] focus-within:border-white/[0.15] focus-within:bg-white/[0.05] focus-within:ring-1 focus-within:ring-blue-500/20'
          : 'bg-white border border-gray-200/80 focus-within:border-gray-300 focus-within:ring-1 focus-within:ring-blue-500/20 shadow-sm'
      )}>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || isStreaming}
          rows={1}
          className={cn(
            'flex-1 bg-transparent resize-none outline-none',
            'text-primary placeholder:text-secondary',
            'min-h-[36px] md:min-h-[24px] max-h-[200px]',
            'text-base md:text-sm',
            'touch-optimize',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'focus:outline-none focus:ring-0 focus:border-0'
          )}
        />

        <SendButton
          hasContent={input.trim().length > 0}
          isStreaming={isStreaming}
          disabled={disabled}
          onStop={handleStop}
        />
      </div>
    </form>
  );
}
