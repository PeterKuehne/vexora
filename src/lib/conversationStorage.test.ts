/**
 * ConversationStorage Tests
 *
 * Tests for all CRUD operations on conversations
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConversationStorage } from './conversationStorage';
import type { Conversation } from '../types/conversation';
import type { Message } from '../types/message';

// ============================================
// Test Helpers
// ============================================

function createTestMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    role: 'user',
    content: 'Test message',
    timestamp: new Date(),
    ...overrides,
  };
}

function createTestConversation(overrides: Partial<Conversation> = {}): Conversation {
  const now = new Date();
  return {
    id: `conv-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    title: 'Test Conversation',
    messages: [],
    createdAt: now,
    updatedAt: now,
    isPinned: false,
    isArchived: false,
    ...overrides,
  };
}

// ============================================
// Tests
// ============================================

describe('ConversationStorage', () => {
  let conversationStorage: ConversationStorage;

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    // Create a fresh instance for each test
    conversationStorage = new ConversationStorage();
  });

  describe('getAllConversations', () => {
    it('should return empty array when no conversations exist', () => {
      const result = conversationStorage.getAllConversations();
      expect(result).toEqual([]);
    });

    it('should return all saved conversations', () => {
      const conv1 = createTestConversation({ id: 'conv-1', title: 'First' });
      const conv2 = createTestConversation({ id: 'conv-2', title: 'Second' });

      conversationStorage.saveConversation(conv1);
      conversationStorage.saveConversation(conv2);

      const result = conversationStorage.getAllConversations();
      expect(result).toHaveLength(2);
      expect(result.map((c) => c.id)).toContain('conv-1');
      expect(result.map((c) => c.id)).toContain('conv-2');
    });

    it('should return conversations sorted by updatedAt (newest first)', () => {
      const oldDate = new Date('2024-01-01');
      const newDate = new Date('2024-06-01');

      const conv1 = createTestConversation({
        id: 'conv-old',
        updatedAt: oldDate,
        createdAt: oldDate,
      });
      const conv2 = createTestConversation({
        id: 'conv-new',
        updatedAt: newDate,
        createdAt: newDate,
      });

      // Save older first
      conversationStorage.saveConversation(conv1);
      conversationStorage.saveConversation(conv2);

      const result = conversationStorage.getAllConversations();
      // Newer should be first (most recent updatedAt)
      expect(result[0].id).toBe('conv-new');
    });

    it('should deserialize dates correctly', () => {
      const testDate = new Date('2024-03-15T10:30:00.000Z');
      const conv = createTestConversation({
        id: 'conv-dates',
        createdAt: testDate,
        updatedAt: testDate,
      });

      conversationStorage.saveConversation(conv);
      const result = conversationStorage.getAllConversations();

      expect(result[0].createdAt).toBeInstanceOf(Date);
      expect(result[0].updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('getConversation', () => {
    it('should return null when conversation does not exist', () => {
      const result = conversationStorage.getConversation('non-existent');
      expect(result).toBeNull();
    });

    it('should return the correct conversation by ID', () => {
      const conv = createTestConversation({ id: 'conv-find', title: 'Find Me' });
      conversationStorage.saveConversation(conv);

      const result = conversationStorage.getConversation('conv-find');
      expect(result).not.toBeNull();
      expect(result?.title).toBe('Find Me');
    });

    it('should deserialize messages correctly', () => {
      const msgDate = new Date('2024-05-10T14:20:00.000Z');
      const message = createTestMessage({
        id: 'msg-1',
        content: 'Hello',
        timestamp: msgDate,
      });
      const conv = createTestConversation({
        id: 'conv-msg',
        messages: [message],
      });

      conversationStorage.saveConversation(conv);
      const result = conversationStorage.getConversation('conv-msg');

      expect(result?.messages).toHaveLength(1);
      expect(result?.messages[0].timestamp).toBeInstanceOf(Date);
      expect(result?.messages[0].content).toBe('Hello');
    });
  });

  describe('saveConversation', () => {
    it('should create a new conversation', () => {
      const conv = createTestConversation({ id: 'conv-new', title: 'New Conv' });
      const success = conversationStorage.saveConversation(conv);

      expect(success).toBe(true);
      expect(conversationStorage.getConversation('conv-new')).not.toBeNull();
    });

    it('should update an existing conversation', () => {
      const conv = createTestConversation({ id: 'conv-update', title: 'Original' });
      conversationStorage.saveConversation(conv);

      // Update the title
      conv.title = 'Updated';
      conversationStorage.saveConversation(conv);

      const result = conversationStorage.getConversation('conv-update');
      expect(result?.title).toBe('Updated');
    });

    it('should update the updatedAt timestamp when saving', () => {
      vi.useFakeTimers();
      const initialTime = new Date('2024-01-01T00:00:00.000Z');
      vi.setSystemTime(initialTime);

      const conv = createTestConversation({ id: 'conv-time' });
      conversationStorage.saveConversation(conv);

      // Move time forward
      const laterTime = new Date('2024-06-01T00:00:00.000Z');
      vi.setSystemTime(laterTime);

      // Save again (update)
      conversationStorage.saveConversation({ ...conv, title: 'Changed' });

      const result = conversationStorage.getConversation('conv-time');
      expect(result?.updatedAt.getTime()).toBe(laterTime.getTime());

      vi.useRealTimers();
    });
  });

  describe('deleteConversation', () => {
    it('should return false when conversation does not exist', () => {
      const success = conversationStorage.deleteConversation('non-existent');
      expect(success).toBe(false);
    });

    it('should delete an existing conversation', () => {
      const conv = createTestConversation({ id: 'conv-delete' });
      conversationStorage.saveConversation(conv);

      const success = conversationStorage.deleteConversation('conv-delete');
      expect(success).toBe(true);
      expect(conversationStorage.getConversation('conv-delete')).toBeNull();
    });

    it('should not affect other conversations', () => {
      const conv1 = createTestConversation({ id: 'conv-keep', title: 'Keep' });
      const conv2 = createTestConversation({ id: 'conv-remove', title: 'Remove' });

      conversationStorage.saveConversation(conv1);
      conversationStorage.saveConversation(conv2);

      conversationStorage.deleteConversation('conv-remove');

      expect(conversationStorage.getConversation('conv-keep')).not.toBeNull();
      expect(conversationStorage.getAllConversations()).toHaveLength(1);
    });
  });

  describe('updateConversation', () => {
    it('should return null when conversation does not exist', () => {
      const result = conversationStorage.updateConversation('non-existent', {
        title: 'New Title',
      });
      expect(result).toBeNull();
    });

    it('should update specific fields only', () => {
      const conv = createTestConversation({
        id: 'conv-partial',
        title: 'Original Title',
        isPinned: false,
      });
      conversationStorage.saveConversation(conv);

      const result = conversationStorage.updateConversation('conv-partial', {
        isPinned: true,
      });

      expect(result?.isPinned).toBe(true);
      expect(result?.title).toBe('Original Title'); // Unchanged
    });

    it('should update messages array', () => {
      const conv = createTestConversation({ id: 'conv-msgs', messages: [] });
      conversationStorage.saveConversation(conv);

      const newMessage = createTestMessage({ content: 'New message' });
      const result = conversationStorage.updateConversation('conv-msgs', {
        messages: [newMessage],
      });

      expect(result?.messages).toHaveLength(1);
      expect(result?.messages[0].content).toBe('New message');
    });

    it('should return the updated conversation', () => {
      const conv = createTestConversation({ id: 'conv-return' });
      conversationStorage.saveConversation(conv);

      const result = conversationStorage.updateConversation('conv-return', {
        title: 'New Title',
      });

      expect(result).not.toBeNull();
      expect(result?.title).toBe('New Title');
    });
  });

  describe('hasConversation', () => {
    it('should return false when conversation does not exist', () => {
      expect(conversationStorage.hasConversation('non-existent')).toBe(false);
    });

    it('should return true when conversation exists', () => {
      const conv = createTestConversation({ id: 'conv-exists' });
      conversationStorage.saveConversation(conv);

      expect(conversationStorage.hasConversation('conv-exists')).toBe(true);
    });
  });

  describe('getCount', () => {
    it('should return 0 when no conversations exist', () => {
      expect(conversationStorage.getCount()).toBe(0);
    });

    it('should return correct count', () => {
      conversationStorage.saveConversation(createTestConversation({ id: '1' }));
      conversationStorage.saveConversation(createTestConversation({ id: '2' }));
      conversationStorage.saveConversation(createTestConversation({ id: '3' }));

      expect(conversationStorage.getCount()).toBe(3);
    });
  });

  describe('clearAll', () => {
    it('should remove all conversations', () => {
      conversationStorage.saveConversation(createTestConversation({ id: '1' }));
      conversationStorage.saveConversation(createTestConversation({ id: '2' }));

      conversationStorage.clearAll();

      expect(conversationStorage.getAllConversations()).toEqual([]);
    });
  });

  describe('Active Conversation ID', () => {
    it('should return null when no active conversation is set', () => {
      expect(conversationStorage.getActiveConversationId()).toBeNull();
    });

    it('should set and get active conversation ID', () => {
      conversationStorage.setActiveConversationId('active-conv-1');
      expect(conversationStorage.getActiveConversationId()).toBe('active-conv-1');
    });

    it('should clear active conversation ID when set to null', () => {
      conversationStorage.setActiveConversationId('active-conv');
      conversationStorage.setActiveConversationId(null);

      expect(conversationStorage.getActiveConversationId()).toBeNull();
    });

    it('should get active conversation object', () => {
      const conv = createTestConversation({
        id: 'active-conv-2',
        title: 'Active Conv',
      });
      conversationStorage.saveConversation(conv);
      conversationStorage.setActiveConversationId('active-conv-2');

      const result = conversationStorage.getActiveConversation();
      expect(result).not.toBeNull();
      expect(result?.title).toBe('Active Conv');
    });

    it('should return null when active ID references non-existent conversation', () => {
      conversationStorage.setActiveConversationId('non-existent');
      expect(conversationStorage.getActiveConversation()).toBeNull();
    });
  });
});
