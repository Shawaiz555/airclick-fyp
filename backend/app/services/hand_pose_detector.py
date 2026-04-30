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
    LEFT_DRAG_START = "left_drag_start"  # Start of a drag (mouse down)
    LEFT_DRAG_END = "left_drag_end"      # End of a drag (mouse up)
    SCROLL_UP = "scroll_up"
    SCROLL_DOWN = "scroll_down"


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
    RING_TIP = 16
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
        # Hand-to-screen coordinate mapping (NEW - for dragging stability)
        self.hand_orientations_buffer = deque(maxlen=stability_frames)

        # Hold-to-Drag tracking
        self.left_pinch_duration = 0
        self.is_left_dragging = False
        self.drag_trigger_threshold = 15  # ~500ms at 30fps

        # Scroll tracking — index finger extended, swipe up or down
        self.is_scrolling    = False
        self.scroll_anchor_y = None  # unused, kept for compat
        self._idx_enter_buf  = deque(maxlen=3)   # 3 frames to arm (~100ms)
        self._idx_exit_buf   = deque(maxlen=8)   # 8 frames to disarm (~266ms)
        self._idx_active     = False
        self._idx_neutral    = None
        self._idx_fired_y    = None
        self._idx_fired_dir  = None  # 'up' or 'down'
        self._idx_rearm_cooldown = 0  # frames to wait after re-arm before next scroll

        # Statistics
        self.stats = {
            'total_updates': 0,
            'left_clicks_triggered': 0,
            'right_clicks_triggered': 0,
            'false_positives_prevented': 0,
            'calibrated': False,
            'stability_blocks': 0,
            'orientation_blocks': 0,
            'scroll_triggers': 0
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

    def detect_ring_pinch(self, hand_landmarks: List[Dict]) -> bool:
        """
        Detect ring finger + thumb pinch (scroll mode activation).

        Args:
            hand_landmarks: List of 21 hand landmarks

        Returns:
            True if ring pinch detected
        """
        if len(hand_landmarks) < 17:
            return False

        thumb_tip = hand_landmarks[self.THUMB_TIP]
        ring_tip = hand_landmarks[self.RING_TIP]

        distance = self.calculate_distance(thumb_tip, ring_tip, use_z=True)
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
        if len(hand_landmarks) < 13:
            return False

        # Use multiple landmarks (wrist + index/middle MCPs + fingertips) for a more
        # robust stability signal — wrist alone misses rapid finger/palm movement
        key_indices = [0, 5, 9, 8, 12]  # wrist, index MCP, middle MCP, index tip, middle tip
        pts = []
        for i in key_indices:
            lm = hand_landmarks[i]
            pts.append([lm['x'], lm['y'], lm['z']])
        # Average the key-point centroid as a single position sample
        current_pos = np.mean(pts, axis=0)

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

        # Check if orientation is consistent and facing camera.
        # After the horizontal frame flip in hand_tracking.py the cross product
        # sign differs between left and right hands, so we check |avg_z| instead
        # of sign.  A large |z| means the palm is perpendicular to the camera
        # (facing it); a small |z| means the hand is seen edge-on (side view).
        orientations = list(self.hand_orientations_buffer)
        avg_z = np.mean(orientations)
        orientation_variance = np.var(orientations)

        is_facing_camera = abs(avg_z) > 0.3 and orientation_variance < 0.05

        if not is_facing_camera:
            logger.debug(f"⚠️ Hand not facing camera: abs(avg_z)={abs(avg_z):.3f}, variance={orientation_variance:.3f}")

        return is_facing_camera

    def are_fingers_extended(self, hand_landmarks: List[Dict]) -> bool:
        """
        Check that the index and middle fingers are reasonably extended (not curled).

        When a hand is rubbing the face/mouth the fingers are typically bent/curled
        toward the palm.  We require that the index and middle fingertips are further
        from the wrist than their respective PIP joints — a simple proxy for extension.

        Landmark indices used:
          0  = wrist
          6  = index PIP,   8  = index tip
          10 = middle PIP,  12 = middle tip
        """
        if len(hand_landmarks) < 13:
            return False

        wrist = np.array([hand_landmarks[0]['x'], hand_landmarks[0]['y'], hand_landmarks[0]['z']])

        def dist(lm):
            return np.linalg.norm(np.array([lm['x'], lm['y'], lm['z']]) - wrist)

        index_pip_dist = dist(hand_landmarks[6])
        index_tip_dist = dist(hand_landmarks[8])
        middle_pip_dist = dist(hand_landmarks[10])
        middle_tip_dist = dist(hand_landmarks[12])

        # Tip must be at least 80 % of the PIP distance from the wrist — catches all but
        # nearly-fully-curled fingers without blocking a pinch (where tip comes close to thumb,
        # not to the wrist).
        index_extended = index_tip_dist >= index_pip_dist * 0.8
        middle_extended = middle_tip_dist >= middle_pip_dist * 0.8

        if not (index_extended and middle_extended):
            logger.debug(
                f"⚠️ Fingers not extended: index={index_tip_dist:.3f}/{index_pip_dist:.3f}, "
                f"middle={middle_tip_dist:.3f}/{middle_pip_dist:.3f}"
            )

        return index_extended and middle_extended

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

    def is_index_extended(self, hand_landmarks: List[Dict]) -> bool:
        """Index finger is extended: tip Y is above its MCP (knuckle) Y."""
        if len(hand_landmarks) < 21:
            return False
        return hand_landmarks[8]['y'] < hand_landmarks[5]['y']

    def detect_scroll(self, hand_landmarks: List[Dict]) -> Dict:
        """
        Index-finger-only scroll. No other finger requirements.

        The user simply raises their index finger (it becomes extended above MCP).
        Once armed:
          - Swipe index finger DOWN past SWIPE_THRESHOLD → scroll down
            After firing, wait for finger to return UP by RETURN_THRESHOLD → re-arm
          - Swipe index finger UP past SWIPE_THRESHOLD → scroll up
            After firing, wait for finger to return DOWN by RETURN_THRESHOLD → re-arm

        Both directions use the same single neutral_y reference that floats to
        wherever the finger is when it re-arms. This means:
          - Scroll down, return up slightly → re-armed for next scroll (either direction)
          - The return stroke never fires in the opposite direction because the
            fired_y tracks which direction was last fired and only the correct
            return direction re-arms.
        """
        SWIPE_THRESHOLD     = 0.07  # ~7% of frame height
        RETURN_THRESHOLD    = 0.04   # how far back before re-arming
        FIXED_SCROLL_AMOUNT = 6

        if len(hand_landmarks) < 21:
            return {'scroll_type': ClickType.NONE.value, 'scroll_amount': 0, 'is_scrolling': False}

        index_tip_y = hand_landmarks[self.INDEX_TIP]['y']
        is_extended = self.is_index_extended(hand_landmarks)

        # ── Arm / disarm via hysteresis buffers ───────────────────────────────
        self._idx_enter_buf.append(is_extended)
        self._idx_exit_buf.append(not is_extended)

        if (not self._idx_active
                and len(self._idx_enter_buf) == self._idx_enter_buf.maxlen
                and all(self._idx_enter_buf)):
            self._idx_active    = True
            self._idx_neutral   = index_tip_y
            self._idx_fired_y   = None
            self._idx_fired_dir = None
            self._idx_exit_buf.clear()
            logger.info("☝️ SCROLL ARMED (neutral=%.3f)", index_tip_y)

        elif (self._idx_active
                and len(self._idx_exit_buf) == self._idx_exit_buf.maxlen
                and all(self._idx_exit_buf)):
            self._idx_active    = False
            self._idx_neutral   = None
            self._idx_fired_y   = None
            self._idx_fired_dir = None
            self._idx_enter_buf.clear()
            logger.info("☝️ SCROLL DISARMED")

        if not self._idx_active:
            return {'scroll_type': ClickType.NONE.value, 'scroll_amount': 0, 'is_scrolling': False}

        # ── Scroll logic ──────────────────────────────────────────────────────
        if self._idx_fired_y is None:
            # READY state (or just re-armed — wait out cooldown first).
            if self._idx_rearm_cooldown > 0:
                self._idx_rearm_cooldown -= 1
                # Still let neutral track the finger so the baseline is fresh when cooldown ends.
                self._idx_neutral = self._idx_neutral * 0.6 + index_tip_y * 0.4
                return {'scroll_type': ClickType.NONE.value, 'scroll_amount': 0, 'is_scrolling': True}

            # Neutral tracks the finger with a fast EMA (alpha=0.4 ≈ settles in ~5 frames).
            # This keeps the baseline current so both up and down swipes are always
            # measured from where the finger actually is right now.
            # The delta can never accumulate silently because neutral chases the finger.
            self._idx_neutral = self._idx_neutral * 0.6 + index_tip_y * 0.4

            delta = self._idx_neutral - index_tip_y  # positive=up, negative=down

            if delta >= SWIPE_THRESHOLD:
                self._idx_fired_y   = index_tip_y
                self._idx_fired_dir = 'up'
                # Snap neutral to fired position so no residual delta after re-arm
                self._idx_neutral   = index_tip_y
                self.stats['scroll_triggers'] += 1
                logger.info("📜 SCROLL UP (delta=%.3f)", delta)
                return {'scroll_type': ClickType.SCROLL_UP.value, 'scroll_amount': FIXED_SCROLL_AMOUNT, 'is_scrolling': True}

            elif delta <= -SWIPE_THRESHOLD:
                self._idx_fired_y   = index_tip_y
                self._idx_fired_dir = 'down'
                self._idx_neutral   = index_tip_y
                self.stats['scroll_triggers'] += 1
                logger.info("📜 SCROLL DOWN (delta=%.3f)", delta)
                return {'scroll_type': ClickType.SCROLL_DOWN.value, 'scroll_amount': FIXED_SCROLL_AMOUNT, 'is_scrolling': True}

        else:
            # WAITING state — block all scroll until finger returns past RETURN_THRESHOLD.
            # On re-arm, snap neutral to current position and start a short cooldown so
            # the return stroke itself cannot immediately fire in the opposite direction.
            if self._idx_fired_dir == 'up':
                if index_tip_y >= self._idx_fired_y + RETURN_THRESHOLD:
                    self._idx_neutral        = index_tip_y
                    self._idx_fired_y        = None
                    self._idx_fired_dir      = None
                    self._idx_rearm_cooldown = 5  # ~5 frames dead-zone after re-arm
                    logger.debug("☝️ Re-armed after scroll-up (neutral=%.3f)", index_tip_y)

            elif self._idx_fired_dir == 'down':
                if index_tip_y <= self._idx_fired_y - RETURN_THRESHOLD:
                    self._idx_neutral        = index_tip_y
                    self._idx_fired_y        = None
                    self._idx_fired_dir      = None
                    self._idx_rearm_cooldown = 5  # ~5 frames dead-zone after re-arm
                    logger.debug("☝️ Re-armed after scroll-down (neutral=%.3f)", index_tip_y)

        return {'scroll_type': ClickType.NONE.value, 'scroll_amount': 0, 'is_scrolling': True}

    def _cancel_click_state(self):
        """
        Reset all click state to prevent phantom clicks after a guard lifts.

        Must be called whenever a guard (stability / orientation / fingers)
        blocks detection.  Clearing only the pinch buffers is not enough —
        the state machines remember PINCH_DETECTED / CLICK_TRIGGERED across
        frames, so the next unblocked frame would immediately fire a click.
        """
        self.left_click_buffer.clear()
        self.right_click_buffer.clear()
        self.left_click_state = ClickState.IDLE
        self.right_click_state = ClickState.IDLE
        self.left_click_cooldown = 0
        self.right_click_cooldown = 0

    def _blocked_result(self, reason: str) -> Dict:
        """Return a standard 'no click' result dict for a blocked frame."""
        return {
            'click_type': ClickType.NONE.value,
            'trigger_left': False,
            'trigger_right': False,
            'blocked_reason': reason,
            'raw_detections': {'index_pinch': False, 'middle_pinch': False},
            'consistent_detections': {'left_click': False, 'right_click': False},
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

        # Block clicks during rapid hand movement to prevent accidental triggers
        is_stable = self.is_hand_stable(hand_landmarks)

        if not is_stable:
            logger.debug("🚫 Click blocked: Hand is not stable")
            self.stats['stability_blocks'] += 1
            self._cancel_click_state()
            return self._blocked_result('hand_unstable')

        # Block clicks when palm is not facing the camera (back of hand or side view).
        # is_hand_facing_camera() must be called every frame to keep its buffer current.
        is_facing = self.is_hand_facing_camera(hand_landmarks)

        if not is_facing:
            logger.debug("🚫 Click blocked: Palm not facing camera")
            self.stats['orientation_blocks'] += 1
            self._cancel_click_state()
            return self._blocked_result('palm_not_facing_camera')

        # Block clicks when fingers are curled (hand rubbing face, side-on, etc.)
        if not self.are_fingers_extended(hand_landmarks):
            logger.debug("🚫 Click blocked: Fingers not extended")
            self._cancel_click_state()
            return self._blocked_result('fingers_not_extended')

        # Detect pinches
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

        # NEW: Handle Hold-to-Drag for Left Click
        # If the pinch is maintained in the CLICK_TRIGGERED state, increment duration
        if self.left_click_state == ClickState.CLICK_TRIGGERED:
            self.left_pinch_duration += 1
            # If duration exceeds threshold, trigger drag start
            if self.left_pinch_duration >= self.drag_trigger_threshold and not self.is_left_dragging:
                self.is_left_dragging = True
                click_type = ClickType.LEFT_DRAG_START
                logger.info(f"🖱️ DRAG TRIGGERED: Left pinch held for {self.left_pinch_duration} frames")
        else:
            # If we were dragging and the pinch is released (state changes from CLICK_TRIGGERED)
            if self.is_left_dragging:
                self.is_left_dragging = False
                click_type = ClickType.LEFT_DRAG_END
                logger.info("🖱️ DRAG RELEASED")
            self.left_pinch_duration = 0

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

            elif click_type == ClickType.LEFT_DRAG_START.value:
                pyautogui.mouseDown()
                logger.info("✓ DRAG START (Left Mouse Down)")
                return True

            elif click_type == ClickType.LEFT_DRAG_END.value:
                pyautogui.mouseUp()
                logger.info("✓ DRAG END (Left Mouse Up)")
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

    def execute_scroll(self, scroll_type: str, scroll_amount: int) -> bool:
        """
        Execute scroll via Windows SendInput (MOUSEEVENTF_WHEEL).

        SendInput is used instead of pyautogui.scroll() because pyautogui's
        scroll does not work reliably on all Windows apps (browsers, file
        explorers, etc.) due to how it synthesizes the wheel event.
        WHEEL_DELTA=120 is one standard notch; we multiply by scroll_amount.
        """
        try:
            import ctypes
            import ctypes.wintypes

            MOUSEEVENTF_WHEEL = 0x0800
            WHEEL_DELTA = 120

            class MOUSEINPUT(ctypes.Structure):
                _fields_ = [
                    ("dx",          ctypes.c_long),
                    ("dy",          ctypes.c_long),
                    ("mouseData",   ctypes.c_ulong),
                    ("dwFlags",     ctypes.c_ulong),
                    ("time",        ctypes.c_ulong),
                    ("dwExtraInfo", ctypes.POINTER(ctypes.c_ulong)),
                ]

            class INPUT(ctypes.Structure):
                class _INPUT(ctypes.Union):
                    _fields_ = [("mi", MOUSEINPUT)]
                _anonymous_ = ("_input",)
                _fields_ = [("type", ctypes.c_ulong), ("_input", _INPUT)]

            direction = 1 if scroll_type == ClickType.SCROLL_UP.value else -1
            wheel_delta = direction * WHEEL_DELTA * scroll_amount

            inp = INPUT()
            inp.type = 0  # INPUT_MOUSE
            inp.mi.dx = 0
            inp.mi.dy = 0
            inp.mi.mouseData = ctypes.c_ulong(wheel_delta & 0xFFFFFFFF)
            inp.mi.dwFlags = MOUSEEVENTF_WHEEL
            inp.mi.time = 0
            inp.mi.dwExtraInfo = ctypes.pointer(ctypes.c_ulong(0))

            ctypes.windll.user32.SendInput(1, ctypes.byref(inp), ctypes.sizeof(INPUT))
            logger.info(f"✓ SCROLL {'UP' if direction > 0 else 'DOWN'}: {scroll_amount} units")
            return True

        except Exception as e:
            logger.error(f"Error executing scroll via SendInput: {e}")
            # Fallback to pyautogui
            try:
                import pyautogui
                direction = 1 if scroll_type == ClickType.SCROLL_UP.value else -1
                pyautogui.scroll(direction * scroll_amount)
                return True
            except Exception:
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

        # Reset dragging state
        self.left_pinch_duration = 0
        self.is_left_dragging = False

        # Reset scroll state
        self.is_scrolling   = False
        self.scroll_anchor_y = None
        self._idx_enter_buf.clear()
        self._idx_exit_buf.clear()
        self._idx_active         = False
        self._idx_neutral        = None
        self._idx_fired_y        = None
        self._idx_fired_dir      = None
        self._idx_rearm_cooldown = 0

        self.stats = {
            'total_updates': 0,
            'left_clicks_triggered': 0,
            'right_clicks_triggered': 0,
            'false_positives_prevented': 0,
            'calibrated': self.stats.get('calibrated', False),
            'stability_blocks': 0,
            'orientation_blocks': 0,
            'scroll_triggers': 0
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
            pinch_threshold=0.08,       # 8cm distance to trigger pinch
            release_threshold=0.12,     # 12cm hysteresis
            cooldown_frames=8,          # ~250ms between clicks (was 5)
            consistency_frames=4,       # 4 consecutive frames required (was 2) — ~130ms at 30fps
            adaptive_threshold=False,   # Disabled for consistency
            stability_threshold=0.012,  # Tighter stability — less hand jitter allowed (was 0.015)
            stability_frames=8          # Need 8 stable frames (~260ms) before allowing click (was 5)
        )
        logger.info("Global hand pose detector created (STRICT CLICK MODE - stability_frames=8, consistency=4)")

    return hand_pose_detector


def reset_hand_pose_detector():
    """Reset the global hand pose detector."""
    global hand_pose_detector

    if hand_pose_detector:
        hand_pose_detector.reset()
