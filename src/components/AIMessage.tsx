/**
 * AIMessage Component
 *
 * Displays an AI/assistant message bubble with:
 * - Left-aligned layout
 * - Gray background (theme-aware)
 * - Bot avatar
 * - Timestamp
 * - Markdown rendering with code highlighting
 * - Streaming indicator
 * - Error state handling
 */

import { Bot, Loader2, AlertCircle, Copy, Check } from 'lucide-react';
import { useState, useCallback } from 'react';
import { useTheme } from '../contexts';
import { formatDate, cn } from '../utils';
import { Markdown } from './Markdown';
import type { Message } from '../types';

// ============================================
// Types
// ============================================

export interface AIMessageProps {
  /** The message to display */
  message: Message;
  /** Show timestamp */
  showTimestamp?: boolean;
  /** Compact mode (smaller padding) */
  compact?: boolean;
  /** Show copy button on hover */
  showCopyButton?: boolean;
  /** Optional className */
  className?: string;
}

// ============================================
// AIMessage Component
// ============================================

export function AIMessage({
  message,
  showTimestamp = true,
  compact = false,
  showCopyButton = true,
  className = '',
}: AIMessageProps) {
  const { isDark } = useTheme();
  const [copied, setCopied] = useState(false);

  const isStreaming = message.isStreaming;
  const isError = message.status === 'error';
  const hasContent = Boolean(message.content);

  // Format timestamp
  const formattedTime = message.timestamp
    ? formatDate(new Date(message.timestamp))
    : '';

  // Copy message content to clipboard
  const handleCopy = useCallback(async () => {
    if (!message.content) return;

    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [message.content]);

  return (
    <div
      className={cn(
        'group flex flex-row gap-3',
        compact ? 'p-2' : 'p-4',
        className
      )}
    >
      {/* Bot Avatar */}
      <div
        className={cn(
          'flex-shrink-0 rounded-full flex items-center justify-center',
          isDark ? 'bg-white/10' : 'bg-gray-200',
          compact ? 'w-6 h-6' : 'w-8 h-8'
        )}
      >
        <Bot
          size={compact ? 12 : 16}
          className={isDark ? 'text-gray-300' : 'text-gray-600'}
        />
      </div>

      {/* Message Content */}
      <div className="flex flex-col items-start max-w-[80%]">
        {/* Message Bubble */}
        <div
          className={cn(
            'relative rounded-xl',
            compact ? 'px-3 py-2' : 'px-4 py-3',
            isDark
              ? 'bg-surface text-gray-100'
              : 'bg-gray-100 text-gray-900',
            isError && 'border border-red-500/50'
          )}
        >
          {/* Copy Button */}
          {showCopyButton && hasContent && !isStreaming && (
            <button
              onClick={handleCopy}
              className={cn(
                'absolute top-2 right-2 p-1.5 rounded-md transition-all',
                'opacity-0 group-hover:opacity-100',
                isDark
                  ? 'bg-white/10 hover:bg-white/20 text-gray-400'
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-500'
              )}
              title={copied ? 'Kopiert!' : 'Kopieren'}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
          )}

          {/* Message Content */}
          <div className={cn('break-words', showCopyButton && 'pr-8')}>
            {hasContent ? (
              <Markdown content={message.content} />
            ) : isStreaming ? (
              <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>
                Denke nach...
              </span>
            ) : null}
          </div>

          {/* Streaming Cursor */}
          {isStreaming && hasContent && (
            <span className="inline-block ml-1 animate-pulse">
              <span
                className={cn(
                  'inline-block w-2 h-4 rounded-sm',
                  isDark ? 'bg-gray-400/50' : 'bg-gray-500/50'
                )}
              />
            </span>
          )}

          {/* Error Message */}
          {isError && message.error && (
            <div className="mt-2 flex items-center gap-2 text-sm text-red-400">
              <AlertCircle size={14} />
              <span>{message.error}</span>
            </div>
          )}

          {/* Loading Spinner for empty streaming messages */}
          {isStreaming && !hasContent && (
            <Loader2 size={16} className="animate-spin text-gray-400" />
          )}
        </div>

        {/* Timestamp */}
        {showTimestamp && formattedTime && !isStreaming && (
          <span
            className={cn(
              'mt-1',
              compact ? 'text-[10px]' : 'text-xs',
              isDark ? 'text-gray-500' : 'text-gray-400'
            )}
          >
            {formattedTime}
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================
// AIMessageCompact - Smaller variant
// ============================================

export interface AIMessageCompactProps {
  /** The message content */
  content: string;
  /** Optional timestamp */
  timestamp?: Date | string;
  /** Is message streaming */
  isStreaming?: boolean;
  /** Optional className */
  className?: string;
}

export function AIMessageCompact({
  content,
  timestamp,
  isStreaming = false,
  className = '',
}: AIMessageCompactProps) {
  const { isDark } = useTheme();

  const formattedTime = timestamp
    ? formatDate(typeof timestamp === 'string' ? new Date(timestamp) : timestamp)
    : '';

  return (
    <div className={cn('flex flex-row gap-2 p-2', className)}>
      {/* Small Avatar */}
      <div
        className={cn(
          'flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center',
          isDark ? 'bg-white/10' : 'bg-gray-200'
        )}
      >
        <Bot size={12} className={isDark ? 'text-gray-300' : 'text-gray-600'} />
      </div>

      {/* Content */}
      <div className="flex flex-col items-start max-w-[75%]">
        <div
          className={cn(
            'rounded-lg px-3 py-1.5 text-sm',
            isDark ? 'bg-surface text-gray-100' : 'bg-gray-100 text-gray-900'
          )}
        >
          {content ? (
            <Markdown content={content} />
          ) : isStreaming ? (
            <Loader2 size={14} className="animate-spin text-gray-400" />
          ) : null}

          {isStreaming && content && (
            <span className="inline-block ml-1 animate-pulse">
              <span className="inline-block w-1.5 h-3 bg-gray-400/50 rounded-sm" />
            </span>
          )}
        </div>

        {formattedTime && !isStreaming && (
          <span
            className={cn(
              'mt-0.5 text-[10px]',
              isDark ? 'text-gray-500' : 'text-gray-400'
            )}
          >
            {formattedTime}
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================
// AIMessageBubble - Just the bubble (no avatar)
// ============================================

export interface AIMessageBubbleProps {
  /** The message content */
  content: string;
  /** Show timestamp */
  showTimestamp?: boolean;
  /** Timestamp value */
  timestamp?: Date | string;
  /** Is message streaming */
  isStreaming?: boolean;
  /** Compact mode */
  compact?: boolean;
  /** Optional className */
  className?: string;
}

export function AIMessageBubble({
  content,
  showTimestamp = false,
  timestamp,
  isStreaming = false,
  compact = false,
  className = '',
}: AIMessageBubbleProps) {
  const { isDark } = useTheme();

  const formattedTime = timestamp
    ? formatDate(typeof timestamp === 'string' ? new Date(timestamp) : timestamp)
    : '';

  return (
    <div className={cn('flex flex-col items-start', className)}>
      <div
        className={cn(
          'rounded-xl',
          compact ? 'px-3 py-2 text-sm' : 'px-4 py-3',
          isDark ? 'bg-surface text-gray-100' : 'bg-gray-100 text-gray-900'
        )}
      >
        {content ? (
          <Markdown content={content} />
        ) : isStreaming ? (
          <Loader2 size={compact ? 14 : 16} className="animate-spin text-gray-400" />
        ) : null}

        {isStreaming && content && (
          <span className="inline-block ml-1 animate-pulse">
            <span
              className={cn(
                'inline-block rounded-sm',
                compact ? 'w-1.5 h-3' : 'w-2 h-4',
                isDark ? 'bg-gray-400/50' : 'bg-gray-500/50'
              )}
            />
          </span>
        )}
      </div>

      {showTimestamp && formattedTime && !isStreaming && (
        <span
          className={cn(
            'mt-1',
            compact ? 'text-[10px]' : 'text-xs',
            isDark ? 'text-gray-500' : 'text-gray-400'
          )}
        >
          {formattedTime}
        </span>
      )}
    </div>
  );
}

// ============================================
// AIMessageStreaming - For active streaming
// ============================================

export interface AIMessageStreamingProps {
  /** Current streamed content */
  content: string;
  /** Stream progress info */
  progress?: {
    tokenCount: number;
    tokensPerSecond: number;
    elapsedMs: number;
  };
  /** Show progress stats */
  showProgress?: boolean;
  /** Optional className */
  className?: string;
}

export function AIMessageStreaming({
  content,
  progress,
  showProgress = true,
  className = '',
}: AIMessageStreamingProps) {
  const { isDark } = useTheme();

  return (
    <div className={cn('flex flex-row gap-3 p-4', className)}>
      {/* Bot Avatar */}
      <div
        className={cn(
          'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
          isDark ? 'bg-white/10' : 'bg-gray-200'
        )}
      >
        <Bot size={16} className={isDark ? 'text-gray-300' : 'text-gray-600'} />
      </div>

      {/* Content */}
      <div className="flex flex-col items-start max-w-[80%]">
        <div
          className={cn(
            'rounded-xl px-4 py-3',
            isDark ? 'bg-surface text-gray-100' : 'bg-gray-100 text-gray-900'
          )}
        >
          {content ? (
            <>
              <Markdown content={content} />
              <span className="inline-block ml-1 animate-pulse">
                <span
                  className={cn(
                    'inline-block w-2 h-4 rounded-sm',
                    isDark ? 'bg-gray-400/50' : 'bg-gray-500/50'
                  )}
                />
              </span>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Loader2 size={16} className="animate-spin text-gray-400" />
              <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>
                Denke nach...
              </span>
            </div>
          )}
        </div>

        {/* Progress Stats */}
        {showProgress && progress && (
          <div
            className={cn(
              'mt-1 flex items-center gap-3 text-xs',
              isDark ? 'text-gray-500' : 'text-gray-400'
            )}
          >
            <span>{progress.tokenCount} tokens</span>
            <span>{progress.tokensPerSecond.toFixed(1)} t/s</span>
            <span>{(progress.elapsedMs / 1000).toFixed(1)}s</span>
          </div>
        )}
      </div>
    </div>
  );
}
