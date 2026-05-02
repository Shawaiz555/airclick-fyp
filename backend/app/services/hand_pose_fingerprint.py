"""
Hand Pose Fingerprinting Service
==================================

Detects which fingers are extended using hand-relative geometry.
Works regardless of hand rotation, tilt, or camera angle because
every check projects onto the finger's own bone axis rather than
relying on screen-Y or absolute distances.

Signature format: "thumb,index,middle,ring,pinky"  (each 0 or 1)
  "0,0,0,0,0" = closed fist
  "0,1,0,0,0" = index only (pointing)
  "0,1,1,0,0" = peace sign
  "1,1,1,1,1" = open hand

Author: Muhammad Shawaiz
Project: AirClick FYP
"""

import numpy as np
import logging
from typing import Dict, List

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# MediaPipe landmark index constants
# ---------------------------------------------------------------------------
_WRIST       = 0
_THUMB_CMC   = 1; _THUMB_MCP  = 2; _THUMB_IP   = 3; _THUMB_TIP  = 4
_INDEX_MCP   = 5; _INDEX_PIP  = 6; _INDEX_DIP  = 7; _INDEX_TIP  = 8
_MIDDLE_MCP  = 9; _MIDDLE_PIP = 10; _MIDDLE_DIP = 11; _MIDDLE_TIP = 12
_RING_MCP    = 13; _RING_PIP  = 14; _RING_DIP   = 15; _RING_TIP  = 16
_PINKY_MCP   = 17; _PINKY_PIP = 18; _PINKY_DIP  = 19; _PINKY_TIP = 20


def _pt(lm: Dict) -> np.ndarray:
    """Landmark dict → numpy (x, y, z)."""
    return np.array([lm['x'], lm['y'], lm.get('z', 0.0)], dtype=np.float64)


def _dist(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.linalg.norm(a - b))


def _hand_size(lms: List[Dict]) -> float:
    """Wrist → middle-MCP distance as reference scale."""
    return _dist(_pt(lms[_WRIST]), _pt(lms[_MIDDLE_MCP]))


# ---------------------------------------------------------------------------
# Core per-finger detection  (hand-relative geometry)
# ---------------------------------------------------------------------------

def _finger_curl_ratio(
    mcp: np.ndarray,
    pip: np.ndarray,
    tip: np.ndarray,
) -> float:
    """
    Return a curl ratio in [0, 1].

    Method: project the MCP→tip vector onto the MCP→PIP bone axis.
    A straight (extended) finger has tip far along that axis → ratio near 1.
    A curled finger has tip folded back → ratio near 0 or negative.

    This is purely axis-aligned to the finger's own bone, so it does not
    depend on hand orientation in camera space at all.
    """
    bone = pip - mcp                        # MCP → PIP direction
    bone_len = np.linalg.norm(bone)
    if bone_len < 1e-6:
        return 0.0

    bone_unit = bone / bone_len
    finger_vec = tip - mcp                  # MCP → tip

    # Projection of finger_vec onto bone axis (signed)
    projection = float(np.dot(finger_vec, bone_unit))

    # Total length of the finger vector
    finger_len = float(np.linalg.norm(finger_vec))
    if finger_len < 1e-6:
        return 0.0

    # How far along the bone axis the tip lands, relative to MCP→PIP length
    # Extended: tip is 2–3× beyond PIP → ratio ≥ 1.5
    # Moderately bent: ratio ≈ 0.8–1.2
    # Fully curled / fist: ratio < 0.5 (tip folds toward palm)
    return projection / bone_len


def _pip_straightness(
    mcp: np.ndarray,
    pip: np.ndarray,
    tip: np.ndarray,
) -> float:
    """
    PIP joint straightness: angle at PIP between (PIP←MCP) and (PIP→tip).

    Returns cos(angle).  1.0 = perfectly straight, 0.0 = 90° bent, -1.0 = fully folded.
    An extended finger is close to straight (cos ≈ 0.7–1.0).
    A curled finger in a fist has cos ≈ 0.0 or negative.
    """
    v1 = mcp - pip   # PIP → MCP (pointing back)
    v2 = tip - pip   # PIP → tip (pointing forward)
    n1 = np.linalg.norm(v1)
    n2 = np.linalg.norm(v2)
    if n1 < 1e-6 or n2 < 1e-6:
        return 0.0
    return float(np.dot(v1, v2) / (n1 * n2))


def _is_four_finger_extended(
    lms: List[Dict],
    mcp_idx: int,
    pip_idx: int,
    dip_idx: int,
    tip_idx: int,
    finger_name: str,
) -> bool:
    """
    Decide if a non-thumb finger is extended using three hand-relative checks.

    All three checks operate on vectors/projections along the finger's own
    bone axis so they are invariant to hand rotation/tilt.

    Check A — curl ratio ≥ 1.4
        The tip must project at least 1.4× the MCP→PIP bone length ahead of
        MCP along the bone axis.  Curled fingers project ≤ 0.7.

    Check B — PIP straightness cos ≥ 0.3
        The angle at the PIP joint must be less than ~73°.  A fist has the
        PIP near 90° or more bent, giving cos ≈ 0 or negative.

    Check C — tip farther from wrist than MCP (scaled)
        tip_to_wrist > mcp_to_wrist × 1.05.  Provides a fallback independent
        of finger-axis direction.

    Verdict: extended if A AND (B OR C).
    The mandatory curl-ratio gate (A) prevents a fist from sneaking through
    on straightly-aligned fingers alone.  B and C are OR-combined because
    some natural extended-finger poses fail one or the other slightly.
    """
    try:
        wrist = _pt(lms[_WRIST])
        mcp   = _pt(lms[mcp_idx])
        pip   = _pt(lms[pip_idx])
        tip   = _pt(lms[tip_idx])

        # Check A: projection along bone axis
        curl = _finger_curl_ratio(mcp, pip, tip)
        check_a = curl >= 1.4

        # Check B: PIP joint angle
        cos_pip = _pip_straightness(mcp, pip, tip)
        check_b = cos_pip >= 0.3

        # Check C: wrist distance ratio
        tip_wr  = _dist(tip, wrist)
        mcp_wr  = _dist(mcp, wrist)
        check_c = tip_wr > mcp_wr * 1.05

        is_ext = check_a and (check_b or check_c)

        logger.debug(
            f"    {finger_name}: curl={curl:.2f}(A={check_a}) "
            f"cos_pip={cos_pip:.2f}(B={check_b}) "
            f"wr_ratio={tip_wr/(mcp_wr+1e-6):.2f}(C={check_c}) → {is_ext}"
        )
        return is_ext

    except Exception as exc:
        logger.warning(f"Finger detection error ({finger_name}): {exc}")
        return False


def _is_thumb_extended(lms: List[Dict], hand_sz: float) -> bool:
    """
    Thumb extension using three hand-relative checks.

    The thumb moves in a different plane from the other fingers so it gets
    its own specialised detection.

    Check A — curl ratio along CMC→MCP axis ≥ 0.9
        Looser than the four fingers because the thumb opens laterally and
        its tip doesn't travel as far along the metacarpal axis.

    Check B — tip-to-IP extension ratio
        tip_to_wrist / ip_to_wrist > 1.15 (tip farther from wrist than IP).
        For a tucked thumb (fist) the tip is beside/under the palm and
        ip_to_wrist ≥ tip_to_wrist.

    Check C — MCP→tip distance > 55 % of hand size
        Absolute length check scaled to hand size so it generalises across
        different hand proportions.

    Verdict: (A OR B) AND C.
    """
    try:
        wrist     = _pt(lms[_WRIST])
        thumb_cmc = _pt(lms[_THUMB_CMC])
        thumb_mcp = _pt(lms[_THUMB_MCP])
        thumb_ip  = _pt(lms[_THUMB_IP])
        thumb_tip = _pt(lms[_THUMB_TIP])

        # Check A: projection from CMC along CMC→MCP bone
        curl = _finger_curl_ratio(thumb_cmc, thumb_mcp, thumb_tip)
        check_a = curl >= 0.9

        # Check B: tip farther from wrist than IP
        tip_wr = _dist(thumb_tip, wrist)
        ip_wr  = _dist(thumb_ip,  wrist)
        check_b = tip_wr > ip_wr * 1.15

        # Check C: absolute MCP→tip length relative to hand size
        mcp_to_tip = _dist(thumb_mcp, thumb_tip)
        check_c = mcp_to_tip > hand_sz * 0.55

        is_ext = (check_a or check_b) and check_c

        logger.debug(
            f"    Thumb: curl={curl:.2f}(A={check_a}) "
            f"tip/ip={tip_wr/(ip_wr+1e-6):.2f}(B={check_b}) "
            f"mcp_tip={mcp_to_tip:.3f}>{hand_sz*0.55:.3f}(C={check_c}) → {is_ext}"
        )
        return is_ext

    except Exception as exc:
        logger.warning(f"Thumb detection error: {exc}")
        return False


# ---------------------------------------------------------------------------
# Pose signature
# ---------------------------------------------------------------------------

_GESTURE_NAMES = {
    (1, 1, 1, 1, 1): "Open hand / High five",
    (0, 1, 1, 0, 0): "Peace / Victory",
    (1, 0, 0, 0, 0): "Thumbs up",
    (0, 1, 0, 0, 0): "Pointing / Index",
    (0, 0, 0, 0, 0): "Fist / Closed hand",
    (1, 1, 0, 0, 0): "Index + Thumb",
    (0, 1, 1, 1, 0): "Three fingers (index-ring)",
    (0, 1, 1, 1, 1): "Four fingers (no thumb)",
    (1, 1, 1, 1, 0): "Four fingers (no pinky) + thumb",
    (1, 0, 0, 0, 1): "Rock / Devil horns",
    (0, 0, 0, 1, 1): "Ring + Pinky",
    (0, 0, 1, 0, 0): "Middle only",
    (0, 0, 0, 1, 0): "Ring only",
    (0, 0, 0, 0, 1): "Pinky only",
    (1, 0, 0, 1, 1): "Thumb + Ring + Pinky",
    (0, 1, 0, 0, 1): "Index + Pinky",
    (1, 1, 1, 0, 0): "Index + Middle + Thumb",
    (0, 1, 0, 1, 0): "Index + Ring",
    (1, 0, 1, 0, 0): "Thumb + Middle",
}


def _get_gesture_hint(t: int, i: int, m: int, r: int, p: int) -> str:
    pattern = (t, i, m, r, p)
    return _GESTURE_NAMES.get(pattern, f"Custom ({sum(pattern)} fingers)")


def _default_signature() -> Dict:
    return {
        'thumb': 0, 'index': 0, 'middle': 0, 'ring': 0, 'pinky': 0,
        'signature': '0,0,0,0,0',
        'extended_count': 0,
        'hand_size': 0.15,
        'gesture_hint': 'Unknown (detection failed)',
    }


class HandPoseFingerprint:
    """Public interface — thin wrapper so existing call-sites don't break."""

    # Expose landmark indices as class attributes for callers that use them
    WRIST      = _WRIST
    THUMB_CMC  = _THUMB_CMC;  THUMB_MCP  = _THUMB_MCP
    THUMB_IP   = _THUMB_IP;   THUMB_TIP  = _THUMB_TIP
    INDEX_MCP  = _INDEX_MCP;  INDEX_PIP  = _INDEX_PIP
    INDEX_DIP  = _INDEX_DIP;  INDEX_TIP  = _INDEX_TIP
    MIDDLE_MCP = _MIDDLE_MCP; MIDDLE_PIP = _MIDDLE_PIP
    MIDDLE_DIP = _MIDDLE_DIP; MIDDLE_TIP = _MIDDLE_TIP
    RING_MCP   = _RING_MCP;   RING_PIP   = _RING_PIP
    RING_DIP   = _RING_DIP;   RING_TIP   = _RING_TIP
    PINKY_MCP  = _PINKY_MCP;  PINKY_PIP  = _PINKY_PIP
    PINKY_DIP  = _PINKY_DIP;  PINKY_TIP  = _PINKY_TIP

    def __init__(self):
        pass

    # -- kept for callers that still reference these as instance methods --

    @staticmethod
    def _euclidean_distance(p1: Dict, p2: Dict) -> float:
        return _dist(_pt(p1), _pt(p2))

    @staticmethod
    def _estimate_hand_size(lms: List[Dict]) -> float:
        return _hand_size(lms)

    def _is_thumb_extended(self, lms: List[Dict], hand_size: float) -> bool:
        return _is_thumb_extended(lms, hand_size)

    def _is_finger_extended(
        self, lms, mcp_idx, pip_idx, dip_idx, tip_idx, _hand_size, finger_name
    ) -> bool:
        return _is_four_finger_extended(lms, mcp_idx, pip_idx, dip_idx, tip_idx, finger_name)

    def calculate_pose_signature(self, landmarks: List[Dict]) -> Dict:
        try:
            if not landmarks or len(landmarks) != 21:
                return _default_signature()

            hand_sz = _hand_size(landmarks)

            thumb  = 1 if _is_thumb_extended(landmarks, hand_sz) else 0
            index  = 1 if _is_four_finger_extended(
                landmarks, _INDEX_MCP, _INDEX_PIP, _INDEX_DIP, _INDEX_TIP, "Index") else 0
            middle = 1 if _is_four_finger_extended(
                landmarks, _MIDDLE_MCP, _MIDDLE_PIP, _MIDDLE_DIP, _MIDDLE_TIP, "Middle") else 0
            ring   = 1 if _is_four_finger_extended(
                landmarks, _RING_MCP, _RING_PIP, _RING_DIP, _RING_TIP, "Ring") else 0
            pinky  = 1 if _is_four_finger_extended(
                landmarks, _PINKY_MCP, _PINKY_PIP, _PINKY_DIP, _PINKY_TIP, "Pinky") else 0

            sig    = f"{thumb},{index},{middle},{ring},{pinky}"
            count  = thumb + index + middle + ring + pinky
            hint   = _get_gesture_hint(thumb, index, middle, ring, pinky)

            logger.debug(f"Pose: {sig} ({count}f) → {hint}")
            return {
                'thumb': thumb, 'index': index, 'middle': middle,
                'ring': ring, 'pinky': pinky,
                'signature': sig,
                'extended_count': count,
                'hand_size': hand_sz,
                'gesture_hint': hint,
            }

        except Exception as exc:
            logger.error(f"Pose signature error: {exc}")
            return _default_signature()

    @staticmethod
    def _get_default_signature() -> Dict:
        return _default_signature()

    @staticmethod
    def _get_gesture_hint(t, i, m, r, p) -> str:
        return _get_gesture_hint(t, i, m, r, p)

    @staticmethod
    def calculate_pose_distance(sig1: str, sig2: str) -> int:
        try:
            f1 = sig1.split(',')
            f2 = sig2.split(',')
            if len(f1) != 5 or len(f2) != 5:
                return 5
            return sum(a != b for a, b in zip(f1, f2))
        except Exception:
            return 5


# ---------------------------------------------------------------------------
# Module-level singletons & convenience functions  (all existing callers kept)
# ---------------------------------------------------------------------------

_fingerprint_detector = HandPoseFingerprint()


def calculate_pose_signature(landmarks: List[Dict]) -> Dict:
    return _fingerprint_detector.calculate_pose_signature(landmarks)


def calculate_pose_distance(sig1: str, sig2: str) -> int:
    return HandPoseFingerprint.calculate_pose_distance(sig1, sig2)


def estimate_hand_size(landmarks: List[Dict]) -> float:
    return _hand_size(landmarks)


# ---------------------------------------------------------------------------
# Palm-facing & thumb-side  (unchanged — geometry is already orientation-aware)
# ---------------------------------------------------------------------------

def compute_palm_facing(landmarks: List[Dict]) -> str:
    """
    "front" / "back" / "side" / "unknown".
    Uses the palm normal (cross product of wrist→index_MCP × wrist→pinky_MCP).
    """
    if not landmarks or len(landmarks) < 18:
        return "unknown"

    wrist     = _pt(landmarks[0])
    index_mcp = _pt(landmarks[5])
    pinky_mcp = _pt(landmarks[17])

    v1 = index_mcp - wrist
    v2 = pinky_mcp - wrist
    normal = np.cross(v1, v2)
    mag = np.linalg.norm(normal)
    if mag < 1e-6:
        return "unknown"

    z = normal[2] / mag
    if z < -0.3:
        return "front"
    elif z > 0.3:
        return "back"
    else:
        return "side"


def compute_thumb_side(landmarks: List[Dict]) -> str:
    """
    "left" / "right" / "center" / "unknown".
    Projects thumb CMC onto the axis perpendicular to wrist→middle_MCP.
    """
    if not landmarks or len(landmarks) < 10:
        return "unknown"

    wrist      = landmarks[0]
    middle_mcp = landmarks[9]
    thumb_cmc  = landmarks[1]

    ax = middle_mcp['x'] - wrist['x']
    ay = middle_mcp['y'] - wrist['y']
    palm_len = (ax*ax + ay*ay) ** 0.5
    if palm_len < 1e-6:
        return "unknown"

    ax /= palm_len; ay /= palm_len
    perp_x = -ay; perp_y = ax

    tx = thumb_cmc['x'] - wrist['x']
    ty = thumb_cmc['y'] - wrist['y']
    proj = tx * perp_x + ty * perp_y

    thr = palm_len * 0.15
    if proj > thr:
        return "right"
    elif proj < -thr:
        return "left"
    else:
        return "center"


def check_hand_orientation(frames: List[Dict], min_facing_ratio: float = 0.6) -> Dict:
    """Check whether a gesture sequence shows the palm facing the camera."""
    if not frames:
        return {'valid': False, 'reason': 'No frames provided', 'ratio': 0.0}

    passing = checked = 0
    for frame in frames:
        lms = frame.get('landmarks', [])
        if len(lms) < 18:
            continue
        wrist     = _pt(lms[0])
        index_mcp = _pt(lms[5])
        pinky_mcp = _pt(lms[17])
        v1 = index_mcp - wrist
        v2 = pinky_mcp - wrist
        normal = np.cross(v1, v2)
        mag = np.linalg.norm(normal)
        if mag < 1e-6:
            continue
        checked += 1
        if normal[2] / mag < 0.4:
            passing += 1

    if checked == 0:
        return {'valid': False, 'reason': 'Could not compute palm orientation', 'ratio': 0.0}

    ratio = passing / checked
    if ratio >= min_facing_ratio:
        return {'valid': True, 'reason': 'Palm is facing the camera', 'ratio': ratio}
    return {
        'valid': False,
        'reason': (
            f'Hand not oriented correctly ({ratio:.0%} passed, need {min_facing_ratio:.0%}). '
            'Avoid showing the back of your hand.'
        ),
        'ratio': ratio,
    }


# ---------------------------------------------------------------------------
# Representative pose (unchanged logic, uses the new per-frame detector)
# ---------------------------------------------------------------------------

def compute_representative_pose(frames: List[Dict]) -> Dict:
    """
    Compute a stable hand pose from the middle 25–60 % of a gesture sequence
    using majority vote across frames.  More robust than using a single frame.
    """
    from collections import Counter

    if not frames:
        return _default_signature()

    n = len(frames)
    start = max(0, int(n * 0.25))
    end   = min(n, int(n * 0.60))
    if end - start < 3:
        start = max(0, n // 4)
        end   = min(n, start + max(3, n // 3))

    window = frames[start:end] or frames

    thumb_v = []; index_v = []; mid_v = []; ring_v = []; pinky_v = []
    facing_v = []; side_v = []

    for frame in window:
        lms = frame.get('landmarks', [])
        if not lms or len(lms) != 21:
            continue
        pose = _fingerprint_detector.calculate_pose_signature(lms)
        thumb_v.append(pose['thumb']);  index_v.append(pose['index'])
        mid_v.append(pose['middle']);   ring_v.append(pose['ring'])
        pinky_v.append(pose['pinky'])
        facing_v.append(compute_palm_facing(lms))
        side_v.append(compute_thumb_side(lms))

    if not thumb_v:
        lms = frames[0].get('landmarks', [])
        result = _fingerprint_detector.calculate_pose_signature(lms)
        result['palm_facing'] = compute_palm_facing(lms)
        result['thumb_side']  = compute_thumb_side(lms)
        return result

    def modal(votes, default=0):
        return Counter(votes).most_common(1)[0][0] if votes else default

    thumb  = modal(thumb_v);  index  = modal(index_v)
    middle = modal(mid_v);    ring   = modal(ring_v);  pinky = modal(pinky_v)
    palm_facing = modal(facing_v, 'unknown')
    thumb_side  = modal(side_v,   'unknown')

    sig   = f"{thumb},{index},{middle},{ring},{pinky}"
    count = thumb + index + middle + ring + pinky
    hint  = _get_gesture_hint(thumb, index, middle, ring, pinky)

    return {
        'thumb': thumb, 'index': index, 'middle': middle,
        'ring': ring, 'pinky': pinky,
        'signature': sig,
        'extended_count': count,
        'hand_size': _hand_size(window[0].get('landmarks', [{'x':0,'y':0,'z':0}]*21)),
        'gesture_hint': hint,
        'palm_facing': palm_facing,
        'thumb_side':  thumb_side,
    }
