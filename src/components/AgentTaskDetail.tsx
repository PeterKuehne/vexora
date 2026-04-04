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
  Activity,
  Bot,
  Lightbulb,
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
import { fetchBriefing, type HeartbeatBriefing } from '../lib/heartbeat-api';

// ── Reasoning Block (Claude-style "Thinking") ──
function ReasoningBlock({ text, isDark, isStreaming }: { text: string; isDark: boolean; isStreaming?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const label = isStreaming ? 'Denkt nach...' : 'Gedankengang';

  return (
    <div
      className="my-1.5"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-1.5 text-xs transition-colors py-1 rounded-md px-1.5 -ml-1.5',
          isDark
            ? 'text-white/35 hover:text-white/55 hover:bg-white/[0.04]'
            : 'text-gray-400 hover:text-gray-500 hover:bg-gray-50'
        )}
      >
        {isStreaming ? (
          <Loader2 size={13} className="shrink-0 animate-spin" />
        ) : isHovered ? (
          isOpen ? <ChevronDown size={13} className="shrink-0" /> : <ChevronRight size={13} className="shrink-0" />
        ) : (
          <Lightbulb size={13} className="shrink-0" />
        )}
        <span>{label}</span>
      </button>

      {isOpen && (
        <div className={cn(
          'mt-1 rounded-lg px-3 py-2.5 text-xs leading-relaxed whitespace-pre-wrap border',
          isDark
            ? 'text-white/35 border-white/[0.06] bg-white/[0.02]'
            : 'text-gray-400 border-gray-100 bg-gray-50/60'
        )}>
          {text}
        </div>
      )}
    </div>
  );
}

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

// ── Step Stream (Option A: entire execution block is collapsible) ──
function StepStream({ steps, isRunning, isDark }: {
  steps: AgentStep[];
  isRunning: boolean;
  isDark: boolean;
}) {
  // Open during execution, collapsed after completion (including page refresh)
  const [isOpen, setIsOpen] = useState(isRunning);

  const toolSteps = steps.filter(s => s.toolName);
  const completedCount = toolSteps.filter(s => s.status === 'complete').length;
  const runningCount = toolSteps.filter(s => s.status === 'tool_running').length;
  const isStillRunning = runningCount > 0 || isRunning;
  const isDone = !isStillRunning && completedCount > 0;

  // Build interleaved groups: [reasoning] → [tool] → [reasoning] → [tool] → ...
  const groups: Array<
    | { type: 'reasoning'; text: string }
    | { type: 'thinking' }
    | { type: 'tool'; step: AgentStep }
  > = [];

  for (const step of steps) {
    if (step.status === 'thinking' && !step.thought && !step.toolName && !step.reasoning) {
      groups.push({ type: 'thinking' });
      continue;
    }

    if (step.reasoning) {
      const lastGroup = groups[groups.length - 1];
      if (lastGroup?.type === 'reasoning') {
        lastGroup.text += '\n\n' + step.reasoning;
      } else {
        groups.push({ type: 'reasoning', text: step.reasoning });
      }
    }

    if (step.toolName) {
      groups.push({ type: 'tool', step });
    }

    if (step.thought && !step.toolName && !step.reasoning) {
      groups.push({ type: 'reasoning', text: step.thought });
    }
  }

  // Summary label for the collapsed header
  const label = isStillRunning
    ? runningCount > 0
      ? `${completedCount} ausgeführt, ${runningCount} aktiv...`
      : `${completedCount} ${completedCount === 1 ? 'Tool ausgeführt' : 'Tools ausgeführt'}...`
    : `${completedCount} ${completedCount === 1 ? 'Tool ausgeführt' : 'Tools ausgeführt'}`;

  if (steps.length === 0 && isRunning) {
    return (
      <div className={cn('flex items-center gap-2.5 py-2', isDark ? 'text-white/35' : 'text-gray-400')}>
        <Loader2 size={15} className="animate-spin" />
        <span className="text-sm">Verarbeitet...</span>
      </div>
    );
  }

  if (steps.length === 0) return null;

  return (
    <div className="my-2">
      {/* Collapsible header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn('flex items-center gap-1.5 text-sm transition-colors py-1', isDark ? 'text-white/60 hover:text-white/75' : 'text-gray-600 hover:text-gray-800')}
      >
        {isDone && <CheckCircle2 size={14} className={cn('shrink-0', isDark ? 'text-white/50' : 'text-gray-500')} />}
        {isStillRunning && <Loader2 size={14} className="shrink-0 animate-spin" />}
        <span>{label}</span>
        {!isStillRunning && (isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />)}
      </button>

      {/* Expanded content: vertical line + interleaved reasoning/tools */}
      {(isOpen || isStillRunning) && (
        <div className="flex ml-[6px] mt-1">
          <div className={cn('w-px shrink-0 ml-px', isDark ? 'bg-white/[0.08]' : 'bg-gray-200')} />
          <div className="ml-3 pb-1 min-w-0 flex-1">
            {groups.map((group, idx) => {
              if (group.type === 'reasoning') {
                return <ReasoningBlock key={idx} text={group.text} isDark={isDark} />;
              }
              if (group.type === 'thinking') {
                return <ReasoningBlock key={idx} text="" isDark={isDark} isStreaming />;
              }
              if (group.type === 'tool') {
                return <ToolCallBlock key={idx} step={group.step} isDark={isDark} />;
              }
              return null;
            })}

            {/* "Fertig" indicator at bottom */}
            {isDone && (
              <div className="flex items-center gap-2 py-1.5">
                <CheckCircle2 size={13} className={cn('shrink-0', isDark ? 'text-white/30' : 'text-gray-400')} />
                <span className={cn('text-xs', isDark ? 'text-white/30' : 'text-gray-400')}>Fertig</span>
              </div>
            )}

            {/* Streaming indicator when waiting for next step */}
            {isRunning && !runningCount && steps[steps.length - 1]?.status === 'complete' && (
              <div className={cn('flex items-center gap-2 py-1.5', isDark ? 'text-white/30' : 'text-gray-400')}>
                <Loader2 size={13} className="animate-spin" />
                <span className="text-xs">Verarbeitet...</span>
              </div>
            )}
          </div>
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

  const modelName = meta.model.replace(/^ovh:/, '');
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
      <span>{'\u2601\uFE0F'}</span>
      <span>{modelName}</span>
      <span className={cn('w-px h-3', isDark ? 'bg-white/10' : 'bg-gray-300')} />
      <span>EU-Cloud</span>
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

  // Briefing state
  const [briefing, setBriefing] = useState<HeartbeatBriefing | null>(null);
  const briefingFetched = useRef(false);

  // Fetch briefing once when no task is active
  useEffect(() => {
    if (!task && !briefingFetched.current) {
      briefingFetched.current = true;
      fetchBriefing()
        .then(b => { if (b.hasBriefing) setBriefing(b); })
        .catch(() => {});
    }
  }, [task]);

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
        <div className="flex-1 flex items-center justify-center overflow-y-auto">
          {briefing ? (
            // ── Briefing Display ──
            <div className="w-full max-w-3xl mx-auto px-6 py-8">
              <div className={cn(
                'rounded-2xl border p-6',
                isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-white border-gray-200'
              )}>
                <div className="flex items-center gap-2 mb-4">
                  <Activity size={18} className={isDark ? 'text-emerald-400' : 'text-emerald-600'} />
                  <span className={cn('text-xs font-bold uppercase tracking-wider', isDark ? 'text-emerald-400' : 'text-emerald-600')}>
                    Heartbeat Briefing
                  </span>
                  <span className={cn('text-[10px]', isDark ? 'text-white/20' : 'text-gray-400')}>
                    {briefing.resultCount} Meldung{briefing.resultCount !== 1 ? 'en' : ''}
                  </span>
                </div>
                <div className={cn('prose prose-sm max-w-none', isDark ? 'prose-invert' : '')}>
                  <Markdown content={briefing.text} />
                </div>
                {briefing.results.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {briefing.results.map(r => (
                      <span key={r.id} className={cn(
                        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs',
                        r.priority === 'critical' ? 'bg-red-500/10 text-red-400' :
                        r.priority === 'warning' ? 'bg-amber-500/10 text-amber-400' :
                        isDark ? 'bg-white/[0.05] text-white/50' : 'bg-gray-100 text-gray-600'
                      )}>
                        {r.icon} {r.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            // ── Empty State ──
            <div className={cn('text-center px-6 max-w-md', isDark ? 'text-white/30' : 'text-gray-400')}>
              <Bot size={40} className="mx-auto mb-4 opacity-40" />
              <h3 className={cn('text-base font-medium mb-2', isDark ? 'text-white/60' : 'text-gray-600')}>
                Neue Aufgabe starten
              </h3>
              <p className="text-sm leading-relaxed">
                Durchsuche Dokumente, nutze Skills und löse mehrstufige Aufgaben in einer Konversation.
              </p>
            </div>
          )}
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
              {/* Show previous turns' answers always; hide current turn's answer only while running */}
              {turn.assistantMessage && !(isRunning && idx === turns.length - 1) && (
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
