-- ============================================================
-- AirClick Database Migration: Action Mappings System
-- ============================================================
-- Purpose: Create dynamic action mapping system where admins can
--          define keyboard shortcuts with variable number of keys
-- Author: Muhammad Shawaiz
-- Project: AirClick FYP
-- Date: 2025-10-25
-- ============================================================

-- ============================================================
-- TABLE: action_mappings
-- ============================================================
-- Stores admin-defined actions with dynamic keyboard shortcuts
-- JSONB column allows flexible key combinations (1-10+ keys)
-- ============================================================

CREATE TABLE IF NOT EXISTS action_mappings (
    -- Primary Key
    id SERIAL PRIMARY KEY,

    -- Unique Action Identifier (used in code and API)
    -- Example: "ppt_next_slide", "word_bold", "play_pause"
    action_id VARCHAR(100) UNIQUE NOT NULL,

    -- Display Name (shown in UI)
    -- Example: "Next Slide", "Bold Text", "Play/Pause Media"
    name VARCHAR(200) NOT NULL,

    -- Detailed Description (help text for users)
    -- Example: "Advance to the next slide in presentation"
    description TEXT,

    -- Application Context (where action is available)
    -- Values: 'GLOBAL', 'POWERPOINT', 'WORD', 'BROWSER', 'MEDIA'
    app_context VARCHAR(50) NOT NULL,

    -- Action Category (for grouping in UI)
    -- Values: 'NAVIGATION', 'EDITING', 'FORMATTING', 'MEDIA_CONTROL', 'SYSTEM'
    category VARCHAR(50),

    -- Keyboard Keys (JSONB array for flexible key combinations)
    -- Examples:
    --   Single key: ["escape"]
    --   Two keys: ["ctrl", "p"]
    --   Three keys: ["ctrl", "shift", "s"]
    --   Media key: ["playpause"]
    -- JSONB allows PostgreSQL to index and query efficiently
    keyboard_keys JSONB NOT NULL,

    -- Icon (emoji or unicode symbol for visual representation)
    -- Example: "→", "⏯", "🔊", "💾"
    icon VARCHAR(10),

    -- Active Status (soft delete - inactive actions hidden from users)
    is_active BOOLEAN DEFAULT true NOT NULL,

    -- Audit Fields
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE
);

-- ============================================================
-- INDEXES for Performance Optimization
-- ============================================================

-- Index on action_id for fast lookups by ID
CREATE INDEX IF NOT EXISTS idx_action_mappings_action_id
ON action_mappings(action_id);

-- Index on app_context for filtering actions by application
-- Used when user selects context in gesture recorder
CREATE INDEX IF NOT EXISTS idx_action_mappings_app_context
ON action_mappings(app_context);

-- Index on is_active for filtering active/inactive actions
-- Admin panel needs to query only active actions
CREATE INDEX IF NOT EXISTS idx_action_mappings_is_active
ON action_mappings(is_active);

-- Composite index for common query: active actions by context
-- Optimizes: WHERE app_context = 'POWERPOINT' AND is_active = true
CREATE INDEX IF NOT EXISTS idx_action_mappings_context_active
ON action_mappings(app_context, is_active);

-- Index on category for grouping actions in UI
CREATE INDEX IF NOT EXISTS idx_action_mappings_category
ON action_mappings(category);

-- GIN index on keyboard_keys JSONB for searching by specific keys
-- Enables queries like: WHERE keyboard_keys @> '["ctrl"]'
CREATE INDEX IF NOT EXISTS idx_action_mappings_keyboard_keys
ON action_mappings USING GIN (keyboard_keys);

-- Full-text search index on name and description
-- Enables search functionality in admin panel
CREATE INDEX IF NOT EXISTS idx_action_mappings_search
ON action_mappings USING GIN (to_tsvector('english', name || ' ' || COALESCE(description, '')));

-- ============================================================
-- TRIGGER: Auto-update updated_at timestamp
-- ============================================================

CREATE OR REPLACE FUNCTION update_action_mappings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_action_mappings_updated_at
BEFORE UPDATE ON action_mappings
FOR EACH ROW
EXECUTE FUNCTION update_action_mappings_updated_at();

-- ============================================================
-- CONSTRAINTS & VALIDATION
-- ============================================================

-- Ensure action_id follows naming convention (lowercase, underscores)
ALTER TABLE action_mappings
ADD CONSTRAINT check_action_id_format
CHECK (action_id ~ '^[a-z0-9_]+$');

-- Ensure app_context is valid
ALTER TABLE action_mappings
ADD CONSTRAINT check_app_context_valid
CHECK (app_context IN ('GLOBAL', 'POWERPOINT', 'WORD', 'BROWSER', 'MEDIA'));

-- Ensure category is valid (if provided)
ALTER TABLE action_mappings
ADD CONSTRAINT check_category_valid
CHECK (category IS NULL OR category IN ('NAVIGATION', 'EDITING', 'FORMATTING', 'MEDIA_CONTROL', 'SYSTEM'));

-- Ensure keyboard_keys is a non-empty array
ALTER TABLE action_mappings
ADD CONSTRAINT check_keyboard_keys_not_empty
CHECK (jsonb_array_length(keyboard_keys) > 0);

-- ============================================================
-- COMMENTS for Documentation
-- ============================================================

COMMENT ON TABLE action_mappings IS 'Stores admin-defined keyboard shortcut actions with dynamic key combinations';
COMMENT ON COLUMN action_mappings.action_id IS 'Unique identifier used in code (e.g., ppt_next_slide)';
COMMENT ON COLUMN action_mappings.name IS 'User-friendly display name shown in UI';
COMMENT ON COLUMN action_mappings.description IS 'Detailed explanation of what the action does';
COMMENT ON COLUMN action_mappings.app_context IS 'Application context: GLOBAL, POWERPOINT, WORD, BROWSER, MEDIA';
COMMENT ON COLUMN action_mappings.category IS 'Action category: NAVIGATION, EDITING, FORMATTING, MEDIA_CONTROL, SYSTEM';
COMMENT ON COLUMN action_mappings.keyboard_keys IS 'JSONB array of keyboard keys (e.g., ["ctrl", "shift", "p"])';
COMMENT ON COLUMN action_mappings.icon IS 'Emoji or unicode symbol for visual representation';
COMMENT ON COLUMN action_mappings.is_active IS 'Soft delete flag - false to hide from users';
COMMENT ON COLUMN action_mappings.created_by IS 'User ID of admin who created this action';

-- ============================================================
-- VERIFICATION QUERIES (for testing)
-- ============================================================

-- Verify table creation
-- SELECT * FROM information_schema.tables WHERE table_name = 'action_mappings';

-- Verify indexes
-- SELECT * FROM pg_indexes WHERE tablename = 'action_mappings';

-- Verify constraints
-- SELECT * FROM information_schema.table_constraints WHERE table_name = 'action_mappings';

-- Test JSONB query
-- SELECT * FROM action_mappings WHERE keyboard_keys @> '["ctrl"]';

-- ============================================================
-- Migration Complete
-- ============================================================
-- Next Steps:
-- 1. Run this migration in Supabase SQL Editor
-- 2. Execute seed script (002_seed_action_mappings.sql)
-- 3. Verify data with: SELECT COUNT(*) FROM action_mappings;
-- ============================================================
