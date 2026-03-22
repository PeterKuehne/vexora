/**
 * SkillSidebar - Skill list grouped by scope (Meine/Team/Schwarm)
 */

import { useState } from 'react';
import { useSkill, type Skill } from '../contexts/SkillContext';
import { useTheme } from '../contexts/ThemeContext';
import { SkillCard } from './SkillCard';
import {
  Zap,
  Loader2,
  ChevronDown,
  ChevronRight,
  User,
  Users,
  Globe,
} from 'lucide-react';
import { cn } from '../utils';

interface SkillGroup {
  key: string;
  label: string;
  icon: React.ElementType;
  skills: Skill[];
}

export function SkillSidebar() {
  const { skills, activeSkillId, setActiveSkillId, isLoading } = useSkill();
  const { isDark } = useTheme();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggleGroup = (key: string) => {
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Group skills by scope
  const groups: SkillGroup[] = [
    {
      key: 'personal',
      label: 'Meine Skills',
      icon: User,
      skills: skills.filter(s => s.scope === 'personal'),
    },
    {
      key: 'team',
      label: 'Team-Skills',
      icon: Users,
      skills: skills.filter(s => s.scope === 'team'),
    },
    {
      key: 'swarm',
      label: 'Schwarm-Skills',
      icon: Globe,
      skills: skills.filter(s => s.scope === 'swarm' || s.isBuiltin),
    },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className={cn(
        'shrink-0 p-3 border-b',
        isDark ? 'border-white/[0.06]' : 'border-gray-200'
      )}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap size={16} className={isDark ? 'text-white/60' : 'text-gray-500'} />
            <span className={cn('text-sm font-medium', isDark ? 'text-white/80' : 'text-gray-700')}>
              Skills
            </span>
          </div>
          <span className={cn('text-xs', isDark ? 'text-white/30' : 'text-gray-400')}>
            {skills.length}
          </span>
        </div>
      </div>

      {/* Skill List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && skills.length === 0 ? (
          <div className={cn('flex items-center justify-center py-8', isDark ? 'text-white/30' : 'text-gray-400')}>
            <Loader2 size={16} className="animate-spin mr-2" />
            <span className="text-sm">Lade Skills...</span>
          </div>
        ) : skills.length === 0 ? (
          <div className={cn('text-center py-8 px-4', isDark ? 'text-white/30' : 'text-gray-400')}>
            <Zap size={24} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">Noch keine Skills</p>
            <p className="text-xs mt-1">Skills werden automatisch aus der Schwarm-Bibliothek geladen</p>
          </div>
        ) : (
          <div className="py-1">
            {groups.map(group => {
              if (group.skills.length === 0) return null;
              const isCollapsed = collapsed[group.key];
              const GroupIcon = group.icon;

              return (
                <div key={group.key}>
                  {/* Group header */}
                  <button
                    onClick={() => toggleGroup(group.key)}
                    className={cn(
                      'w-full flex items-center gap-2 px-3 py-2 text-xs font-medium transition-colors',
                      isDark ? 'text-white/40 hover:text-white/60' : 'text-gray-400 hover:text-gray-600'
                    )}
                  >
                    {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                    <GroupIcon size={12} />
                    <span>{group.label}</span>
                    <span className={cn('ml-auto', isDark ? 'text-white/20' : 'text-gray-300')}>
                      {group.skills.length}
                    </span>
                  </button>

                  {/* Group items */}
                  {!isCollapsed && group.skills.map(skill => (
                    <SkillCard
                      key={skill.id}
                      skill={skill}
                      isActive={activeSkillId === skill.id}
                      onClick={() => setActiveSkillId(activeSkillId === skill.id ? null : skill.id)}
                      compact
                    />
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
