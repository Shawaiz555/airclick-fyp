from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.gesture import Gesture
from app.schemas.gesture import GestureCreate, GestureResponse

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
