/**
 * SkillDetail - Skill management and browsing view
 *
 * Skills are used BY the agent (via list_skills + execute_skill tools).
 * This view is for browsing, voting, sharing, and managing skills.
 *
 * No skill selected: Grid of all visible skills
 * Skill selected: Detail view with definition, metrics, votes
 */

import { useSkill } from '../contexts/SkillContext';
import { useTheme } from '../contexts/ThemeContext';
import { SkillCard } from './SkillCard';
import { Markdown } from './Markdown';
import {
  Zap,
  ChevronLeft,
  ThumbsUp,
  ThumbsDown,
  Share2,
  Shield,
  Users,
  Globe,
  User,
  Trash2,
  Bot,
} from 'lucide-react';
import { cn } from '../utils';
import { useMemo } from 'react';

export function SkillDetail() {
  const {
    skills,
    activeSkillId,
    setActiveSkillId,
    voteSkill,
    shareSkill,
    deleteSkill,
  } = useSkill();
  const { isDark } = useTheme();

  const activeSkill = useMemo(
    () => skills.find(s => s.id === activeSkillId) || null,
    [skills, activeSkillId]
  );

  // ── Grid View (no skill selected) ──
  if (!activeSkill) {
    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className={cn(
          'shrink-0 flex items-center px-4 py-3 border-b',
          isDark ? 'border-white/[0.06]' : 'border-gray-200'
        )}>
          <Zap size={16} className={isDark ? 'text-white/60' : 'text-gray-500'} />
          <span className={cn('ml-2 text-sm', isDark ? 'text-white/60' : 'text-gray-500')}>
            Skill-Bibliothek
          </span>
          <span className={cn('ml-2 text-xs', isDark ? 'text-white/30' : 'text-gray-400')}>
            {skills.length} Skills
          </span>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Agent usage hint */}
          <div className={cn(
            'flex items-start gap-3 rounded-lg border p-3 mb-4',
            isDark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-gray-200 bg-gray-50'
          )}>
            <Bot size={16} className={cn('mt-0.5 shrink-0', isDark ? 'text-blue-400' : 'text-blue-600')} />
            <div>
              <p className={cn('text-sm', isDark ? 'text-white/70' : 'text-gray-700')}>
                Skills werden vom <strong>Agenten</strong> automatisch genutzt.
              </p>
              <p className={cn('text-xs mt-0.5', isDark ? 'text-white/40' : 'text-gray-500')}>
                Starte einen Agent Task — der Agent erkennt passende Skills und führt sie aus. Hier kannst du Skills verwalten, bewerten und teilen.
              </p>
            </div>
          </div>

          {skills.length === 0 ? (
            <div className={cn('flex flex-col items-center justify-center h-64', isDark ? 'text-white/30' : 'text-gray-400')}>
              <Zap size={40} className="mb-3 opacity-30" />
              <p className="text-sm font-medium">Keine Skills verfügbar</p>
              <p className="text-xs mt-1">Skills werden automatisch aus der Schwarm-Bibliothek geladen.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {skills.map(skill => (
                <SkillCard
                  key={skill.id}
                  skill={skill}
                  onClick={() => setActiveSkillId(skill.id)}
                  onVote={(vote) => voteSkill(skill.id, vote)}
                  onShare={skill.scope === 'personal' ? () => shareSkill(skill.id) : undefined}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Detail View (skill selected) ──
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className={cn(
        'shrink-0 flex items-center justify-between px-4 py-3 border-b',
        isDark ? 'border-white/[0.06]' : 'border-gray-200'
      )}>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSkillId(null)}
            className={cn(
              'p-1 rounded-md transition-colors',
              isDark ? 'text-white/50 hover:text-white/80 hover:bg-white/[0.05]' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
            )}
          >
            <ChevronLeft size={18} />
          </button>
          <Zap size={16} className={isDark ? 'text-amber-400' : 'text-amber-600'} />
          <span className={cn('text-sm font-medium', isDark ? 'text-white/90' : 'text-gray-900')}>
            {activeSkill.name}
          </span>
          {activeSkill.isVerified && (
            <Shield size={14} className={isDark ? 'text-green-400' : 'text-green-600'} />
          )}
        </div>
        <div className="flex items-center gap-2">
          {activeSkill.scope === 'personal' && !activeSkill.isBuiltin && (
            <button
              onClick={() => deleteSkill(activeSkill.id)}
              className={cn(
                'p-1.5 rounded-md transition-colors',
                isDark ? 'text-white/30 hover:text-red-400 hover:bg-white/[0.05]' : 'text-gray-400 hover:text-red-600 hover:bg-gray-100'
              )}
              title="Skill löschen"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Agent usage hint */}
        <div className={cn(
          'flex items-start gap-3 rounded-lg border p-3',
          isDark ? 'border-blue-500/20 bg-blue-500/5' : 'border-blue-200 bg-blue-50'
        )}>
          <Bot size={16} className={cn('mt-0.5 shrink-0', isDark ? 'text-blue-400' : 'text-blue-600')} />
          <div>
            <p className={cn('text-sm', isDark ? 'text-white/70' : 'text-gray-700')}>
              Der Agent nutzt diesen Skill automatisch, wenn dein Task dazu passt.
            </p>
            <p className={cn('text-xs mt-0.5', isDark ? 'text-white/40' : 'text-gray-500')}>
              Slug: <code className={cn('px-1 py-0.5 rounded', isDark ? 'bg-white/[0.06]' : 'bg-gray-100')}>{activeSkill.slug}</code>
            </p>
          </div>
        </div>

        {/* Description */}
        {activeSkill.description && (
          <div>
            <h3 className={cn('text-xs font-medium uppercase tracking-wider mb-2', isDark ? 'text-white/40' : 'text-gray-400')}>
              Beschreibung
            </h3>
            <p className={cn('text-sm', isDark ? 'text-white/70' : 'text-gray-600')}>
              {activeSkill.description}
            </p>
          </div>
        )}

        {/* Scope & Category */}
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn(
            'flex items-center gap-1 text-xs px-2 py-1 rounded-md',
            isDark ? 'bg-white/[0.06] text-white/50' : 'bg-gray-100 text-gray-500'
          )}>
            {activeSkill.scope === 'personal' && <User size={10} />}
            {activeSkill.scope === 'team' && <Users size={10} />}
            {activeSkill.scope === 'swarm' && <Globe size={10} />}
            {activeSkill.scope === 'personal' ? 'Persönlich' : activeSkill.scope === 'team' ? 'Team' : 'Schwarm'}
          </span>
          {activeSkill.category && (
            <span className={cn(
              'text-xs px-2 py-1 rounded-md',
              isDark ? 'bg-white/[0.06] text-white/50' : 'bg-gray-100 text-gray-500'
            )}>
              {activeSkill.category}
            </span>
          )}
          {activeSkill.tags.map(tag => (
            <span key={tag} className={cn(
              'text-xs px-2 py-1 rounded-md',
              isDark ? 'bg-white/[0.04] text-white/30' : 'bg-gray-50 text-gray-400'
            )}>
              {tag}
            </span>
          ))}
        </div>

        {/* Metrics */}
        <div>
          <h3 className={cn('text-xs font-medium uppercase tracking-wider mb-2', isDark ? 'text-white/40' : 'text-gray-400')}>
            Metriken
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Ausführungen', value: activeSkill.executionCount },
              { label: 'Tools', value: activeSkill.definition.tools.length },
              { label: 'Ø Dauer', value: activeSkill.avgDurationMs > 0 ? `${Math.round(activeSkill.avgDurationMs / 1000)}s` : '-' },
              { label: 'Adoption', value: activeSkill.adoptionCount },
            ].map(metric => (
              <div key={metric.label} className={cn(
                'rounded-lg border px-3 py-2',
                isDark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-gray-200 bg-gray-50'
              )}>
                <div className={cn('text-xs', isDark ? 'text-white/40' : 'text-gray-400')}>{metric.label}</div>
                <div className={cn('text-sm font-medium mt-0.5', isDark ? 'text-white/80' : 'text-gray-800')}>{metric.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Votes */}
        <div>
          <h3 className={cn('text-xs font-medium uppercase tracking-wider mb-2', isDark ? 'text-white/40' : 'text-gray-400')}>
            Bewertung
          </h3>
          <div className="flex items-center gap-4">
            <button
              onClick={() => voteSkill(activeSkill.id, 1)}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-md border transition-colors',
                isDark ? 'border-white/[0.08] hover:bg-white/[0.05] text-white/60' : 'border-gray-200 hover:bg-gray-50 text-gray-500'
              )}
            >
              <ThumbsUp size={16} />
              <span className="text-sm font-medium">{activeSkill.upvotes}</span>
            </button>
            <button
              onClick={() => voteSkill(activeSkill.id, -1)}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-md border transition-colors',
                isDark ? 'border-white/[0.08] hover:bg-white/[0.05] text-white/60' : 'border-gray-200 hover:bg-gray-50 text-gray-500'
              )}
            >
              <ThumbsDown size={16} />
              <span className="text-sm font-medium">{activeSkill.downvotes}</span>
            </button>
            {activeSkill.scope === 'personal' && (
              <button
                onClick={() => shareSkill(activeSkill.id)}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-md border transition-colors',
                  isDark ? 'border-white/[0.08] hover:bg-white/[0.05] text-white/60' : 'border-gray-200 hover:bg-gray-50 text-gray-500'
                )}
              >
                <Share2 size={16} />
                <span className="text-sm">Teilen</span>
              </button>
            )}
          </div>
        </div>

        {/* Tools */}
        {activeSkill.definition.tools.length > 0 && (
          <div>
            <h3 className={cn('text-xs font-medium uppercase tracking-wider mb-2', isDark ? 'text-white/40' : 'text-gray-400')}>
              Empfohlene Tools
            </h3>
            <div className="flex flex-wrap gap-1">
              {activeSkill.definition.tools.map(t => (
                <span key={t} className={cn(
                  'text-xs px-2 py-1 rounded-md',
                  isDark ? 'bg-white/[0.06] text-white/50' : 'bg-gray-100 text-gray-500'
                )}>
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Markdown Instructions */}
        <div>
          <h3 className={cn('text-xs font-medium uppercase tracking-wider mb-2', isDark ? 'text-white/40' : 'text-gray-400')}>
            Instruktionen
          </h3>
          <div className={cn(
            'rounded-lg border p-4 text-sm',
            isDark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-gray-200 bg-gray-50'
          )}>
            <Markdown content={activeSkill.definition.content} />
          </div>
        </div>
      </div>
    </div>
  );
}
