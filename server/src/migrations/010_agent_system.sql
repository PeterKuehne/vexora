-- Migration 010: Agent System
-- Creates tables for agent task execution and step tracking

BEGIN;

-- ============================================
-- Agent Tasks
-- ============================================

CREATE TABLE IF NOT EXISTS agent_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  tenant_id UUID,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  query TEXT NOT NULL,
  model VARCHAR(100) NOT NULL,
  result JSONB,
  error TEXT,
  total_steps INTEGER DEFAULT 0,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- Agent Steps
-- ============================================

CREATE TABLE IF NOT EXISTS agent_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES agent_tasks(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  thought TEXT,
  tool_name VARCHAR(100),
  tool_input JSONB,
  tool_output TEXT,
  tokens_used INTEGER DEFAULT 0,
  duration_ms INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- Indices
-- ============================================

CREATE INDEX idx_agent_tasks_user_id ON agent_tasks(user_id);
CREATE INDEX idx_agent_tasks_tenant_id ON agent_tasks(tenant_id) WHERE tenant_id IS NOT NULL;
CREATE INDEX idx_agent_tasks_conversation_id ON agent_tasks(conversation_id) WHERE conversation_id IS NOT NULL;
CREATE INDEX idx_agent_tasks_status ON agent_tasks(status);
CREATE INDEX idx_agent_tasks_created_at ON agent_tasks(created_at DESC);
CREATE INDEX idx_agent_steps_task_id ON agent_steps(task_id);
CREATE INDEX idx_agent_steps_task_step ON agent_steps(task_id, step_number);

-- ============================================
-- Auto-update trigger for updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_agent_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_agent_tasks_updated_at
  BEFORE UPDATE ON agent_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_agent_tasks_updated_at();

-- ============================================
-- Row Level Security
-- ============================================

ALTER TABLE agent_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_steps ENABLE ROW LEVEL SECURITY;

-- Users see their own tasks
CREATE POLICY agent_tasks_user_select ON agent_tasks
  FOR SELECT
  USING (
    user_id::text = current_setting('app.user_id', true)
    OR current_setting('app.user_role', true) = 'Admin'
    OR (
      current_setting('app.user_role', true) = 'Manager'
      AND tenant_id::text = current_setting('app.tenant_id', true)
    )
  );

CREATE POLICY agent_tasks_user_insert ON agent_tasks
  FOR INSERT
  WITH CHECK (user_id::text = current_setting('app.user_id', true));

CREATE POLICY agent_tasks_user_update ON agent_tasks
  FOR UPDATE
  USING (
    user_id::text = current_setting('app.user_id', true)
    OR current_setting('app.user_role', true) = 'Admin'
  );

-- Steps follow task visibility
CREATE POLICY agent_steps_select ON agent_steps
  FOR SELECT
  USING (
    task_id IN (SELECT id FROM agent_tasks)
  );

CREATE POLICY agent_steps_insert ON agent_steps
  FOR INSERT
  WITH CHECK (
    task_id IN (SELECT id FROM agent_tasks WHERE user_id::text = current_setting('app.user_id', true))
  );

COMMIT;
