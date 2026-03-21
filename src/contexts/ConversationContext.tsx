/**
 * ConversationContext
 *
 * Manages multiple conversations with:
 * - API-first storage (PostgreSQL via REST API)
 * - LocalStorage as write-through cache (offline fallback)
 * - Active conversation tracking
 */

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useState,
  useRef,
  useMemo,
  type ReactNode,
} from 'react';
import { generateId } from '../utils';
import { useDebounce } from '../hooks';
import type { Conversation, CreateConversationInput } from '../types/conversation';
import type { Message } from '../types/message';
import {
  fetchConversations as apiFetchConversations,
  createAPIConversation,
  updateAPIConversation,
  deleteAPIConversation,
  addAPIMessage,
  type APIConversation,
} from '../lib/api';

// LocalStorage keys (cache)
const STORAGE_KEY = 'cor7ex-conversations';
const ACTIVE_ID_KEY = 'cor7ex-active-conversation';
const SCROLL_POSITIONS_KEY = 'cor7ex-scroll-positions';

// Auto-save debounce delay (ms)
const SAVE_DEBOUNCE_DELAY = 500;

// ============================================
// Context Types
// ============================================

/** Save status for UI indicator */
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface ConversationContextValue {
  /** All conversations */
  conversations: Conversation[];
  /** Filtered conversations based on search */
  filteredConversations: Conversation[];
  /** Currently active conversation */
  activeConversation: Conversation | null;
  /** ID of the active conversation */
  activeConversationId: string | null;
  /** Whether conversations are loading from storage */
  isLoading: boolean;
  /** Current save status for UI indicator */
  saveStatus: SaveStatus;
  /** Last saved timestamp */
  lastSavedAt: Date | null;

  // Search/Filter
  /** Current search query */
  searchQuery: string;
  /** Set search query */
  setSearchQuery: (query: string) => void;
  /** Clear search */
  clearSearch: () => void;
  /** Whether search is active */
  isSearchActive: boolean;

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
  /** Remove a message from the active conversation */
  removeMessageFromActive: (messageId: string) => void;
  /** Clear all messages in active conversation */
  clearActiveMessages: () => void;
  /** Get messages for active conversation */
  activeMessages: Message[];

  // Scroll position management
  saveScrollPosition: (conversationId: string, scrollTop: number, scrollHeight: number) => void;
  getScrollPosition: (conversationId: string) => { scrollTop: number; scrollHeight: number } | null;
}

// ============================================
// Context
// ============================================

const ConversationContext = createContext<ConversationContextValue | null>(null);

// ============================================
// LocalStorage Helpers (Cache)
// ============================================

function loadConversationsFromCache(): Conversation[] {
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

    return parsed.map((conv) => ({
      ...conv,
      createdAt: new Date(conv.createdAt),
      updatedAt: new Date(conv.updatedAt),
      messages: conv.messages.map((msg) => ({
        ...msg,
        timestamp: new Date(msg.timestamp),
      })) as Message[],
    }));
  } catch {
    return [];
  }
}

function saveConversationsToCache(conversations: Conversation[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
  } catch {
    // Storage full or unavailable
  }
}

function loadActiveId(): string | null {
  try { return localStorage.getItem(ACTIVE_ID_KEY); } catch { return null; }
}

function saveActiveId(id: string | null): void {
  try {
    if (id) localStorage.setItem(ACTIVE_ID_KEY, id);
    else localStorage.removeItem(ACTIVE_ID_KEY);
  } catch { /* ignore */ }
}

function loadScrollPositions(): Record<string, { scrollTop: number; scrollHeight: number }> {
  try {
    const data = localStorage.getItem(SCROLL_POSITIONS_KEY);
    return data ? JSON.parse(data) : {};
  } catch { return {}; }
}

function saveScrollPositions(positions: Record<string, { scrollTop: number; scrollHeight: number }>): void {
  try { localStorage.setItem(SCROLL_POSITIONS_KEY, JSON.stringify(positions)); } catch { /* ignore */ }
}

/** Convert API conversation to local format */
function apiToLocal(apiConv: APIConversation): Conversation {
  return {
    id: apiConv.id,
    title: apiConv.title || 'Neue Unterhaltung',
    messages: [],
    createdAt: new Date(apiConv.createdAt),
    updatedAt: new Date(apiConv.updatedAt),
    ...(apiConv.model ? { model: apiConv.model } : {}),
    isPinned: apiConv.isPinned,
    isArchived: apiConv.isArchived,
  };
}

// ============================================
// Provider Component
// ============================================

interface ConversationProviderProps {
  children: ReactNode;
}

export function ConversationProvider({ children }: ConversationProviderProps) {
  // Initialize from LocalStorage cache (instant, no loading state)
  const [conversations, setConversations] = useState<Conversation[]>(() => loadConversationsFromCache());

  const [activeConversationId, setActiveConversationId] = useState<string | null>(() => {
    const loaded = loadConversationsFromCache();
    const activeId = loadActiveId();
    if (activeId && loaded.some((c) => c.id === activeId)) return activeId;
    if (loaded.length > 0) {
      const sorted = [...loaded].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
      return sorted[0].id;
    }
    return null;
  });

  const [isLoading, setIsLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [searchQuery, setSearchQueryState] = useState<string>('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [scrollPositions, setScrollPositions] = useState(() => loadScrollPositions());

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitialMount = useRef(true);
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const apiAvailableRef = useRef(false);

  // Try to sync from API on mount (non-blocking)
  useEffect(() => {
    const syncFromAPI = async () => {
      try {
        const result = await apiFetchConversations({ limit: 100 });
        if (result.conversations.length > 0) {
          apiAvailableRef.current = true;
          // Merge API conversations with local cache (API is source of truth)
          const apiConversations = result.conversations.map(apiToLocal);

          // Preserve local messages for conversations that exist in both
          setConversations(prev => {
            const localMap = new Map(prev.map(c => [c.id, c]));
            return apiConversations.map(apiConv => {
              const local = localMap.get(apiConv.id);
              return local ? { ...apiConv, messages: local.messages } : apiConv;
            });
          });
        }
      } catch {
        // API not available - continue with LocalStorage
        apiAvailableRef.current = false;
      }
    };
    syncFromAPI();
  }, []);

  // Write-through to LocalStorage when conversations change
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current);

    statusTimerRef.current = setTimeout(() => setSaveStatus('saving'), 0);

    saveTimerRef.current = setTimeout(() => {
      try {
        saveConversationsToCache(conversations);
        setSaveStatus('saved');
        setLastSavedAt(new Date());
        statusTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2000);
      } catch {
        setSaveStatus('error');
      }
    }, SAVE_DEBOUNCE_DELAY);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    };
  }, [conversations]);

  // Save active ID
  useEffect(() => { saveActiveId(activeConversationId); }, [activeConversationId]);

  const activeConversation = conversations.find((c) => c.id === activeConversationId) ?? null;
  const activeMessages = activeConversation?.messages ?? [];

  const filteredConversations = useMemo(() => {
    if (!debouncedSearchQuery.trim()) return conversations;
    const query = debouncedSearchQuery.toLowerCase();
    return conversations.filter((conversation) => {
      if (conversation.title.toLowerCase().includes(query)) return true;
      return conversation.messages.some((message) => message.content.toLowerCase().includes(query));
    });
  }, [conversations, debouncedSearchQuery]);

  const isSearchActive = debouncedSearchQuery.trim().length > 0;

  const createConversation = useCallback(
    (input?: CreateConversationInput): Conversation => {
      const now = new Date();
      const newConversation: Conversation = {
        id: generateId(),
        title: input?.title ?? 'Neue Unterhaltung',
        messages: [],
        createdAt: now,
        updatedAt: now,
        ...(input?.model ? { model: input.model } : {}),
        isPinned: false,
        isArchived: false,
      };

      setConversations((prev) => [newConversation, ...prev]);
      setActiveConversationId(newConversation.id);

      // Async API sync (fire-and-forget)
      if (apiAvailableRef.current) {
        createAPIConversation({ title: input?.title, model: input?.model }).catch(() => {});
      }

      return newConversation;
    },
    []
  );

  const deleteConversation = useCallback(
    (id: string) => {
      setConversations((prev) => {
        const newConversations = prev.filter((c) => c.id !== id);
        if (id === activeConversationId) {
          if (newConversations.length > 0) {
            const sorted = [...newConversations].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
            setActiveConversationId(sorted[0].id);
          } else {
            setActiveConversationId(null);
          }
        }
        return newConversations;
      });

      // Async API sync
      if (apiAvailableRef.current) {
        deleteAPIConversation(id).catch(() => {});
      }
    },
    [activeConversationId]
  );

  const setActiveConversation = useCallback((id: string) => {
    setActiveConversationId(id);
  }, []);

  const updateConversationTitle = useCallback((id: string, title: string) => {
    setConversations((prev) =>
      prev.map((conv) => conv.id === id ? { ...conv, title, updatedAt: new Date() } : conv)
    );
    if (apiAvailableRef.current) {
      updateAPIConversation(id, { title }).catch(() => {});
    }
  }, []);

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

      // Async API sync - persist message
      if (apiAvailableRef.current) {
        addAPIMessage(activeConversationId, {
          role: message.role,
          content: message.content,
          model: message.model,
          tokenCount: message.tokenCount,
          sources: message.sources,
        }).catch(() => {});
      }
    },
    [activeConversationId]
  );

  const updateMessageInActive = useCallback(
    (messageId: string, updates: Partial<Message>) => {
      if (!activeConversationId) return;
      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === activeConversationId
            ? {
                ...conv,
                messages: conv.messages.map((msg) => msg.id === messageId ? { ...msg, ...updates } : msg),
                updatedAt: new Date(),
              }
            : conv
        )
      );
    },
    [activeConversationId]
  );

  const removeMessageFromActive = useCallback(
    (messageId: string) => {
      if (!activeConversationId) return;
      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === activeConversationId
            ? { ...conv, messages: conv.messages.filter((msg) => msg.id !== messageId), updatedAt: new Date() }
            : conv
        )
      );
    },
    [activeConversationId]
  );

  const clearActiveMessages = useCallback(() => {
    if (!activeConversationId) return;
    setConversations((prev) =>
      prev.map((conv) =>
        conv.id === activeConversationId
          ? { ...conv, messages: [], title: 'Neue Unterhaltung', updatedAt: new Date() }
          : conv
      )
    );
  }, [activeConversationId]);

  const setSearchQuery = useCallback((query: string) => { setSearchQueryState(query); }, []);
  const clearSearch = useCallback(() => { setSearchQueryState(''); }, []);

  const saveScrollPosition = useCallback((conversationId: string, scrollTop: number, scrollHeight: number) => {
    setScrollPositions(prev => {
      const newPositions = { ...prev, [conversationId]: { scrollTop, scrollHeight } };
      saveScrollPositions(newPositions);
      return newPositions;
    });
  }, []);

  const getScrollPosition = useCallback((conversationId: string) => {
    return scrollPositions[conversationId] || null;
  }, [scrollPositions]);

  const value: ConversationContextValue = {
    conversations,
    filteredConversations,
    activeConversation,
    activeConversationId,
    isLoading,
    saveStatus,
    lastSavedAt,
    searchQuery,
    setSearchQuery,
    clearSearch,
    isSearchActive,
    createConversation,
    deleteConversation,
    setActiveConversation,
    updateConversationTitle,
    addMessageToActive,
    updateMessageInActive,
    removeMessageFromActive,
    clearActiveMessages,
    activeMessages,
    saveScrollPosition,
    getScrollPosition,
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
