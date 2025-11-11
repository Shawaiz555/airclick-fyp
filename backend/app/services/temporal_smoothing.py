"""
AirClick - Temporal Smoothing Module
=====================================

This module implements the One Euro Filter for temporal smoothing of hand tracking data.

The 1€ Filter is a speed-adaptive low-pass filter that:
- Reduces jitter at low speeds (stabilizes hand position)
- Reduces lag at high speeds (maintains responsiveness)
- Performs better than Kalman filters for interactive systems

Expected Impact: +10-15% accuracy improvement, 70%+ jitter reduction

Research Reference:
"1€ Filter: A Simple Speed-based Low-pass Filter for Noisy Input in Interactive Systems"
by Géry Casiez and Nicolas Roussel (CHI 2012)

Author: Muhammad Shawaiz
Project: AirClick FYP - Phase 1 Accuracy Enhancement
"""

import numpy as np
from typing import List, Dict, Optional
import logging

logger = logging.getLogger(__name__)


class OneEuroFilter:
    """
    One Euro Filter for reducing jitter in noisy signals.

    The filter adapts its cutoff frequency based on signal velocity:
    - Low velocity → Low cutoff → More smoothing (reduces jitter)
    - High velocity → High cutoff → Less smoothing (reduces lag)

    This adaptive behavior makes it ideal for hand tracking where the hand
    alternates between stationary and moving states.
    """

    def __init__(
        self,
        min_cutoff: float = 1.0,
        beta: float = 0.007,
        d_cutoff: float = 1.0
    ):
        """
        Initialize the One Euro Filter.

        Args:
            min_cutoff: Minimum cutoff frequency (Hz)
                       Lower values = more smoothing at rest
                       Typical range: 0.5 - 2.0
                       Default: 1.0 (balanced)

            beta: Speed coefficient
                  Higher values = more reactive to speed changes
                  Typical range: 0.001 - 0.01
                  Default: 0.007 (balanced)

            d_cutoff: Cutoff frequency for derivative (Hz)
                      Typical value: 1.0
        """
        self.min_cutoff = min_cutoff
        self.beta = beta
        self.d_cutoff = d_cutoff

        # State variables
        self.x_prev = None
        self.dx_prev = 0.0
        self.t_prev = None

    def __call__(self, x: float, t: float) -> float:
        """
        Filter one sample.

        Args:
            x: Current value
            t: Timestamp (seconds)

        Returns:
            Filtered value
        """
        # Initialize on first call
        if self.x_prev is None:
            self.x_prev = x
            self.dx_prev = 0.0
            self.t_prev = t
            return x

        # Calculate time delta
        dt = t - self.t_prev

        if dt <= 0:
            # No time passed, return previous value
            return self.x_prev

        # Calculate derivative (velocity)
        dx = (x - self.x_prev) / dt

        # Smooth the derivative
        alpha_d = self._smoothing_factor(dt, self.d_cutoff)
        dx_smooth = self._exponential_smoothing(alpha_d, dx, self.dx_prev)

        # Calculate adaptive cutoff frequency based on velocity
        cutoff = self.min_cutoff + self.beta * abs(dx_smooth)

        # Smooth the signal with adaptive cutoff
        alpha = self._smoothing_factor(dt, cutoff)
        x_filtered = self._exponential_smoothing(alpha, x, self.x_prev)

        # Update state
        self.x_prev = x_filtered
        self.dx_prev = dx_smooth
        self.t_prev = t

        return x_filtered

    def reset(self):
        """Reset filter state (call between gestures)."""
        self.x_prev = None
        self.dx_prev = 0.0
        self.t_prev = None

    @staticmethod
    def _smoothing_factor(dt: float, cutoff: float) -> float:
        """
        Calculate smoothing factor (alpha) from cutoff frequency.

        Alpha controls the filter response:
        - Alpha near 1.0 → Little smoothing (fast response)
        - Alpha near 0.0 → Heavy smoothing (slow response)

        Args:
            dt: Time delta (seconds)
            cutoff: Cutoff frequency (Hz)

        Returns:
            Smoothing factor alpha (0-1)
        """
        tau = 1.0 / (2.0 * np.pi * cutoff)
        return 1.0 / (1.0 + tau / dt)

    @staticmethod
    def _exponential_smoothing(alpha: float, x: float, x_prev: float) -> float:
        """
        Exponential smoothing formula.

        x_new = alpha * x + (1 - alpha) * x_prev

        Args:
            alpha: Smoothing factor (0-1)
            x: Current value
            x_prev: Previous smoothed value

        Returns:
            Smoothed value
        """
        return alpha * x + (1.0 - alpha) * x_prev


class LandmarkSmoother:
    """
    Applies One Euro Filter to all hand landmarks over time.

    Maintains separate filters for each landmark coordinate (21 landmarks × 3 coords = 63 filters).
    """

    def __init__(
        self,
        min_cutoff: float = 1.0,
        beta: float = 0.007,
        d_cutoff: float = 1.0
    ):
        """
        Initialize landmark smoother.

        Args:
            min_cutoff: Minimum cutoff frequency (Hz) - see OneEuroFilter
            beta: Speed coefficient - see OneEuroFilter
            d_cutoff: Derivative cutoff frequency (Hz) - see OneEuroFilter
        """
        self.min_cutoff = min_cutoff
        self.beta = beta
        self.d_cutoff = d_cutoff

        # Create filters: 21 landmarks × 3 coordinates (x, y, z)
        self.filters = [
            [
                OneEuroFilter(min_cutoff, beta, d_cutoff)
                for _ in range(3)  # x, y, z
            ]
            for _ in range(21)  # 21 landmarks
        ]

    def smooth_landmarks(
        self,
        landmarks: np.ndarray,
        timestamp: float
    ) -> np.ndarray:
        """
        Apply smoothing to a single frame of landmarks.

        Args:
            landmarks: (21, 3) array - single frame
            timestamp: Timestamp in seconds

        Returns:
            Smoothed landmarks (21, 3)
        """
        smoothed = np.zeros_like(landmarks)

        for lm_idx in range(21):
            for coord_idx in range(3):  # x, y, z
                value = landmarks[lm_idx, coord_idx]
                smoothed[lm_idx, coord_idx] = self.filters[lm_idx][coord_idx](value, timestamp)

        return smoothed

    def smooth_sequence(
        self,
        landmarks_sequence: np.ndarray,
        timestamps: Optional[np.ndarray] = None,
        fps: float = 30.0
    ) -> np.ndarray:
        """
        Apply smoothing to a sequence of landmark frames.

        Args:
            landmarks_sequence: (num_frames, 21, 3) array
            timestamps: Optional array of timestamps in seconds
                       If None, assumes constant FPS
            fps: Frames per second (used if timestamps not provided)

        Returns:
            Smoothed sequence (num_frames, 21, 3)
        """
        num_frames = len(landmarks_sequence)

        # Generate timestamps if not provided
        if timestamps is None:
            timestamps = np.arange(num_frames) / fps

        # Reset filters for new gesture
        self.reset()

        # Apply smoothing frame by frame
        smoothed_sequence = np.zeros_like(landmarks_sequence)

        for i, (frame, t) in enumerate(zip(landmarks_sequence, timestamps)):
            smoothed_sequence[i] = self.smooth_landmarks(frame, t)

        return smoothed_sequence

    def reset(self):
        """Reset all filters (call between gestures)."""
        for landmark_filters in self.filters:
            for filter_obj in landmark_filters:
                filter_obj.reset()


class GaussianTemporalSmoother:
    """
    Applies Gaussian smoothing along the temporal dimension.

    This is complementary to the One Euro Filter:
    - One Euro Filter: Frame-by-frame smoothing (online)
    - Gaussian Smoothing: Whole-sequence smoothing (offline)

    Use Gaussian smoothing for pre-recorded gestures.
    Use One Euro Filter for real-time tracking.
    """

    def __init__(self, sigma: float = 1.0):
        """
        Initialize Gaussian temporal smoother.

        Args:
            sigma: Gaussian kernel width
                  Higher values = more smoothing
                  Typical range: 0.5 - 2.0
                  Default: 1.0
        """
        self.sigma = sigma

    def smooth_sequence(self, landmarks_sequence: np.ndarray) -> np.ndarray:
        """
        Apply Gaussian smoothing along temporal dimension.

        Args:
            landmarks_sequence: (num_frames, 21, 3) array

        Returns:
            Smoothed sequence (num_frames, 21, 3)
        """
        from scipy.ndimage import gaussian_filter1d

        smoothed = np.zeros_like(landmarks_sequence)

        # Smooth each coordinate independently along time axis
        for lm_idx in range(21):
            for coord_idx in range(3):
                # Extract time series for this coordinate
                time_series = landmarks_sequence[:, lm_idx, coord_idx]

                # Apply Gaussian filter
                smoothed[:, lm_idx, coord_idx] = gaussian_filter1d(
                    time_series,
                    sigma=self.sigma,
                    axis=0,
                    mode='nearest'  # Handle boundaries
                )

        return smoothed


def smooth_gesture_frames(
    frames: List[Dict],
    method: str = 'one_euro',
    **kwargs
) -> List[Dict]:
    """
    Convenience function to smooth gesture frames.

    Args:
        frames: List of frame dictionaries with 'landmarks' and 'timestamp' keys
        method: Smoothing method ('one_euro' or 'gaussian')
        **kwargs: Additional parameters for the smoother

    Returns:
        Smoothed frames (same format as input)
    """
    if not frames or len(frames) < 2:
        return frames

    # Extract landmarks and timestamps
    landmarks_list = []
    timestamps = []

    for frame in frames:
        landmarks = frame.get('landmarks', [])
        timestamp = frame.get('timestamp', 0)

        if len(landmarks) != 21:
            logger.warning(f"Frame has {len(landmarks)} landmarks (expected 21), skipping")
            continue

        # Convert to numpy array
        landmarks_array = np.array([
            [lm['x'], lm['y'], lm['z']] for lm in landmarks
        ])

        landmarks_list.append(landmarks_array)
        timestamps.append(timestamp)

    if len(landmarks_list) < 2:
        return frames

    landmarks_sequence = np.array(landmarks_list)
    timestamps = np.array(timestamps)

    # Convert timestamps from milliseconds to seconds
    if timestamps[0] > 100000:  # Likely milliseconds
        timestamps = timestamps / 1000.0

    # Normalize timestamps to start at 0
    timestamps = timestamps - timestamps[0]

    # Apply smoothing
    if method == 'one_euro':
        smoother = LandmarkSmoother(**kwargs)
        smoothed_sequence = smoother.smooth_sequence(landmarks_sequence, timestamps)

    elif method == 'gaussian':
        smoother = GaussianTemporalSmoother(**kwargs)
        smoothed_sequence = smoother.smooth_sequence(landmarks_sequence)

    else:
        logger.warning(f"Unknown smoothing method '{method}', returning original frames")
        return frames

    # Convert back to frame format
    smoothed_frames = []

    for i, frame in enumerate(frames[:len(smoothed_sequence)]):
        smoothed_frame = frame.copy()

        # Update landmarks with smoothed values
        smoothed_landmarks = []
        for lm_idx in range(21):
            smoothed_landmarks.append({
                'x': float(smoothed_sequence[i, lm_idx, 0]),
                'y': float(smoothed_sequence[i, lm_idx, 1]),
                'z': float(smoothed_sequence[i, lm_idx, 2])
            })

        smoothed_frame['landmarks'] = smoothed_landmarks
        smoothed_frames.append(smoothed_frame)

    logger.debug(f"Applied {method} smoothing to {len(smoothed_frames)} frames")

    return smoothed_frames


# Global smoother instance for real-time tracking
_smoother_instance = None


def get_landmark_smoother() -> LandmarkSmoother:
    """
    Get the global landmark smoother instance.

    Returns:
        LandmarkSmoother instance
    """
    global _smoother_instance

    if _smoother_instance is None:
        # Balanced parameters for gesture recognition
        _smoother_instance = LandmarkSmoother(
            min_cutoff=1.0,
            beta=0.007,
            d_cutoff=1.0
        )

    return _smoother_instance


def reset_temporal_filters():
    """
    Reset all temporal filters to clean state.

    CRITICAL for consistent preprocessing:
    - Call this BEFORE recording a new gesture (stateless recording)
    - Do NOT call during live matching (preserve filter state)

    This ensures recorded gestures have consistent preprocessing,
    regardless of what was happening before the recording started.
    """
    global _smoother_instance

    if _smoother_instance is not None:
        _smoother_instance.reset()
        logger.info("✅ Temporal filters reset (clean state for recording)")
    else:
        logger.debug("No smoother instance to reset")


def ensure_smoother_initialized():
    """
    Ensure the global smoother exists without resetting it.

    Use this for live matching to preserve filter state.
    """
    return get_landmark_smoother()
