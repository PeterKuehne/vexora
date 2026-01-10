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
 * - Uses Sidebar layout component (280px width)
 */

import { useState } from 'react';
import { MessageSquare, Trash2 } from 'lucide-react';
import { useConversations } from '../contexts';
import { useTheme } from '../contexts';
import { formatDate } from '../utils';
import { Sidebar } from './layout';

/** Sidebar width in pixels - matches design spec */
const SIDEBAR_WIDTH = 280;

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
  const { isDark } = useTheme();

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

  // Sidebar header content
  const headerContent = (
    <h2
      className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}
    >
      Unterhaltungen
    </h2>
  );

  // Sidebar footer content
  const footerContent = (
    <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
      {conversations.length} Unterhaltung{conversations.length !== 1 ? 'en' : ''}
    </span>
  );

  return (
    <Sidebar
      width={SIDEBAR_WIDTH}
      isCollapsed={isCollapsed}
      onToggleCollapse={onToggleCollapse}
      header={headerContent}
      footer={footerContent}
      ariaLabel="Unterhaltungen Sidebar"
    >
      {/* Conversation List */}
      {sortedConversations.length === 0 ? (
        <div
          className={`px-3 py-8 text-center text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}
        >
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
                  ${isActive
                    ? 'bg-primary/20 text-white'
                    : isDark
                      ? 'text-gray-300 hover:bg-white/5 hover:text-white'
                      : 'text-gray-700 hover:bg-black/5 hover:text-gray-900'
                  }
                `}
              >
                {/* Confirmation Dialog */}
                {isConfirming ? (
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}
                    >
                      Löschen?
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={(e) => handleConfirmDelete(e, conversation.id)}
                        className="px-2 py-1 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded transition-colors"
                      >
                        Ja
                      </button>
                      <button
                        onClick={handleCancelDelete}
                        className={`
                          px-2 py-1 text-xs rounded transition-colors
                          ${isDark
                            ? 'text-gray-400 hover:text-white hover:bg-white/10'
                            : 'text-gray-500 hover:text-gray-900 hover:bg-black/10'
                          }
                        `}
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
                          isActive
                            ? 'text-primary'
                            : isDark
                              ? 'text-gray-500'
                              : 'text-gray-400'
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {conversation.title}
                        </p>
                        <p
                          className={`text-xs mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}
                        >
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
                          ${isActive
                            ? 'text-gray-400 hover:text-red-400 hover:bg-red-500/20'
                            : isDark
                              ? 'text-gray-500 hover:text-red-400 hover:bg-red-500/20'
                              : 'text-gray-400 hover:text-red-500 hover:bg-red-500/10'
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
    </Sidebar>
  );
}
