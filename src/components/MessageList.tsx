/**
 * MessageList Component
 *
 * Scrollable list of messages with:
 * - Auto-scroll to bottom on new messages
 * - Loading indicator during streaming
 * - Empty state handling
 * - Proper spacing and animations
 */

import { useRef, useEffect, forwardRef, useImperativeHandle, type ReactNode } from 'react';
import { MessageBubble } from './MessageBubble';
import { useTheme } from '../contexts';
import type { Message } from '../types';

// ============================================
// Types
// ============================================

export interface MessageListProps {
  /** Array of messages to display */
  messages: Message[];
  /** Whether a response is currently streaming */
  isStreaming?: boolean;
  /** Optional loading indicator component */
  loadingIndicator?: ReactNode;
  /** Optional empty state component */
  emptyState?: ReactNode;
  /** Whether to auto-scroll to bottom on new messages */
  autoScroll?: boolean;
  /** Optional className for container */
  className?: string;
}

export interface MessageListRef {
  /** Scroll to the bottom of the list */
  scrollToBottom: (behavior?: ScrollBehavior) => void;
  /** Scroll to a specific message by ID */
  scrollToMessage: (messageId: string, behavior?: ScrollBehavior) => void;
  /** Get the container element */
  getContainer: () => HTMLDivElement | null;
}

// ============================================
// MessageList Component
// ============================================

export const MessageList = forwardRef<MessageListRef, MessageListProps>(
  function MessageList(
    {
      messages,
      isStreaming = false,
      loadingIndicator,
      emptyState,
      autoScroll = true,
      className = '',
    },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const bottomAnchorRef = useRef<HTMLDivElement>(null);
    const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());

    // Expose imperative methods via ref
    useImperativeHandle(ref, () => ({
      scrollToBottom: (behavior: ScrollBehavior = 'smooth') => {
        bottomAnchorRef.current?.scrollIntoView({ behavior });
      },
      scrollToMessage: (messageId: string, behavior: ScrollBehavior = 'smooth') => {
        const messageEl = messageRefs.current.get(messageId);
        if (messageEl) {
          messageEl.scrollIntoView({ behavior, block: 'center' });
        }
      },
      getContainer: () => containerRef.current,
    }));

    // Auto-scroll when messages change
    useEffect(() => {
      if (autoScroll && messages.length > 0) {
        // Use requestAnimationFrame for smoother scroll after render
        requestAnimationFrame(() => {
          bottomAnchorRef.current?.scrollIntoView({ behavior: 'smooth' });
        });
      }
    }, [autoScroll, messages.length, messages[messages.length - 1]?.content]);

    // Register message element refs
    const setMessageRef = (id: string, el: HTMLDivElement | null) => {
      if (el) {
        messageRefs.current.set(id, el);
      } else {
        messageRefs.current.delete(id);
      }
    };

    // Empty state
    if (messages.length === 0 && !isStreaming) {
      if (emptyState) {
        return (
          <div
            ref={containerRef}
            className={`flex items-center justify-center h-full ${className}`}
          >
            {emptyState}
          </div>
        );
      }
      return null;
    }

    return (
      <div
        ref={containerRef}
        className={`
          flex flex-col min-h-full
          ${className}
        `.trim()}
        role="log"
        aria-label="Chat-Nachrichten"
        aria-live="polite"
      >
        {/* Messages */}
        <div className="flex-1 py-4">
          {messages.map((message, index) => (
            <div
              key={message.id}
              ref={(el) => setMessageRef(message.id, el)}
              className={`
                animate-in fade-in slide-in-from-bottom-2 duration-300
                ${index > 0 ? 'mt-1' : ''}
              `}
              style={{ animationDelay: `${Math.min(index * 50, 200)}ms` }}
            >
              <MessageBubble message={message} />
            </div>
          ))}

          {/* Loading Indicator (shown during streaming) */}
          {isStreaming && loadingIndicator && (
            <div className="animate-in fade-in duration-200 mt-4">
              {loadingIndicator}
            </div>
          )}
        </div>

        {/* Scroll Anchor - Always at bottom */}
        <div ref={bottomAnchorRef} aria-hidden="true" className="h-px" />
      </div>
    );
  }
);

// ============================================
// MessageListItem - Single message wrapper
// ============================================

export interface MessageListItemProps {
  /** The message to display */
  message: Message;
  /** Whether this is the last message */
  isLast?: boolean;
  /** Optional className */
  className?: string;
}

export function MessageListItem({ message, isLast, className = '' }: MessageListItemProps) {
  return (
    <div
      className={`
        ${isLast ? '' : 'mb-1'}
        ${className}
      `.trim()}
    >
      <MessageBubble message={message} />
    </div>
  );
}

// ============================================
// MessageListLoadingIndicator - Default loading state
// ============================================

export interface MessageListLoadingIndicatorProps {
  /** Text to display */
  text?: string;
  /** Optional className */
  className?: string;
}

export function MessageListLoadingIndicator({
  text = 'Denke nach...',
  className = '',
}: MessageListLoadingIndicatorProps) {
  const { isDark } = useTheme();

  return (
    <div
      className={`
        flex items-center gap-2 px-4 py-2
        ${isDark ? 'text-gray-400' : 'text-gray-500'}
        ${className}
      `.trim()}
    >
      {/* Animated dots */}
      <div className="flex gap-1">
        <div
          className={`
            w-2 h-2 rounded-full animate-bounce
            ${isDark ? 'bg-gray-500' : 'bg-gray-400'}
          `}
          style={{ animationDelay: '0ms' }}
        />
        <div
          className={`
            w-2 h-2 rounded-full animate-bounce
            ${isDark ? 'bg-gray-500' : 'bg-gray-400'}
          `}
          style={{ animationDelay: '150ms' }}
        />
        <div
          className={`
            w-2 h-2 rounded-full animate-bounce
            ${isDark ? 'bg-gray-500' : 'bg-gray-400'}
          `}
          style={{ animationDelay: '300ms' }}
        />
      </div>
      <span className="text-sm">{text}</span>
    </div>
  );
}

// ============================================
// MessageListEmptyState - Default empty state
// ============================================

export interface MessageListEmptyStateProps {
  /** Icon to display */
  icon?: ReactNode;
  /** Title text */
  title: string;
  /** Description text */
  description?: string;
  /** Optional className */
  className?: string;
}

export function MessageListEmptyState({
  icon,
  title,
  description,
  className = '',
}: MessageListEmptyStateProps) {
  const { isDark } = useTheme();

  return (
    <div
      className={`
        flex flex-col items-center justify-center text-center p-8
        ${className}
      `.trim()}
    >
      {icon && (
        <div
          className={`
            w-16 h-16 rounded-full flex items-center justify-center mb-4
            ${isDark ? 'bg-white/5 text-gray-400' : 'bg-gray-100 text-gray-500'}
          `.trim()}
        >
          {icon}
        </div>
      )}
      <h3
        className={`
          text-lg font-medium mb-2
          ${isDark ? 'text-white' : 'text-gray-900'}
        `.trim()}
      >
        {title}
      </h3>
      {description && (
        <p
          className={`
            text-sm max-w-md
            ${isDark ? 'text-gray-400' : 'text-gray-500'}
          `.trim()}
        >
          {description}
        </p>
      )}
    </div>
  );
}
