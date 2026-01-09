/**
 * ConversationContext
 *
 * Manages multiple conversations with:
 * - Create, delete, switch conversations
 * - LocalStorage persistence
 * - Active conversation tracking
 */

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { generateId } from '../utils';
import type { Conversation, CreateConversationInput } from '../types/conversation';
import type { Message } from '../types/message';

// LocalStorage key
const STORAGE_KEY = 'qwen-chat-conversations';
const ACTIVE_ID_KEY = 'qwen-chat-active-conversation';

// ============================================
// Context Types
// ============================================

interface ConversationContextValue {
  /** All conversations */
  conversations: Conversation[];
  /** Currently active conversation */
  activeConversation: Conversation | null;
  /** ID of the active conversation */
  activeConversationId: string | null;
  /** Whether conversations are loading from storage */
  isLoading: boolean;

  // Actions
  /** Create a new conversation and set it as active */
  createConversation: (input?: CreateConversationInput) => Conversation;
  /** Delete a conversation by ID */
  deleteConversation: (id: string) => void;
  /** Switch to a different conversation */
  setActiveConversation: (id: string) => void;
  /** Update conversation title */
  updateConversationTitle: (id: string, title: string) => void;
  /** Add a message to the active conversation */
  addMessageToActive: (message: Message) => void;
  /** Update a message in the active conversation */
  updateMessageInActive: (messageId: string, updates: Partial<Message>) => void;
  /** Clear all messages in active conversation */
  clearActiveMessages: () => void;
  /** Get messages for active conversation */
  activeMessages: Message[];
}

// ============================================
// Context
// ============================================

const ConversationContext = createContext<ConversationContextValue | null>(null);

// ============================================
// Storage Helpers
// ============================================

/**
 * Load conversations from LocalStorage
 */
function loadConversations(): Conversation[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];

    const parsed = JSON.parse(data) as Array<{
      id: string;
      title: string;
      messages: Array<{
        id: string;
        role: string;
        content: string;
        timestamp: string;
        status?: string;
        isStreaming?: boolean;
        model?: string;
        tokenCount?: number;
        error?: string;
      }>;
      createdAt: string;
      updatedAt: string;
      model?: string;
      isPinned?: boolean;
      isArchived?: boolean;
    }>;

    // Convert date strings back to Date objects
    return parsed.map((conv) => ({
      ...conv,
      createdAt: new Date(conv.createdAt),
      updatedAt: new Date(conv.updatedAt),
      messages: conv.messages.map((msg) => ({
        ...msg,
        timestamp: new Date(msg.timestamp),
      })) as Message[],
    }));
  } catch (error) {
    console.error('Failed to load conversations from storage:', error);
    return [];
  }
}

/**
 * Save conversations to LocalStorage
 */
function saveConversations(conversations: Conversation[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
  } catch (error) {
    console.error('Failed to save conversations to storage:', error);
  }
}

/**
 * Load active conversation ID from LocalStorage
 */
function loadActiveId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_ID_KEY);
  } catch {
    return null;
  }
}

/**
 * Save active conversation ID to LocalStorage
 */
function saveActiveId(id: string | null): void {
  try {
    if (id) {
      localStorage.setItem(ACTIVE_ID_KEY, id);
    } else {
      localStorage.removeItem(ACTIVE_ID_KEY);
    }
  } catch (error) {
    console.error('Failed to save active ID to storage:', error);
  }
}

// ============================================
// Provider Component
// ============================================

interface ConversationProviderProps {
  children: ReactNode;
}

export function ConversationProvider({ children }: ConversationProviderProps) {
  // Use lazy initializers to load from storage synchronously on first render
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    return loadConversations();
  });

  const [activeConversationId, setActiveConversationId] = useState<string | null>(() => {
    const loadedConversations = loadConversations();
    const loadedActiveId = loadActiveId();

    // Validate that active ID exists in loaded conversations
    if (loadedActiveId && loadedConversations.some((c) => c.id === loadedActiveId)) {
      return loadedActiveId;
    } else if (loadedConversations.length > 0) {
      // Default to most recent conversation
      const sorted = [...loadedConversations].sort(
        (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
      );
      return sorted[0].id;
    }
    return null;
  });

  // No longer loading since we use synchronous initialization
  const isLoading = false;

  // Save conversations to storage when they change
  useEffect(() => {
    saveConversations(conversations);
  }, [conversations]);

  // Save active ID to storage when it changes
  useEffect(() => {
    saveActiveId(activeConversationId);
  }, [activeConversationId]);

  // Get active conversation object
  const activeConversation =
    conversations.find((c) => c.id === activeConversationId) ?? null;

  // Get messages for active conversation
  const activeMessages = activeConversation?.messages ?? [];

  /**
   * Create a new conversation
   */
  const createConversation = useCallback(
    (input?: CreateConversationInput): Conversation => {
      const now = new Date();
      const newConversation: Conversation = {
        id: generateId(),
        title: input?.title ?? 'Neue Unterhaltung',
        messages: [],
        createdAt: now,
        updatedAt: now,
        // Only set model if provided (exactOptionalPropertyTypes requires this)
        ...(input?.model ? { model: input.model } : {}),
        isPinned: false,
        isArchived: false,
      };

      setConversations((prev) => [newConversation, ...prev]);
      setActiveConversationId(newConversation.id);

      return newConversation;
    },
    []
  );

  /**
   * Delete a conversation
   */
  const deleteConversation = useCallback(
    (id: string) => {
      setConversations((prev) => {
        const newConversations = prev.filter((c) => c.id !== id);

        // If deleting active conversation, switch to another
        if (id === activeConversationId) {
          if (newConversations.length > 0) {
            const sorted = [...newConversations].sort(
              (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
            );
            setActiveConversationId(sorted[0].id);
          } else {
            setActiveConversationId(null);
          }
        }

        return newConversations;
      });
    },
    [activeConversationId]
  );

  /**
   * Set active conversation
   */
  const setActiveConversation = useCallback((id: string) => {
    setActiveConversationId(id);
  }, []);

  /**
   * Update conversation title
   */
  const updateConversationTitle = useCallback((id: string, title: string) => {
    setConversations((prev) =>
      prev.map((conv) =>
        conv.id === id
          ? { ...conv, title, updatedAt: new Date() }
          : conv
      )
    );
  }, []);

  /**
   * Add a message to active conversation
   */
  const addMessageToActive = useCallback(
    (message: Message) => {
      if (!activeConversationId) return;

      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === activeConversationId
            ? {
                ...conv,
                messages: [...conv.messages, message],
                updatedAt: new Date(),
                // Auto-generate title from first user message
                title:
                  conv.title === 'Neue Unterhaltung' &&
                  message.role === 'user' &&
                  conv.messages.length === 0
                    ? message.content.slice(0, 50) + (message.content.length > 50 ? '...' : '')
                    : conv.title,
              }
            : conv
        )
      );
    },
    [activeConversationId]
  );

  /**
   * Update a message in active conversation
   */
  const updateMessageInActive = useCallback(
    (messageId: string, updates: Partial<Message>) => {
      if (!activeConversationId) return;

      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === activeConversationId
            ? {
                ...conv,
                messages: conv.messages.map((msg) =>
                  msg.id === messageId ? { ...msg, ...updates } : msg
                ),
                updatedAt: new Date(),
              }
            : conv
        )
      );
    },
    [activeConversationId]
  );

  /**
   * Clear messages in active conversation
   */
  const clearActiveMessages = useCallback(() => {
    if (!activeConversationId) return;

    setConversations((prev) =>
      prev.map((conv) =>
        conv.id === activeConversationId
          ? {
              ...conv,
              messages: [],
              title: 'Neue Unterhaltung',
              updatedAt: new Date(),
            }
          : conv
      )
    );
  }, [activeConversationId]);

  const value: ConversationContextValue = {
    conversations,
    activeConversation,
    activeConversationId,
    isLoading,
    createConversation,
    deleteConversation,
    setActiveConversation,
    updateConversationTitle,
    addMessageToActive,
    updateMessageInActive,
    clearActiveMessages,
    activeMessages,
  };

  return (
    <ConversationContext.Provider value={value}>
      {children}
    </ConversationContext.Provider>
  );
}

// ============================================
// Hook
// ============================================

export function useConversations(): ConversationContextValue {
  const context = useContext(ConversationContext);

  if (!context) {
    throw new Error('useConversations must be used within a ConversationProvider');
  }

  return context;
}
