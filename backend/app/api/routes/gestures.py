from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from datetime import datetime
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.gesture import Gesture, ActivityLog
from app.schemas.gesture import GestureCreate, GestureResponse
from app.services.gesture_matcher import get_gesture_matcher
from app.services.action_executor import get_action_executor
from app.services.gesture_indexing import rebuild_gesture_index
from app.services.gesture_cache import invalidate_user_cache
from app.core.actions import get_all_actions_flat, get_actions_by_context, AppContext
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

# Phase 3: Track if index needs rebuilding
_index_needs_rebuild = True

@router.post("/record", response_model=GestureResponse, status_code=status.HTTP_201_CREATED)
def record_gesture(
    gesture_data: GestureCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Record a new gesture with landmark data.

    PHASE 1 & 2 FIX: Now uses standardized preprocessing with:
    - Frame resampling to exactly 60 frames
    - Stateless preprocessing (reset filters for consistent recording)
    """
    from app.services.frame_resampler import resample_frames_linear, get_frame_statistics

    logger.info(f"\n{'='*60}")
    logger.info(f"GESTURE RECORDING - User: {current_user.email}")
    logger.info(f"{'='*60}")

    # Validate frames have 21 landmarks each
    for frame in gesture_data.frames:
        if len(frame.landmarks) != 21:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Each frame must have exactly 21 landmarks"
            )

    # Convert to dict format for processing
    frames_dict = [
        {
            "timestamp": frame.timestamp,
            "landmarks": [{"x": lm.x, "y": lm.y, "z": lm.z} for lm in frame.landmarks],
            "handedness": frame.handedness,
            "confidence": frame.confidence
        }
        for frame in gesture_data.frames
    ]

    # Log original frame statistics
    original_stats = get_frame_statistics(frames_dict)
    logger.info(f"Original frames: {original_stats['frame_count']} | "
               f"Duration: {original_stats['duration_ms']}ms | "
               f"Avg FPS: {original_stats['avg_fps']} | "
               f"Avg Confidence: {original_stats['avg_confidence']}")

    # ✅ CRITICAL FIX #1: Apply FULL preprocessing during recording
    # This ensures recorded gestures use the SAME normalization as matching
    from app.services.gesture_preprocessing import preprocess_for_recording, convert_features_to_frames

    logger.info(f"📐 Applying FULL preprocessing (CRITICAL FIX #1):")
    logger.info(f"   - Resampling to 60 frames")
    logger.info(f"   - Temporal smoothing (One Euro Filter)")
    logger.info(f"   - Procrustes normalization (translation/rotation/scale invariance)")
    logger.info(f"   - Bone-length normalization (anatomical consistency)")

    # Apply preprocessing and get features
    features = preprocess_for_recording(
        frames_dict,
        target_frames=60,
        apply_smoothing=True,
        apply_procrustes=True,
        apply_bone_normalization=True
    )

    logger.info(f"✅ Preprocessing complete: {features.shape}")

    # Convert features back to frames format for storage
    frames_dict = convert_features_to_frames(features, frames_dict)

    logger.info(f"✅ Converted back to frames format: {len(frames_dict)} frames")

    # CRITICAL FIX: Extract raw trajectory data BEFORE preprocessing destroys it
    # This is needed for trajectory-based gesture discrimination (swipe vs static gestures)
    raw_wrist_positions = []
    for frame in gesture_data.frames:
        if frame.landmarks and len(frame.landmarks) > 0:
            wrist = frame.landmarks[0]  # Wrist is landmark 0
            raw_wrist_positions.append({'x': wrist.x, 'y': wrist.y})

    # Calculate raw trajectory (start to end position)
    raw_trajectory = None
    trajectory_classification = "unknown"
    trajectory_quality = "unknown"

    if len(raw_wrist_positions) >= 2:
        start = raw_wrist_positions[0]
        end = raw_wrist_positions[-1]
        magnitude = ((end['x'] - start['x'])**2 + (end['y'] - start['y'])**2)**0.5

        # CRITICAL: Classify trajectory for quality feedback
        # These thresholds match gesture_matcher.py exactly
        STATIONARY_THRESHOLD = 0.02  # Below this = definitely stationary
        MOVEMENT_THRESHOLD = 0.05    # Above this = definitely moving

        if magnitude < STATIONARY_THRESHOLD:
            trajectory_classification = "stationary"
            trajectory_quality = "good"  # Good for static gestures like screenshot
            logger.info(f"📍 STATIONARY gesture detected (magnitude={magnitude:.4f} < {STATIONARY_THRESHOLD})")
            logger.info(f"   ✅ Good for: Screenshot, Thumbs up, Peace sign, etc.")
        elif magnitude > MOVEMENT_THRESHOLD:
            trajectory_classification = "moving"
            trajectory_quality = "good"  # Good for swipe/movement gestures
            logger.info(f"📍 MOVING gesture detected (magnitude={magnitude:.4f} > {MOVEMENT_THRESHOLD})")
            logger.info(f"   ✅ Good for: Swipe left/right/up/down, Wave, etc.")
        else:
            trajectory_classification = "ambiguous"
            trajectory_quality = "warning"
            logger.warning(f"⚠️ AMBIGUOUS movement detected (magnitude={magnitude:.4f})")
            logger.warning(f"   Range: {STATIONARY_THRESHOLD} < {magnitude:.4f} < {MOVEMENT_THRESHOLD}")
            logger.warning(f"   For SWIPE gestures: Move hand MORE (>5% of screen)")
            logger.warning(f"   For STATIC gestures: Keep hand STILL (<2% movement)")

        raw_trajectory = {
            'start_x': start['x'],
            'start_y': start['y'],
            'end_x': end['x'],
            'end_y': end['y'],
            'delta_x': end['x'] - start['x'],
            'delta_y': end['y'] - start['y'],
            'magnitude': magnitude,
            'classification': trajectory_classification,
            'quality': trajectory_quality
        }
        logger.info(f"📍 Raw trajectory: ({raw_trajectory['delta_x']:.4f}, {raw_trajectory['delta_y']:.4f}), magnitude={magnitude:.4f}")

    # Convert to storable format
    landmark_data = {
        "frames": frames_dict,
        "raw_trajectory": raw_trajectory,  # CRITICAL: Preserve trajectory for matching
        "raw_wrist_positions": raw_wrist_positions,  # Full position history
        "metadata": {
            "total_frames": len(frames_dict),
            "duration": original_stats['duration_ms'] / 1000.0,
            "original_frame_count": original_stats['frame_count'],
            "resampled": original_stats['frame_count'] != 60,
            "avg_confidence": original_stats['avg_confidence'],
            "handedness": original_stats['handedness'],
            "preprocessed": True,  # Mark that preprocessing was applied
            "preprocessing_version": "v5_with_trajectory"  # Updated version with trajectory
        }
    }

    # Create gesture record
    new_gesture = Gesture(
        user_id=current_user.id,
        name=gesture_data.name,
        action=gesture_data.action,
        app_context=gesture_data.app_context,
        landmark_data=landmark_data
    )

    db.add(new_gesture)
    db.commit()
    db.refresh(new_gesture)

    # Phase 3: Mark that index needs rebuilding
    global _index_needs_rebuild
    _index_needs_rebuild = True

    # Phase 3: Invalidate user's cache since gestures changed
    invalidate_user_cache(current_user.id)

    logger.info(f"✅ Gesture recorded: '{new_gesture.name}' | 60 frames | Index marked for rebuild")
    logger.info(f"{'='*60}\n")

    return new_gesture

@router.get("/", response_model=List[GestureResponse])
def get_user_gestures(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    include_landmarks: bool = True
):
    """
    Get all gestures for the current user.

    Args:
        include_landmarks: If False, excludes landmark data for faster response
    """
    # Use query optimization: only load what's needed
    query = db.query(Gesture).filter(
        Gesture.user_id == current_user.id
    ).order_by(Gesture.created_at.desc())

    gestures = query.all()

    # If landmarks not needed, remove them from response to reduce payload size
    if not include_landmarks:
        for gesture in gestures:
            if gesture.landmark_data:
                # Get existing metadata or create it with frame count
                metadata = gesture.landmark_data.get('metadata', {})

                # If metadata doesn't have total_frames, calculate it from frames array
                if 'total_frames' not in metadata:
                    frames = gesture.landmark_data.get('frames', [])
                    if frames:
                        metadata['total_frames'] = len(frames)
                        logger.info(f"📊 Gesture '{gesture.name}' (ID: {gesture.id}): Calculated {len(frames)} frames")
                    else:
                        metadata['total_frames'] = 0
                        logger.warning(f"⚠️ Gesture '{gesture.name}' (ID: {gesture.id}): No frames found in landmark_data")
                else:
                    logger.info(f"📊 Gesture '{gesture.name}' (ID: {gesture.id}): Metadata has {metadata['total_frames']} frames")

                # Keep metadata but remove the large frames array
                gesture.landmark_data = {
                    'metadata': metadata,
                    'frames': []  # Empty array to reduce response size
                }
            else:
                logger.warning(f"⚠️ Gesture '{gesture.name}' (ID: {gesture.id}): No landmark_data found")

    return gestures

@router.put("/{gesture_id}", response_model=GestureResponse)
def update_gesture(
    gesture_id: int,
    gesture_data: GestureCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update an existing gesture."""
    # Get existing gesture
    gesture = db.query(Gesture).filter(
        Gesture.id == gesture_id,
        Gesture.user_id == current_user.id
    ).first()

    if not gesture:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Gesture not found"
        )

    # Update basic fields
    gesture.name = gesture_data.name
    gesture.action = gesture_data.action
    gesture.app_context = gesture_data.app_context

    # If new frames are provided, update landmark data
    if gesture_data.frames and len(gesture_data.frames) > 0:
        # Validate frames have 21 landmarks each
        for frame in gesture_data.frames:
            if len(frame.landmarks) != 21:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Each frame must have exactly 21 landmarks"
                )

        # 🔥 CRITICAL FIX: Apply SAME preprocessing as recording!
        # Convert to dict format for processing
        frames_dict = [
            {
                "timestamp": frame.timestamp,
                "landmarks": [{"x": lm.x, "y": lm.y, "z": lm.z} for lm in frame.landmarks],
                "handedness": frame.handedness,
                "confidence": frame.confidence
            }
            for frame in gesture_data.frames
        ]

        # Get frame statistics
        from app.services.frame_resampler import get_frame_statistics
        original_stats = get_frame_statistics(frames_dict)

        logger.info(f"📐 Updating gesture '{gesture.name}' with FULL preprocessing:")
        logger.info(f"   Original frames: {original_stats['frame_count']}")
        logger.info(f"   - Resampling to 60 frames")
        logger.info(f"   - Temporal smoothing (One Euro Filter)")
        logger.info(f"   - Procrustes normalization")
        logger.info(f"   - Bone-length normalization")

        # Apply preprocessing
        from app.services.gesture_preprocessing import preprocess_for_recording, convert_features_to_frames

        features = preprocess_for_recording(
            frames_dict,
            target_frames=60,
            apply_smoothing=True,
            apply_procrustes=True,
            apply_bone_normalization=True
        )

        logger.info(f"✅ Preprocessing complete: {features.shape}")

        # Convert back to frames format
        frames_dict = convert_features_to_frames(features, frames_dict)

        logger.info(f"✅ Converted back to frames format: {len(frames_dict)} frames")

        # CRITICAL FIX: Extract raw trajectory data BEFORE preprocessing destroys it
        raw_wrist_positions = []
        for frame in gesture_data.frames:
            if frame.landmarks and len(frame.landmarks) > 0:
                wrist = frame.landmarks[0]  # Wrist is landmark 0
                raw_wrist_positions.append({'x': wrist.x, 'y': wrist.y})

        # Calculate raw trajectory with classification
        raw_trajectory = None
        trajectory_classification = "unknown"
        trajectory_quality = "unknown"

        STATIONARY_THRESHOLD = 0.02
        MOVEMENT_THRESHOLD = 0.05

        if len(raw_wrist_positions) >= 2:
            start = raw_wrist_positions[0]
            end = raw_wrist_positions[-1]
            magnitude = ((end['x'] - start['x'])**2 + (end['y'] - start['y'])**2)**0.5

            if magnitude < STATIONARY_THRESHOLD:
                trajectory_classification = "stationary"
                trajectory_quality = "good"
                logger.info(f"📍 STATIONARY gesture (magnitude={magnitude:.4f})")
            elif magnitude > MOVEMENT_THRESHOLD:
                trajectory_classification = "moving"
                trajectory_quality = "good"
                logger.info(f"📍 MOVING gesture (magnitude={magnitude:.4f})")
            else:
                trajectory_classification = "ambiguous"
                trajectory_quality = "warning"
                logger.warning(f"⚠️ AMBIGUOUS movement (magnitude={magnitude:.4f})")

            raw_trajectory = {
                'start_x': start['x'],
                'start_y': start['y'],
                'end_x': end['x'],
                'end_y': end['y'],
                'delta_x': end['x'] - start['x'],
                'delta_y': end['y'] - start['y'],
                'magnitude': magnitude,
                'classification': trajectory_classification,
                'quality': trajectory_quality
            }

        # Convert to storable format
        landmark_data = {
            "frames": frames_dict,
            "raw_trajectory": raw_trajectory,
            "raw_wrist_positions": raw_wrist_positions,
            "metadata": {
                "total_frames": len(frames_dict),
                "duration": original_stats['duration_ms'] / 1000.0,
                "original_frame_count": original_stats['frame_count'],
                "resampled": original_stats['frame_count'] != 60,
                "avg_confidence": original_stats['avg_confidence'],
                "handedness": original_stats['handedness'],
                "preprocessed": True,
                "preprocessing_version": "v5_with_trajectory"
            }
        }
        gesture.landmark_data = landmark_data

    db.commit()
    db.refresh(gesture)

    # Phase 3: Mark that index needs rebuilding
    global _index_needs_rebuild
    _index_needs_rebuild = True

    # Phase 3: Invalidate user's cache since gesture changed
    invalidate_user_cache(current_user.id)

    logger.info(f"Gesture updated: {gesture.name} | Index marked for rebuild")

    return gesture

@router.delete("/{gesture_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_gesture(
    gesture_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a gesture."""
    gesture = db.query(Gesture).filter(
        Gesture.id == gesture_id,
        Gesture.user_id == current_user.id
    ).first()

    if not gesture:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Gesture not found"
        )

    db.delete(gesture)
    db.commit()

    # Phase 3: Mark that index needs rebuilding
    global _index_needs_rebuild
    _index_needs_rebuild = True

    # Phase 3: Invalidate user's cache since gesture deleted
    invalidate_user_cache(current_user.id)

    logger.info(f"Gesture deleted: {gesture.name} | Index marked for rebuild")

    return None


@router.post("/match")
def match_gesture(
    frames: List[Dict],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Match input gesture frames against stored gestures.

    PHASE 1 & 2 FIX: Now uses standardized preprocessing with:
    - Frame resampling to exactly 60 frames
    - Stateful preprocessing (preserves filter state for smooth matching)

    Returns the best matching gesture with similarity score.
    """
    from app.services.frame_resampler import get_frame_statistics

    logger.info(f"\n{'='*60}")
    logger.info(f"GESTURE MATCHING STARTED")
    logger.info(f"{'='*60}")
    logger.info(f"User: {current_user.email} (ID: {current_user.id})")

    # CRITICAL FIX: Check for stored gestures FIRST before doing any processing
    # This avoids expensive preprocessing when there are no gestures to match against
    stored_gestures = db.query(Gesture).filter(
        Gesture.user_id == current_user.id
    ).all()

    logger.info(f"Stored gestures found in database: {len(stored_gestures)}")

    if not stored_gestures:
        logger.warning("⚠️ No stored gestures found - returning early without processing")
        logger.info(f"{'='*60}\n")
        return {
            "matched": False,
            "message": "No gestures stored yet. Please record some gestures first.",
            "reason": "no_gestures_stored"
        }

    # Only log frame stats if we have gestures to match against
    logger.info(f"Input frames received: {len(frames)}")

    # Log frame statistics
    frame_stats = get_frame_statistics(frames)
    logger.info(f"Frame stats: {frame_stats['frame_count']} frames | "
               f"Duration: {frame_stats['duration_ms']}ms | "
               f"Avg FPS: {frame_stats['avg_fps']} | "
               f"Confidence: {frame_stats['avg_confidence']}")

    if not frames or len(frames) < 5:
        logger.warning(f"⚠ Too few frames: {len(frames)} (minimum 5 required)")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least 5 frames required for gesture matching"
        )

    # Convert to dictionary format
    gestures_dict = [
        {
            "id": g.id,
            "name": g.name,
            "action": g.action,
            "app_context": g.app_context,
            "landmark_data": g.landmark_data
        }
        for g in stored_gestures
    ]

    # Log stored gestures details
    logger.info("\nStored gestures to compare against:")
    for idx, g in enumerate(gestures_dict, 1):
        frame_count = len(g["landmark_data"].get("frames", []))
        logger.info(f"  {idx}. '{g['name']}' - {frame_count} frames | Action: {g['action']} | Context: {g['app_context']}")

    # Phase 3: Rebuild index if needed (after gestures are added/updated/deleted)
    global _index_needs_rebuild
    if _index_needs_rebuild:
        logger.info("\nPhase 3: Building gesture index (first-time or after changes)...")
        rebuild_gesture_index(gestures_dict)
        _index_needs_rebuild = False
        logger.info("✓ Index built successfully")

    # Match gesture with Phase 3 enhancements
    logger.info("\nStarting DTW matching algorithm with Phase 3 optimizations...")
    matcher = get_gesture_matcher()
    match_result = matcher.match_gesture(
        frames,
        gestures_dict,
        user_id=current_user.id,  # Phase 3: For caching
        app_context=None,  # Can be filtered later if needed
        return_best_candidate=True  # Get best match even if below threshold
    )

    if match_result:
        matched_gesture, similarity = match_result

        # Get the gesture threshold to check if this is a true match or false trigger
        gesture_db = db.query(Gesture).filter(Gesture.id == matched_gesture["id"]).first()
        gesture_threshold = matched_gesture.get('adaptive_threshold', matcher.similarity_threshold)

        # Check if this is a true match or a false trigger
        is_true_match = similarity >= gesture_threshold

        if is_true_match:
            logger.info(f"\n{'='*60}")
            logger.info(f"✓ MATCH FOUND!")
            logger.info(f"{'='*60}")
            logger.info(f"Matched Gesture: {matched_gesture['name']}")
            logger.info(f"Similarity Score: {similarity:.2%}")
            logger.info(f"Action: {matched_gesture['action']}")
            logger.info(f"Context: {matched_gesture['app_context']}")
            logger.info(f"{'='*60}\n")

            # Update rolling average accuracy score for the matched gesture
            if gesture_db:
                # Update rolling average
                gesture_db.total_similarity = (gesture_db.total_similarity or 0.0) + similarity
                gesture_db.match_count = (gesture_db.match_count or 0) + 1
                gesture_db.accuracy_score = gesture_db.total_similarity / gesture_db.match_count

                logger.info(f"📊 Rolling Average Updated:")
                logger.info(f"   Match Count: {gesture_db.match_count}")
                logger.info(f"   Total Similarity: {gesture_db.total_similarity:.4f}")
                logger.info(f"   Accuracy Score (Avg): {gesture_db.accuracy_score:.2%}")
                logger.info(f"{'='*60}\n")
        else:
            # FALSE TRIGGER: Increment false trigger count
            logger.info(f"\n{'='*60}")
            logger.info(f"⚠️ FALSE TRIGGER DETECTED")
            logger.info(f"{'='*60}")
            logger.info(f"Closest Gesture: {matched_gesture['name']}")
            logger.info(f"Similarity Score: {similarity:.2%}")
            logger.info(f"Threshold: {gesture_threshold:.2%}")
            logger.info(f"Delta: {(gesture_threshold - similarity):.2%}")
            logger.info(f"{'='*60}\n")

            if gesture_db:
                # Increment false trigger count
                gesture_db.false_trigger_count = (gesture_db.false_trigger_count or 0) + 1

                logger.info(f"📊 False Trigger Count Updated:")
                logger.info(f"   Gesture: {matched_gesture['name']}")
                logger.info(f"   False Trigger Count: {gesture_db.false_trigger_count}")
                logger.info(f"   (User attempted this gesture but similarity was below threshold)")
                logger.info(f"{'='*60}\n")

        # CRITICAL FIX: Execute the action ONLY for true matches (not false triggers)
        action_result = None
        if is_true_match and matched_gesture["action"]:
            logger.info(f"🎬 Executing action: {matched_gesture['action']} for gesture '{matched_gesture['name']}'")
            logger.info(f"   App context: {matched_gesture['app_context']}")

            # Execute the action
            executor = get_action_executor()
            action_result = executor.execute_action(
                matched_gesture["action"],
                matched_gesture["app_context"]
            )

            if action_result.get("success"):
                logger.info(f"✅ Action executed successfully: {matched_gesture['action']}")
                logger.info(f"   Action name: {action_result.get('action_name')}")
                logger.info(f"   Keyboard shortcut: {action_result.get('keyboard_shortcut')}")
                if action_result.get('window_switched'):
                    logger.info(f"   Window switched to: {action_result.get('window_title')}")
            else:
                logger.error(f"❌ Action execution failed: {action_result.get('error')}")
                if action_result.get('app_not_found'):
                    logger.error(f"   ⚠️ {matched_gesture['app_context']} application is not running!")

        # Commit changes to database (accuracy updates or false trigger count)
        db.commit()

        # Log the activity
        if is_true_match:
            activity_log = ActivityLog(
                user_id=current_user.id,
                action=f"Gesture Matched: {matched_gesture['name']}",
                meta_data={
                    "gesture_id": matched_gesture["id"],
                    "gesture_name": matched_gesture["name"],
                    "action": matched_gesture["action"],
                    "app_context": matched_gesture["app_context"],
                    "similarity": similarity,
                    "input_frames": len(frames),
                    "accuracy_score": gesture_db.accuracy_score if gesture_db else None,
                    "match_count": gesture_db.match_count if gesture_db else None,
                    "action_executed": action_result.get("success", False) if action_result else False
                }
            )
            db.add(activity_log)
            db.commit()

            return {
                "matched": True,
                "gesture": {
                    "id": matched_gesture["id"],
                    "name": matched_gesture["name"],
                    "action": matched_gesture["action"],
                    "app_context": matched_gesture["app_context"],
                    "accuracy_score": gesture_db.accuracy_score if gesture_db else None,
                    "match_count": gesture_db.match_count if gesture_db else 0,
                    "false_trigger_count": gesture_db.false_trigger_count if gesture_db else 0
                },
                "similarity": similarity,
                "action_executed": action_result.get("success", False) if action_result else False,
                "action_result": action_result
            }
        else:
            # FALSE TRIGGER: Log it and return no match
            activity_log = ActivityLog(
                user_id=current_user.id,
                action=f"False Trigger: {matched_gesture['name']}",
                meta_data={
                    "gesture_id": matched_gesture["id"],
                    "gesture_name": matched_gesture["name"],
                    "similarity": similarity,
                    "threshold": gesture_threshold,
                    "delta": gesture_threshold - similarity,
                    "input_frames": len(frames),
                    "false_trigger_count": gesture_db.false_trigger_count if gesture_db else 0
                }
            )
            db.add(activity_log)
            db.commit()

            return {
                "matched": False,
                "message": f"No matching gesture found (similarity {similarity:.2%} below {gesture_threshold:.2%} threshold)",
                "closest_gesture": {
                    "id": matched_gesture["id"],
                    "name": matched_gesture["name"],
                    "similarity": similarity,
                    "false_trigger_count": gesture_db.false_trigger_count if gesture_db else 0
                }
            }
    else:
        logger.info(f"\n{'='*60}")
        logger.info(f"✗ NO MATCH FOUND")
        logger.info(f"{'='*60}")
        threshold_pct = int(matcher.similarity_threshold * 100)
        logger.info(f"No gesture exceeded the similarity threshold ({threshold_pct}%)")
        logger.info(f"Phase 1+2+3 enhancements active:")
        logger.info(f"  Phase 1: Procrustes normalization + temporal smoothing")
        logger.info(f"  Phase 2: Enhanced DTW with velocity/acceleration features")
        logger.info(f"  Phase 2: Ensemble matching (standard + direction + multi-feature)")
        logger.info(f"  Phase 3: Indexing + caching + parallel processing")
        logger.info(f"Tip: Try performing the gesture more similar to how you recorded it")
        logger.info(f"{'='*60}\n")

        return {
            "matched": False,
            "message": "No matching gesture found (similarity below 80% threshold)"
        }


@router.post("/execute")
def execute_gesture_action(
    gesture_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Execute the action associated with a gesture.
    """
    logger.info(f"\n{'='*60}")
    logger.info(f"ACTION EXECUTION REQUEST")
    logger.info(f"{'='*60}")
    logger.info(f"User: {current_user.email} (ID: {current_user.id})")
    logger.info(f"Gesture ID: {gesture_id}")

    # Get gesture
    gesture = db.query(Gesture).filter(
        Gesture.id == gesture_id,
        Gesture.user_id == current_user.id
    ).first()

    if not gesture:
        logger.warning(f"⚠ Gesture {gesture_id} not found for user {current_user.id}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Gesture not found"
        )

    logger.info(f"Gesture: {gesture.name}")
    logger.info(f"Action: {gesture.action}")
    logger.info(f"Context: {gesture.app_context}")

    # Execute action
    executor = get_action_executor()
    result = executor.execute_action(gesture.action, gesture.app_context)

    if result.get("success"):
        logger.info(f"✅ ACTION EXECUTED SUCCESSFULLY")
        logger.info(f"Action Name: {result.get('action_name')}")
        logger.info(f"Keyboard Shortcut: {result.get('keyboard_shortcut')}")
        logger.info(f"Window Switched: {result.get('window_switched', False)}")
        if result.get('window_switched'):
            logger.info(f"Target Window: {result.get('window_title')}")
        logger.info(f"Simulation Mode: {result.get('simulation_mode')}")
    else:
        logger.error(f"❌ ACTION EXECUTION FAILED")
        logger.error(f"Error: {result.get('error')}")
        if result.get('app_not_found'):
            logger.error(f"⚠️ {gesture.app_context} application is not running!")
            logger.error(f"💡 Solution: Open {gesture.app_context} application and try again")

    logger.info(f"{'='*60}\n")

    # Log the execution
    activity_log = ActivityLog(
        user_id=current_user.id,
        action=f"Action Executed: {gesture.action}",
        meta_data={
            "gesture_id": gesture.id,
            "gesture_name": gesture.name,
            "action": gesture.action,
            "app_context": gesture.app_context,
            "success": result.get("success"),
            "simulation_mode": result.get("simulation_mode")
        }
    )
    db.add(activity_log)
    db.commit()

    return result


@router.get("/actions")
def get_available_actions(context: str = "GLOBAL"):
    """
    Get all available actions for a specific context.
    """
    try:
        app_context = AppContext(context)
        actions = get_actions_by_context(app_context)

        # Format actions for frontend
        actions_list = [
            {
                "id": action_id,
                "name": action_data["name"],
                "description": action_data["description"],
                "category": action_data["category"],
                "icon": action_data.get("icon", ""),
                "keyboard_shortcut": action_data.get("keyboard_shortcut", [])
            }
            for action_id, action_data in actions.items()
        ]

        return {
            "context": context,
            "actions": actions_list
        }
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid context: {context}. Valid contexts: GLOBAL, POWERPOINT, WORD"
        )


@router.get("/actions/all")
def get_all_actions():
    """
    Get all available actions across all contexts.
    """
    actions = get_all_actions_flat()
    return {"actions": actions}


@router.get("/activity-logs")
def get_activity_logs(
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get user's activity logs.
    """
    logs = db.query(ActivityLog).filter(
        ActivityLog.user_id == current_user.id
    ).order_by(ActivityLog.timestamp.desc()).limit(limit).all()

    return {
        "logs": [
            {
                "id": log.id,
                "action": log.action,
                "meta_data": log.meta_data,
                "timestamp": log.timestamp.isoformat()
            }
            for log in logs
        ]
    }


@router.post("/recording-state")
def set_recording_state(
    state: Dict[str, bool],
    current_user: User = Depends(get_current_user)
):
    """
    Set the recording state to coordinate with electron overlay.
    Writes state to ~/.airclick-recording file.

    Body: { "is_recording": true/false }
    """
    import os

    try:
        is_recording = state.get("is_recording", False)
        recording_state_path = os.path.join(os.path.expanduser("~"), ".airclick-recording")

        if is_recording:
            # Create file when recording starts
            logger.info(f"📹 Creating recording state file: {recording_state_path}")
            with open(recording_state_path, 'w') as f:
                f.write("true")
                f.flush()  # Ensure immediate write
                os.fsync(f.fileno())  # Force write to disk

            logger.info(f"✅ Recording state enabled (user: {current_user.email})")
        else:
            # DELETE file when recording stops
            # CRITICAL FIX: Gracefully handle file not existing (race condition or double-delete)
            try:
                if os.path.exists(recording_state_path):
                    logger.info(f"📹 Deleting recording state file: {recording_state_path}")
                    os.remove(recording_state_path)
                    logger.info(f"✅ Recording state disabled (user: {current_user.email})")
                else:
                    logger.info(f"⚠️ Recording state file already removed (user: {current_user.email})")
            except FileNotFoundError:
                # File was deleted between check and remove - this is fine
                logger.info(f"⚠️ Recording state file already removed by another process (user: {current_user.email})")
            except Exception as remove_error:
                # Log but don't fail - recording state is being disabled anyway
                logger.warning(f"⚠️ Error removing recording state file (non-critical): {remove_error}")

        return {"success": True, "is_recording": is_recording, "path": recording_state_path}
    except Exception as e:
        logger.error(f"Failed to set recording state: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to set recording state: {str(e)}"
        )


@router.get("/recording-state")
def get_recording_state(current_user: User = Depends(get_current_user)):
    """
    Get the current recording state.

    Returns: { "is_recording": true/false }
    """
    import os

    try:
        recording_state_path = os.path.join(os.path.expanduser("~"), ".airclick-recording")

        if not os.path.exists(recording_state_path):
            return {"is_recording": False}

        with open(recording_state_path, 'r') as f:
            content = f.read().strip()

        is_recording = content == "true"

        return {"is_recording": is_recording}
    except Exception as e:
        logger.error(f"Failed to get recording state: {e}")
        return {"is_recording": False}
