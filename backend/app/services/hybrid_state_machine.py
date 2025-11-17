"""
AirClick - Hybrid Mode State Machine
=====================================

This module implements a finite state machine (FSM) to coordinate cursor control
and gesture recognition, preventing accidental clicks during gesture matching.

Author: Muhammad Shawaiz (Enhanced by Claude)
Project: AirClick FYP
"""

import time
import numpy as np
from typing import Dict, List, Optional, Tuple
from enum import Enum
import logging

logger = logging.getLogger(__name__)


class HybridState(Enum):
    """
    States in the hybrid mode FSM:

    CURSOR_ONLY: Default state - cursor control active, gesture collection inactive
    COLLECTING: Buffering frames for gesture - cursor control DISABLED
    MATCHING: Running DTW match - cursor control DISABLED
    IDLE: Cooldown after match - cursor control DISABLED
    """
    CURSOR_ONLY = "cursor_only"
    COLLECTING = "collecting"
    MATCHING = "matching"
    IDLE = "idle"


class HybridStateMachine:
    """
    Finite State Machine for hybrid mode coordination.

    Prevents cursor control interference during gesture collection and matching.
    """

    def __init__(
        self,
        stationary_duration_threshold: float = 0.8,  # INCREASED: Seconds hand must be stationary (more deliberate)
        collection_frame_count: int = 90,            # MAX frames to collect for gesture
        min_collection_frames: int = 10,             # CRITICAL FIX: Reduced to 10 frames minimum (allow quick gestures)
        idle_cooldown_duration: float = 1.0,         # Cooldown after match (seconds) - REDUCED for faster restart
        velocity_threshold: float = 0.015,           # DECREASED: Movement threshold for stationary detection (more strict)
        moving_velocity_threshold: float = 0.12,     # INCREASED: Minimum velocity for moving gesture detection (more intentional)
        moving_duration_threshold: float = 0.5,      # INCREASED: Seconds of movement to trigger moving gesture (more deliberate)
        gesture_end_stationary_duration: float = 0.5 # INCREASED: Seconds stationary to end gesture collection (ensure gesture is complete)
    ):
        """
        Initialize the state machine.

        Args:
            stationary_duration_threshold: How long hand must be stationary to start collecting
            collection_frame_count: MAXIMUM number of frames to collect (will match earlier if gesture ends)
            min_collection_frames: MINIMUM frames required before matching (default: 5)
            idle_cooldown_duration: Cooldown period after match before returning to cursor mode
            velocity_threshold: Maximum velocity to consider hand as stationary
            moving_velocity_threshold: Minimum velocity to detect moving gesture
            moving_duration_threshold: How long hand must be moving to trigger collection
            gesture_end_stationary_duration: How long hand must be stationary to end gesture collection
        """
        self.state = HybridState.CURSOR_ONLY

        # Configuration
        self.stationary_duration_threshold = stationary_duration_threshold
        self.collection_frame_count = collection_frame_count
        self.min_collection_frames = min_collection_frames
        self.idle_cooldown_duration = idle_cooldown_duration
        self.velocity_threshold = velocity_threshold
        self.moving_velocity_threshold = moving_velocity_threshold
        self.moving_duration_threshold = moving_duration_threshold
        self.gesture_end_stationary_duration = gesture_end_stationary_duration

        # State tracking
        self.stationary_start_time: Optional[float] = None
        self.moving_start_time: Optional[float] = None  # NEW: Track moving gesture start
        self.collection_start_time: Optional[float] = None
        self.matching_start_time: Optional[float] = None
        self.idle_start_time: Optional[float] = None
        self.gesture_end_stationary_start: Optional[float] = None  # Track when hand stops during collection

        # Frame collection
        self.collected_frames: List[Dict] = []

        # Hand tracking
        self.previous_hand_position: Optional[np.ndarray] = None
        self.last_velocity: float = 0.0

        # Match results
        self.last_match_result: Optional[Dict] = None

        # Authentication check callback (set externally)
        self.auth_check_callback: Optional[callable] = None

        # Gesture trigger type tracking
        self.trigger_type: Optional[str] = None  # "stationary" or "moving"

        logger.info(f"Hybrid state machine initialized in {self.state.value} state")

    def reset(self):
        """Reset the state machine to initial state."""
        self.state = HybridState.CURSOR_ONLY
        self.stationary_start_time = None
        self.moving_start_time = None  # NEW: Reset moving timer
        self.collection_start_time = None
        self.matching_start_time = None
        self.idle_start_time = None
        self.gesture_end_stationary_start = None  # Reset gesture end timer
        self.collected_frames = []
        self.previous_hand_position = None
        self.last_velocity = 0.0
        self.last_match_result = None
        self.trigger_type = None  # NEW: Reset trigger type
        logger.info("State machine reset to CURSOR_ONLY")

    def calculate_hand_velocity(self, landmarks: List[Dict]) -> float:
        """
        Calculate hand velocity based on wrist movement.

        Args:
            landmarks: List of 21 hand landmarks

        Returns:
            Velocity magnitude (0-1 range, normalized by frame)
        """
        if not landmarks or len(landmarks) < 1:
            return 0.0

        # Use wrist landmark (index 0)
        wrist = landmarks[0]
        current_position = np.array([wrist['x'], wrist['y'], wrist['z']])

        if self.previous_hand_position is None:
            self.previous_hand_position = current_position
            return 0.0

        # Calculate Euclidean distance moved
        displacement = np.linalg.norm(current_position - self.previous_hand_position)
        self.previous_hand_position = current_position

        return float(displacement)

    def is_hand_stationary(self, landmarks: List[Dict]) -> bool:
        """
        Check if hand is stationary (velocity below threshold).

        Args:
            landmarks: List of 21 hand landmarks

        Returns:
            True if hand is stationary, False otherwise
        """
        velocity = self.calculate_hand_velocity(landmarks)
        self.last_velocity = velocity

        is_stationary = velocity < self.velocity_threshold

        if is_stationary and self.stationary_start_time is None:
            self.stationary_start_time = time.time()
        elif not is_stationary:
            self.stationary_start_time = None

        return is_stationary

    def get_stationary_duration(self) -> float:
        """
        Get how long the hand has been stationary.

        Returns:
            Duration in seconds, or 0 if not stationary
        """
        if self.stationary_start_time is None:
            return 0.0
        return time.time() - self.stationary_start_time

    def is_hand_moving(self, landmarks: List[Dict]) -> bool:
        """
        Check if hand is moving with sustained velocity (for dynamic gestures).

        Args:
            landmarks: List of 21 hand landmarks

        Returns:
            True if hand is moving with sufficient velocity, False otherwise
        """
        velocity = self.calculate_hand_velocity(landmarks)
        self.last_velocity = velocity

        is_moving = velocity > self.moving_velocity_threshold

        if is_moving and self.moving_start_time is None:
            self.moving_start_time = time.time()
        elif not is_moving:
            self.moving_start_time = None

        return is_moving

    def get_moving_duration(self) -> float:
        """
        Get how long the hand has been moving.

        Returns:
            Duration in seconds, or 0 if not moving
        """
        if self.moving_start_time is None:
            return 0.0
        return time.time() - self.moving_start_time

    def should_start_collecting(self, landmarks: List[Dict]) -> bool:
        """
        Check if conditions are met to transition from CURSOR_ONLY to COLLECTING.

        DUAL-TRIGGER SYSTEM: Supports both stationary AND moving gestures.
        - Stationary trigger: Hand still for threshold duration (static gestures)
        - Moving trigger: Hand moving with sustained velocity (dynamic gestures)

        SECURITY FIX: Check authentication before starting collection.
        IDLE FIX: Only allow collection in CURSOR_ONLY state (not during cooldown).

        Args:
            landmarks: Current frame landmarks

        Returns:
            True if should start collecting, False otherwise
        """
        # CRITICAL: Only check collection triggers when in CURSOR_ONLY state
        # This prevents starting collection during IDLE cooldown or MATCHING/COLLECTING
        if self.state != HybridState.CURSOR_ONLY:
            # Reset timers if called from wrong state (defensive programming)
            self.stationary_start_time = None
            self.moving_start_time = None
            return False

        # SECURITY: Check authentication BEFORE collecting frames
        if self.auth_check_callback:
            is_authenticated = self.auth_check_callback()
            if not is_authenticated:
                # Reset both timers if not authenticated
                self.stationary_start_time = None
                self.moving_start_time = None
                logger.warning("🚫 BLOCKING collection - auth_check_callback returned False")
                return False
            else:
                logger.debug("✅ Auth check passed - collection allowed")
        else:
            logger.warning("⚠️ No auth_check_callback registered!")

        # TRIGGER 1: Check if hand is stationary (static gestures)
        if self.is_hand_stationary(landmarks):
            stationary_duration = self.get_stationary_duration()
            if stationary_duration >= self.stationary_duration_threshold:
                self.trigger_type = "stationary"
                logger.info(f"✋ STATIC gesture trigger: Hand stationary for {stationary_duration:.2f}s")
                return True

        # TRIGGER 2: Check if hand is moving (dynamic gestures)
        if self.is_hand_moving(landmarks):
            moving_duration = self.get_moving_duration()
            if moving_duration >= self.moving_duration_threshold:
                self.trigger_type = "moving"
                logger.info(f"👋 DYNAMIC gesture trigger: Hand moving for {moving_duration:.2f}s (velocity: {self.last_velocity:.4f})")
                return True

        return False

    def should_end_gesture_collection(self, landmarks: List[Dict]) -> bool:
        """
        Check if gesture collection should end early (before reaching max frames).

        Gesture ends when:
        1. Hand becomes stationary after moving (for moving gestures)
        2. Hand starts moving significantly (for stationary gestures)
        3. Minimum frames collected (5+ frames)

        Args:
            landmarks: Current frame landmarks

        Returns:
            True if gesture should end and match now, False to continue collecting
        """
        if self.state != HybridState.COLLECTING:
            return False

        # Need minimum frames before we can end
        if len(self.collected_frames) < self.min_collection_frames:
            return False

        # Calculate current velocity
        velocity = self.calculate_hand_velocity(landmarks)
        self.last_velocity = velocity

        # For MOVING gestures: End when hand becomes stationary
        if self.trigger_type == "moving":
            is_stationary = velocity < self.velocity_threshold

            if is_stationary:
                if self.gesture_end_stationary_start is None:
                    self.gesture_end_stationary_start = time.time()

                stationary_duration = time.time() - self.gesture_end_stationary_start

                if stationary_duration >= self.gesture_end_stationary_duration:
                    logger.info(f"✅ MOVING gesture ended: Hand stopped for {stationary_duration:.2f}s ({len(self.collected_frames)} frames)")
                    return True
            else:
                # Hand still moving, reset timer
                self.gesture_end_stationary_start = None

        # For STATIONARY gestures: End when hand starts moving significantly
        elif self.trigger_type == "stationary":
            is_moving = velocity > self.moving_velocity_threshold

            if is_moving:
                logger.info(f"✅ STATIONARY gesture ended: Hand started moving (velocity: {velocity:.4f}, {len(self.collected_frames)} frames)")
                return True

        return False

    def update(
        self,
        frame: Dict,
        match_callback: Optional[callable] = None
    ) -> Tuple[HybridState, Dict]:
        """
        Update the state machine with a new frame.

        Args:
            frame: Frame dictionary with landmarks, timestamp, etc.
            match_callback: Function to call when ready to match (receives collected_frames)

        Returns:
            Tuple of (new_state, metadata_dict)

        Metadata includes:
            - state: Current state name
            - cursor_enabled: Whether cursor control should be active
            - collected_count: Number of frames collected (in COLLECTING state)
            - match_result: Match result (in IDLE state)
            - velocity: Current hand velocity
            - stationary_duration: How long hand has been stationary
        """
        landmarks = frame.get('landmarks', [])
        current_time = time.time()

        previous_state = self.state

        # State machine transitions
        if self.state == HybridState.CURSOR_ONLY:
            if self.should_start_collecting(landmarks):
                # Transition: CURSOR_ONLY → COLLECTING
                self.state = HybridState.COLLECTING
                self.collection_start_time = current_time
                self.collected_frames = [frame]
                logger.info("State: CURSOR_ONLY → COLLECTING")

        elif self.state == HybridState.COLLECTING:
            # CRITICAL FIX: Check auth (including recording state) BEFORE continuing collection
            # This aborts ongoing collection if user starts recording in web UI
            if self.auth_check_callback:
                is_authenticated = self.auth_check_callback()
                if not is_authenticated:
                    # ABORT collection - user started recording or lost authentication
                    logger.warning(f"🚫 ABORTING ongoing collection - auth check failed (user may be recording)")
                    logger.info(f"   Collected {len(self.collected_frames)} frames before abort")
                    # Reset to CURSOR_ONLY state immediately
                    self.state = HybridState.CURSOR_ONLY
                    self.collected_frames = []
                    self.collection_start_time = None
                    self.stationary_start_time = None
                    self.moving_start_time = None
                    self.gesture_end_stationary_start = None
                    self.trigger_type = None
                    logger.info("State: COLLECTING → CURSOR_ONLY (collection aborted)")
                    # Return early - don't continue processing
                    metadata = {
                        'state': self.state.value,
                        'cursor_enabled': True,
                        'collecting': False,
                        'aborted': True,
                        'reason': 'Authentication check failed during collection'
                    }
                    return self.state, metadata

            # Continue collecting frames
            self.collected_frames.append(frame)

            # NEW: Check if gesture has ended naturally (user finished performing it)
            if self.should_end_gesture_collection(landmarks):
                # Transition: COLLECTING → MATCHING (early, before max frames)
                self.state = HybridState.MATCHING
                self.matching_start_time = current_time
                logger.info(f"State: COLLECTING → MATCHING (gesture ended at {len(self.collected_frames)} frames)")

                # Trigger match callback if provided
                if match_callback:
                    logger.info(f"🎯 Calling gesture match callback with {len(self.collected_frames)} frames...")
                    try:
                        self.last_match_result = match_callback(self.collected_frames)
                        logger.info(f"✅ Match callback returned: {self.last_match_result}")
                    except Exception as e:
                        logger.error(f"❌ Match callback error: {e}")
                        import traceback
                        logger.error(traceback.format_exc())
                        self.last_match_result = {"error": str(e)}
                else:
                    logger.warning("⚠️ No match callback provided! Gesture matching skipped.")

            # Check if MAX frames collected (timeout)
            elif len(self.collected_frames) >= self.collection_frame_count:
                # Transition: COLLECTING → MATCHING (reached max frames)
                self.state = HybridState.MATCHING
                self.matching_start_time = current_time
                logger.info(f"State: COLLECTING → MATCHING (max {len(self.collected_frames)} frames reached)")

                # Trigger match callback if provided
                if match_callback:
                    logger.info(f"🎯 Calling gesture match callback with {len(self.collected_frames)} frames...")
                    try:
                        self.last_match_result = match_callback(self.collected_frames)
                        logger.info(f"✅ Match callback returned: {self.last_match_result}")
                    except Exception as e:
                        logger.error(f"❌ Match callback error: {e}")
                        import traceback
                        logger.error(traceback.format_exc())
                        self.last_match_result = {"error": str(e)}
                else:
                    logger.warning("⚠️ No match callback provided! Gesture matching skipped.")

        elif self.state == HybridState.MATCHING:
            # CRITICAL FIX: Check if user started recording during matching
            if self.auth_check_callback:
                is_authenticated = self.auth_check_callback()
                if not is_authenticated:
                    logger.warning(f"🚫 ABORTING matching - auth check failed (user may be recording)")
                    self.state = HybridState.CURSOR_ONLY
                    self.collected_frames = []
                    self.last_match_result = None
                    logger.info("State: MATCHING → CURSOR_ONLY (matching aborted)")
                    metadata = {
                        'state': self.state.value,
                        'cursor_enabled': True,
                        'matching': False,
                        'aborted': True,
                        'reason': 'Authentication check failed during matching'
                    }
                    return self.state, metadata

            # Matching is handled by callback, transition immediately to IDLE
            self.state = HybridState.IDLE
            self.idle_start_time = current_time
            # CRITICAL FIX: Reset hand position tracking when entering IDLE
            # This prevents velocity spikes when hand reappears after matching
            self.previous_hand_position = None
            self.last_velocity = 0.0
            logger.info("State: MATCHING → IDLE (hand position tracking reset)")

        elif self.state == HybridState.IDLE:
            # CRITICAL FIX: Check if user started recording during cooldown
            if self.auth_check_callback:
                is_authenticated = self.auth_check_callback()
                if not is_authenticated:
                    logger.warning(f"🚫 Resetting from IDLE - auth check failed (user may be recording)")
                    self.state = HybridState.CURSOR_ONLY
                    self.collected_frames = []
                    self.last_match_result = None
                    logger.info("State: IDLE → CURSOR_ONLY (reset due to recording)")
                    metadata = {
                        'state': self.state.value,
                        'cursor_enabled': True,
                        'idle': False,
                        'aborted': True,
                        'reason': 'Authentication check failed during idle'
                    }
                    return self.state, metadata

            # Wait for cooldown period
            idle_duration = current_time - self.idle_start_time

            # CRITICAL FIX: Reset velocity tracking to prevent false triggers
            # When hand reappears during IDLE, we need fresh velocity calculation
            if landmarks:
                # Calculate velocity to update previous_hand_position without triggering collection
                _ = self.calculate_hand_velocity(landmarks)
                # Force reset timers to prevent immediate collection
                if self.stationary_start_time is not None or self.moving_start_time is not None:
                    logger.debug(f"✋ Hand reappeared during IDLE cooldown - resetting timers (remaining: {self.idle_cooldown_duration - idle_duration:.2f}s)")
                self.stationary_start_time = None
                self.moving_start_time = None

            if idle_duration >= self.idle_cooldown_duration:
                # Transition: IDLE → CURSOR_ONLY
                self.state = HybridState.CURSOR_ONLY
                self.collected_frames = []
                self.stationary_start_time = None
                self.moving_start_time = None  # Reset moving timer
                self.gesture_end_stationary_start = None  # Reset gesture end timer
                self.last_match_result = None
                self.trigger_type = None  # Reset trigger type
                # CRITICAL FIX: Reset position tracking for clean state
                # Ensures first velocity calculation in CURSOR_ONLY is fresh
                self.previous_hand_position = None
                self.last_velocity = 0.0
                logger.info("State: IDLE → CURSOR_ONLY (cooldown complete, fresh tracking)")

        # Log state changes
        if previous_state != self.state:
            logger.info(f"State changed: {previous_state.value} → {self.state.value}")

        # Build metadata
        metadata = {
            'state': self.state.value,
            'cursor_enabled': self.state == HybridState.CURSOR_ONLY,
            'collecting': self.state == HybridState.COLLECTING,
            'matching': self.state == HybridState.MATCHING,
            'velocity': round(self.last_velocity, 4),
            'stationary_duration': round(self.get_stationary_duration(), 2),
            'moving_duration': round(self.get_moving_duration(), 2),  # NEW: Moving gesture duration
            'trigger_type': self.trigger_type,  # NEW: "stationary" or "moving"
            'collected_count': len(self.collected_frames),
            'target_frames': self.collection_frame_count,
            'match_result': self.last_match_result if self.state == HybridState.IDLE else None
        }

        return self.state, metadata

    def get_state_info(self) -> Dict:
        """
        Get detailed information about current state.

        Returns:
            Dictionary with state information
        """
        return {
            'state': self.state.value,
            'cursor_enabled': self.state == HybridState.CURSOR_ONLY,
            'collecting': self.state == HybridState.COLLECTING,
            'matching': self.state == HybridState.MATCHING,
            'idle': self.state == HybridState.IDLE,
            'collected_frames': len(self.collected_frames),
            'collected_count': len(self.collected_frames),  # Add this for consistency with update() metadata
            'target_frames': self.collection_frame_count,
            'progress': len(self.collected_frames) / self.collection_frame_count if self.state == HybridState.COLLECTING else 0,
            'velocity': round(self.last_velocity, 4),
            'stationary_duration': round(self.get_stationary_duration(), 2),
            'moving_duration': round(self.get_moving_duration(), 2),
            'stationary_threshold': self.stationary_duration_threshold,
            'moving_threshold': self.moving_duration_threshold,
            'trigger_type': self.trigger_type,
            'last_match': self.last_match_result,
            'match_result': self.last_match_result  # Add this for overlay consistency
        }

    def set_auth_check_callback(self, callback: callable):
        """
        Set the authentication check callback.

        Args:
            callback: Function that returns True if authenticated, False otherwise
                     Signature: callback() -> bool
        """
        self.auth_check_callback = callback
        logger.info("Authentication check callback registered")

    def handle_no_hand_detected(self, match_callback: Optional[callable] = None) -> Dict:
        """
        Handle the case when no hand is detected in the frame.

        If currently COLLECTING frames, this triggers the gesture matching immediately
        (as long as minimum frames have been collected).

        This allows instant gesture matching when user moves hand away from camera
        instead of waiting for hand to reappear.

        Args:
            match_callback: Optional callback function to execute matching

        Returns:
            Dictionary with state machine metadata including match result if triggered
        """
        current_time = time.time()

        # If we're collecting and have minimum frames, trigger matching NOW
        if self.state == HybridState.COLLECTING and len(self.collected_frames) >= self.min_collection_frames:
            logger.info(f"👋 Hand moved away from camera - triggering gesture match with {len(self.collected_frames)} frames")

            # Transition to MATCHING state
            self.state = HybridState.MATCHING
            self.matching_start_time = current_time

            # CRITICAL FIX: Reset hand position tracking when hand goes away
            # This prevents velocity spikes when hand reappears
            self.previous_hand_position = None
            self.last_velocity = 0.0

            # Execute the match callback if provided
            if match_callback:
                logger.info(f"🎯 Calling gesture match callback with {len(self.collected_frames)} frames (hand removed)...")
                try:
                    self.last_match_result = match_callback(self.collected_frames)
                    logger.info(f"✅ Gesture matching complete: {self.last_match_result}")
                except Exception as e:
                    logger.error(f"❌ Match callback error: {e}")
                    import traceback
                    logger.error(traceback.format_exc())
                    self.last_match_result = {"error": str(e)}
            else:
                logger.warning("⚠️ No match callback provided for hand removal trigger!")

            # CRITICAL FIX: Immediately transition to IDLE state after matching
            # This ensures the system goes into cooldown and doesn't get stuck in MATCHING
            self.state = HybridState.IDLE
            self.idle_start_time = current_time
            logger.info("State: MATCHING → IDLE (hand removed trigger)")

            # Return metadata showing we're now in IDLE with match result
            return {
                'state': self.state.value,
                'cursor_enabled': False,
                'collected_count': len(self.collected_frames),
                'trigger': 'hand_removed',
                'match_result': self.last_match_result,
                'message': f'Gesture matching triggered (hand removed with {len(self.collected_frames)} frames)'
            }

        # If in other states, just return current state info
        return self.get_state_info()

    def force_cursor_mode(self):
        """Force transition back to CURSOR_ONLY mode (emergency reset)."""
        logger.warning("Forcing state machine back to CURSOR_ONLY")
        self.reset()


# Global instance for singleton pattern
_state_machine_instance: Optional[HybridStateMachine] = None


def get_hybrid_state_machine() -> HybridStateMachine:
    """
    Get the global hybrid state machine instance (singleton pattern).

    Returns:
        HybridStateMachine instance
    """
    global _state_machine_instance

    if _state_machine_instance is None:
        _state_machine_instance = HybridStateMachine()
        logger.info("Global hybrid state machine created")

    return _state_machine_instance


def reset_state_machine():
    """Reset the global state machine instance."""
    global _state_machine_instance
    if _state_machine_instance is not None:
        _state_machine_instance.reset()
        logger.info("Global state machine reset")
