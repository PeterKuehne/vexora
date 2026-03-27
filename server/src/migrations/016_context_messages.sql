-- Migration 016: Context-aware message persistence
-- Extends agent_messages to store structured tool-call/tool-result messages
-- so that multi-turn conversations retain full tool context.

-- Allow 'tool' role in agent_messages
ALTER TABLE agent_messages DROP CONSTRAINT IF EXISTS agent_messages_role_check;
ALTER TABLE agent_messages ADD CONSTRAINT agent_messages_role_check
  CHECK (role IN ('user', 'assistant', 'tool'));

-- Structured content (tool_use blocks, tool_result arrays) as JSONB
-- Existing TEXT content stays in `content` for backwards compat
ALTER TABLE agent_messages ADD COLUMN IF NOT EXISTS content_json JSONB;

-- tool_call_id for correlating tool-result messages
ALTER TABLE agent_messages ADD COLUMN IF NOT EXISTS tool_call_id VARCHAR(100);
