"""
Gesture Model (FIXED VERSION)

CHANGES:
1. ✅ Added columns for multi-template support
2. ✅ Added adaptive_threshold column
3. ✅ Added quality_score column
4. ✅ Added recording_metadata column
5. ✅ Added template_index and parent_gesture_id for variations

After running migration 004, these columns will exist in the database.
"""

from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from app.core.database import Base

class Gesture(Base):
    __tablename__ = "gestures"

    # Original columns
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    action = Column(String(50), nullable=False)
    app_context = Column(String(50), default="GLOBAL")
    landmark_data = Column(JSONB, nullable=False)

    # Rolling accuracy tracking (existing)
    accuracy_score = Column(Float, nullable=True)  # Rolling average of similarity scores
    total_similarity = Column(Float, default=0.0)  # Sum of all similarity scores
    match_count = Column(Integer, default=0)  # Total number of successful matches

    # False trigger tracking (per user)
    false_trigger_count = Column(Integer, default=0)  # Count of false triggers (attempts below threshold)

    # NEW: Multi-template support (added in migration 004)
    template_index = Column(Integer, default=0)  # 0=primary, 1-4=variations
    parent_gesture_id = Column(Integer, ForeignKey("gestures.id", ondelete="CASCADE"), nullable=True)
    is_primary_template = Column(Boolean, default=True)  # True if this is the main template

    # NEW: Quality and adaptive threshold (added in migration 004)
    quality_score = Column(Float, default=0.0)  # Quality of recording (0-1)
    adaptive_threshold = Column(Float, default=0.75)  # Learned optimal threshold for this gesture

    # NEW: Recording metadata (added in migration 004)
    recording_metadata = Column(JSONB, default={})  # Recording conditions, stats, etc.

    # PHASE 2 OPTIMIZATION: Precomputed features (added in migration 006)
    precomputed_features = Column(JSONB, nullable=True)  # Cached Procrustes features (60x63 array)
    features_version = Column(Integer, default=1)  # Feature extraction algorithm version

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())


class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    action = Column(String(255), nullable=False)
    meta_data = Column(JSONB, nullable=True)
    ip_address = Column(String(45), nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
