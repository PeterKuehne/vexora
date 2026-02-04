-- Migration 008: Observability
-- Part of RAG V2 Phase 5: Query Intelligence & Observability
--
-- Creates tables for RAG tracing and monitoring alerts

-- ============================================
-- RAG Traces Table
-- ============================================
CREATE TABLE IF NOT EXISTS rag_traces (
  id SERIAL PRIMARY KEY,
  trace_id UUID NOT NULL UNIQUE,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  user_id_hash VARCHAR(32) NOT NULL,
  session_id VARCHAR(100),
  query_length INTEGER NOT NULL,
  query_type VARCHAR(50),
  retrieval_strategy VARCHAR(50),
  success BOOLEAN NOT NULL,
  total_latency_ms INTEGER NOT NULL,
  tokens_used INTEGER DEFAULT 0,
  chunks_retrieved INTEGER DEFAULT 0,
  chunks_used INTEGER DEFAULT 0,
  spans JSONB NOT NULL DEFAULT '[]'
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_traces_timestamp ON rag_traces(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_traces_user ON rag_traces(user_id_hash);
CREATE INDEX IF NOT EXISTS idx_traces_success ON rag_traces(success);
CREATE INDEX IF NOT EXISTS idx_traces_session ON rag_traces(session_id);
CREATE INDEX IF NOT EXISTS idx_traces_query_type ON rag_traces(query_type);
CREATE INDEX IF NOT EXISTS idx_traces_latency ON rag_traces(total_latency_ms);

-- Partial index for failed traces (for debugging)
CREATE INDEX IF NOT EXISTS idx_traces_failures ON rag_traces(timestamp DESC) WHERE NOT success;

-- ============================================
-- Monitoring Alerts Table
-- ============================================
CREATE TABLE IF NOT EXISTS monitoring_alerts (
  id SERIAL PRIMARY KEY,
  alert_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  message TEXT NOT NULL,
  metadata JSONB,
  acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_by UUID REFERENCES users(id),
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_type ON monitoring_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON monitoring_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_created ON monitoring_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_unacknowledged ON monitoring_alerts(created_at DESC) WHERE NOT acknowledged;

-- ============================================
-- Query Router Analytics Table
-- ============================================
CREATE TABLE IF NOT EXISTS query_routing_analytics (
  id SERIAL PRIMARY KEY,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  query_hash VARCHAR(32) NOT NULL,
  query_type VARCHAR(50) NOT NULL,
  retrieval_strategy VARCHAR(50) NOT NULL,
  entities_found INTEGER DEFAULT 0,
  is_multi_hop BOOLEAN DEFAULT FALSE,
  required_graph BOOLEAN DEFAULT FALSE,
  required_table BOOLEAN DEFAULT FALSE,
  routing_confidence DECIMAL(4,3),
  actual_success BOOLEAN,
  latency_ms INTEGER
);

CREATE INDEX IF NOT EXISTS idx_routing_timestamp ON query_routing_analytics(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_routing_type ON query_routing_analytics(query_type);
CREATE INDEX IF NOT EXISTS idx_routing_strategy ON query_routing_analytics(retrieval_strategy);

-- ============================================
-- Guardrails Events Table
-- ============================================
CREATE TABLE IF NOT EXISTS guardrails_events (
  id SERIAL PRIMARY KEY,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('input_blocked', 'input_warning', 'output_redacted', 'output_warning', 'rate_limited')),
  user_id_hash VARCHAR(32) NOT NULL,
  details JSONB NOT NULL DEFAULT '{}',
  query_hash VARCHAR(32)
);

CREATE INDEX IF NOT EXISTS idx_guardrails_timestamp ON guardrails_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_guardrails_type ON guardrails_events(event_type);
CREATE INDEX IF NOT EXISTS idx_guardrails_user ON guardrails_events(user_id_hash);

-- ============================================
-- Views for Monitoring Dashboard
-- ============================================

-- Hourly trace statistics
CREATE OR REPLACE VIEW trace_stats_hourly AS
SELECT
  DATE_TRUNC('hour', timestamp) as hour,
  COUNT(*) as total_traces,
  COUNT(*) FILTER (WHERE success) as successful_traces,
  ROUND(AVG(total_latency_ms)::numeric, 2) as avg_latency_ms,
  ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY total_latency_ms)::numeric, 2) as p95_latency_ms,
  ROUND(AVG(tokens_used)::numeric, 0) as avg_tokens,
  ROUND(AVG(chunks_retrieved)::numeric, 1) as avg_chunks_retrieved,
  ROUND(AVG(chunks_used)::numeric, 1) as avg_chunks_used
FROM rag_traces
WHERE timestamp > NOW() - INTERVAL '7 days'
GROUP BY DATE_TRUNC('hour', timestamp)
ORDER BY hour DESC;

-- Query type distribution
CREATE OR REPLACE VIEW query_type_stats AS
SELECT
  query_type,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE success) as successful,
  ROUND(100.0 * COUNT(*) FILTER (WHERE success) / NULLIF(COUNT(*), 0), 1) as success_rate,
  ROUND(AVG(total_latency_ms)::numeric, 2) as avg_latency_ms
FROM rag_traces
WHERE timestamp > NOW() - INTERVAL '24 hours'
  AND query_type IS NOT NULL
GROUP BY query_type
ORDER BY total DESC;

-- Retrieval strategy performance
CREATE OR REPLACE VIEW strategy_performance AS
SELECT
  retrieval_strategy,
  COUNT(*) as total,
  ROUND(100.0 * COUNT(*) FILTER (WHERE success) / NULLIF(COUNT(*), 0), 1) as success_rate,
  ROUND(AVG(total_latency_ms)::numeric, 2) as avg_latency_ms,
  ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY total_latency_ms)::numeric, 2) as p95_latency_ms
FROM rag_traces
WHERE timestamp > NOW() - INTERVAL '24 hours'
  AND retrieval_strategy IS NOT NULL
GROUP BY retrieval_strategy
ORDER BY total DESC;

-- Guardrails event summary
CREATE OR REPLACE VIEW guardrails_summary AS
SELECT
  DATE_TRUNC('hour', timestamp) as hour,
  event_type,
  COUNT(*) as count
FROM guardrails_events
WHERE timestamp > NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', timestamp), event_type
ORDER BY hour DESC, count DESC;

-- ============================================
-- Comments
-- ============================================
COMMENT ON TABLE rag_traces IS 'End-to-end traces for RAG queries with span details';
COMMENT ON TABLE monitoring_alerts IS 'System alerts for monitoring and incident response';
COMMENT ON TABLE query_routing_analytics IS 'Analytics for query routing decisions';
COMMENT ON TABLE guardrails_events IS 'Events logged by input/output guardrails';
COMMENT ON VIEW trace_stats_hourly IS 'Hourly aggregated trace statistics';
COMMENT ON VIEW query_type_stats IS 'Query type distribution and performance';
COMMENT ON VIEW strategy_performance IS 'Retrieval strategy performance metrics';
COMMENT ON VIEW guardrails_summary IS 'Hourly guardrails event summary';
