"""
AirClick - Action Mappings and Configuration
============================================

This module defines all available actions that can be triggered by gestures,
organized by application context (PowerPoint, MS Word, Global).

Author: Muhammad Shawaiz
Project: AirClick FYP
"""

from typing import Dict, List
from enum import Enum


class AppContext(str, Enum):
    """Application contexts for gesture actions"""
    GLOBAL = "GLOBAL"
    POWERPOINT = "POWERPOINT"
    WORD = "WORD"
    BROWSER = "BROWSER"
    MEDIA = "MEDIA"


class ActionCategory(str, Enum):
    """Categories of actions"""
    NAVIGATION = "NAVIGATION"
    EDITING = "EDITING"
    FORMATTING = "FORMATTING"
    MEDIA_CONTROL = "MEDIA_CONTROL"
    SYSTEM = "SYSTEM"


# PowerPoint Actions
POWERPOINT_ACTIONS = {
    # Presentation Navigation
    "ppt_next_slide": {
        "name": "Next Slide",
        "description": "Advance to the next slide",
        "category": ActionCategory.NAVIGATION,
        "keyboard_shortcut": ["right"],
        "icon": "→"
    },
    "ppt_prev_slide": {
        "name": "Previous Slide",
        "description": "Go back to the previous slide",
        "category": ActionCategory.NAVIGATION,
        "keyboard_shortcut": ["left"],
        "icon": "←"
    },
    "ppt_first_slide": {
        "name": "First Slide",
        "description": "Jump to the first slide",
        "category": ActionCategory.NAVIGATION,
        "keyboard_shortcut": ["home"],
        "icon": "⇤"
    },
    "ppt_last_slide": {
        "name": "Last Slide",
        "description": "Jump to the last slide",
        "category": ActionCategory.NAVIGATION,
        "keyboard_shortcut": ["end"],
        "icon": "⇥"
    },
    "ppt_start_presentation": {
        "name": "Start Presentation",
        "description": "Start slideshow from current slide",
        "category": ActionCategory.NAVIGATION,
        "keyboard_shortcut": ["shift", "f5"],
        "icon": "▶"
    },
    "ppt_end_presentation": {
        "name": "End Presentation",
        "description": "Exit slideshow mode",
        "category": ActionCategory.NAVIGATION,
        "keyboard_shortcut": ["escape"],
        "icon": "◼"
    },

    # Presentation Tools
    "ppt_toggle_laser": {
        "name": "Toggle Laser Pointer",
        "description": "Toggle laser pointer on/off",
        "category": ActionCategory.SYSTEM,
        "keyboard_shortcut": ["ctrl", "l"],
        "icon": "🔦"
    },
    "ppt_toggle_pen": {
        "name": "Toggle Pen",
        "description": "Toggle pen drawing mode",
        "category": ActionCategory.EDITING,
        "keyboard_shortcut": ["ctrl", "p"],
        "icon": "✏️"
    },
    "ppt_erase_annotations": {
        "name": "Erase Annotations",
        "description": "Clear all ink annotations",
        "category": ActionCategory.EDITING,
        "keyboard_shortcut": ["e"],
        "icon": "🧹"
    },
    "ppt_blank_screen": {
        "name": "Blank Screen",
        "description": "Toggle blank screen (black)",
        "category": ActionCategory.SYSTEM,
        "keyboard_shortcut": ["b"],
        "icon": "⬛"
    },
    "ppt_white_screen": {
        "name": "White Screen",
        "description": "Toggle white screen",
        "category": ActionCategory.SYSTEM,
        "keyboard_shortcut": ["w"],
        "icon": "⬜"
    },

    # Slide Management (Edit Mode)
    "ppt_new_slide": {
        "name": "New Slide",
        "description": "Insert a new slide",
        "category": ActionCategory.EDITING,
        "keyboard_shortcut": ["ctrl", "m"],
        "icon": "➕"
    },
    "ppt_duplicate_slide": {
        "name": "Duplicate Slide",
        "description": "Duplicate current slide",
        "category": ActionCategory.EDITING,
        "keyboard_shortcut": ["ctrl", "d"],
        "icon": "📋"
    },
    "ppt_delete_slide": {
        "name": "Delete Slide",
        "description": "Delete current slide",
        "category": ActionCategory.EDITING,
        "keyboard_shortcut": ["delete"],
        "icon": "🗑️"
    },
}


# MS Word Actions
WORD_ACTIONS = {
    # Document Navigation
    "word_page_down": {
        "name": "Page Down",
        "description": "Scroll down one page",
        "category": ActionCategory.NAVIGATION,
        "keyboard_shortcut": ["pagedown"],
        "icon": "↓"
    },
    "word_page_up": {
        "name": "Page Up",
        "description": "Scroll up one page",
        "category": ActionCategory.NAVIGATION,
        "keyboard_shortcut": ["pageup"],
        "icon": "↑"
    },
    "word_doc_start": {
        "name": "Document Start",
        "description": "Go to document beginning",
        "category": ActionCategory.NAVIGATION,
        "keyboard_shortcut": ["ctrl", "home"],
        "icon": "⇤"
    },
    "word_doc_end": {
        "name": "Document End",
        "description": "Go to document end",
        "category": ActionCategory.NAVIGATION,
        "keyboard_shortcut": ["ctrl", "end"],
        "icon": "⇥"
    },

    # Text Formatting
    "word_bold": {
        "name": "Bold",
        "description": "Toggle bold formatting",
        "category": ActionCategory.FORMATTING,
        "keyboard_shortcut": ["ctrl", "b"],
        "icon": "B"
    },
    "word_italic": {
        "name": "Italic",
        "description": "Toggle italic formatting",
        "category": ActionCategory.FORMATTING,
        "keyboard_shortcut": ["ctrl", "i"],
        "icon": "I"
    },
    "word_underline": {
        "name": "Underline",
        "description": "Toggle underline formatting",
        "category": ActionCategory.FORMATTING,
        "keyboard_shortcut": ["ctrl", "u"],
        "icon": "U"
    },
    "word_increase_font": {
        "name": "Increase Font Size",
        "description": "Increase font size",
        "category": ActionCategory.FORMATTING,
        "keyboard_shortcut": ["ctrl", "shift", ">"],
        "icon": "A+"
    },
    "word_decrease_font": {
        "name": "Decrease Font Size",
        "description": "Decrease font size",
        "category": ActionCategory.FORMATTING,
        "keyboard_shortcut": ["ctrl", "shift", "<"],
        "icon": "A-"
    },

    # Text Alignment
    "word_align_left": {
        "name": "Align Left",
        "description": "Align text to left",
        "category": ActionCategory.FORMATTING,
        "keyboard_shortcut": ["ctrl", "l"],
        "icon": "⬅"
    },
    "word_align_center": {
        "name": "Align Center",
        "description": "Center align text",
        "category": ActionCategory.FORMATTING,
        "keyboard_shortcut": ["ctrl", "e"],
        "icon": "⬌"
    },
    "word_align_right": {
        "name": "Align Right",
        "description": "Align text to right",
        "category": ActionCategory.FORMATTING,
        "keyboard_shortcut": ["ctrl", "r"],
        "icon": "➡"
    },
    "word_justify": {
        "name": "Justify",
        "description": "Justify text alignment",
        "category": ActionCategory.FORMATTING,
        "keyboard_shortcut": ["ctrl", "j"],
        "icon": "⬍"
    },

    # Editing Actions
    "word_undo": {
        "name": "Undo",
        "description": "Undo last action",
        "category": ActionCategory.EDITING,
        "keyboard_shortcut": ["ctrl", "z"],
        "icon": "↶"
    },
    "word_redo": {
        "name": "Redo",
        "description": "Redo last action",
        "category": ActionCategory.EDITING,
        "keyboard_shortcut": ["ctrl", "y"],
        "icon": "↷"
    },
    "word_find": {
        "name": "Find",
        "description": "Open find dialog",
        "category": ActionCategory.NAVIGATION,
        "keyboard_shortcut": ["ctrl", "f"],
        "icon": "🔍"
    },
    "word_replace": {
        "name": "Find & Replace",
        "description": "Open find and replace dialog",
        "category": ActionCategory.EDITING,
        "keyboard_shortcut": ["ctrl", "h"],
        "icon": "🔄"
    },

    # Document Management
    "word_save": {
        "name": "Save Document",
        "description": "Save current document",
        "category": ActionCategory.SYSTEM,
        "keyboard_shortcut": ["ctrl", "s"],
        "icon": "💾"
    },
    "word_print": {
        "name": "Print",
        "description": "Open print dialog",
        "category": ActionCategory.SYSTEM,
        "keyboard_shortcut": ["ctrl", "p"],
        "icon": "🖨️"
    },
}


# Global Actions (work in any application)
GLOBAL_ACTIONS = {
    # Media Controls
    "play_pause": {
        "name": "Play/Pause Media",
        "description": "Toggle play/pause for media",
        "category": ActionCategory.MEDIA_CONTROL,
        "keyboard_shortcut": ["playpause"],
        "icon": "⏯"
    },
    "volume_up": {
        "name": "Volume Up",
        "description": "Increase system volume",
        "category": ActionCategory.MEDIA_CONTROL,
        "keyboard_shortcut": ["volumeup"],
        "icon": "🔊"
    },
    "volume_down": {
        "name": "Volume Down",
        "description": "Decrease system volume",
        "category": ActionCategory.MEDIA_CONTROL,
        "keyboard_shortcut": ["volumedown"],
        "icon": "🔉"
    },
    "mute": {
        "name": "Mute/Unmute",
        "description": "Toggle system mute",
        "category": ActionCategory.MEDIA_CONTROL,
        "keyboard_shortcut": ["volumemute"],
        "icon": "🔇"
    },
    "next_track": {
        "name": "Next Track",
        "description": "Skip to next track",
        "category": ActionCategory.MEDIA_CONTROL,
        "keyboard_shortcut": ["nexttrack"],
        "icon": "⏭"
    },
    "prev_track": {
        "name": "Previous Track",
        "description": "Go to previous track",
        "category": ActionCategory.MEDIA_CONTROL,
        "keyboard_shortcut": ["prevtrack"],
        "icon": "⏮"
    },

    # System Actions
    "screenshot": {
        "name": "Take Screenshot",
        "description": "Capture screen screenshot",
        "category": ActionCategory.SYSTEM,
        "keyboard_shortcut": ["win", "shift", "s"],
        "icon": "📸"
    },
    "minimize_window": {
        "name": "Minimize Window",
        "description": "Minimize active window",
        "category": ActionCategory.SYSTEM,
        "keyboard_shortcut": ["win", "down"],
        "icon": "🗕"
    },
    "maximize_window": {
        "name": "Maximize Window",
        "description": "Maximize active window",
        "category": ActionCategory.SYSTEM,
        "keyboard_shortcut": ["win", "up"],
        "icon": "🗖"
    },
    "close_window": {
        "name": "Close Window",
        "description": "Close active window",
        "category": ActionCategory.SYSTEM,
        "keyboard_shortcut": ["alt", "f4"],
        "icon": "✖"
    },
    "task_view": {
        "name": "Task View",
        "description": "Open Windows task view",
        "category": ActionCategory.SYSTEM,
        "keyboard_shortcut": ["win", "tab"],
        "icon": "🗔"
    },
}


# Combined action registry
ALL_ACTIONS = {
    AppContext.POWERPOINT: POWERPOINT_ACTIONS,
    AppContext.WORD: WORD_ACTIONS,
    AppContext.GLOBAL: GLOBAL_ACTIONS,
}


def get_actions_by_context(context: AppContext) -> Dict:
    """
    Get all available actions for a specific application context.

    Args:
        context: The application context

    Returns:
        Dictionary of available actions
    """
    return ALL_ACTIONS.get(context, {})


def get_all_actions_flat() -> List[Dict]:
    """
    Get all actions as a flat list with context information.

    Returns:
        List of action dictionaries with context
    """
    actions = []
    for context, context_actions in ALL_ACTIONS.items():
        for action_id, action_data in context_actions.items():
            actions.append({
                "id": action_id,
                "context": context.value,
                **action_data
            })
    return actions


def get_action_details(action_id: str, context: AppContext = None) -> Dict:
    """
    Get details for a specific action.

    Args:
        action_id: The action identifier
        context: Optional application context to narrow search

    Returns:
        Action details dictionary or None if not found
    """
    if context:
        context_actions = get_actions_by_context(context)
        return context_actions.get(action_id)

    # Search all contexts
    for context_actions in ALL_ACTIONS.values():
        if action_id in context_actions:
            return context_actions[action_id]

    return None


def validate_action(action_id: str, context: str) -> bool:
    """
    Validate if an action exists for a given context.

    Args:
        action_id: The action identifier
        context: The application context

    Returns:
        True if action is valid for context
    """
    try:
        app_context = AppContext(context)
        actions = get_actions_by_context(app_context)
        return action_id in actions
    except ValueError:
        return False
