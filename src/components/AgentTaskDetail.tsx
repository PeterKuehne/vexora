/**
 * AgentTaskDetail - Multi-turn agent conversation workspace
 *
 * Renders a conversation thread: user messages + agent responses + tool calls.
 * Chat input is always visible — conversations stay open until deleted.
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import {
  useAgent,
  type AgentStep,
  type AgentMessage,
  type TurnMeta,
} from '../contexts/AgentContext';
import { useTheme } from '../contexts/ThemeContext';
import { Markdown } from './Markdown';
import { ChatInput } from './ChatInput';
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
  Pencil,
  User,
  ArrowDown,
  Search,
  FileText,
  GitFork,
  Database,
  FilePlus,
  Bell,
  Sparkles,
  List,
  Wand2,
  RefreshCw,
  FlaskConical,
} from 'lucide-react';
import { cn } from '../utils';

// ── Tool Icon Mapping ──
const TOOL_ICONS: Record<string, typeof Pencil> = {
  rag_search: Search,
  read_chunk: FileText,
  graph_query: GitFork,
  sql_query: Database,
  create_document: FilePlus,
  send_notification: Bell,
  load_skill: Sparkles,
  list_skills: List,
  create_skill: Wand2,
  update_skill: RefreshCw,
  run_skill_test: FlaskConical,
};

// ── Tool Call Block ──
function ToolCallBlock({ step, isDark }: { step: AgentStep; isDark: boolean }) {
  const [showResult, setShowResult] = useState(false);

  const toolLabel = (step.toolName || 'tool').replace(/_/g, ' ');
  const displayName = toolLabel.charAt(0).toUpperCase() + toolLabel.slice(1);
  const isRunning = step.status === 'tool_running';
  const hasResult = step.status === 'complete' && (step.toolInput || step.toolOutput);
  const Icon = TOOL_ICONS[step.toolName || ''] || Pencil;

  return (
    <div className="my-3">
      <div className="flex items-center gap-2">
        <Icon size={14} className={cn('shrink-0', isDark ? 'text-white/30' : 'text-gray-400')} />
        <span className={cn('text-sm', isDark ? 'text-white/45' : 'text-gray-400')}>
          {displayName}
        </span>
        {isRunning && <Loader2 size={13} className="animate-spin text-blue-400" />}
      </div>

      <div className="flex ml-[6px]">
        <div className={cn('w-px shrink-0 ml-px', isDark ? 'bg-white/[0.08]' : 'bg-gray-200')} />
        <div className="ml-4 pb-1 min-w-0">
          {isRunning && (
            <div className={cn('flex items-center gap-2 text-sm pt-1', isDark ? 'text-white/35' : 'text-gray-400')}>
              <Loader2 size={13} className="animate-spin" />
              <span>Wird ausgeführt...</span>
            </div>
          )}

          {hasResult && (
            <div className="pt-1">
              <button
                onClick={() => setShowResult(!showResult)}
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium transition-colors',
                  isDark
                    ? 'bg-white/[0.06] text-white/50 hover:bg-white/[0.1] hover:text-white/70'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700'
                )}
              >
                Ergebnis
                {showResult ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
              </button>

              {showResult && (
                <div className="mt-2 space-y-2">
                  {step.toolInput && (
                    <div className={cn('rounded-xl p-4 border', isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-gray-50/80 border-gray-200/50')}>
                      <div className={cn('text-xs font-medium mb-2', isDark ? 'text-white/35' : 'text-gray-400')}>Request</div>
                      <pre className={cn('text-sm font-mono whitespace-pre-wrap leading-relaxed', isDark ? 'text-white/55' : 'text-gray-600')}>
                        {JSON.stringify(step.toolInput, null, 2)}
                      </pre>
                    </div>
                  )}
                  {step.toolOutput && (
                    <div className={cn('rounded-xl p-4 border', isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-gray-50/80 border-gray-200/50')}>
                      <div className={cn('text-xs font-medium mb-2', isDark ? 'text-white/35' : 'text-gray-400')}>Ergebnis</div>
                      <pre className={cn('text-sm font-mono whitespace-pre-wrap leading-relaxed max-h-[300px] overflow-y-auto', isDark ? 'text-white/55' : 'text-gray-600')}>
                        {step.toolOutput}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Tool Group (collapsible) ──
function ToolGroup({ steps, isDark, defaultOpen, turnRunning }: {
  steps: AgentStep[];
  isDark: boolean;
  defaultOpen?: boolean;
  /** Whether the parent turn is still running (more steps may arrive) */
  turnRunning?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen ?? false);

  const toolSteps = steps.filter(s => s.toolName);
  const completedCount = toolSteps.filter(s => s.status === 'complete').length;
  const runningCount = toolSteps.filter(s => s.status === 'tool_running').length;
  const isGroupRunning = runningCount > 0;
  // "Fertig" only when no tools are running AND the turn itself is done
  const isGroupDone = !isGroupRunning && !turnRunning;

  const label = isGroupRunning
    ? `${completedCount} ausgeführt, ${runningCount} aktiv...`
    : turnRunning
      ? `${completedCount} ${completedCount === 1 ? 'Tool ausgeführt' : 'Tools ausgeführt'}...`
      : `${completedCount} ${completedCount === 1 ? 'Tool ausgeführt' : 'Tools ausgeführt'}`;

  return (
    <div className="my-2">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn('flex items-center gap-1.5 text-sm transition-colors py-1', isDark ? 'text-white/60 hover:text-white/75' : 'text-gray-600 hover:text-gray-800')}
      >
        {isGroupDone && <CheckCircle2 size={14} className={cn('shrink-0', isDark ? 'text-white/50' : 'text-gray-500')} />}
        <span>{label}</span>
        {(isGroupRunning || turnRunning) ? <Loader2 size={13} className="animate-spin" /> : isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>

      {(isOpen || isGroupRunning || turnRunning) && (
        <div className="mt-1">
          {steps.map((step) => (
            <div key={step.stepNumber}>
              {step.toolName && <ToolCallBlock step={step} isDark={isDark} />}
            </div>
          ))}
          {isGroupDone && (
            <div className="flex items-center gap-3 py-2">
              <CheckCircle2 size={16} className={cn('shrink-0', isDark ? 'text-white/50' : 'text-gray-500')} />
              <span className={cn('text-sm', isDark ? 'text-white/60' : 'text-gray-600')}>Fertig</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Step Stream ──
function StepStream({ steps, isRunning, isDark }: {
  steps: AgentStep[];
  isRunning: boolean;
  isDark: boolean;
}) {
  const groups: Array<{ type: 'thought' | 'thinking' | 'tools'; steps: AgentStep[] }> = [];

  for (const step of steps) {
    if (step.status === 'thinking' && !step.thought && !step.toolName) {
      groups.push({ type: 'thinking', steps: [step] });
    } else if (step.thought && !step.toolName) {
      groups.push({ type: 'thought', steps: [step] });
    } else if (step.toolName) {
      const lastGroup = groups[groups.length - 1];
      if (lastGroup?.type === 'tools') {
        lastGroup.steps.push(step);
      } else {
        groups.push({ type: 'tools', steps: [step] });
      }
    }
  }

  return (
    <div>
      {groups.map((group, idx) => {
        if (group.type === 'thought') {
          return (
            <div key={idx} className="flex gap-3 py-2">
              <Clock size={16} className={cn('shrink-0 mt-0.5', isDark ? 'text-white/20' : 'text-gray-300')} />
              <p className={cn('text-sm leading-relaxed', isDark ? 'text-white/45' : 'text-gray-500')}>
                {group.steps[0]!.thought}
              </p>
            </div>
          );
        }

        if (group.type === 'thinking') {
          return (
            <div key={idx} className={cn('flex items-center gap-2.5 py-2', isDark ? 'text-white/35' : 'text-gray-400')}>
              <Loader2 size={15} className="animate-spin" />
              <span className="text-sm">Denkt nach...</span>
            </div>
          );
        }

        if (group.type === 'tools') {
          const isLastGroup = idx === groups.length - 1;
          return (
            <div key={idx}>
              {group.steps.length === 1 ? (
                <ToolCallBlock step={group.steps[0]!} isDark={isDark} />
              ) : (
                <ToolGroup steps={group.steps} isDark={isDark} defaultOpen={isRunning && isLastGroup} turnRunning={isRunning && isLastGroup} />
              )}
            </div>
          );
        }

        return null;
      })}

      {isRunning && (steps.length === 0 || steps[steps.length - 1]?.status === 'complete') && (
        <div className={cn('flex items-center gap-2.5 py-2', isDark ? 'text-white/35' : 'text-gray-400')}>
          <Loader2 size={15} className="animate-spin" />
          <span className="text-sm">Verarbeitet...</span>
        </div>
      )}
    </div>
  );
}

// ── User Message Bubble (right-aligned like Claude) ──
function UserMessageBubble({ content, isDark }: { content: string; isDark: boolean }) {
  return (
    <div className="flex justify-end py-4">
      <div className={cn(
        'max-w-[85%] rounded-2xl px-5 py-3.5 text-sm leading-relaxed',
        isDark
          ? 'bg-white/[0.08] text-white/85'
          : 'bg-stone-100 text-gray-800'
      )}>
        {content}
      </div>
    </div>
  );
}

// ── Transparency Info ──
function TransparencyInfo({ meta, isDark }: { meta: TurnMeta; isDark: boolean }) {
  if (!meta.model) return null;

  const isCloud = meta.modelLocation === 'cloud';
  const modelName = meta.model.replace(/^(anthropic|mistral|openai):/, '');
  const totalTokens = (meta.inputTokens || 0) + (meta.outputTokens || 0);
  const tokenStr = totalTokens >= 1000 ? `${(totalTokens / 1000).toFixed(1)}k` : String(totalTokens);
  const costStr = meta.estimatedCost != null && meta.estimatedCost > 0
    ? `~€${meta.estimatedCost < 0.01 ? meta.estimatedCost.toFixed(4) : meta.estimatedCost.toFixed(3)}`
    : null;

  return (
    <div className={cn(
      'flex items-center gap-2 text-xs py-1.5 mt-1',
      isDark ? 'text-white/25' : 'text-gray-400'
    )}>
      <span>{isCloud ? '\u2601\uFE0F' : '\uD83D\uDD12'}</span>
      <span>{modelName}</span>
      <span className={cn('w-px h-3', isDark ? 'bg-white/10' : 'bg-gray-300')} />
      <span>{isCloud ? 'EU-Cloud' : 'lokal'}</span>
      {totalTokens > 0 && (
        <>
          <span className={cn('w-px h-3', isDark ? 'bg-white/10' : 'bg-gray-300')} />
          <span>{tokenStr} Tokens</span>
        </>
      )}
      {costStr && (
        <>
          <span className={cn('w-px h-3', isDark ? 'bg-white/10' : 'bg-gray-300')} />
          <span>{costStr}</span>
        </>
      )}
    </div>
  );
}

// ── Assistant Answer ──
function AssistantAnswer({ content, isDark }: { content: string; isDark: boolean }) {
  return (
    <div className={cn('prose prose-sm max-w-none py-2', isDark ? 'prose-invert' : '')}>
      <Markdown content={content} />
    </div>
  );
}

// ── Main Component ──
export function AgentTaskDetail() {
  const { activeTaskId, tasks, cancelTask, sendMessage, getTaskDetail, setActiveTaskId, startTask } = useAgent();
  const { isDark } = useTheme();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const lastScrollTop = useRef(0);
  const fetchedTaskIds = useRef<Set<string>>(new Set());

  const task = activeTaskId ? tasks.find(t => t.id === activeTaskId) : null;

  // Show button only when user scrolls UP and is not at the bottom
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const currentTop = el.scrollTop;
    const distanceFromBottom = el.scrollHeight - currentTop - el.clientHeight;
    const scrolledUp = currentTop < lastScrollTop.current;
    lastScrollTop.current = currentTop;

    if (scrolledUp && distanceFromBottom > 100) {
      setShowScrollButton(true);
    } else if (distanceFromBottom <= 20) {
      setShowScrollButton(false);
    }
  }, []);

  const scrollToBottom = useCallback(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    setShowScrollButton(false);
  }, []);

  // Load full details when selecting a non-running task (once per task)
  useEffect(() => {
    if (activeTaskId && !activeTaskId.startsWith('temp-') && !fetchedTaskIds.current.has(activeTaskId) && task?.steps.length === 0 && task.status !== 'pending' && task.status !== 'running') {
      fetchedTaskIds.current.add(activeTaskId);
      getTaskDetail(activeTaskId);
    }
  }, [activeTaskId, task?.status, getTaskDetail]);

  // Auto-scroll during execution (only if already at bottom)
  useEffect(() => {
    if (task?.status === 'running' && scrollRef.current) {
      const el = scrollRef.current;
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      if (distanceFromBottom < 150) {
        el.scrollTop = el.scrollHeight;
      }
    }
  }, [task?.steps, task?.status]);

  const handleNewTask = useCallback((message: string, skillSlug?: string) => {
    startTask(message, undefined, undefined, skillSlug);
  }, [startTask]);

  const handleFollowUp = useCallback((message: string, _skillSlug?: string) => {
    if (task) {
      sendMessage(task.id, message);
    }
  }, [task, sendMessage]);

  // ── No task selected ──
  if (!task) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 flex items-center justify-center">
          <div className={cn('text-center px-6 max-w-md', isDark ? 'text-white/30' : 'text-gray-400')}>
            <Bot size={40} className="mx-auto mb-4 opacity-40" />
            <h3 className={cn('text-base font-medium mb-2', isDark ? 'text-white/60' : 'text-gray-600')}>
              Neue Aufgabe starten
            </h3>
            <p className="text-sm leading-relaxed">
              Durchsuche Dokumente, nutze Skills und löse mehrstufige Aufgaben in einer Konversation.
            </p>
          </div>
        </div>
        <div className="shrink-0">
          <div className="p-4 max-w-4xl mx-auto w-full">
            <ChatInput onSend={handleNewTask} placeholder="Aufgabe eingeben..." />
            <p className={cn('text-xs mt-2 text-center', isDark ? 'text-gray-500' : 'text-gray-400')}>
              Enter zum Senden, Shift+Enter für neue Zeile
            </p>
          </div>
        </div>
      </div>
    );
  }

  const isRunning = task.status === 'pending' || task.status === 'running';
  const canSendMessage = !isRunning && task.status !== 'cancelled';
  const hasMessages = task.messages && task.messages.length > 0;

  // Build turn-based view from messages
  const turns: Array<{ turnNumber: number; userMessage?: string; assistantMessage?: string; steps: AgentStep[] }> = [];

  if (hasMessages) {
    // Group messages and steps by turn
    const maxTurn = Math.max(...task.messages.map(m => m.turnNumber));
    for (let t = 1; t <= maxTurn; t++) {
      const userMsg = task.messages.find(m => m.turnNumber === t && m.role === 'user');
      const assistantMsg = task.messages.find(m => m.turnNumber === t && m.role === 'assistant');
      const turnSteps = task.steps.filter(s => (s.turnNumber || 1) === t);
      turns.push({
        turnNumber: t,
        userMessage: userMsg?.content,
        assistantMessage: assistantMsg?.content,
        steps: turnSteps,
      });
    }

    // If running and there are steps without a matching turn message yet, add them
    if (isRunning) {
      const unassignedSteps = task.steps.filter(s => {
        const t = s.turnNumber || 1;
        return !turns.find(turn => turn.turnNumber === t);
      });
      if (unassignedSteps.length > 0) {
        const t = Math.max(...unassignedSteps.map(s => s.turnNumber || 1));
        const existing = turns.find(turn => turn.turnNumber === t);
        if (existing) {
          existing.steps = [...existing.steps, ...unassignedSteps];
        } else {
          turns.push({ turnNumber: t, steps: unassignedSteps });
        }
      }
    }
  } else {
    // Legacy single-turn task (no messages in DB) — render old style
    turns.push({
      turnNumber: 1,
      userMessage: task.query,
      assistantMessage: task.result?.answer,
      steps: task.steps,
    });
  }

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

      {/* Conversation Content */}
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-6">

          {/* Render turns */}
          {turns.map((turn, idx) => (
            <div key={turn.turnNumber}>
              {/* Separator between turns */}
              {idx > 0 && (
                <div className={cn('my-6 border-t', isDark ? 'border-white/[0.04]' : 'border-gray-100')} />
              )}

              {/* User message */}
              {turn.userMessage && (
                <UserMessageBubble content={turn.userMessage} isDark={isDark} />
              )}

              {/* Steps (tool calls) for this turn */}
              {(turn.steps.length > 0 || (isRunning && idx === turns.length - 1)) && (
                <StepStream
                  steps={turn.steps}
                  isRunning={isRunning && idx === turns.length - 1}
                  isDark={isDark}
                />
              )}

              {/* Assistant answer for this turn */}
              {turn.assistantMessage && !isRunning && (
                <>
                  <AssistantAnswer content={turn.assistantMessage} isDark={isDark} />
                  {task.turnMeta[turn.turnNumber] && (
                    <TransparencyInfo meta={task.turnMeta[turn.turnNumber]} isDark={isDark} />
                  )}
                </>
              )}
            </div>
          ))}

          {/* Failed */}
          {task.status === 'failed' && (
            <div className={cn('mt-4 p-4 rounded-xl', isDark ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-200')}>
              <div className="flex items-center gap-2 mb-1.5">
                <XCircle size={14} className={isDark ? 'text-red-400' : 'text-red-600'} />
                <span className={cn('text-xs font-medium', isDark ? 'text-red-400' : 'text-red-600')}>Fehler</span>
              </div>
              <p className={cn('text-sm', isDark ? 'text-red-300' : 'text-red-700')}>{task.error}</p>
              <button
                onClick={() => {
                  const lastUserMsg = task.messages.filter(m => m.role === 'user').pop();
                  if (lastUserMsg) startTask(lastUserMsg.content);
                }}
                className={cn(
                  'mt-3 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                  isDark
                    ? 'bg-white/[0.08] text-white/60 hover:bg-white/[0.12] hover:text-white/80'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-800'
                )}
              >
                Erneut versuchen
              </button>
            </div>
          )}

          {/* Cancelled */}
          {task.status === 'cancelled' && (
            <div className={cn('flex items-center gap-2.5 text-sm mt-4', isDark ? 'text-white/40' : 'text-gray-400')}>
              <X size={14} /> Konversation wurde abgebrochen.
            </div>
          )}
        </div>

      </div>

      {/* Scroll to bottom — fixed above input */}
      {showScrollButton && (
        <div className="flex justify-center -mt-12 mb-2 pointer-events-none relative z-10">
          <button
            onClick={scrollToBottom}
            className={cn(
              'pointer-events-auto',
              'w-8 h-8 rounded-full shadow-lg flex items-center justify-center',
              'transition-all duration-200',
              isDark
                ? 'bg-white/10 hover:bg-white/20 text-white/60 border border-white/10'
                : 'bg-white hover:bg-gray-50 text-gray-500 border border-gray-200 shadow-md'
            )}
          >
            <ArrowDown size={16} />
          </button>
        </div>
      )}

      {/* Chat Input — always visible except when running or cancelled */}
      {canSendMessage && (
        <div className="shrink-0">
          <div className="p-4 max-w-4xl mx-auto w-full">
            <ChatInput onSend={handleFollowUp} placeholder="Nachricht eingeben..." />
          </div>
        </div>
      )}
    </div>
  );
}
