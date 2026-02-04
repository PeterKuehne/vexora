-- Migration 004: PKCE (Proof Key for Code Exchange) Support
-- Created: 2026-01-22
-- Purpose: Add PKCE support for OAuth 2.1 compliance

-- Add code_verifier column for PKCE
ALTER TABLE oauth_states
ADD COLUMN IF NOT EXISTS code_verifier VARCHAR(128);

-- Comment on new column
COMMENT ON COLUMN oauth_states.code_verifier IS 'PKCE code_verifier (43-128 chars, stored for token exchange)';
