"""
WebSocket routes for real-time hand tracking.
"""

from fastapi import APIRouter, WebSocket
from app.services.hand_tracking import get_hand_tracking_service
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


@router.websocket("/hand-tracking")
async def hand_tracking_websocket(websocket: WebSocket):
    """
    WebSocket endpoint for real-time hand tracking data (Gesture Mode).

    This endpoint:
    1. Accepts WebSocket connections from frontend clients
    2. Streams real-time hand landmark data from MediaPipe
    3. Handles multiple concurrent connections

    Connection URL: ws://localhost:8000/ws/hand-tracking

    Data format:
    {
        "timestamp": "2024-10-19T00:00:00",
        "hands": [
            {
                "handedness": "Left" or "Right",
                "confidence": 0.95,
                "landmarks": [{"x": 0.5, "y": 0.5, "z": 0.0}, ...],
                "landmark_count": 21
            }
        ],
        "hand_count": 1,
        "frame_size": {"width": 640, "height": 480}
    }
    """
    logger.info("New WebSocket connection request for hand tracking (Gesture Mode)")

    try:
        # Get the hand tracking service instance
        service = get_hand_tracking_service()

        # Handle the client connection (hybrid_mode=False)
        await service.handle_client(websocket, hybrid_mode=False)

    except RuntimeError as e:
        logger.error(f"Hand tracking service error: {e}")
        await websocket.close(code=1011, reason="Service not available")
    except Exception as e:
        logger.error(f"Unexpected error in WebSocket handler: {e}")
        await websocket.close(code=1011, reason="Internal server error")


@router.websocket("/hand-tracking-hybrid")
async def hand_tracking_hybrid_websocket(websocket: WebSocket):
    """
    WebSocket endpoint for hand tracking with HYBRID MODE (Cursor + Clicks + Gestures).

    This endpoint:
    1. Accepts WebSocket connections from frontend clients
    2. Streams real-time hand landmark data from MediaPipe
    3. Processes hand data for cursor control and click detection
    4. Moves system cursor based on index finger position
    5. Detects pinch gestures for left/right clicks
    6. Supports gesture recognition simultaneously

    Connection URL: ws://localhost:8000/ws/hand-tracking-hybrid

    Data format:
    {
        "timestamp": "2024-10-19T00:00:00",
        "hands": [...],
        "hand_count": 1,
        "frame_size": {"width": 640, "height": 480},
        "hybrid": {
            "success": true,
            "hybrid_mode_enabled": true,
            "cursor": {
                "success": true,
                "cursor_enabled": true,
                "hand_position": {"raw": {...}, "smoothed": {...}, "filtered": {...}},
                "screen_position": {"x": 1024, "y": 768},
                "latency_ms": 5.2
            },
            "clicks": {
                "click_type": "left_click" | "right_click" | "none",
                "trigger_left": false,
                "trigger_right": false,
                "raw_detections": {"index_pinch": false, "middle_pinch": false},
                "consistent_detections": {"left_click": false, "right_click": false},
                "states": {"left_click": "idle", "right_click": "idle"}
            },
            "latency_ms": 6.8,
            "stats": {...}
        }
    }
    """
    logger.info("New WebSocket connection request for hand tracking (HYBRID MODE - Cursor + Clicks)")

    try:
        # Get the hand tracking service instance
        service = get_hand_tracking_service()

        # Handle the client connection with hybrid mode ENABLED
        await service.handle_client(websocket, hybrid_mode=True)

    except RuntimeError as e:
        logger.error(f"Hand tracking service error: {e}")
        await websocket.close(code=1011, reason="Service not available")
    except Exception as e:
        logger.error(f"Unexpected error in WebSocket handler: {e}")
        await websocket.close(code=1011, reason="Internal server error")
