/**
 * AppShell - Main Application Layout Component
 * Provides the base layout structure with Header, Sidebar, and Main area
 * Uses CSS Flexbox for responsive layout with breakpoints
 */

import { type ReactNode, useState, useCallback } from 'react';
import { Menu } from 'lucide-react';
import { useTheme } from '../../contexts';

/** Sidebar controls passed to header render function */
export interface SidebarControls {
  toggle: () => void;
  isCollapsed: boolean;
  hasSidebar: boolean;
}

export interface AppShellProps {
  /** Complete header component or render function receiving sidebar controls */
  header?: ReactNode | ((controls: SidebarControls) => ReactNode);
  /** Header content (right side) - deprecated, use header prop */
  headerContent?: ReactNode;
  /** Header left content (logo, title) - deprecated, use header prop */
  headerLeft?: ReactNode;
  /** Sidebar content */
  sidebar?: ReactNode;
  /** Main content area */
  children: ReactNode;
  /** Initial sidebar collapsed state */
  defaultSidebarCollapsed?: boolean;
  /** Callback when sidebar collapse state changes */
  onSidebarToggle?: (collapsed: boolean) => void;
  /** Show mobile menu button (only used with headerLeft/headerContent) */
  showMobileMenu?: boolean;
  /** Custom CSS class for the shell */
  className?: string;
}

export function AppShell({
  header,
  headerContent,
  headerLeft,
  sidebar,
  children,
  defaultSidebarCollapsed = false,
  onSidebarToggle,
  showMobileMenu = true,
  className = '',
}: AppShellProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(defaultSidebarCollapsed);
  const { isDark } = useTheme();

  const handleToggleSidebar = useCallback(() => {
    const newState = !isSidebarCollapsed;
    setIsSidebarCollapsed(newState);
    onSidebarToggle?.(newState);
  }, [isSidebarCollapsed, onSidebarToggle]);

  // Expose toggle function and state for Header component
  const sidebarControls = {
    toggle: handleToggleSidebar,
    isCollapsed: isSidebarCollapsed,
    hasSidebar: !!sidebar,
  };

  return (
    <div
      className={`
        h-screen flex flex-col
        ${isDark ? 'bg-background text-white' : 'bg-white text-gray-900'}
        ${className}
      `.trim()}
    >
      {/* Header - Either custom header component/render function or legacy headerLeft/headerContent */}
      {header ? (
        typeof header === 'function' ? header(sidebarControls) : header
      ) : (
        <header
          className={`
            flex items-center justify-between
            px-4 py-3
            border-b
            shrink-0
            ${isDark ? 'border-white/10' : 'border-gray-200'}
          `.trim()}
        >
          {/* Left Section: Mobile Menu + Logo/Title */}
          <div className="flex items-center gap-3">
            {/* Mobile Menu Button - visible on mobile/tablet */}
            {showMobileMenu && sidebar && (
              <button
                onClick={handleToggleSidebar}
                className={`
                  p-1.5 rounded-lg transition-colors
                  lg:hidden
                  ${isDark
                    ? 'text-gray-400 hover:text-white hover:bg-white/10'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-black/10'
                  }
                `.trim()}
                title="Sidebar umschalten"
                aria-label="Toggle sidebar"
                aria-expanded={!isSidebarCollapsed}
              >
                <Menu size={20} />
              </button>
            )}

            {/* Header Left Content (Logo, Title, Actions) */}
            {headerLeft}
          </div>

          {/* Right Section: Status, Settings, etc. */}
          <div className="flex items-center gap-4">
            {headerContent}
          </div>
        </header>
      )}

      {/* Main Layout: Sidebar + Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar Container */}
        {sidebar && (
          <aside
            className={`
              shrink-0
              transition-all duration-200 ease-in-out
              ${isSidebarCollapsed ? 'hidden' : 'flex'}
              lg:flex
            `.trim()}
            aria-label="Sidebar"
          >
            {sidebar}
          </aside>
        )}

        {/* Main Content Area */}
        <main className="flex-1 overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}

/**
 * AppShellHeader - Header section for additional content
 * Use this to structure header content consistently
 */
export interface AppShellHeaderSectionProps {
  children: ReactNode;
  className?: string;
}

export function AppShellHeaderSection({ children, className = '' }: AppShellHeaderSectionProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {children}
    </div>
  );
}

/**
 * AppShellSidebar - Sidebar container with consistent styling
 */
export interface AppShellSidebarProps {
  children: ReactNode;
  /** Width in Tailwind units (default: w-72 = 288px) */
  width?: string;
  className?: string;
}

export function AppShellSidebar({
  children,
  width = 'w-72',
  className = '',
}: AppShellSidebarProps) {
  const { isDark } = useTheme();

  return (
    <div
      className={`
        ${width}
        h-full
        flex flex-col
        border-r
        ${isDark ? 'border-white/10 bg-surface' : 'border-gray-200 bg-gray-50'}
        ${className}
      `.trim()}
    >
      {children}
    </div>
  );
}

/**
 * AppShellContent - Main content area wrapper
 */
export interface AppShellContentProps {
  children: ReactNode;
  /** Center content vertically and horizontally */
  centered?: boolean;
  /** Add padding */
  padded?: boolean;
  className?: string;
}

export function AppShellContent({
  children,
  centered = false,
  padded = false,
  className = '',
}: AppShellContentProps) {
  return (
    <div
      className={`
        h-full overflow-auto
        ${centered ? 'flex items-center justify-center' : ''}
        ${padded ? 'p-4 md:p-6 lg:p-8' : ''}
        ${className}
      `.trim()}
    >
      {children}
    </div>
  );
}
