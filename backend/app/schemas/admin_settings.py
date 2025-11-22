"""
Pydantic schemas for admin system settings.

These schemas define the structure of request/response data for admin settings endpoints.
Admin settings control system-wide defaults and configurations.
"""

from pydantic import BaseModel, Field
from typing import Optional


class SystemSettings(BaseModel):
    """
    System-wide settings controlled by admin.
    """
    system_name: str = Field(
        default="AirClick Gesture Control",
        max_length=100,
        description="Display name for the system"
    )
    maintenance_mode: bool = Field(
        default=False,
        description="Enable maintenance mode to temporarily disable user access"
    )
    default_app_context: str = Field(
        default="GLOBAL",
        description="Default application context for gestures"
    )


class DefaultUserSettings(BaseModel):
    """
    Default settings applied to new users.
    Admins can configure system-wide defaults here.
    """
    default_cursor_speed: float = Field(
        default=1.5,
        ge=0.5,
        le=4.0,
        description="Default cursor speed for new users"
    )
    default_gesture_sensitivity: float = Field(
        default=0.75,
        ge=0.5,
        le=0.95,
        description="Default gesture matching threshold for new users"
    )
    default_click_sensitivity: float = Field(
        default=0.08,
        ge=0.03,
        le=0.15,
        description="Default click sensitivity for new users"
    )
    default_smoothing_level: float = Field(
        default=0.5,
        ge=0.1,
        le=2.0,
        description="Default cursor smoothing for new users"
    )


class GestureSystemSettings(BaseModel):
    """
    Settings for the gesture recognition system.
    These affect how gestures are collected and matched.
    """
    global_similarity_threshold: float = Field(
        default=0.75,
        ge=0.5,
        le=0.95,
        description="Global similarity threshold for gesture matching"
    )
    gesture_collection_frames: int = Field(
        default=90,
        ge=30,
        le=150,
        description="Maximum frames to collect for a gesture"
    )
    stationary_duration_threshold: float = Field(
        default=1.5,
        ge=0.5,
        le=3.0,
        description="Seconds hand must be still before gesture collection starts"
    )
    gesture_cooldown_duration: float = Field(
        default=1.0,
        ge=0.5,
        le=3.0,
        description="Cooldown period after gesture match (seconds)"
    )


class AdminSettings(BaseModel):
    """
    Complete admin settings schema.

    Combines all admin settings categories.
    """
    system: SystemSettings = Field(default_factory=SystemSettings)
    defaults: DefaultUserSettings = Field(default_factory=DefaultUserSettings)
    gesture_system: GestureSystemSettings = Field(default_factory=GestureSystemSettings)

    class Config:
        from_attributes = True


class AdminSettingsUpdate(BaseModel):
    """
    Schema for updating admin settings.

    All fields are optional - only provided fields will be updated.
    """
    system: Optional[SystemSettings] = None
    defaults: Optional[DefaultUserSettings] = None
    gesture_system: Optional[GestureSystemSettings] = None


class AdminSettingsResponse(BaseModel):
    """
    Response schema for admin settings.
    """
    settings: AdminSettings
    message: str = "Settings retrieved successfully"


class AdminSettingsUpdateResponse(BaseModel):
    """
    Response schema after updating admin settings.
    """
    settings: AdminSettings
    message: str = "Settings updated successfully"
    applied_to_runtime: bool = Field(
        default=False,
        description="Whether settings were applied to running gesture system"
    )


# Default admin settings
DEFAULT_ADMIN_SETTINGS = AdminSettings(
    system=SystemSettings(
        system_name="AirClick Gesture Control",
        maintenance_mode=False,
        default_app_context="GLOBAL"
    ),
    defaults=DefaultUserSettings(
        default_cursor_speed=1.5,
        default_gesture_sensitivity=0.75,
        default_click_sensitivity=0.08,
        default_smoothing_level=0.5
    ),
    gesture_system=GestureSystemSettings(
        global_similarity_threshold=0.75,
        gesture_collection_frames=90,
        stationary_duration_threshold=1.5,
        gesture_cooldown_duration=1.0
    )
)
