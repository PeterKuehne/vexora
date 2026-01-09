/**
 * ConversationSidebar
 *
 * Displays a list of all conversations and allows switching between them.
 * Features:
 * - Shows all conversations sorted by last update
 * - Highlights active conversation
 * - Click to switch conversation
 * - Delete conversation option
 * - Collapsible on mobile
 */

import { useState } from 'react';
import { MessageSquare, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useConversations } from '../contexts';
import { formatDate } from '../utils';

interface ConversationSidebarProps {
  /** Whether sidebar is collapsed (for mobile) */
  isCollapsed?: boolean;
  /** Callback when collapse state changes */
  onToggleCollapse?: () => void;
}

export function ConversationSidebar({
  isCollapsed = false,
  onToggleCollapse,
}: ConversationSidebarProps) {
  const {
    conversations,
    activeConversationId,
    setActiveConversation,
    deleteConversation,
  } = useConversations();

  // Track which conversation's delete button is being hovered
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  // Track which delete confirmation is open
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Sort conversations by updatedAt (newest first)
  const sortedConversations = [...conversations].sort(
    (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
  );

  /**
   * Handle conversation click - switch to that conversation
   */
  const handleConversationClick = (id: string) => {
    if (id !== activeConversationId) {
      setActiveConversation(id);
    }
  };

  /**
   * Handle delete button click
   */
  const handleDeleteClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); // Don't trigger conversation switch
    setConfirmDeleteId(id);
  };

  /**
   * Confirm deletion
   */
  const handleConfirmDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    deleteConversation(id);
    setConfirmDeleteId(null);
  };

  /**
   * Cancel deletion
   */
  const handleCancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDeleteId(null);
  };

  // Collapsed state - just show toggle button
  if (isCollapsed) {
    return (
      <div className="w-10 h-full flex flex-col items-center py-3 bg-surface border-r border-white/10">
        <button
          onClick={onToggleCollapse}
          className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          title="Sidebar öffnen"
        >
          <ChevronRight size={20} />
        </button>
      </div>
    );
  }

  return (
    <div className="w-64 h-full flex flex-col bg-surface border-r border-white/10">
      {/* Sidebar Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-white/10">
        <h2 className="text-sm font-medium text-gray-300">Unterhaltungen</h2>
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors"
            title="Sidebar schließen"
          >
            <ChevronLeft size={18} />
          </button>
        )}
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {sortedConversations.length === 0 ? (
          <div className="px-3 py-8 text-center text-gray-500 text-sm">
            Keine Unterhaltungen vorhanden
          </div>
        ) : (
          <div className="py-2">
            {sortedConversations.map((conversation) => {
              const isActive = conversation.id === activeConversationId;
              const isHovered = conversation.id === hoveredId;
              const isConfirming = conversation.id === confirmDeleteId;

              return (
                <div
                  key={conversation.id}
                  onClick={() => handleConversationClick(conversation.id)}
                  onMouseEnter={() => setHoveredId(conversation.id)}
                  onMouseLeave={() => {
                    setHoveredId(null);
                    if (!isConfirming) setConfirmDeleteId(null);
                  }}
                  className={`
                    group relative mx-2 mb-1 px-3 py-2.5 rounded-lg cursor-pointer
                    transition-colors duration-150
                    ${
                      isActive
                        ? 'bg-primary/20 text-white'
                        : 'text-gray-300 hover:bg-white/5 hover:text-white'
                    }
                  `}
                >
                  {/* Confirmation Dialog */}
                  {isConfirming ? (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-gray-400">Löschen?</span>
                      <div className="flex gap-1">
                        <button
                          onClick={(e) => handleConfirmDelete(e, conversation.id)}
                          className="px-2 py-1 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded transition-colors"
                        >
                          Ja
                        </button>
                        <button
                          onClick={handleCancelDelete}
                          className="px-2 py-1 text-xs text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors"
                        >
                          Nein
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Conversation Icon and Title */}
                      <div className="flex items-start gap-2.5">
                        <MessageSquare
                          size={16}
                          className={`mt-0.5 flex-shrink-0 ${
                            isActive ? 'text-primary' : 'text-gray-500'
                          }`}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {conversation.title}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {conversation.messages.length} Nachrichten
                            {' · '}
                            {formatDate(conversation.updatedAt)}
                          </p>
                        </div>
                      </div>

                      {/* Delete Button (shows on hover) */}
                      {(isHovered || isActive) && (
                        <button
                          onClick={(e) => handleDeleteClick(e, conversation.id)}
                          className={`
                            absolute right-2 top-1/2 -translate-y-1/2
                            p-1.5 rounded transition-colors
                            ${
                              isActive
                                ? 'text-gray-400 hover:text-red-400 hover:bg-red-500/20'
                                : 'text-gray-500 hover:text-red-400 hover:bg-red-500/20'
                            }
                          `}
                          title="Unterhaltung löschen"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Sidebar Footer - Shows count */}
      <div className="px-3 py-2 border-t border-white/10 text-xs text-gray-500">
        {conversations.length} Unterhaltung{conversations.length !== 1 ? 'en' : ''}
      </div>
    </div>
  );
}
