-- Migration 014: Skill auto-invocation control
-- Allows skills to be marked as "slash-command only" (not auto-invoked by agent)

ALTER TABLE skills ADD COLUMN IF NOT EXISTS disable_auto_invocation BOOLEAN DEFAULT false;
