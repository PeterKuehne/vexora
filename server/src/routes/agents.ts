/**
 * Agent Routes - API endpoints for the Agent Framework
 *
 * SSE streaming for real-time step updates, task management, cancellation.
 * Migrated to use direct SSE emission via callback (no EventEmitter).
 */

import { Router, type Request, type Response } from 'express';
import { authenticateToken } from '../middleware/index.js';
import { ValidationError } from '../errors/index.js';
import type { AuthenticatedRequest } from '../types/auth.js';
import { agentExecutor, agentPersistence } from '../services/agents/index.js';
import type { AgentUserContext, AgentSSEEvent } from '../services/agents/types.js';

const router = Router();

/**
 * Helper: Extract AgentUserContext from authenticated request
 */
function getUserContext(req: AuthenticatedRequest): AgentUserContext {
  if (!req.user) throw new ValidationError('Nicht authentifiziert');
  return {
    userId: req.user.user_id,
    userRole: req.user.role,
    department: req.user.department,
  };
}

/**
 * POST /api/agents/run - Start an agent task, returns SSE stream
 *
 * NOT wrapped in asyncHandler because this is a long-lived SSE connection.
 * We manage the response lifecycle manually.
 */
router.post('/run', authenticateToken, (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const { query, model, conversationId } = req.body;

  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    res.status(400).json({ error: 'query ist erforderlich' });
    return;
  }

  let context: AgentUserContext;
  try {
    context = getUserContext(authReq);
  } catch {
    res.status(401).json({ error: 'Nicht authentifiziert' });
    return;
  }

  // Set up SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  let clientDisconnected = false;

  // SSE keepalive every 15 seconds
  const keepAliveInterval = setInterval(() => {
    if (!clientDisconnected) {
      res.write(`event: keepalive\ndata: {}\n\n`);
    }
  }, 15000);

  const cleanup = () => {
    clearInterval(keepAliveInterval);
  };

  // Handle client disconnect
  res.on('close', () => {
    clientDisconnected = true;
    cleanup();
  });

  // SSE emitter callback — passed to AgentExecutor
  const emitSSE = (event: AgentSSEEvent) => {
    if (clientDisconnected) return;

    res.write(`event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`);

    // Close stream on terminal events
    if (
      event.event === 'task:complete' ||
      event.event === 'task:error' ||
      event.event === 'task:cancelled'
    ) {
      cleanup();
      if (!clientDisconnected) {
        res.end();
      }
    }
  };

  // Determine effective model - fall back to Ollama if no Anthropic key
  const effectiveModel = model || (
    process.env.ANTHROPIC_API_KEY
      ? 'anthropic:claude-sonnet-4-6'
      : process.env.OLLAMA_DEFAULT_MODEL || 'qwen3:8b'
  );

  // Execute the agent task (fire-and-forget, events come via SSE callback)
  agentExecutor.execute(query.trim(), context, {
    model: effectiveModel,
    conversationId,
    emitSSE,
  }).catch(error => {
    console.error('[AgentRoute] Execution error:', error);
    if (!clientDisconnected) {
      res.write(`event: task:error\ndata: ${JSON.stringify({ error: String(error) })}\n\n`);
      cleanup();
      res.end();
    }
  });
});

/**
 * GET /api/agents/tasks - List agent tasks (paginated)
 */
router.get('/tasks', authenticateToken, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const context = getUserContext(authReq);
    const status = req.query.status as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    const result = await agentPersistence.getTasks(context, {
      status: status as any,
      limit,
      offset,
    });

    res.json({
      tasks: result.tasks,
      total: result.total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('[AgentRoute] GET /tasks error:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Tasks' });
  }
});

/**
 * GET /api/agents/tasks/:id - Get task details with all steps
 */
router.get('/tasks/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const context = getUserContext(authReq);
    const result = await agentPersistence.getTaskWithSteps(context, req.params.id!);

    if (!result) {
      res.status(404).json({ error: 'Task nicht gefunden' });
      return;
    }

    res.json(result);
  } catch (error) {
    console.error('[AgentRoute] GET /tasks/:id error:', error);
    res.status(500).json({ error: 'Fehler beim Laden des Tasks' });
  }
});

/**
 * POST /api/agents/tasks/:id/cancel - Cancel a running task
 */
router.post('/tasks/:id/cancel', authenticateToken, async (req: Request, res: Response) => {
  try {
    const taskId = req.params.id!;
    const cancelled = agentExecutor.cancel(taskId);

    if (cancelled) {
      res.json({ status: 'cancelled', taskId });
    } else {
      res.status(404).json({ error: 'Task nicht gefunden oder bereits beendet' });
    }
  } catch (error) {
    console.error('[AgentRoute] Cancel error:', error);
    res.status(500).json({ error: 'Fehler beim Abbrechen' });
  }
});

/**
 * GET /api/agents/tasks/:id/stream - Reconnect stream for a running task
 *
 * If the task is still running, we can't replay the live stream (no EventEmitter).
 * Instead, return the task data so the frontend can poll or reconnect.
 * If the task is finished, return task + steps as JSON.
 */
router.get('/tasks/:id/stream', authenticateToken, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const taskId = req.params.id!;

  try {
    const context = getUserContext(authReq);
    const result = await agentPersistence.getTaskWithSteps(context, taskId);

    if (!result) {
      res.status(404).json({ error: 'Task nicht gefunden' });
      return;
    }

    // Always return task data — frontend handles display
    // For running tasks, the frontend can poll this endpoint
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Fehler' });
  }
});

export default router;
