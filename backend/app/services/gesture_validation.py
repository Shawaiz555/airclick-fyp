import logging
import time
import numpy as np
from typing import List, Dict, Any, Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.gesture import Gesture
from app.services.hand_pose_fingerprint import calculate_pose_signature
from app.services.gesture_preprocessing import preprocess_for_recording, convert_features_to_frames
from app.services.frame_resampler import get_frame_statistics
from app.services.gesture_matcher import get_gesture_matcher

logger = logging.getLogger(__name__)

# Constants for duplicate thresholds
DUPLICATE_THRESHOLD_HIGH = 0.85  # Definite duplicate - REJECT
DUPLICATE_THRESHOLD_MEDIUM = 0.78  # Very similar - REJECT with warning

def validate_gesture_input(frames: List[Any]):
    """
    Basic validation of gesture frames.
    """
    if not frames or len(frames) < 5:
        logger.warning(f"⚠️ Gesture rejected - too few frames: {len(frames) if frames else 0}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Gesture is too short. Please record for at least 0.5 to 1 second."
        )
    
    for i, frame in enumerate(frames):
        if not hasattr(frame, 'landmarks') or len(frame.landmarks) != 21:
            logger.warning(f"⚠️ Frame {i} has invalid landmarks count")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Each frame must have exactly 21 landmarks"
            )

def process_and_validate_gesture(
    frames_input: List[Any],
    user_id: int,
    db: Session,
    exclude_gesture_id: Optional[int] = None,
    gesture_name: str = "Unknown"
) -> Tuple[Dict[str, Any], Optional[List[List[float]]]]:
    """
    Full pipeline to validate, preprocess and check for duplicates.
    
    Returns:
        Tuple of (landmark_data, precomputed_features)
    """
    logger.info(f"\n{'='*60}")
    logger.info(f"PROCESSING GESTURE: {gesture_name} (User: {user_id})")
    logger.info(f"{'='*60}")

    # 1. Convert to dict format for internal processing
    # frames_input can be list of Pydantic models (from API) or dicts (if called internally)
    frames_dict = []
    for frame in frames_input:
        if hasattr(frame, 'dict'):
            f_dict = frame.dict()
            # Pydantic dict might have landmarks as list of models, convert to dicts
            f_dict['landmarks'] = [{"x": lm['x'], "y": lm['y'], "z": lm['z']} if isinstance(lm, dict) else {"x": lm.x, "y": lm.y, "z": lm.z} for lm in f_dict['landmarks']]
            frames_dict.append(f_dict)
        else:
            frames_dict.append(frame)

    # 2. Apply FULL preprocessing
    logger.info(f"📐 Applying FULL preprocessing (v6 standard):")
    
    # Get original stats before preprocessing
    original_stats = get_frame_statistics(frames_dict)
    
    # Apply preprocessing and get features
    features = preprocess_for_recording(
        frames_dict,
        target_frames=60,
        apply_smoothing=True,
        apply_procrustes=True,
        apply_bone_normalization=True
    )
    
    # Convert features back to frames format for storage
    preprocessed_frames = convert_features_to_frames(features, frames_dict)
    logger.info(f"✅ Preprocessing complete: {features.shape}")

    # 4. Duplicate Gesture Check
    logger.info(f"🔍 Checking for duplicates...")
    query = db.query(Gesture).filter(Gesture.user_id == user_id)
    if exclude_gesture_id:
        query = query.filter(Gesture.id != exclude_gesture_id)
    
    existing_gestures = query.all()
    if existing_gestures:
        matcher = get_gesture_matcher()
        
        # Convert existing gestures to list format for matcher
        existing_gestures_list = []
        for g in existing_gestures:
            gesture_dict = {
                'id': g.id,
                'name': g.name,
                'action': g.action,
                'app_context': g.app_context,
                'landmark_data': g.landmark_data
            }
            existing_gestures_list.append(gesture_dict)

        # Match against existing gestures
        match_result = matcher.match_gesture(
            preprocessed_frames,
            existing_gestures_list,
            user_id=user_id,
            return_best_candidate=True
        )

        if match_result:
            matched_gesture, similarity = match_result
            
            logger.info(f"   Similarity vs '{matched_gesture['name']}': {similarity:.1%}")

            if similarity >= DUPLICATE_THRESHOLD_HIGH:
                logger.warning(f"⚠️ DUPLICATE DETECTED: {similarity:.1%} > {DUPLICATE_THRESHOLD_HIGH:.1%}")
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail={
                        "type": "duplicate_gesture",
                        "message": f"This gesture is too similar ({similarity:.1%}) to your existing gesture '{matched_gesture['name']}'. Please perform a different gesture.",
                        "existing_gesture_name": matched_gesture['name'],
                        "similarity": round(similarity * 100, 1),
                        "threshold": round(DUPLICATE_THRESHOLD_HIGH * 100, 1)
                    }
                )
            elif similarity >= DUPLICATE_THRESHOLD_MEDIUM:
                logger.warning(f"⚠️ VERY SIMILAR DETECTED: {similarity:.1%} > {DUPLICATE_THRESHOLD_MEDIUM:.1%}")
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail={
                        "type": "duplicate_gesture",
                        "message": f"This gesture is very similar ({similarity:.1%}) to your existing gesture '{matched_gesture['name']}'. Please perform a more distinct gesture.",
                        "existing_gesture_name": matched_gesture['name'],
                        "similarity": round(similarity * 100, 1),
                        "threshold": round(DUPLICATE_THRESHOLD_MEDIUM * 100, 1)
                    }
                )
            else:
                logger.info(f"✅ Gesture is unique (best match: {similarity:.1%})")
    else:
        logger.info(f"✅ No existing gestures to compare against")

    # 5. Extract Trajectory Data
    raw_wrist_positions = []
    # Use raw frames for trajectory since preprocessed ones are centered
    for frame in frames_dict:
        wrist = frame['landmarks'][0]
        raw_wrist_positions.append({'x': wrist['x'], 'y': wrist['y']})

    raw_trajectory = None
    if len(raw_wrist_positions) >= 2:
        start = raw_wrist_positions[0]
        end = raw_wrist_positions[-1]
        magnitude = ((end['x'] - start['x'])**2 + (end['y'] - start['y'])**2)**0.5
        
        STATIONARY_THRESHOLD = 0.02
        MOVEMENT_THRESHOLD = 0.05
        
        if magnitude < STATIONARY_THRESHOLD:
            classification, quality = "stationary", "good"
        elif magnitude > MOVEMENT_THRESHOLD:
            classification, quality = "moving", "good"
        else:
            classification, quality = "ambiguous", "warning"
            
        raw_trajectory = {
            'start_x': start['x'], 'start_y': start['y'],
            'end_x': end['x'], 'end_y': end['y'],
            'delta_x': end['x'] - start['x'], 'delta_y': end['y'] - start['y'],
            'magnitude': magnitude,
            'classification': classification, 'quality': quality
        }

    # 6. Pose Signature (Fingerprint)
    pose_signature_data = None
    try:
        first_frame_landmarks = preprocessed_frames[0]['landmarks']
        pose_signature_data = calculate_pose_signature(first_frame_landmarks)
        logger.info(f"✋ Pose: {pose_signature_data['gesture_hint']} ({pose_signature_data['signature']})")
    except Exception as e:
        logger.warning(f"⚠️ Could not calculate pose signature: {e}")

    # 7. Construct Landmark Data
    landmark_data = {
        "frames": preprocessed_frames,
        "raw_trajectory": raw_trajectory,
        "raw_wrist_positions": raw_wrist_positions,
        "pose_signature": pose_signature_data['signature'] if pose_signature_data else None,
        "extended_fingers": pose_signature_data['extended_count'] if pose_signature_data else None,
        "hand_size": pose_signature_data['hand_size'] if pose_signature_data else None,
        "gesture_hint": pose_signature_data['gesture_hint'] if pose_signature_data else None,
        "metadata": {
            "total_frames": len(preprocessed_frames),
            "duration": original_stats['duration_ms'] / 1000.0,
            "original_frame_count": original_stats['frame_count'],
            "resampled": original_stats['frame_count'] != 60,
            "avg_confidence": original_stats['avg_confidence'],
            "handedness": original_stats['handedness'],
            "preprocessed": True,
            "preprocessing_version": "v6_with_pose_fingerprint"
        }
    }

    # 8. Precompute Features
    precomputed_features = features.tolist()
    
    logger.info(f"✅ Gesture processing for '{gesture_name}' complete")
    logger.info(f"{'='*60}\n")
    
    return landmark_data, precomputed_features
