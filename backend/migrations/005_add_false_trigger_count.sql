-- Migration 005: Add False Trigger Tracking
-- This migration adds a counter to track false triggers (failed gesture matches) per user

-- Add column for false trigger tracking
ALTER TABLE gestures ADD COLUMN IF NOT EXISTS false_trigger_count INTEGER DEFAULT 0;

-- Add comment for clarity
COMMENT ON COLUMN gestures.false_trigger_count IS 'Count of false triggers - when user attempts this gesture but similarity is below threshold (per user)';

-- Set default value for existing records
UPDATE gestures SET false_trigger_count = 0 WHERE false_trigger_count IS NULL;

-- Add constraint to ensure non-negative values
ALTER TABLE gestures ADD CONSTRAINT check_false_trigger_count_non_negative CHECK (false_trigger_count >= 0);
