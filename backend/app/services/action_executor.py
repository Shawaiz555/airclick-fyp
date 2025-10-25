"""
AirClick - Action Executor Service
==================================

This service executes keyboard shortcuts and actions using pyautogui.
It handles PowerPoint, MS Word, and global system actions with automatic window switching.

Author: Muhammad Shawaiz
Project: AirClick FYP
"""

import logging
import time
from typing import List, Optional, Dict
from app.core.actions import get_action_details, AppContext
from app.core.database import get_db
from app.models.action_mapping import ActionMapping

logger = logging.getLogger(__name__)

# Check if pyautogui is available
try:
    import pyautogui
    PYAUTOGUI_AVAILABLE = True
    logger.info("✓ pyautogui is available for action execution")
except ImportError:
    PYAUTOGUI_AVAILABLE = False
    logger.warning("⚠ pyautogui not installed. Action execution will be simulated.")

# Check if pygetwindow is available (for window management)
try:
    import pygetwindow as gw
    PYGETWINDOW_AVAILABLE = True
    logger.info("✓ pygetwindow is available for window management")
except ImportError:
    PYGETWINDOW_AVAILABLE = False
    logger.warning("⚠ pygetwindow not installed. Window switching will be unavailable. Install with: pip install pygetwindow")


class ActionExecutor:
    """
    Service for executing actions via keyboard shortcuts with automatic window switching.
    """

    # Application window title patterns for detection
    APP_WINDOW_PATTERNS = {
        "POWERPOINT": ["PowerPoint", "Microsoft PowerPoint", ".pptx", ".ppt"],
        "WORD": ["Word", "Microsoft Word", ".docx", ".doc"],
        "GLOBAL": []  # Global actions don't need specific windows
    }

    def __init__(self, simulation_mode: bool = False):
        """
        Initialize the action executor.

        Args:
            simulation_mode: If True, actions are logged but not executed
        """
        # Only enable simulation mode if explicitly requested OR pyautogui is unavailable
        self.simulation_mode = simulation_mode or not PYAUTOGUI_AVAILABLE
        self.window_switching_enabled = PYGETWINDOW_AVAILABLE

        if self.simulation_mode:
            logger.warning("⚠️ Action executor in SIMULATION MODE - Actions will be logged but NOT executed")
            if not PYAUTOGUI_AVAILABLE:
                logger.error("❌ pyautogui is not installed. Install it with: pip install pyautogui")
        else:
            logger.info("✅ Action executor in ACTIVE MODE - Actions will be EXECUTED")
            # Configure pyautogui safety features
            pyautogui.FAILSAFE = True  # Move mouse to corner to abort
            pyautogui.PAUSE = 0.1  # Small pause between actions

        if not self.window_switching_enabled:
            logger.warning("⚠️ Window switching disabled - pygetwindow not available")

    def find_application_window(self, context: str) -> Optional[object]:
        """
        Find a window matching the application context.

        Args:
            context: Application context (POWERPOINT, WORD, GLOBAL)

        Returns:
            Window object if found, None otherwise
        """
        if not self.window_switching_enabled or context == "GLOBAL":
            return None

        try:
            patterns = self.APP_WINDOW_PATTERNS.get(context, [])
            if not patterns:
                return None

            # Get all windows
            all_windows = gw.getAllWindows()

            # Search for matching window
            for window in all_windows:
                if window.title:  # Skip windows without titles
                    for pattern in patterns:
                        if pattern.lower() in window.title.lower():
                            logger.info(f"✓ Found {context} window: '{window.title}'")
                            return window

            logger.warning(f"⚠ No {context} window found. Searched for patterns: {patterns}")
            return None

        except Exception as e:
            logger.error(f"❌ Error finding {context} window: {e}")
            return None

    def switch_to_window(self, window: object) -> bool:
        """
        Switch focus to a specific window.

        Args:
            window: Window object to focus

        Returns:
            True if successful, False otherwise
        """
        if not window or not self.window_switching_enabled:
            return False

        try:
            # Restore window if minimized
            if window.isMinimized:
                window.restore()
                time.sleep(0.2)  # Wait for restore animation

            # Activate (bring to front and focus)
            window.activate()
            time.sleep(0.3)  # Wait for window to gain focus

            logger.info(f"✅ Switched to window: '{window.title}'")
            return True

        except Exception as e:
            logger.error(f"❌ Error switching to window: {e}")
            return False

    def ensure_app_focused(self, context: str) -> Dict:
        """
        Ensure the correct application is focused before executing action.

        Args:
            context: Application context

        Returns:
            Dictionary with status and window info
        """
        if context == "GLOBAL":
            return {
                "switched": False,
                "reason": "Global context - no specific app required"
            }

        if not self.window_switching_enabled:
            return {
                "switched": False,
                "reason": "Window switching unavailable (pygetwindow not installed)"
            }

        # Find the application window
        window = self.find_application_window(context)

        if not window:
            return {
                "switched": False,
                "reason": f"{context} application not found or not running",
                "error": True
            }

        # Switch to the window
        success = self.switch_to_window(window)

        if success:
            return {
                "switched": True,
                "window_title": window.title,
                "context": context
            }
        else:
            return {
                "switched": False,
                "reason": "Failed to switch to window",
                "error": True
            }

    def execute_keyboard_shortcut(self, keys: List[str]) -> bool:
        """
        Execute a keyboard shortcut.

        Args:
            keys: List of keys to press (e.g., ['ctrl', 'c'])

        Returns:
            True if execution was successful
        """
        try:
            if self.simulation_mode:
                logger.info(f"[SIMULATION] Would execute shortcut: {' + '.join(keys)}")
                return True

            # REAL EXECUTION - Actually press the keys
            if len(keys) == 1:
                # Single key press
                pyautogui.press(keys[0])
                logger.info(f"✅ EXECUTED: Pressed key '{keys[0]}'")
            else:
                # Multiple keys (hotkey combination)
                pyautogui.hotkey(*keys)
                logger.info(f"✅ EXECUTED: Hotkey {' + '.join(keys)}")

            return True

        except Exception as e:
            logger.error(f"❌ ERROR executing keyboard shortcut {keys}: {e}")
            return False

    def execute_action(self, action_id: str, context: str) -> Dict:
        """
        Execute an action by its ID and context.
        Automatically switches to the correct application window before executing.

        Args:
            action_id: The action identifier
            context: The application context (POWERPOINT, WORD, GLOBAL)

        Returns:
            Dictionary with execution result
        """
        try:
            # Get database session
            db = next(get_db())

            try:
                # First, try to get action from database (NEW: Dynamic actions)
                action_mapping = ActionMapping.get_by_action_id(db, action_id)

                if action_mapping and action_mapping.is_active:
                    # Use action from database
                    action_name = action_mapping.name
                    keyboard_shortcut = action_mapping.keyboard_keys
                    logger.info(f"✓ Using action from database: {action_id}")
                else:
                    # Fallback to hardcoded actions from actions.py (DEPRECATED)
                    logger.warning(f"⚠ Action '{action_id}' not in database, using fallback from actions.py")
                    app_context = AppContext(context)
                    action_details = get_action_details(action_id, app_context)

                    if not action_details:
                        return {
                            "success": False,
                            "error": f"Action '{action_id}' not found in database or fallback"
                        }

                    action_name = action_details.get("name")
                    keyboard_shortcut = action_details.get("keyboard_shortcut", [])

                if not keyboard_shortcut:
                    return {
                        "success": False,
                        "error": f"No keyboard shortcut defined for action '{action_id}'"
                    }
            finally:
                db.close()

            # CRITICAL: Ensure correct app is focused before executing
            focus_result = self.ensure_app_focused(context)

            if focus_result.get("error"):
                logger.error(f"❌ Cannot execute action - {focus_result.get('reason')}")
                return {
                    "success": False,
                    "error": focus_result.get("reason"),
                    "action_id": action_id,
                    "action_name": action_name,
                    "context": context,
                    "app_not_found": True
                }

            # Log window switching status
            if focus_result.get("switched"):
                logger.info(f"✅ Switched to {context}: '{focus_result.get('window_title')}'")
            else:
                logger.info(f"ℹ️ {focus_result.get('reason')}")

            # Execute the shortcut
            success = self.execute_keyboard_shortcut(keyboard_shortcut)

            result = {
                "success": success,
                "action_id": action_id,
                "action_name": action_name,
                "context": context,
                "keyboard_shortcut": keyboard_shortcut,
                "simulation_mode": self.simulation_mode,
                "window_switched": focus_result.get("switched", False)
            }

            # Include window info if switched
            if focus_result.get("switched"):
                result["window_title"] = focus_result.get("window_title")

            return result

        except ValueError:
            return {
                "success": False,
                "error": f"Invalid context: '{context}'"
            }
        except Exception as e:
            logger.error(f"Error executing action '{action_id}': {e}")
            return {
                "success": False,
                "error": str(e)
            }

    def execute_action_from_gesture(self, gesture: Dict) -> Dict:
        """
        Execute action from a matched gesture.

        Args:
            gesture: Gesture dictionary with action and app_context

        Returns:
            Dictionary with execution result
        """
        action_id = gesture.get("action")
        context = gesture.get("app_context", "GLOBAL")

        return self.execute_action(action_id, context)

    def test_action(self, action_id: str, context: str) -> Dict:
        """
        Test an action without executing it (simulation mode).

        Args:
            action_id: The action identifier
            context: The application context

        Returns:
            Dictionary with test result
        """
        original_mode = self.simulation_mode
        self.simulation_mode = True

        result = self.execute_action(action_id, context)
        result["test_mode"] = True

        self.simulation_mode = original_mode

        return result


# Global action executor instance
action_executor = ActionExecutor(simulation_mode=not PYAUTOGUI_AVAILABLE)


def get_action_executor() -> ActionExecutor:
    """
    Get the global action executor instance.

    Returns:
        ActionExecutor instance
    """
    return action_executor


def set_simulation_mode(enabled: bool):
    """
    Enable or disable simulation mode globally.

    Args:
        enabled: True to enable simulation mode
    """
    action_executor.simulation_mode = enabled
    logger.info(f"Action executor simulation mode: {enabled}")
