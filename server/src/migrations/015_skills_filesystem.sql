-- Migration 015: Skills filesystem support
-- Skills can now be stored as SKILL.md files on disk instead of (or in addition to) DB JSONB

ALTER TABLE skills ADD COLUMN IF NOT EXISTS file_path VARCHAR(500);
ALTER TABLE skills ADD COLUMN IF NOT EXISTS source_url VARCHAR(1000);

CREATE INDEX IF NOT EXISTS idx_skills_file_path ON skills(file_path) WHERE file_path IS NOT NULL;

-- definition becomes nullable — skills with file_path don't need it
ALTER TABLE skills ALTER COLUMN definition DROP NOT NULL;
