/**
 * ExpertAgentCard — Card component for Expert Agent overview
 *
 * Design based on Screenshot 2:
 * - Large character avatar (top half)
 * - Status badge (AKTIV/INAKTIV)
 * - Name + subtitle
 * - Tool count with module icon
 * - Role badges
 * - "Konfigurations-Panel" link
 */

import { Bot, Wrench, Settings } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { cn } from '../utils';
import type { ExpertAgentRecord } from '../lib/expert-agents-api';

interface ExpertAgentCardProps {
  agent: ExpertAgentRecord;
  onClick?: () => void;
}

// Avatar placeholder colors per agent name
const AVATAR_COLORS: Record<string, string> = {
  'hr-expert': 'from-blue-600/30 to-cyan-600/20',
  'accounting-expert': 'from-emerald-600/30 to-teal-600/20',
  'knowledge-expert': 'from-purple-600/30 to-indigo-600/20',
};

const AVATAR_ICONS: Record<string, string> = {
  'hr-expert': 'PERSONNEL & OPS',
  'accounting-expert': 'FINANCE & LEDGER',
  'knowledge-expert': 'NEURAL DATABASE',
};

function getAvatarGradient(name: string): string {
  return AVATAR_COLORS[name] || 'from-gray-600/30 to-slate-600/20';
}

function getSubtitle(name: string): string {
  return AVATAR_ICONS[name] || 'EXPERT AGENT';
}

export function ExpertAgentCard({ agent, onClick }: ExpertAgentCardProps) {
  const { isDark } = useTheme();

  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-2xl overflow-hidden cursor-pointer group',
        'transition-all duration-200',
        isDark
          ? 'bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.04]'
          : 'bg-white border border-gray-200 hover:border-gray-300 hover:shadow-lg'
      )}
    >
      {/* Avatar Section */}
      <div className={cn(
        'relative h-52 flex items-center justify-center overflow-hidden',
        `bg-gradient-to-b ${getAvatarGradient(agent.name)}`
      )}>
        {/* Status Badge */}
        <div className={cn(
          'absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider',
          agent.isActive
            ? 'bg-emerald-500/20 text-emerald-400'
            : 'bg-red-500/20 text-red-400'
        )}>
          <span className={cn(
            'w-1.5 h-1.5 rounded-full',
            agent.isActive ? 'bg-emerald-400' : 'bg-red-400'
          )} />
          {agent.isActive ? 'Aktiv' : 'Inaktiv'}
        </div>

        {/* Avatar */}
        {agent.avatarUrl ? (
          <img src={agent.avatarUrl} alt={agent.name} className="w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Bot size={64} strokeWidth={1} className={isDark ? 'text-white/30' : 'text-gray-400'} />
          </div>
        )}

        {/* Name Overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60 to-transparent">
          <h3 className="text-lg font-bold text-white">{agent.name}</h3>
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/60">
            {getSubtitle(agent.name)}
          </p>
        </div>
      </div>

      {/* Info Section */}
      <div className="p-4 space-y-4">
        {/* Module / Tool Count */}
        <div className="flex items-center justify-between">
          <div>
            <p className={cn('text-[10px] uppercase tracking-wider font-medium', isDark ? 'text-white/30' : 'text-gray-400')}>
              Module
            </p>
            <p className={cn('text-sm font-semibold', isDark ? 'text-white' : 'text-gray-900')}>
              {agent.tools.length} Aktive Tools
            </p>
          </div>
          <div className={cn(
            'w-9 h-9 rounded-lg flex items-center justify-center',
            isDark ? 'bg-white/[0.05]' : 'bg-gray-100'
          )}>
            <Wrench size={16} className={isDark ? 'text-blue-400' : 'text-blue-600'} />
          </div>
        </div>

        {/* Role Badges */}
        <div className="flex flex-wrap gap-1.5">
          {agent.roles.length === 0 ? (
            <span className={cn(
              'px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider',
              isDark ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            )}>
              Public Access
            </span>
          ) : (
            agent.roles.map(role => (
              <span key={role} className={cn(
                'px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider',
                role === 'Admin'
                  ? isDark ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-blue-50 text-blue-700 border border-blue-200'
                  : isDark ? 'bg-white/[0.05] text-white/50 border border-white/[0.08]' : 'bg-gray-100 text-gray-600 border border-gray-200'
              )}>
                {role}
              </span>
            ))
          )}
        </div>

        {/* Config Panel Link */}
        <button
          onClick={(e) => { e.stopPropagation(); onClick?.(); }}
          className={cn(
            'w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium uppercase tracking-wider',
            'transition-colors duration-150',
            isDark
              ? 'text-white/40 hover:text-white/60 hover:bg-white/[0.03] border border-white/[0.06]'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50 border border-gray-200'
          )}
        >
          <Settings size={12} />
          Konfigurations-Panel
        </button>
      </div>
    </div>
  );
}
