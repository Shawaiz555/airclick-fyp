"""
Pydantic schemas for user settings.

These schemas define the structure of request/response data for settings endpoints.
Settings control cursor behavior, gesture sensitivity, and click detection.
"""

from pydantic import BaseModel, Field
from typing import Optional


class CursorSettings(BaseModel):
    """
    Cursor control settings.

    Controls how hand movements translate to cursor movement.
    """
    cursor_speed: float = Field(
        default=1.0,
        ge=0.5,
        le=4.0,
        description="Cursor movement multiplier (0.5 = slow, 4.0 = fast). 1.0 = full camera view maps to full screen (optimal)"
    )
    smoothing_level: float = Field(
        default=0.5,
        ge=0.1,
        le=2.0,
        description="Cursor smoothing (0.1 = smooth/laggy, 2.0 = responsive/jittery)"
    )
    dead_zone: float = Field(
        default=0.0,
        ge=0.0,
        le=0.1,
        description="Dead zone threshold (0.0 = none, 0.1 = large)"
    )
    cursor_enabled: bool = Field(
        default=True,
        description="Enable/disable cursor control"
    )


class ClickSettings(BaseModel):
    """
    Click detection settings.

    Controls how pinch gestures are detected for clicking.
    """
    click_sensitivity: float = Field(
        default=0.08,
        ge=0.03,
        le=0.15,
        description="Pinch threshold (0.03 = precise, 0.15 = easy)"
    )
    click_enabled: bool = Field(
        default=True,
        description="Enable/disable click detection"
    )


class GestureSettings(BaseModel):
    """
    Gesture recognition settings.

    Controls how gestures are detected and matched.
    """
    gesture_sensitivity: float = Field(
        default=0.75,
        ge=0.5,
        le=0.95,
        description="Matching threshold (0.5 = lenient, 0.95 = strict)"
    )
    gesture_hold_time: float = Field(
        default=2.0,
        ge=0.5,
        le=4.0,
        description="Time hand must be still before gesture starts collecting (seconds). Increased to 2.0 to prevent interference with cursor control"
    )


class DisplaySettings(BaseModel):
    """
    Display/visual feedback settings.

    Controls visual overlays and feedback.
    """
    show_skeleton: bool = Field(
        default=True,
        description="Show hand skeleton overlay"
    )
    high_contrast: bool = Field(
        default=False,
        description="Enable high contrast mode for accessibility"
    )


class UserSettings(BaseModel):
    """
    Complete user settings schema.

    Combines all settings categories into one object.
    Stored in user.accessibility_settings JSONB column.
    """
    cursor: CursorSettings = Field(default_factory=CursorSettings)
    click: ClickSettings = Field(default_factory=ClickSettings)
    gesture: GestureSettings = Field(default_factory=GestureSettings)
    display: DisplaySettings = Field(default_factory=DisplaySettings)

    class Config:
        from_attributes = True


class UserSettingsUpdate(BaseModel):
    """
    Schema for updating user settings.

    All fields are optional - only provided fields will be updated.
    """
    cursor: Optional[CursorSettings] = None
    click: Optional[ClickSettings] = None
    gesture: Optional[GestureSettings] = None
    display: Optional[DisplaySettings] = None


class UserSettingsResponse(BaseModel):
    """
    Response schema for user settings.
    """
    settings: UserSettings
    message: str = "Settings retrieved successfully"


class UserSettingsUpdateResponse(BaseModel):
    """
    Response schema after updating settings.
    """
    settings: UserSettings
    message: str = "Settings updated successfully"
    applied_to_runtime: bool = Field(
        default=False,
        description="Whether settings were applied to running gesture system"
    )


# Default settings for new users or reset
DEFAULT_USER_SETTINGS = UserSettings(
    cursor=CursorSettings(
        cursor_speed=1.0,  # 1:1 mapping = full camera view controls full screen
        smoothing_level=0.5,
        dead_zone=0.0,
        cursor_enabled=True
    ),
    click=ClickSettings(
        click_sensitivity=0.08,
        click_enabled=True
    ),
    gesture=GestureSettings(
        gesture_sensitivity=0.75,
        gesture_hold_time=2.0  # Increased from 1.5 to prevent cursor-gesture interference
    ),
    display=DisplaySettings(
        show_skeleton=True,
        high_contrast=False
    )
)
