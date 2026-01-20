/**
 * MainSidebar - Combined sidebar with tab navigation
 *
 * Features:
 * - Tab navigation between Conversations and Documents
 * - Persistent tab state
 * - Consistent layout and sizing
 */

import { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
// import { Sidebar } from './layout'; // Not needed as we use custom layout
import { SidebarTabs, type SidebarTab } from './SidebarTabs';
import { ConversationSidebar } from './ConversationSidebar';
import { DocumentSidebar } from './DocumentSidebar';

/** Sidebar width in pixels - consistent with both sub-sidebars */
const SIDEBAR_WIDTH = 280;

interface MainSidebarProps {
  /** Whether sidebar is collapsed (for mobile) */
  isCollapsed?: boolean;
  /** Callback when collapse state changes */
  onToggleCollapse?: () => void;
}

export function MainSidebar({
  isCollapsed = false,
  onToggleCollapse,
}: MainSidebarProps) {
  const { isDark } = useTheme();
  const [activeTab, setActiveTab] = useState<SidebarTab>('conversations');

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
        onTabChange={setActiveTab}
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

        {activeTab === 'documents' && (
          <div className="h-full">
            {/* Use the existing DocumentSidebar content without its own header/footer */}
            <DocumentSidebar
              isCollapsed={false}
            />
          </div>
        )}
      </div>
    </aside>
  );
}