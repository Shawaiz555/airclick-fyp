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
        stationary_duration_threshold: float = 0.5,  # Seconds hand must be stationary
        collection_frame_count: int = 60,            # Frames to collect for gesture
        idle_cooldown_duration: float = 1.0,         # Cooldown after match (seconds) - REDUCED for faster restart
        velocity_threshold: float = 0.02,            # Movement threshold for stationary detection
        moving_velocity_threshold: float = 0.08,     # Minimum velocity for moving gesture detection
        moving_duration_threshold: float = 0.3       # Seconds of movement to trigger moving gesture
    ):
        """
        Initialize the state machine.

        Args:
            stationary_duration_threshold: How long hand must be stationary to start collecting
            collection_frame_count: Number of frames to collect for gesture matching
            idle_cooldown_duration: Cooldown period after match before returning to cursor mode
            velocity_threshold: Maximum velocity to consider hand as stationary
            moving_velocity_threshold: Minimum velocity to detect moving gesture
            moving_duration_threshold: How long hand must be moving to trigger collection
        """
        self.state = HybridState.CURSOR_ONLY

        # Configuration
        self.stationary_duration_threshold = stationary_duration_threshold
        self.collection_frame_count = collection_frame_count
        self.idle_cooldown_duration = idle_cooldown_duration
        self.velocity_threshold = velocity_threshold
        self.moving_velocity_threshold = moving_velocity_threshold
        self.moving_duration_threshold = moving_duration_threshold

        # State tracking
        self.stationary_start_time: Optional[float] = None
        self.moving_start_time: Optional[float] = None  # NEW: Track moving gesture start
        self.collection_start_time: Optional[float] = None
        self.matching_start_time: Optional[float] = None
        self.idle_start_time: Optional[float] = None

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

        Args:
            landmarks: Current frame landmarks

        Returns:
            True if should start collecting, False otherwise
        """
        if self.state != HybridState.CURSOR_ONLY:
            return False

        # SECURITY: Check authentication BEFORE collecting frames
        if self.auth_check_callback:
            is_authenticated = self.auth_check_callback()
            if not is_authenticated:
                # Reset both timers if not authenticated
                self.stationary_start_time = None
                self.moving_start_time = None
                return False

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
            # Continue collecting frames
            self.collected_frames.append(frame)

            # Check if enough frames collected
            if len(self.collected_frames) >= self.collection_frame_count:
                # Transition: COLLECTING → MATCHING
                self.state = HybridState.MATCHING
                self.matching_start_time = current_time
                logger.info(f"State: COLLECTING → MATCHING ({len(self.collected_frames)} frames)")

                # Trigger match callback if provided
                if match_callback:
                    try:
                        self.last_match_result = match_callback(self.collected_frames)
                    except Exception as e:
                        logger.error(f"Match callback error: {e}")
                        self.last_match_result = {"error": str(e)}

            # Check if hand behavior changed drastically (abort collection)
            # For stationary gestures: abort if velocity exceeds moving threshold
            # For moving gestures: abort if hand becomes truly stationary
            elif self.trigger_type == "stationary" and self.last_velocity > self.moving_velocity_threshold:
                logger.info(f"⚠️ Hand started moving significantly during stationary collection (velocity: {self.last_velocity:.4f}) - aborting")
                self.state = HybridState.CURSOR_ONLY
                self.collected_frames = []
                self.stationary_start_time = None
                self.moving_start_time = None
            elif self.trigger_type == "moving" and self.last_velocity < self.velocity_threshold:
                logger.info(f"⚠️ Hand stopped completely during dynamic collection (velocity: {self.last_velocity:.4f}) - aborting")
                self.state = HybridState.CURSOR_ONLY
                self.collected_frames = []
                self.stationary_start_time = None
                self.moving_start_time = None

        elif self.state == HybridState.MATCHING:
            # Matching is handled by callback, transition immediately to IDLE
            self.state = HybridState.IDLE
            self.idle_start_time = current_time
            logger.info("State: MATCHING → IDLE")

        elif self.state == HybridState.IDLE:
            # Wait for cooldown period
            idle_duration = current_time - self.idle_start_time

            if idle_duration >= self.idle_cooldown_duration:
                # Transition: IDLE → CURSOR_ONLY
                self.state = HybridState.CURSOR_ONLY
                self.collected_frames = []
                self.stationary_start_time = None
                self.moving_start_time = None  # NEW: Reset moving timer
                self.last_match_result = None
                self.trigger_type = None  # NEW: Reset trigger type
                logger.info("State: IDLE → CURSOR_ONLY (cooldown complete)")

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
            'target_frames': self.collection_frame_count,
            'progress': len(self.collected_frames) / self.collection_frame_count if self.state == HybridState.COLLECTING else 0,
            'velocity': round(self.last_velocity, 4),
            'stationary_duration': round(self.get_stationary_duration(), 2),
            'moving_duration': round(self.get_moving_duration(), 2),
            'stationary_threshold': self.stationary_duration_threshold,
            'moving_threshold': self.moving_duration_threshold,
            'trigger_type': self.trigger_type,
            'last_match': self.last_match_result
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
