-- Migration: Add OAuth and Password Reset Support
-- Description: Adds OAuth fields to users table and creates password_reset_tokens table
-- Date: 2025-10-21

-- ============================================
-- STEP 1: Modify users table for OAuth support
-- ============================================

-- Make password_hash nullable (OAuth users don't have passwords)
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- Add OAuth provider fields
ALTER TABLE users ADD COLUMN IF NOT EXISTS oauth_provider VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS oauth_provider_id VARCHAR(255);

-- Add user profile fields
ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_picture VARCHAR(500);

-- Add email verification field (for future use)
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;

-- Create index on oauth_provider_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_oauth_provider_id ON users(oauth_provider_id);

-- Add comment to table
COMMENT ON COLUMN users.password_hash IS 'NULL for OAuth users, bcrypt hash for email/password users';
COMMENT ON COLUMN users.oauth_provider IS 'OAuth provider name: "google", "github", etc.';
COMMENT ON COLUMN users.oauth_provider_id IS 'Unique user ID from OAuth provider';
COMMENT ON COLUMN users.full_name IS 'User full name from OAuth or manual input';
COMMENT ON COLUMN users.profile_picture IS 'URL to user profile picture';


-- ============================================
-- STEP 2: Create password_reset_tokens table
-- ============================================

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    token_hash VARCHAR(64) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used BOOLEAN DEFAULT FALSE,

    -- Foreign key constraint with cascade delete
    CONSTRAINT fk_password_reset_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token_hash ON password_reset_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);

-- Add table comments
COMMENT ON TABLE password_reset_tokens IS 'Stores one-time password reset tokens with 15-minute expiration';
COMMENT ON COLUMN password_reset_tokens.token_hash IS 'SHA-256 hash of the reset token (never store plain tokens)';
COMMENT ON COLUMN password_reset_tokens.used IS 'Prevents token reuse even within expiration window';


-- ============================================
-- STEP 3: Create cleanup function for expired tokens
-- ============================================

-- Function to automatically clean up expired tokens (optional, for maintenance)
CREATE OR REPLACE FUNCTION cleanup_expired_reset_tokens()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM password_reset_tokens
    WHERE expires_at < CURRENT_TIMESTAMP OR used = TRUE;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_expired_reset_tokens IS 'Removes expired and used password reset tokens';


-- ============================================
-- VERIFICATION QUERIES (Run to verify migration)
-- ============================================

-- Verify users table columns
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'users'
-- ORDER BY ordinal_position;

-- Verify password_reset_tokens table exists
-- SELECT table_name
-- FROM information_schema.tables
-- WHERE table_name = 'password_reset_tokens';

-- Verify indexes
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename IN ('users', 'password_reset_tokens');
