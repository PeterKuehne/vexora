-- Migration: Token Rotation and Query Optimization
-- Author: Claude Best Practices Implementation
-- Created: 2026-01-22
-- Description: Adds token_lookup for performance and implements refresh token rotation

-- Add token_lookup column for fast token verification (SHA-256)
ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS token_lookup VARCHAR(64) UNIQUE;

-- Add revocation tracking for token rotation
ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS revoked BOOLEAN DEFAULT FALSE;
ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS revoked_reason VARCHAR(100);

-- Add rotation tracking
ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS rotated_to UUID REFERENCES refresh_tokens(id) ON DELETE SET NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS refresh_tokens_lookup_idx ON refresh_tokens(token_lookup) WHERE NOT revoked;
CREATE INDEX IF NOT EXISTS refresh_tokens_revoked_idx ON refresh_tokens(revoked);
CREATE INDEX IF NOT EXISTS refresh_tokens_user_active_idx ON refresh_tokens(user_id, revoked, expires_at);

-- Add comment for documentation
COMMENT ON COLUMN refresh_tokens.token_lookup IS 'SHA-256 hash of token for fast lookup without bcrypt comparison';
COMMENT ON COLUMN refresh_tokens.revoked IS 'Token has been revoked (used for rotation detection)';
COMMENT ON COLUMN refresh_tokens.rotated_to IS 'Points to the new token after rotation';

-- Update cleanup function to also remove revoked tokens
CREATE OR REPLACE FUNCTION cleanup_expired_tokens() RETURNS void AS $$
BEGIN
    -- Delete expired tokens
    DELETE FROM refresh_tokens WHERE expires_at < NOW();

    -- Delete revoked tokens older than 90 days (for audit trail)
    DELETE FROM refresh_tokens WHERE revoked = TRUE AND revoked_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- Create function to detect refresh token reuse (security breach)
CREATE OR REPLACE FUNCTION detect_token_reuse() RETURNS TRIGGER AS $$
BEGIN
    -- If attempting to use a revoked token, log security event
    IF OLD.revoked = TRUE THEN
        INSERT INTO audit_logs (
            user_id,
            user_email,
            action,
            resource_type,
            result,
            metadata
        ) VALUES (
            OLD.user_id,
            (SELECT email FROM users WHERE id = OLD.user_id),
            'TOKEN_REUSE_ATTEMPT',
            'refresh_token',
            'denied',
            jsonb_build_object(
                'token_id', OLD.id,
                'revoked_at', OLD.revoked_at,
                'revoked_reason', OLD.revoked_reason
            )
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for token reuse detection (optional - for enhanced security)
-- DROP TRIGGER IF EXISTS refresh_token_reuse_trigger ON refresh_tokens;
-- CREATE TRIGGER refresh_token_reuse_trigger
--     AFTER UPDATE ON refresh_tokens
--     FOR EACH ROW
--     WHEN (OLD.revoked = TRUE AND NEW.revoked = TRUE)
--     EXECUTE FUNCTION detect_token_reuse();

COMMENT ON FUNCTION detect_token_reuse() IS 'Detects and logs refresh token reuse attempts (potential security breach)';
