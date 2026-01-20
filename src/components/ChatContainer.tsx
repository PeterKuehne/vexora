/**
 * ChatContainer Component
 *
 * Main chat interface that uses:
 * - ChatContext for message state and actions
 * - ChatArea layout component for structure
 *
 * Composes the layout with message list, streaming stats, and input.
 */

import { useRef, useState, useEffect, useCallback } from 'react';
import { AIMessage } from './AIMessage';
import { UserMessage } from './UserMessage';
import { ChatInput } from './ChatInput';
import { RAGToggle } from './RAGToggle';
import { WelcomeScreen } from './WelcomeScreen';
import { useChat, useRAG, useDocuments } from '../contexts';
import { ChevronDown } from 'lucide-react';
import { useTheme } from '../contexts';
import {
  ChatArea,
  ChatAreaMessages,
  ChatAreaInputWrapper,
  ChatAreaStatusBar,
  type ChatAreaRef,
} from './layout';
import { Zap, Timer } from 'lucide-react';

export interface ChatContainerProps {
  /** Optional className for container */
  className?: string | undefined;
}

export function ChatContainer({ className }: ChatContainerProps) {
  const chatAreaRef = useRef<ChatAreaRef>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const { isDark } = useTheme();

  const {
    messages,
    isStreaming,
    streamProgress,
    lastMetadata,
    error,
    sendMessage,
    stopStream,
    regenerateLastResponse,
    canRegenerate,
  } = useChat();

  // RAG state management
  const { isRAGEnabled, setRAGEnabled, setRAGAvailable } = useRAG();
  const { documents } = useDocuments();

  // Handle scroll to check if button should be visible
  const handleScroll = useCallback(() => {
    if (!chatAreaRef.current) return;

    const isAtBottom = chatAreaRef.current.isAtBottom();
    const hasMessages = messages.length > 0;

    setShowScrollButton(hasMessages && !isAtBottom);
  }, [messages.length]);

  // Update RAG availability based on documents
  useEffect(() => {
    const hasDocuments = documents && documents.length > 0;
    setRAGAvailable(hasDocuments);
  }, [documents, setRAGAvailable]);

  // Listen to scroll events on the messages container
  useEffect(() => {
    const container = chatAreaRef.current?.getMessagesContainer();
    if (!container) return;

    // Throttle scroll events for performance
    let ticking = false;
    const throttledHandleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          handleScroll();
          ticking = false;
        });
        ticking = true;
      }
    };

    container.addEventListener('scroll', throttledHandleScroll, { passive: true });

    // Initial check - use setTimeout to avoid setState in effect warning
    const timeoutId = setTimeout(() => handleScroll(), 0);

    return () => {
      container.removeEventListener('scroll', throttledHandleScroll);
      clearTimeout(timeoutId);
    };
  }, [handleScroll]);

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
    <div className={`h-full relative ${className || ''}`}>
      <ChatArea
        ref={chatAreaRef}
        isEmpty={messages.length === 0}
        autoScroll={true}
        scrollDependency={messages}
        emptyState={
          <WelcomeScreen onExamplePromptClick={sendMessage} />
        }
        statusBar={renderStatusBar()}
        inputArea={
          <ChatAreaInputWrapper hint="Enter zum Senden, Shift+Enter für neue Zeile">
            {/* RAG Toggle */}
            <div className="mb-3">
              <RAGToggle
                enabled={isRAGEnabled}
                onChange={setRAGEnabled}
                disabled={false}
              />
            </div>
            {/* Chat Input */}
            <ChatInput
              onSend={sendMessage}
              onStop={stopStream}
              isStreaming={isStreaming}
              placeholder={
                isRAGEnabled
                  ? "Stelle eine Frage zu deinen Dokumenten..."
                  : "Schreibe eine Nachricht..."
              }
            />
          </ChatAreaInputWrapper>
        }
      >
        {/* Message List */}
        <ChatAreaMessages>
          {messages.map((message) => {
            const isLastAiMessage = message.role === 'assistant' &&
              message.id === messages.filter(m => m.role === 'assistant').pop()?.id;

            return message.role === 'assistant' ? (
              <AIMessage
                key={message.id}
                message={message}
                showRegenerateButton={isLastAiMessage && canRegenerate}
                onRegenerate={regenerateLastResponse}
                isRegenerating={isStreaming}
              />
            ) : (
              <UserMessage
                key={message.id}
                message={message}
              />
            );
          })}
        </ChatAreaMessages>
      </ChatArea>

      {/* Floating Scroll to Bottom Button */}
      {showScrollButton && (
        <button
          onClick={() => {
            chatAreaRef.current?.scrollToBottom('smooth');
          }}
          className={`
            absolute bottom-24 left-1/2 -translate-x-1/2 z-50
            w-12 h-12 rounded-full shadow-lg
            flex items-center justify-center
            transition-all duration-200 ease-out
            hover:scale-110 hover:shadow-xl
            ${isDark
              ? 'bg-white/10 hover:bg-white/20 text-white border border-white/20 backdrop-blur-sm'
              : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-200'
            }
          `.trim()}
          aria-label="Zum Ende scrollen"
          title="Zum Ende scrollen"
        >
          <ChevronDown size={20} />
        </button>
      )}
    </div>
  );
}
