/**
 * ChatArea - Main Chat Area Layout Component
 *
 * Provides the central chat layout structure with:
 * - Message list with scroll container
 * - Status bar for streaming stats
 * - Input area at the bottom
 *
 * Uses CSS Flexbox for proper layout with overflow handling.
 */

import { type ReactNode, useRef, useEffect, forwardRef, useImperativeHandle, useState, useCallback } from 'react';
import { useTheme } from '../../contexts';
import { ChevronDown } from 'lucide-react';

export interface ChatAreaProps {
  /** Message list content */
  children: ReactNode;
  /** Content shown below messages (streaming stats, etc.) */
  statusBar?: ReactNode | undefined;
  /** Input area at the bottom */
  inputArea?: ReactNode | undefined;
  /** Empty state when no messages */
  emptyState?: ReactNode | undefined;
  /** Whether the chat is empty (show emptyState) */
  isEmpty?: boolean | undefined;
  /** Enable auto-scroll to bottom when content changes */
  autoScroll?: boolean | undefined;
  /** Dependency for auto-scroll trigger */
  scrollDependency?: unknown | undefined;
  /** Custom className for container */
  className?: string | undefined;
  /** Conversation ID for scroll position persistence */
  conversationId?: string | undefined;
  /** Callback to save scroll position */
  onSaveScrollPosition?: (conversationId: string, scrollTop: number, scrollHeight: number) => void | undefined;
  /** Callback to restore scroll position when conversation changes */
  onRestoreScrollPosition?: (conversationId: string) => { scrollTop: number; scrollHeight: number } | null | undefined;
}

export interface ChatAreaRef {
  /** Scroll to the bottom of the message list */
  scrollToBottom: (behavior?: ScrollBehavior) => void;
  /** Get the messages container element */
  getMessagesContainer: () => HTMLDivElement | null;
  /** Check if user is at the bottom of the chat */
  isAtBottom: () => boolean;
}

/**
 * ChatArea component with imperative handle for scroll control
 */
export const ChatArea = forwardRef<ChatAreaRef, ChatAreaProps>(function ChatArea(
  {
    children,
    statusBar,
    inputArea,
    emptyState,
    isEmpty = false,
    autoScroll = true,
    scrollDependency,
    className = '',
    conversationId,
    onSaveScrollPosition,
    onRestoreScrollPosition,
  },
  ref
) {
  const { isDark } = useTheme();
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const scrollAnchorRef = useRef<HTMLDivElement>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [isUserScrolling, setIsUserScrolling] = useState(false);

  // Check if user is at the bottom
  const isAtBottom = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return true;

    const threshold = 100; // px from bottom
    return container.scrollHeight - container.scrollTop <= container.clientHeight + threshold;
  }, []);

  // Handle scroll events to show/hide scroll-to-bottom button
  const handleScroll = useCallback(() => {
    if (!isUserScrolling) {
      setIsUserScrolling(true);
    }

    const atBottom = isAtBottom();
    setShowScrollToBottom(!atBottom && !isEmpty);

    // Save scroll position for current conversation
    const container = messagesContainerRef.current;
    if (container && conversationId && onSaveScrollPosition) {
      onSaveScrollPosition(conversationId, container.scrollTop, container.scrollHeight);
    }
  }, [isAtBottom, isEmpty, conversationId, onSaveScrollPosition, isUserScrolling]);

  // Expose imperative methods via ref
  useImperativeHandle(ref, () => ({
    scrollToBottom: (behavior: ScrollBehavior = 'smooth') => {
      setIsUserScrolling(false);
      scrollAnchorRef.current?.scrollIntoView({ behavior });
    },
    getMessagesContainer: () => messagesContainerRef.current,
    isAtBottom,
  }));

  // Auto-scroll when dependency changes (only if not user scrolling)
  useEffect(() => {
    if (autoScroll && scrollDependency !== undefined && !isUserScrolling) {
      scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [autoScroll, scrollDependency, isUserScrolling]);

  // Monitor scroll position
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    // Throttle scroll events
    let ticking = false;
    const throttledHandleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          handleScroll();
          ticking = false;
        });
        ticking = true;
      }
    };

    container.addEventListener('scroll', throttledHandleScroll);
    return () => container.removeEventListener('scroll', throttledHandleScroll);
  }, [handleScroll]);

  // Restore scroll position when conversation changes
  useEffect(() => {
    if (conversationId && onRestoreScrollPosition) {
      const savedPosition = onRestoreScrollPosition(conversationId);
      const container = messagesContainerRef.current;

      if (savedPosition && container) {
        // Use requestAnimationFrame to ensure DOM is updated
        requestAnimationFrame(() => {
          // Check if content height is similar to when position was saved
          if (Math.abs(container.scrollHeight - savedPosition.scrollHeight) < 100) {
            container.scrollTop = savedPosition.scrollTop;
            setIsUserScrolling(true); // Mark as user scrolled to prevent auto-scroll
          } else {
            // Content height changed significantly, scroll to bottom instead
            setIsUserScrolling(false);
            scrollAnchorRef.current?.scrollIntoView({ behavior: 'instant' });
          }
        });
      }
    }
  }, [conversationId, onRestoreScrollPosition]);

  return (
    <div
      className={`
        flex flex-col h-full
        ${isDark ? 'bg-background' : 'bg-white'}
        ${className}
      `.trim()}
    >
      {/* Messages Area - Flex grow with scroll */}
      <div className="relative flex-1">
        <div
          ref={messagesContainerRef}
          className={`
            h-full overflow-y-auto scrollbar-thin
            ${isDark ? 'scrollbar-thumb-white/20' : 'scrollbar-thumb-gray-300'}
          `.trim()}
        >
        {isEmpty && emptyState ? (
          // Empty State - Centered in available space
          <div className="flex items-center justify-center h-full">
            {emptyState}
          </div>
        ) : (
          // Message List with bottom anchor for scroll
          <div className="flex flex-col min-h-full">
            <div className="flex-1">
              {children}
            </div>
            {/* Scroll anchor - always at bottom */}
            <div ref={scrollAnchorRef} aria-hidden="true" />
          </div>
        )}
        </div>

        {/* Scroll to Bottom Button */}
        {showScrollToBottom && (
          <button
            onClick={() => {
              setIsUserScrolling(false);
              scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth' });
            }}
            className={`
              absolute bottom-4 right-4 z-10
              w-10 h-10 rounded-full shadow-lg
              flex items-center justify-center
              transition-all duration-200 ease-out
              hover:scale-110 hover:shadow-xl
              animate-fadeIn
              ${isDark
                ? 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
                : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-200'
              }
            `.trim()}
            aria-label="Zum Ende scrollen"
          >
            <ChevronDown size={16} />
          </button>
        )}
      </div>

      {/* Status Bar - Fixed height, no shrink */}
      {statusBar && (
        <div
          className={`
            shrink-0 px-4 py-2
            border-t
            ${isDark ? 'border-white/5' : 'border-gray-100'}
          `.trim()}
        >
          {statusBar}
        </div>
      )}

      {/* Input Area - Fixed at bottom */}
      {inputArea && (
        <div
          className={`
            shrink-0
            border-t
            ${isDark ? 'border-white/10' : 'border-gray-200'}
          `.trim()}
        >
          {inputArea}
        </div>
      )}
    </div>
  );
});

/**
 * ChatAreaMessages - Wrapper for message list with proper spacing
 */
export interface ChatAreaMessagesProps {
  children: ReactNode;
  className?: string;
}

export function ChatAreaMessages({ children, className = '' }: ChatAreaMessagesProps) {
  return (
    <div className={`py-4 ${className}`}>
      {children}
    </div>
  );
}

/**
 * ChatAreaEmptyState - Default empty state component
 */
export interface ChatAreaEmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function ChatAreaEmptyState({
  icon,
  title,
  description,
  action,
  className = '',
}: ChatAreaEmptyStateProps) {
  const { isDark } = useTheme();

  return (
    <div className={`flex flex-col items-center justify-center text-center p-8 ${className}`}>
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
      <h2
        className={`
          text-xl font-medium mb-2
          ${isDark ? 'text-white' : 'text-gray-900'}
        `.trim()}
      >
        {title}
      </h2>
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
      {action && (
        <div className="mt-4">
          {action}
        </div>
      )}
    </div>
  );
}

/**
 * ChatAreaInputWrapper - Consistent styling for input area
 */
export interface ChatAreaInputWrapperProps {
  children: ReactNode;
  hint?: string;
  className?: string;
}

export function ChatAreaInputWrapper({ children, hint, className = '' }: ChatAreaInputWrapperProps) {
  const { isDark } = useTheme();

  return (
    <div className={`p-4 ${className}`}>
      {children}
      {hint && (
        <p
          className={`
            text-xs mt-2 text-center
            ${isDark ? 'text-gray-500' : 'text-gray-400'}
          `.trim()}
        >
          {hint}
        </p>
      )}
    </div>
  );
}

/**
 * ChatAreaStatusBar - Streaming stats display
 */
export interface ChatAreaStatusBarProps {
  children: ReactNode;
  className?: string;
}

export function ChatAreaStatusBar({ children, className = '' }: ChatAreaStatusBarProps) {
  const { isDark } = useTheme();

  return (
    <div
      className={`
        flex items-center gap-4 text-xs
        ${isDark ? 'text-gray-400' : 'text-gray-500'}
        ${className}
      `.trim()}
    >
      {children}
    </div>
  );
}
