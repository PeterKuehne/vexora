/**
 * UserMessage Component
 *
 * Displays a user message bubble with:
 * - Right-aligned layout
 * - Blue/primary background
 * - User avatar
 * - Timestamp
 * - Plain text content (no markdown)
 */

import { User } from 'lucide-react';
import { useTheme } from '../contexts';
import { formatDate } from '../utils';
import type { Message } from '../types';

// ============================================
// Types
// ============================================

export interface UserMessageProps {
  /** The message to display */
  message: Message;
  /** Show timestamp */
  showTimestamp?: boolean;
  /** Compact mode (smaller padding) */
  compact?: boolean;
  /** Optional className */
  className?: string;
}

// ============================================
// UserMessage Component
// ============================================

export function UserMessage({
  message,
  showTimestamp = true,
  compact = false,
  className = '',
}: UserMessageProps) {
  const { isDark } = useTheme();

  // Format timestamp
  const formattedTime = message.timestamp
    ? formatDate(new Date(message.timestamp))
    : '';

  return (
    <div
      className={`
        flex flex-row-reverse gap-3
        ${compact ? 'p-2' : 'p-4'}
        ${className}
      `.trim()}
    >
      {/* User Avatar */}
      <div
        className={`
          flex-shrink-0 rounded-full flex items-center justify-center
          bg-primary
          ${compact ? 'w-6 h-6' : 'w-8 h-8'}
        `.trim()}
      >
        <User size={compact ? 12 : 16} className="text-white" />
      </div>

      {/* Message Content */}
      <div className="flex flex-col items-end max-w-[80%]">
        {/* Message Bubble */}
        <div
          className={`
            rounded-xl bg-primary text-white
            ${compact ? 'px-3 py-2 text-sm' : 'px-4 py-3'}
          `.trim()}
        >
          <div className="whitespace-pre-wrap break-words">
            {message.content}
          </div>
        </div>

        {/* Timestamp */}
        {showTimestamp && formattedTime && (
          <span
            className={`
              mt-1 text-xs
              ${isDark ? 'text-gray-500' : 'text-gray-400'}
            `.trim()}
          >
            {formattedTime}
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================
// UserMessageCompact - Smaller variant
// ============================================

export interface UserMessageCompactProps {
  /** The message content */
  content: string;
  /** Optional timestamp */
  timestamp?: Date | string;
  /** Optional className */
  className?: string;
}

export function UserMessageCompact({
  content,
  timestamp,
  className = '',
}: UserMessageCompactProps) {
  const { isDark } = useTheme();

  const formattedTime = timestamp
    ? formatDate(typeof timestamp === 'string' ? new Date(timestamp) : timestamp)
    : '';

  return (
    <div className={`flex flex-row-reverse gap-2 p-2 ${className}`}>
      {/* Small Avatar */}
      <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center bg-primary">
        <User size={12} className="text-white" />
      </div>

      {/* Content */}
      <div className="flex flex-col items-end max-w-[75%]">
        <div className="rounded-lg bg-primary text-white px-3 py-1.5 text-sm">
          <span className="whitespace-pre-wrap break-words">{content}</span>
        </div>
        {formattedTime && (
          <span className={`mt-0.5 text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            {formattedTime}
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================
// UserMessageBubble - Just the bubble (no avatar)
// ============================================

export interface UserMessageBubbleProps {
  /** The message content */
  content: string;
  /** Show timestamp */
  showTimestamp?: boolean;
  /** Timestamp value */
  timestamp?: Date | string;
  /** Compact mode */
  compact?: boolean;
  /** Optional className */
  className?: string;
}

export function UserMessageBubble({
  content,
  showTimestamp = false,
  timestamp,
  compact = false,
  className = '',
}: UserMessageBubbleProps) {
  const { isDark } = useTheme();

  const formattedTime = timestamp
    ? formatDate(typeof timestamp === 'string' ? new Date(timestamp) : timestamp)
    : '';

  return (
    <div className={`flex flex-col items-end ${className}`}>
      <div
        className={`
          rounded-xl bg-primary text-white
          ${compact ? 'px-3 py-2 text-sm' : 'px-4 py-3'}
        `.trim()}
      >
        <span className="whitespace-pre-wrap break-words">{content}</span>
      </div>
      {showTimestamp && formattedTime && (
        <span
          className={`
            mt-1
            ${compact ? 'text-[10px]' : 'text-xs'}
            ${isDark ? 'text-gray-500' : 'text-gray-400'}
          `.trim()}
        >
          {formattedTime}
        </span>
      )}
    </div>
  );
}
