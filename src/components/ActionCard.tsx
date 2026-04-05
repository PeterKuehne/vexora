/**
 * ActionCard — Generic card for Command Center
 *
 * Displays a heartbeat result as an actionable card with
 * icon, title, summary, priority badge, and quick action buttons.
 * Quick actions trigger chat conversations via startTask().
 */

import { useTheme } from '../contexts/ThemeContext';
import { cn } from '../utils';
import type { ActionCard as ActionCardType } from '../lib/command-center-api';

interface ActionCardProps {
  card: ActionCardType;
  onAction: (prompt: string) => void;
}

const PRIORITY_STYLES = {
  critical: {
    dark: 'border-red-500/20 bg-red-500/[0.03]',
    light: 'border-red-200 bg-red-50/50',
    badge: 'bg-red-500/15 text-red-400',
    dot: 'bg-red-400',
  },
  warning: {
    dark: 'border-amber-500/20 bg-amber-500/[0.03]',
    light: 'border-amber-200 bg-amber-50/50',
    badge: 'bg-amber-500/15 text-amber-400',
    dot: 'bg-amber-400',
  },
  info: {
    dark: 'border-white/[0.06] bg-white/[0.02]',
    light: 'border-gray-200 bg-white',
    badge: isDark => isDark ? 'bg-white/[0.05] text-white/40' : 'bg-gray-100 text-gray-500',
    dot: isDark => isDark ? 'bg-white/30' : 'bg-gray-400',
  },
};

export function ActionCard({ card, onAction }: ActionCardProps) {
  const { isDark } = useTheme();

  const priority = PRIORITY_STYLES[card.priority] || PRIORITY_STYLES.info;
  const borderBg = isDark
    ? (typeof priority.dark === 'string' ? priority.dark : '')
    : (typeof priority.light === 'string' ? priority.light : '');
  const badgeClass = typeof priority.badge === 'function' ? priority.badge(isDark) : priority.badge;
  const dotClass = typeof priority.dot === 'function' ? priority.dot(isDark) : priority.dot;

  return (
    <div className={cn(
      'rounded-xl border p-4 transition-all',
      borderBg,
      isDark ? 'hover:bg-white/[0.04]' : 'hover:shadow-sm'
    )}>
      {/* Header: Icon + Title + Priority */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">{card.icon}</span>
          <h3 className={cn('text-sm font-semibold', isDark ? 'text-white/90' : 'text-gray-900')}>
            {card.title}
          </h3>
        </div>
        <span className={cn(
          'flex items-center gap-1.5 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider',
          badgeClass
        )}>
          <span className={cn('w-1.5 h-1.5 rounded-full', dotClass)} />
          {card.priority}
        </span>
      </div>

      {/* Summary */}
      <p className={cn('text-sm mb-3', isDark ? 'text-white/60' : 'text-gray-600')}>
        {card.summary}
      </p>

      {/* Quick Actions */}
      {card.actions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {card.actions.map((action, i) => (
            <button
              key={i}
              onClick={() => onAction(action.prompt)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                isDark
                  ? 'text-white/50 hover:text-white/80 hover:bg-white/[0.06] border border-white/[0.08]'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-gray-200'
              )}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
