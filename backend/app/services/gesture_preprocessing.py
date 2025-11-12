"""
AirClick - Gesture Preprocessing Module
========================================

This module implements advanced preprocessing techniques to improve gesture matching accuracy:

Phase 1 Enhancements:
1. Procrustes Analysis - Removes translation, rotation, and scale variations
2. Bone-Length Normalization - Anatomically consistent scaling
3. Wrist-Centered Coordinate System - Consistent reference frame
4. Outlier Detection & Removal - Filters low-confidence and anomalous frames

Expected Impact: +20-30% accuracy improvement

Research References:
- Procrustes superimposition for shape analysis
- MediaPipe hand landmark normalization best practices
- Rotation-invariant hand gesture recognition techniques

Author: Muhammad Shawaiz
Project: AirClick FYP - Phase 1 Accuracy Enhancement
"""

import numpy as np
from typing import List, Dict, Tuple, Optional
import logging

logger = logging.getLogger(__name__)


class GesturePreprocessor:
    """
    Advanced preprocessing for gesture landmark data.

    Applies normalization techniques to make gesture matching:
    - Translation invariant (works at any position in frame)
    - Rotation invariant (works at any hand orientation)
    - Scale invariant (works at any distance from camera)
    """

    def __init__(self, confidence_threshold: float = 0.7):
        """
        Initialize preprocessor.

        Args:
            confidence_threshold: Minimum confidence for frame acceptance (0-1)
        """
        self.confidence_threshold = confidence_threshold

    def preprocess_frames(
        self,
        frames: List[Dict],
        apply_procrustes: bool = True,
        apply_bone_normalization: bool = True,
        remove_outliers: bool = True
    ) -> Tuple[np.ndarray, Dict]:
        """
        Complete preprocessing pipeline for gesture frames.

        Pipeline:
        1. Convert frames to numpy arrays (21, 3) per frame
        2. Remove outliers (low confidence, sudden jumps)
        3. Apply Procrustes normalization (translation, rotation, scale)
        4. Apply bone-length normalization (anatomical consistency)

        Args:
            frames: List of frame dictionaries from MediaPipe
            apply_procrustes: Enable Procrustes normalization
            apply_bone_normalization: Enable bone-length normalization
            remove_outliers: Enable outlier detection/removal

        Returns:
            Tuple of (normalized_landmarks, metadata)
            - normalized_landmarks: (num_frames, 21, 3) array
            - metadata: Dict with processing statistics
        """
        if not frames or len(frames) < 5:
            raise ValueError(f"Insufficient frames: {len(frames)} (minimum 5 required)")

        # Step 1: Convert to numpy arrays
        landmarks_array, confidences = self._frames_to_numpy(frames)

        metadata = {
            'original_frames': len(frames),
            'valid_frames': len(landmarks_array),
            'outliers_removed': 0,
            'avg_confidence': float(np.mean(confidences)),
            'preprocessing_applied': []
        }

        # Step 2: Remove outliers
        if remove_outliers:
            landmarks_array, confidences, num_outliers = self._remove_outliers(
                landmarks_array, confidences
            )
            metadata['outliers_removed'] = num_outliers
            metadata['preprocessing_applied'].append('outlier_removal')

            if len(landmarks_array) < 5:
                raise ValueError(f"Too few frames after outlier removal: {len(landmarks_array)}")

        # Step 3: Apply Procrustes normalization (per frame)
        if apply_procrustes:
            landmarks_array = self._apply_procrustes_per_frame(landmarks_array)
            metadata['preprocessing_applied'].append('procrustes_normalization')

        # Step 4: Apply bone-length normalization (per frame)
        if apply_bone_normalization:
            landmarks_array, bone_stats = self._apply_bone_normalization_per_frame(landmarks_array)
            metadata['preprocessing_applied'].append('bone_length_normalization')
            metadata['bone_lengths'] = bone_stats

        metadata['final_frames'] = len(landmarks_array)

        logger.debug(f"Preprocessing complete: {metadata['original_frames']} → {metadata['final_frames']} frames")

        return landmarks_array, metadata

    def _frames_to_numpy(self, frames: List[Dict]) -> Tuple[np.ndarray, np.ndarray]:
        """
        Convert frame dictionaries to numpy arrays.

        Args:
            frames: List of frame dicts with 'landmarks' and 'confidence' keys

        Returns:
            Tuple of (landmarks_array, confidences)
            - landmarks_array: (num_frames, 21, 3)
            - confidences: (num_frames,)
        """
        landmarks_list = []
        confidences = []

        for frame in frames:
            landmarks = frame.get('landmarks', [])
            confidence = frame.get('confidence', 1.0)

            if len(landmarks) != 21:
                logger.warning(f"Frame has {len(landmarks)} landmarks (expected 21), skipping")
                continue

            # Extract x, y, z coordinates
            # Convert to float to avoid numpy string type issues
            frame_landmarks = np.array([
                [float(lm['x']), float(lm['y']), float(lm['z'])] for lm in landmarks
            ], dtype=np.float64)

            landmarks_list.append(frame_landmarks)
            # Ensure confidence is float (not string from database)
            try:
                confidences.append(float(confidence))
            except (TypeError, ValueError):
                logger.warning(f"Invalid confidence value: {confidence}, using 1.0")
                confidences.append(1.0)

        return np.array(landmarks_list), np.array(confidences)

    def _remove_outliers(
        self,
        landmarks: np.ndarray,
        confidences: np.ndarray
    ) -> Tuple[np.ndarray, np.ndarray, int]:
        """
        Remove frames with low confidence or anomalous movements.

        Outlier criteria:
        1. Confidence below threshold
        2. Sudden jumps (>5x median movement)

        Args:
            landmarks: (num_frames, 21, 3) array
            confidences: (num_frames,) array

        Returns:
            Tuple of (filtered_landmarks, filtered_confidences, num_removed)
        """
        num_frames = len(landmarks)

        # Criterion 1: Confidence threshold
        confidence_mask = confidences >= self.confidence_threshold

        # Criterion 2: Detect sudden jumps
        jump_mask = np.ones(num_frames, dtype=bool)

        if num_frames > 1:
            # Calculate frame-to-frame movement (average across all landmarks)
            frame_diffs = np.linalg.norm(
                landmarks[1:] - landmarks[:-1],
                axis=(1, 2)
            )

            if len(frame_diffs) > 0:
                median_diff = np.median(frame_diffs)

                # Flag frames with >5x median movement as jumps
                jump_threshold = 5 * median_diff
                jump_indices = np.where(frame_diffs > jump_threshold)[0] + 1

                if len(jump_indices) > 0:
                    jump_mask[jump_indices] = False
                    logger.debug(f"Detected {len(jump_indices)} sudden jumps")

        # Combine masks
        valid_mask = confidence_mask & jump_mask
        num_removed = num_frames - np.sum(valid_mask)

        if num_removed > 0:
            logger.debug(f"Removed {num_removed} outlier frames ({num_removed/num_frames*100:.1f}%)")

        return landmarks[valid_mask], confidences[valid_mask], int(num_removed)

    def _apply_procrustes_per_frame(self, landmarks: np.ndarray) -> np.ndarray:
        """
        Apply Procrustes normalization to each frame independently.

        Procrustes superimposition removes:
        1. Translation - centers at wrist (landmark 0)
        2. Scale - normalizes by palm size
        3. Rotation - aligns to reference orientation

        Args:
            landmarks: (num_frames, 21, 3) array

        Returns:
            Normalized landmarks (num_frames, 21, 3)
        """
        normalized_frames = []

        for frame in landmarks:
            normalized_frame = self._procrustes_normalize_single_frame(frame)
            normalized_frames.append(normalized_frame)

        return np.array(normalized_frames)

    def _procrustes_normalize_single_frame(self, landmarks: np.ndarray) -> np.ndarray:
        """
        Procrustes normalization for a single frame.

        MediaPipe landmark indices:
        - 0: Wrist
        - 5: Index finger base
        - 9: Middle finger base
        - 17: Pinky finger base

        Args:
            landmarks: (21, 3) array for single frame

        Returns:
            Normalized landmarks (21, 3)
        """
        # Step 1: Translation - center at wrist
        wrist = landmarks[0].copy()
        centered = landmarks - wrist

        # Step 2: Scale - normalize by palm size
        # Use distance from wrist to middle finger base as reference
        middle_base = centered[9]
        palm_size = np.linalg.norm(middle_base)

        if palm_size > 1e-6:  # Avoid division by zero
            scaled = centered / palm_size
        else:
            scaled = centered

        # Step 3: Rotation - align to reference frame
        # Use wrist→middle finger as primary axis
        # Use wrist→index as secondary axis for cross product

        primary_axis = scaled[9]  # Wrist to middle finger base
        secondary_axis = scaled[5]  # Wrist to index finger base

        # Create orthonormal basis using Gram-Schmidt
        # Z-axis: perpendicular to palm (cross product)
        z_axis = np.cross(primary_axis, secondary_axis)
        z_norm = np.linalg.norm(z_axis)

        if z_norm > 1e-6:
            z_axis = z_axis / z_norm
        else:
            z_axis = np.array([0, 0, 1])  # Fallback

        # X-axis: primary direction (wrist to middle finger)
        x_axis = primary_axis / (np.linalg.norm(primary_axis) + 1e-6)

        # Y-axis: perpendicular to both X and Z
        y_axis = np.cross(z_axis, x_axis)

        # Rotation matrix
        rotation_matrix = np.column_stack([x_axis, y_axis, z_axis])

        # Apply rotation
        rotated = scaled @ rotation_matrix

        return rotated

    def _apply_bone_normalization_per_frame(
        self,
        landmarks: np.ndarray
    ) -> Tuple[np.ndarray, Dict]:
        """
        Apply bone-length normalization to each frame.

        Uses anatomical bone lengths as reference for consistent scaling:
        - Palm width (index base to pinky base)
        - Palm height (wrist to middle finger base)
        - Palm diagonal (reference scale)

        Args:
            landmarks: (num_frames, 21, 3) array

        Returns:
            Tuple of (normalized_landmarks, bone_statistics)
        """
        normalized_frames = []
        palm_widths = []
        palm_heights = []

        for frame in landmarks:
            # Calculate bone lengths
            # Palm width: index base (5) to pinky base (17)
            palm_width = np.linalg.norm(frame[17] - frame[5])

            # Palm height: wrist (0) to middle base (9)
            palm_height = np.linalg.norm(frame[9] - frame[0])

            # Reference scale: palm diagonal
            reference_scale = np.sqrt(palm_width**2 + palm_height**2)

            # Normalize by reference scale
            if reference_scale > 1e-6:
                normalized_frame = frame / reference_scale
            else:
                normalized_frame = frame

            normalized_frames.append(normalized_frame)
            palm_widths.append(palm_width)
            palm_heights.append(palm_height)

        bone_stats = {
            'avg_palm_width': float(np.mean(palm_widths)),
            'avg_palm_height': float(np.mean(palm_heights)),
            'palm_width_std': float(np.std(palm_widths)),
            'palm_height_std': float(np.std(palm_heights))
        }

        return np.array(normalized_frames), bone_stats

    def flatten_landmarks(self, landmarks: np.ndarray) -> np.ndarray:
        """
        Flatten 3D landmark array to 2D feature vectors.

        Converts (num_frames, 21, 3) → (num_frames, 63)

        Args:
            landmarks: (num_frames, 21, 3) array

        Returns:
            Flattened features (num_frames, 63)
        """
        num_frames = len(landmarks)
        return landmarks.reshape(num_frames, -1)

    def normalize_z_score(self, features: np.ndarray) -> np.ndarray:
        """
        Apply z-score normalization (zero mean, unit variance).

        This is applied AFTER Procrustes and bone-length normalization
        for final feature scaling.

        Args:
            features: (num_frames, num_features) array

        Returns:
            Z-score normalized features
        """
        mean = np.mean(features, axis=0)
        std = np.std(features, axis=0)

        # Avoid division by zero
        std[std == 0] = 1.0

        return (features - mean) / std


# Global preprocessor instance
_preprocessor_instance = None


def get_gesture_preprocessor() -> GesturePreprocessor:
    """
    Get the global gesture preprocessor instance.

    Returns:
        GesturePreprocessor instance
    """
    global _preprocessor_instance

    if _preprocessor_instance is None:
        _preprocessor_instance = GesturePreprocessor(confidence_threshold=0.7)

    return _preprocessor_instance


def preprocess_for_recording(
    frames: List[Dict],
    target_frames: int = 60,
    apply_smoothing: bool = True,
    apply_procrustes: bool = True,
    apply_bone_normalization: bool = True
) -> np.ndarray:
    """
    Preprocess frames for RECORDING (stateless, consistent).

    This function ensures consistent preprocessing for recorded gestures by:
    1. Resetting temporal filters (clean state)
    2. Resampling to fixed frame count
    3. Applying preprocessing pipeline

    Use this when:
    - User records a new gesture
    - Updating an existing gesture
    - Any operation that will SAVE gesture to database

    Args:
        frames: List of frame dictionaries from MediaPipe
        target_frames: Target frame count (default: 60)
        apply_smoothing: Enable temporal smoothing with reset filters
        apply_procrustes: Enable Procrustes normalization
        apply_bone_normalization: Enable bone-length normalization

    Returns:
        Feature array (target_frames, 63) ready for storage
    """
    from app.services.frame_resampler import resample_frames_linear
    from app.services.temporal_smoothing import reset_temporal_filters, smooth_gesture_frames

    logger.info(f"🔧 Preprocessing for RECORDING (stateless): {len(frames)} frames → {target_frames}")

    # Step 1: Resample to fixed frame count
    if len(frames) != target_frames:
        frames = resample_frames_linear(frames, target_frames=target_frames)
        logger.info(f"  ✓ Resampled to {target_frames} frames")

    # Step 2: Reset temporal filters for clean state
    if apply_smoothing:
        reset_temporal_filters()
        frames = smooth_gesture_frames(
            frames,
            method='one_euro',
            min_cutoff=1.0,
            beta=0.007
        )
        logger.info(f"  ✓ Temporal smoothing applied (filters reset)")

    # Step 3: Apply preprocessing
    preprocessor = get_gesture_preprocessor()
    normalized_landmarks, metadata = preprocessor.preprocess_frames(
        frames,
        apply_procrustes=apply_procrustes,
        apply_bone_normalization=apply_bone_normalization,
        remove_outliers=True
    )

    # Step 4: Flatten to features
    features = preprocessor.flatten_landmarks(normalized_landmarks)

    logger.info(f"  ✓ Preprocessing complete: {features.shape} | Outliers: {metadata['outliers_removed']}")

    return features


def preprocess_for_matching(
    frames: List[Dict],
    target_frames: int = 60,
    apply_smoothing: bool = True,
    apply_procrustes: bool = True,
    apply_bone_normalization: bool = True
) -> np.ndarray:
    """
    Preprocess frames for MATCHING (stateful, preserves filter state).

    This function preserves temporal filter state for smooth live matching:
    1. Does NOT reset temporal filters (continuous tracking)
    2. Resamples to fixed frame count
    3. Applies preprocessing pipeline

    Use this when:
    - Matching gesture in real-time (Electron overlay)
    - Testing gesture match (home page)
    - Any operation that COMPARES against stored gestures

    Args:
        frames: List of frame dictionaries from MediaPipe
        target_frames: Target frame count (default: 60)
        apply_smoothing: Enable temporal smoothing (preserves filter state)
        apply_procrustes: Enable Procrustes normalization
        apply_bone_normalization: Enable bone-length normalization

    Returns:
        Feature array (target_frames, 63) ready for DTW matching
    """
    from app.services.frame_resampler import resample_frames_linear
    from app.services.temporal_smoothing import ensure_smoother_initialized, smooth_gesture_frames

    logger.debug(f"🎯 Preprocessing for MATCHING (stateful): {len(frames)} frames → {target_frames}")

    # Step 1: Resample to fixed frame count
    if len(frames) != target_frames:
        frames = resample_frames_linear(frames, target_frames=target_frames)

    # Step 2: Apply temporal smoothing (preserves filter state)
    if apply_smoothing:
        ensure_smoother_initialized()  # Don't reset filters!
        frames = smooth_gesture_frames(
            frames,
            method='one_euro',
            min_cutoff=1.0,
            beta=0.007
        )

    # Step 3: Apply preprocessing
    preprocessor = get_gesture_preprocessor()
    normalized_landmarks, metadata = preprocessor.preprocess_frames(
        frames,
        apply_procrustes=apply_procrustes,
        apply_bone_normalization=apply_bone_normalization,
        remove_outliers=True
    )

    # Step 4: Flatten to features
    features = preprocessor.flatten_landmarks(normalized_landmarks)

    logger.debug(f"  ✓ Matching preprocessing complete: {features.shape}")

    return features
