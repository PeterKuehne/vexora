/**
 * CommandCenter — Intelligent home view replacing the empty chat state
 *
 * Shows: Briefing (LLM text) + Action Cards (from Heartbeat) + Chat Input.
 * Quick Actions on cards start chat conversations via onAction callback.
 */

import { useState, useEffect, useRef } from 'react';
import { Activity, Bot, Clock, MessageSquare } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../utils';
import { Markdown } from './Markdown';
import { ActionCard } from './ActionCard';
import { fetchHomeData, type CommandCenterHome } from '../lib/command-center-api';

interface CommandCenterProps {
  onAction: (prompt: string) => void;
}

export function CommandCenter({ onAction }: CommandCenterProps) {
  const { isDark } = useTheme();
  const { user } = useAuth();
  const [homeData, setHomeData] = useState<CommandCenterHome | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const fetched = useRef(false);

  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;

    setIsLoading(true);
    fetchHomeData()
      .then(data => setHomeData(data))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const greeting = getGreeting();
  const userName = user?.name?.split(' ')[0] || user?.email?.split('@')[0] || 'User';

  // Loading
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className={cn('flex flex-col items-center gap-3', isDark ? 'text-white/30' : 'text-gray-400')}>
          <Activity size={24} className="animate-pulse" />
          <span className="text-sm">Lade Command Center...</span>
        </div>
      </div>
    );
  }

  const hasCards = homeData && homeData.cards.length > 0;
  const hasBriefing = homeData?.briefing?.text;
  const hasRecentTasks = homeData && homeData.recentTasks.length > 0;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-6 py-8">

        {/* Greeting */}
        <h1 className={cn('text-2xl font-bold mb-1', isDark ? 'text-white' : 'text-gray-900')}>
          {greeting}, {userName}.
        </h1>
        <p className={cn('text-sm mb-6', isDark ? 'text-white/30' : 'text-gray-400')}>
          {hasBriefing || hasCards
            ? 'Hier ist dein Ueberblick fuer heute.'
            : 'Alles im gruenen Bereich — keine neuen Meldungen.'
          }
        </p>

        {/* Briefing */}
        {hasBriefing && (
          <div className={cn(
            'rounded-xl border p-5 mb-6',
            isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-white border-gray-200'
          )}>
            <div className="flex items-center gap-2 mb-3">
              <Activity size={16} className={isDark ? 'text-emerald-400' : 'text-emerald-600'} />
              <span className={cn('text-xs font-bold uppercase tracking-wider', isDark ? 'text-emerald-400' : 'text-emerald-600')}>
                Briefing
              </span>
            </div>
            <div className={cn('prose prose-sm max-w-none', isDark ? 'prose-invert' : '')}>
              <Markdown content={homeData!.briefing!.text} />
            </div>
          </div>
        )}

        {/* Action Cards Grid */}
        {hasCards && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {homeData!.cards.map(card => (
              <ActionCard key={card.id} card={card} onAction={onAction} />
            ))}
          </div>
        )}

        {/* Recent Conversations */}
        {hasRecentTasks && (
          <div className="mb-6">
            <h3 className={cn('text-xs font-bold uppercase tracking-wider mb-3', isDark ? 'text-white/30' : 'text-gray-400')}>
              Letzte Konversationen
            </h3>
            <div className="space-y-1">
              {homeData!.recentTasks.slice(0, 3).map(task => (
                <button
                  key={task.id}
                  onClick={() => onAction(task.query)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors',
                    isDark
                      ? 'text-white/50 hover:text-white/80 hover:bg-white/[0.03]'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  )}
                >
                  <MessageSquare size={14} className="shrink-0 opacity-40" />
                  <span className="text-sm truncate">{task.query}</span>
                  <span className={cn('text-[10px] shrink-0 ml-auto', isDark ? 'text-white/20' : 'text-gray-300')}>
                    {formatTimeAgo(task.createdAt)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Empty State (no cards, no briefing) */}
        {!hasCards && !hasBriefing && (
          <div className={cn('text-center py-12', isDark ? 'text-white/20' : 'text-gray-300')}>
            <Bot size={48} className="mx-auto mb-4 opacity-30" />
            <p className={cn('text-base font-medium mb-2', isDark ? 'text-white/40' : 'text-gray-500')}>
              Bereit fuer deine Aufgaben
            </p>
            <p className="text-sm">
              Stelle eine Frage oder nutze die Heartbeat-Engine fuer proaktive Checks.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Guten Morgen';
  if (hour < 18) return 'Guten Tag';
  return 'Guten Abend';
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'gerade';
  if (diffMin < 60) return `${diffMin}m`;
  if (diffHrs < 24) return `${diffHrs}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}
