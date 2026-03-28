/**
 * AgentContext - State management for multi-turn Agent Conversations
 *
 * Manages task state, SSE streaming, and provides
 * startTask(), sendMessage(), cancelTask(), completeTask() actions.
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  type ReactNode,
} from 'react';
import { httpClient } from '../lib/httpClient';
import { env } from '../lib/env';

// ============================================
// Types
// ============================================

export type AgentTaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'awaiting_input';

export type StepStatus = 'thinking' | 'tool_running' | 'complete';

export interface AgentStep {
  stepNumber: number;
  turnNumber?: number;
  status: StepStatus;
  thought?: string;
  /** Reasoning content from reasoning models (gpt-oss-120b etc.) */
  reasoning?: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  toolOutput?: string;
  duration?: number;
}

export interface AgentMessage {
  turnNumber: number;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  /** Structured content (tool-call blocks, tool results) — present for tool context messages */
  contentJson?: unknown;
  toolCallId?: string;
}

export interface TurnMeta {
  model?: string;
  modelLocation?: 'local' | 'cloud';
  inputTokens?: number;
  outputTokens?: number;
  estimatedCost?: number;
  routingDecision?: string;
}

export interface AgentTask {
  id: string;
  status: AgentTaskStatus;
  query: string;
  model: string;
  result?: { answer: string };
  error?: string;
  totalSteps: number;
  inputTokens: number;
  outputTokens: number;
  steps: AgentStep[];
  messages: AgentMessage[];
  /** Per-turn metadata (model, tokens) keyed by turnNumber */
  turnMeta: Record<number, TurnMeta>;
  createdAt: string;
  completedAt?: string;
}

interface AgentContextValue {
  tasks: AgentTask[];
  activeTaskId: string | null;
  isLoading: boolean;
  startTask: (query: string, model?: string, conversationId?: string, skillSlug?: string) => Promise<string | null>;
  sendMessage: (taskId: string, message: string) => Promise<void>;
  cancelTask: (taskId: string) => Promise<void>;
  completeTask: (taskId: string) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  loadTasks: () => Promise<void>;
  getTaskDetail: (taskId: string) => Promise<AgentTask | null>;
  setActiveTaskId: (id: string | null) => void;
}

const AgentContext = createContext<AgentContextValue | null>(null);

// ============================================
// Provider
// ============================================

export function AgentProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const activeReaderRef = useRef<ReadableStreamDefaultReader | null>(null);

  // Load tasks from API
  const loadTasks = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await httpClient.get(`${env.API_URL}/api/agents/tasks?limit=50`);
      const data = await response.json();
      setTasks(data.tasks.map((t: any) => ({
        ...t,
        steps: [],
        messages: [],
        turnMeta: {},
        createdAt: t.createdAt || t.created_at,
        completedAt: t.completedAt || t.completed_at,
      })));
    } catch (error) {
      console.error('[AgentContext] Failed to load tasks:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Get task detail with steps and messages
  const getTaskDetail = useCallback(async (taskId: string): Promise<AgentTask | null> => {
    if (taskId.startsWith('temp-')) return null;
    try {
      const response = await httpClient.get(`${env.API_URL}/api/agents/tasks/${taskId}`);
      const data = await response.json();
      // Reconstruct turnMeta from task data (model, tokens are stored globally)
      const taskRow = data.task;
      const modelStr = taskRow.model || '';
      const maxTurn = Math.max(1, ...(data.messages || []).map((m: any) => m.turn_number || m.turnNumber || 1));
      const reconstructedTurnMeta: Record<number, TurnMeta> = {};
      if (modelStr) {
        const inTok = taskRow.input_tokens || taskRow.inputTokens || 0;
        const outTok = taskRow.output_tokens || taskRow.outputTokens || 0;
        const pricing: Record<string, [number, number]> = {
          'ovh:gpt-oss-120b': [0.08, 0.40],
        };
        const [inPrice, outPrice] = pricing[modelStr] || [0, 0];
        const cost = (inTok / 1_000_000) * inPrice + (outTok / 1_000_000) * outPrice;

        reconstructedTurnMeta[maxTurn] = {
          model: modelStr,
          modelLocation: 'cloud',
          inputTokens: inTok,
          outputTokens: outTok,
          estimatedCost: cost || undefined,
        };
      }

      const task: AgentTask = {
        ...data.task,
        turnMeta: reconstructedTurnMeta,
        steps: (data.steps || []).map((s: any) => ({
          stepNumber: s.step_number || s.stepNumber,
          turnNumber: s.turn_number || s.turnNumber || 1,
          status: 'complete' as const,
          thought: s.thought,
          toolName: s.tool_name || s.toolName,
          toolInput: s.tool_input || s.toolInput,
          toolOutput: s.tool_output || s.toolOutput,
          duration: s.duration_ms || s.durationMs,
        })),
        messages: (data.messages || [])
          // Filter out structured tool context messages — those are only for the LLM, not the UI
          .filter((m: any) => m.role !== 'tool' && !(m.role === 'assistant' && (m.content_json || m.contentJson) && !m.content))
          .map((m: any) => ({
            turnNumber: m.turn_number || m.turnNumber,
            role: m.role,
            content: m.content || '',
            contentJson: m.content_json || m.contentJson,
            toolCallId: m.tool_call_id || m.toolCallId,
          })),
        createdAt: data.task.createdAt || data.task.created_at,
        completedAt: data.task.completedAt || data.task.completed_at,
      };

      setTasks(prev => prev.map(t => t.id === taskId ? task : t));
      return task;
    } catch (error) {
      console.error('[AgentContext] Failed to get task detail:', error);
      return null;
    }
  }, []);

  // Handle incoming SSE events
  const handleSSEEvent = useCallback((event: string, data: any, localTaskId: string) => {
    const taskId = data.taskId || localTaskId;

    setTasks(prev => prev.map(task => {
      if (task.id !== taskId && task.id !== localTaskId) return task;

      const upsertStep = (partial: Partial<AgentStep> & { stepNumber: number }): AgentStep[] => {
        const existing = task.steps.find(s => s.stepNumber === partial.stepNumber);
        if (existing) {
          return task.steps.map(s => s.stepNumber === partial.stepNumber ? { ...s, ...partial } : s);
        }
        return [...task.steps, { status: 'thinking' as const, ...partial } as AgentStep]
          .sort((a, b) => a.stepNumber - b.stepNumber);
      };

      switch (event) {
        case 'task:start':
          return { ...task, id: data.taskId || task.id, status: 'running' as const };

        case 'step:start':
          return {
            ...task,
            status: 'running' as const,
            steps: upsertStep({ stepNumber: data.stepNumber, turnNumber: data.turnNumber, status: 'thinking' }),
          };

        case 'step:thinking': {
          // Attach reasoning to the existing step (same stepNumber) rather than creating a new one
          const existingStep = task.steps.find(s => s.stepNumber === data.stepNumber);
          if (existingStep) {
            return {
              ...task,
              steps: task.steps.map(s => s.stepNumber === data.stepNumber
                ? { ...s, reasoning: data.thought }
                : s
              ),
            };
          }
          // If no matching step yet, create a standalone thinking step
          return {
            ...task,
            steps: upsertStep({ stepNumber: data.stepNumber, turnNumber: data.turnNumber, status: 'thinking', thought: data.thought, reasoning: data.thought }),
          };
        }

        case 'step:tool_start':
          return {
            ...task,
            steps: upsertStep({
              stepNumber: data.stepNumber,
              turnNumber: data.turnNumber,
              status: 'tool_running',
              toolName: data.toolName,
              toolInput: data.toolInput,
            }),
          };

        case 'step:tool_complete':
          return {
            ...task,
            steps: upsertStep({
              stepNumber: data.stepNumber,
              turnNumber: data.turnNumber,
              status: 'complete',
              toolName: data.toolName,
              toolInput: data.toolInput,
              toolOutput: data.toolOutput,
              duration: data.duration,
            }),
          };

        case 'step:complete':
          return {
            ...task,
            totalSteps: data.stepNumber,
            steps: upsertStep({
              stepNumber: data.stepNumber,
              turnNumber: data.turnNumber,
              status: 'complete',
              thought: data.thought || task.steps.find(s => s.stepNumber === data.stepNumber)?.thought,
              duration: data.duration,
            }),
          };

        case 'task:complete': {
          const nextStatus = (data.nextStatus || 'completed') as AgentTaskStatus;
          const newMessages = [...task.messages];

          // Add assistant message for this turn
          if (data.result && data.turnNumber) {
            newMessages.push({
              turnNumber: data.turnNumber,
              role: 'assistant',
              content: data.result,
            });
          }

          // Store per-turn model metadata
          const newTurnMeta = { ...task.turnMeta };
          if (data.turnNumber) {
            newTurnMeta[data.turnNumber] = {
              model: data.model,
              modelLocation: data.modelLocation,
              inputTokens: data.inputTokens,
              outputTokens: data.outputTokens,
              estimatedCost: data.estimatedCost,
              routingDecision: data.routingDecision,
            };
          }

          return {
            ...task,
            status: nextStatus,
            result: data.result ? { answer: data.result } : task.result,
            totalSteps: data.totalSteps || task.totalSteps,
            inputTokens: (data.inputTokens || 0) + task.inputTokens,
            outputTokens: (data.outputTokens || 0) + task.outputTokens,
            messages: newMessages,
            turnMeta: newTurnMeta,
            completedAt: nextStatus === 'completed' ? new Date().toISOString() : task.completedAt,
          };
        }

        case 'task:error':
          return {
            ...task,
            status: 'failed' as const,
            error: data.error,
            completedAt: new Date().toISOString(),
          };

        case 'task:cancelled':
          return {
            ...task,
            status: 'cancelled' as const,
            completedAt: new Date().toISOString(),
          };

        default:
          return task;
      }
    }));
  }, []);

  /**
   * Process an SSE stream from the server
   */
  const processSSEStream = useCallback(async (
    response: globalThis.Response,
    taskId: string,
  ) => {
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');
    activeReaderRef.current = reader;

    const decoder = new TextDecoder();
    let realTaskId: string | null = null;
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let currentEvent = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.substring(7).trim();
          } else if (line.startsWith('data: ') && currentEvent) {
            if (currentEvent === 'keepalive') {
              currentEvent = '';
              continue;
            }
            try {
              const data = JSON.parse(line.substring(6));

              if (data.taskId && !realTaskId) {
                realTaskId = data.taskId;
                setTasks(prev => prev.map(t =>
                  t.id === taskId ? { ...t, id: realTaskId! } : t
                ));
                setActiveTaskId(realTaskId);
              }

              handleSSEEvent(currentEvent, data, realTaskId || taskId);
            } catch {
              // Skip invalid JSON
            }
            currentEvent = '';
          }
        }
      }
    } catch (error) {
      console.error('[AgentContext] SSE stream error:', error);
      setTasks(prev => prev.map(t =>
        (t.id === taskId || t.id === realTaskId)
          ? { ...t, status: 'failed' as const, error: String(error) }
          : t
      ));
    } finally {
      if (activeReaderRef.current === reader) {
        activeReaderRef.current = null;
      }
    }
  }, [handleSSEEvent]);

  // Start a new agent task (first turn)
  const startTask = useCallback(async (
    query: string,
    model?: string,
    conversationId?: string,
    skillSlug?: string,
  ): Promise<string | null> => {
    const tempId = `temp-${Date.now()}`;
    const newTask: AgentTask = {
      id: tempId,
      status: 'pending',
      query,
      model: model || '',
      totalSteps: 0,
      inputTokens: 0,
      outputTokens: 0,
      steps: [],
      messages: [{ turnNumber: 1, role: 'user', content: query }],
      turnMeta: {},
      createdAt: new Date().toISOString(),
    };

    setTasks(prev => [newTask, ...prev]);
    setActiveTaskId(tempId);

    try {
      if (activeReaderRef.current) {
        activeReaderRef.current.cancel().catch(() => {});
        activeReaderRef.current = null;
      }

      // Ensure valid auth token before starting SSE (no auto-retry on streams)
      const authOk = await httpClient.ensureAuth();
      if (!authOk) {
        throw new Error('Sitzung abgelaufen. Bitte erneut anmelden.');
      }

      const response = await fetch(`${env.API_URL}/api/agents/run`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, model, conversationId, skillSlug }),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => 'Unknown error');
        throw new Error(`Agent request failed (${response.status}): ${errText}`);
      }

      processSSEStream(response, tempId);
      return tempId;
    } catch (error) {
      console.error('[AgentContext] Failed to start task:', error);
      setTasks(prev => prev.map(t =>
        t.id === tempId
          ? { ...t, status: 'failed' as const, error: error instanceof Error ? error.message : String(error) }
          : t
      ));
      return null;
    }
  }, [processSSEStream]);

  // Send a follow-up message (continue conversation)
  const sendMessage = useCallback(async (taskId: string, message: string) => {
    // Optimistically add user message
    setTasks(prev => prev.map(t => {
      if (t.id !== taskId) return t;
      const maxTurn = Math.max(0, ...t.messages.map(m => m.turnNumber));
      return {
        ...t,
        status: 'running' as AgentTaskStatus,
        messages: [...t.messages, { turnNumber: maxTurn + 1, role: 'user' as const, content: message }],
      };
    }));

    try {
      if (activeReaderRef.current) {
        activeReaderRef.current.cancel().catch(() => {});
        activeReaderRef.current = null;
      }

      // Ensure valid auth token before SSE
      await httpClient.ensureAuth();

      const response = await fetch(`${env.API_URL}/api/agents/tasks/${taskId}/message`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => 'Unknown error');
        throw new Error(`Message failed (${response.status}): ${errText}`);
      }

      processSSEStream(response, taskId);
    } catch (error) {
      console.error('[AgentContext] Failed to send message:', error);
      setTasks(prev => prev.map(t =>
        t.id === taskId
          ? { ...t, status: 'failed' as const, error: error instanceof Error ? error.message : String(error) }
          : t
      ));
    }
  }, [processSSEStream]);

  // Complete a task (end conversation)
  const completeTask = useCallback(async (taskId: string) => {
    try {
      await httpClient.post(`${env.API_URL}/api/agents/tasks/${taskId}/complete`, {});
      setTasks(prev => prev.map(t =>
        t.id === taskId ? { ...t, status: 'completed' as const, completedAt: new Date().toISOString() } : t
      ));
    } catch (error) {
      console.error('[AgentContext] Failed to complete task:', error);
    }
  }, []);

  // Delete a task
  const deleteTask = useCallback(async (taskId: string) => {
    try {
      await httpClient.delete(`${env.API_URL}/api/agents/tasks/${taskId}`);
      setTasks(prev => prev.filter(t => t.id !== taskId));
      if (activeTaskId === taskId) setActiveTaskId(null);
    } catch (error) {
      console.error('[AgentContext] Failed to delete task:', error);
    }
  }, [activeTaskId]);

  // Cancel a running task
  const cancelTask = useCallback(async (taskId: string) => {
    try {
      await httpClient.post(`${env.API_URL}/api/agents/tasks/${taskId}/cancel`, {});
      setTasks(prev => prev.map(t =>
        t.id === taskId ? { ...t, status: 'cancelled' as const } : t
      ));
    } catch (error) {
      console.error('[AgentContext] Failed to cancel task:', error);
    }
  }, []);

  useEffect(() => { loadTasks(); }, [loadTasks]);
  useEffect(() => {
    return () => { activeReaderRef.current?.cancel().catch(() => {}); };
  }, []);

  return (
    <AgentContext.Provider
      value={{
        tasks,
        activeTaskId,
        isLoading,
        startTask,
        sendMessage,
        cancelTask,
        completeTask,
        deleteTask,
        loadTasks,
        getTaskDetail,
        setActiveTaskId,
      }}
    >
      {children}
    </AgentContext.Provider>
  );
}

export function useAgent() {
  const context = useContext(AgentContext);
  if (!context) throw new Error('useAgent must be used within an AgentProvider');
  return context;
}
