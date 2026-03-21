/**
 * AgentTaskSidebar - Task list with status badges
 *
 * Shows all agent tasks, grouped by status, with live updates.
 */

import { useAgent, type AgentTaskStatus } from '../contexts/AgentContext';
import { useTheme } from '../contexts/ThemeContext';
import { Bot, CheckCircle2, XCircle, Loader2, Ban, Clock } from 'lucide-react';

const STATUS_CONFIG: Record<AgentTaskStatus, {
  label: string;
  icon: React.ElementType;
  color: string;
  darkColor: string;
}> = {
  pending: { label: 'Wartend', icon: Clock, color: 'text-yellow-600', darkColor: 'text-yellow-400' },
  running: { label: 'Aktiv', icon: Loader2, color: 'text-blue-600', darkColor: 'text-blue-400' },
  completed: { label: 'Fertig', icon: CheckCircle2, color: 'text-green-600', darkColor: 'text-green-400' },
  failed: { label: 'Fehler', icon: XCircle, color: 'text-red-600', darkColor: 'text-red-400' },
  cancelled: { label: 'Abgebrochen', icon: Ban, color: 'text-gray-500', darkColor: 'text-gray-400' },
};

export function AgentTaskSidebar() {
  const { tasks, activeTaskId, setActiveTaskId, startTask, isLoading } = useAgent();
  const { isDark } = useTheme();

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);

    if (diffMin < 1) return 'Gerade eben';
    if (diffMin < 60) return `vor ${diffMin}m`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `vor ${diffH}h`;
    return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className={`
        shrink-0 p-3 border-b
        ${isDark ? 'border-white/[0.06]' : 'border-gray-200'}
      `}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot size={16} className={isDark ? 'text-white/60' : 'text-gray-500'} />
            <span className={`text-sm font-medium ${isDark ? 'text-white/80' : 'text-gray-700'}`}>
              Agent Tasks
            </span>
          </div>
          <span className={`text-xs ${isDark ? 'text-white/30' : 'text-gray-400'}`}>
            {tasks.length}
          </span>
        </div>
      </div>

      {/* Task List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && tasks.length === 0 ? (
          <div className={`flex items-center justify-center py-8 ${isDark ? 'text-white/30' : 'text-gray-400'}`}>
            <Loader2 size={16} className="animate-spin mr-2" />
            <span className="text-sm">Lade Tasks...</span>
          </div>
        ) : tasks.length === 0 ? (
          <div className={`text-center py-8 px-4 ${isDark ? 'text-white/30' : 'text-gray-400'}`}>
            <Bot size={24} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">Noch keine Agent Tasks</p>
            <p className="text-xs mt-1">Starte einen Task im Chat mit dem Agent-Modus</p>
          </div>
        ) : (
          <div className="py-1">
            {tasks.map(task => {
              const config = STATUS_CONFIG[task.status];
              const Icon = config.icon;
              const isActive = activeTaskId === task.id;

              return (
                <button
                  key={task.id}
                  onClick={() => setActiveTaskId(isActive ? null : task.id)}
                  className={`
                    w-full text-left px-3 py-2.5 transition-colors
                    ${isActive
                      ? isDark ? 'bg-white/[0.08]' : 'bg-gray-100'
                      : isDark ? 'hover:bg-white/[0.04]' : 'hover:bg-gray-50'
                    }
                  `}
                >
                  <div className="flex items-start gap-2">
                    <Icon
                      size={14}
                      className={`mt-0.5 shrink-0 ${isDark ? config.darkColor : config.color} ${
                        task.status === 'running' ? 'animate-spin' : ''
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm truncate ${isDark ? 'text-white/80' : 'text-gray-800'}`}>
                        {task.query.substring(0, 80)}{task.query.length > 80 ? '...' : ''}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-xs ${isDark ? config.darkColor : config.color}`}>
                          {config.label}
                        </span>
                        {task.totalSteps > 0 && (
                          <span className={`text-xs ${isDark ? 'text-white/20' : 'text-gray-300'}`}>
                            {task.totalSteps} Schritte
                          </span>
                        )}
                        <span className={`text-xs ${isDark ? 'text-white/20' : 'text-gray-300'}`}>
                          {formatTime(task.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
