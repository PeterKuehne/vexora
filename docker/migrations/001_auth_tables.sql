-- Vexora Authentication Migration: 001_auth_tables.sql
-- Creates users and refresh_tokens tables for Enterprise Authentication
-- Run: psql -h localhost -U postgres -d vexora -f 001_auth_tables.sql

-- ============================================================================
-- USERS TABLE
-- ============================================================================
-- Stores user accounts from SSO providers (Microsoft, Google)

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Core identity
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    avatar_url TEXT,

    -- Role-based access control (RBAC)
    -- Values: 'employee', 'manager', 'admin'
    role VARCHAR(50) NOT NULL DEFAULT 'employee',

    -- Department for document access control
    department VARCHAR(100),

    -- SSO provider information
    -- Values: 'microsoft', 'google', 'local'
    provider VARCHAR(50) NOT NULL,
    provider_id VARCHAR(255) NOT NULL,

    -- Account status
    is_active BOOLEAN NOT NULL DEFAULT true,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Ensure unique provider identity
    CONSTRAINT users_provider_unique UNIQUE (provider, provider_id)
);

-- Indexes for users table
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_provider ON users(provider, provider_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_department ON users(department);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active) WHERE is_active = true;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- REFRESH TOKENS TABLE
-- ============================================================================
-- Stores hashed refresh tokens for session management
-- Access tokens are short-lived (15min), refresh tokens are long-lived (30 days)

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- User reference
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Token hash (never store raw tokens!)
    -- Use bcrypt or similar for hashing
    token_hash VARCHAR(255) NOT NULL,

    -- Token metadata
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Device/session info (optional, for security)
    user_agent TEXT,
    ip_address INET,

    -- Revocation support
    revoked_at TIMESTAMP WITH TIME ZONE,
    is_revoked BOOLEAN NOT NULL DEFAULT false
);

-- Indexes for refresh_tokens table
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_not_revoked ON refresh_tokens(user_id)
    WHERE is_revoked = false AND expires_at > CURRENT_TIMESTAMP;

-- ============================================================================
-- AUDIT LOGS TABLE
-- ============================================================================
-- Tracks security-relevant events for compliance

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- User info (denormalized for historical accuracy)
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    user_email VARCHAR(255),

    -- Action details
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100),
    resource_id VARCHAR(255),
    result VARCHAR(50) NOT NULL DEFAULT 'success',

    -- Request context
    ip_address INET,
    user_agent TEXT,

    -- Additional data as JSON
    metadata JSONB DEFAULT '{}',

    -- Timestamp (append-only, no updates)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for audit_logs table
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_action ON audit_logs(user_id, action, created_at DESC);

-- ============================================================================
-- EXTEND DOCUMENTS TABLE FOR AUTHORIZATION
-- ============================================================================
-- Add ownership and access control columns to existing documents table

-- Add new columns if they don't exist
DO $$
BEGIN
    -- Owner of the document (uploader)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'documents' AND column_name = 'owner_id') THEN
        ALTER TABLE documents ADD COLUMN owner_id UUID REFERENCES users(id) ON DELETE SET NULL;
    END IF;

    -- Department for department-based access
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'documents' AND column_name = 'department') THEN
        ALTER TABLE documents ADD COLUMN department VARCHAR(100);
    END IF;

    -- Classification level: public, internal, confidential, restricted
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'documents' AND column_name = 'classification') THEN
        ALTER TABLE documents ADD COLUMN classification VARCHAR(50) NOT NULL DEFAULT 'public';
    END IF;

    -- Allowed roles (RBAC)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'documents' AND column_name = 'allowed_roles') THEN
        ALTER TABLE documents ADD COLUMN allowed_roles TEXT[] DEFAULT '{}';
    END IF;

    -- Allowed users (explicit user-level access)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'documents' AND column_name = 'allowed_users') THEN
        ALTER TABLE documents ADD COLUMN allowed_users UUID[] DEFAULT '{}';
    END IF;
END $$;

-- Indexes for document authorization
CREATE INDEX IF NOT EXISTS idx_documents_owner_id ON documents(owner_id);
CREATE INDEX IF NOT EXISTS idx_documents_department ON documents(department);
CREATE INDEX IF NOT EXISTS idx_documents_classification ON documents(classification);
CREATE INDEX IF NOT EXISTS idx_documents_allowed_roles ON documents USING GIN(allowed_roles);
CREATE INDEX IF NOT EXISTS idx_documents_allowed_users ON documents USING GIN(allowed_users);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) FOR DOCUMENTS
-- ============================================================================
-- Enables automatic filtering of documents based on user permissions

-- Enable RLS on documents table
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS documents_public_policy ON documents;
DROP POLICY IF EXISTS documents_department_policy ON documents;
DROP POLICY IF EXISTS documents_owner_policy ON documents;
DROP POLICY IF EXISTS documents_role_policy ON documents;
DROP POLICY IF EXISTS documents_user_policy ON documents;
DROP POLICY IF EXISTS documents_admin_policy ON documents;
DROP POLICY IF EXISTS documents_select_policy ON documents;

-- Create combined SELECT policy for documents
-- This policy checks all access conditions in order of specificity
CREATE POLICY documents_select_policy ON documents
    FOR SELECT
    USING (
        -- Public documents: everyone can see
        classification = 'public'
        OR
        -- Owner can always see their own documents
        owner_id::text = current_setting('app.current_user_id', true)
        OR
        -- Admin can see all documents
        current_setting('app.current_user_role', true) = 'admin'
        OR
        -- Department match for internal documents
        (classification = 'internal' AND department = current_setting('app.current_user_department', true))
        OR
        -- Manager can see confidential in their department
        (classification = 'confidential'
         AND current_setting('app.current_user_role', true) IN ('manager', 'admin')
         AND department = current_setting('app.current_user_department', true))
        OR
        -- Explicit role access
        current_setting('app.current_user_role', true) = ANY(allowed_roles)
        OR
        -- Explicit user access
        current_setting('app.current_user_id', true)::uuid = ANY(allowed_users)
    );

-- Policy for INSERT: Users can create documents they own
CREATE POLICY documents_insert_policy ON documents
    FOR INSERT
    WITH CHECK (
        owner_id::text = current_setting('app.current_user_id', true)
        OR current_setting('app.current_user_role', true) = 'admin'
    );

-- Policy for UPDATE: Owner or admin can update
CREATE POLICY documents_update_policy ON documents
    FOR UPDATE
    USING (
        owner_id::text = current_setting('app.current_user_id', true)
        OR current_setting('app.current_user_role', true) = 'admin'
    );

-- Policy for DELETE: Owner or admin can delete
CREATE POLICY documents_delete_policy ON documents
    FOR DELETE
    USING (
        owner_id::text = current_setting('app.current_user_id', true)
        OR current_setting('app.current_user_role', true) = 'admin'
    );

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to set user context for RLS
CREATE OR REPLACE FUNCTION set_user_context(
    p_user_id UUID,
    p_user_role VARCHAR,
    p_user_department VARCHAR
) RETURNS void AS $$
BEGIN
    PERFORM set_config('app.current_user_id', COALESCE(p_user_id::text, ''), true);
    PERFORM set_config('app.current_user_role', COALESCE(p_user_role, 'employee'), true);
    PERFORM set_config('app.current_user_department', COALESCE(p_user_department, ''), true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clear user context
CREATE OR REPLACE FUNCTION clear_user_context() RETURNS void AS $$
BEGIN
    PERFORM set_config('app.current_user_id', '', true);
    PERFORM set_config('app.current_user_role', '', true);
    PERFORM set_config('app.current_user_department', '', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
    table_count INTEGER;
BEGIN
    -- Count auth-related tables
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name IN ('users', 'refresh_tokens', 'audit_logs');

    IF table_count = 3 THEN
        RAISE NOTICE 'Authentication tables created successfully!';
        RAISE NOTICE 'Tables: users, refresh_tokens, audit_logs';
        RAISE NOTICE 'Documents table extended with: owner_id, department, classification, allowed_roles, allowed_users';
        RAISE NOTICE 'Row Level Security enabled on documents table';
    ELSE
        RAISE WARNING 'Some authentication tables may be missing. Found: %', table_count;
    END IF;
END $$;
