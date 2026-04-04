/**
 * WorkspaceSidebar - Context-dependent sidebar container (260px)
 *
 * Shows different content based on the active workspace section:
 * - Chat: Conversation list + "Neue Frage" button
 * - Documents: No sidebar (full-width content area)
 * - Tasks/Skills/Knowledge: Placeholder (Phase 2+)
 */

import { type ReactNode } from 'react';
import { useTheme } from '../../contexts';
import type { WorkspaceSection } from './IconRail';

// Sections that use full-width content (no sidebar)
const FULL_WIDTH_SECTIONS: WorkspaceSection[] = ['documents', 'agents', 'heartbeat'];

interface WorkspaceSidebarProps {
  activeSection: WorkspaceSection;
  /** Content for the tasks section sidebar */
  tasksSidebar?: ReactNode;
  /** Content for the skills section sidebar */
  skillsSidebar?: ReactNode;
  /** Whether the sidebar is collapsed */
  isCollapsed?: boolean;
}

export function WorkspaceSidebar({
  activeSection,
  tasksSidebar,
  skillsSidebar,
  isCollapsed = false,
}: WorkspaceSidebarProps) {
  const { isDark } = useTheme();

  // Hide sidebar for full-width sections
  if (isCollapsed || FULL_WIDTH_SECTIONS.includes(activeSection)) return null;

  const renderContent = () => {
    switch (activeSection) {
      case 'tasks':
        return tasksSidebar || null;
      case 'skills':
        return skillsSidebar || null;
      case 'knowledge':
        return (
          <div className="flex items-center justify-center h-full">
            <div className={`text-center px-4 ${isDark ? 'text-white/30' : 'text-gray-400'}`}>
              <p className="text-sm font-medium">Kommt bald</p>
              <p className="text-xs mt-1">Dieses Feature wird in einer kommenden Phase verfuegbar sein.</p>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div
      className={`
        w-[280px] shrink-0 flex flex-col h-full overflow-hidden
        border-r
        ${isDark ? 'border-white/[0.06]' : 'border-gray-200'}
      `}
    >
      {renderContent()}
    </div>
  );
}
