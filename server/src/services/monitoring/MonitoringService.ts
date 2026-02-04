/**
 * Monitoring Service
 * Part of RAG V2 Phase 6: Production Hardening
 *
 * Aggregates metrics from all services for dashboard display
 */

import { DatabaseService } from '../DatabaseService.js';
import { TracingService } from '../observability/TracingService.js';
import { RedisCache } from '../cache/RedisCache.js';

export interface DashboardMetrics {
  // Real-time (last 5 minutes)
  currentQPS: number;
  avgLatencyLast5Min: number;
  errorRateLast5Min: number;

  // Daily aggregates
  totalQueries: number;
  avgLatency: number;
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;
  errorRate: number;

  // Quality metrics
  avgGroundedness: number;

  // By component
  componentLatencies: Record<string, number>;

  // System health
  cacheHitRate: number;
  cacheMemoryMB: number;
  cacheConnected: boolean;

  // Query routing stats
  queryTypeDistribution: Record<string, number>;
  strategyDistribution: Record<string, number>;
}

export interface AlertConfig {
  p95LatencyThresholdMs: number;
  errorRateThreshold: number;
  cacheHitRateThreshold: number;
  enabled: boolean;
}

export interface Alert {
  id: number;
  type: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  metadata: Record<string, unknown>;
  acknowledged: boolean;
  createdAt: Date;
}

const DEFAULT_ALERT_CONFIG: AlertConfig = {
  p95LatencyThresholdMs: 800,
  errorRateThreshold: 0.01, // 1%
  cacheHitRateThreshold: 0.5, // 50%
  enabled: true,
};

export class MonitoringService {
  private alertConfig: AlertConfig;

  constructor(
    private db: DatabaseService,
    private tracingService?: TracingService,
    private cache?: RedisCache,
    alertConfig: Partial<AlertConfig> = {}
  ) {
    this.alertConfig = { ...DEFAULT_ALERT_CONFIG, ...alertConfig };
  }

  /**
   * Get all dashboard metrics
   */
  async getDashboardMetrics(): Promise<DashboardMetrics> {
    const [
      realtimeStats,
      dailyStats,
      latencyPercentiles,
      componentLatencies,
      queryTypeStats,
      strategyStats,
      cacheStats,
    ] = await Promise.all([
      this.getRealtimeStats(),
      this.getDailyStats(),
      this.getLatencyPercentiles(),
      this.getComponentLatencies(),
      this.getQueryTypeDistribution(),
      this.getStrategyDistribution(),
      this.cache?.getStats() || { hitRate: 0, usedMemoryMB: 0, connected: false },
    ]);

    return {
      // Real-time
      currentQPS: realtimeStats.qps,
      avgLatencyLast5Min: realtimeStats.avgLatency,
      errorRateLast5Min: realtimeStats.errorRate,

      // Daily
      totalQueries: dailyStats.totalQueries,
      avgLatency: dailyStats.avgLatency,
      p50Latency: latencyPercentiles.p50,
      p95Latency: latencyPercentiles.p95,
      p99Latency: latencyPercentiles.p99,
      errorRate: dailyStats.errorRate,

      // Quality
      avgGroundedness: dailyStats.avgGroundedness,

      // Components
      componentLatencies,

      // Cache
      cacheHitRate: cacheStats.hitRate,
      cacheMemoryMB: cacheStats.usedMemoryMB,
      cacheConnected: cacheStats.connected,

      // Query routing
      queryTypeDistribution: queryTypeStats,
      strategyDistribution: strategyStats,
    };
  }

  /**
   * Get real-time stats (last 5 minutes)
   */
  private async getRealtimeStats(): Promise<{
    qps: number;
    avgLatency: number;
    errorRate: number;
  }> {
    try {
      const result = await this.db.query(`
        SELECT
          COUNT(*) / 300.0 as qps,
          AVG(total_latency_ms) as avg_latency,
          COUNT(*) FILTER (WHERE NOT success) * 1.0 / NULLIF(COUNT(*), 0) as error_rate
        FROM rag_traces
        WHERE timestamp > NOW() - INTERVAL '5 minutes'
      `);

      return {
        qps: parseFloat(result.rows[0]?.qps) || 0,
        avgLatency: parseFloat(result.rows[0]?.avg_latency) || 0,
        errorRate: parseFloat(result.rows[0]?.error_rate) || 0,
      };
    } catch (error) {
      console.error('[MonitoringService] getRealtimeStats error:', error);
      return { qps: 0, avgLatency: 0, errorRate: 0 };
    }
  }

  /**
   * Get daily aggregated stats
   */
  private async getDailyStats(): Promise<{
    totalQueries: number;
    avgLatency: number;
    errorRate: number;
    avgGroundedness: number;
  }> {
    try {
      const result = await this.db.query(`
        SELECT
          COUNT(*) as total_queries,
          AVG(total_latency_ms) as avg_latency,
          COUNT(*) FILTER (WHERE NOT success) * 1.0 / NULLIF(COUNT(*), 0) as error_rate,
          AVG((spans->0->>'metadata')::jsonb->>'groundedness')::float as avg_groundedness
        FROM rag_traces
        WHERE timestamp > NOW() - INTERVAL '24 hours'
      `);

      return {
        totalQueries: parseInt(result.rows[0]?.total_queries) || 0,
        avgLatency: parseFloat(result.rows[0]?.avg_latency) || 0,
        errorRate: parseFloat(result.rows[0]?.error_rate) || 0,
        avgGroundedness: parseFloat(result.rows[0]?.avg_groundedness) || 0,
      };
    } catch (error) {
      console.error('[MonitoringService] getDailyStats error:', error);
      return { totalQueries: 0, avgLatency: 0, errorRate: 0, avgGroundedness: 0 };
    }
  }

  /**
   * Get latency percentiles
   */
  private async getLatencyPercentiles(): Promise<{
    p50: number;
    p95: number;
    p99: number;
  }> {
    try {
      const result = await this.db.query(`
        SELECT
          PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY total_latency_ms) as p50,
          PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY total_latency_ms) as p95,
          PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY total_latency_ms) as p99
        FROM rag_traces
        WHERE timestamp > NOW() - INTERVAL '24 hours'
      `);

      return {
        p50: parseFloat(result.rows[0]?.p50) || 0,
        p95: parseFloat(result.rows[0]?.p95) || 0,
        p99: parseFloat(result.rows[0]?.p99) || 0,
      };
    } catch (error) {
      console.error('[MonitoringService] getLatencyPercentiles error:', error);
      return { p50: 0, p95: 0, p99: 0 };
    }
  }

  /**
   * Get average latency per component/span
   */
  private async getComponentLatencies(): Promise<Record<string, number>> {
    try {
      const result = await this.db.query(`
        SELECT spans FROM rag_traces
        WHERE timestamp > NOW() - INTERVAL '1 hour'
        LIMIT 1000
      `);

      const spanTotals: Record<string, { sum: number; count: number }> = {};

      for (const row of result.rows) {
        const spans = row.spans || [];
        for (const span of spans) {
          if (!spanTotals[span.name]) {
            spanTotals[span.name] = { sum: 0, count: 0 };
          }
          if (span.durationMs) {
            spanTotals[span.name].sum += span.durationMs;
            spanTotals[span.name].count++;
          }
        }
      }

      const result2: Record<string, number> = {};
      for (const [name, totals] of Object.entries(spanTotals)) {
        result2[name] = totals.count > 0 ? totals.sum / totals.count : 0;
      }

      return result2;
    } catch (error) {
      console.error('[MonitoringService] getComponentLatencies error:', error);
      return {};
    }
  }

  /**
   * Get query type distribution
   */
  private async getQueryTypeDistribution(): Promise<Record<string, number>> {
    try {
      const result = await this.db.query(`
        SELECT query_type, COUNT(*) as count
        FROM rag_traces
        WHERE timestamp > NOW() - INTERVAL '24 hours'
          AND query_type IS NOT NULL
        GROUP BY query_type
        ORDER BY count DESC
      `);

      const distribution: Record<string, number> = {};
      for (const row of result.rows) {
        distribution[row.query_type] = parseInt(row.count);
      }
      return distribution;
    } catch (error) {
      console.error('[MonitoringService] getQueryTypeDistribution error:', error);
      return {};
    }
  }

  /**
   * Get retrieval strategy distribution
   */
  private async getStrategyDistribution(): Promise<Record<string, number>> {
    try {
      const result = await this.db.query(`
        SELECT retrieval_strategy, COUNT(*) as count
        FROM rag_traces
        WHERE timestamp > NOW() - INTERVAL '24 hours'
          AND retrieval_strategy IS NOT NULL
        GROUP BY retrieval_strategy
        ORDER BY count DESC
      `);

      const distribution: Record<string, number> = {};
      for (const row of result.rows) {
        distribution[row.retrieval_strategy] = parseInt(row.count);
      }
      return distribution;
    } catch (error) {
      console.error('[MonitoringService] getStrategyDistribution error:', error);
      return {};
    }
  }

  /**
   * Get hourly trace statistics (for charts)
   */
  async getHourlyStats(hours: number = 24): Promise<Array<{
    hour: Date;
    totalTraces: number;
    successRate: number;
    avgLatencyMs: number;
    p95LatencyMs: number;
  }>> {
    try {
      const result = await this.db.query(`
        SELECT
          DATE_TRUNC('hour', timestamp) as hour,
          COUNT(*) as total_traces,
          COUNT(*) FILTER (WHERE success) * 1.0 / NULLIF(COUNT(*), 0) as success_rate,
          AVG(total_latency_ms) as avg_latency_ms,
          PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY total_latency_ms) as p95_latency_ms
        FROM rag_traces
        WHERE timestamp > NOW() - INTERVAL '${hours} hours'
        GROUP BY DATE_TRUNC('hour', timestamp)
        ORDER BY hour DESC
      `);

      return result.rows.map(row => ({
        hour: row.hour,
        totalTraces: parseInt(row.total_traces),
        successRate: parseFloat(row.success_rate) || 0,
        avgLatencyMs: parseFloat(row.avg_latency_ms) || 0,
        p95LatencyMs: parseFloat(row.p95_latency_ms) || 0,
      }));
    } catch (error) {
      console.error('[MonitoringService] getHourlyStats error:', error);
      return [];
    }
  }

  // ============================================
  // Alert Management
  // ============================================

  /**
   * Check metrics and create alerts if thresholds exceeded
   */
  async checkAndCreateAlerts(): Promise<void> {
    if (!this.alertConfig.enabled) return;

    const metrics = await this.getDashboardMetrics();

    // Check p95 latency
    if (metrics.p95Latency > this.alertConfig.p95LatencyThresholdMs) {
      await this.createAlert(
        'high_latency',
        'warning',
        `p95 Latency (${metrics.p95Latency.toFixed(0)}ms) exceeds threshold (${this.alertConfig.p95LatencyThresholdMs}ms)`,
        { p95Latency: metrics.p95Latency, threshold: this.alertConfig.p95LatencyThresholdMs }
      );
    }

    // Check error rate
    if (metrics.errorRate > this.alertConfig.errorRateThreshold) {
      await this.createAlert(
        'high_error_rate',
        'error',
        `Error rate (${(metrics.errorRate * 100).toFixed(1)}%) exceeds threshold (${(this.alertConfig.errorRateThreshold * 100).toFixed(1)}%)`,
        { errorRate: metrics.errorRate, threshold: this.alertConfig.errorRateThreshold }
      );
    }

    // Check cache hit rate
    if (metrics.cacheConnected && metrics.cacheHitRate < this.alertConfig.cacheHitRateThreshold) {
      await this.createAlert(
        'low_cache_hit_rate',
        'info',
        `Cache hit rate (${(metrics.cacheHitRate * 100).toFixed(1)}%) below threshold (${(this.alertConfig.cacheHitRateThreshold * 100).toFixed(1)}%)`,
        { hitRate: metrics.cacheHitRate, threshold: this.alertConfig.cacheHitRateThreshold }
      );
    }
  }

  /**
   * Create an alert
   */
  private async createAlert(
    type: string,
    severity: 'info' | 'warning' | 'error' | 'critical',
    message: string,
    metadata: Record<string, unknown>
  ): Promise<void> {
    try {
      // Check if similar alert was created recently (within 1 hour)
      const recentCheck = await this.db.query(`
        SELECT id FROM monitoring_alerts
        WHERE alert_type = $1 AND created_at > NOW() - INTERVAL '1 hour'
        LIMIT 1
      `, [type]);

      if (recentCheck.rows.length > 0) {
        return; // Don't create duplicate alerts
      }

      await this.db.query(`
        INSERT INTO monitoring_alerts (alert_type, severity, message, metadata)
        VALUES ($1, $2, $3, $4)
      `, [type, severity, message, JSON.stringify(metadata)]);

      console.log(`[MonitoringService] Alert created: [${severity}] ${message}`);
    } catch (error) {
      console.error('[MonitoringService] createAlert error:', error);
    }
  }

  /**
   * Get unacknowledged alerts
   */
  async getActiveAlerts(): Promise<Alert[]> {
    try {
      const result = await this.db.query(`
        SELECT id, alert_type, severity, message, metadata, acknowledged, created_at
        FROM monitoring_alerts
        WHERE NOT acknowledged
        ORDER BY created_at DESC
        LIMIT 100
      `);

      return result.rows.map(row => ({
        id: row.id,
        type: row.alert_type,
        severity: row.severity,
        message: row.message,
        metadata: row.metadata || {},
        acknowledged: row.acknowledged,
        createdAt: row.created_at,
      }));
    } catch (error) {
      console.error('[MonitoringService] getActiveAlerts error:', error);
      return [];
    }
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId: number, userId: string): Promise<void> {
    try {
      await this.db.query(`
        UPDATE monitoring_alerts
        SET acknowledged = true, acknowledged_by = $2, acknowledged_at = NOW()
        WHERE id = $1
      `, [alertId, userId]);
    } catch (error) {
      console.error('[MonitoringService] acknowledgeAlert error:', error);
    }
  }

  /**
   * Get guardrails event summary
   */
  async getGuardrailsSummary(): Promise<Record<string, number>> {
    try {
      const result = await this.db.query(`
        SELECT event_type, COUNT(*) as count
        FROM guardrails_events
        WHERE timestamp > NOW() - INTERVAL '24 hours'
        GROUP BY event_type
        ORDER BY count DESC
      `);

      const summary: Record<string, number> = {};
      for (const row of result.rows) {
        summary[row.event_type] = parseInt(row.count);
      }
      return summary;
    } catch (error) {
      console.error('[MonitoringService] getGuardrailsSummary error:', error);
      return {};
    }
  }

  /**
   * Health check for all services
   */
  async healthCheck(): Promise<{
    database: boolean;
    cache: boolean;
    tracing: boolean;
    overall: 'healthy' | 'degraded' | 'unhealthy';
  }> {
    const databaseHealthy = await this.checkDatabaseHealth();
    const cacheHealthy = this.cache?.isAvailable() || false;
    const tracingHealthy = !!this.tracingService;

    let overall: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (!databaseHealthy) {
      overall = 'unhealthy';
    } else if (!cacheHealthy) {
      overall = 'degraded';
    }

    return {
      database: databaseHealthy,
      cache: cacheHealthy,
      tracing: tracingHealthy,
      overall,
    };
  }

  private async checkDatabaseHealth(): Promise<boolean> {
    try {
      await this.db.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }
}
