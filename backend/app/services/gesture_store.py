"""
AirClick - In-Memory Gesture Store
====================================

Loads and caches all gestures for a user in memory at login time,
eliminating the per-match DB query (saves 5-15ms per gesture match).

Lifecycle:
- Load: called after user authenticates (login or token validation)
- Invalidate: called when user adds, updates, or deletes a gesture
- Lookup: called by gesture_match_callback instead of hitting the DB
"""

import logging
from typing import Dict, List, Optional
from threading import RLock

logger = logging.getLogger(__name__)

# user_id -> list of gesture dicts ready for matcher
_store: Dict[int, List[dict]] = {}
_lock = RLock()


def load_user_gestures(user_id: int, db) -> None:
    """
    Load all gestures for user_id into memory from the DB.
    Call this right after the user authenticates.
    """
    from app.models.gesture import Gesture

    gestures = db.query(Gesture).filter(Gesture.user_id == user_id).all()

    gesture_list = [
        {
            "id": g.id,
            "name": g.name,
            "action": g.action,
            "app_context": g.app_context,
            "landmark_data": g.landmark_data,
            "adaptive_threshold": g.adaptive_threshold,
            "template_index": g.template_index,
        }
        for g in gestures
    ]

    with _lock:
        _store[user_id] = gesture_list

    logger.info(f"GestureStore: loaded {len(gesture_list)} gesture(s) for user {user_id}")


def get_user_gestures(user_id: int) -> Optional[List[dict]]:
    """
    Return cached gestures for user_id, or None if not loaded yet.
    """
    with _lock:
        return _store.get(user_id)


def invalidate_user_gestures(user_id: int) -> None:
    """
    Remove cached gestures for user_id so the next match reloads from DB.
    Call this after any gesture create / update / delete.
    """
    with _lock:
        removed = _store.pop(user_id, None)

    if removed is not None:
        logger.info(f"GestureStore: invalidated cache for user {user_id} ({len(removed)} entries removed)")
    else:
        logger.debug(f"GestureStore: no cache to invalidate for user {user_id}")


def reload_user_gestures(user_id: int, db) -> None:
    """
    Invalidate then immediately reload gestures from DB.
    Call this after a gesture change when the user is active.
    """
    invalidate_user_gestures(user_id)
    load_user_gestures(user_id, db)
    logger.info(f"GestureStore: reloaded gestures for user {user_id}")
