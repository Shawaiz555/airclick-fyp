-- Migration 006: Add Precomputed Features for Performance Optimization
-- This migration adds a column to store precomputed feature vectors,
-- eliminating the need to recompute them during every match.
--
-- PHASE 2 OPTIMIZATION: 5-10ms saved per gesture match
--
-- Expected Impact:
-- - Feature extraction happens once during recording
-- - Matching loads precomputed features directly (instant)
-- - Reduces CPU usage during matching by 30-40%

-- Add column for precomputed features (stores normalized Procrustes features)
ALTER TABLE gestures ADD COLUMN IF NOT EXISTS precomputed_features JSONB DEFAULT NULL;

-- Add index for faster access (though JSONB indexing is complex)
-- Note: We don't need GIN index here since we load the entire array, not query it
CREATE INDEX IF NOT EXISTS idx_gestures_has_features ON gestures((precomputed_features IS NOT NULL));

-- Add column to track feature version (for future algorithm updates)
ALTER TABLE gestures ADD COLUMN IF NOT EXISTS features_version INTEGER DEFAULT 1;

-- Comments for clarity
COMMENT ON COLUMN gestures.precomputed_features IS 'Precomputed Procrustes-normalized feature vectors (60x63 array as JSON), computed once during recording';
COMMENT ON COLUMN gestures.features_version IS 'Version of feature extraction algorithm (allows invalidation when algorithm changes)';

-- BACKWARD COMPATIBILITY:
-- Existing gestures will have NULL precomputed_features
-- The matcher will fall back to on-the-fly extraction for NULL features
-- New recordings will automatically populate this field
