/**
 * ConversationStorage - LocalStorage Operations for Conversations
 *
 * Provides type-safe CRUD operations for conversations using the StorageService.
 * This module wraps the generic StorageService with conversation-specific logic.
 *
 * Features:
 * - getAllConversations() - Get all stored conversations
 * - getConversation(id) - Get a single conversation by ID
 * - saveConversation(conversation) - Create or update a conversation
 * - deleteConversation(id) - Remove a conversation
 * - updateConversation(id, updates) - Partially update a conversation
 */

import { storage, STORAGE_KEYS } from './storage';
import type { Conversation } from '../types/conversation';
import type { Message } from '../types/message';

// ============================================
// Types
// ============================================

/**
 * Serialized conversation format for storage
 * Dates are stored as ISO strings
 */
interface SerializedConversation {
  id: string;
  title: string;
  messages: SerializedMessage[];
  createdAt: string;
  updatedAt: string;
  model?: string;
  isPinned?: boolean;
  isArchived?: boolean;
}

/**
 * Serialized message format for storage
 * Uses `| undefined` for exactOptionalPropertyTypes compatibility
 */
interface SerializedMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  status?: string | undefined;
  isStreaming?: boolean | undefined;
  model?: string | undefined;
  tokenCount?: number | undefined;
  error?: string | undefined;
}

/**
 * Partial update for a conversation
 */
export type ConversationUpdate = Partial<
  Pick<Conversation, 'title' | 'messages' | 'model' | 'isPinned' | 'isArchived'>
>;

// ============================================
// Serialization Helpers
// ============================================

/**
 * Serialize a conversation for storage (Date -> string)
 */
function serializeConversation(conv: Conversation): SerializedConversation {
  return {
    ...conv,
    createdAt: conv.createdAt.toISOString(),
    updatedAt: conv.updatedAt.toISOString(),
    messages: conv.messages.map((msg) => ({
      ...msg,
      timestamp: msg.timestamp.toISOString(),
    })),
  };
}

/**
 * Deserialize a conversation from storage (string -> Date)
 */
function deserializeConversation(data: SerializedConversation): Conversation {
  return {
    ...data,
    createdAt: new Date(data.createdAt),
    updatedAt: new Date(data.updatedAt),
    messages: data.messages.map((msg) => ({
      ...msg,
      timestamp: new Date(msg.timestamp),
    })) as Message[],
  };
}

// ============================================
// ConversationStorage Class
// ============================================

class ConversationStorage {
  /**
   * Get all stored conversations
   * @returns Array of conversations sorted by updatedAt (newest first)
   */
  getAllConversations(): Conversation[] {
    const data = storage.get<SerializedConversation[]>(STORAGE_KEYS.CONVERSATIONS);

    if (!data || !Array.isArray(data)) {
      return [];
    }

    try {
      return data
        .map((item) => deserializeConversation(item))
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    } catch (error) {
      console.error('ConversationStorage: Failed to deserialize conversations:', error);
      return [];
    }
  }

  /**
   * Get a single conversation by ID
   * @param id - The conversation ID
   * @returns The conversation or null if not found
   */
  getConversation(id: string): Conversation | null {
    const conversations = this.getAllConversations();
    return conversations.find((conv) => conv.id === id) ?? null;
  }

  /**
   * Save a conversation (create or update)
   * If a conversation with the same ID exists, it will be updated.
   * @param conversation - The conversation to save
   * @returns true if saved successfully
   */
  saveConversation(conversation: Conversation): boolean {
    try {
      const conversations = this.getAllConversations();
      const existingIndex = conversations.findIndex((c) => c.id === conversation.id);

      // Update updatedAt timestamp
      const updatedConversation: Conversation = {
        ...conversation,
        updatedAt: new Date(),
      };

      if (existingIndex >= 0) {
        // Update existing
        conversations[existingIndex] = updatedConversation;
      } else {
        // Add new
        conversations.unshift(updatedConversation);
      }

      // Serialize and save
      const serialized = conversations.map((c) => serializeConversation(c));
      return storage.set(STORAGE_KEYS.CONVERSATIONS, serialized);
    } catch (error) {
      console.error('ConversationStorage: Failed to save conversation:', error);
      return false;
    }
  }

  /**
   * Delete a conversation by ID
   * @param id - The conversation ID to delete
   * @returns true if deleted successfully
   */
  deleteConversation(id: string): boolean {
    try {
      const conversations = this.getAllConversations();
      const filtered = conversations.filter((c) => c.id !== id);

      // Check if anything was removed
      if (filtered.length === conversations.length) {
        // No conversation with this ID found
        return false;
      }

      // Serialize and save
      const serialized = filtered.map((c) => serializeConversation(c));
      return storage.set(STORAGE_KEYS.CONVERSATIONS, serialized);
    } catch (error) {
      console.error('ConversationStorage: Failed to delete conversation:', error);
      return false;
    }
  }

  /**
   * Update a conversation partially
   * @param id - The conversation ID to update
   * @param updates - Partial updates to apply
   * @returns The updated conversation or null if not found
   */
  updateConversation(id: string, updates: ConversationUpdate): Conversation | null {
    try {
      const conversation = this.getConversation(id);

      if (!conversation) {
        return null;
      }

      // Merge updates
      const updatedConversation: Conversation = {
        ...conversation,
        ...updates,
        updatedAt: new Date(),
      };

      // Save the updated conversation
      const saved = this.saveConversation(updatedConversation);

      if (saved) {
        return updatedConversation;
      }

      return null;
    } catch (error) {
      console.error('ConversationStorage: Failed to update conversation:', error);
      return null;
    }
  }

  /**
   * Check if a conversation exists
   * @param id - The conversation ID
   * @returns true if the conversation exists
   */
  hasConversation(id: string): boolean {
    return this.getConversation(id) !== null;
  }

  /**
   * Get the count of all conversations
   * @returns The total number of conversations
   */
  getCount(): number {
    const data = storage.get<SerializedConversation[]>(STORAGE_KEYS.CONVERSATIONS);
    return Array.isArray(data) ? data.length : 0;
  }

  /**
   * Clear all conversations
   * @returns true if cleared successfully
   */
  clearAll(): boolean {
    return storage.remove(STORAGE_KEYS.CONVERSATIONS);
  }

  // ============================================
  // Active Conversation ID Management
  // ============================================

  /**
   * Get the active conversation ID
   * @returns The active conversation ID or null
   */
  getActiveConversationId(): string | null {
    return storage.get<string>(STORAGE_KEYS.ACTIVE_CONVERSATION_ID);
  }

  /**
   * Set the active conversation ID
   * @param id - The conversation ID to set as active (or null to clear)
   * @returns true if saved successfully
   */
  setActiveConversationId(id: string | null): boolean {
    if (id === null) {
      return storage.remove(STORAGE_KEYS.ACTIVE_CONVERSATION_ID);
    }
    return storage.set(STORAGE_KEYS.ACTIVE_CONVERSATION_ID, id);
  }

  /**
   * Get the active conversation
   * @returns The active conversation or null
   */
  getActiveConversation(): Conversation | null {
    const activeId = this.getActiveConversationId();
    if (!activeId) {
      return null;
    }
    return this.getConversation(activeId);
  }
}

// ============================================
// Singleton Instance
// ============================================

/**
 * Default ConversationStorage instance
 * Use this for all conversation storage operations
 */
export const conversationStorage = new ConversationStorage();

// Also export the class for testing
export { ConversationStorage };
