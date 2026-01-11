/**
 * ConversationSearch Component
 *
 * Search input for filtering conversations by title and content.
 * Integrates directly with ConversationContext.
 */

import { MessageSquare, X } from 'lucide-react';
import { SearchInput, SearchInputCompact } from './SearchInput';
import { useConversations } from '../contexts/ConversationContext';
import { cn } from '../utils';

// ============================================
// Types
// ============================================

export interface ConversationSearchProps {
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Visual variant */
  variant?: 'default' | 'filled' | 'ghost';
  /** Custom placeholder text */
  placeholder?: string;
  /** Optional className */
  className?: string;
  /** Auto-focus on mount */
  autoFocus?: boolean;
}

export interface ConversationSearchCompactProps {
  /** Custom placeholder text */
  placeholder?: string;
  /** Optional className */
  className?: string;
}

// ============================================
// ConversationSearch Component
// ============================================

/**
 * Full-featured conversation search with clear button and debouncing
 */
export function ConversationSearch({
  size = 'sm',
  variant = 'filled',
  placeholder = 'Unterhaltungen durchsuchen...',
  className,
  autoFocus = false,
}: ConversationSearchProps) {
  const { searchQuery, setSearchQuery, clearSearch, isSearchActive, filteredConversations } = useConversations();

  return (
    <div className={cn('relative', className)}>
      <SearchInput
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder={placeholder}
        size={size}
        variant={variant}
        showClear={true}
        autoFocus={autoFocus}
        title="Durchsuche Unterhaltungen nach Titel oder Inhalt"
      />

      {/* Search Results Count */}
      {isSearchActive && (
        <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <MessageSquare size={12} />
            {filteredConversations.length === 1
              ? '1 Unterhaltung gefunden'
              : `${filteredConversations.length} Unterhaltungen gefunden`
            }
          </span>

          {searchQuery && (
            <button
              onClick={clearSearch}
              className="flex items-center gap-1 px-2 py-1 rounded text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-colors"
              title="Suche löschen"
            >
              <X size={12} />
              Löschen
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// ConversationSearchCompact Component
// ============================================

/**
 * Compact conversation search without result count or clear button
 */
export function ConversationSearchCompact({
  placeholder = 'Suchen...',
  className,
}: ConversationSearchCompactProps) {
  const { searchQuery, setSearchQuery } = useConversations();

  return (
    <SearchInputCompact
      value={searchQuery}
      onChange={setSearchQuery}
      placeholder={placeholder}
      {...(className ? { className } : {})}
    />
  );
}

// ============================================
// ConversationSearchBar Component
// ============================================

export interface ConversationSearchBarProps {
  /** Show result count */
  showResultCount?: boolean;
  /** Show clear all button */
  showClearAll?: boolean;
  /** Optional className */
  className?: string;
}

/**
 * Search bar with integrated controls for conversation filtering
 */
export function ConversationSearchBar({
  showResultCount = true,
  showClearAll = true,
  className,
}: ConversationSearchBarProps) {
  const {
    searchQuery,
    setSearchQuery,
    clearSearch,
    isSearchActive,
    filteredConversations,
    conversations
  } = useConversations();

  const resultCount = filteredConversations.length;
  const totalCount = conversations.length;

  return (
    <div className={cn('space-y-2', className)}>
      {/* Search Input */}
      <SearchInput
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Nach Titel oder Inhalt suchen..."
        size="sm"
        variant="filled"
        showClear={true}
      />

      {/* Search Results Info */}
      {isSearchActive && showResultCount && (
        <div className="flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <MessageSquare size={12} />
            <span>
              {resultCount} von {totalCount} Unterhaltungen
              {searchQuery && (
                <>
                  {' '}für <span className="text-gray-300 font-medium">"{searchQuery}"</span>
                </>
              )}
            </span>
          </div>

          {showClearAll && searchQuery && (
            <button
              onClick={clearSearch}
              className="px-2 py-1 rounded text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-colors"
              title="Suche löschen"
            >
              Löschen
            </button>
          )}
        </div>
      )}

      {/* No Results Message */}
      {isSearchActive && resultCount === 0 && searchQuery.trim().length > 0 && (
        <div className="text-center py-4 text-gray-500">
          <MessageSquare size={16} className="mx-auto mb-2 opacity-50" />
          <div className="text-sm">
            Keine Unterhaltungen für <span className="text-gray-300 font-medium">"{searchQuery}"</span> gefunden
          </div>
          <button
            onClick={clearSearch}
            className="mt-2 text-xs text-primary hover:text-primary-light transition-colors"
          >
            Suche löschen
          </button>
        </div>
      )}
    </div>
  );
}