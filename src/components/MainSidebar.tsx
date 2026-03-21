/**
 * MainSidebar - Combined sidebar with tab navigation
 *
 * Features:
 * - Tab navigation between Conversations and RAG/Documents
 * - Refined Monochrome design with inverted CTA
 * - Consistent layout and sizing
 */

import { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { Plus, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
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
          ${isDark ? 'bg-background border-white/[0.06]' : 'bg-gray-50 border-gray-200'}
        `.trim()}
      >
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className={`
              p-2 rounded-xl transition-colors
              ${isDark
                ? 'text-gray-500 hover:text-white hover:bg-white/[0.06]'
                : 'text-gray-400 hover:text-gray-900 hover:bg-black/5'
              }
            `.trim()}
            title="Sidebar öffnen"
            aria-label="Sidebar öffnen"
          >
            <PanelLeftOpen size={18} />
          </button>
        )}
      </div>
    );
  }

  return (
    <aside
      className={`
        h-full flex flex-col
        border-r transition-colors
        ${isDark ? 'bg-background border-white/[0.06]' : 'bg-gray-50 border-gray-200'}
      `.trim()}
      style={{ width: `${SIDEBAR_WIDTH}px` }}
      aria-label="Hauptsidebar"
    >
      {/* Header with tabs and collapse button */}
      <div
        className={`
          animate-stagger-1
          flex items-center gap-2
          px-3 py-3
          border-b shrink-0
          ${isDark ? 'border-white/[0.06]' : 'border-gray-200/80'}
        `.trim()}
      >
        <div className="flex-1 min-w-0">
          <SidebarTabs
            activeTab={activeTab}
            onTabChange={handleTabChange}
          />
        </div>
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className={`
              p-1.5 rounded-lg transition-colors shrink-0
              ${isDark
                ? 'text-gray-600 hover:text-gray-400 hover:bg-white/[0.04]'
                : 'text-gray-400 hover:text-gray-600 hover:bg-black/5'
              }
            `.trim()}
            title="Sidebar schließen"
            aria-label="Sidebar schließen"
          >
            <PanelLeftClose size={16} />
          </button>
        )}
      </div>

      {/* New Conversation Button - only for conversations tab */}
      {activeTab === 'conversations' && onNewConversation && (
        <div className="animate-stagger-2 px-3 py-2.5 shrink-0">
          <button
            onClick={onNewConversation}
            className={`
              group
              w-full
              flex items-center justify-center gap-2
              px-3 py-2
              rounded-xl
              text-[13px] font-semibold
              transition-all duration-200
              ${isDark
                ? 'bg-white text-gray-900 hover:bg-gray-100 shadow-lg shadow-white/5'
                : 'bg-gray-900 text-white hover:bg-gray-800 shadow-lg shadow-gray-900/20'
              }
            `.trim()}
            title="Neue Unterhaltung"
            aria-label="Neue Unterhaltung erstellen"
          >
            <Plus
              size={16}
              className="transition-transform duration-300 ease-out group-hover:rotate-90"
            />
            <span>Neue Unterhaltung</span>
          </button>
        </div>
      )}

      {/* Content area - different content based on active tab */}
      <div className="animate-stagger-3 flex-1 overflow-hidden">
        {activeTab === 'conversations' && (
          <div className="h-full">
            <ConversationSidebar
              isCollapsed={false}
            />
          </div>
        )}

        {activeTab === 'rag' && (
          <div className="h-full">
            <RAGSidebar
              isCollapsed={false}
            />
          </div>
        )}
      </div>

      {/* Footer with User Menu */}
      <div
        className={`
          animate-stagger-5
          px-3 py-3
          border-t shrink-0
          transition-colors duration-150
          ${isDark ? 'border-white/[0.06]' : 'border-gray-200/80'}
          ${isDark
            ? 'hover:bg-white/[0.02]'
            : 'hover:bg-black/[0.02]'
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
