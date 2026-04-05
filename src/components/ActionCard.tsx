/**
 * ActionCard — Generic card for Command Center
 *
 * Displays a heartbeat result with:
 * - Icon, title, priority badge
 * - Summary + expandable detail data
 * - Quick action buttons that start chat conversations
 */

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { cn } from '../utils';
import type { ActionCard as ActionCardType } from '../lib/command-center-api';

interface ActionCardProps {
  card: ActionCardType;
  onAction: (prompt: string) => void;
}

export function ActionCard({ card, onAction }: ActionCardProps) {
  const { isDark } = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);

  const priorityColors = {
    critical: { border: isDark ? 'border-red-500/20 bg-red-500/[0.03]' : 'border-red-200 bg-red-50/50', badge: 'bg-red-500/15 text-red-400', dot: 'bg-red-400' },
    warning: { border: isDark ? 'border-amber-500/20 bg-amber-500/[0.03]' : 'border-amber-200 bg-amber-50/50', badge: 'bg-amber-500/15 text-amber-400', dot: 'bg-amber-400' },
    info: { border: isDark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-gray-200 bg-white', badge: isDark ? 'bg-white/[0.05] text-white/40' : 'bg-gray-100 text-gray-500', dot: isDark ? 'bg-white/30' : 'bg-gray-400' },
  };

  const colors = priorityColors[card.priority] || priorityColors.info;

  // Format detail data for display
  const detailRows = formatDetails(card.details);
  const hasDetails = detailRows.length > 0;

  return (
    <div className={cn('rounded-xl border p-4 transition-all', colors.border, isDark ? 'hover:bg-white/[0.04]' : 'hover:shadow-sm')}>
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">{card.icon}</span>
          <h3 className={cn('text-sm font-semibold', isDark ? 'text-white/90' : 'text-gray-900')}>{card.title}</h3>
        </div>
        <span className={cn('flex items-center gap-1.5 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider', colors.badge)}>
          <span className={cn('w-1.5 h-1.5 rounded-full', colors.dot)} />
          {card.priority}
        </span>
      </div>

      {/* Summary */}
      <p className={cn('text-sm', isDark ? 'text-white/60' : 'text-gray-600')}>{card.summary}</p>

      {/* Expandable Details */}
      {hasDetails && (
        <div className="mt-3">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={cn('flex items-center gap-1 text-xs font-medium transition-colors', isDark ? 'text-white/30 hover:text-white/60' : 'text-gray-400 hover:text-gray-600')}
          >
            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {isExpanded ? 'Weniger' : `${detailRows.length} Eintraege anzeigen`}
          </button>

          {isExpanded && (
            <div className={cn('mt-2 rounded-lg p-3 space-y-1.5 text-xs max-h-48 overflow-y-auto', isDark ? 'bg-black/20' : 'bg-gray-50')}>
              {detailRows.map((row, i) => (
                <div key={i} className={cn('flex items-center justify-between gap-4', isDark ? 'text-white/50' : 'text-gray-600')}>
                  <span className="truncate">{row.label}</span>
                  <span className={cn('shrink-0 font-medium', isDark ? 'text-white/70' : 'text-gray-800')}>{row.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Quick Actions */}
      {card.actions.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
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

// ─── Format details data into displayable rows ──

interface DetailRow {
  label: string;
  value: string;
}

function formatDetails(data: unknown): DetailRow[] {
  if (!data) return [];

  // Array of objects (e.g. list of invoices, assignments)
  if (Array.isArray(data)) {
    return data.slice(0, 10).map((item, i) => {
      if (typeof item === 'object' && item !== null) {
        const obj = item as Record<string, unknown>;
        // Try to build a meaningful label from common fields
        const label = obj.moveNumber || obj.assignmentId || obj.contractNumber || obj.employeeId || obj.name || `#${i + 1}`;
        const parts: string[] = [];
        if (obj.totalGross) parts.push(`${obj.totalGross} EUR`);
        if (obj.dueDate) parts.push(`faellig ${new Date(String(obj.dueDate)).toLocaleDateString('de-DE')}`);
        if (obj.paymentState) parts.push(String(obj.paymentState));
        if (obj.status) parts.push(String(obj.status));
        if (obj.customerName) parts.push(String(obj.customerName));
        if (obj.customer && typeof obj.customer === 'object') {
          const cust = obj.customer as Record<string, unknown>;
          if (cust.name) parts.push(String(cust.name));
        }
        return { label: String(label), value: parts.join(' · ') || 'Vorhanden' };
      }
      return { label: `#${i + 1}`, value: String(item) };
    });
  }

  // Single object (e.g. agedReceivable summary)
  if (typeof data === 'object' && data !== null) {
    return Object.entries(data as Record<string, unknown>).slice(0, 8).map(([key, val]) => ({
      label: key,
      value: String(val),
    }));
  }

  return [];
}
