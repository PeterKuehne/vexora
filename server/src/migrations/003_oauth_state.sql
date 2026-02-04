-- Migration 003: OAuth State Parameter Storage (CSRF Protection)
-- Created: 2026-01-22
-- Purpose: Store and validate OAuth state parameters to prevent CSRF attacks

-- Create oauth_states table for temporary state storage
CREATE TABLE IF NOT EXISTS oauth_states (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  state VARCHAR(64) UNIQUE NOT NULL,
  provider VARCHAR(20) NOT NULL, -- 'microsoft' or 'google'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  ip_address INET
);

-- Index for fast state lookup (only active/unused states)
CREATE INDEX IF NOT EXISTS oauth_states_state_idx
  ON oauth_states(state)
  WHERE used_at IS NULL;

-- Index for cleanup of expired states
CREATE INDEX IF NOT EXISTS oauth_states_expires_idx
  ON oauth_states(expires_at)
  WHERE used_at IS NULL;

-- Index for provider filtering
CREATE INDEX IF NOT EXISTS oauth_states_provider_idx
  ON oauth_states(provider);

-- Cleanup function for expired OAuth states
CREATE OR REPLACE FUNCTION cleanup_expired_oauth_states() RETURNS void AS $$
BEGIN
    -- Delete expired states (older than 10 minutes)
    DELETE FROM oauth_states
    WHERE expires_at < NOW();

    -- Delete used states older than 1 hour (keep for audit trail)
    DELETE FROM oauth_states
    WHERE used_at IS NOT NULL
      AND used_at < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;

-- Comment on table and columns
COMMENT ON TABLE oauth_states IS 'Temporary storage for OAuth state parameters to prevent CSRF attacks';
COMMENT ON COLUMN oauth_states.state IS 'Random state parameter sent to OAuth provider';
COMMENT ON COLUMN oauth_states.provider IS 'OAuth provider name (microsoft, google)';
COMMENT ON COLUMN oauth_states.expires_at IS 'State expiration time (typically 10 minutes)';
COMMENT ON COLUMN oauth_states.used_at IS 'Timestamp when state was consumed in callback';
COMMENT ON COLUMN oauth_states.ip_address IS 'IP address of the login request (for security audit)';
