"""
AirClick - Cursor Controller Service
====================================

This service provides real-time cursor control using hand tracking data.
It converts hand landmarks (index finger tip) to screen coordinates and
moves the cursor smoothly using advanced filtering algorithms.

Features:
- One Euro Filter for smooth cursor movement
- Dead zone filtering to prevent jitter
- Adaptive gain control for precision/speed modes
- Multi-monitor support
- Hand-to-screen coordinate mapping

Author: Muhammad Shawaiz (Enhanced by Claude)
Project: AirClick FYP
"""

import numpy as np
import logging
from typing import Dict, List, Tuple, Optional
from app.services.temporal_smoothing import OneEuroFilter
import time

# Platform-specific cursor control
try:
    import ctypes
    CTYPES_AVAILABLE = True
except ImportError:
    CTYPES_AVAILABLE = False

try:
    import pyautogui
    PYAUTOGUI_AVAILABLE = True
except ImportError:
    PYAUTOGUI_AVAILABLE = False

logger = logging.getLogger(__name__)


class CursorController:
    """
    Main cursor controller that handles hand-to-cursor mapping with advanced smoothing.

    Architecture:
        Hand Landmarks → Extract Index Tip → Smooth → Map to Screen → Move Cursor
    """

    def __init__(
        self,
        screen_width: Optional[int] = None,
        screen_height: Optional[int] = None,
        smoothing_enabled: bool = True,
        dead_zone_threshold: float = 0.01,
        movement_scale: float = 2.0,
        use_fast_api: bool = True
    ):
        """
        Initialize the cursor controller.

        Args:
            screen_width: Screen width in pixels (auto-detected if None)
            screen_height: Screen height in pixels (auto-detected if None)
            smoothing_enabled: Enable One Euro Filter smoothing
            dead_zone_threshold: Movement threshold to prevent jitter (0-1)
            movement_scale: Cursor movement amplification factor
            use_fast_api: Use ctypes for faster cursor control (Windows only)
        """
        # Get screen dimensions
        if screen_width is None or screen_height is None:
            if PYAUTOGUI_AVAILABLE:
                self.screen_width, self.screen_height = pyautogui.size()
            else:
                # Default to Full HD
                self.screen_width = 1920
                self.screen_height = 1080
                logger.warning(f"PyAutoGUI not available, using default screen size: {self.screen_width}x{self.screen_height}")
        else:
            self.screen_width = screen_width
            self.screen_height = screen_height

        logger.info(f"Cursor Controller initialized for screen: {self.screen_width}x{self.screen_height}")

        # Configuration
        self.smoothing_enabled = smoothing_enabled
        self.dead_zone_threshold = dead_zone_threshold
        self.movement_scale = movement_scale
        self.use_fast_api = use_fast_api and CTYPES_AVAILABLE

        # Initialize One Euro Filters for X and Y coordinates.
        # min_cutoff can be lower now because the Median+EMA pipeline upstream
        # already removed most noise — the One Euro Filter only needs to handle
        # residual velocity-dependent lag, not raw landmark noise.
        if self.smoothing_enabled:
            self.filter_x = OneEuroFilter(
                min_cutoff=1.0,  # slightly higher than 0.8 = a touch more responsive
                beta=0.009,
                d_cutoff=1.0
            )
            self.filter_y = OneEuroFilter(
                min_cutoff=1.0,
                beta=0.009,
                d_cutoff=1.0
            )
            logger.info("One Euro Filter smoothing enabled (cursor-tuned mode)")

        # EMA pre-filter state (runs before One Euro Filter)
        self._ema_x: Optional[float] = None
        self._ema_y: Optional[float] = None
        self._ema_alpha = 0.65  # 65% new / 35% history — slightly more responsive

        # Median pre-filter: ring buffer of last 3 raw samples per axis
        # Window of 3 removes landmark flicker with only 1-frame lag instead of 2
        self._median_buf_x: List[float] = []
        self._median_buf_y: List[float] = []
        self._median_window = 3

        # Velocity-based adaptive dead zone state
        self._prev_smoothed_x: Optional[float] = None
        self._prev_smoothed_y: Optional[float] = None
        self._prev_smooth_time: Optional[float] = None
        # Dead zone expands when hand is slow, shrinks when hand moves fast
        self._dz_min = 0.002   # 2px equivalent — minimum dead zone (fast movement)
        self._dz_max = 0.006   # 6px equivalent — maximum dead zone (hand at rest)
        self._velocity_scale = 0.04  # how aggressively velocity shrinks the dead zone

        # State tracking
        self.last_position = None
        self.last_screen_position = None
        self.cursor_enabled = True  # Enable by default (will be controlled by hybrid mode)
        self.performance_stats = {
            'total_updates': 0,
            'successful_updates': 0,
            'failed_updates': 0,
            'avg_latency_ms': 0.0,
            'total_latency': 0.0
        }

        # Cursor control method
        if PYAUTOGUI_AVAILABLE:
            # Configure PyAutoGUI for cursor control
            pyautogui.FAILSAFE = False  # Disable failsafe (moving to corner won't stop)
            pyautogui.PAUSE = 0  # No pause between actions
            logger.info("PyAutoGUI configured for cursor control")

        if self.use_fast_api:
            logger.info("Using ctypes (fast) for cursor control")
        elif PYAUTOGUI_AVAILABLE:
            logger.info("Using PyAutoGUI for cursor control")
        else:
            logger.warning("No cursor control library available - cursor will not move!")

    def extract_index_finger_tip(self, hand_landmarks: List[Dict]) -> Optional[Tuple[float, float, float]]:
        """
        Extract the index finger tip position from hand landmarks.

        Args:
            hand_landmarks: List of 21 hand landmarks from MediaPipe

        Returns:
            Tuple of (x, y, z) coordinates in normalized space (0-1), or None if invalid
        """
        if not hand_landmarks or len(hand_landmarks) < 9:
            return None

        # Fix 5: Blend index tip (#8) with its middle joint (#7) — the joint is
        # mechanically more stable than the tip, so weighting it 20% reduces
        # high-frequency tip jitter without shifting the tracking point noticeably.
        tip = hand_landmarks[8]
        joint = hand_landmarks[7]
        x = tip['x'] * 0.8 + joint['x'] * 0.2
        y = tip['y'] * 0.8 + joint['y'] * 0.2
        z = tip['z'] * 0.8 + joint['z'] * 0.2

        return (x, y, z)

    def apply_smoothing(self, x: float, y: float, timestamp: float) -> Tuple[float, float]:
        """
        Three-stage pipeline: Median → EMA → One Euro Filter.

        Stage 1 (Median): eliminates landmark flicker/impulse spikes from MediaPipe.
        Stage 2 (EMA): smooths the median output before the adaptive filter sees it.
        Stage 3 (One Euro): speed-adaptive filter — jitter-free at rest, responsive when moving.
        """
        if not self.smoothing_enabled:
            return (x, y)

        try:
            # Stage 1: Median filter over last N raw samples — best technique
            # for eliminating MediaPipe's occasional landmark position jumps.
            self._median_buf_x.append(x)
            self._median_buf_y.append(y)
            if len(self._median_buf_x) > self._median_window:
                self._median_buf_x.pop(0)
                self._median_buf_y.pop(0)

            buf_x = sorted(self._median_buf_x)
            buf_y = sorted(self._median_buf_y)
            mid = len(buf_x) // 2
            med_x = buf_x[mid]
            med_y = buf_y[mid]

            # Stage 2: EMA on median output — smooths the median's own staircase
            # artifact (median output is piecewise-constant; EMA softens transitions).
            if self._ema_x is None:
                self._ema_x = med_x
                self._ema_y = med_y
            else:
                self._ema_x = self._ema_alpha * med_x + (1.0 - self._ema_alpha) * self._ema_x
                self._ema_y = self._ema_alpha * med_y + (1.0 - self._ema_alpha) * self._ema_y

            # Stage 3: One Euro Filter — adaptive cutoff based on velocity.
            smoothed_x = self.filter_x(self._ema_x, timestamp)
            smoothed_y = self.filter_y(self._ema_y, timestamp)
            return (smoothed_x, smoothed_y)
        except Exception as e:
            logger.error(f"Smoothing error: {e}")
            return (x, y)

    def apply_dead_zone(self, new_x: float, new_y: float, timestamp: Optional[float] = None) -> Tuple[float, float]:
        """
        Velocity-adaptive dead zone: expands when hand is still, shrinks when moving.

        A fixed dead zone is a compromise — too tight and rest-jitter leaks through,
        too wide and slow intentional movement is eaten. This version measures hand
        velocity after smoothing and scales the dead zone inversely, giving maximum
        stability at rest and full precision during fast movement.
        """
        if self.last_position is None:
            self.last_position = (new_x, new_y)
            self._prev_smoothed_x = new_x
            self._prev_smoothed_y = new_y
            self._prev_smooth_time = timestamp
            return (new_x, new_y)

        last_x, last_y = self.last_position

        # Compute current velocity (normalized units/sec) to pick dead zone size.
        velocity = 0.0
        if (timestamp is not None and self._prev_smooth_time is not None
                and self._prev_smoothed_x is not None):
            dt = timestamp - self._prev_smooth_time
            if dt > 0:
                dx = new_x - self._prev_smoothed_x
                dy = new_y - self._prev_smoothed_y
                velocity = (dx * dx + dy * dy) ** 0.5 / dt

        # Dead zone shrinks as velocity rises — fast movement gets near-zero dead zone.
        adaptive_dz = max(self._dz_min, self._dz_max - velocity * self._velocity_scale)

        # Update velocity tracking state.
        self._prev_smoothed_x = new_x
        self._prev_smoothed_y = new_y
        self._prev_smooth_time = timestamp

        # Squared comparison avoids sqrt — same result, cheaper.
        dx = new_x - last_x
        dy = new_y - last_y
        if dx * dx + dy * dy > adaptive_dz * adaptive_dz:
            self.last_position = (new_x, new_y)
            return (new_x, new_y)
        return (last_x, last_y)

    def map_to_screen(self, hand_x: float, hand_y: float) -> Tuple[int, int]:
        """
        Map normalized hand coordinates to screen pixel coordinates.

        Args:
            hand_x: Normalized x coordinate from MediaPipe (0-1)
            hand_y: Normalized y coordinate from MediaPipe (0-1)

        Returns:
            Screen coordinates in pixels (x, y)
        """
        # NOTE: No X-axis flip here. The frame is already flipped horizontally
        # in hand_tracking.py (cv2.flip), so landmark x=0 is the left edge of
        # the mirror image — which is the correct left edge from the user's view.

        # Apply movement scaling for better control
        # User moves hand 50% → cursor moves 100% (scale=2.0)
        center_x = (hand_x - 0.5) * self.movement_scale + 0.5
        center_y = (hand_y - 0.5) * self.movement_scale + 0.5

        # Clamp to valid range [0, 1]
        center_x = max(0.0, min(1.0, center_x))
        center_y = max(0.0, min(1.0, center_y))

        # Convert to screen pixels
        screen_x = int(center_x * self.screen_width)
        screen_y = int(center_y * self.screen_height)

        # Ensure within screen bounds
        screen_x = max(0, min(self.screen_width - 1, screen_x))
        screen_y = max(0, min(self.screen_height - 1, screen_y))

        return (screen_x, screen_y)

    def move_cursor(self, screen_x: int, screen_y: int) -> bool:
        """
        Move the system cursor to the specified screen position.

        Args:
            screen_x: Target X coordinate in pixels
            screen_y: Target Y coordinate in pixels

        Returns:
            True if successful, False otherwise
        """
        try:
            # Fix 4: Pixel-level dead zone — skip the syscall entirely if the cursor
            # hasn't moved more than 2px. Eliminates sub-pixel jitter that survives
            # smoothing and causes the cursor to vibrate in place.
            if self.last_screen_position is not None:
                dx = screen_x - self.last_screen_position[0]
                dy = screen_y - self.last_screen_position[1]
                if dx * dx + dy * dy < 4:  # 2² = 4, avoids sqrt()
                    return True  # Consider it a success — position unchanged intentionally

            if self.use_fast_api and CTYPES_AVAILABLE:
                ctypes.windll.user32.SetCursorPos(screen_x, screen_y)
            elif PYAUTOGUI_AVAILABLE:
                pyautogui.moveTo(screen_x, screen_y, duration=0, _pause=False)
            else:
                return False

            self.last_screen_position = (screen_x, screen_y)
            return True

        except Exception as e:
            logger.error(f"Error moving cursor: {e}")
            return False

    def update_cursor(self, hand_landmarks: List[Dict]) -> Dict:
        """
        Main update loop: extract hand position, smooth, map, and move cursor.

        Args:
            hand_landmarks: List of 21 hand landmarks from MediaPipe

        Returns:
            Dictionary with update status and performance metrics
        """
        start_time = time.time()
        self.performance_stats['total_updates'] += 1

        # Extract index finger tip
        tip_coords = self.extract_index_finger_tip(hand_landmarks)

        if tip_coords is None:
            self.performance_stats['failed_updates'] += 1
            return {
                'success': False,
                'error': 'Invalid hand landmarks',
                'cursor_enabled': self.cursor_enabled
            }

        hand_x, hand_y, hand_z = tip_coords

        # Apply smoothing
        timestamp = time.time()
        smoothed_x, smoothed_y = self.apply_smoothing(hand_x, hand_y, timestamp)

        # Apply velocity-adaptive dead zone filtering
        filtered_x, filtered_y = self.apply_dead_zone(smoothed_x, smoothed_y, timestamp)

        # Map to screen coordinates
        screen_x, screen_y = self.map_to_screen(filtered_x, filtered_y)

        # PHASE 4 FIX: Detect if cursor actually moved (for gesture collection guard)
        # Check if cursor moved more than a minimum threshold
        # IMPORTANT: High threshold (30px) to ignore hand jitter and only count intentional cursor movements
        cursor_moved = False
        if self.last_screen_position is not None:
            movement_distance = np.sqrt(
                (screen_x - self.last_screen_position[0])**2 +
                (screen_y - self.last_screen_position[1])**2
            )
            # Consider movement if cursor moved more than 30 pixels (significant intentional movement)
            # This ignores small jitter/tremor that happens during gestures
            cursor_moved = movement_distance > 30.0
        else:
            # First cursor position - don't count as movement to allow gestures on startup
            cursor_moved = False

        # Move cursor
        success = False
        if self.cursor_enabled:
            success = self.move_cursor(screen_x, screen_y)
            if success:
                logger.debug(f"✓ Cursor moved to ({screen_x}, {screen_y})")
        else:
            logger.warning("⚠ Cursor movement skipped - cursor_enabled=False")

        # Update statistics
        latency = (time.time() - start_time) * 1000  # Convert to ms
        self.performance_stats['total_latency'] += latency

        if success:
            self.performance_stats['successful_updates'] += 1
        else:
            self.performance_stats['failed_updates'] += 1

        # Calculate average latency
        if self.performance_stats['total_updates'] > 0:
            self.performance_stats['avg_latency_ms'] = (
                self.performance_stats['total_latency'] /
                self.performance_stats['total_updates']
            )

        return {
            'success': bool(success),
            'cursor_enabled': bool(self.cursor_enabled),
            'moved': bool(cursor_moved and success),  # PHASE 4 FIX: Report if cursor actually moved
            'hand_position': {
                'raw': {'x': float(hand_x), 'y': float(hand_y), 'z': float(hand_z)},
                'smoothed': {'x': float(smoothed_x), 'y': float(smoothed_y)},
                'filtered': {'x': float(filtered_x), 'y': float(filtered_y)}
            },
            'screen_position': {'x': int(screen_x), 'y': int(screen_y)},
            'latency_ms': float(latency),
            'stats': {k: int(v) if isinstance(v, (int, np.integer)) else float(v)
                     for k, v in self.performance_stats.items()}
        }

    def enable_cursor(self):
        """Enable cursor control."""
        self.cursor_enabled = True
        logger.info("Cursor control ENABLED")

    def disable_cursor(self):
        """Disable cursor control."""
        self.cursor_enabled = False
        logger.info("Cursor control DISABLED")

    def reset(self):
        """Reset internal state and filters."""
        if self.smoothing_enabled:
            self.filter_x = OneEuroFilter(min_cutoff=1.0, beta=0.009, d_cutoff=1.0)
            self.filter_y = OneEuroFilter(min_cutoff=1.0, beta=0.009, d_cutoff=1.0)

        self._ema_x = None
        self._ema_y = None
        self._median_buf_x = []
        self._median_buf_y = []
        self._prev_smoothed_x = None
        self._prev_smoothed_y = None
        self._prev_smooth_time = None
        self.last_position = None
        self.last_screen_position = None

        # Reset stats
        self.performance_stats = {
            'total_updates': 0,
            'successful_updates': 0,
            'failed_updates': 0,
            'avg_latency_ms': 0.0,
            'total_latency': 0.0
        }

        logger.info("Cursor controller reset")

    def get_stats(self) -> Dict:
        """Get performance statistics."""
        return {
            **self.performance_stats,
            'cursor_enabled': self.cursor_enabled,
            'screen_size': {
                'width': self.screen_width,
                'height': self.screen_height
            },
            'config': {
                'smoothing_enabled': self.smoothing_enabled,
                'dead_zone_threshold': self.dead_zone_threshold,
                'movement_scale': self.movement_scale,
                'use_fast_api': self.use_fast_api
            }
        }


# Global cursor controller instance
cursor_controller: Optional[CursorController] = None


def get_cursor_controller() -> CursorController:
    """
    Get the global cursor controller instance.
    Creates one if it doesn't exist.

    Returns:
        CursorController instance
    """
    global cursor_controller

    if cursor_controller is None:
        cursor_controller = CursorController(
            smoothing_enabled=True,       # Fix 1: EMA + One Euro Filter — eliminates jitter
            dead_zone_threshold=0.003,    # Fix 1: absorbs micro-tremors (~3px at 1080p)
            movement_scale=1.0,           # 1:1 mapping preserved
            use_fast_api=True             # ctypes for lowest-latency syscall
        )
        logger.info("Global cursor controller created (STABLE MODE: EMA + One Euro Filter)")

    return cursor_controller


def reset_cursor_controller():
    """Reset the global cursor controller."""
    global cursor_controller

    if cursor_controller:
        cursor_controller.reset()
