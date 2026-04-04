/**
 * Expert Agent Routes — CRUD API for Expert Agent management
 *
 * All users can view agents. Only Admins can create/edit/delete.
 */

import { Router, type Response } from 'express';
import { asyncHandler, authenticateToken } from '../middleware/index.js';
import type { AuthenticatedRequest } from '../types/auth.js';
import { expertAgentService } from '../services/agents/ExpertAgentService.js';

const router = Router();

/**
 * Middleware: require Admin role
 */
const requireAdmin = (req: AuthenticatedRequest, res: Response, next: any) => {
  if (!req.user || req.user.role !== 'Admin') {
    res.status(403).json({ error: 'Nur Admins koennen Expert Agents verwalten.' });
    return;
  }
  next();
};

// ─── Read (all users) ────────────────────────────

/**
 * GET /api/expert-agents — List all expert agents
 */
router.get('/', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const agents = await expertAgentService.getAll();

  // Non-admins only see active agents
  const filtered = req.user?.role === 'Admin'
    ? agents
    : agents.filter(a => a.isActive);

  res.json(filtered);
}));

/**
 * GET /api/expert-agents/available-tools — List all tools from ToolRegistry
 */
router.get('/available-tools', authenticateToken, asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
  const tools = expertAgentService.getAvailableTools();
  res.json(tools);
}));

/**
 * GET /api/expert-agents/:id — Single agent detail
 */
router.get('/:id', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const agent = await expertAgentService.getById(req.params.id!);
  if (!agent) {
    res.status(404).json({ error: 'Expert Agent nicht gefunden.' });
    return;
  }
  res.json(agent);
}));

// ─── Write (Admin only) ──────────────────────────

/**
 * POST /api/expert-agents — Create new expert agent
 */
router.post('/', authenticateToken, requireAdmin, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { name, description, avatarUrl, model, maxSteps, roles, rules, tools, instructions } = req.body;

  if (!name || !description || !tools || !instructions) {
    res.status(400).json({ error: 'name, description, tools und instructions sind Pflichtfelder.' });
    return;
  }

  // Validate name format (kebab-case)
  if (!/^[a-z][a-z0-9-]*$/.test(name)) {
    res.status(400).json({ error: 'Name muss kebab-case sein (z.B. hr-expert).' });
    return;
  }

  const agent = await expertAgentService.create(
    { name, description, avatarUrl, model, maxSteps, roles, rules, tools, instructions },
    req.user!.user_id,
  );

  res.status(201).json(agent);
}));

/**
 * PUT /api/expert-agents/:id — Update expert agent
 */
router.put('/:id', authenticateToken, requireAdmin, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { name, description, avatarUrl, isActive, model, maxSteps, roles, rules, tools, instructions } = req.body;

  // Validate name format if provided
  if (name && !/^[a-z][a-z0-9-]*$/.test(name)) {
    res.status(400).json({ error: 'Name muss kebab-case sein (z.B. hr-expert).' });
    return;
  }

  const agent = await expertAgentService.update(req.params.id!, {
    name, description, avatarUrl, isActive, model, maxSteps, roles, rules, tools, instructions,
  });

  if (!agent) {
    res.status(404).json({ error: 'Expert Agent nicht gefunden.' });
    return;
  }

  res.json(agent);
}));

/**
 * PATCH /api/expert-agents/:id/toggle — Toggle active/inactive
 */
router.patch('/:id/toggle', authenticateToken, requireAdmin, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const agent = await expertAgentService.toggleActive(req.params.id!);
  if (!agent) {
    res.status(404).json({ error: 'Expert Agent nicht gefunden.' });
    return;
  }
  res.json(agent);
}));

/**
 * DELETE /api/expert-agents/:id — Delete expert agent
 */
router.delete('/:id', authenticateToken, requireAdmin, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const deleted = await expertAgentService.delete(req.params.id!);
  if (!deleted) {
    res.status(404).json({ error: 'Expert Agent nicht gefunden.' });
    return;
  }
  res.json({ success: true });
}));

export default router;
