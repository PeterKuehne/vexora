/**
 * Conversation Types
 * Defines the structure for chat conversations
 */

import type { Message } from './message';

/**
 * Core conversation interface
 */
export interface Conversation {
  /** Unique identifier for the conversation */
  id: string;
  /** Display title (auto-generated or user-defined) */
  title: string;
  /** Array of messages in chronological order */
  messages: Message[];
  /** When the conversation was created */
  createdAt: Date;
  /** When the conversation was last updated */
  updatedAt: Date;
  /** Model used for this conversation */
  model?: string;
  /** Whether the conversation is pinned/favorited */
  isPinned?: boolean;
  /** Whether the conversation is archived */
  isArchived?: boolean;
}

/**
 * Input for creating a new conversation
 */
export interface CreateConversationInput {
  title?: string;
  model?: string;
}

/**
 * Conversation summary for list views
 */
export interface ConversationSummary {
  id: string;
  title: string;
  /** Preview of the last message */
  lastMessagePreview: string;
  /** Number of messages */
  messageCount: number;
  createdAt: Date;
  updatedAt: Date;
  isPinned?: boolean;
  isArchived?: boolean;
}

/**
 * Conversation with active state tracking
 */
export interface ConversationState extends Conversation {
  /** Whether a message is currently being generated */
  isGenerating: boolean;
  /** Whether the conversation is currently selected/active */
  isActive: boolean;
}

/**
 * Options for filtering conversations
 */
export interface ConversationFilterOptions {
  /** Filter by pinned status */
  isPinned?: boolean;
  /** Filter by archived status */
  isArchived?: boolean;
  /** Search by title or message content */
  searchQuery?: string;
  /** Sort field */
  sortBy?: 'createdAt' | 'updatedAt' | 'title';
  /** Sort direction */
  sortOrder?: 'asc' | 'desc';
}
