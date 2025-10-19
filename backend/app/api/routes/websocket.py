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
    WebSocket endpoint for real-time hand tracking data.

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
    logger.info("New WebSocket connection request for hand tracking")

    try:
        # Get the hand tracking service instance
        service = get_hand_tracking_service()

        # Handle the client connection
        await service.handle_client(websocket)

    except RuntimeError as e:
        logger.error(f"Hand tracking service error: {e}")
        await websocket.close(code=1011, reason="Service not available")
    except Exception as e:
        logger.error(f"Unexpected error in WebSocket handler: {e}")
        await websocket.close(code=1011, reason="Internal server error")
