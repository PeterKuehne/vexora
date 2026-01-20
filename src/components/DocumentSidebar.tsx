/**
 * DocumentSidebar - Document Management Sidebar
 *
 * Features:
 * - Document upload area
 * - Document list display
 * - Collapsible layout
 * - Consistent with ConversationSidebar design
 */

import { useTheme } from '../contexts/ThemeContext';
import { useDocuments } from '../contexts/DocumentContext';
import { Sidebar, SidebarDivider } from './layout';
import { DocumentUpload } from './DocumentUpload';
import { DocumentList } from './DocumentList';

/** Sidebar width in pixels - matches design spec */
const SIDEBAR_WIDTH = 280;

interface DocumentSidebarProps {
  /** Whether sidebar is collapsed (for mobile) */
  isCollapsed?: boolean;
  /** Callback when collapse state changes */
  onToggleCollapse?: () => void;
}

export function DocumentSidebar({
  isCollapsed = false,
  onToggleCollapse,
}: DocumentSidebarProps) {
  const { isDark } = useTheme();
  const { totalDocuments } = useDocuments();

  // Sidebar header content
  const headerContent = (
    <h2
      className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}
    >
      Dokumente
    </h2>
  );

  // Sidebar footer content
  const footerContent = totalDocuments > 0 ? (
    <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
      {totalDocuments} Dokument{totalDocuments !== 1 ? 'e' : ''}
    </span>
  ) : null;

  return (
    <Sidebar
      width={SIDEBAR_WIDTH}
      isCollapsed={isCollapsed}
      onToggleCollapse={onToggleCollapse}
      header={headerContent}
      footer={footerContent}
      ariaLabel="Dokumente Sidebar"
    >
      {/* Upload Area */}
      <div className="px-3 pt-3 pb-4">
        <DocumentUpload />
      </div>

      {/* Divider */}
      <SidebarDivider />

      {/* Document List */}
      <div className="px-3 py-2">
        <DocumentList />
      </div>
    </Sidebar>
  );
}