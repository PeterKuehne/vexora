/**
 * MainSidebar - Combined sidebar with tab navigation
 *
 * Features:
 * - Tab navigation between Conversations and RAG/Documents
 * - Controlled or uncontrolled tab state
 * - Consistent layout and sizing
 */

import { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { Plus } from 'lucide-react';
import type { User } from '../../server/src/types/auth';
import { SidebarTabs, type SidebarTab } from './SidebarTabs';
import { ConversationSidebar } from './ConversationSidebar';
import { RAGSidebar } from './RAGSidebar';
import { UserMenu, UserMenuSkeleton } from './UserMenu';

/** Sidebar width in pixels - consistent with both sub-sidebars */
const SIDEBAR_WIDTH = 280;

interface MainSidebarProps {
  /** Whether sidebar is collapsed (for mobile) */
  isCollapsed?: boolean;
  /** Callback when collapse state changes */
  onToggleCollapse?: () => void;
  /** Callback to create a new conversation */
  onNewConversation?: () => void;
  /** Current authenticated user */
  user?: User | null;
  /** Whether auth is loading */
  isAuthLoading?: boolean;
  /** Callback when user logs out */
  onLogout?: () => void;
  /** Controlled active tab (optional - becomes controlled if provided) */
  activeTab?: SidebarTab;
  /** Callback when tab changes (required if activeTab is controlled) */
  onTabChange?: (tab: SidebarTab) => void;
}

export function MainSidebar({
  isCollapsed = false,
  onToggleCollapse,
  onNewConversation,
  user,
  isAuthLoading = false,
  onLogout,
  activeTab: controlledActiveTab,
  onTabChange,
}: MainSidebarProps) {
  const { isDark } = useTheme();

  // Support both controlled and uncontrolled usage
  const [internalActiveTab, setInternalActiveTab] = useState<SidebarTab>('conversations');
  const activeTab = controlledActiveTab ?? internalActiveTab;
  const handleTabChange = (tab: SidebarTab) => {
    if (onTabChange) {
      onTabChange(tab);
    } else {
      setInternalActiveTab(tab);
    }
  };

  // If collapsed, show minimal sidebar
  if (isCollapsed) {
    return (
      <div
        className={`
          w-12 h-full flex flex-col items-center py-3
          border-r transition-colors
          ${isDark ? 'bg-surface border-white/10' : 'bg-gray-50 border-gray-200'}
        `.trim()}
      >
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className={`
              p-2 rounded-lg transition-colors
              ${isDark
                ? 'text-gray-400 hover:text-white hover:bg-white/10'
                : 'text-gray-500 hover:text-gray-900 hover:bg-black/10'
              }
            `.trim()}
            title="Sidebar öffnen"
            aria-label="Sidebar öffnen"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
      </div>
    );
  }

  // Header with tabs
  const headerContent = (
    <div className="w-full">
      <SidebarTabs
        activeTab={activeTab}
        onTabChange={handleTabChange}
      />
    </div>
  );

  return (
    <aside
      className={`
        h-full flex flex-col
        border-r transition-colors
        ${isDark ? 'bg-surface border-white/10' : 'bg-gray-50 border-gray-200'}
      `.trim()}
      style={{ width: `${SIDEBAR_WIDTH}px` }}
      aria-label="Hauptsidebar"
    >
      {/* Header with tabs and collapse button */}
      <div
        className={`
          flex items-center justify-between
          px-3 py-3
          border-b shrink-0
          ${isDark ? 'border-white/10' : 'border-gray-200'}
        `.trim()}
      >
        <div className="flex-1 mr-2">
          {headerContent}
        </div>
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className={`
              p-1.5 rounded transition-colors
              ${isDark
                ? 'text-gray-400 hover:text-white hover:bg-white/10'
                : 'text-gray-500 hover:text-gray-900 hover:bg-black/10'
              }
            `.trim()}
            title="Sidebar schließen"
            aria-label="Sidebar schließen"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
      </div>

      {/* New Conversation Button - only for conversations tab */}
      {activeTab === 'conversations' && onNewConversation && (
        <div className="px-3 py-2.5 shrink-0">
          <button
            onClick={onNewConversation}
            className={`
              group
              w-full
              flex items-center justify-center gap-2
              px-3 py-2
              rounded-lg
              transition-all duration-200
              ${
                isDark
                  ? 'text-gray-400 hover:text-white hover:bg-white/10'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-black/10'
              }
            `.trim()}
            title="Neue Unterhaltung"
            aria-label="Neue Unterhaltung erstellen"
          >
            {/* Animated Plus Icon */}
            <span
              className="
                relative inline-flex items-center justify-center
                transition-transform duration-300 ease-out
                group-hover:scale-110
                group-active:scale-95
              "
            >
              <Plus
                size={18}
                className="
                  transition-all duration-300 ease-out
                  group-hover:rotate-90
                "
              />
            </span>
            <span className="text-sm font-medium">Neue Unterhaltung</span>
          </button>
        </div>
      )}

      {/* Content area - different content based on active tab */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'conversations' && (
          <div className="h-full">
            {/* Use the existing ConversationSidebar content without its own header/footer */}
            <ConversationSidebar
              isCollapsed={false}
            />
          </div>
        )}

        {activeTab === 'rag' && (
          <div className="h-full">
            {/* RAG mode selection */}
            <RAGSidebar
              isCollapsed={false}
            />
          </div>
        )}
      </div>

      {/* Footer with User Menu - entire area is clickable */}
      <div
        className={`
          px-3 py-3
          border-t shrink-0
          transition-colors duration-150
          ${isDark ? 'border-white/10' : 'border-gray-200'}
          ${isDark
            ? 'hover:bg-white/5 active:bg-white/10'
            : 'hover:bg-black/5 active:bg-black/10'
          }
        `.trim()}
      >
        {isAuthLoading ? (
          <UserMenuSkeleton size="md" />
        ) : user && onLogout ? (
          <UserMenu
            user={user}
            onLogout={onLogout}
            showRole={true}
            size="md"
            dropdownDirection="up"
            fullWidth={true}
          />
        ) : null}
      </div>
    </aside>
  );
}