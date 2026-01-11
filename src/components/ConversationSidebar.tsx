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
  const {
    conversations,
    filteredConversations,
    activeConversationId,
    setActiveConversation,
    deleteConversation,
    isLoading,
    isSearchActive,
  } = useConversations();
  const { isDark } = useTheme();

  // Use filtered conversations when search is active, otherwise all conversations
  const displayConversations = isSearchActive ? filteredConversations : conversations;

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
      {isSearchActive && displayConversations.length !== conversations.length
        ? `${displayConversations.length} von ${conversations.length} Unterhaltung${conversations.length !== 1 ? 'en' : ''}`
        : `${conversations.length} Unterhaltung${conversations.length !== 1 ? 'en' : ''}`
      }
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
      {/* Search Bar */}
      <div className="px-3 pb-3 border-b border-white/10">
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
