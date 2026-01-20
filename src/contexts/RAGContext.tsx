/**
 * RAGContext - State Management for RAG (Document Search) Feature
 *
 * Manages RAG enable/disable state per conversation.
 * Follows the React Context + Provider pattern established in DocumentContext.
 */

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

export interface RAGContextType {
  /** Whether RAG is enabled for the current conversation */
  isRAGEnabled: boolean;
  /** Enable/disable RAG for current conversation */
  setRAGEnabled: (enabled: boolean) => void;
  /** Toggle RAG state */
  toggleRAG: () => void;
  /** Whether RAG is available (has documents) */
  isRAGAvailable: boolean;
  /** Set RAG availability (internal) */
  setRAGAvailable: (available: boolean) => void;
}

const RAGContext = createContext<RAGContextType | undefined>(undefined);

export interface RAGProviderProps {
  children: ReactNode;
}

export function RAGProvider({ children }: RAGProviderProps) {
  const [isRAGEnabled, setIsRAGEnabled] = useState(false);
  const [isRAGAvailable, setIsRAGAvailable] = useState(false);

  // Toggle RAG state with useCallback for performance (following convention)
  const setRAGEnabled = useCallback((enabled: boolean) => {
    setIsRAGEnabled(enabled);
  }, []);

  const toggleRAG = useCallback(() => {
    setIsRAGEnabled(prev => !prev);
  }, []);

  const setRAGAvailable = useCallback((available: boolean) => {
    setIsRAGAvailable(available);
    // Auto-disable RAG if no documents available
    if (!available) {
      setIsRAGEnabled(false);
    }
  }, []);

  const value: RAGContextType = {
    isRAGEnabled,
    setRAGEnabled,
    toggleRAG,
    isRAGAvailable,
    setRAGAvailable,
  };

  return <RAGContext.Provider value={value}>{children}</RAGContext.Provider>;
}

// Custom hook for using RAG context (following convention pattern)
export function useRAG(): RAGContextType {
  const context = useContext(RAGContext);
  if (context === undefined) {
    throw new Error('useRAG must be used within a RAGProvider');
  }
  return context;
}

// Note: RAGContextType is already exported above, no need to re-export