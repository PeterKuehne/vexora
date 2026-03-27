-- Migration 013: Track document source (upload vs agent-generated)
-- Enables knowledge feedback loop: agents can create documents that are traceable to tasks

ALTER TABLE documents ADD COLUMN IF NOT EXISTS source_type VARCHAR(20) DEFAULT 'upload';
ALTER TABLE documents ADD COLUMN IF NOT EXISTS source_task_id UUID REFERENCES agent_tasks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_documents_source_type ON documents(source_type);
CREATE INDEX IF NOT EXISTS idx_documents_source_task_id ON documents(source_task_id) WHERE source_task_id IS NOT NULL;
