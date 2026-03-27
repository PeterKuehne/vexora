/**
 * AgentTaskSidebar - Task list with date groups and context menu
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useAgent, type AgentTask } from '../contexts/AgentContext';
import { useTheme } from '../contexts/ThemeContext';
import {
  Loader2,
  Plus,
  Trash2,
} from 'lucide-react';
import { cn } from '../utils';

// ── Date grouping ──

type DateGroup = 'today' | 'yesterday' | 'week' | 'older';

const DATE_GROUP_LABELS: Record<DateGroup, string> = {
  today: 'Heute',
  yesterday: 'Gestern',
  week: 'Letzte 7 Tage',
  older: 'Älter',
};

function getDateGroup(dateStr: string): DateGroup {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  if (date >= today) return 'today';
  if (date >= yesterday) return 'yesterday';
  if (date >= weekAgo) return 'week';
  return 'older';
}

function groupTasksByDate(tasks: AgentTask[]): Array<{ group: DateGroup; tasks: AgentTask[] }> {
  const groups: Partial<Record<DateGroup, AgentTask[]>> = {};

  for (const task of tasks) {
    const g = getDateGroup(task.createdAt);
    (groups[g] ||= []).push(task);
  }

  const order: DateGroup[] = ['today', 'yesterday', 'week', 'older'];
  return order
    .filter(g => groups[g] && groups[g]!.length > 0)
    .map(g => ({ group: g, tasks: groups[g]! }));
}

// ── Context Menu ──

function ContextMenu({
  x, y, onDelete, onClose, isDark,
}: {
  x: number; y: number;
  onDelete: () => void;
  onClose: () => void;
  isDark: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      style={{ top: y, left: x }}
      className={cn(
        'fixed z-50 py-1 rounded-lg shadow-lg border min-w-[160px]',
        isDark ? 'bg-[#1a1a1b] border-white/10' : 'bg-white border-gray-200'
      )}
    >
      <button
        onClick={onDelete}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-1.5 text-sm',
          isDark
            ? 'text-red-400 hover:bg-white/[0.05]'
            : 'text-red-500 hover:bg-red-50'
        )}
      >
        <Trash2 size={14} />
        Löschen
      </button>
    </div>
  );
}

// ── Delete Confirmation ──

function DeleteConfirmation({
  message, onConfirm, onCancel, isDark,
}: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDark: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className={cn(
        'rounded-xl p-5 shadow-xl max-w-sm mx-4',
        isDark ? 'bg-[#1a1a1b]' : 'bg-white'
      )}>
        <p className={cn('text-sm mb-4', isDark ? 'text-white/80' : 'text-gray-700')}>
          {message}
        </p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className={cn(
              'px-3 py-1.5 text-sm rounded-lg',
              isDark ? 'text-white/60 hover:bg-white/[0.05]' : 'text-gray-500 hover:bg-gray-100'
            )}
          >
            Abbrechen
          </button>
          <button
            onClick={onConfirm}
            className="px-3 py-1.5 text-sm rounded-lg bg-red-500 text-white hover:bg-red-600"
          >
            Löschen
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Task Item ──

function TaskItem({
  task, isActive, isDark, onSelect, onContextMenu,
}: {
  task: AgentTask;
  isActive: boolean;
  isDark: boolean;
  onSelect: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      onClick={onSelect}
      onContextMenu={onContextMenu}
      className={cn(
        'w-full text-left px-3 py-2.5 transition-colors',
        isActive
          ? isDark ? 'bg-white/[0.08]' : 'bg-gray-100'
          : isDark ? 'hover:bg-white/[0.04]' : 'hover:bg-gray-50'
      )}
    >
      <p className={cn('text-sm truncate', isDark ? 'text-white/80' : 'text-gray-800')}>
        {task.query.substring(0, 80)}{task.query.length > 80 ? '...' : ''}
      </p>
    </button>
  );
}

// ── Main Sidebar ──

export function AgentTaskSidebar() {
  const { tasks, activeTaskId, setActiveTaskId, deleteTask, isLoading } = useAgent();
  const { isDark } = useTheme();

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; taskId: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ taskId: string } | null>(null);

  const handleContextMenu = useCallback((e: React.MouseEvent, taskId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, taskId });
  }, []);

  const handleDelete = useCallback(() => {
    if (contextMenu) {
      setDeleteConfirm({ taskId: contextMenu.taskId });
      setContextMenu(null);
    }
  }, [contextMenu]);

  const confirmDelete = useCallback(async () => {
    if (deleteConfirm) {
      await deleteTask(deleteConfirm.taskId);
      setDeleteConfirm(null);
    }
  }, [deleteConfirm, deleteTask]);

  const grouped = groupTasksByDate(tasks);

  return (
    <div className="flex flex-col h-full">
      {/* New Task Button */}
      <div className={cn(
        'shrink-0 border-b',
        isDark ? 'border-white/[0.06]' : 'border-gray-200'
      )}>
        <button
          onClick={() => setActiveTaskId(null)}
          className={cn(
            'w-full flex items-center gap-2 px-3 py-3 text-sm font-medium transition-colors',
            isDark
              ? 'text-white/60 hover:text-white/80 hover:bg-white/[0.04]'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          )}
        >
          <Plus size={16} />
          Neu
        </button>
      </div>

      {/* Task List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && tasks.length === 0 ? (
          <div className={cn('flex items-center justify-center py-8', isDark ? 'text-white/30' : 'text-gray-400')}>
            <Loader2 size={16} className="animate-spin mr-2" />
            <span className="text-sm">Lade Aufgaben...</span>
          </div>
        ) : tasks.length === 0 ? (
          <div className={cn('text-center py-8 px-4', isDark ? 'text-white/30' : 'text-gray-400')}>
            <p className="text-sm">Noch keine Aufgaben</p>
            <p className="text-xs mt-1">Starte eine neue Aufgabe mit dem Eingabefeld</p>
          </div>
        ) : (
          <div className="py-1">
            {grouped.map(({ group, tasks: groupTasks }) => (
              <div key={group}>
                {/* Group Header */}
                <div className={cn(
                  'px-3 pt-3 pb-1',
                  isDark ? 'text-white/25' : 'text-gray-400'
                )}>
                  <span className="text-[11px] font-medium uppercase tracking-wider">
                    {DATE_GROUP_LABELS[group]}
                  </span>
                </div>

                {/* Tasks */}
                {groupTasks.map(task => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    isActive={activeTaskId === task.id}
                    isDark={isDark}
                    onSelect={() => setActiveTaskId(activeTaskId === task.id ? null : task.id)}
                    onContextMenu={(e) => handleContextMenu(e, task.id)}
                  />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          isDark={isDark}
          onDelete={handleDelete}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <DeleteConfirmation
          message="Diese Aufgabe und alle zugehörigen Daten werden unwiderruflich gelöscht."
          isDark={isDark}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  );
}
