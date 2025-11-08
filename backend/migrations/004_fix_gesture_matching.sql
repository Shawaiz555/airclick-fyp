-- Migration 004: Fix Gesture Matching System
-- This migration adds support for multi-template storage and adaptive thresholds

-- Add columns for multi-template support
ALTER TABLE gestures ADD COLUMN IF NOT EXISTS template_index INTEGER DEFAULT 0;
ALTER TABLE gestures ADD COLUMN IF NOT EXISTS parent_gesture_id INTEGER REFERENCES gestures(id) ON DELETE CASCADE;
ALTER TABLE gestures ADD COLUMN IF NOT EXISTS is_primary_template BOOLEAN DEFAULT TRUE;
ALTER TABLE gestures ADD COLUMN IF NOT EXISTS quality_score FLOAT DEFAULT 0.0;
ALTER TABLE gestures ADD COLUMN IF NOT EXISTS adaptive_threshold FLOAT DEFAULT 0.70;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_gestures_parent ON gestures(parent_gesture_id);
CREATE INDEX IF NOT EXISTS idx_gestures_is_primary ON gestures(is_primary_template);

-- Add column for recording metadata
ALTER TABLE gestures ADD COLUMN IF NOT EXISTS recording_metadata JSONB DEFAULT '{}'::jsonb;

-- Comments for clarity
COMMENT ON COLUMN gestures.template_index IS 'Index of this template (0=primary, 1-4=variations)';
COMMENT ON COLUMN gestures.parent_gesture_id IS 'Reference to primary gesture if this is a variation';
COMMENT ON COLUMN gestures.is_primary_template IS 'True if this is the main template, false if variation';
COMMENT ON COLUMN gestures.quality_score IS 'Quality score of this recording (0-1), based on confidence and smoothness';
COMMENT ON COLUMN gestures.adaptive_threshold IS 'Learned optimal threshold for this specific gesture';
COMMENT ON COLUMN gestures.recording_metadata IS 'Metadata about recording conditions (avg confidence, frame rate, etc.)';
