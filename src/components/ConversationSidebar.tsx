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

import { useConversations } from '../contexts';
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
  const {
    conversations,
    filteredConversations,
    activeConversationId,
    setActiveConversation,
    deleteConversation,
    isLoading,
    isSearchActive,
  } = useConversations();

  // Use filtered conversations when search is active, otherwise all conversations
  const displayConversations = isSearchActive ? filteredConversations : conversations;

  // Sidebar header content - removed, now in MainSidebar
  const headerContent = null;

  // Sidebar footer content - removed, now in MainSidebar
  const footerContent = null;

  return (
    <Sidebar
      width={SIDEBAR_WIDTH}
      isCollapsed={isCollapsed}
      onToggleCollapse={onToggleCollapse}
      header={headerContent}
      footer={footerContent}
      ariaLabel="Unterhaltungen Sidebar"
    >
      {/* Search Bar */}
      <div className="px-3 pb-3">
        <ConversationSearchBar
          showResultCount={false}
          showClearAll={true}
        />
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="py-2 px-2">
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
