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

from app.schemas.admin_settings import AdminSettings, DEFAULT_ADMIN_SETTINGS

logger = logging.getLogger(__name__)

# Settings file path (stored in user home directory)
ADMIN_SETTINGS_FILE = os.path.join(os.path.expanduser("~"), ".airclick-admin-settings.json")


def load_admin_settings() -> AdminSettings:
    """
    Load admin settings from file, merged on top of schema defaults.

    Merging means any field added to DEFAULT_ADMIN_SETTINGS after the file
    was last saved will automatically get its correct default value instead
    of being missing or carrying a stale value from the old file.
    """
    try:
        if os.path.exists(ADMIN_SETTINGS_FILE):
            with open(ADMIN_SETTINGS_FILE, 'r') as f:
                data = json.load(f)

            # Start from schema defaults, then overlay whatever the file has.
            # This ensures new fields introduced in the schema are never missing.
            merged = DEFAULT_ADMIN_SETTINGS.model_dump()
            for section, values in data.items():
                if section in merged and isinstance(values, dict):
                    merged[section].update(values)
                elif section in merged:
                    merged[section] = values

            return AdminSettings(**merged)
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
    Covers both gesture system parameters and cursor default values.
    """
    try:
        from app.services.gesture_matcher import get_gesture_matcher
        from app.services.hybrid_state_machine import get_hybrid_state_machine
        from app.services.cursor_controller import get_cursor_controller
        from app.services.temporal_smoothing import OneEuroFilter

        # Apply gesture system settings
        gesture_matcher = get_gesture_matcher()
        gesture_matcher.similarity_threshold = settings.gesture_system.system_gesture_sensitivity

        state_machine = get_hybrid_state_machine()
        state_machine.stationary_duration_threshold = settings.gesture_system.gesture_hold_time
        state_machine.collection_frame_count = settings.gesture_system.gesture_collection_frames
        state_machine.idle_cooldown_duration = settings.gesture_system.gesture_cooldown_duration

        # Apply admin cursor defaults to the running cursor controller so changes
        # take effect immediately without requiring a user settings save.
        cursor_controller = get_cursor_controller()
        cursor_controller.movement_scale = settings.defaults.default_cursor_speed

        cursor_controller.dead_zone_threshold = settings.defaults.default_dead_zone
        # Note: _dz_min/_dz_max are internal to the adaptive dead zone system
        # and must not be overwritten from the user-facing dead_zone value.

        if hasattr(cursor_controller, 'filter_x') and cursor_controller.filter_x is not None:
            cursor_controller.filter_x.min_cutoff = settings.defaults.default_smoothing_level
            cursor_controller.filter_y.min_cutoff = settings.defaults.default_smoothing_level
        else:
            cursor_controller.filter_x = OneEuroFilter(
                min_cutoff=settings.defaults.default_smoothing_level,
                beta=0.009,
                d_cutoff=1.0
            )
            cursor_controller.filter_y = OneEuroFilter(
                min_cutoff=settings.defaults.default_smoothing_level,
                beta=0.009,
                d_cutoff=1.0
            )
            cursor_controller.smoothing_enabled = True

        logger.info(
            f"Applied admin settings to runtime: "
            f"gesture_threshold={settings.gesture_system.system_gesture_sensitivity}, "
            f"cursor_speed={settings.defaults.default_cursor_speed}, "
            f"smoothing={settings.defaults.default_smoothing_level}, "
            f"dead_zone={settings.defaults.default_dead_zone}"
        )
        return True

    except Exception as e:
        logger.error(f"Error applying admin settings to runtime: {e}")
        return False
