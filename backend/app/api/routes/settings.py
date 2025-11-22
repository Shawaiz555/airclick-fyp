"""
User Settings Routes Module

This module handles all user settings-related endpoints including:
- Get current user settings
- Update user settings
- Reset settings to defaults
- Apply settings to runtime gesture system

Settings are persisted in the user.accessibility_settings JSONB column.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import logging

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.settings import (
    UserSettings,
    UserSettingsUpdate,
    UserSettingsResponse,
    UserSettingsUpdateResponse,
    DEFAULT_USER_SETTINGS
)

logger = logging.getLogger(__name__)
router = APIRouter()


def get_user_settings(user: User) -> UserSettings:
    """
    Extract UserSettings from user's accessibility_settings field.

    If settings are empty or malformed, returns default settings.
    """
    try:
        if user.accessibility_settings and isinstance(user.accessibility_settings, dict):
            # Parse stored settings, using defaults for missing fields
            return UserSettings(**user.accessibility_settings)
    except Exception as e:
        logger.warning(f"Error parsing settings for user {user.id}: {e}")

    return DEFAULT_USER_SETTINGS.model_copy()


def apply_settings_to_runtime(settings: UserSettings, user_id: int) -> bool:
    """
    Apply user settings to the running gesture control system.

    This updates the global instances of cursor controller, gesture matcher,
    hand pose detector, and hybrid state machine.

    Args:
        settings: UserSettings object with new values
        user_id: User ID for logging

    Returns:
        True if settings were applied successfully
    """
    try:
        # Import runtime services
        from app.services.cursor_controller import get_cursor_controller
        from app.services.gesture_matcher import get_gesture_matcher
        from app.services.hand_pose_detector import get_hand_pose_detector
        from app.services.hybrid_state_machine import get_hybrid_state_machine

        # Apply cursor settings
        cursor_controller = get_cursor_controller()
        cursor_controller.movement_scale = settings.cursor.cursor_speed
        cursor_controller.dead_zone_threshold = settings.cursor.dead_zone
        cursor_controller.cursor_enabled = settings.cursor.cursor_enabled

        # Update smoothing - initialize filters if they don't exist
        from app.services.temporal_smoothing import OneEuroFilter

        if not hasattr(cursor_controller, 'filter_x') or cursor_controller.filter_x is None:
            # Initialize filters with user's smoothing level
            cursor_controller.filter_x = OneEuroFilter(
                min_cutoff=settings.cursor.smoothing_level,
                beta=0.01,
                d_cutoff=1.0
            )
            cursor_controller.filter_y = OneEuroFilter(
                min_cutoff=settings.cursor.smoothing_level,
                beta=0.01,
                d_cutoff=1.0
            )
            cursor_controller.smoothing_enabled = True
            logger.info("Initialized cursor smoothing filters")
        else:
            # Update existing filters
            cursor_controller.filter_x.min_cutoff = settings.cursor.smoothing_level
            cursor_controller.filter_y.min_cutoff = settings.cursor.smoothing_level

        logger.info(f"Applied cursor settings: speed={settings.cursor.cursor_speed}, "
                   f"smoothing={settings.cursor.smoothing_level}, dead_zone={settings.cursor.dead_zone}")

        # Apply click settings
        hand_pose_detector = get_hand_pose_detector()
        hand_pose_detector.pinch_threshold = settings.click.click_sensitivity
        # Note: click_enabled is checked at runtime in hybrid mode controller

        logger.info(f"Applied click settings: sensitivity={settings.click.click_sensitivity}")

        # Apply gesture settings
        gesture_matcher = get_gesture_matcher()
        gesture_matcher.similarity_threshold = settings.gesture.gesture_sensitivity

        logger.info(f"Applied gesture settings: sensitivity={settings.gesture.gesture_sensitivity}")

        # Apply gesture hold time to state machine
        state_machine = get_hybrid_state_machine()
        state_machine.stationary_duration_threshold = settings.gesture.gesture_hold_time

        logger.info(f"Applied state machine settings: hold_time={settings.gesture.gesture_hold_time}")

        logger.info(f"All runtime settings applied successfully for user {user_id}")
        return True

    except Exception as e:
        logger.error(f"Error applying runtime settings for user {user_id}: {e}")
        return False


@router.get("", response_model=UserSettingsResponse)
@router.get("/", response_model=UserSettingsResponse)
def get_settings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get current user settings.

    Returns the user's stored settings or defaults if not set.

    Example:
        GET /api/settings
        Headers: Authorization: Bearer <jwt_token>

        Response:
        {
            "settings": {
                "cursor": { "cursor_speed": 1.5, ... },
                "click": { "click_sensitivity": 0.08, ... },
                "gesture": { "gesture_sensitivity": 0.75, ... },
                "display": { "show_skeleton": true, ... }
            },
            "message": "Settings retrieved successfully"
        }
    """
    settings = get_user_settings(current_user)

    return UserSettingsResponse(
        settings=settings,
        message="Settings retrieved successfully"
    )


@router.put("", response_model=UserSettingsUpdateResponse)
@router.put("/", response_model=UserSettingsUpdateResponse)
def update_settings(
    settings_update: UserSettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update user settings.

    Only provided fields will be updated. Unprovided fields keep their current values.
    Settings are persisted to database and applied to running gesture system.

    Example:
        PUT /api/settings
        Headers: Authorization: Bearer <jwt_token>
        {
            "cursor": { "cursor_speed": 2.0 },
            "gesture": { "gesture_sensitivity": 0.8 }
        }

        Response:
        {
            "settings": { ... complete updated settings ... },
            "message": "Settings updated successfully",
            "applied_to_runtime": true
        }
    """
    # Get current settings
    current_settings = get_user_settings(current_user)

    # Merge with updates (only update provided fields)
    if settings_update.cursor:
        current_settings.cursor = settings_update.cursor
    if settings_update.click:
        current_settings.click = settings_update.click
    if settings_update.gesture:
        current_settings.gesture = settings_update.gesture
    if settings_update.display:
        current_settings.display = settings_update.display

    # Persist to database
    try:
        current_user.accessibility_settings = current_settings.model_dump()
        db.commit()
        db.refresh(current_user)
        logger.info(f"Settings saved to database for user {current_user.id}")
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to save settings for user {current_user.id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save settings"
        )

    # Apply to runtime
    applied = apply_settings_to_runtime(current_settings, current_user.id)

    return UserSettingsUpdateResponse(
        settings=current_settings,
        message="Settings updated successfully",
        applied_to_runtime=applied
    )


@router.post("/reset", response_model=UserSettingsUpdateResponse)
def reset_settings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Reset user settings to defaults.

    All settings are reset to their default values and applied to runtime.

    Example:
        POST /api/settings/reset
        Headers: Authorization: Bearer <jwt_token>

        Response:
        {
            "settings": { ... default settings ... },
            "message": "Settings reset to defaults",
            "applied_to_runtime": true
        }
    """
    # Get default settings
    default_settings = DEFAULT_USER_SETTINGS.model_copy()

    # Persist to database
    try:
        current_user.accessibility_settings = default_settings.model_dump()
        db.commit()
        db.refresh(current_user)
        logger.info(f"Settings reset to defaults for user {current_user.id}")
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to reset settings for user {current_user.id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to reset settings"
        )

    # Apply to runtime
    applied = apply_settings_to_runtime(default_settings, current_user.id)

    return UserSettingsUpdateResponse(
        settings=default_settings,
        message="Settings reset to defaults",
        applied_to_runtime=applied
    )


@router.post("/apply", response_model=UserSettingsUpdateResponse)
def apply_settings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Apply stored settings to runtime without changing them.

    Useful for re-applying settings after gesture system restart.

    Example:
        POST /api/settings/apply
        Headers: Authorization: Bearer <jwt_token>
    """
    settings = get_user_settings(current_user)
    applied = apply_settings_to_runtime(settings, current_user.id)

    return UserSettingsUpdateResponse(
        settings=settings,
        message="Settings applied to runtime" if applied else "Failed to apply settings",
        applied_to_runtime=applied
    )
