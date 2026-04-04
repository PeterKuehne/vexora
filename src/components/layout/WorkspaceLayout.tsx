/**
 * WorkspaceLayout - 3-column workspace shell
 *
 * Layout: IconRail (48px) + WorkspaceSidebar (260px) + Content (rest)
 * Replaces the previous AppShell + SidebarTabs + MainSidebar combination.
 */

import { type ReactNode, useState, useCallback } from 'react';
import { useTheme } from '../../contexts';
import { IconRail, type WorkspaceSection } from './IconRail';
import { WorkspaceSidebar } from './WorkspaceSidebar';

export interface WorkspaceLayoutProps {
  /** Content for the tasks sidebar (agent task list) */
  tasksSidebar?: ReactNode;
  /** Content for the skills sidebar (skill list) */
  skillsSidebar?: ReactNode;
  /** Main content area */
  children: ReactNode | ((activeSection: WorkspaceSection) => ReactNode);
  /** Settings click handler */
  onSettingsClick?: () => void;
  /** User display name */
  userName?: string;
  /** Logout handler */
  onLogout?: () => void;
  /** Default active section */
  defaultSection?: WorkspaceSection;
  /** Callback when section changes */
  onSectionChange?: (section: WorkspaceSection) => void;
}

export function WorkspaceLayout({
  tasksSidebar,
  skillsSidebar,
  children,
  onSettingsClick,
  userName,
  onLogout,
  defaultSection = 'tasks',
  onSectionChange,
}: WorkspaceLayoutProps) {
  const { isDark } = useTheme();
  const [activeSection, setActiveSection] = useState<WorkspaceSection>(() => {
    const saved = localStorage.getItem('cor7ex-active-section');
    if (saved && ['tasks', 'skills', 'documents', 'agents', 'heartbeat', 'knowledge'].includes(saved)) {
      return saved as WorkspaceSection;
    }
    return defaultSection;
  });
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const handleSectionChange = useCallback((section: WorkspaceSection) => {
    setActiveSection(section);
    localStorage.setItem('cor7ex-active-section', section);
    onSectionChange?.(section);
    // Uncollapse sidebar when switching sections
    if (isSidebarCollapsed) {
      setIsSidebarCollapsed(false);
    }
  }, [isSidebarCollapsed, onSectionChange]);

  const handleSettingsClick = useCallback(() => {
    onSettingsClick?.();
  }, [onSettingsClick]);

  return (
    <div
      className={`
        h-screen flex overflow-hidden
        ${isDark ? 'bg-background text-white' : 'bg-white text-gray-900'}
      `}
    >
      {/* Column 1: Icon Rail (48px) */}
      <IconRail
        activeSection={activeSection}
        onSectionChange={handleSectionChange}
        onSettingsClick={handleSettingsClick}
        userName={userName}
        onLogout={onLogout}
      />

      {/* Column 2: Context Sidebar (260px) */}
      <WorkspaceSidebar
        activeSection={activeSection}
        tasksSidebar={tasksSidebar}
        skillsSidebar={skillsSidebar}
        isCollapsed={isSidebarCollapsed}
      />

      {/* Column 3: Main Content (rest) */}
      <main className="flex-1 overflow-hidden flex flex-col">
        {typeof children === 'function' ? children(activeSection) : children}
      </main>
    </div>
  );
}
