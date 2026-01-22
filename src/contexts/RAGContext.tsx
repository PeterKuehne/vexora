/**
 * RAGContext - State Management for RAG (Document Search) Feature
 *
 * Manages RAG enable/disable state per conversation with intelligent automatic activation.
 * Follows the React Context + Provider pattern established in DocumentContext.
 */

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { analyzeIntent, type IntentAnalysis } from '../lib/intentDetection';

export type RAGMode = 'manual' | 'automatic' | 'always';

export interface RAGContextType {
  /** Current RAG mode */
  ragMode: RAGMode;
  /** Set RAG mode */
  setRAGMode: (mode: RAGMode) => void;
  /** Whether RAG is currently active for this query/conversation */
  isRAGActive: boolean;
  /** Whether RAG is available (has documents) */
  isRAGAvailable: boolean;
  /** Set RAG availability (internal) */
  setRAGAvailable: (available: boolean) => void;
  /** Legacy: Whether RAG is enabled for manual mode */
  isRAGEnabled: boolean;
  /** Legacy: Enable/disable RAG for manual mode */
  setRAGEnabled: (enabled: boolean) => void;
  /** Legacy: Toggle RAG state for manual mode */
  toggleRAG: () => void;
  /** Analyze query intent and determine if RAG should activate */
  analyzeQuery: (query: string) => IntentAnalysis;
  /** Determine if RAG should be active for a given query */
  shouldActivateRAGForQuery: (query: string) => boolean;
}

const RAGContext = createContext<RAGContextType | undefined>(undefined);

export interface RAGProviderProps {
  children: ReactNode;
}

export function RAGProvider({ children }: RAGProviderProps) {
  const [ragMode, setRAGMode] = useState<RAGMode>('automatic');
  const [isRAGEnabled, setIsRAGEnabled] = useState(false); // For manual mode
  const [isRAGAvailable, setIsRAGAvailable] = useState(false);

  // Determine if RAG is currently active based on mode
  const isRAGActive = ragMode === 'always' ||
    (ragMode === 'manual' && isRAGEnabled) ||
    (ragMode === 'automatic' && isRAGAvailable); // Automatic mode - determined per query

  // Legacy toggle functions for manual mode
  const setRAGEnabled = useCallback((enabled: boolean) => {
    setIsRAGEnabled(enabled);
  }, []);

  const toggleRAG = useCallback(() => {
    setIsRAGEnabled(prev => !prev);
  }, []);

  const setRAGAvailable = useCallback((available: boolean) => {
    setIsRAGAvailable(available);
    // Auto-disable manual RAG if no documents available
    if (!available) {
      setIsRAGEnabled(false);
    }
  }, []);

  // Intent analysis functions
  const analyzeQuery = useCallback((query: string): IntentAnalysis => {
    return analyzeIntent(query);
  }, []);

  const shouldActivateRAGForQuery = useCallback((query: string): boolean => {
    if (!isRAGAvailable) return false; // No documents available

    switch (ragMode) {
      case 'always':
        return true;
      case 'manual':
        return isRAGEnabled;
      case 'automatic':
        return analyzeIntent(query).shouldActivateRAG;
      default:
        return false;
    }
  }, [ragMode, isRAGEnabled, isRAGAvailable]);

  const value: RAGContextType = {
    ragMode,
    setRAGMode,
    isRAGActive,
    isRAGAvailable,
    setRAGAvailable,
    // Legacy support
    isRAGEnabled,
    setRAGEnabled,
    toggleRAG,
    // New intelligent functions
    analyzeQuery,
    shouldActivateRAGForQuery,
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