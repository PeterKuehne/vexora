-- Migration 019: Expert Agents (Spec 03 - Expert Agent Harness)
-- Stores Expert Agent configurations in DB (Single Source of Truth)
-- Built-in templates seeded from Markdown files at startup

BEGIN;

-- ============================================
-- Expert Agents
-- ============================================

CREATE TABLE IF NOT EXISTS expert_agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID,
    name VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    avatar_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    model VARCHAR(100) NOT NULL DEFAULT 'gpt-oss-120b',
    max_steps INTEGER NOT NULL DEFAULT 15,
    roles TEXT[] DEFAULT '{}',
    rules TEXT[] DEFAULT '{}',
    tools TEXT[] NOT NULL DEFAULT '{}',
    instructions TEXT NOT NULL,
    source VARCHAR(20) NOT NULL DEFAULT 'custom'
        CHECK (source IN ('builtin', 'custom')),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Note: unique constraint uses COALESCE to handle NULL tenant_id
    -- (PostgreSQL treats NULL != NULL in unique constraints)
    -- See unique index below
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_expert_agents_tenant
ON expert_agents(tenant_id);

-- NULL-safe unique: COALESCE maps NULL tenant_id to a zero UUID
CREATE UNIQUE INDEX IF NOT EXISTS unique_agent_per_tenant
ON expert_agents(COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), name);

CREATE INDEX IF NOT EXISTS idx_expert_agents_active
ON expert_agents(is_active);

CREATE INDEX IF NOT EXISTS idx_expert_agents_source
ON expert_agents(source);

-- Comments
COMMENT ON TABLE expert_agents IS 'Expert Agent configurations — the inner organs of the Hive Mind';
COMMENT ON COLUMN expert_agents.name IS 'Unique kebab-case identifier, used as tool name in Hive Mind';
COMMENT ON COLUMN expert_agents.roles IS 'UserRoles allowed to use this agent (empty = all roles)';
COMMENT ON COLUMN expert_agents.rules IS 'Behavioral guardrails injected into agent system prompt';
COMMENT ON COLUMN expert_agents.tools IS 'Tool whitelist — only these tools are available to this agent';
COMMENT ON COLUMN expert_agents.instructions IS 'Markdown system prompt defining agent role and behavior';
COMMENT ON COLUMN expert_agents.source IS 'builtin = seeded from template, custom = created by admin';

COMMIT;
