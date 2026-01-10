/**
 * ConversationList Component
 *
 * Displays a list of conversations grouped by date.
 * Features:
 * - Grouping by date (Today, Yesterday, This Week, This Month, Older)
 * - Active conversation highlighting
 * - Click to switch conversation
 * - Delete confirmation
 */

import { useState, useMemo } from 'react';
import { MessageSquare, Trash2 } from 'lucide-react';
import { useTheme } from '../contexts';
import { formatDate } from '../utils';
import type { Conversation } from '../types/conversation';
import { ConversationGroup, type DateGroupType } from './ConversationGroup';

// ============================================
// Types
// ============================================

export interface ConversationListProps {
  /** List of conversations to display */
  conversations: Conversation[];
  /** ID of the currently active conversation */
  activeConversationId: string | null;
  /** Callback when a conversation is clicked */
  onConversationClick: (id: string) => void;
  /** Callback when delete is confirmed */
  onDelete: (id: string) => void;
  /** Whether to group by date */
  groupByDate?: boolean;
  /** Whether groups are collapsible */
  collapsibleGroups?: boolean;
  /** Whether the list is loading */
  isLoading?: boolean;
  /** Empty state message */
  emptyMessage?: string;
}

export interface ConversationItemProps {
  /** The conversation to display */
  conversation: Conversation;
  /** Whether this is the active conversation */
  isActive: boolean;
  /** Callback when clicked */
  onClick: () => void;
  /** Callback when delete is confirmed */
  onDelete: () => void;
}

// ============================================
// Date Grouping Helpers
// ============================================

type DateGroup = DateGroupType;

const DATE_GROUP_LABELS: Record<DateGroup, string> = {
  today: 'Heute',
  yesterday: 'Gestern',
  thisWeek: 'Diese Woche',
  thisMonth: 'Diesen Monat',
  older: 'Älter',
};

function getDateGroup(date: Date): DateGroup {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const monthAgo = new Date(today);
  monthAgo.setMonth(monthAgo.getMonth() - 1);

  const compareDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (compareDate >= today) {
    return 'today';
  } else if (compareDate >= yesterday) {
    return 'yesterday';
  } else if (compareDate >= weekAgo) {
    return 'thisWeek';
  } else if (compareDate >= monthAgo) {
    return 'thisMonth';
  }
  return 'older';
}

function groupConversationsByDate(
  conversations: Conversation[]
): Map<DateGroup, Conversation[]> {
  const groups = new Map<DateGroup, Conversation[]>();

  // Initialize groups in order
  const orderedGroups: DateGroup[] = ['today', 'yesterday', 'thisWeek', 'thisMonth', 'older'];
  orderedGroups.forEach((group) => groups.set(group, []));

  // Sort conversations by date (newest first)
  const sorted = [...conversations].sort(
    (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
  );

  // Group each conversation
  sorted.forEach((conv) => {
    const group = getDateGroup(conv.updatedAt);
    groups.get(group)?.push(conv);
  });

  // Remove empty groups
  orderedGroups.forEach((group) => {
    if (groups.get(group)?.length === 0) {
      groups.delete(group);
    }
  });

  return groups;
}

// ============================================
// ConversationItem Component
// ============================================

export function ConversationItem({
  conversation,
  isActive,
  onClick,
  onDelete,
}: ConversationItemProps) {
  const { isDark } = useTheme();
  const [isHovered, setIsHovered] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsConfirming(true);
  };

  const handleConfirmDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete();
    setIsConfirming(false);
  };

  const handleCancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsConfirming(false);
  };

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        if (!isConfirming) setIsConfirming(false);
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
      role="button"
      tabIndex={0}
      aria-selected={isActive}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {/* Confirmation Dialog */}
      {isConfirming ? (
        <div className="flex items-center justify-between gap-2">
          <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            Löschen?
          </span>
          <div className="flex gap-1">
            <button
              onClick={handleConfirmDelete}
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
              <p className="text-sm font-medium truncate">{conversation.title}</p>
              <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                {conversation.messages.length} Nachrichten
                {' · '}
                {formatDate(conversation.updatedAt)}
              </p>
            </div>
          </div>

          {/* Delete Button (shows on hover) */}
          {(isHovered || isActive) && (
            <button
              onClick={handleDeleteClick}
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
              aria-label="Unterhaltung löschen"
            >
              <Trash2 size={14} />
            </button>
          )}
        </>
      )}
    </div>
  );
}

// ============================================
// ConversationList Component
// ============================================

export function ConversationList({
  conversations,
  activeConversationId,
  onConversationClick,
  onDelete,
  groupByDate = true,
  collapsibleGroups = true,
  emptyMessage = 'Keine Unterhaltungen vorhanden',
}: ConversationListProps) {
  const { isDark } = useTheme();

  // Group conversations by date if enabled
  const groupedConversations = useMemo(() => {
    if (!groupByDate) {
      return null;
    }
    return groupConversationsByDate(conversations);
  }, [conversations, groupByDate]);

  // Flat sorted list for non-grouped mode
  const sortedConversations = useMemo(() => {
    if (groupByDate) {
      return null;
    }
    return [...conversations].sort(
      (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
    );
  }, [conversations, groupByDate]);

  // Empty state
  if (conversations.length === 0) {
    return (
      <div
        className={`px-3 py-8 text-center text-sm ${
          isDark ? 'text-gray-500' : 'text-gray-400'
        }`}
      >
        {emptyMessage}
      </div>
    );
  }

  // Grouped view with collapsible groups
  if (groupByDate && groupedConversations) {
    // When collapsibleGroups is false, we use the static variant
    if (!collapsibleGroups) {
      return (
        <div className="py-2" role="listbox" aria-label="Unterhaltungen">
          {Array.from(groupedConversations.entries()).map(([group, convs]) => (
            <div key={group} className="mb-2">
              {/* Static Group Header with Count */}
              <div
                className={`
                  flex items-center justify-between
                  px-5 py-1.5 text-xs font-medium uppercase tracking-wider
                  ${isDark ? 'text-gray-500' : 'text-gray-400'}
                `}
              >
                <span>{DATE_GROUP_LABELS[group]}</span>
                <span
                  className={`
                    px-1.5 py-0.5 text-[10px] font-semibold rounded-full
                    ${isDark ? 'bg-white/10' : 'bg-black/10'}
                  `}
                >
                  {convs.length}
                </span>
              </div>
              {/* Group Items */}
              {convs.map((conversation) => (
                <ConversationItem
                  key={conversation.id}
                  conversation={conversation}
                  isActive={conversation.id === activeConversationId}
                  onClick={() => onConversationClick(conversation.id)}
                  onDelete={() => onDelete(conversation.id)}
                />
              ))}
            </div>
          ))}
        </div>
      );
    }

    // Collapsible groups (default)
    return (
      <div className="py-2" role="listbox" aria-label="Unterhaltungen">
        {Array.from(groupedConversations.entries()).map(([group, convs]) => (
          <ConversationGroup
            key={group}
            groupType={group}
            label={DATE_GROUP_LABELS[group]}
            count={convs.length}
            defaultCollapsed={false}
          >
            {convs.map((conversation) => (
              <ConversationItem
                key={conversation.id}
                conversation={conversation}
                isActive={conversation.id === activeConversationId}
                onClick={() => onConversationClick(conversation.id)}
                onDelete={() => onDelete(conversation.id)}
              />
            ))}
          </ConversationGroup>
        ))}
      </div>
    );
  }

  // Flat view
  return (
    <div className="py-2" role="listbox" aria-label="Unterhaltungen">
      {sortedConversations?.map((conversation) => (
        <ConversationItem
          key={conversation.id}
          conversation={conversation}
          isActive={conversation.id === activeConversationId}
          onClick={() => onConversationClick(conversation.id)}
          onDelete={() => onDelete(conversation.id)}
        />
      ))}
    </div>
  );
}
