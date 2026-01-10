/**
 * ChatContainer Component
 *
 * Main chat interface that uses:
 * - ChatContext for message state and actions
 * - ChatArea layout component for structure
 *
 * Composes the layout with message list, streaming stats, and input.
 */

import { useRef } from 'react';
import { MessageBubble } from './MessageBubble';
import { ChatInput } from './ChatInput';
import { useChat } from '../contexts';
import {
  ChatArea,
  ChatAreaMessages,
  ChatAreaEmptyState,
  ChatAreaInputWrapper,
  ChatAreaStatusBar,
  type ChatAreaRef,
} from './layout';
import { Bot, Zap, Timer } from 'lucide-react';

export interface ChatContainerProps {
  /** Optional className for container */
  className?: string | undefined;
}

export function ChatContainer({ className }: ChatContainerProps) {
  const chatAreaRef = useRef<ChatAreaRef>(null);

  const {
    messages,
    isStreaming,
    streamProgress,
    lastMetadata,
    error,
    sendMessage,
    stopStream,
  } = useChat();

  // Format milliseconds to readable time
  const formatTime = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  // Build status bar content
  const renderStatusBar = () => {
    // Streaming stats
    if (isStreaming && streamProgress) {
      return (
        <ChatAreaStatusBar>
          <div className="flex items-center gap-1.5">
            <Zap size={12} className="text-yellow-500" />
            <span>{streamProgress.tokensPerSecond} tokens/s</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Timer size={12} className="text-blue-400" />
            <span>{formatTime(streamProgress.elapsedMs)}</span>
          </div>
          <div className="text-gray-500">
            {streamProgress.tokenCount} tokens
          </div>
        </ChatAreaStatusBar>
      );
    }

    // Last response stats
    if (!isStreaming && lastMetadata && lastMetadata.tokensPerSecond) {
      return (
        <ChatAreaStatusBar>
          <div className="flex items-center gap-1.5">
            <Zap size={12} className="text-gray-500" />
            <span>{lastMetadata.tokensPerSecond} tokens/s</span>
          </div>
          {lastMetadata.streamDuration && (
            <div className="flex items-center gap-1.5">
              <Timer size={12} className="text-gray-500" />
              <span>{formatTime(lastMetadata.streamDuration)}</span>
            </div>
          )}
          {lastMetadata.completionTokens && (
            <span>{lastMetadata.completionTokens} tokens generiert</span>
          )}
        </ChatAreaStatusBar>
      );
    }

    // Error display
    if (error) {
      return (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          <strong>Fehler:</strong> {error.message}
        </div>
      );
    }

    return null;
  };

  return (
    <ChatArea
      ref={chatAreaRef}
      className={className}
      isEmpty={messages.length === 0}
      autoScroll={true}
      scrollDependency={messages}
      emptyState={
        <ChatAreaEmptyState
          icon={<Bot size={32} />}
          title="Willkommen bei Qwen Chat"
          description="Starte eine Unterhaltung mit dem KI-Assistenten. Deine Nachrichten werden lokal verarbeitet."
        />
      }
      statusBar={renderStatusBar()}
      inputArea={
        <ChatAreaInputWrapper hint="Enter zum Senden, Shift+Enter für neue Zeile">
          <ChatInput
            onSend={sendMessage}
            onStop={stopStream}
            isStreaming={isStreaming}
            placeholder="Schreibe eine Nachricht..."
          />
        </ChatAreaInputWrapper>
      }
    >
      {/* Message List */}
      <ChatAreaMessages>
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
      </ChatAreaMessages>
    </ChatArea>
  );
}
