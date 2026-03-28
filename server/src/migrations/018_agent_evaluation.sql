-- Migration 018: Agent Evaluation Framework
-- Benchmarks agent strategies (hybrid, cloud-only, local-only)

CREATE TABLE IF NOT EXISTS agent_evaluation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending',

  -- Aggregated metrics
  avg_key_facts_covered REAL,
  avg_groundedness REAL,
  hallucination_rate REAL,
  rag_usage_rate REAL,
  tool_reliability_rate REAL,
  avg_latency_ms INTEGER,
  total_cost_eur REAL,
  query_count INTEGER,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT
);

CREATE TABLE IF NOT EXISTS agent_evaluation_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES agent_evaluation_runs(id) ON DELETE CASCADE,
  golden_query_id TEXT NOT NULL,

  -- Classification
  classification_complexity TEXT,
  classification_reason TEXT,
  skip_pre_search BOOLEAN,

  -- Quality
  answer TEXT,
  key_facts_covered REAL,
  hallucination_detected BOOLEAN DEFAULT false,
  groundedness REAL,
  used_rag BOOLEAN DEFAULT false,
  rag_result_count INTEGER DEFAULT 0,

  -- Cost
  model TEXT,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  estimated_cost_eur REAL DEFAULT 0,

  -- Latency
  classification_ms INTEGER DEFAULT 0,
  pre_search_ms INTEGER DEFAULT 0,
  generation_ms INTEGER DEFAULT 0,
  total_ms INTEGER DEFAULT 0,

  -- Tool reliability
  tool_calls_attempted INTEGER DEFAULT 0,
  tool_calls_succeeded INTEGER DEFAULT 0,
  expected_tool_used BOOLEAN DEFAULT false,

  -- Debug link
  agent_task_id TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_eval_results_run ON agent_evaluation_results(run_id);
