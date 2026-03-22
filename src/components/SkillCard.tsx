/**
 * SkillCard - Compact skill card with metrics, vote buttons, and execute button
 */

import { useTheme } from '../contexts/ThemeContext';
import type { Skill } from '../contexts/SkillContext';
import {
  Zap,
  ThumbsUp,
  ThumbsDown,
  Share2,
  Users,
  Globe,
  User,
  Shield,
} from 'lucide-react';
import { cn } from '../utils';

const SCOPE_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; darkColor: string }> = {
  personal: { label: 'Persönlich', icon: User, color: 'text-blue-600', darkColor: 'text-blue-400' },
  team: { label: 'Team', icon: Users, color: 'text-amber-600', darkColor: 'text-amber-400' },
  swarm: { label: 'Schwarm', icon: Globe, color: 'text-green-600', darkColor: 'text-green-400' },
};

interface SkillCardProps {
  skill: Skill;
  isActive?: boolean;
  onClick?: () => void;
  onVote?: (vote: -1 | 1) => void;
  onShare?: () => void;
  compact?: boolean;
}

export function SkillCard({
  skill,
  isActive,
  onClick,
  onVote,
  onShare,
  compact = false,
}: SkillCardProps) {
  const { isDark } = useTheme();
  const scopeConfig = SCOPE_CONFIG[skill.scope] || SCOPE_CONFIG.personal;
  const ScopeIcon = scopeConfig.icon;

  if (compact) {
    // Compact variant for sidebar list
    return (
      <button
        onClick={onClick}
        className={cn(
          'w-full text-left px-3 py-2.5 transition-colors',
          isActive
            ? isDark ? 'bg-white/[0.08]' : 'bg-gray-100'
            : isDark ? 'hover:bg-white/[0.04]' : 'hover:bg-gray-50'
        )}
      >
        <div className="flex items-start gap-2">
          <Zap
            size={14}
            className={cn('mt-0.5 shrink-0', isDark ? scopeConfig.darkColor : scopeConfig.color)}
          />
          <div className="flex-1 min-w-0">
            <p className={cn('text-sm truncate', isDark ? 'text-white/80' : 'text-gray-800')}>
              {skill.name}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              {skill.category && (
                <span className={cn(
                  'text-xs px-1.5 py-0.5 rounded',
                  isDark ? 'bg-white/[0.06] text-white/40' : 'bg-gray-100 text-gray-400'
                )}>
                  {skill.category}
                </span>
              )}
              <span className={cn('text-xs', isDark ? 'text-white/20' : 'text-gray-300')}>
                {skill.executionCount}x
              </span>
            </div>
          </div>
        </div>
      </button>
    );
  }

  // Full card variant for grid
  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-lg border p-4 cursor-pointer transition-all',
        isDark
          ? 'border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.12]'
          : 'border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <Zap size={16} className={isDark ? scopeConfig.darkColor : scopeConfig.color} />
          <h3 className={cn('text-sm font-medium', isDark ? 'text-white/90' : 'text-gray-900')}>
            {skill.name}
          </h3>
        </div>
        <div className="flex items-center gap-1">
          <ScopeIcon size={12} className={isDark ? scopeConfig.darkColor : scopeConfig.color} />
          <span className={cn('text-xs', isDark ? scopeConfig.darkColor : scopeConfig.color)}>
            {scopeConfig.label}
          </span>
          {skill.isVerified && (
            <Shield size={12} className={isDark ? 'text-green-400' : 'text-green-600'} />
          )}
        </div>
      </div>

      {/* Description */}
      {skill.description && (
        <p className={cn('text-xs mb-3 line-clamp-2', isDark ? 'text-white/50' : 'text-gray-500')}>
          {skill.description}
        </p>
      )}

      {/* Category + Tags */}
      <div className="flex flex-wrap gap-1 mb-3">
        {skill.category && (
          <span className={cn(
            'text-xs px-1.5 py-0.5 rounded',
            isDark ? 'bg-white/[0.06] text-white/50' : 'bg-gray-100 text-gray-500'
          )}>
            {skill.category}
          </span>
        )}
        {skill.tags.slice(0, 3).map(tag => (
          <span
            key={tag}
            className={cn(
              'text-xs px-1.5 py-0.5 rounded',
              isDark ? 'bg-white/[0.04] text-white/30' : 'bg-gray-50 text-gray-400'
            )}
          >
            {tag}
          </span>
        ))}
      </div>

      {/* Metrics */}
      <div className={cn('flex items-center gap-3 text-xs mb-3', isDark ? 'text-white/30' : 'text-gray-400')}>
        <span>{skill.executionCount} Ausführungen</span>
        <span>{skill.definition.tools.length} Tools</span>
        {skill.avgDurationMs > 0 && (
          <span>~{Math.round(skill.avgDurationMs / 1000)}s</span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={(e) => { e.stopPropagation(); onVote?.(1); }}
          className={cn(
            'flex items-center gap-1 text-xs px-1.5 py-0.5 rounded transition-colors',
            isDark ? 'hover:bg-white/[0.08] text-white/40' : 'hover:bg-gray-100 text-gray-400'
          )}
        >
          <ThumbsUp size={12} />
          <span>{skill.upvotes}</span>
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onVote?.(-1); }}
          className={cn(
            'flex items-center gap-1 text-xs px-1.5 py-0.5 rounded transition-colors',
            isDark ? 'hover:bg-white/[0.08] text-white/40' : 'hover:bg-gray-100 text-gray-400'
          )}
        >
          <ThumbsDown size={12} />
          <span>{skill.downvotes}</span>
        </button>
        {skill.scope === 'personal' && onShare && (
          <button
            onClick={(e) => { e.stopPropagation(); onShare(); }}
            className={cn(
              'flex items-center gap-1 text-xs px-1.5 py-0.5 rounded transition-colors',
              isDark ? 'hover:bg-white/[0.08] text-white/40' : 'hover:bg-gray-100 text-gray-400'
            )}
            title="Mit Team teilen"
          >
            <Share2 size={12} />
          </button>
        )}
      </div>
    </div>
  );
}
