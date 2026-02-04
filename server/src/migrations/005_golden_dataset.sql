-- Migration: Golden Dataset & Evaluation Framework
-- Author: Claude Code
-- Created: 2026-01-29
-- Description: Creates tables for RAG evaluation: golden_dataset, evaluation_runs, evaluation_results
-- Part of: Spec 1 - Foundation (Phase 0)

-- ===========================================
-- Golden Dataset Table
-- ===========================================
-- Curated query-answer pairs for objective RAG measurement

CREATE TABLE IF NOT EXISTS golden_dataset (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query TEXT NOT NULL,
  expected_answer TEXT NOT NULL,
  relevant_document_ids UUID[] NOT NULL,
  relevant_chunk_ids TEXT[],

  -- Categorization
  category VARCHAR(50) NOT NULL,
  difficulty VARCHAR(20) NOT NULL DEFAULT 'medium',

  -- For evaluation
  key_facts TEXT[] NOT NULL DEFAULT '{}',
  forbidden_content TEXT[] NOT NULL DEFAULT '{}',

  -- Metadata
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Last evaluation results (cached for quick reference)
  last_evaluated_at TIMESTAMP WITH TIME ZONE,
  last_precision_at_5 DECIMAL(4,3),
  last_recall_at_20 DECIMAL(4,3),
  last_groundedness DECIMAL(4,3),

  -- Constraints
  CONSTRAINT valid_category CHECK (
    category IN ('factual', 'comparative', 'procedural', 'relational', 'aggregative', 'multi_hop')
  ),
  CONSTRAINT valid_difficulty CHECK (
    difficulty IN ('easy', 'medium', 'hard')
  )
);

-- ===========================================
-- Evaluation Runs Table
-- ===========================================
-- Tracks each evaluation run with configuration and aggregate results

CREATE TABLE IF NOT EXISTS evaluation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version VARCHAR(50) NOT NULL,

  -- Configuration snapshot (RAG settings used for this run)
  config JSONB NOT NULL,

  -- Aggregate metrics
  avg_precision_at_5 DECIMAL(4,3),
  avg_recall_at_20 DECIMAL(4,3),
  avg_groundedness DECIMAL(4,3),
  avg_latency_ms INTEGER,

  -- Breakdown by category
  metrics_by_category JSONB,

  -- Status tracking
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,

  -- Metadata
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT valid_status CHECK (
    status IN ('pending', 'running', 'completed', 'failed')
  )
);

-- ===========================================
-- Evaluation Results Table
-- ===========================================
-- Individual query results within an evaluation run

CREATE TABLE IF NOT EXISTS evaluation_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES evaluation_runs(id) ON DELETE CASCADE,
  query_id UUID NOT NULL REFERENCES golden_dataset(id) ON DELETE CASCADE,

  -- Retrieval metrics (Precision@K)
  precision_at_1 DECIMAL(4,3),
  precision_at_3 DECIMAL(4,3),
  precision_at_5 DECIMAL(4,3),
  precision_at_10 DECIMAL(4,3),
  precision_at_20 DECIMAL(4,3),

  -- Retrieval metrics (Recall@K)
  recall_at_5 DECIMAL(4,3),
  recall_at_20 DECIMAL(4,3),

  -- Mean Reciprocal Rank
  mrr DECIMAL(4,3),

  -- Generation metrics
  groundedness DECIMAL(4,3),
  answer_relevance DECIMAL(4,3),
  key_facts_covered DECIMAL(4,3),
  hallucination_detected BOOLEAN DEFAULT FALSE,

  -- Latency breakdown (ms)
  latency_retrieval_ms INTEGER,
  latency_rerank_ms INTEGER,
  latency_generation_ms INTEGER,
  latency_total_ms INTEGER,

  -- Debug info
  retrieved_chunk_ids TEXT[],
  response_preview TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Unique constraint: one result per query per run
  CONSTRAINT unique_query_per_run UNIQUE (run_id, query_id)
);

-- ===========================================
-- Indexes for Performance
-- ===========================================

-- Golden Dataset indexes
CREATE INDEX IF NOT EXISTS idx_golden_dataset_category ON golden_dataset(category);
CREATE INDEX IF NOT EXISTS idx_golden_dataset_difficulty ON golden_dataset(difficulty);
CREATE INDEX IF NOT EXISTS idx_golden_dataset_created_by ON golden_dataset(created_by);

-- Evaluation Runs indexes
CREATE INDEX IF NOT EXISTS idx_evaluation_runs_version ON evaluation_runs(version);
CREATE INDEX IF NOT EXISTS idx_evaluation_runs_status ON evaluation_runs(status);
CREATE INDEX IF NOT EXISTS idx_evaluation_runs_created_at ON evaluation_runs(created_at DESC);

-- Evaluation Results indexes
CREATE INDEX IF NOT EXISTS idx_evaluation_results_run_id ON evaluation_results(run_id);
CREATE INDEX IF NOT EXISTS idx_evaluation_results_query_id ON evaluation_results(query_id);

-- ===========================================
-- Helper Function: Update timestamp
-- ===========================================

CREATE OR REPLACE FUNCTION update_golden_dataset_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for auto-updating updated_at
DROP TRIGGER IF EXISTS golden_dataset_updated_at ON golden_dataset;
CREATE TRIGGER golden_dataset_updated_at
  BEFORE UPDATE ON golden_dataset
  FOR EACH ROW
  EXECUTE FUNCTION update_golden_dataset_timestamp();

-- ===========================================
-- Comments
-- ===========================================

COMMENT ON TABLE golden_dataset IS 'Curated query-answer pairs for RAG evaluation benchmarking';
COMMENT ON TABLE evaluation_runs IS 'Tracks evaluation runs with configuration and aggregate metrics';
COMMENT ON TABLE evaluation_results IS 'Individual query results within an evaluation run';

COMMENT ON COLUMN golden_dataset.category IS 'Query type: factual, comparative, procedural, relational, aggregative, multi_hop';
COMMENT ON COLUMN golden_dataset.key_facts IS 'Facts that should appear in a correct answer';
COMMENT ON COLUMN golden_dataset.forbidden_content IS 'Content that indicates hallucination if present';
COMMENT ON COLUMN golden_dataset.relevant_chunk_ids IS 'Chunk IDs from Weaviate that are relevant to this query';

COMMENT ON COLUMN evaluation_runs.config IS 'JSON snapshot of RAG configuration used for this run';
COMMENT ON COLUMN evaluation_runs.metrics_by_category IS 'Aggregated metrics broken down by query category';

COMMENT ON COLUMN evaluation_results.mrr IS 'Mean Reciprocal Rank - position of first relevant result';
COMMENT ON COLUMN evaluation_results.groundedness IS 'How well the response is grounded in retrieved context';
