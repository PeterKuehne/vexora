/**
 * Monitoring API Routes
 * Part of RAG V2 Phase 6: Production Hardening
 *
 * Provides endpoints for:
 * - Dashboard metrics
 * - Alert management
 * - System health
 * - Cache statistics
 */

import { Router, Request, Response } from 'express';
import { MonitoringService, type DashboardMetrics } from '../services/monitoring/index.js';
import { RedisCache } from '../services/cache/index.js';
import { TracingService } from '../services/observability/index.js';
import { DatabaseService } from '../services/DatabaseService.js';

export function createMonitoringRouter(
  db: DatabaseService,
  cache?: RedisCache,
  tracingService?: TracingService
): Router {
  const router = Router();
  const monitoringService = new MonitoringService(db, tracingService, cache);

  /**
   * GET /api/monitoring/dashboard
   * Get all dashboard metrics
   */
  router.get('/dashboard', async (_req: Request, res: Response) => {
    try {
      const metrics: DashboardMetrics = await monitoringService.getDashboardMetrics();
      res.json({
        success: true,
        data: metrics,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[Monitoring API] Dashboard error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch dashboard metrics',
      });
    }
  });

  /**
   * GET /api/monitoring/hourly
   * Get hourly statistics for charts
   */
  router.get('/hourly', async (req: Request, res: Response) => {
    try {
      const hours = parseInt(req.query.hours as string) || 24;
      const stats = await monitoringService.getHourlyStats(hours);
      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      console.error('[Monitoring API] Hourly stats error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch hourly statistics',
      });
    }
  });

  /**
   * GET /api/monitoring/health
   * System health check
   */
  router.get('/health', async (_req: Request, res: Response) => {
    try {
      const health = await monitoringService.healthCheck();
      const statusCode = health.overall === 'healthy' ? 200 : health.overall === 'degraded' ? 200 : 503;
      res.status(statusCode).json({
        success: true,
        data: health,
      });
    } catch (error) {
      console.error('[Monitoring API] Health check error:', error);
      res.status(503).json({
        success: false,
        error: 'Health check failed',
        data: {
          database: false,
          cache: false,
          tracing: false,
          overall: 'unhealthy',
        },
      });
    }
  });

  /**
   * GET /api/monitoring/alerts
   * Get active (unacknowledged) alerts
   */
  router.get('/alerts', async (_req: Request, res: Response) => {
    try {
      const alerts = await monitoringService.getActiveAlerts();
      res.json({
        success: true,
        data: alerts,
        count: alerts.length,
      });
    } catch (error) {
      console.error('[Monitoring API] Alerts error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch alerts',
      });
    }
  });

  /**
   * POST /api/monitoring/alerts/:id/acknowledge
   * Acknowledge an alert
   */
  router.post('/alerts/:id/acknowledge', async (req: Request, res: Response) => {
    try {
      const alertId = parseInt(req.params.id);
      const userId = (req as unknown as { user?: { id: string } }).user?.id || 'anonymous';

      await monitoringService.acknowledgeAlert(alertId, userId);
      res.json({
        success: true,
        message: 'Alert acknowledged',
      });
    } catch (error) {
      console.error('[Monitoring API] Acknowledge error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to acknowledge alert',
      });
    }
  });

  /**
   * POST /api/monitoring/alerts/check
   * Trigger alert check (usually called by cron)
   */
  router.post('/alerts/check', async (_req: Request, res: Response) => {
    try {
      await monitoringService.checkAndCreateAlerts();
      res.json({
        success: true,
        message: 'Alert check completed',
      });
    } catch (error) {
      console.error('[Monitoring API] Alert check error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to check alerts',
      });
    }
  });

  /**
   * GET /api/monitoring/cache
   * Get cache statistics
   */
  router.get('/cache', async (_req: Request, res: Response) => {
    try {
      if (!cache) {
        res.json({
          success: true,
          data: {
            enabled: false,
            connected: false,
            usedMemoryMB: 0,
            hitRate: 0,
            keys: 0,
          },
        });
        return;
      }

      const stats = await cache.getStats();
      const health = await cache.healthCheck();

      res.json({
        success: true,
        data: {
          enabled: true,
          ...stats,
          latencyMs: health.latencyMs,
        },
      });
    } catch (error) {
      console.error('[Monitoring API] Cache stats error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch cache statistics',
      });
    }
  });

  /**
   * POST /api/monitoring/cache/flush
   * Flush all cache entries (admin only)
   */
  router.post('/cache/flush', async (_req: Request, res: Response) => {
    try {
      if (!cache) {
        res.status(400).json({
          success: false,
          error: 'Cache not enabled',
        });
        return;
      }

      await cache.flush();
      res.json({
        success: true,
        message: 'Cache flushed successfully',
      });
    } catch (error) {
      console.error('[Monitoring API] Cache flush error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to flush cache',
      });
    }
  });

  /**
   * GET /api/monitoring/guardrails
   * Get guardrails event summary
   */
  router.get('/guardrails', async (_req: Request, res: Response) => {
    try {
      const summary = await monitoringService.getGuardrailsSummary();
      res.json({
        success: true,
        data: summary,
      });
    } catch (error) {
      console.error('[Monitoring API] Guardrails summary error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch guardrails summary',
      });
    }
  });

  /**
   * GET /api/monitoring/traces/recent
   * Get recent traces for debugging
   */
  router.get('/traces/recent', async (req: Request, res: Response) => {
    try {
      if (!tracingService) {
        res.json({
          success: true,
          data: [],
          message: 'Tracing not enabled',
        });
        return;
      }

      const limit = parseInt(req.query.limit as string) || 10;
      const traces = await tracingService.getRecentTraces(limit);
      res.json({
        success: true,
        data: traces,
      });
    } catch (error) {
      console.error('[Monitoring API] Recent traces error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch recent traces',
      });
    }
  });

  /**
   * GET /api/monitoring/traces/stats
   * Get trace statistics
   */
  router.get('/traces/stats', async (req: Request, res: Response) => {
    try {
      if (!tracingService) {
        res.json({
          success: true,
          data: {
            totalTraces: 0,
            successRate: 0,
            avgLatency: 0,
            p95Latency: 0,
            spanBreakdown: {},
          },
          message: 'Tracing not enabled',
        });
        return;
      }

      const hours = parseInt(req.query.hours as string) || 24;
      const stats = await tracingService.getTraceStats(hours);
      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      console.error('[Monitoring API] Trace stats error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch trace statistics',
      });
    }
  });

  return router;
}
