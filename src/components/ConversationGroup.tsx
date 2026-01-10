/**
 * ConversationGroup Component
 *
 * A collapsible group container for conversations.
 * Features:
 * - Collapsible header with chevron animation
 * - Count badge showing number of conversations
 * - Smooth expand/collapse animation
 * - Keyboard accessible
 */

import { useState, useCallback, type ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useTheme } from '../contexts';

// ============================================
// Types
// ============================================

export type DateGroupType = 'today' | 'yesterday' | 'thisWeek' | 'thisMonth' | 'older';

export interface ConversationGroupProps {
  /** The group type/key */
  groupType: DateGroupType;
  /** The display label for the group */
  label: string;
  /** Number of items in this group */
  count: number;
  /** Whether the group is initially collapsed */
  defaultCollapsed?: boolean;
  /** Whether the group is controlled collapsed state */
  isCollapsed?: boolean;
  /** Callback when collapse state changes */
  onCollapsedChange?: (collapsed: boolean) => void;
  /** The conversation items to render */
  children: ReactNode;
  /** Additional class names */
  className?: string;
}

export interface ConversationGroupHeaderProps {
  /** The display label */
  label: string;
  /** Number of items in this group */
  count: number;
  /** Whether the group is collapsed */
  isCollapsed: boolean;
  /** Callback to toggle collapse */
  onToggle: () => void;
}

// ============================================
// Group Header Component
// ============================================

export function ConversationGroupHeader({
  label,
  count,
  isCollapsed,
  onToggle,
}: ConversationGroupHeaderProps) {
  const { isDark } = useTheme();

  return (
    <button
      onClick={onToggle}
      className={`
        w-full flex items-center justify-between
        px-4 py-2 text-xs font-medium uppercase tracking-wider
        transition-colors duration-150
        ${isDark
          ? 'text-gray-400 hover:text-gray-300 hover:bg-white/5'
          : 'text-gray-500 hover:text-gray-700 hover:bg-black/5'
        }
      `}
      aria-expanded={!isCollapsed}
      aria-label={`${label} (${count} Unterhaltungen), ${isCollapsed ? 'eingeklappt' : 'ausgeklappt'}`}
    >
      <div className="flex items-center gap-2">
        {/* Chevron Icon with rotation animation */}
        <span
          className={`
            transition-transform duration-200
            ${isCollapsed ? '' : 'rotate-90'}
          `}
        >
          <ChevronRight size={14} />
        </span>
        <span>{label}</span>
      </div>

      {/* Count Badge */}
      <span
        className={`
          px-1.5 py-0.5 text-[10px] font-semibold rounded-full
          ${isDark
            ? 'bg-white/10 text-gray-400'
            : 'bg-black/10 text-gray-500'
          }
        `}
      >
        {count}
      </span>
    </button>
  );
}

// ============================================
// Group Content Component (for animation)
// ============================================

interface ConversationGroupContentProps {
  isCollapsed: boolean;
  children: ReactNode;
}

function ConversationGroupContent({
  isCollapsed,
  children,
}: ConversationGroupContentProps) {
  return (
    <div
      className={`
        overflow-hidden transition-all duration-200 ease-in-out
        ${isCollapsed ? 'max-h-0 opacity-0' : 'max-h-[2000px] opacity-100'}
      `}
      aria-hidden={isCollapsed}
    >
      {children}
    </div>
  );
}

// ============================================
// Main ConversationGroup Component
// ============================================

export function ConversationGroup({
  groupType,
  label,
  count,
  defaultCollapsed = false,
  isCollapsed: controlledCollapsed,
  onCollapsedChange,
  children,
  className = '',
}: ConversationGroupProps) {
  // Internal state for uncontrolled mode
  const [internalCollapsed, setInternalCollapsed] = useState(defaultCollapsed);

  // Use controlled or internal state
  const isControlled = controlledCollapsed !== undefined;
  const isCollapsed = isControlled ? controlledCollapsed : internalCollapsed;

  const handleToggle = useCallback(() => {
    if (isControlled && onCollapsedChange) {
      onCollapsedChange(!isCollapsed);
    } else {
      setInternalCollapsed(!internalCollapsed);
    }
  }, [isControlled, isCollapsed, internalCollapsed, onCollapsedChange]);

  return (
    <div
      className={`mb-1 ${className}`}
      data-group-type={groupType}
      role="group"
      aria-label={`${label} Gruppe`}
    >
      <ConversationGroupHeader
        label={label}
        count={count}
        isCollapsed={isCollapsed}
        onToggle={handleToggle}
      />
      <ConversationGroupContent isCollapsed={isCollapsed}>
        {children}
      </ConversationGroupContent>
    </div>
  );
}

// ============================================
// Compact Variant (no animation, just toggle)
// ============================================

export function ConversationGroupCompact({
  label,
  count,
  defaultCollapsed = false,
  children,
}: Omit<ConversationGroupProps, 'groupType' | 'isCollapsed' | 'onCollapsedChange'> & {
  groupType?: DateGroupType;
}) {
  const { isDark } = useTheme();
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  return (
    <div className="mb-1">
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className={`
          w-full flex items-center gap-1.5
          px-4 py-1 text-xs font-medium uppercase tracking-wider
          ${isDark ? 'text-gray-500' : 'text-gray-400'}
        `}
      >
        {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
        <span>{label}</span>
        <span className="ml-auto opacity-60">({count})</span>
      </button>
      {!isCollapsed && children}
    </div>
  );
}

// ============================================
// Static Header (non-collapsible, original style)
// ============================================

export function ConversationGroupStatic({
  label,
  count,
  showCount = true,
  children,
}: {
  label: string;
  count?: number;
  showCount?: boolean;
  children: ReactNode;
}) {
  const { isDark } = useTheme();

  return (
    <div className="mb-2">
      <div
        className={`
          flex items-center justify-between
          px-5 py-1.5 text-xs font-medium uppercase tracking-wider
          ${isDark ? 'text-gray-500' : 'text-gray-400'}
        `}
      >
        <span>{label}</span>
        {showCount && count !== undefined && (
          <span
            className={`
              px-1.5 py-0.5 text-[10px] font-semibold rounded-full
              ${isDark ? 'bg-white/10' : 'bg-black/10'}
            `}
          >
            {count}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

export default ConversationGroup;
