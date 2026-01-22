-- Migration: Enterprise Authentication System Setup
-- Author: ADW Coding Agent
-- Created: 2026-01-22
-- Description: Creates users, refresh_tokens, audit_logs tables and extends documents table for multi-user support

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('Employee', 'Manager', 'Admin')),
    department VARCHAR(100),
    provider VARCHAR(50) NOT NULL CHECK (provider IN ('microsoft', 'google')),
    provider_id VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE,
    UNIQUE(provider, provider_id)
);

-- Create refresh_tokens table
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    user_email VARCHAR(255) NOT NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id VARCHAR(255),
    result VARCHAR(20) NOT NULL CHECK (result IN ('success', 'failure', 'denied')),
    ip_address INET,
    user_agent TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Check if documents table exists and alter it
DO $$
BEGIN
    -- Add owner_id column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'documents' AND column_name = 'owner_id'
    ) THEN
        ALTER TABLE documents ADD COLUMN owner_id UUID REFERENCES users(id);
    END IF;

    -- Add department column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'documents' AND column_name = 'department'
    ) THEN
        ALTER TABLE documents ADD COLUMN department VARCHAR(100);
    END IF;

    -- Add classification column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'documents' AND column_name = 'classification'
    ) THEN
        ALTER TABLE documents ADD COLUMN classification VARCHAR(20) DEFAULT 'internal'
            CHECK (classification IN ('public', 'internal', 'confidential', 'restricted'));
    END IF;

    -- Add allowed_roles column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'documents' AND column_name = 'allowed_roles'
    ) THEN
        ALTER TABLE documents ADD COLUMN allowed_roles TEXT[];
    END IF;

    -- Add allowed_users column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'documents' AND column_name = 'allowed_users'
    ) THEN
        ALTER TABLE documents ADD COLUMN allowed_users UUID[];
    END IF;
END
$$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS users_email_idx ON users(email);
CREATE INDEX IF NOT EXISTS users_provider_idx ON users(provider, provider_id);
CREATE INDEX IF NOT EXISTS users_role_idx ON users(role);
CREATE INDEX IF NOT EXISTS users_department_idx ON users(department);
CREATE INDEX IF NOT EXISTS users_active_idx ON users(is_active);

CREATE INDEX IF NOT EXISTS refresh_tokens_user_idx ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS refresh_tokens_expires_idx ON refresh_tokens(expires_at);

CREATE INDEX IF NOT EXISTS documents_owner_idx ON documents(owner_id);
CREATE INDEX IF NOT EXISTS documents_department_idx ON documents(department);
CREATE INDEX IF NOT EXISTS documents_classification_idx ON documents(classification);

CREATE INDEX IF NOT EXISTS audit_logs_user_created_idx ON audit_logs(user_id, created_at);
CREATE INDEX IF NOT EXISTS audit_logs_action_created_idx ON audit_logs(action, created_at);
CREATE INDEX IF NOT EXISTS audit_logs_result_idx ON audit_logs(result);

-- Enable Row Level Security on documents table
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies for documents table
-- Policy 1: Public documents are visible to everyone
CREATE POLICY documents_public_policy ON documents
    FOR SELECT
    USING (classification = 'public');

-- Policy 2: Department-based access - users can see documents from their department
CREATE POLICY documents_department_policy ON documents
    FOR SELECT
    USING (
        department = current_setting('app.user_department', true)
        AND classification IN ('internal', 'public')
    );

-- Policy 3: Owner access - users can see their own documents
CREATE POLICY documents_owner_policy ON documents
    FOR ALL
    USING (owner_id::text = current_setting('app.user_id', true));

-- Policy 4: Role-based access - documents with allowed roles
CREATE POLICY documents_role_policy ON documents
    FOR SELECT
    USING (
        allowed_roles IS NULL
        OR current_setting('app.user_role', true) = ANY(allowed_roles)
    );

-- Policy 5: User-specific access - documents with allowed users
CREATE POLICY documents_user_policy ON documents
    FOR SELECT
    USING (
        allowed_users IS NULL
        OR current_setting('app.user_id', true)::uuid = ANY(allowed_users)
    );

-- Policy 6: Admin access - admins can see everything
CREATE POLICY documents_admin_policy ON documents
    FOR ALL
    USING (current_setting('app.user_role', true) = 'Admin');

-- Create a function to set user context for RLS
-- First drop if exists to avoid parameter name conflicts
DROP FUNCTION IF EXISTS set_user_context(UUID, VARCHAR(50), VARCHAR(100));

CREATE FUNCTION set_user_context(
    user_id_param UUID,
    user_role_param VARCHAR(50),
    user_department_param VARCHAR(100)
) RETURNS void AS $$
BEGIN
    PERFORM set_config('app.user_id', user_id_param::text, true);
    PERFORM set_config('app.user_role', user_role_param, true);
    PERFORM set_config('app.user_department', user_department_param, true);
END;
$$ LANGUAGE plpgsql;

-- Create function to clean up expired tokens
DROP FUNCTION IF EXISTS cleanup_expired_tokens();

CREATE FUNCTION cleanup_expired_tokens() RETURNS void AS $$
BEGIN
    DELETE FROM refresh_tokens WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Optional: Create a trigger to automatically clean up expired tokens
-- (This could be done via cron job instead)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
-- SELECT cron.schedule('cleanup-tokens', '0 2 * * *', 'SELECT cleanup_expired_tokens();');

-- Insert a default admin user (for development/testing)
-- In production, this should be created through the OAuth flow
INSERT INTO users (email, name, role, department, provider, provider_id)
VALUES (
    'admin@vexora.local',
    'System Administrator',
    'Admin',
    'IT',
    'microsoft',
    'dev-admin-001'
) ON CONFLICT (email) DO NOTHING;

-- Grant necessary permissions
-- (Assuming the application connects with the same user that owns the tables)

COMMENT ON TABLE users IS 'Enterprise users with SSO authentication';
COMMENT ON TABLE refresh_tokens IS 'JWT refresh tokens for session management';
COMMENT ON TABLE audit_logs IS 'Compliance audit trail for user actions';
COMMENT ON COLUMN documents.owner_id IS 'User who uploaded the document';
COMMENT ON COLUMN documents.department IS 'Department classification for access control';
COMMENT ON COLUMN documents.classification IS 'Security classification: public, internal, confidential, restricted';
COMMENT ON COLUMN documents.allowed_roles IS 'Roles explicitly allowed to access this document';
COMMENT ON COLUMN documents.allowed_users IS 'Specific users allowed to access this document';