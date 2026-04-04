-- Migration 020: Heartbeat Engine (Spec 05)
-- Proactive background checks with cron scheduling

BEGIN;

-- ============================================
-- Heartbeat Definitions
-- ============================================

CREATE TABLE IF NOT EXISTS heartbeat_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID,
    user_id UUID REFERENCES users(id),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    cron VARCHAR(100) NOT NULL,
    type VARCHAR(20) NOT NULL DEFAULT 'data'
        CHECK (type IN ('data', 'agent')),
    level VARCHAR(20) NOT NULL DEFAULT 'company'
        CHECK (level IN ('company', 'user', 'learned')),
    config JSONB NOT NULL DEFAULT '{}',
    roles TEXT[] DEFAULT '{}',
    icon VARCHAR(10) DEFAULT '📋',
    priority VARCHAR(20) DEFAULT 'info'
        CHECK (priority IN ('critical', 'warning', 'info')),
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    source VARCHAR(20) NOT NULL DEFAULT 'custom'
        CHECK (source IN ('builtin', 'custom')),
    last_run_at TIMESTAMPTZ,
    last_result_summary TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_heartbeat_defs_tenant
ON heartbeat_definitions(tenant_id, enabled);

CREATE UNIQUE INDEX IF NOT EXISTS unique_heartbeat_per_tenant
ON heartbeat_definitions(COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), name);

-- ============================================
-- Heartbeat Results
-- ============================================

CREATE TABLE IF NOT EXISTS heartbeat_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    heartbeat_id UUID NOT NULL REFERENCES heartbeat_definitions(id) ON DELETE CASCADE,
    tenant_id UUID,
    user_id UUID,
    data JSONB NOT NULL,
    summary TEXT,
    priority VARCHAR(20) DEFAULT 'info',
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_heartbeat_results_undelivered
ON heartbeat_results(tenant_id, delivered_at)
WHERE delivered_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_heartbeat_results_heartbeat
ON heartbeat_results(heartbeat_id);

-- Comments
COMMENT ON TABLE heartbeat_definitions IS 'Proactive background check definitions with cron schedules';
COMMENT ON TABLE heartbeat_results IS 'Results from heartbeat executions, pending delivery to users';
COMMENT ON COLUMN heartbeat_definitions.config IS 'JSON: dataQuery {tool, args, selections, threshold} or agentTask {agent, task}';
COMMENT ON COLUMN heartbeat_results.delivered_at IS 'NULL = not yet shown to user, set when briefing is delivered';

COMMIT;
