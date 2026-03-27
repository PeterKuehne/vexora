/**
 * Agent Routes - API endpoints for multi-turn agent conversations
 *
 * SSE streaming for real-time step updates, task management, cancellation.
 * Supports multi-turn: POST /run starts, POST /tasks/:id/message continues.
 */

import { Router, type Request, type Response } from 'express';
import { authenticateToken } from '../middleware/index.js';
import { ValidationError } from '../errors/index.js';
import type { AuthenticatedRequest } from '../types/auth.js';
import { agentExecutor, agentPersistence } from '../services/agents/index.js';
import type { AgentUserContext, AgentSSEEvent } from '../services/agents/types.js';
import { queryRouter } from '../services/agents/QueryRouter.js';
import { env } from '../config/env.js';
import { hasProvider } from '../services/agents/ai-provider.js';

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
 * Helper: Set up SSE response with keepalive and cleanup
 */
function setupSSE(res: Response): {
  emitSSE: (event: AgentSSEEvent) => void;
  cleanup: () => void;
  isDisconnected: () => boolean;
} {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  let clientDisconnected = false;

  const keepAliveInterval = setInterval(() => {
    if (!clientDisconnected) {
      res.write(`event: keepalive\ndata: {}\n\n`);
    }
  }, 15000);

  const cleanup = () => {
    clearInterval(keepAliveInterval);
  };

  res.on('close', () => {
    clientDisconnected = true;
    cleanup();
  });

  const emitSSE = (event: AgentSSEEvent) => {
    if (clientDisconnected) return;

    res.write(`event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`);

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

  return { emitSSE, cleanup, isDisconnected: () => clientDisconnected };
}

/**
 * POST /api/agents/run - Start a new agent conversation (first turn)
 */
router.post('/run', authenticateToken, (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const { query, model, conversationId, skillSlug } = req.body;
  console.log(`[AgentRoute] POST /run — model from request: ${JSON.stringify(model)}, LOCAL_MODEL: ${env.LOCAL_MODEL}`);

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

  const { emitSSE, cleanup, isDisconnected } = setupSSE(res);

  // Route query through cascade router (unless model explicitly provided)
  const routeAndExecute = async () => {
    let effectiveModel = model;
    let routingDecision: string | undefined;

    if (!effectiveModel) {
      const routing = await queryRouter.route(query.trim());
      routingDecision = routing.route;

      if (routing.model === 'cloud') {
        // Try cloud model, fall back to fallback cloud model, then local
        const cloudModel = env.CLOUD_MODEL;
        const { provider } = await import('../services/agents/ai-provider.js').then(m => m.parseModelString(cloudModel));
        if (hasProvider(provider)) {
          effectiveModel = cloudModel;
        } else if (env.CLOUD_FALLBACK_MODEL) {
          const fallback = env.CLOUD_FALLBACK_MODEL;
          const { provider: fbProvider } = await import('../services/agents/ai-provider.js').then(m => m.parseModelString(fallback));
          if (hasProvider(fbProvider)) {
            console.warn(`[AgentRoute] Cloud model ${cloudModel} nicht verfügbar, Fallback auf ${fallback}`);
            effectiveModel = fallback;
          } else {
            console.warn(`[AgentRoute] Kein Cloud-Model verfügbar, Fallback auf lokal`);
            effectiveModel = env.LOCAL_MODEL;
          }
        } else {
          console.warn(`[AgentRoute] Cloud model ${cloudModel} nicht verfügbar, Fallback auf lokal`);
          effectiveModel = env.LOCAL_MODEL;
        }
      } else {
        effectiveModel = env.LOCAL_MODEL;
      }
    }

    return agentExecutor.execute(query.trim(), context, {
      model: effectiveModel,
      conversationId,
      emitSSE,
      routingDecision,
      skillSlug: skillSlug || undefined,
    });
  };

  routeAndExecute().catch(error => {
    console.error('[AgentRoute] Execution error:', error);
    if (!isDisconnected()) {
      res.write(`event: task:error\ndata: ${JSON.stringify({ error: String(error) })}\n\n`);
      cleanup();
      res.end();
    }
  });
});

/**
 * POST /api/agents/tasks/:id/message - Send a follow-up message (continue conversation)
 */
router.post('/tasks/:id/message', authenticateToken, (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const taskId = req.params.id!;
  const { message } = req.body;

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    res.status(400).json({ error: 'message ist erforderlich' });
    return;
  }

  let context: AgentUserContext;
  try {
    context = getUserContext(authReq);
  } catch {
    res.status(401).json({ error: 'Nicht authentifiziert' });
    return;
  }

  const { emitSSE, cleanup, isDisconnected } = setupSSE(res);

  agentExecutor.continueTask(taskId, message.trim(), context, {
    emitSSE,
  }).catch(error => {
    console.error('[AgentRoute] Continue error:', error);
    if (!isDisconnected()) {
      res.write(`event: task:error\ndata: ${JSON.stringify({ error: String(error) })}\n\n`);
      cleanup();
      res.end();
    }
  });
});

/**
 * POST /api/agents/tasks/:id/complete - End the conversation
 */
router.post('/tasks/:id/complete', authenticateToken, async (req: Request, res: Response) => {
  try {
    const taskId = req.params.id!;
    await agentExecutor.completeTask(taskId);
    res.json({ status: 'completed', taskId });
  } catch (error) {
    console.error('[AgentRoute] Complete error:', error);
    res.status(500).json({ error: 'Fehler beim Abschließen' });
  }
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
 * GET /api/agents/tasks/:id - Get task details with steps and messages
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
 * DELETE /api/agents/tasks/:id - Delete a single task
 */
router.delete('/tasks/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const context = getUserContext(authReq);
    const deleted = await agentPersistence.deleteTask(context, req.params.id!);

    if (deleted) {
      res.json({ success: true, taskId: req.params.id });
    } else {
      res.status(404).json({ error: 'Task nicht gefunden' });
    }
  } catch (error) {
    console.error('[AgentRoute] DELETE /tasks/:id error:', error);
    res.status(500).json({ error: 'Fehler beim Löschen' });
  }
});

/**
 * GET /api/agents/tasks/:id/stream - Get task data (for reconnect/polling)
 */
router.get('/tasks/:id/stream', authenticateToken, async (req: Request, res: Response) => {
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
    res.status(500).json({ error: 'Fehler' });
  }
});

export default router;
