/**
 * Usage Routes - API usage tracking and cost overview (Admin only)
 */

import { Router, type Response } from 'express';
import { asyncHandler, authenticateToken } from '../middleware/index.js';
import type { AuthenticatedRequest } from '../types/auth.js';
import { databaseService } from '../services/index.js';

const router = Router();

// Require Admin role
const requireAdmin = (req: AuthenticatedRequest, res: Response, next: () => void) => {
  if (!req.user || req.user.role !== 'Admin') {
    res.status(403).json({ error: 'Admin-Zugriff erforderlich' });
    return;
  }
  next();
};

// GET /api/admin/usage - Current month usage summary
router.get('/', authenticateToken, requireAdmin, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  // Current month boundaries
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

  // Total stats for current month
  const totalResult = await databaseService.query(
    `SELECT
      COUNT(*) as total_requests,
      COALESCE(SUM(input_tokens), 0) as total_input_tokens,
      COALESCE(SUM(output_tokens), 0) as total_output_tokens,
      COALESCE(SUM(cost_usd), 0) as total_cost_usd,
      COUNT(CASE WHEN pii_masked THEN 1 END) as pii_masked_count
    FROM api_usage_log
    WHERE created_at >= $1 AND created_at <= $2`,
    [monthStart, monthEnd]
  );

  // Per-model breakdown
  const perModelResult = await databaseService.query(
    `SELECT
      provider,
      model,
      COUNT(*) as requests,
      COALESCE(SUM(input_tokens), 0) as input_tokens,
      COALESCE(SUM(output_tokens), 0) as output_tokens,
      COALESCE(SUM(cost_usd), 0) as cost_usd
    FROM api_usage_log
    WHERE created_at >= $1 AND created_at <= $2
    GROUP BY provider, model
    ORDER BY cost_usd DESC`,
    [monthStart, monthEnd]
  );

  // Per-day trend (last 30 days)
  const dailyResult = await databaseService.query(
    `SELECT
      DATE(created_at) as date,
      COUNT(*) as requests,
      COALESCE(SUM(cost_usd), 0) as cost_usd
    FROM api_usage_log
    WHERE created_at >= NOW() - INTERVAL '30 days'
    GROUP BY DATE(created_at)
    ORDER BY date DESC
    LIMIT 30`
  );

  const total = totalResult.rows[0] || {};

  res.json({
    success: true,
    period: {
      start: monthStart,
      end: monthEnd,
      label: `${now.toLocaleString('de-DE', { month: 'long', year: 'numeric' })}`,
    },
    summary: {
      totalRequests: parseInt(total.total_requests || '0'),
      totalInputTokens: parseInt(total.total_input_tokens || '0'),
      totalOutputTokens: parseInt(total.total_output_tokens || '0'),
      totalCostUsd: parseFloat(total.total_cost_usd || '0'),
      piiMaskedCount: parseInt(total.pii_masked_count || '0'),
    },
    perModel: perModelResult.rows.map((row: any) => ({
      provider: row.provider,
      model: row.model,
      requests: parseInt(row.requests),
      inputTokens: parseInt(row.input_tokens),
      outputTokens: parseInt(row.output_tokens),
      costUsd: parseFloat(row.cost_usd),
    })),
    daily: dailyResult.rows.map((row: any) => ({
      date: row.date,
      requests: parseInt(row.requests),
      costUsd: parseFloat(row.cost_usd),
    })),
  });
}))

export default router;
