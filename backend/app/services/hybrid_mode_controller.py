"""
AirClick - Hybrid Mode Controller Service
=========================================

This service combines cursor control and gesture recognition in a unified system.

Hybrid Mode Features:
- Simultaneous cursor movement and gesture recognition
- Automatic mode detection (cursor vs gesture)
- Click detection with pinch gestures
- Performance-optimized dual processing

Modes:
1. Cursor Mode (Hybrid ON): Real-time cursor control + click detection
2. Gesture Mode (Hybrid OFF): Traditional gesture matching

Author: Muhammad Shawaiz (Enhanced by Claude)
Project: AirClick FYP
"""

import logging
from typing import Dict, List, Optional
from app.services.cursor_controller import get_cursor_controller
from app.services.hand_pose_detector import get_hand_pose_detector
import time

logger = logging.getLogger(__name__)


class HybridModeController:
    """
    Main controller for hybrid mode (cursor + gesture recognition).

    Architecture:
        Hand Landmarks → [Cursor Control] + [Click Detection] + [Gesture Recognition]
    """

    def __init__(self):
        """Initialize hybrid mode controller."""
        # Get service instances
        self.cursor_controller = get_cursor_controller()
        self.hand_pose_detector = get_hand_pose_detector()

        # Mode state
        self.hybrid_mode_enabled = False
        self.cursor_only_mode = False  # If True, disable gesture recognition

        # Performance tracking
        self.stats = {
            'total_updates': 0,
            'cursor_updates': 0,
            'clicks_detected': 0,
            'gestures_matched': 0,
            'avg_latency_ms': 0.0,
            'total_latency': 0.0
        }

        logger.info("Hybrid Mode Controller initialized")

    def process_frame(self, hand_data: Dict) -> Dict:
        """
        Process a single frame in hybrid mode.

        Args:
            hand_data: Hand tracking data from MediaPipe containing:
                - hands: List of detected hands with landmarks
                - hand_count: Number of hands detected

        Returns:
            Dictionary with processing results
        """
        start_time = time.time()
        self.stats['total_updates'] += 1

        # Check if hands are detected
        if hand_data.get('hand_count', 0) == 0:
            return {
                'success': False,
                'error': 'No hands detected',
                'hybrid_mode_enabled': self.hybrid_mode_enabled,
                'cursor_enabled': False
            }

        # Get first hand landmarks
        hand = hand_data['hands'][0]
        landmarks = hand['landmarks']

        result = {
            'success': True,
            'hybrid_mode_enabled': self.hybrid_mode_enabled,
            'cursor_enabled': self.hybrid_mode_enabled,
            'timestamp': time.time()
        }

        # Process cursor movement if hybrid mode enabled
        if self.hybrid_mode_enabled:
            cursor_result = self.cursor_controller.update_cursor(landmarks)
            result['cursor'] = cursor_result
            self.stats['cursor_updates'] += 1

            # Detect clicks
            click_result = self.hand_pose_detector.detect_clicks(landmarks)
            result['clicks'] = click_result

            # Execute click if detected
            if click_result['click_type'] != 'none':
                self.hand_pose_detector.execute_click(click_result['click_type'])
                self.stats['clicks_detected'] += 1

        else:
            # Hybrid mode OFF - cursor disabled
            result['cursor'] = {
                'success': False,
                'cursor_enabled': False,
                'message': 'Hybrid mode disabled'
            }
            result['clicks'] = {
                'click_type': 'none',
                'message': 'Hybrid mode disabled'
            }

        # Calculate latency
        latency = (time.time() - start_time) * 1000
        self.stats['total_latency'] += latency

        if self.stats['total_updates'] > 0:
            self.stats['avg_latency_ms'] = (
                self.stats['total_latency'] / self.stats['total_updates']
            )

        result['latency_ms'] = latency
        result['stats'] = self.get_stats()

        return result

    def enable_hybrid_mode(self):
        """Enable hybrid mode (cursor control + clicks)."""
        self.hybrid_mode_enabled = True
        self.cursor_controller.enable_cursor()
        logger.info("✅ HYBRID MODE ENABLED - Cursor control active")

    def disable_hybrid_mode(self):
        """Disable hybrid mode (gesture-only mode)."""
        self.hybrid_mode_enabled = False
        self.cursor_controller.disable_cursor()
        logger.info("❌ HYBRID MODE DISABLED - Gesture-only mode")

    def toggle_hybrid_mode(self) -> bool:
        """
        Toggle hybrid mode on/off.

        Returns:
            New hybrid mode state (True/False)
        """
        if self.hybrid_mode_enabled:
            self.disable_hybrid_mode()
        else:
            self.enable_hybrid_mode()

        return self.hybrid_mode_enabled

    def set_hybrid_mode(self, enabled: bool):
        """
        Set hybrid mode explicitly.

        Args:
            enabled: True to enable, False to disable
        """
        if enabled:
            self.enable_hybrid_mode()
        else:
            self.disable_hybrid_mode()

    def reset(self):
        """Reset all controllers and statistics."""
        self.cursor_controller.reset()
        self.hand_pose_detector.reset()

        self.stats = {
            'total_updates': 0,
            'cursor_updates': 0,
            'clicks_detected': 0,
            'gestures_matched': 0,
            'avg_latency_ms': 0.0,
            'total_latency': 0.0
        }

        logger.info("Hybrid mode controller reset")

    def get_stats(self) -> Dict:
        """Get comprehensive statistics."""
        return {
            'hybrid': {
                **self.stats,
                'hybrid_mode_enabled': self.hybrid_mode_enabled
            },
            'cursor': self.cursor_controller.get_stats(),
            'clicks': self.hand_pose_detector.get_stats()
        }

    def get_status(self) -> Dict:
        """Get current status summary."""
        return {
            'hybrid_mode_enabled': self.hybrid_mode_enabled,
            'cursor_enabled': self.cursor_controller.cursor_enabled,
            'total_updates': self.stats['total_updates'],
            'cursor_updates': self.stats['cursor_updates'],
            'clicks_detected': self.stats['clicks_detected'],
            'avg_latency_ms': round(self.stats['avg_latency_ms'], 2)
        }


# Global hybrid mode controller instance
hybrid_mode_controller: Optional[HybridModeController] = None


def get_hybrid_mode_controller() -> HybridModeController:
    """
    Get the global hybrid mode controller instance.
    Creates one if it doesn't exist.

    Returns:
        HybridModeController instance
    """
    global hybrid_mode_controller

    if hybrid_mode_controller is None:
        hybrid_mode_controller = HybridModeController()
        logger.info("Global hybrid mode controller created")

    return hybrid_mode_controller


def reset_hybrid_mode_controller():
    """Reset the global hybrid mode controller."""
    global hybrid_mode_controller

    if hybrid_mode_controller:
        hybrid_mode_controller.reset()
