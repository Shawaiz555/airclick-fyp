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
from app.core.actions import get_all_actions_flat, get_actions_by_context, AppContext
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/record", response_model=GestureResponse, status_code=status.HTTP_201_CREATED)
def record_gesture(
    gesture_data: GestureCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Record a new gesture with landmark data."""
    # Validate frames have 21 landmarks each
    for frame in gesture_data.frames:
        if len(frame.landmarks) != 21:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Each frame must have exactly 21 landmarks"
            )

    # Convert frames to storable format
    landmark_data = {
        "frames": [
            {
                "timestamp": frame.timestamp,
                "landmarks": [
                    {"x": lm.x, "y": lm.y, "z": lm.z}
                    for lm in frame.landmarks
                ],
                "handedness": frame.handedness,
                "confidence": frame.confidence
            }
            for frame in gesture_data.frames
        ],
        "metadata": {
            "total_frames": len(gesture_data.frames),
            "duration": (gesture_data.frames[-1].timestamp - gesture_data.frames[0].timestamp) / 1000.0 if len(gesture_data.frames) > 1 else 0
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

    return new_gesture

@router.get("/", response_model=List[GestureResponse])
def get_user_gestures(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all gestures for the current user."""
    gestures = db.query(Gesture).filter(Gesture.user_id == current_user.id).order_by(Gesture.created_at.desc()).all()
    return gestures

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

    return None


@router.post("/match")
def match_gesture(
    frames: List[Dict],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Match input gesture frames against stored gestures.

    Returns the best matching gesture with similarity score.
    """
    logger.info(f"\n{'='*60}")
    logger.info(f"GESTURE MATCHING STARTED")
    logger.info(f"{'='*60}")
    logger.info(f"User: {current_user.email} (ID: {current_user.id})")
    logger.info(f"Input frames received: {len(frames)}")

    if not frames or len(frames) < 5:
        logger.warning(f"⚠ Too few frames: {len(frames)} (minimum 5 required)")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least 5 frames required for gesture matching"
        )

    # Get user's stored gestures
    stored_gestures = db.query(Gesture).filter(
        Gesture.user_id == current_user.id
    ).all()

    logger.info(f"Stored gestures found in database: {len(stored_gestures)}")

    if not stored_gestures:
        logger.warning("⚠ No stored gestures found for this user")
        return {
            "matched": False,
            "message": "No gestures stored yet. Please record some gestures first."
        }

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

    # Match gesture
    logger.info("\nStarting DTW matching algorithm...")
    matcher = get_gesture_matcher()
    match_result = matcher.match_gesture(frames, gestures_dict)

    if match_result:
        matched_gesture, similarity = match_result

        logger.info(f"\n{'='*60}")
        logger.info(f"✓ MATCH FOUND!")
        logger.info(f"{'='*60}")
        logger.info(f"Matched Gesture: {matched_gesture['name']}")
        logger.info(f"Similarity Score: {similarity:.2%}")
        logger.info(f"Action: {matched_gesture['action']}")
        logger.info(f"Context: {matched_gesture['app_context']}")
        logger.info(f"{'='*60}\n")

        # Log the match
        activity_log = ActivityLog(
            user_id=current_user.id,
            action=f"Gesture Matched: {matched_gesture['name']}",
            meta_data={
                "gesture_id": matched_gesture["id"],
                "gesture_name": matched_gesture["name"],
                "action": matched_gesture["action"],
                "app_context": matched_gesture["app_context"],
                "similarity": similarity,
                "input_frames": len(frames)
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
                "app_context": matched_gesture["app_context"]
            },
            "similarity": similarity
        }
    else:
        logger.info(f"\n{'='*60}")
        logger.info(f"✗ NO MATCH FOUND")
        logger.info(f"{'='*60}")
        logger.info(f"No gesture exceeded the similarity threshold (70%)")
        logger.info(f"Tip: Try performing the gesture more similar to how you recorded it")
        logger.info(f"{'='*60}\n")

        return {
            "matched": False,
            "message": "No matching gesture found (similarity below 70% threshold)"
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
    # Get gesture
    gesture = db.query(Gesture).filter(
        Gesture.id == gesture_id,
        Gesture.user_id == current_user.id
    ).first()

    if not gesture:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Gesture not found"
        )

    # Execute action
    executor = get_action_executor()
    result = executor.execute_action(gesture.action, gesture.app_context)

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
