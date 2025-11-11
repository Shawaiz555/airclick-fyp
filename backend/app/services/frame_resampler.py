"""
AirClick - Frame Resampler Utility
===================================

This utility provides frame resampling functionality to standardize gesture frame counts.
Critical for ensuring consistent DTW matching between recorded and live gestures.

Author: Muhammad Shawaiz (Enhanced by Claude)
Project: AirClick FYP
"""

import numpy as np
from typing import List, Dict
import logging

logger = logging.getLogger(__name__)


def resample_frames_linear(frames: List[Dict], target_frames: int = 60) -> List[Dict]:
    """
    Resample frames to a fixed count using linear interpolation.

    This ensures all gestures have the same frame count for DTW matching,
    regardless of recording duration or frame rate variations.

    Args:
        frames: List of frame dictionaries containing:
            - timestamp: Frame timestamp in milliseconds
            - landmarks: List of 21 hand landmarks (x, y, z)
            - handedness: "Left" or "Right"
            - confidence: Detection confidence (0-1)
        target_frames: Target number of frames (default: 60 = 2 seconds at 30 FPS)

    Returns:
        List of resampled frames with exactly target_frames count

    Example:
        >>> frames = [...]  # 120 frames
        >>> resampled = resample_frames_linear(frames, target_frames=60)
        >>> len(resampled)
        60
    """
    if not frames:
        logger.warning("Empty frames list provided to resampler")
        return []

    original_count = len(frames)

    # If already at target, return as-is
    if original_count == target_frames:
        logger.debug(f"Frames already at target count: {target_frames}")
        return frames

    logger.info(f"Resampling frames: {original_count} → {target_frames}")

    # Create interpolation indices
    # Map target frame indices to original frame positions
    original_indices = np.linspace(0, original_count - 1, original_count)
    target_indices = np.linspace(0, original_count - 1, target_frames)

    resampled_frames = []

    for target_idx in target_indices:
        # Find surrounding frames for interpolation
        i = int(np.floor(target_idx))
        j = min(i + 1, original_count - 1)

        # Calculate interpolation weight (0 = frame i, 1 = frame j)
        weight = target_idx - i

        # Get surrounding frames
        frame_i = frames[i]
        frame_j = frames[j]

        # Interpolate landmarks
        interpolated_landmarks = []
        landmarks_i = frame_i.get('landmarks', [])
        landmarks_j = frame_j.get('landmarks', [])

        if len(landmarks_i) != 21 or len(landmarks_j) != 21:
            logger.error(f"Invalid landmark count: {len(landmarks_i)}, {len(landmarks_j)}")
            continue

        for lm_i, lm_j in zip(landmarks_i, landmarks_j):
            # Linear interpolation: value = (1 - weight) * value_i + weight * value_j
            interpolated_landmarks.append({
                'x': float((1 - weight) * lm_i['x'] + weight * lm_j['x']),
                'y': float((1 - weight) * lm_i['y'] + weight * lm_j['y']),
                'z': float((1 - weight) * lm_i['z'] + weight * lm_j['z'])
            })

        # Interpolate other fields
        interpolated_timestamp = int((1 - weight) * frame_i.get('timestamp', 0) +
                                     weight * frame_j.get('timestamp', 0))
        interpolated_confidence = float((1 - weight) * frame_i.get('confidence', 1.0) +
                                       weight * frame_j.get('confidence', 1.0))

        # Create interpolated frame
        resampled_frame = {
            'timestamp': interpolated_timestamp,
            'landmarks': interpolated_landmarks,
            'handedness': frame_i.get('handedness', 'Right'),  # Use first frame's handedness
            'confidence': interpolated_confidence
        }

        resampled_frames.append(resampled_frame)

    logger.info(f"✅ Resampling complete: {len(resampled_frames)} frames")
    return resampled_frames


def resample_landmarks_array(landmarks: np.ndarray, target_frames: int = 60) -> np.ndarray:
    """
    Resample a numpy array of landmarks to a fixed frame count.

    Optimized version for numpy arrays (faster than dict-based resampling).

    Args:
        landmarks: Numpy array of shape (n_frames, 21, 3) or (n_frames, 63)
        target_frames: Target number of frames (default: 60)

    Returns:
        Resampled array of shape (target_frames, 21, 3) or (target_frames, 63)
    """
    if landmarks.shape[0] == target_frames:
        return landmarks

    original_shape = landmarks.shape
    original_frames = original_shape[0]

    logger.debug(f"Resampling numpy array: {original_frames} → {target_frames}")

    # Flatten to 2D for easier interpolation
    if len(original_shape) == 3:  # (n_frames, 21, 3)
        landmarks_2d = landmarks.reshape(original_frames, -1)  # (n_frames, 63)
        reshape_needed = True
    else:  # Already (n_frames, 63)
        landmarks_2d = landmarks
        reshape_needed = False

    # Create interpolation indices
    original_indices = np.arange(original_frames)
    target_indices = np.linspace(0, original_frames - 1, target_frames)

    # Interpolate each feature dimension
    resampled = np.zeros((target_frames, landmarks_2d.shape[1]))

    for dim in range(landmarks_2d.shape[1]):
        resampled[:, dim] = np.interp(target_indices, original_indices, landmarks_2d[:, dim])

    # Reshape back if needed
    if reshape_needed:
        resampled = resampled.reshape(target_frames, 21, 3)

    logger.debug(f"✅ Numpy resampling complete: {resampled.shape}")
    return resampled


def validate_frame_count(frames: List[Dict], expected_count: int = 60) -> bool:
    """
    Validate that frames list has the expected count.

    Args:
        frames: List of frame dictionaries
        expected_count: Expected frame count (default: 60)

    Returns:
        True if frame count matches expected, False otherwise
    """
    actual_count = len(frames)
    if actual_count != expected_count:
        logger.warning(f"Frame count mismatch: expected {expected_count}, got {actual_count}")
        return False
    return True


def get_frame_statistics(frames: List[Dict]) -> Dict:
    """
    Get statistics about a frame sequence.

    Args:
        frames: List of frame dictionaries

    Returns:
        Dictionary with statistics:
            - frame_count: Number of frames
            - duration_ms: Duration in milliseconds
            - avg_fps: Average frames per second
            - avg_confidence: Average detection confidence
            - handedness: Most common handedness
    """
    if not frames:
        return {
            'frame_count': 0,
            'duration_ms': 0,
            'avg_fps': 0,
            'avg_confidence': 0,
            'handedness': 'Unknown'
        }

    frame_count = len(frames)

    # Calculate duration
    if frame_count > 1:
        duration_ms = frames[-1]['timestamp'] - frames[0]['timestamp']
        avg_fps = (frame_count / (duration_ms / 1000.0)) if duration_ms > 0 else 0
    else:
        duration_ms = 0
        avg_fps = 0

    # Calculate average confidence
    confidences = [f.get('confidence', 1.0) for f in frames]
    avg_confidence = np.mean(confidences) if confidences else 0

    # Get most common handedness
    handedness_counts = {}
    for f in frames:
        h = f.get('handedness', 'Unknown')
        handedness_counts[h] = handedness_counts.get(h, 0) + 1
    handedness = max(handedness_counts, key=handedness_counts.get) if handedness_counts else 'Unknown'

    return {
        'frame_count': frame_count,
        'duration_ms': duration_ms,
        'avg_fps': round(avg_fps, 2),
        'avg_confidence': round(avg_confidence, 3),
        'handedness': handedness
    }


# Global instance for singleton pattern
_frame_resampler_instance = None


def get_frame_resampler():
    """
    Get the global frame resampler instance (singleton pattern).

    Returns:
        Frame resampler utility (this module)
    """
    global _frame_resampler_instance

    if _frame_resampler_instance is None:
        _frame_resampler_instance = {
            'resample_linear': resample_frames_linear,
            'resample_array': resample_landmarks_array,
            'validate_count': validate_frame_count,
            'get_stats': get_frame_statistics
        }
        logger.info("Frame resampler utility initialized")

    return _frame_resampler_instance
