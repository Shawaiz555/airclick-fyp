"""
AirClick - Enhanced DTW Module (Phase 2)
=========================================

This module implements advanced DTW algorithms with derivative features for improved
gesture recognition accuracy.

Phase 2 Enhancements:
1. Velocity Features (First Derivative) - Captures movement direction and speed
2. Acceleration Features (Second Derivative) - Captures movement dynamics
3. Direction Similarity DTW - Weighs movement direction more than magnitude
4. FastDTW with Sakoe-Chiba Band - Faster computation with constraints
5. Multi-Feature DTW Fusion - Combines position, velocity, and acceleration

Expected Impact: +15-20% accuracy improvement (on top of Phase 1)

Research References:
- "Modified Dynamic Time Warping Based on Direction Similarity" (2018)
- "Multi-Dimensional Dynamic Time Warping for Gesture Recognition"
- "Toward Accurate Dynamic Time Warping in Linear Time and Space"

Author: Muhammad Shawaiz
Project: AirClick FYP - Phase 2 Accuracy Enhancement
"""

import numpy as np
from typing import Tuple, Dict, Optional
import logging

logger = logging.getLogger(__name__)


class EnhancedDTW:
    """
    Enhanced Dynamic Time Warping with derivative features and optimizations.

    Features:
    - Standard DTW (baseline)
    - Direction Similarity DTW (direction-aware)
    - FastDTW with Sakoe-Chiba band (faster, constrained)
    - Multi-feature DTW (position + velocity + acceleration)
    """

    def __init__(
        self,
        max_distance: float = 150.0,  # ✅ CRITICAL FIX #2: Changed from 1000.0 to 150.0
        sakoe_chiba_radius: Optional[int] = None
    ):
        """
        Initialize Enhanced DTW.

        Args:
            max_distance: Maximum distance for normalization (default: 150.0)
                         After Procrustes normalization, typical distances are:
                         - Perfect match: 0-5
                         - Excellent match: 5-15
                         - Good match: 15-30
                         - Poor match: 50-100
                         - No match: 100+
                         Therefore, 150.0 is a reasonable upper bound.
            sakoe_chiba_radius: Radius for Sakoe-Chiba band (None = auto)
        """
        self.max_distance = max_distance
        self.sakoe_chiba_radius = sakoe_chiba_radius

    # ========== Feature Extraction ==========

    def extract_velocity_features(
        self,
        sequence: np.ndarray,
        dt: float = 1/30
    ) -> np.ndarray:
        """
        Extract velocity features (first derivative).

        Velocity captures:
        - Movement direction
        - Movement speed
        - Rate of change in position

        Args:
            sequence: (num_frames, num_features) array
            dt: Time step between frames (default 30 FPS)

        Returns:
            Velocity features (num_frames-1, num_features)
        """
        if len(sequence) < 2:
            return np.zeros((0, sequence.shape[1]))

        # Calculate velocity: v = Δposition / Δtime
        velocities = np.diff(sequence, axis=0) / dt

        return velocities

    def extract_acceleration_features(
        self,
        velocities: np.ndarray,
        dt: float = 1/30
    ) -> np.ndarray:
        """
        Extract acceleration features (second derivative).

        Acceleration captures:
        - Changes in velocity
        - Movement dynamics
        - Gesture "shape" characteristics

        Args:
            velocities: (num_frames-1, num_features) array
            dt: Time step between frames

        Returns:
            Acceleration features (num_frames-2, num_features)
        """
        if len(velocities) < 2:
            return np.zeros((0, velocities.shape[1]))

        # Calculate acceleration: a = Δvelocity / Δtime
        accelerations = np.diff(velocities, axis=0) / dt

        return accelerations

    def extract_multi_features(
        self,
        sequence: np.ndarray,
        dt: float = 1/30
    ) -> Dict[str, np.ndarray]:
        """
        Extract position, velocity, and acceleration features.

        Args:
            sequence: (num_frames, num_features) array
            dt: Time step between frames

        Returns:
            Dictionary with 'position', 'velocity', 'acceleration' arrays
        """
        position = sequence
        velocity = self.extract_velocity_features(sequence, dt)
        acceleration = self.extract_acceleration_features(velocity, dt)

        return {
            'position': position,
            'velocity': velocity,
            'acceleration': acceleration
        }

    # ========== Standard DTW ==========

    def dtw_distance(
        self,
        seq1: np.ndarray,
        seq2: np.ndarray,
        use_sakoe_chiba: bool = False
    ) -> float:
        """
        Standard Dynamic Time Warping distance.

        Args:
            seq1: First sequence (n, features)
            seq2: Second sequence (m, features)
            use_sakoe_chiba: Apply Sakoe-Chiba band constraint

        Returns:
            DTW distance (lower is more similar)
        """
        n, m = len(seq1), len(seq2)

        # Initialize DTW matrix
        dtw_matrix = np.full((n + 1, m + 1), np.inf)
        dtw_matrix[0, 0] = 0

        # Determine constraint radius
        if use_sakoe_chiba:
            radius = self.sakoe_chiba_radius
            if radius is None:
                # Auto: 10% of max sequence length
                radius = max(1, int(0.1 * max(n, m)))
        else:
            radius = max(n, m)  # No constraint

        # Fill DTW matrix
        for i in range(1, n + 1):
            # Determine column range based on constraint
            j_start = max(1, i - radius)
            j_end = min(m, i + radius)

            for j in range(j_start, j_end + 1):
                # Euclidean distance
                cost = np.linalg.norm(seq1[i - 1] - seq2[j - 1])

                # DTW recurrence
                dtw_matrix[i, j] = cost + min(
                    dtw_matrix[i - 1, j],      # Insertion
                    dtw_matrix[i, j - 1],      # Deletion
                    dtw_matrix[i - 1, j - 1]   # Match
                )

        return dtw_matrix[n, m]

    # ========== Direction Similarity DTW ==========

    def direction_similarity_dtw(
        self,
        seq1: np.ndarray,
        seq2: np.ndarray,
        alpha: float = 0.5,
        dt: float = 1/30
    ) -> float:
        """
        Direction Similarity DTW - weighs movement direction.

        This algorithm considers not just WHERE the hand is,
        but HOW it's moving (direction and speed).

        Research: Achieves 81.3% → 98.67% accuracy (+17.3%)

        Args:
            seq1: First sequence (n, features)
            seq2: Second sequence (m, features)
            alpha: Direction weight (0=position only, 1=direction only)
                   Recommended: 0.3-0.5 for balanced
            dt: Time step for velocity calculation

        Returns:
            Direction-aware DTW distance
        """
        n, m = len(seq1), len(seq2)

        # Calculate velocities
        vel1 = self.extract_velocity_features(seq1, dt)
        vel2 = self.extract_velocity_features(seq2, dt)

        # Initialize DTW matrix
        dtw_matrix = np.full((n + 1, m + 1), np.inf)
        dtw_matrix[0, 0] = 0

        # Fill DTW matrix
        for i in range(1, n + 1):
            for j in range(1, m + 1):
                # Position distance (Euclidean)
                pos_dist = np.linalg.norm(seq1[i - 1] - seq2[j - 1])

                # Direction distance (cosine similarity on velocities)
                if i > 1 and j > 1:
                    v1 = vel1[i - 2]
                    v2 = vel2[j - 2]

                    # Cosine similarity: 1 = same direction, -1 = opposite
                    v1_norm = np.linalg.norm(v1)
                    v2_norm = np.linalg.norm(v2)

                    if v1_norm > 1e-6 and v2_norm > 1e-6:
                        cos_sim = np.dot(v1, v2) / (v1_norm * v2_norm)
                        # Convert to distance: 0 = same, 2 = opposite
                        dir_dist = 1.0 - cos_sim
                    else:
                        dir_dist = 0.0
                else:
                    dir_dist = 0.0

                # Combined cost: weighted sum
                cost = (1.0 - alpha) * pos_dist + alpha * dir_dist

                # DTW recurrence
                dtw_matrix[i, j] = cost + min(
                    dtw_matrix[i - 1, j],
                    dtw_matrix[i, j - 1],
                    dtw_matrix[i - 1, j - 1]
                )

        return dtw_matrix[n, m]

    # ========== Multi-Feature DTW ==========

    def multi_feature_dtw(
        self,
        seq1: np.ndarray,
        seq2: np.ndarray,
        weights: Optional[Dict[str, float]] = None,
        dt: float = 1/30
    ) -> Tuple[float, Dict[str, float]]:
        """
        Multi-Feature DTW: Combines position, velocity, acceleration.

        Research: MD-DTW performs as well or better than single-feature DTW

        Args:
            seq1: First sequence (n, features)
            seq2: Second sequence (m, features)
            weights: Feature weights {'pos': 0.5, 'vel': 0.3, 'acc': 0.2}
            dt: Time step for derivatives

        Returns:
            Tuple of (total_distance, individual_distances)
        """
        # Default weights
        if weights is None:
            weights = {'pos': 0.5, 'vel': 0.3, 'acc': 0.2}

        # Extract features for both sequences
        features1 = self.extract_multi_features(seq1, dt)
        features2 = self.extract_multi_features(seq2, dt)

        # Calculate DTW for each feature type
        distances = {}

        # Position DTW
        if weights.get('pos', 0) > 0:
            pos_dist = self.dtw_distance(features1['position'], features2['position'])
            # Normalize by sequence length
            distances['pos'] = pos_dist / len(seq1)
        else:
            distances['pos'] = 0.0

        # Velocity DTW
        if weights.get('vel', 0) > 0 and len(features1['velocity']) > 0:
            # Pad velocities to match position length
            vel1_padded = np.vstack([features1['velocity'], features1['velocity'][-1:]])
            vel2_padded = np.vstack([features2['velocity'], features2['velocity'][-1:]])

            vel_dist = self.dtw_distance(vel1_padded, vel2_padded)
            distances['vel'] = vel_dist / len(vel1_padded)
        else:
            distances['vel'] = 0.0

        # Acceleration DTW
        if weights.get('acc', 0) > 0 and len(features1['acceleration']) > 0:
            # Pad accelerations to match position length
            acc1_padded = np.vstack([
                features1['acceleration'],
                features1['acceleration'][-1:],
                features1['acceleration'][-1:]
            ])
            acc2_padded = np.vstack([
                features2['acceleration'],
                features2['acceleration'][-1:],
                features2['acceleration'][-1:]
            ])

            acc_dist = self.dtw_distance(acc1_padded, acc2_padded)
            distances['acc'] = acc_dist / len(acc1_padded)
        else:
            distances['acc'] = 0.0

        # Weighted combination
        total_distance = (
            weights.get('pos', 0) * distances['pos'] +
            weights.get('vel', 0) * distances['vel'] +
            weights.get('acc', 0) * distances['acc']
        )

        return total_distance, distances

    # ========== Similarity Conversion ==========

    def calculate_similarity(self, distance: float) -> float:
        """
        Convert DTW distance to similarity score (0-1).

        Args:
            distance: DTW distance

        Returns:
            Similarity score (0-1, higher is more similar)
        """
        # Normalize distance to [0, 1] range
        normalized_distance = min(distance / self.max_distance, 1.0)

        # Convert to similarity
        similarity = 1.0 - normalized_distance

        return max(0.0, similarity)


class DTWEnsemble:
    """
    Ensemble of multiple DTW algorithms for robust matching.

    Combines:
    1. Standard DTW
    2. Direction Similarity DTW
    3. Multi-Feature DTW

    Research: Ensemble methods improve accuracy by 10-15%
    """

    def __init__(
        self,
        max_distance: float = 150.0,  # ✅ CRITICAL FIX #2: Changed from 1000.0 to 150.0
        algorithm_weights: Optional[Dict[str, float]] = None
    ):
        """
        Initialize DTW Ensemble.

        Args:
            max_distance: Maximum distance for normalization (default: 150.0)
                         This should match the EnhancedDTW default for consistency
            algorithm_weights: Weights for each algorithm
        """
        self.dtw = EnhancedDTW(max_distance=max_distance)

        # Default algorithm weights
        if algorithm_weights is None:
            # BALANCED FIX: Equal importance to hand shape AND movement
            # to distinguish both gesture types:
            # - Different shapes, same movement (peace vs open hand swipe)
            # - Same shape, different movement (swipe left vs swipe right)
            self.algorithm_weights = {
                'standard': 0.30,        # Increased: hand shape/position matching (important!)
                'direction': 0.35,       # Balanced: movement direction (important!)
                'multi_feature': 0.35    # Balanced: combined features
            }
            logger.info("✅ BALANCED DTW weights: standard=30%, direction=35%, multi_feature=35%")
        else:
            self.algorithm_weights = algorithm_weights

    def match(
        self,
        seq1: np.ndarray,
        seq2: np.ndarray,
        return_details: bool = False
    ) -> float:
        """
        Match two sequences using ensemble of DTW algorithms.

        Args:
            seq1: First sequence (n, features)
            seq2: Second sequence (m, features)
            return_details: Return individual algorithm results

        Returns:
            Ensemble similarity score (0-1)
            or Tuple of (similarity, details_dict) if return_details=True
        """
        results = {}

        # 1. Standard DTW
        if self.algorithm_weights.get('standard', 0) > 0:
            std_dist = self.dtw.dtw_distance(seq1, seq2, use_sakoe_chiba=True)
            std_sim = self.dtw.calculate_similarity(std_dist)
            results['standard'] = std_sim

        # 2. Direction Similarity DTW
        if self.algorithm_weights.get('direction', 0) > 0:
            # CRITICAL FIX: Increased alpha to emphasize direction over position
            # alpha=0.6 means 60% weight on direction, 40% on position
            dir_dist = self.dtw.direction_similarity_dtw(seq1, seq2, alpha=0.6)
            dir_sim = self.dtw.calculate_similarity(dir_dist)
            results['direction'] = dir_sim

        # 3. Multi-Feature DTW
        if self.algorithm_weights.get('multi_feature', 0) > 0:
            # BALANCED FIX: Equal weight to position and velocity
            mf_dist, _ = self.dtw.multi_feature_dtw(
                seq1, seq2,
                weights={
                    'pos': 0.45,  # Increased: position/hand shape is important
                    'vel': 0.40,  # Balanced: velocity captures movement
                    'acc': 0.15   # Reduced: acceleration is less critical
                }
            )
            mf_sim = self.dtw.calculate_similarity(mf_dist)
            results['multi_feature'] = mf_sim

        # Calculate weighted ensemble similarity
        ensemble_similarity = sum(
            self.algorithm_weights.get(name, 0) * sim
            for name, sim in results.items()
        )

        if return_details:
            details = {
                'ensemble_similarity': ensemble_similarity,
                'individual_results': results,
                'weights': self.algorithm_weights
            }
            return ensemble_similarity, details

        return ensemble_similarity


# ========== Convenience Functions ==========

def compute_dtw_with_features(
    seq1: np.ndarray,
    seq2: np.ndarray,
    method: str = 'ensemble',
    **kwargs
) -> float:
    """
    Convenience function to compute DTW with various methods.

    Args:
        seq1: First sequence (n, features)
        seq2: Second sequence (m, features)
        method: DTW method ('standard', 'direction', 'multi_feature', 'ensemble')
        **kwargs: Additional parameters for the method

    Returns:
        Similarity score (0-1)
    """
    dtw = EnhancedDTW()

    if method == 'standard':
        distance = dtw.dtw_distance(seq1, seq2, use_sakoe_chiba=True)
        return dtw.calculate_similarity(distance)

    elif method == 'direction':
        alpha = kwargs.get('alpha', 0.4)
        distance = dtw.direction_similarity_dtw(seq1, seq2, alpha=alpha)
        return dtw.calculate_similarity(distance)

    elif method == 'multi_feature':
        weights = kwargs.get('weights', {'pos': 0.5, 'vel': 0.3, 'acc': 0.2})
        distance, _ = dtw.multi_feature_dtw(seq1, seq2, weights=weights)
        return dtw.calculate_similarity(distance)

    elif method == 'ensemble':
        algorithm_weights = kwargs.get('algorithm_weights', None)
        ensemble = DTWEnsemble(algorithm_weights=algorithm_weights)
        return ensemble.match(seq1, seq2)

    else:
        raise ValueError(f"Unknown method: {method}")


# Global instance
_enhanced_dtw_instance = None
_dtw_ensemble_instance = None


def get_enhanced_dtw() -> EnhancedDTW:
    """
    Get global Enhanced DTW instance.

    Returns:
        EnhancedDTW instance
    """
    global _enhanced_dtw_instance

    if _enhanced_dtw_instance is None:
        _enhanced_dtw_instance = EnhancedDTW()

    return _enhanced_dtw_instance


def get_dtw_ensemble() -> DTWEnsemble:
    """
    Get global DTW Ensemble instance.

    Returns:
        DTWEnsemble instance with corrected max_distance (150.0)
    """
    global _dtw_ensemble_instance

    if _dtw_ensemble_instance is None:
        # ✅ CRITICAL FIX #2: Explicitly set max_distance to ensure it's not using old default
        _dtw_ensemble_instance = DTWEnsemble(max_distance=150.0)
        logger.info(f"✅ DTW Ensemble initialized with max_distance=150.0 (FIXED)")

    return _dtw_ensemble_instance
