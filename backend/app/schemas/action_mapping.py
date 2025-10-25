"""
AirClick - Action Mapping Schemas
==================================

Pydantic schemas for action mapping validation and serialization.
Used for API request/response validation.

Author: Muhammad Shawaiz
Project: AirClick FYP
"""

from pydantic import BaseModel, Field, validator, model_validator, ConfigDict
from typing import Optional, List
from datetime import datetime
from enum import Enum


# ============================================================
# ENUMS for Validation
# ============================================================

class AppContext(str, Enum):
    """Valid application contexts"""
    GLOBAL = "GLOBAL"
    POWERPOINT = "POWERPOINT"
    WORD = "WORD"
    BROWSER = "BROWSER"
    MEDIA = "MEDIA"


class ActionCategory(str, Enum):
    """Valid action categories"""
    NAVIGATION = "NAVIGATION"
    EDITING = "EDITING"
    FORMATTING = "FORMATTING"
    MEDIA_CONTROL = "MEDIA_CONTROL"
    SYSTEM = "SYSTEM"


# ============================================================
# Valid Keyboard Keys
# ============================================================

# Comprehensive list of valid keyboard keys
VALID_KEYS = {
    # Modifier keys
    "ctrl", "alt", "shift", "win", "cmd", "option", "command",

    # Letter keys
    "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m",
    "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z",

    # Number keys
    "0", "1", "2", "3", "4", "5", "6", "7", "8", "9",

    # Function keys
    "f1", "f2", "f3", "f4", "f5", "f6", "f7", "f8", "f9", "f10", "f11", "f12",

    # Navigation keys
    "up", "down", "left", "right", "home", "end", "pageup", "pagedown",

    # Special keys
    "enter", "return", "tab", "space", "backspace", "delete", "escape", "esc",

    # Media keys
    "playpause", "play", "pause", "stop", "nexttrack", "prevtrack",
    "volumeup", "volumedown", "volumemute", "mute",

    # Punctuation and symbols
    ",", ".", "/", ";", "'", "[", "]", "\\", "-", "=",
    "<", ">", "?", ":", "\"", "{", "}", "|", "_", "+",

    # Other keys
    "insert", "printscreen", "scrolllock", "pause", "capslock",
    "numlock", "contextmenu", "menu"
}


# ============================================================
# Base Schema
# ============================================================

class ActionMappingBase(BaseModel):
    """Base schema with common fields"""
    action_id: str = Field(
        ...,
        min_length=3,
        max_length=100,
        description="Unique identifier (e.g., ppt_next_slide)",
        example="ppt_next_slide"
    )
    name: str = Field(
        ...,
        min_length=1,
        max_length=200,
        description="Display name for the action",
        example="Next Slide"
    )
    description: Optional[str] = Field(
        None,
        max_length=1000,
        description="Detailed description of the action",
        example="Advance to the next slide in presentation"
    )
    app_context: AppContext = Field(
        ...,
        description="Application context where action is available",
        example="POWERPOINT"
    )
    category: Optional[ActionCategory] = Field(
        None,
        description="Action category for grouping",
        example="NAVIGATION"
    )
    keyboard_keys: List[str] = Field(
        ...,
        min_items=1,
        max_items=10,
        description="Array of keyboard keys",
        example=["ctrl", "p"]
    )
    icon: Optional[str] = Field(
        None,
        max_length=10,
        description="Emoji or unicode symbol",
        example="→"
    )
    is_active: bool = Field(
        default=True,
        description="Whether the action is active"
    )

    @validator('action_id')
    def validate_action_id(cls, v):
        """Validate action_id format (lowercase, underscores only)"""
        if not v.islower():
            raise ValueError("action_id must be lowercase")
        if not all(c.isalnum() or c == '_' for c in v):
            raise ValueError("action_id can only contain lowercase letters, numbers, and underscores")
        return v

    @validator('keyboard_keys')
    def validate_keyboard_keys(cls, v):
        """Validate that all keys are valid"""
        if not v:
            raise ValueError("keyboard_keys cannot be empty")

        # Convert to lowercase for validation
        normalized_keys = [key.lower() for key in v]

        # Check for valid keys
        invalid_keys = [key for key in normalized_keys if key not in VALID_KEYS]
        if invalid_keys:
            raise ValueError(
                f"Invalid keyboard keys: {', '.join(invalid_keys)}. "
                f"Must be one of: {', '.join(sorted(list(VALID_KEYS)[:20]))}..."
            )

        # Check for duplicates
        if len(normalized_keys) != len(set(normalized_keys)):
            raise ValueError("keyboard_keys cannot contain duplicates")

        return normalized_keys  # Return normalized (lowercase) keys

    model_config = ConfigDict(
        use_enum_values=True,
        json_schema_extra={
            "example": {
                "action_id": "ppt_next_slide",
                "name": "Next Slide",
                "description": "Advance to the next slide",
                "app_context": "POWERPOINT",
                "category": "NAVIGATION",
                "keyboard_keys": ["right"],
                "icon": "→",
                "is_active": True
            }
        }
    )


# ============================================================
# Create Schema (for POST requests)
# ============================================================

class ActionMappingCreate(ActionMappingBase):
    """Schema for creating a new action mapping"""
    pass


# ============================================================
# Update Schema (for PUT requests)
# ============================================================

class ActionMappingUpdate(BaseModel):
    """Schema for updating an action mapping (all fields optional)"""
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    app_context: Optional[AppContext] = None
    category: Optional[ActionCategory] = None
    keyboard_keys: Optional[List[str]] = Field(None, min_items=1, max_items=10)
    icon: Optional[str] = Field(None, max_length=10)
    is_active: Optional[bool] = None

    @validator('keyboard_keys')
    def validate_keyboard_keys(cls, v):
        """Validate keyboard keys if provided"""
        if v is not None:
            if not v:
                raise ValueError("keyboard_keys cannot be empty")

            normalized_keys = [key.lower() for key in v]
            invalid_keys = [key for key in normalized_keys if key not in VALID_KEYS]
            if invalid_keys:
                raise ValueError(f"Invalid keyboard keys: {', '.join(invalid_keys)}")

            if len(normalized_keys) != len(set(normalized_keys)):
                raise ValueError("keyboard_keys cannot contain duplicates")

            return normalized_keys
        return v

    model_config = ConfigDict(use_enum_values=True)


# ============================================================
# Response Schema (for API responses)
# ============================================================

class ActionMappingResponse(ActionMappingBase):
    """Schema for action mapping API responses"""
    id: int = Field(..., description="Database ID")
    created_by: Optional[int] = Field(None, description="User ID of creator")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: Optional[datetime] = Field(None, description="Last update timestamp")

    model_config = ConfigDict(
        from_attributes=True,  # Pydantic v2 (was orm_mode in v1)
        use_enum_values=True,
        json_schema_extra={
            "example": {
                "id": 1,
                "action_id": "ppt_next_slide",
                "name": "Next Slide",
                "description": "Advance to the next slide",
                "app_context": "POWERPOINT",
                "category": "NAVIGATION",
                "keyboard_keys": ["right"],
                "icon": "→",
                "is_active": True,
                "created_by": 1,
                "created_at": "2025-10-25T10:30:00Z",
                "updated_at": None
            }
        }
    )


# ============================================================
# Detailed Response with Metadata
# ============================================================

class ActionMappingDetailResponse(ActionMappingResponse):
    """Extended response with additional computed fields"""
    keyboard_shortcut_display: str = Field(
        ...,
        description="Human-readable keyboard shortcut (e.g., 'Ctrl+P')"
    )
    num_keys: int = Field(
        ...,
        description="Number of keys in the shortcut"
    )

    @model_validator(mode='after')
    def compute_display_fields(self):
        """Compute display fields from keyboard_keys"""
        if self.keyboard_keys:
            self.keyboard_shortcut_display = '+'.join([k.capitalize() for k in self.keyboard_keys])
            self.num_keys = len(self.keyboard_keys)
        else:
            self.keyboard_shortcut_display = ''
            self.num_keys = 0
        return self


# ============================================================
# List Response (for paginated results)
# ============================================================

class ActionMappingListResponse(BaseModel):
    """Response for list endpoints"""
    total: int = Field(..., description="Total number of actions")
    actions: List[ActionMappingResponse] = Field(..., description="List of actions")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "total": 48,
                "actions": [
                    {
                        "id": 1,
                        "action_id": "ppt_next_slide",
                        "name": "Next Slide",
                        "app_context": "POWERPOINT",
                        "keyboard_keys": ["right"],
                        "icon": "→",
                        "is_active": True
                    }
                ]
            }
        }
    )


# ============================================================
# Filter Schema (for query parameters)
# ============================================================

class ActionMappingFilter(BaseModel):
    """Schema for filtering action mappings"""
    app_context: Optional[AppContext] = Field(None, description="Filter by context")
    category: Optional[ActionCategory] = Field(None, description="Filter by category")
    is_active: Optional[bool] = Field(None, description="Filter by active status")
    search: Optional[str] = Field(None, max_length=100, description="Search term")

    model_config = ConfigDict(use_enum_values=True)


# ============================================================
# Statistics Response
# ============================================================

class ActionMappingStatistics(BaseModel):
    """Statistics about action mappings"""
    total: int
    active: int
    inactive: int
    by_context: dict
    by_category: dict

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "total": 48,
                "active": 48,
                "inactive": 0,
                "by_context": {
                    "POWERPOINT": 14,
                    "WORD": 20,
                    "GLOBAL": 11
                },
                "by_category": {
                    "NAVIGATION": 14,
                    "EDITING": 10,
                    "FORMATTING": 9
                }
            }
        }
    )


# ============================================================
# Bulk Operations
# ============================================================

class BulkActionMappingCreate(BaseModel):
    """Schema for creating multiple actions at once"""
    actions: List[ActionMappingCreate] = Field(
        ...,
        min_items=1,
        max_items=100,
        description="List of actions to create"
    )


class BulkActionMappingResponse(BaseModel):
    """Response for bulk operations"""
    created: int = Field(..., description="Number of actions created")
    failed: int = Field(..., description="Number of actions that failed")
    errors: List[str] = Field(default=[], description="List of error messages")
