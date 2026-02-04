/**
 * Tracing Service for RAG Pipeline
 * Part of RAG V2 Phase 5: Query Intelligence & Observability
 *
 * Provides end-to-end tracing for RAG queries
 */

import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import { DatabaseService } from '../DatabaseService.js';

export type SpanName =
  | 'query_analysis'
  | 'embedding_generation'
  | 'vector_search'
  | 'graph_traversal'
  | 'reranking'
  | 'context_compression'
  | 'llm_generation'
  | 'guardrails_input'
  | 'guardrails_output';

export interface RAGSpan {
  spanId: string;
  parentSpanId?: string;
  name: SpanName;
  startTime: number;
  endTime?: number;
  durationMs?: number;
  metadata: Record<string, unknown>;
  status: 'running' | 'ok' | 'error';
  errorMessage?: string;
}

export interface RAGTrace {
  traceId: string;
  timestamp: Date;
  userIdHash: string;
  sessionId: string;
  queryLength: number;
  queryType?: string;
  retrievalStrategy?: string;
  spans: RAGSpan[];
  success: boolean;
  totalLatencyMs: number;
  tokensUsed: number;
  chunksRetrieved: number;
  chunksUsed: number;
}

export interface TracingConfig {
  enabled: boolean;
  sampleRate: number; // 0-1, percentage of traces to keep
  persistToDb: boolean;
  logToConsole: boolean;
}

const DEFAULT_CONFIG: TracingConfig = {
  enabled: true,
  sampleRate: 1.0, // Keep all traces
  persistToDb: true,
  logToConsole: process.env.NODE_ENV === 'development',
};

export class TracingService {
  private traces = new Map<string, RAGTrace>();
  private config: TracingConfig;

  constructor(
    private db?: DatabaseService,
    config: Partial<TracingConfig> = {}
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Start a new trace for a RAG query
   */
  startTrace(userId: string, sessionId: string, queryLength: number): string {
    if (!this.config.enabled) return '';

    // Sample rate check
    if (Math.random() > this.config.sampleRate) return '';

    const traceId = uuidv4();

    this.traces.set(traceId, {
      traceId,
      timestamp: new Date(),
      userIdHash: this.hashUserId(userId),
      sessionId,
      queryLength,
      spans: [],
      success: false,
      totalLatencyMs: 0,
      tokensUsed: 0,
      chunksRetrieved: 0,
      chunksUsed: 0,
    });

    if (this.config.logToConsole) {
      console.log(`[Trace ${traceId.substring(0, 8)}] Started`);
    }

    return traceId;
  }

  /**
   * Start a span within a trace
   */
  startSpan(traceId: string, name: SpanName, parentSpanId?: string): string {
    if (!traceId) return '';

    const trace = this.traces.get(traceId);
    if (!trace) return '';

    const spanId = uuidv4();

    trace.spans.push({
      spanId,
      parentSpanId,
      name,
      startTime: Date.now(),
      metadata: {},
      status: 'running',
    });

    if (this.config.logToConsole) {
      console.log(`[Trace ${traceId.substring(0, 8)}] Span started: ${name}`);
    }

    return spanId;
  }

  /**
   * End a span with metadata
   */
  endSpan(
    traceId: string,
    spanId: string,
    metadata: Record<string, unknown> = {},
    error?: Error
  ): void {
    if (!traceId || !spanId) return;

    const trace = this.traces.get(traceId);
    if (!trace) return;

    const span = trace.spans.find(s => s.spanId === spanId);
    if (!span) return;

    span.endTime = Date.now();
    span.durationMs = span.endTime - span.startTime;
    span.metadata = metadata;

    if (error) {
      span.status = 'error';
      span.errorMessage = error.message;
    } else {
      span.status = 'ok';
    }

    if (this.config.logToConsole) {
      const status = error ? 'ERROR' : 'OK';
      console.log(
        `[Trace ${traceId.substring(0, 8)}] Span ended: ${span.name} (${span.durationMs}ms) [${status}]`
      );
    }
  }

  /**
   * Set additional trace metadata
   */
  setTraceMetadata(
    traceId: string,
    metadata: Partial<Pick<RAGTrace, 'queryType' | 'retrievalStrategy' | 'tokensUsed' | 'chunksRetrieved' | 'chunksUsed'>>
  ): void {
    if (!traceId) return;

    const trace = this.traces.get(traceId);
    if (!trace) return;

    Object.assign(trace, metadata);
  }

  /**
   * End a trace and persist if configured
   */
  async endTrace(
    traceId: string,
    success: boolean,
    tokensUsed: number = 0
  ): Promise<RAGTrace | null> {
    if (!traceId) return null;

    const trace = this.traces.get(traceId);
    if (!trace) return null;

    trace.success = success;
    trace.tokensUsed = tokensUsed;

    // Calculate total latency from spans
    trace.totalLatencyMs = trace.spans.reduce((sum, span) => {
      if (span.durationMs) {
        return sum + span.durationMs;
      }
      return sum;
    }, 0);

    // Mark any running spans as error
    for (const span of trace.spans) {
      if (span.status === 'running') {
        span.status = 'error';
        span.errorMessage = 'Span not properly closed';
        span.endTime = Date.now();
        span.durationMs = span.endTime - span.startTime;
      }
    }

    if (this.config.logToConsole) {
      const status = success ? 'SUCCESS' : 'FAILURE';
      console.log(
        `[Trace ${traceId.substring(0, 8)}] Ended [${status}] (${trace.totalLatencyMs}ms, ${tokensUsed} tokens)`
      );
    }

    // Persist to database
    if (this.config.persistToDb && this.db) {
      await this.persistTrace(trace);
    }

    this.traces.delete(traceId);

    return trace;
  }

  /**
   * Persist trace to PostgreSQL
   */
  private async persistTrace(trace: RAGTrace): Promise<void> {
    if (!this.db) return;

    try {
      await this.db.query(
        `INSERT INTO rag_traces
         (trace_id, timestamp, user_id_hash, session_id, query_length,
          query_type, retrieval_strategy, success, total_latency_ms,
          tokens_used, chunks_retrieved, chunks_used, spans)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          trace.traceId,
          trace.timestamp,
          trace.userIdHash,
          trace.sessionId,
          trace.queryLength,
          trace.queryType,
          trace.retrievalStrategy,
          trace.success,
          trace.totalLatencyMs,
          trace.tokensUsed,
          trace.chunksRetrieved,
          trace.chunksUsed,
          JSON.stringify(trace.spans),
        ]
      );
    } catch (error) {
      console.error('[TracingService] Failed to persist trace:', error);
    }
  }

  /**
   * Hash user ID for privacy using SHA-256
   */
  private hashUserId(userId: string): string {
    return createHash('sha256')
      .update(userId)
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * Get trace statistics for monitoring
   */
  async getTraceStats(hours: number = 24): Promise<{
    totalTraces: number;
    successRate: number;
    avgLatency: number;
    p95Latency: number;
    spanBreakdown: Record<SpanName, { avgLatency: number; errorRate: number }>;
  }> {
    if (!this.db) {
      return {
        totalTraces: 0,
        successRate: 0,
        avgLatency: 0,
        p95Latency: 0,
        spanBreakdown: {} as Record<SpanName, { avgLatency: number; errorRate: number }>,
      };
    }

    const result = await this.db.query(
      `SELECT
         COUNT(*) as total,
         AVG(CASE WHEN success THEN 1 ELSE 0 END) as success_rate,
         AVG(total_latency_ms) as avg_latency,
         PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY total_latency_ms) as p95_latency,
         spans
       FROM rag_traces
       WHERE timestamp > NOW() - INTERVAL '${hours} hours'
       GROUP BY spans`
    );

    // Calculate span breakdown
    const spanStats: Record<string, { total: number; latency: number; errors: number }> = {};

    for (const row of result.rows) {
      const spans = row.spans || [];
      for (const span of spans) {
        if (!spanStats[span.name]) {
          spanStats[span.name] = { total: 0, latency: 0, errors: 0 };
        }
        spanStats[span.name].total++;
        spanStats[span.name].latency += span.durationMs || 0;
        if (span.status === 'error') spanStats[span.name].errors++;
      }
    }

    const spanBreakdown: Record<string, { avgLatency: number; errorRate: number }> = {};
    for (const [name, stats] of Object.entries(spanStats)) {
      spanBreakdown[name] = {
        avgLatency: stats.total > 0 ? stats.latency / stats.total : 0,
        errorRate: stats.total > 0 ? stats.errors / stats.total : 0,
      };
    }

    // Get aggregated stats
    const aggResult = await this.db.query(
      `SELECT
         COUNT(*) as total,
         AVG(CASE WHEN success THEN 1.0 ELSE 0.0 END) as success_rate,
         AVG(total_latency_ms) as avg_latency,
         PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY total_latency_ms) as p95_latency
       FROM rag_traces
       WHERE timestamp > NOW() - INTERVAL '${hours} hours'`
    );

    return {
      totalTraces: parseInt(aggResult.rows[0]?.total) || 0,
      successRate: parseFloat(aggResult.rows[0]?.success_rate) || 0,
      avgLatency: parseFloat(aggResult.rows[0]?.avg_latency) || 0,
      p95Latency: parseFloat(aggResult.rows[0]?.p95_latency) || 0,
      spanBreakdown: spanBreakdown as Record<SpanName, { avgLatency: number; errorRate: number }>,
    };
  }

  /**
   * Get recent traces for debugging
   */
  async getRecentTraces(limit: number = 10): Promise<RAGTrace[]> {
    if (!this.db) return [];

    const result = await this.db.query(
      `SELECT * FROM rag_traces
       ORDER BY timestamp DESC
       LIMIT $1`,
      [limit]
    );

    return result.rows.map(row => ({
      traceId: row.trace_id,
      timestamp: row.timestamp,
      userIdHash: row.user_id_hash,
      sessionId: row.session_id,
      queryLength: row.query_length,
      queryType: row.query_type,
      retrievalStrategy: row.retrieval_strategy,
      spans: row.spans,
      success: row.success,
      totalLatencyMs: row.total_latency_ms,
      tokensUsed: row.tokens_used,
      chunksRetrieved: row.chunks_retrieved,
      chunksUsed: row.chunks_used,
    }));
  }
}
