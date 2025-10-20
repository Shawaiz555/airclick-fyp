"""
AirClick - Action Executor Service
==================================

This service executes keyboard shortcuts and actions using pyautogui.
It handles PowerPoint, MS Word, and global system actions.

Author: Muhammad Shawaiz
Project: AirClick FYP
"""

import logging
from typing import List, Optional, Dict
from app.core.actions import get_action_details, AppContext

logger = logging.getLogger(__name__)

# Check if pyautogui is available
try:
    import pyautogui
    PYAUTOGUI_AVAILABLE = True
    logger.info("✓ pyautogui is available for action execution")
except ImportError:
    PYAUTOGUI_AVAILABLE = False
    logger.warning("⚠ pyautogui not installed. Action execution will be simulated.")


class ActionExecutor:
    """
    Service for executing actions via keyboard shortcuts.
    """

    def __init__(self, simulation_mode: bool = False):
        """
        Initialize the action executor.

        Args:
            simulation_mode: If True, actions are logged but not executed
        """
        # Only enable simulation mode if explicitly requested OR pyautogui is unavailable
        self.simulation_mode = simulation_mode or not PYAUTOGUI_AVAILABLE

        if self.simulation_mode:
            logger.warning("⚠️ Action executor in SIMULATION MODE - Actions will be logged but NOT executed")
            if not PYAUTOGUI_AVAILABLE:
                logger.error("❌ pyautogui is not installed. Install it with: pip install pyautogui")
        else:
            logger.info("✅ Action executor in ACTIVE MODE - Actions will be EXECUTED")
            # Configure pyautogui safety features
            pyautogui.FAILSAFE = True  # Move mouse to corner to abort
            pyautogui.PAUSE = 0.1  # Small pause between actions

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

        Args:
            action_id: The action identifier
            context: The application context (POWERPOINT, WORD, GLOBAL)

        Returns:
            Dictionary with execution result
        """
        try:
            # Get action details
            app_context = AppContext(context)
            action_details = get_action_details(action_id, app_context)

            if not action_details:
                return {
                    "success": False,
                    "error": f"Action '{action_id}' not found in context '{context}'"
                }

            # Get keyboard shortcut
            keyboard_shortcut = action_details.get("keyboard_shortcut", [])

            if not keyboard_shortcut:
                return {
                    "success": False,
                    "error": f"No keyboard shortcut defined for action '{action_id}'"
                }

            # Execute the shortcut
            success = self.execute_keyboard_shortcut(keyboard_shortcut)

            return {
                "success": success,
                "action_id": action_id,
                "action_name": action_details.get("name"),
                "context": context,
                "keyboard_shortcut": keyboard_shortcut,
                "simulation_mode": self.simulation_mode
            }

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
