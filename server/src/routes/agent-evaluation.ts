/**
 * Agent Evaluation Routes - Benchmark agent strategies (hybrid, cloud-only, local-only)
 * Admin-only endpoints for running and comparing agent evaluations
 */

import express, { type Response } from 'express';
import { agentEvaluationService } from '../services/evaluation/AgentEvaluationService.js';
import { asyncHandler, authenticateToken } from '../middleware/index.js';
import type { AuthenticatedRequest } from '../types/auth.js';
import type { AgentStrategy } from '../services/agents/types.js';

const router = express.Router();

/**
 * POST /api/agent-eval/runs - Start an evaluation run for a strategy
 */
router.post('/runs', authenticateToken, asyncHandler(async (req: express.Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  if (authReq.user?.role !== 'Admin') {
    return res.status(403).json({ error: 'Nur Admins können Evaluationen starten' });
  }

  const { strategy, localModel, cloudModel, goldenQueryIds, timeoutPerQuery } = req.body;

  const validStrategies: AgentStrategy[] = ['hybrid', 'cloud-only', 'local-only'];
  if (!strategy || !validStrategies.includes(strategy)) {
    return res.status(400).json({
      error: `strategy muss eines von ${validStrategies.join(', ')} sein`,
    });
  }

  const runId = await agentEvaluationService.startRun({
    strategy,
    localModel,
    cloudModel,
    goldenQueryIds,
    timeoutPerQuery,
  });

  return res.json({ runId, strategy, status: 'pending' });
}));

/**
 * GET /api/agent-eval/runs - List all evaluation runs
 */
router.get('/runs', authenticateToken, asyncHandler(async (req: express.Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  if (authReq.user?.role !== 'Admin') {
    return res.status(403).json({ error: 'Nur Admins' });
  }

  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const runs = await agentEvaluationService.listRuns(limit);
  return res.json({ runs });
}));

/**
 * GET /api/agent-eval/runs/:id - Get run details with individual results
 */
router.get('/runs/:id', authenticateToken, asyncHandler(async (req: express.Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  if (authReq.user?.role !== 'Admin') {
    return res.status(403).json({ error: 'Nur Admins' });
  }

  const run = await agentEvaluationService.getRun(req.params.id!);
  if (!run) {
    return res.status(404).json({ error: 'Run nicht gefunden' });
  }

  const results = await agentEvaluationService.getResults(req.params.id!);
  return res.json({ run, results });
}));

/**
 * POST /api/agent-eval/benchmark - Run all three strategies and return comparison
 */
router.post('/benchmark', authenticateToken, asyncHandler(async (req: express.Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  if (authReq.user?.role !== 'Admin') {
    return res.status(403).json({ error: 'Nur Admins können Benchmarks starten' });
  }

  const { localModel, cloudModel, goldenQueryIds, timeoutPerQuery } = req.body;

  const runIds = await agentEvaluationService.startBenchmark({
    localModel,
    cloudModel,
    goldenQueryIds,
    timeoutPerQuery,
  });

  return res.json({
    message: 'Benchmark gestartet — 3 Strategien werden sequentiell ausgewertet',
    runs: runIds,
  });
}));

export default router;
