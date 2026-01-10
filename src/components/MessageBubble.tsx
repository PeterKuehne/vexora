/**
 * MessageBubble Component
 *
 * Displays a single chat message with appropriate styling
 * based on the sender role (user/assistant).
 */

import { User, Bot, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '../utils';
import type { Message } from '../types/message';
import { Markdown } from './Markdown';

export interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  const isError = message.status === 'error';
  const isStreaming = message.isStreaming;

  return (
    <div
      className={cn(
        'flex gap-3 p-4',
        isUser ? 'flex-row-reverse' : 'flex-row'
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
          isUser ? 'bg-primary' : 'bg-white/10'
        )}
      >
        {isUser ? (
          <User size={16} className="text-white" />
        ) : (
          <Bot size={16} className="text-gray-300" />
        )}
      </div>

      {/* Message Content */}
      <div
        className={cn(
          'max-w-[80%] rounded-xl px-4 py-3',
          isUser
            ? 'bg-primary text-white'
            : 'bg-surface text-gray-100',
          isError && 'border border-red-500/50'
        )}
      >
        {/* Message Text */}
        <div className="break-words">
          {message.content ? (
            isAssistant ? (
              // AI messages get markdown rendering
              <Markdown content={message.content} />
            ) : (
              // User messages stay plain text
              <div className="whitespace-pre-wrap">{message.content}</div>
            )
          ) : (
            isStreaming && !message.content && (
              <span className="text-gray-400 italic">Denke nach...</span>
            )
          )}
        </div>

        {/* Streaming Indicator */}
        {isStreaming && message.content && (
          <span className="inline-block ml-1 animate-pulse">
            <span className="inline-block w-2 h-4 bg-white/50 rounded-sm" />
          </span>
        )}

        {/* Error Message */}
        {isError && message.error && (
          <div className="mt-2 flex items-center gap-2 text-sm text-red-400">
            <AlertCircle size={14} />
            <span>{message.error}</span>
          </div>
        )}

        {/* Loading Indicator for empty streaming messages */}
        {isAssistant && isStreaming && !message.content && (
          <Loader2 size={16} className="animate-spin text-gray-400" />
        )}
      </div>
    </div>
  );
}
