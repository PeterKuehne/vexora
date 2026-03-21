/**
 * AgentTaskDetail - Tasks workspace inspired by Claude Cowork
 *
 * Linear stream of blocks (like Claude):
 * - Thought blocks (clock icon, gray text)
 * - Tool call blocks (collapsible: name as title, "Ergebnis" badge opens request/result)
 * - Answer blocks (bold markdown text)
 * - "Fertig" checkmark between sections
 *
 * During execution: same blocks appear live with spinners
 */

import { useEffect, useState, useRef, type KeyboardEvent, type FormEvent } from 'react';
import {
  useAgent,
  type AgentStep,
  type AgentTaskStatus,
} from '../contexts/AgentContext';
import { useTheme } from '../contexts/ThemeContext';
import { Markdown } from './Markdown';
import {
  Bot,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Clock,
  X,
  Send,
  Pencil,
} from 'lucide-react';
import { cn } from '../utils';

// ── Tool Call Block (collapsible like Claude) ──
function ToolCallBlock({ step, isDark }: { step: AgentStep; isDark: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const [showRequest, setShowRequest] = useState(false);

  const toolLabel = (step.toolName || 'tool').replace(/_/g, ' ');
  const displayName = toolLabel.charAt(0).toUpperCase() + toolLabel.slice(1);
  const isRunning = step.status === 'tool_running';

  return (
    <div className="my-3">
      {/* Tool name - collapsible header */}
      <button
        onClick={() => !isRunning && setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-1.5 text-sm transition-colors',
          isDark ? 'text-white/45 hover:text-white/65' : 'text-gray-400 hover:text-gray-600'
        )}
      >
        <span>{displayName}</span>
        {isRunning
          ? <Loader2 size={13} className="animate-spin ml-0.5" />
          : isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />
        }
      </button>

      {/* Expanded content */}
      {(isOpen || isRunning) && (
        <div className="mt-2 ml-0.5 space-y-2">
          {/* Activity line */}
          <div className={cn('flex items-center gap-2 text-sm', isDark ? 'text-white/35' : 'text-gray-400')}>
            <Pencil size={14} />
            <span>{isRunning ? 'Wird ausgefuehrt...' : displayName}</span>
          </div>

          {/* Ergebnis badge (clickable → shows request) */}
          {step.status === 'complete' && (step.toolInput || step.toolOutput) && (
            <div>
              <button
                onClick={() => setShowRequest(!showRequest)}
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium transition-colors',
                  isDark
                    ? 'bg-white/[0.06] text-white/50 hover:bg-white/[0.1] hover:text-white/70'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700'
                )}
              >
                Ergebnis
                {showRequest ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
              </button>

              {showRequest && (
                <div className="mt-2 space-y-2">
                  {step.toolInput && (
                    <div className={cn(
                      'rounded-xl p-4 border',
                      isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-gray-50/80 border-gray-200/50'
                    )}>
                      <div className={cn('text-xs font-medium mb-2', isDark ? 'text-white/35' : 'text-gray-400')}>
                        Request
                      </div>
                      <pre className={cn(
                        'text-sm font-mono whitespace-pre-wrap leading-relaxed',
                        isDark ? 'text-white/55' : 'text-gray-600'
                      )}>
                        {JSON.stringify(step.toolInput, null, 2)}
                      </pre>
                    </div>
                  )}
                  {step.toolOutput && (
                    <div className={cn(
                      'rounded-xl p-4 border',
                      isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-gray-50/80 border-gray-200/50'
                    )}>
                      <div className={cn('text-xs font-medium mb-2', isDark ? 'text-white/35' : 'text-gray-400')}>
                        Ergebnis
                      </div>
                      <pre className={cn(
                        'text-sm font-mono whitespace-pre-wrap leading-relaxed max-h-[300px] overflow-y-auto',
                        isDark ? 'text-white/55' : 'text-gray-600'
                      )}>
                        {step.toolOutput}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Thought Block (clock icon + text) ──
function ThoughtBlock({ text, isDark }: { text: string; isDark: boolean }) {
  return (
    <div className="flex gap-3 py-2">
      <Clock size={16} className={cn('shrink-0 mt-0.5', isDark ? 'text-white/20' : 'text-gray-300')} />
      <p className={cn('text-sm leading-relaxed', isDark ? 'text-white/45' : 'text-gray-500')}>
        {text}
      </p>
    </div>
  );
}

// ── Step Stream (linear blocks like Claude) ──
function StepStream({ steps, isRunning, isDark }: {
  steps: AgentStep[];
  isRunning: boolean;
  isDark: boolean;
}) {
  return (
    <div>
      {steps.map((step, idx) => (
        <div key={step.stepNumber}>
          {/* Thought */}
          {step.thought && <ThoughtBlock text={step.thought} isDark={isDark} />}

          {/* Thinking spinner (waiting for LLM response) */}
          {step.status === 'thinking' && !step.thought && !step.toolName && (
            <div className={cn('flex items-center gap-2.5 py-2', isDark ? 'text-white/35' : 'text-gray-400')}>
              <Loader2 size={15} className="animate-spin" />
              <span className="text-sm">Denkt nach...</span>
            </div>
          )}

          {/* Tool call block */}
          {step.toolName && <ToolCallBlock step={step} isDark={isDark} />}

          {/* "Fertig" after completed steps with tools (not after last if still running) */}
          {step.status === 'complete' && step.toolName && !(isRunning && idx === steps.length - 1) && (
            <div className="flex items-center gap-3 py-2">
              <CheckCircle2 size={16} className={cn('shrink-0', isDark ? 'text-white/20' : 'text-gray-300')} />
              <span className={cn('text-sm', isDark ? 'text-white/35' : 'text-gray-400')}>Fertig</span>
            </div>
          )}
        </div>
      ))}

      {/* Trailing spinner when waiting for next step */}
      {isRunning && steps.length > 0 && steps[steps.length - 1]?.status === 'complete' && (
        <div className={cn('flex items-center gap-2.5 py-2', isDark ? 'text-white/35' : 'text-gray-400')}>
          <Loader2 size={15} className="animate-spin" />
          <span className="text-sm">Verarbeitet...</span>
        </div>
      )}
    </div>
  );
}

// ── Main Component ──
export function AgentTaskDetail() {
  const { activeTaskId, tasks, cancelTask, getTaskDetail, setActiveTaskId, startTask } = useAgent();
  const { isDark } = useTheme();
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const task = activeTaskId ? tasks.find(t => t.id === activeTaskId) : null;

  // Load full details for completed tasks
  useEffect(() => {
    if (activeTaskId && !activeTaskId.startsWith('temp-') && task?.steps.length === 0 && task.status !== 'pending' && task.status !== 'running') {
      getTaskDetail(activeTaskId);
    }
  }, [activeTaskId, task, getTaskDetail]);

  // Auto-scroll during execution
  useEffect(() => {
    if (task?.status === 'running' && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [task?.steps, task?.status]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      startTask(input.trim());
      setInput('');
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const taskInput = (
    <form onSubmit={handleSubmit}>
      <div className={cn(
        'flex items-center gap-2 p-3 rounded-xl transition-colors',
        isDark
          ? 'bg-white/[0.03] border border-white/[0.08] focus-within:border-white/[0.15] focus-within:ring-1 focus-within:ring-blue-500/20'
          : 'bg-white border border-gray-200/80 focus-within:border-gray-300 focus-within:ring-1 focus-within:ring-blue-500/20 shadow-sm'
      )}>
        <Bot size={16} className={cn('shrink-0', isDark ? 'text-blue-400/60' : 'text-blue-500/60')} />
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Agent-Aufgabe eingeben..."
          rows={1}
          className={cn(
            'flex-1 bg-transparent resize-none outline-none',
            'text-primary placeholder:text-secondary',
            'min-h-[24px] max-h-[200px] text-sm',
            'focus:outline-none focus:ring-0 focus:border-0'
          )}
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className={cn(
            'shrink-0 w-8 h-8 flex items-center justify-center rounded-lg transition-colors',
            input.trim()
              ? isDark ? 'text-blue-400 hover:bg-blue-500/20' : 'text-blue-600 hover:bg-blue-50'
              : isDark ? 'text-white/15' : 'text-gray-300'
          )}
        >
          <Send size={16} />
        </button>
      </div>
    </form>
  );

  // ── No task selected ──
  if (!task) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 flex items-center justify-center">
          <div className={cn('text-center px-6 max-w-md', isDark ? 'text-white/30' : 'text-gray-400')}>
            <Bot size={40} className="mx-auto mb-4 opacity-40" />
            <h3 className={cn('text-base font-medium mb-2', isDark ? 'text-white/60' : 'text-gray-600')}>
              Agent Task starten
            </h3>
            <p className="text-sm leading-relaxed">
              Der Agent durchsucht deine Dokumente, nutzt die Wissensdatenbank und kann mehrstufige Aufgaben ausfuehren.
            </p>
          </div>
        </div>
        <div className="shrink-0 p-4">{taskInput}</div>
      </div>
    );
  }

  const isTerminal = task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled';
  const isRunning = task.status === 'pending' || task.status === 'running';

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className={cn('shrink-0 px-4 py-3 border-b flex items-center gap-2', isDark ? 'border-white/[0.06]' : 'border-gray-200')}>
        <button
          onClick={() => setActiveTaskId(null)}
          className={cn('p-1 rounded-md', isDark ? 'hover:bg-white/[0.05] text-white/40' : 'hover:bg-gray-100 text-gray-400')}
        >
          <ChevronLeft size={16} />
        </button>
        <span className={cn('text-sm flex-1 truncate', isDark ? 'text-white/70' : 'text-gray-700')}>
          {task.query}
        </span>
        {isRunning && (
          <button
            onClick={() => cancelTask(task.id)}
            className={cn('px-2 py-1 rounded-md text-xs flex items-center gap-1', isDark ? 'text-red-400 hover:bg-red-500/10' : 'text-red-500 hover:bg-red-50')}
          >
            <X size={12} /> Abbrechen
          </button>
        )}
      </div>

      {/* Content */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-6">

          {/* ── Running / Completed: Linear step stream ── */}
          {isRunning && task.steps.length === 0 && (
            <div className={cn('flex items-center gap-2.5', isDark ? 'text-white/35' : 'text-gray-400')}>
              <Loader2 size={16} className="animate-spin" />
              <span className="text-sm">Agent startet...</span>
            </div>
          )}

          {task.steps.length > 0 && (
            <StepStream steps={task.steps} isRunning={isRunning} isDark={isDark} />
          )}

          {/* ── Final "Fertig" + Answer (completed) ── */}
          {task.status === 'completed' && (
            <>
              {/* Final fertig marker */}
              {task.steps.length > 0 && !task.steps[task.steps.length - 1]?.toolName && (
                <div className="flex items-center gap-3 py-2 mb-4">
                  <CheckCircle2 size={16} className={cn('shrink-0', isDark ? 'text-white/20' : 'text-gray-300')} />
                  <span className={cn('text-sm', isDark ? 'text-white/35' : 'text-gray-400')}>Fertig</span>
                </div>
              )}

              {/* Answer as Markdown */}
              {task.result?.answer && (
                <div className={cn('prose prose-sm max-w-none', isDark ? 'prose-invert' : '')}>
                  <Markdown content={task.result.answer} />
                </div>
              )}
            </>
          )}

          {/* ── Failed ── */}
          {task.status === 'failed' && (
            <div className={cn('mt-4 p-4 rounded-xl', isDark ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-200')}>
              <div className="flex items-center gap-2 mb-1.5">
                <XCircle size={14} className={isDark ? 'text-red-400' : 'text-red-600'} />
                <span className={cn('text-xs font-medium', isDark ? 'text-red-400' : 'text-red-600')}>Fehler</span>
              </div>
              <p className={cn('text-sm', isDark ? 'text-red-300' : 'text-red-700')}>{task.error}</p>
            </div>
          )}

          {/* ── Cancelled ── */}
          {task.status === 'cancelled' && (
            <div className={cn('flex items-center gap-2.5 text-sm mt-4', isDark ? 'text-white/40' : 'text-gray-400')}>
              <X size={14} /> Task wurde abgebrochen.
            </div>
          )}

          {/* ── Meta ── */}
          {isTerminal && task.totalSteps > 0 && (
            <div className={cn('mt-8 pt-4 flex gap-4 text-xs border-t', isDark ? 'border-white/[0.04] text-white/20' : 'border-gray-100 text-gray-300')}>
              <span>{task.totalSteps} {task.totalSteps === 1 ? 'Schritt' : 'Schritte'}</span>
              {(task.inputTokens + task.outputTokens) > 0 && (
                <span>{(task.inputTokens + task.outputTokens).toLocaleString()} Tokens</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom input */}
      {isTerminal && (
        <div className={cn('shrink-0 p-4 border-t', isDark ? 'border-white/[0.06]' : 'border-gray-200')}>
          {taskInput}
        </div>
      )}
    </div>
  );
}
