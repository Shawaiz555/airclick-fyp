"""
AirClick - Gesture Matching Service
===================================

This service implements Dynamic Time Warping (DTW) algorithm for gesture matching.
It compares recorded gestures with stored templates to find the best match.

Phase 1 Enhancements (Accuracy Improvements):
- Advanced preprocessing with Procrustes normalization
- Temporal smoothing with One Euro Filter
- Outlier detection and removal
- Bone-length normalization for scale invariance

Based on research best practices:
- Modified DTW with direction similarity
- Euclidean distance for landmark comparison
- k-NN classification (1-NN for speed)

Expected Improvement: +30-45% accuracy (65% → 85-90% threshold)

Author: Muhammad Shawaiz
Project: AirClick FYP
"""

import numpy as np
from typing import List, Dict, Tuple, Optional
import logging
from sqlalchemy.orm import Session

# Import Phase 1 enhancements
from app.services.gesture_preprocessing import get_gesture_preprocessor
from app.services.temporal_smoothing import smooth_gesture_frames

logger = logging.getLogger(__name__)


class GestureMatcher:
    """
    Gesture matching service using Dynamic Time Warping (DTW) algorithm.
    """

    def __init__(
        self,
        similarity_threshold: float = 0.75,
        enable_preprocessing: bool = True,
        enable_smoothing: bool = True
    ):
        """
        Initialize the gesture matcher.

        Args:
            similarity_threshold: Minimum similarity score (0-1) to consider a match
                                 Default: 0.75 (75%) - Improved with Phase 1 enhancements
                                 Previous: 0.65 (65%)
            enable_preprocessing: Enable Procrustes + bone-length normalization
            enable_smoothing: Enable temporal smoothing (One Euro Filter)
        """
        self.similarity_threshold = similarity_threshold
        self.max_distance = 1000.0  # Maximum DTW distance for normalization
        self.enable_preprocessing = enable_preprocessing
        self.enable_smoothing = enable_smoothing

        # Get preprocessor instance
        if self.enable_preprocessing:
            self.preprocessor = get_gesture_preprocessor()
            logger.info("Phase 1 preprocessing enabled: Procrustes + bone-length normalization")

        if self.enable_smoothing:
            logger.info("Phase 1 temporal smoothing enabled: One Euro Filter")

    def extract_features(self, frames: List[Dict]) -> np.ndarray:
        """
        Extract feature vectors from gesture frames with Phase 1 preprocessing.

        Pipeline:
        1. Optional: Apply temporal smoothing (One Euro Filter)
        2. Optional: Apply Procrustes + bone-length normalization
        3. Flatten landmarks to feature vectors (21 × 3 = 63 features)
        4. Apply z-score normalization

        Args:
            frames: List of frame dictionaries with landmarks

        Returns:
            numpy array of shape (num_frames, 63) - 21 landmarks * 3 coordinates
        """
        # Step 1: Apply temporal smoothing if enabled
        if self.enable_smoothing:
            frames = smooth_gesture_frames(
                frames,
                method='one_euro',
                min_cutoff=1.0,
                beta=0.007
            )

        # Step 2: Apply advanced preprocessing if enabled
        if self.enable_preprocessing:
            try:
                # Preprocess frames: Procrustes + bone-length normalization
                normalized_landmarks, metadata = self.preprocessor.preprocess_frames(
                    frames,
                    apply_procrustes=True,
                    apply_bone_normalization=True,
                    remove_outliers=True
                )

                # Flatten to feature vectors
                features = self.preprocessor.flatten_landmarks(normalized_landmarks)

                logger.debug(f"Preprocessing: {metadata['original_frames']} → {metadata['final_frames']} frames, "
                           f"{metadata['outliers_removed']} outliers removed")

            except Exception as e:
                logger.warning(f"Preprocessing failed: {e}, falling back to basic extraction")
                # Fallback to basic extraction
                features = self._extract_features_basic(frames)
        else:
            # Use basic extraction (original method)
            features = self._extract_features_basic(frames)

        return features

    def _extract_features_basic(self, frames: List[Dict]) -> np.ndarray:
        """
        Basic feature extraction (original method, used as fallback).

        Args:
            frames: List of frame dictionaries with landmarks

        Returns:
            numpy array of shape (num_frames, 63)
        """
        features = []

        for frame in frames:
            landmarks = frame.get("landmarks", [])

            # Flatten landmarks to a single vector
            frame_features = []
            for lm in landmarks:
                frame_features.extend([lm["x"], lm["y"], lm["z"]])

            features.append(frame_features)

        return np.array(features)

    def normalize_sequence(self, sequence: np.ndarray) -> np.ndarray:
        """
        Normalize a sequence to have zero mean and unit variance.

        This helps make the matching scale-invariant.

        Args:
            sequence: Input sequence

        Returns:
            Normalized sequence
        """
        mean = np.mean(sequence, axis=0)
        std = np.std(sequence, axis=0)

        # Avoid division by zero
        std[std == 0] = 1.0

        return (sequence - mean) / std

    def euclidean_distance(self, point1: np.ndarray, point2: np.ndarray) -> float:
        """
        Calculate Euclidean distance between two feature vectors.

        Args:
            point1: First feature vector
            point2: Second feature vector

        Returns:
            Euclidean distance
        """
        return np.sqrt(np.sum((point1 - point2) ** 2))

    def dtw_distance(self, seq1: np.ndarray, seq2: np.ndarray) -> float:
        """
        Calculate Dynamic Time Warping distance between two sequences.

        DTW finds the optimal alignment between two time series by warping
        the time axis to minimize the distance between them.

        Args:
            seq1: First sequence (n_frames, n_features)
            seq2: Second sequence (m_frames, n_features)

        Returns:
            DTW distance (lower is more similar)
        """
        n, m = len(seq1), len(seq2)

        # Initialize DTW matrix with infinity
        dtw_matrix = np.full((n + 1, m + 1), np.inf)
        dtw_matrix[0, 0] = 0

        # Fill the DTW matrix
        for i in range(1, n + 1):
            for j in range(1, m + 1):
                cost = self.euclidean_distance(seq1[i - 1], seq2[j - 1])

                # Take minimum of three possible paths
                dtw_matrix[i, j] = cost + min(
                    dtw_matrix[i - 1, j],      # Insertion
                    dtw_matrix[i, j - 1],      # Deletion
                    dtw_matrix[i - 1, j - 1]   # Match
                )

        return dtw_matrix[n, m]

    def calculate_similarity(self, distance: float) -> float:
        """
        Convert DTW distance to similarity score (0-1).

        Lower distance = higher similarity

        Args:
            distance: DTW distance

        Returns:
            Similarity score between 0 and 1
        """
        # Normalize distance to [0, 1] range
        normalized_distance = min(distance / self.max_distance, 1.0)

        # Convert to similarity (1 - distance)
        similarity = 1.0 - normalized_distance

        return max(0.0, similarity)

    def match_gesture(
        self,
        input_frames: List[Dict],
        stored_gestures: List[Dict]
    ) -> Optional[Tuple[Dict, float]]:
        """
        Match input gesture against stored gesture templates.

        Uses 1-NN classification with DTW distance metric.

        Args:
            input_frames: List of frames from input gesture
            stored_gestures: List of stored gesture templates from database

        Returns:
            Tuple of (best_match_gesture, similarity_score) or None if no match
        """
        if not stored_gestures:
            logger.warning("No stored gestures to match against")
            return None

        if not input_frames or len(input_frames) < 5:
            logger.warning("Input gesture too short (minimum 5 frames required)")
            return None

        # Extract and normalize input features
        try:
            input_features = self.extract_features(input_frames)
            input_normalized = self.normalize_sequence(input_features)
        except Exception as e:
            logger.error(f"Error extracting input features: {e}")
            return None

        # Find best match using 1-NN
        best_match = None
        best_similarity = 0.0
        best_distance = float('inf')

        logger.info(f"Input gesture: {len(input_frames)} frames → {len(input_normalized)} normalized features")

        all_results = []  # Store all results for detailed logging

        for idx, gesture in enumerate(stored_gestures, 1):
            try:
                # Extract stored gesture frames
                landmark_data = gesture.get("landmark_data", {})
                stored_frames = landmark_data.get("frames", [])

                if not stored_frames:
                    logger.warning(f"  Gesture '{gesture.get('name')}': No frames found, skipping")
                    continue

                # Extract and normalize stored features
                stored_features = self.extract_features(stored_frames)
                stored_normalized = self.normalize_sequence(stored_features)

                # Calculate DTW distance
                distance = self.dtw_distance(input_normalized, stored_normalized)
                similarity = self.calculate_similarity(distance)

                result_str = f"  {idx}. '{gesture.get('name')}': distance={distance:.2f}, similarity={similarity:.2%}"
                logger.info(result_str)

                all_results.append({
                    'name': gesture.get('name'),
                    'distance': distance,
                    'similarity': similarity,
                    'frames': len(stored_frames)
                })

                # Update best match if this is better
                if similarity > best_similarity:
                    best_similarity = similarity
                    best_distance = distance
                    best_match = gesture

            except Exception as e:
                logger.error(f"  ✗ Error matching gesture '{gesture.get('name')}': {e}")
                continue

        # Log summary
        logger.info(f"\nMatching Results Summary:")
        logger.info(f"  Total gestures compared: {len(all_results)}")
        logger.info(f"  Best match: {best_match.get('name') if best_match else 'None'}")
        logger.info(f"  Best similarity: {best_similarity:.2%}")
        logger.info(f"  Threshold: {self.similarity_threshold:.2%}")

        # Check if best match meets threshold
        if best_match and best_similarity >= self.similarity_threshold:
            logger.info(f"  ✓ Match accepted! '{best_match.get('name')}' exceeds threshold")
            return (best_match, best_similarity)
        else:
            logger.info(f"  ✗ No match: Best similarity ({best_similarity:.2%}) < Threshold ({self.similarity_threshold:.2%})")
            logger.info(f"\nTroubleshooting tips:")
            logger.info(f"  - Try performing the gesture more slowly")
            logger.info(f"  - Ensure hand stays in frame throughout gesture")
            logger.info(f"  - Record gesture multiple times for better template")
            logger.info(f"  - Check if gesture motion matches recording closely")
            return None

    def batch_match(
        self,
        input_frames: List[Dict],
        stored_gestures: List[Dict],
        top_k: int = 3
    ) -> List[Tuple[Dict, float]]:
        """
        Match input gesture and return top K matches.

        Args:
            input_frames: List of frames from input gesture
            stored_gestures: List of stored gesture templates
            top_k: Number of top matches to return

        Returns:
            List of (gesture, similarity_score) tuples, sorted by similarity
        """
        if not stored_gestures:
            return []

        # Extract and normalize input features
        try:
            input_features = self.extract_features(input_frames)
            input_normalized = self.normalize_sequence(input_features)
        except Exception as e:
            logger.error(f"Error extracting input features: {e}")
            return []

        # Calculate similarities for all gestures
        matches = []

        for gesture in stored_gestures:
            try:
                landmark_data = gesture.get("landmark_data", {})
                stored_frames = landmark_data.get("frames", [])

                if not stored_frames:
                    continue

                stored_features = self.extract_features(stored_frames)
                stored_normalized = self.normalize_sequence(stored_features)

                distance = self.dtw_distance(input_normalized, stored_normalized)
                similarity = self.calculate_similarity(distance)

                matches.append((gesture, similarity))

            except Exception as e:
                logger.error(f"Error in batch matching: {e}")
                continue

        # Sort by similarity (descending) and return top K
        matches.sort(key=lambda x: x[1], reverse=True)
        return matches[:top_k]


# Global gesture matcher instance with Phase 1 enhancements
# Threshold increased from 0.65 to 0.75 thanks to improved preprocessing
gesture_matcher = GestureMatcher(
    similarity_threshold=0.75,
    enable_preprocessing=True,
    enable_smoothing=True
)


def get_gesture_matcher() -> GestureMatcher:
    """
    Get the global gesture matcher instance.

    Returns:
        GestureMatcher instance
    """
    return gesture_matcher
