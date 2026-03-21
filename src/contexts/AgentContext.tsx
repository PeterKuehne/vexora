/**
 * AgentContext - State management for Agent Tasks
 *
 * Manages task state, SSE streaming, and provides
 * startTask(), cancelTask() actions.
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

export type AgentTaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export type StepStatus = 'thinking' | 'tool_running' | 'complete';

export interface AgentStep {
  stepNumber: number;
  status: StepStatus;
  thought?: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  toolOutput?: string;
  duration?: number;
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
  createdAt: string;
  completedAt?: string;
}

interface AgentContextValue {
  tasks: AgentTask[];
  activeTaskId: string | null;
  isLoading: boolean;
  startTask: (query: string, model?: string, conversationId?: string) => Promise<string | null>;
  cancelTask: (taskId: string) => Promise<void>;
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
        createdAt: t.createdAt || t.created_at,
        completedAt: t.completedAt || t.completed_at,
      })));
    } catch (error) {
      console.error('[AgentContext] Failed to load tasks:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Get task detail with steps
  const getTaskDetail = useCallback(async (taskId: string): Promise<AgentTask | null> => {
    if (taskId.startsWith('temp-')) return null;
    try {
      const response = await httpClient.get(`${env.API_URL}/api/agents/tasks/${taskId}`);
      const data = await response.json();
      const task: AgentTask = {
        ...data.task,
        steps: data.steps.map((s: any) => ({
          stepNumber: s.step_number || s.stepNumber,
          status: 'complete' as const,
          thought: s.thought,
          toolName: s.tool_name || s.toolName,
          toolInput: s.tool_input || s.toolInput,
          toolOutput: s.tool_output || s.toolOutput,
          duration: s.duration_ms || s.durationMs,
        })),
        createdAt: data.task.createdAt || data.task.created_at,
        completedAt: data.task.completedAt || data.task.completed_at,
      };

      // Update in local state
      setTasks(prev => prev.map(t => t.id === taskId ? task : t));
      return task;
    } catch (error) {
      console.error('[AgentContext] Failed to get task detail:', error);
      return null;
    }
  }, []);

  // Handle incoming SSE events - updates task state
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
          // Agent starts thinking for this step
          return {
            ...task,
            status: 'running' as const,
            steps: upsertStep({ stepNumber: data.stepNumber, status: 'thinking' }),
          };

        case 'step:thinking':
          // Agent produced a thought
          return {
            ...task,
            steps: upsertStep({ stepNumber: data.stepNumber, status: 'thinking', thought: data.thought }),
          };

        case 'step:tool_start':
          // Agent is calling a tool
          return {
            ...task,
            steps: upsertStep({
              stepNumber: data.stepNumber,
              status: 'tool_running',
              toolName: data.toolName,
              toolInput: data.toolInput,
            }),
          };

        case 'step:tool_complete':
          // Tool finished
          return {
            ...task,
            steps: upsertStep({
              stepNumber: data.stepNumber,
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
              status: 'complete',
              thought: data.thought || task.steps.find(s => s.stepNumber === data.stepNumber)?.thought,
              duration: data.duration,
            }),
          };

        case 'task:complete':
          return {
            ...task,
            status: 'completed' as const,
            result: data.result ? { answer: data.result } : task.result,
            totalSteps: data.totalSteps || task.totalSteps,
            inputTokens: data.inputTokens || task.inputTokens,
            outputTokens: data.outputTokens || task.outputTokens,
            completedAt: new Date().toISOString(),
          };

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

  // Start a new agent task
  const startTask = useCallback(async (
    query: string,
    model?: string,
    conversationId?: string
  ): Promise<string | null> => {
    // Create a placeholder task
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
      createdAt: new Date().toISOString(),
    };

    setTasks(prev => [newTask, ...prev]);
    setActiveTaskId(tempId);

    try {
      // Cancel any previous stream
      if (activeReaderRef.current) {
        activeReaderRef.current.cancel().catch(() => {});
        activeReaderRef.current = null;
      }

      // Start SSE stream via fetch (POST with body, cookies for auth)
      const response = await fetch(`${env.API_URL}/api/agents/run`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, model, conversationId }),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => 'Unknown error');
        throw new Error(`Agent request failed (${response.status}): ${errText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');
      activeReaderRef.current = reader;

      const decoder = new TextDecoder();
      let realTaskId: string | null = null;
      let buffer = '';

      // Process SSE stream (runs async in background)
      (async () => {
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

                  // Capture real task ID from first event
                  if (data.taskId && !realTaskId) {
                    realTaskId = data.taskId;
                    setTasks(prev => prev.map(t =>
                      t.id === tempId ? { ...t, id: realTaskId! } : t
                    ));
                    setActiveTaskId(realTaskId);
                  }

                  handleSSEEvent(currentEvent, data, realTaskId || tempId);
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
            (t.id === tempId || t.id === realTaskId)
              ? { ...t, status: 'failed' as const, error: String(error) }
              : t
          ));
        } finally {
          if (activeReaderRef.current === reader) {
            activeReaderRef.current = null;
          }
        }
      })();

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
  }, [handleSSEEvent]);

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

  // Load tasks on mount
  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      activeReaderRef.current?.cancel().catch(() => {});
    };
  }, []);

  return (
    <AgentContext.Provider
      value={{
        tasks,
        activeTaskId,
        isLoading,
        startTask,
        cancelTask,
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
