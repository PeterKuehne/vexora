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
    isLoading,
  } = useConversations();
  const { isDark } = useTheme();

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
      {/* Loading State */}
      {isLoading ? (
        <div className="py-2 px-2">
          <SkeletonConversationList count={5} />
        </div>
      ) : (
        /* Conversation List with Date Grouping */
        <ConversationList
          conversations={conversations}
          activeConversationId={activeConversationId}
          onConversationClick={setActiveConversation}
          onDelete={deleteConversation}
          groupByDate={true}
          emptyMessage="Keine Unterhaltungen vorhanden"
        />
      )}
    </Sidebar>
  );
}
