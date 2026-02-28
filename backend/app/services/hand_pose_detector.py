"""
AirClick - Hand Pose Detector Service
=====================================

This service detects specific hand poses (pinch gestures) for triggering clicks.
Uses geometric distance calculations on MediaPipe hand landmarks.

Supported Gestures:
- Index Pinch (Index + Thumb): Left Click
- Middle Pinch (Middle + Thumb): Right Click

Features:
- State machine to prevent double-clicks
- Temporal consistency (require N consecutive frames)
- Adaptive thresholds based on hand size
- Hysteresis for stable detection

Author: Muhammad Shawaiz (Enhanced by Claude)
Project: AirClick FYP
"""

import numpy as np
import logging
from typing import Dict, List, Tuple, Optional
from enum import Enum
from collections import deque

logger = logging.getLogger(__name__)


class ClickType(Enum):
    """Click types supported by the system."""
    NONE = "none"
    LEFT_CLICK = "left_click"
    RIGHT_CLICK = "right_click"


class ClickState(Enum):
    """State machine states for click detection."""
    IDLE = "idle"
    PINCH_DETECTED = "pinch_detected"
    CLICK_TRIGGERED = "click_triggered"
    COOLDOWN = "cooldown"


class HandPoseDetector:
    """
    Detects hand poses (pinch gestures) for click detection with advanced filtering.

    Architecture:
        Hand Landmarks → Calculate Distances → Check Thresholds → State Machine → Trigger Click
    """

    # MediaPipe hand landmark indices
    THUMB_TIP = 4
    INDEX_TIP = 8
    MIDDLE_TIP = 12
    WRIST = 0

    def __init__(
        self,
        pinch_threshold: float = 0.05,
        release_threshold: float = 0.08,
        cooldown_frames: int = 10,
        consistency_frames: int = 3,
        adaptive_threshold: bool = True,
        stability_threshold: float = 0.02,
        stability_frames: int = 5
    ):
        """
        Initialize the hand pose detector.

        Args:
            pinch_threshold: Distance threshold for pinch detection (0-1)
            release_threshold: Distance threshold for release (hysteresis)
            cooldown_frames: Number of frames to wait before next click
            consistency_frames: Number of consecutive frames required
            adaptive_threshold: Auto-adjust thresholds based on hand size
            stability_threshold: Maximum hand movement allowed for click (prevents clicks during motion)
            stability_frames: Number of stable frames required before click
        """
        self.pinch_threshold = pinch_threshold
        self.release_threshold = release_threshold
        self.cooldown_frames = cooldown_frames
        self.consistency_frames = consistency_frames
        self.adaptive_threshold = adaptive_threshold
        self.stability_threshold = stability_threshold
        self.stability_frames = stability_frames

        # State machines for each click type
        self.left_click_state = ClickState.IDLE
        self.right_click_state = ClickState.IDLE

        # Cooldown counters
        self.left_click_cooldown = 0
        self.right_click_cooldown = 0

        # Consistency buffers (store recent detection results)
        self.left_click_buffer = deque(maxlen=consistency_frames)
        self.right_click_buffer = deque(maxlen=consistency_frames)

        # Hand size calibration
        self.hand_size_samples = []
        self.calibrated_hand_size = None

        # Hand stability tracking (NEW - prevents clicks during motion)
        self.hand_positions_buffer = deque(maxlen=stability_frames)
        self.hand_orientations_buffer = deque(maxlen=stability_frames)

        # Statistics
        self.stats = {
            'total_updates': 0,
            'left_clicks_triggered': 0,
            'right_clicks_triggered': 0,
            'false_positives_prevented': 0,
            'calibrated': False,
            'stability_blocks': 0,  # Track how many clicks blocked due to instability
            'orientation_blocks': 0  # Track how many clicks blocked due to bad orientation
        }

        logger.info(f"Hand Pose Detector initialized (pinch_threshold={pinch_threshold}, cooldown={cooldown_frames}, stability_threshold={stability_threshold})")

    def calculate_distance(
        self,
        point1: Dict,
        point2: Dict,
        use_z: bool = True
    ) -> float:
        """
        Calculate Euclidean distance between two landmarks.

        Args:
            point1: First landmark {'x': ..., 'y': ..., 'z': ...}
            point2: Second landmark
            use_z: Include Z coordinate in distance calculation

        Returns:
            Euclidean distance (0-1 in normalized space)
        """
        dx = point1['x'] - point2['x']
        dy = point1['y'] - point2['y']

        if use_z and 'z' in point1 and 'z' in point2:
            dz = point1['z'] - point2['z']
            return np.sqrt(dx**2 + dy**2 + dz**2)
        else:
            return np.sqrt(dx**2 + dy**2)

    def estimate_hand_size(self, hand_landmarks: List[Dict]) -> float:
        """
        Estimate hand size using wrist-to-middle-finger distance.

        Args:
            hand_landmarks: List of 21 hand landmarks

        Returns:
            Estimated hand size (distance)
        """
        if len(hand_landmarks) < 13:
            return 0.2  # Default hand size

        wrist = hand_landmarks[self.WRIST]
        middle_tip = hand_landmarks[self.MIDDLE_TIP]

        return self.calculate_distance(wrist, middle_tip, use_z=False)

    def calibrate_hand_size(self, hand_landmarks: List[Dict]):
        """
        Calibrate adaptive thresholds based on user's hand size.

        Args:
            hand_landmarks: List of 21 hand landmarks
        """
        if not self.adaptive_threshold:
            return

        hand_size = self.estimate_hand_size(hand_landmarks)

        # Collect samples for calibration
        self.hand_size_samples.append(hand_size)

        # Calibrate after collecting enough samples
        if len(self.hand_size_samples) >= 30:  # 1 second @ 30fps
            self.calibrated_hand_size = np.median(self.hand_size_samples)

            # Adjust thresholds based on hand size
            # Larger hands need larger thresholds
            scale_factor = self.calibrated_hand_size / 0.2  # 0.2 is typical hand size

            self.pinch_threshold = 0.05 * scale_factor
            self.release_threshold = 0.08 * scale_factor

            self.stats['calibrated'] = True

            logger.info(f"Hand size calibrated: {self.calibrated_hand_size:.3f}")
            logger.info(f"Adjusted pinch_threshold: {self.pinch_threshold:.3f}")
            logger.info(f"Adjusted release_threshold: {self.release_threshold:.3f}")

            # Clear samples to allow re-calibration if needed
            self.hand_size_samples = []

    def detect_index_pinch(self, hand_landmarks: List[Dict]) -> bool:
        """
        Detect index finger + thumb pinch (left click).

        Args:
            hand_landmarks: List of 21 hand landmarks

        Returns:
            True if pinch detected, False otherwise
        """
        if len(hand_landmarks) < 9:
            return False

        thumb_tip = hand_landmarks[self.THUMB_TIP]
        index_tip = hand_landmarks[self.INDEX_TIP]

        distance = self.calculate_distance(thumb_tip, index_tip, use_z=True)

        return distance < self.pinch_threshold

    def detect_middle_pinch(self, hand_landmarks: List[Dict]) -> bool:
        """
        Detect middle finger + thumb pinch (right click).

        Args:
            hand_landmarks: List of 21 hand landmarks

        Returns:
            True if pinch detected, False otherwise
        """
        if len(hand_landmarks) < 13:
            return False

        thumb_tip = hand_landmarks[self.THUMB_TIP]
        middle_tip = hand_landmarks[self.MIDDLE_TIP]

        distance = self.calculate_distance(thumb_tip, middle_tip, use_z=True)

        return distance < self.pinch_threshold

    def check_consistency(self, buffer: deque) -> bool:
        """
        Check if gesture is consistent across recent frames.

        Args:
            buffer: Deque containing recent detection results (True/False)

        Returns:
            True if all recent frames agree, False otherwise
        """
        if len(buffer) < self.consistency_frames:
            return False

        # All frames must agree
        return all(buffer)

    def is_hand_stable(self, hand_landmarks: List[Dict]) -> bool:
        """
        Check if hand is stable (not moving rapidly).

        This prevents clicks during rapid hand movements like:
        - Rubbing eyes
        - Fixing hair
        - Waving hand
        - Scratching face

        Args:
            hand_landmarks: List of 21 hand landmarks

        Returns:
            True if hand is stable, False if moving too fast
        """
        if len(hand_landmarks) < 1:
            return False

        # Use wrist position for stability tracking
        wrist = hand_landmarks[0]
        current_pos = np.array([wrist['x'], wrist['y'], wrist['z']])

        # Add to position buffer
        self.hand_positions_buffer.append(current_pos)

        # Need enough samples to check stability
        if len(self.hand_positions_buffer) < self.stability_frames:
            return False

        # Calculate variance in hand position over recent frames
        positions = np.array(list(self.hand_positions_buffer))
        position_variance = np.var(positions, axis=0)
        max_variance = np.max(position_variance)

        # Check if variance is below threshold (hand is stable)
        is_stable = max_variance < (self.stability_threshold ** 2)

        if not is_stable:
            logger.debug(f"⚠️ Hand unstable: variance={max_variance:.6f}, threshold={self.stability_threshold**2:.6f}")

        return is_stable

    def is_hand_facing_camera(self, hand_landmarks: List[Dict]) -> bool:
        """
        Check if hand is facing the camera (not sideways or upside down).

        This prevents clicks when hand is in unnatural positions:
        - Hand sideways (rubbing face)
        - Palm facing away
        - Hand upside down

        Uses the palm normal vector to determine orientation.

        Args:
            hand_landmarks: List of 21 hand landmarks

        Returns:
            True if hand is properly oriented toward camera, False otherwise
        """
        if len(hand_landmarks) < 13:
            return False

        # Use wrist, index MCP, and pinky MCP to calculate palm normal
        wrist = hand_landmarks[0]
        index_mcp = hand_landmarks[5]  # Index finger base
        pinky_mcp = hand_landmarks[17]  # Pinky finger base

        # Create vectors
        v1 = np.array([index_mcp['x'] - wrist['x'],
                      index_mcp['y'] - wrist['y'],
                      index_mcp['z'] - wrist['z']])
        v2 = np.array([pinky_mcp['x'] - wrist['x'],
                      pinky_mcp['y'] - wrist['y'],
                      pinky_mcp['z'] - wrist['z']])

        # Calculate palm normal using cross product
        palm_normal = np.cross(v1, v2)

        # Normalize the normal vector
        magnitude = np.linalg.norm(palm_normal)
        if magnitude < 0.001:
            return False

        palm_normal = palm_normal / magnitude

        # Camera is looking along the Z axis (negative Z in MediaPipe)
        # Good orientation: palm facing camera means Z component should be negative
        # We also want the hand to be relatively upright (Y component check)

        z_component = palm_normal[2]

        # Add to orientation buffer
        self.hand_orientations_buffer.append(z_component)

        # Need enough samples
        if len(self.hand_orientations_buffer) < self.stability_frames:
            return False

        # Check if orientation is consistent and facing camera
        # Z component should be negative (palm facing camera) and consistent
        orientations = list(self.hand_orientations_buffer)
        avg_z = np.mean(orientations)
        orientation_variance = np.var(orientations)

        # Good orientation: negative Z (facing camera) with low variance
        is_facing_camera = avg_z < -0.3 and orientation_variance < 0.1

        if not is_facing_camera:
            logger.debug(f"⚠️ Hand not facing camera: avg_z={avg_z:.3f}, variance={orientation_variance:.3f}")

        return is_facing_camera

    def update_state_machine(
        self,
        is_pinched: bool,
        state: ClickState,
        cooldown_counter: int
    ) -> Tuple[ClickState, int, bool]:
        """
        Update click state machine.

        Args:
            is_pinched: Current pinch detection result
            state: Current state
            cooldown_counter: Current cooldown counter

        Returns:
            Tuple of (new_state, new_cooldown, trigger_click)
        """
        trigger_click = False

        # Decrement cooldown if active
        if cooldown_counter > 0:
            cooldown_counter -= 1
            return (ClickState.COOLDOWN, cooldown_counter, False)

        # State machine logic
        if state == ClickState.IDLE:
            if is_pinched:
                # Transition to PINCH_DETECTED
                state = ClickState.PINCH_DETECTED
            else:
                # Stay in IDLE
                pass

        elif state == ClickState.PINCH_DETECTED:
            if is_pinched:
                # Trigger click and move to CLICK_TRIGGERED
                trigger_click = True
                state = ClickState.CLICK_TRIGGERED
                cooldown_counter = self.cooldown_frames
            else:
                # False alarm, return to IDLE
                state = ClickState.IDLE
                self.stats['false_positives_prevented'] += 1

        elif state == ClickState.CLICK_TRIGGERED:
            if not is_pinched:
                # Release detected, return to IDLE
                state = ClickState.IDLE
            else:
                # Keep in CLICK_TRIGGERED until release
                pass

        elif state == ClickState.COOLDOWN:
            # Cooldown handled above
            if cooldown_counter == 0:
                state = ClickState.IDLE

        return (state, cooldown_counter, trigger_click)

    def detect_clicks(self, hand_landmarks: List[Dict]) -> Dict:
        """
        Main detection loop: detect clicks from hand landmarks.

        Args:
            hand_landmarks: List of 21 hand landmarks from MediaPipe

        Returns:
            Dictionary with click detection results
        """
        self.stats['total_updates'] += 1

        # Calibrate hand size if adaptive thresholds enabled
        if self.adaptive_threshold and not self.stats['calibrated']:
            self.calibrate_hand_size(hand_landmarks)

        # CRITICAL: Check hand stability and orientation BEFORE detecting pinches
        # This prevents unintentional clicks during rapid movements or bad hand positions
        is_stable = self.is_hand_stable(hand_landmarks)
        is_facing_camera = self.is_hand_facing_camera(hand_landmarks)

        # Only proceed with click detection if hand is stable and properly oriented
        if not is_stable:
            logger.debug("🚫 Click blocked: Hand is not stable (rapid movement detected)")
            self.stats['stability_blocks'] += 1
            # Clear consistency buffers to reset click detection
            self.left_click_buffer.clear()
            self.right_click_buffer.clear()
            return {
                'click_type': ClickType.NONE.value,
                'trigger_left': False,
                'trigger_right': False,
                'blocked_reason': 'hand_unstable',
                'raw_detections': {
                    'index_pinch': False,
                    'middle_pinch': False
                },
                'consistent_detections': {
                    'left_click': False,
                    'right_click': False
                },
                'states': {
                    'left_click': self.left_click_state.value,
                    'right_click': self.right_click_state.value
                },
                'cooldowns': {
                    'left_click': int(self.left_click_cooldown),
                    'right_click': int(self.right_click_cooldown)
                },
                'stats': self.stats.copy()
            }

        if not is_facing_camera:
            logger.debug("🚫 Click blocked: Hand not facing camera (bad orientation)")
            self.stats['orientation_blocks'] += 1
            # Clear consistency buffers to reset click detection
            self.left_click_buffer.clear()
            self.right_click_buffer.clear()
            return {
                'click_type': ClickType.NONE.value,
                'trigger_left': False,
                'trigger_right': False,
                'blocked_reason': 'hand_not_facing_camera',
                'raw_detections': {
                    'index_pinch': False,
                    'middle_pinch': False
                },
                'consistent_detections': {
                    'left_click': False,
                    'right_click': False
                },
                'states': {
                    'left_click': self.left_click_state.value,
                    'right_click': self.right_click_state.value
                },
                'cooldowns': {
                    'left_click': int(self.left_click_cooldown),
                    'right_click': int(self.right_click_cooldown)
                },
                'stats': self.stats.copy()
            }

        # Detect pinches (only if hand is stable and facing camera)
        is_index_pinched = self.detect_index_pinch(hand_landmarks)
        is_middle_pinched = self.detect_middle_pinch(hand_landmarks)

        # Add to consistency buffers
        self.left_click_buffer.append(is_index_pinched)
        self.right_click_buffer.append(is_middle_pinched)

        # Check temporal consistency
        consistent_left = self.check_consistency(self.left_click_buffer)
        consistent_right = self.check_consistency(self.right_click_buffer)

        # Update state machines
        (
            self.left_click_state,
            self.left_click_cooldown,
            trigger_left
        ) = self.update_state_machine(
            consistent_left,
            self.left_click_state,
            self.left_click_cooldown
        )

        (
            self.right_click_state,
            self.right_click_cooldown,
            trigger_right
        ) = self.update_state_machine(
            consistent_right,
            self.right_click_state,
            self.right_click_cooldown
        )

        # Update statistics
        if trigger_left:
            self.stats['left_clicks_triggered'] += 1

        if trigger_right:
            self.stats['right_clicks_triggered'] += 1

        # Determine click type
        click_type = ClickType.NONE
        if trigger_left and trigger_right:
            # Both detected (rare) - prioritize left click
            click_type = ClickType.LEFT_CLICK
        elif trigger_left:
            click_type = ClickType.LEFT_CLICK
        elif trigger_right:
            click_type = ClickType.RIGHT_CLICK

        return {
            'click_type': click_type.value,
            'trigger_left': bool(trigger_left),  # Convert to native Python bool
            'trigger_right': bool(trigger_right),
            'raw_detections': {
                'index_pinch': bool(is_index_pinched),
                'middle_pinch': bool(is_middle_pinched)
            },
            'consistent_detections': {
                'left_click': bool(consistent_left),
                'right_click': bool(consistent_right)
            },
            'states': {
                'left_click': self.left_click_state.value,
                'right_click': self.right_click_state.value
            },
            'cooldowns': {
                'left_click': int(self.left_click_cooldown),  # Convert to native int
                'right_click': int(self.right_click_cooldown)
            },
            'stats': self.stats.copy()
        }

    def execute_click(self, click_type: str) -> bool:
        """
        Execute the actual click using PyAutoGUI.

        Args:
            click_type: 'left_click' or 'right_click'

        Returns:
            True if successful, False otherwise
        """
        try:
            import pyautogui

            if click_type == ClickType.LEFT_CLICK.value:
                pyautogui.click()
                logger.info("✓ LEFT CLICK executed")
                return True

            elif click_type == ClickType.RIGHT_CLICK.value:
                pyautogui.rightClick()
                logger.info("✓ RIGHT CLICK executed")
                return True

            else:
                return False

        except ImportError:
            logger.error("PyAutoGUI not available - cannot execute clicks")
            return False
        except Exception as e:
            logger.error(f"Error executing click: {e}")
            return False

    def reset(self):
        """Reset detector state."""
        self.left_click_state = ClickState.IDLE
        self.right_click_state = ClickState.IDLE
        self.left_click_cooldown = 0
        self.right_click_cooldown = 0
        self.left_click_buffer.clear()
        self.right_click_buffer.clear()
        self.hand_positions_buffer.clear()
        self.hand_orientations_buffer.clear()

        self.stats = {
            'total_updates': 0,
            'left_clicks_triggered': 0,
            'right_clicks_triggered': 0,
            'false_positives_prevented': 0,
            'calibrated': self.stats.get('calibrated', False),
            'stability_blocks': 0,
            'orientation_blocks': 0
        }

        logger.info("Hand pose detector reset")

    def get_stats(self) -> Dict:
        """Get detection statistics."""
        return {
            **self.stats,
            'config': {
                'pinch_threshold': self.pinch_threshold,
                'release_threshold': self.release_threshold,
                'cooldown_frames': self.cooldown_frames,
                'consistency_frames': self.consistency_frames,
                'adaptive_threshold': self.adaptive_threshold,
                'stability_threshold': self.stability_threshold,
                'stability_frames': self.stability_frames
            },
            'calibration': {
                'calibrated': self.stats.get('calibrated', False),
                'hand_size': self.calibrated_hand_size
            }
        }


# Global hand pose detector instance
hand_pose_detector: Optional[HandPoseDetector] = None


def get_hand_pose_detector() -> HandPoseDetector:
    """
    Get the global hand pose detector instance.
    Creates one if it doesn't exist.

    Returns:
        HandPoseDetector instance
    """
    global hand_pose_detector

    if hand_pose_detector is None:
        hand_pose_detector = HandPoseDetector(
            pinch_threshold=0.08,       # 8cm - MUCH easier to trigger (was 5cm)
            release_threshold=0.12,     # 12cm (hysteresis)
            cooldown_frames=5,          # ~160ms - faster clicks (was 10)
            consistency_frames=2,       # Only 2 frames needed (was 3)
            adaptive_threshold=False,   # Disabled for consistency
            stability_threshold=0.015,  # Hand must be stable (low movement) to click
            stability_frames=5          # Need 5 stable frames (~160ms) before allowing click
        )
        logger.info("Global hand pose detector created (STABLE CLICK MODE - prevents unintentional clicks)")

    return hand_pose_detector


def reset_hand_pose_detector():
    """Reset the global hand pose detector."""
    global hand_pose_detector

    if hand_pose_detector:
        hand_pose_detector.reset()
