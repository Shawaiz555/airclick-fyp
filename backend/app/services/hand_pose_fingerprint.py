"""
Hand Pose Fingerprinting Service
==================================

This module provides hand pose signature detection by analyzing which fingers
are extended. This is used to pre-filter gesture candidates before DTW matching,
significantly improving accuracy by rejecting gestures with incompatible hand poses.

Key Features:
- Detects which fingers are extended (binary signature)
- Calculates Hamming distance between pose signatures
- Provides pose-based gesture filtering

Example:
    Peace sign: "0,1,1,0,0" (index + middle extended)
    Open hand: "1,1,1,1,1" (all fingers extended)
    Thumbs up: "1,0,0,0,0" (only thumb extended)

Author: Muhammad Shawaiz
Project: AirClick FYP
"""

import numpy as np
import logging
from typing import Dict, List, Tuple

logger = logging.getLogger(__name__)


class HandPoseFingerprint:
    """
    Analyzes hand landmarks to determine which fingers are extended.
    Uses geometric analysis of finger joint positions.
    """

    # MediaPipe hand landmark indices
    WRIST = 0

    # Thumb landmarks
    THUMB_CMC = 1
    THUMB_MCP = 2
    THUMB_IP = 3
    THUMB_TIP = 4

    # Index finger landmarks
    INDEX_MCP = 5
    INDEX_PIP = 6
    INDEX_DIP = 7
    INDEX_TIP = 8

    # Middle finger landmarks
    MIDDLE_MCP = 9
    MIDDLE_PIP = 10
    MIDDLE_DIP = 11
    MIDDLE_TIP = 12

    # Ring finger landmarks
    RING_MCP = 13
    RING_PIP = 14
    RING_DIP = 15
    RING_TIP = 16

    # Pinky finger landmarks
    PINKY_MCP = 17
    PINKY_PIP = 18
    PINKY_DIP = 19
    PINKY_TIP = 20

    def __init__(self):
        """Initialize the hand pose fingerprint detector."""
        pass

    @staticmethod
    def _euclidean_distance(p1: Dict, p2: Dict) -> float:
        """Calculate 3D Euclidean distance between two landmarks."""
        dx = p1['x'] - p2['x']
        dy = p1['y'] - p2['y']
        dz = p1.get('z', 0) - p2.get('z', 0)
        return np.sqrt(dx*dx + dy*dy + dz*dz)

    @staticmethod
    def _estimate_hand_size(landmarks: List[Dict]) -> float:
        """
        Estimate hand size using wrist to middle finger MCP distance.
        This provides a reference scale for finger extension thresholds.
        """
        wrist = landmarks[HandPoseFingerprint.WRIST]
        middle_mcp = landmarks[HandPoseFingerprint.MIDDLE_MCP]
        return HandPoseFingerprint._euclidean_distance(wrist, middle_mcp)

    def _is_thumb_extended(self, landmarks: List[Dict], hand_size: float) -> bool:
        """
        Detect if thumb is extended.

        Method: Compare thumb tip distance from palm vs thumb IP distance from palm.
        Extended thumb will have tip much farther from palm than IP joint.
        """
        try:
            wrist = landmarks[self.WRIST]
            thumb_mcp = landmarks[self.THUMB_MCP]
            thumb_ip = landmarks[self.THUMB_IP]
            thumb_tip = landmarks[self.THUMB_TIP]

            # Distance from wrist to thumb tip
            tip_dist = self._euclidean_distance(wrist, thumb_tip)

            # Distance from wrist to thumb IP (middle joint)
            ip_dist = self._euclidean_distance(wrist, thumb_ip)

            # For extended thumb: tip is significantly farther than IP
            # Threshold: tip should be at least 1.2x farther than IP (RELAXED from 1.3)
            extension_ratio = tip_dist / (ip_dist + 1e-6)

            # Also check absolute extension (thumb tip far from MCP base)
            mcp_to_tip = self._euclidean_distance(thumb_mcp, thumb_tip)
            threshold = hand_size * 0.6  # Thumb length ~60% of palm (RELAXED from 0.8)

            # RELAXED: Lower thresholds to catch more thumb extensions
            is_extended = extension_ratio > 1.2 and mcp_to_tip > threshold

            logger.debug(f"    Thumb: ratio={extension_ratio:.2f}, dist={mcp_to_tip:.3f}, threshold={threshold:.3f} → {is_extended}")
            return is_extended

        except Exception as e:
            logger.warning(f"Error detecting thumb extension: {e}")
            return False

    def _is_finger_extended(
        self,
        landmarks: List[Dict],
        mcp_idx: int,
        pip_idx: int,
        dip_idx: int,
        tip_idx: int,
        hand_size: float,
        finger_name: str
    ) -> bool:
        """
        Detect if a finger (index/middle/ring/pinky) is extended.

        Method: Compare tip-to-MCP distance vs PIP-to-MCP distance.
        Extended finger will have tip much farther from MCP base.
        """
        try:
            mcp = landmarks[mcp_idx]
            pip = landmarks[pip_idx]
            dip = landmarks[dip_idx]
            tip = landmarks[tip_idx]
            wrist = landmarks[self.WRIST]

            # Distance from MCP to tip (full finger length)
            mcp_to_tip = self._euclidean_distance(mcp, tip)

            # Distance from MCP to PIP (base joint distance)
            mcp_to_pip = self._euclidean_distance(mcp, pip)

            # For extended finger: tip is far from MCP
            # Threshold based on hand size (finger length ~80-100% of palm)
            # RELAXED: Reduced from 1.0 to 0.8 to be more lenient
            min_finger_length = hand_size * 0.8

            # Also check that tip is farther from wrist than MCP
            # (prevents false positives when finger points toward camera)
            tip_to_wrist = self._euclidean_distance(tip, wrist)
            mcp_to_wrist = self._euclidean_distance(mcp, wrist)

            # Extension criteria (MULTI-METHOD v2):
            # Method 1: Finger length check
            length_check = mcp_to_tip > min_finger_length

            # Method 2: Wrist distance check (finger pointing away)
            wrist_check = tip_to_wrist > mcp_to_wrist * 0.80  # Further relaxed

            # Method 3: PIP-to-tip check (ensure finger is straight, not curled)
            pip_to_tip = self._euclidean_distance(landmarks[pip_idx], tip)
            straightness_check = pip_to_tip > (mcp_to_pip * 1.5)  # Straight finger

            # Finger is extended if it passes 2 out of 3 checks (more robust)
            checks_passed = sum([length_check, wrist_check, straightness_check])
            is_extended = checks_passed >= 2

            logger.debug(f"    {finger_name}: mcp_to_tip={mcp_to_tip:.3f}, threshold={min_finger_length:.3f}, "
                        f"tip_wrist={tip_to_wrist:.3f} vs mcp_wrist={mcp_to_wrist:.3f} → {is_extended}")
            logger.debug(f"       Checks: length={length_check}, wrist={wrist_check}, straight={straightness_check} ({checks_passed}/3)")
            return is_extended

        except Exception as e:
            logger.warning(f"Error detecting {finger_name} extension: {e}")
            return False

    def calculate_pose_signature(self, landmarks: List[Dict]) -> Dict:
        """
        Calculate hand pose signature by detecting which fingers are extended.

        Args:
            landmarks: List of 21 hand landmarks with x, y, z coordinates

        Returns:
            Dictionary containing:
                - thumb: 0 or 1 (extended)
                - index: 0 or 1 (extended)
                - middle: 0 or 1 (extended)
                - ring: 0 or 1 (extended)
                - pinky: 0 or 1 (extended)
                - signature: "0,1,1,0,0" (comma-separated string)
                - extended_count: Total number of extended fingers
                - hand_size: Estimated hand size for reference
        """
        try:
            if not landmarks or len(landmarks) != 21:
                logger.warning(f"Invalid landmarks: expected 21, got {len(landmarks) if landmarks else 0}")
                return self._get_default_signature()

            # Estimate hand size for adaptive thresholds
            hand_size = self._estimate_hand_size(landmarks)

            logger.debug(f"  Calculating pose signature (hand_size={hand_size:.3f}):")

            # Detect each finger
            thumb = 1 if self._is_thumb_extended(landmarks, hand_size) else 0
            index = 1 if self._is_finger_extended(
                landmarks, self.INDEX_MCP, self.INDEX_PIP, self.INDEX_DIP, self.INDEX_TIP,
                hand_size, "Index"
            ) else 0
            middle = 1 if self._is_finger_extended(
                landmarks, self.MIDDLE_MCP, self.MIDDLE_PIP, self.MIDDLE_DIP, self.MIDDLE_TIP,
                hand_size, "Middle"
            ) else 0
            ring = 1 if self._is_finger_extended(
                landmarks, self.RING_MCP, self.RING_PIP, self.RING_DIP, self.RING_TIP,
                hand_size, "Ring"
            ) else 0
            pinky = 1 if self._is_finger_extended(
                landmarks, self.PINKY_MCP, self.PINKY_PIP, self.PINKY_DIP, self.PINKY_TIP,
                hand_size, "Pinky"
            ) else 0

            signature = f"{thumb},{index},{middle},{ring},{pinky}"
            extended_count = thumb + index + middle + ring + pinky

            # Map to common gesture names for logging
            gesture_hint = self._get_gesture_hint(thumb, index, middle, ring, pinky)

            logger.info(f"  ✋ Pose signature: {signature} ({extended_count} fingers) → Looks like: {gesture_hint}")
            logger.info(f"     Finger states: Thumb={thumb}, Index={index}, Middle={middle}, Ring={ring}, Pinky={pinky}")

            return {
                'thumb': thumb,
                'index': index,
                'middle': middle,
                'ring': ring,
                'pinky': pinky,
                'signature': signature,
                'extended_count': extended_count,
                'hand_size': hand_size,
                'gesture_hint': gesture_hint
            }

        except Exception as e:
            logger.error(f"Error calculating pose signature: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return self._get_default_signature()

    @staticmethod
    def _get_default_signature() -> Dict:
        """Return default signature when detection fails."""
        return {
            'thumb': 0,
            'index': 0,
            'middle': 0,
            'ring': 0,
            'pinky': 0,
            'signature': '0,0,0,0,0',
            'extended_count': 0,
            'hand_size': 0.15,
            'gesture_hint': 'Unknown (detection failed)'
        }

    @staticmethod
    def _get_gesture_hint(thumb: int, index: int, middle: int, ring: int, pinky: int) -> str:
        """Provide a hint about what gesture this pose looks like."""
        pattern = (thumb, index, middle, ring, pinky)

        gesture_map = {
            (1, 1, 1, 1, 1): "Open hand / High five",
            (0, 1, 1, 0, 0): "Peace sign / Victory",
            (1, 0, 0, 0, 0): "Thumbs up / Like",
            (0, 1, 0, 0, 0): "Pointing / Index",
            (0, 0, 0, 0, 0): "Fist / Closed hand",
            (1, 1, 0, 0, 0): "Pinch / Pointer + Thumb",
            (0, 1, 1, 1, 0): "Three fingers",
            (0, 1, 1, 1, 1): "Four fingers (no thumb)",
            (1, 0, 0, 0, 1): "Rock / Devil horns",
            (0, 0, 0, 1, 1): "Ring + Pinky",
        }

        return gesture_map.get(pattern, f"Custom ({sum(pattern)} fingers)")

    @staticmethod
    def calculate_pose_distance(sig1: str, sig2: str) -> int:
        """
        Calculate Hamming distance between two pose signatures.
        Returns the number of fingers that differ.

        Args:
            sig1: First signature "0,1,1,0,0"
            sig2: Second signature "1,1,1,1,1"

        Returns:
            Hamming distance (0-5)

        Example:
            "0,1,1,0,0" vs "1,1,1,1,1" → 4 fingers different
        """
        try:
            fingers1 = sig1.split(',')
            fingers2 = sig2.split(',')

            if len(fingers1) != 5 or len(fingers2) != 5:
                logger.warning(f"Invalid signatures: {sig1} vs {sig2}")
                return 5  # Maximum distance (treat as completely different)

            distance = sum(f1 != f2 for f1, f2 in zip(fingers1, fingers2))
            return distance

        except Exception as e:
            logger.warning(f"Error calculating pose distance: {e}")
            return 5  # Maximum distance on error


# Global instance for easy access
_fingerprint_detector = HandPoseFingerprint()


def calculate_pose_signature(landmarks: List[Dict]) -> Dict:
    """
    Convenience function to calculate pose signature.

    Args:
        landmarks: List of 21 hand landmarks

    Returns:
        Pose signature dictionary
    """
    return _fingerprint_detector.calculate_pose_signature(landmarks)


def calculate_pose_distance(sig1: str, sig2: str) -> int:
    """
    Convenience function to calculate pose distance.

    Args:
        sig1: First pose signature
        sig2: Second pose signature

    Returns:
        Hamming distance (0-5)
    """
    return HandPoseFingerprint.calculate_pose_distance(sig1, sig2)


def estimate_hand_size(landmarks: List[Dict]) -> float:
    """
    Convenience function to estimate hand size.

    Args:
        landmarks: List of 21 hand landmarks

    Returns:
        Hand size (normalized distance)
    """
    return HandPoseFingerprint._estimate_hand_size(landmarks)
