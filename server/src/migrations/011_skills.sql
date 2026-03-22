-- Migration 011: Skill System (Phase 3 - Schwarm-Skill-System)
-- Creates tables for skills, voting, and execution tracking

BEGIN;

-- ============================================
-- Skills
-- ============================================

CREATE TABLE IF NOT EXISTS skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  created_by UUID NOT NULL REFERENCES users(id),
  name VARCHAR(200) NOT NULL,
  slug VARCHAR(200) NOT NULL,
  description TEXT,
  definition JSONB NOT NULL,
  scope VARCHAR(20) NOT NULL DEFAULT 'personal'
    CHECK (scope IN ('personal', 'team', 'swarm')),
  department VARCHAR(100),
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  promoted_at TIMESTAMPTZ,
  upvotes INTEGER NOT NULL DEFAULT 0,
  downvotes INTEGER NOT NULL DEFAULT 0,
  adoption_count INTEGER NOT NULL DEFAULT 0,
  execution_count INTEGER NOT NULL DEFAULT 0,
  avg_duration_ms INTEGER NOT NULL DEFAULT 0,
  is_builtin BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  category VARCHAR(100),
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique slug per tenant (NULL tenant = global)
CREATE UNIQUE INDEX idx_skills_tenant_slug ON skills(COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), slug);

-- ============================================
-- Skill Votes
-- ============================================

CREATE TABLE IF NOT EXISTS skill_votes (
  skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  vote SMALLINT NOT NULL CHECK (vote IN (-1, 1)),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (skill_id, user_id)
);

-- ============================================
-- Skill Executions
-- ============================================

CREATE TABLE IF NOT EXISTS skill_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  task_id UUID REFERENCES agent_tasks(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES users(id),
  inputs JSONB,
  outputs JSONB,
  status VARCHAR(20) NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'completed', 'failed')),
  duration_ms INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- Indices
-- ============================================

CREATE INDEX idx_skills_scope_active ON skills(scope, is_active);
CREATE INDEX idx_skills_department ON skills(department) WHERE scope = 'team';
CREATE INDEX idx_skills_created_by ON skills(created_by);
CREATE INDEX idx_skills_category ON skills(category) WHERE category IS NOT NULL;
CREATE INDEX idx_skill_votes_skill ON skill_votes(skill_id);
CREATE INDEX idx_skill_executions_skill ON skill_executions(skill_id, created_at DESC);
CREATE INDEX idx_skill_executions_user ON skill_executions(user_id);

-- ============================================
-- Auto-update trigger for updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_skills_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_skills_updated_at
  BEFORE UPDATE ON skills
  FOR EACH ROW
  EXECUTE FUNCTION update_skills_updated_at();

-- ============================================
-- Row Level Security
-- ============================================

ALTER TABLE skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE skill_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE skill_executions ENABLE ROW LEVEL SECURITY;

-- Skills: visibility based on scope
CREATE POLICY skills_select ON skills
  FOR SELECT
  USING (
    -- Admin sees all
    current_setting('app.user_role', true) = 'Admin'
    -- Builtin/Swarm: everyone
    OR (scope IN ('swarm') AND is_active = true)
    OR (is_builtin = true AND is_active = true)
    -- Team: same department
    OR (scope = 'team' AND is_active = true AND department = current_setting('app.user_department', true))
    -- Personal: owner only
    OR (scope = 'personal' AND created_by::text = current_setting('app.user_id', true))
  );

CREATE POLICY skills_insert ON skills
  FOR INSERT
  WITH CHECK (
    created_by::text = current_setting('app.user_id', true)
    OR current_setting('app.user_role', true) = 'Admin'
  );

CREATE POLICY skills_update ON skills
  FOR UPDATE
  USING (
    created_by::text = current_setting('app.user_id', true)
    OR current_setting('app.user_role', true) = 'Admin'
  );

CREATE POLICY skills_delete ON skills
  FOR DELETE
  USING (
    created_by::text = current_setting('app.user_id', true)
    OR current_setting('app.user_role', true) = 'Admin'
  );

-- Skill votes: anyone who can see the skill can vote
CREATE POLICY skill_votes_select ON skill_votes
  FOR SELECT
  USING (skill_id IN (SELECT id FROM skills));

CREATE POLICY skill_votes_insert ON skill_votes
  FOR INSERT
  WITH CHECK (
    user_id::text = current_setting('app.user_id', true)
    AND skill_id IN (SELECT id FROM skills)
  );

CREATE POLICY skill_votes_update ON skill_votes
  FOR UPDATE
  USING (user_id::text = current_setting('app.user_id', true));

CREATE POLICY skill_votes_delete ON skill_votes
  FOR DELETE
  USING (user_id::text = current_setting('app.user_id', true));

-- Skill executions: users see their own
CREATE POLICY skill_executions_select ON skill_executions
  FOR SELECT
  USING (
    user_id::text = current_setting('app.user_id', true)
    OR current_setting('app.user_role', true) = 'Admin'
  );

CREATE POLICY skill_executions_insert ON skill_executions
  FOR INSERT
  WITH CHECK (user_id::text = current_setting('app.user_id', true));

CREATE POLICY skill_executions_update ON skill_executions
  FOR UPDATE
  USING (
    user_id::text = current_setting('app.user_id', true)
    OR current_setting('app.user_role', true) = 'Admin'
  );

COMMIT;
