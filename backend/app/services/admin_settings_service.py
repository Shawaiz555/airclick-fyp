"""
Admin Settings Service
======================

Handles persistence and management of system-wide admin settings.
Admin settings include:
- System configuration (name, maintenance mode)
- Default user settings (for new users and resets)
- Gesture recognition system parameters
"""

import json
import os
import logging
from typing import Optional
from app.schemas.admin_settings import AdminSettings, DEFAULT_ADMIN_SETTINGS

logger = logging.getLogger(__name__)

# Settings file path (stored in user home directory)
ADMIN_SETTINGS_FILE = os.path.join(os.path.expanduser("~"), ".airclick-admin-settings.json")


def load_admin_settings() -> AdminSettings:
    """
    Load admin settings from file.
    Returns default settings if file doesn't exist or is invalid.
    """
    try:
        if os.path.exists(ADMIN_SETTINGS_FILE):
            with open(ADMIN_SETTINGS_FILE, 'r') as f:
                data = json.load(f)
                return AdminSettings(**data)
    except Exception as e:
        logger.warning(f"Error loading admin settings: {e}")

    return DEFAULT_ADMIN_SETTINGS.model_copy()


def save_admin_settings(settings: AdminSettings) -> bool:
    """
    Save admin settings to file.
    """
    try:
        with open(ADMIN_SETTINGS_FILE, 'w') as f:
            json.dump(settings.model_dump(), f, indent=2)
        return True
    except Exception as e:
        logger.error(f"Error saving admin settings: {e}")
        return False


def apply_admin_settings_to_runtime(settings: AdminSettings) -> bool:
    """
    Apply admin settings to the running gesture control system.
    """
    try:
        from app.services.gesture_matcher import get_gesture_matcher
        from app.services.hybrid_state_machine import get_hybrid_state_machine

        # Apply gesture system settings
        gesture_matcher = get_gesture_matcher()
        gesture_matcher.similarity_threshold = settings.gesture_system.system_gesture_sensitivity

        state_machine = get_hybrid_state_machine()
        state_machine.stationary_duration_threshold = settings.gesture_system.gesture_hold_time
        state_machine.collection_frame_count = settings.gesture_system.gesture_collection_frames
        state_machine.idle_cooldown_duration = settings.gesture_system.gesture_cooldown_duration

        logger.info(f"Applied admin settings to runtime: threshold={settings.gesture_system.global_similarity_threshold}")
        return True

    except Exception as e:
        logger.error(f"Error applying admin settings to runtime: {e}")
        return False
