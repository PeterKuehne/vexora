/**
 * Message Types
 * Defines the structure for chat messages
 */

/**
 * Role of a message in a conversation
 */
export type MessageRole = 'user' | 'assistant' | 'system';

/**
 * Message status for tracking delivery/streaming state
 */
export type MessageStatus = 'pending' | 'streaming' | 'complete' | 'error';

/**
 * Core message interface
 */
export interface Message {
  /** Unique identifier for the message */
  id: string;
  /** Role of the message sender */
  role: MessageRole;
  /** Message content (text/markdown) */
  content: string;
  /** When the message was created */
  timestamp: Date;
  /** Whether the message is currently streaming */
  isStreaming?: boolean;
  /** Current status of the message */
  status?: MessageStatus;
  /** Model used to generate the response (for assistant messages) */
  model?: string;
  /** Token count for the message */
  tokenCount?: number;
  /** Error message if status is 'error' */
  error?: string;
}

/**
 * Input for creating a new message
 */
export interface CreateMessageInput {
  role: MessageRole;
  content: string;
  model?: string;
}

/**
 * Message with computed/derived properties
 */
export interface MessageWithMeta extends Message {
  /** Formatted timestamp string */
  formattedTime: string;
  /** Whether this is the last message in the conversation */
  isLast: boolean;
  /** Index in the conversation */
  index: number;
}
