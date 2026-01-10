/**
 * Sidebar - Reusable Sidebar Layout Component
 *
 * A generic sidebar component with:
 * - Configurable width (default: 280px)
 * - Scrollable content area
 * - Collapsible state with animation
 * - Header, content, and footer sections
 * - Theme-aware styling
 */

import { type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTheme } from '../../contexts';

export interface SidebarProps {
  /** Sidebar header content */
  header?: ReactNode;
  /** Main scrollable content */
  children: ReactNode;
  /** Footer content (fixed at bottom) */
  footer?: ReactNode;
  /** Width in pixels (default: 280) */
  width?: number;
  /** Whether sidebar is collapsed */
  isCollapsed?: boolean;
  /** Callback when collapse toggle is clicked */
  onToggleCollapse?: (() => void) | undefined;
  /** Show collapse toggle button */
  showCollapseToggle?: boolean;
  /** Custom CSS class */
  className?: string;
  /** Aria label for accessibility */
  ariaLabel?: string;
}

/**
 * Collapsed sidebar - minimal width with toggle button
 */
function CollapsedSidebar({
  onToggleCollapse,
  isDark,
}: {
  onToggleCollapse: (() => void) | undefined;
  isDark: boolean;
}) {
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
          <ChevronRight size={20} />
        </button>
      )}
    </div>
  );
}

export function Sidebar({
  header,
  children,
  footer,
  width = 280,
  isCollapsed = false,
  onToggleCollapse,
  showCollapseToggle = true,
  className = '',
  ariaLabel = 'Sidebar',
}: SidebarProps) {
  const { isDark } = useTheme();

  // Collapsed state - minimal sidebar with expand button
  if (isCollapsed) {
    return (
      <CollapsedSidebar onToggleCollapse={onToggleCollapse} isDark={isDark} />
    );
  }

  return (
    <aside
      className={`
        h-full flex flex-col
        border-r transition-colors
        ${isDark ? 'bg-surface border-white/10' : 'bg-gray-50 border-gray-200'}
        ${className}
      `.trim()}
      style={{ width: `${width}px` }}
      aria-label={ariaLabel}
    >
      {/* Sidebar Header */}
      {(header || showCollapseToggle) && (
        <div
          className={`
            flex items-center justify-between
            px-3 py-3
            border-b shrink-0
            ${isDark ? 'border-white/10' : 'border-gray-200'}
          `.trim()}
        >
          <div className="flex-1">{header}</div>
          {showCollapseToggle && onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className={`
                p-1.5 rounded transition-colors ml-2
                ${isDark
                  ? 'text-gray-400 hover:text-white hover:bg-white/10'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-black/10'
                }
              `.trim()}
              title="Sidebar schließen"
              aria-label="Sidebar schließen"
            >
              <ChevronLeft size={18} />
            </button>
          )}
        </div>
      )}

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {children}
      </div>

      {/* Footer (fixed at bottom) */}
      {footer && (
        <div
          className={`
            px-3 py-2
            border-t shrink-0
            ${isDark ? 'border-white/10' : 'border-gray-200'}
          `.trim()}
        >
          {footer}
        </div>
      )}
    </aside>
  );
}

/**
 * SidebarSection - Groups related sidebar content
 */
export interface SidebarSectionProps {
  /** Section title */
  title?: string;
  /** Section content */
  children: ReactNode;
  /** Additional CSS classes */
  className?: string;
}

export function SidebarSection({
  title,
  children,
  className = '',
}: SidebarSectionProps) {
  const { isDark } = useTheme();

  return (
    <div className={`py-2 ${className}`}>
      {title && (
        <h3
          className={`
            px-3 py-1.5 text-xs font-medium uppercase tracking-wider
            ${isDark ? 'text-gray-500' : 'text-gray-400'}
          `.trim()}
        >
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}

/**
 * SidebarItem - Individual clickable item in sidebar
 */
export interface SidebarItemProps {
  /** Item icon */
  icon?: ReactNode;
  /** Item label */
  label: string;
  /** Secondary text (smaller, below label) */
  secondary?: string;
  /** Whether item is active/selected */
  isActive?: boolean;
  /** Click handler */
  onClick?: () => void;
  /** Right-side action element */
  action?: ReactNode;
  /** Additional CSS classes */
  className?: string;
}

export function SidebarItem({
  icon,
  label,
  secondary,
  isActive = false,
  onClick,
  action,
  className = '',
}: SidebarItemProps) {
  const { isDark } = useTheme();

  return (
    <div
      onClick={onClick}
      className={`
        group relative mx-2 mb-1 px-3 py-2.5 rounded-lg
        cursor-pointer transition-colors duration-150
        ${isActive
          ? 'bg-primary/20 text-white'
          : isDark
            ? 'text-gray-300 hover:bg-white/5 hover:text-white'
            : 'text-gray-700 hover:bg-black/5 hover:text-gray-900'
        }
        ${className}
      `.trim()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
    >
      <div className="flex items-start gap-2.5">
        {icon && (
          <span
            className={`
              mt-0.5 flex-shrink-0
              ${isActive
                ? 'text-primary'
                : isDark
                  ? 'text-gray-500'
                  : 'text-gray-400'
              }
            `.trim()}
          >
            {icon}
          </span>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{label}</p>
          {secondary && (
            <p
              className={`
                text-xs mt-0.5
                ${isDark ? 'text-gray-500' : 'text-gray-400'}
              `.trim()}
            >
              {secondary}
            </p>
          )}
        </div>
      </div>
      {action && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2">
          {action}
        </div>
      )}
    </div>
  );
}

/**
 * SidebarDivider - Visual separator between sections
 */
export function SidebarDivider() {
  const { isDark } = useTheme();

  return (
    <hr
      className={`
        mx-3 my-2
        ${isDark ? 'border-white/10' : 'border-gray-200'}
      `.trim()}
    />
  );
}
