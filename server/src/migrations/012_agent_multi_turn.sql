-- Migration 012: Multi-turn agent conversations
-- Adds agent_messages table for conversation history and turn tracking

-- Conversation messages (user ↔ agent)
CREATE TABLE IF NOT EXISTS agent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES agent_tasks(id) ON DELETE CASCADE,
  turn_number INTEGER NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_messages_task ON agent_messages(task_id, turn_number);

-- Link steps to turns
ALTER TABLE agent_steps ADD COLUMN IF NOT EXISTS turn_number INTEGER DEFAULT 1;

-- Add 'awaiting_input' status
ALTER TABLE agent_tasks DROP CONSTRAINT IF EXISTS agent_tasks_status_check;
ALTER TABLE agent_tasks ADD CONSTRAINT agent_tasks_status_check
  CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled', 'awaiting_input'));

-- RLS for agent_messages (follows task visibility)
ALTER TABLE agent_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY agent_messages_select ON agent_messages
  FOR SELECT USING (task_id IN (SELECT id FROM agent_tasks));

CREATE POLICY agent_messages_insert ON agent_messages
  FOR INSERT WITH CHECK (
    task_id IN (SELECT id FROM agent_tasks WHERE user_id::text = current_setting('app.user_id', true))
  );
