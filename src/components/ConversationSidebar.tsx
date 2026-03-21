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

import { Plus } from 'lucide-react';
import { useConversations } from '../contexts';
import { useTheme } from '../contexts';
import { Sidebar } from './layout';
import { SkeletonConversationList } from './Skeleton';
import { ConversationList } from './ConversationList';
import { ConversationSearchBar } from './ConversationSearch';

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
  const { isDark } = useTheme();
  const {
    conversations,
    filteredConversations,
    activeConversationId,
    setActiveConversation,
    deleteConversation,
    createConversation,
    isLoading,
    isSearchActive,
  } = useConversations();

  // Use filtered conversations when search is active, otherwise all conversations
  const displayConversations = isSearchActive ? filteredConversations : conversations;

  // Header: "Neue Frage" button
  const headerContent = (
    <button
      onClick={() => createConversation()}
      className={`
        w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg
        text-sm font-medium transition-colors
        ${isDark
          ? 'bg-white/[0.06] hover:bg-white/[0.10] text-white/80 hover:text-white border border-white/[0.06]'
          : 'bg-gray-100 hover:bg-gray-200 text-gray-700 hover:text-gray-900 border border-gray-200'
        }
      `}
    >
      <Plus size={16} />
      Neue Frage
    </button>
  );

  return (
    <Sidebar
      width={SIDEBAR_WIDTH}
      isCollapsed={isCollapsed}
      onToggleCollapse={onToggleCollapse}
      header={headerContent}
      showCollapseToggle={false}
      ariaLabel="Unterhaltungen Sidebar"
    >
      {/* Search Bar */}
      <div className="animate-stagger-3 px-3 pb-3">
        <ConversationSearchBar
          showResultCount={false}
          showClearAll={true}
        />
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="animate-stagger-4 py-2 px-2">
          <SkeletonConversationList count={5} />
        </div>
      ) : (
        /* Conversation List with Date Grouping */
        <ConversationList
          conversations={displayConversations}
          activeConversationId={activeConversationId}
          onConversationClick={setActiveConversation}
          onDelete={deleteConversation}
          groupByDate={true}
          emptyMessage={
            isSearchActive
              ? "Keine Unterhaltungen gefunden"
              : "Keine Unterhaltungen vorhanden"
          }
        />
      )}
    </Sidebar>
  );
}
