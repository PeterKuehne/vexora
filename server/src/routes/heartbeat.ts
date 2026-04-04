/**
 * Heartbeat Routes — Briefing + CRUD for Heartbeat management
 */

import { Router, type Response } from 'express';
import { asyncHandler, authenticateToken } from '../middleware/index.js';
import type { AuthenticatedRequest } from '../types/auth.js';
import { heartbeatEngine } from '../services/heartbeat/index.js';
import { generateBriefing } from '../services/heartbeat/briefing.js';

const router = Router();

const requireAdmin = (req: AuthenticatedRequest, res: Response, next: any) => {
  if (!req.user || req.user.role !== 'Admin') {
    res.status(403).json({ error: 'Nur Admins koennen Heartbeats verwalten.' });
    return;
  }
  next();
};

// ─── Briefing (all users) ────────────────────

/**
 * GET /api/heartbeat/briefing — Get personalized briefing for current user
 */
router.get('/briefing', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.user_id || '';
  const userRole = req.user?.role || 'Employee';
  const userName = req.user?.name || req.user?.email || 'User';

  const results = await heartbeatEngine.getUndeliveredResults(userId, userRole);

  const briefing = await generateBriefing(results, userName, userId);

  // Mark as delivered
  if (briefing.resultIds.length > 0) {
    await heartbeatEngine.markDelivered(briefing.resultIds);
  }

  res.json({
    hasBriefing: briefing.hasBriefing,
    text: briefing.text,
    resultCount: briefing.results.length,
    results: briefing.results.map(r => ({
      id: r.id,
      name: r.name,
      icon: r.icon,
      priority: r.priority,
      data: r.data,
      createdAt: r.createdAt,
    })),
  });
}));

// ─── Definitions CRUD (Admin only) ───────────

router.get('/definitions', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const definitions = await heartbeatEngine.getAllDefinitions();
  res.json(definitions);
}));

router.post('/definitions', authenticateToken, requireAdmin, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { name, description, cron, type, level, config, roles, icon, priority } = req.body;

  if (!name || !cron || !config) {
    res.status(400).json({ error: 'name, cron und config sind Pflichtfelder.' });
    return;
  }

  const def = await heartbeatEngine.createDefinition(
    { name, description, cron, type, level, config, roles, icon, priority },
  );

  res.status(201).json(def);
}));

router.put('/definitions/:id', authenticateToken, requireAdmin, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const def = await heartbeatEngine.updateDefinition(req.params.id!, req.body);
  if (!def) {
    res.status(404).json({ error: 'Heartbeat nicht gefunden.' });
    return;
  }
  res.json(def);
}));

router.patch('/definitions/:id/toggle', authenticateToken, requireAdmin, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const def = await heartbeatEngine.toggleDefinition(req.params.id!);
  if (!def) {
    res.status(404).json({ error: 'Heartbeat nicht gefunden.' });
    return;
  }
  res.json(def);
}));

router.delete('/definitions/:id', authenticateToken, requireAdmin, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const deleted = await heartbeatEngine.deleteDefinition(req.params.id!);
  if (!deleted) {
    res.status(404).json({ error: 'Heartbeat nicht gefunden.' });
    return;
  }
  res.json({ success: true });
}));

/**
 * POST /api/heartbeat/definitions/:id/run — Manually execute a heartbeat (Admin/Debug)
 */
router.post('/definitions/:id/run', authenticateToken, requireAdmin, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const def = await heartbeatEngine.getDefinition(req.params.id!);
  if (!def) {
    res.status(404).json({ error: 'Heartbeat nicht gefunden.' });
    return;
  }

  const result = await heartbeatEngine.executeHeartbeat(def);
  res.json({
    executed: true,
    hasResult: !!result,
    result: result || null,
  });
}));

// ─── Results (Admin) ─────────────────────────

router.get('/results', authenticateToken, requireAdmin, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const results = await heartbeatEngine.getAllResults();
  res.json(results);
}));

export default router;
