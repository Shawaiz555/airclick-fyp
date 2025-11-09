"""
AirClick - MediaPipe Hand Tracking Service (FastAPI Integration)
================================================================

This service provides real-time hand tracking using MediaPipe and OpenCV.
It captures video from the webcam, detects hand landmarks, and streams
the data to connected clients via WebSocket through FastAPI.

Architecture:
    Camera (OpenCV) -> MediaPipe Hands -> FastAPI WebSocket -> Frontend

Author: Muhammad Shawaiz
Project: AirClick FYP
"""

import cv2
import mediapipe as mp
import asyncio
import json
import logging
from datetime import datetime
from typing import Optional, Dict, Set
from fastapi import WebSocket, WebSocketDisconnect

# Configure logging for debugging and monitoring
logger = logging.getLogger(__name__)


class HandTrackingService:
    """
    Main service class that handles camera access, hand detection,
    and WebSocket communication through FastAPI.

    Attributes:
        mp_hands: MediaPipe Hands solution object
        mp_drawing: MediaPipe drawing utilities
        hands: Configured MediaPipe Hands detector
        cap: OpenCV video capture object
        clients: Set of connected WebSocket clients
        is_running: Service running status
    """

    def __init__(self, camera_index: int = 0):
        """
        Initialize the hand tracking service.

        Args:
            camera_index: Camera device index (0 for default webcam)
        """
        logger.info("Initializing Hand Tracking Service...")

        # Initialize MediaPipe Hands
        self.mp_hands = mp.solutions.hands
        self.mp_drawing = mp.solutions.drawing_utils
        self.mp_drawing_styles = mp.solutions.drawing_styles

        # Configure MediaPipe Hands with optimal settings
        self.hands = self.mp_hands.Hands(
            static_image_mode=False,
            max_num_hands=2,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )

        # Initialize camera capture
        self.cap = cv2.VideoCapture(camera_index)

        # Set camera properties for optimal performance
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        self.cap.set(cv2.CAP_PROP_FPS, 30)

        # Check if camera opened successfully
        if not self.cap.isOpened():
            logger.error("Failed to open camera!")
            raise RuntimeError("Camera not accessible")

        logger.info("✓ Camera initialized successfully")

        # Store connected WebSocket clients
        self.clients: Set[WebSocket] = set()

        # Service running flag
        self.is_running = False


    def process_frame(self) -> Optional[Dict]:
        """
        Capture and process a single frame from the camera.

        This method:
        1. Reads a frame from the webcam
        2. Converts BGR (OpenCV) to RGB (MediaPipe)
        3. Processes the frame to detect hand landmarks
        4. Serializes the results to JSON format

        Returns:
            Dictionary containing hand landmarks data, or None if no hands detected
        """
        # Read frame from camera
        ret, frame = self.cap.read()

        if not ret:
            logger.warning("Failed to read frame from camera")
            return None

        # Convert BGR (OpenCV format) to RGB (MediaPipe format)
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

        # Process the frame to detect hand landmarks
        results = self.hands.process(rgb_frame)

        # Check if any hands were detected
        if results.multi_hand_landmarks:
            return self._serialize_landmarks(results, frame.shape)

        return None


    def _serialize_landmarks(self, results, frame_shape) -> Dict:
        """
        Convert MediaPipe results to JSON-serializable format.

        Args:
            results: MediaPipe detection results
            frame_shape: Shape of the video frame (height, width, channels)

        Returns:
            Dictionary containing:
            - timestamp: Current time
            - hands: List of detected hands with landmarks
            - frame_size: Original frame dimensions
        """
        hands_data = []

        # Process each detected hand
        for idx, hand_landmarks in enumerate(results.multi_hand_landmarks):
            # Get handedness (Left or Right hand)
            handedness = results.multi_handedness[idx].classification[0]

            # Extract all 21 landmark points
            landmarks = []
            for landmark in hand_landmarks.landmark:
                landmarks.append({
                    'x': landmark.x,
                    'y': landmark.y,
                    'z': landmark.z
                })

            # Create hand data object
            hand_data = {
                'handedness': handedness.label,
                'confidence': handedness.score,
                'landmarks': landmarks,
                'landmark_count': len(landmarks)
            }

            hands_data.append(hand_data)

        # Return complete data package
        return {
            'timestamp': datetime.now().isoformat(),
            'hands': hands_data,
            'hand_count': len(hands_data),
            'frame_size': {
                'width': frame_shape[1],
                'height': frame_shape[0]
            }
        }


    async def handle_client(self, websocket: WebSocket, hybrid_mode: bool = False):
        """
        Handle a new FastAPI WebSocket client connection.

        This method:
        1. Accepts the WebSocket connection
        2. Registers the new client
        3. Sends hand tracking data continuously
        4. Handles disconnection gracefully
        5. NEW: Supports hybrid mode for cursor control

        Args:
            websocket: FastAPI WebSocket connection object
            hybrid_mode: Enable hybrid mode (cursor + clicks + gestures)
        """
        # Accept the WebSocket connection
        await websocket.accept()

        # Register new client
        self.clients.add(websocket)
        client_id = id(websocket)
        logger.info(f"✓ New client connected: {client_id} (hybrid_mode={hybrid_mode})")
        logger.info(f"✓ Total clients: {len(self.clients)}")

        # Initialize hybrid mode controller if enabled
        hybrid_controller = None
        if hybrid_mode:
            try:
                from app.services.hybrid_mode_controller import get_hybrid_mode_controller
                hybrid_controller = get_hybrid_mode_controller()
                hybrid_controller.enable_hybrid_mode()
                logger.info(f"✅ Hybrid mode ENABLED for client {client_id}")
            except Exception as e:
                logger.error(f"Failed to initialize hybrid mode: {e}")
                hybrid_mode = False

        try:
            # Keep connection alive and send data
            while True:
                # Process frame and get hand data
                hand_data = self.process_frame()

                if hand_data:
                    # Process with hybrid mode if enabled
                    if hybrid_mode and hybrid_controller:
                        try:
                            hybrid_result = hybrid_controller.process_frame(hand_data)
                            hand_data['hybrid'] = hybrid_result
                        except Exception as e:
                            logger.error(f"Hybrid mode processing error: {e}")

                    # Convert to JSON and send to client
                    json_data = json.dumps(hand_data)
                    await websocket.send_text(json_data)

                # Small delay to control frame rate (~30 FPS)
                await asyncio.sleep(0.033)

        except WebSocketDisconnect:
            logger.info(f"✗ Client disconnected: {client_id}")
        except Exception as e:
            logger.error(f"✗ Error handling client {client_id}: {e}")
        finally:
            # Disable hybrid mode on disconnect
            if hybrid_mode and hybrid_controller:
                hybrid_controller.disable_hybrid_mode()
                logger.info(f"❌ Hybrid mode DISABLED for client {client_id}")

            # Remove client from set
            self.clients.discard(websocket)
            logger.info(f"✓ Total clients: {len(self.clients)}")


    def cleanup(self):
        """
        Clean up resources before shutdown.

        This method releases the camera and closes MediaPipe resources.
        """
        logger.info("Cleaning up Hand Tracking Service resources...")

        # Release camera
        if self.cap:
            self.cap.release()
            logger.info("✓ Camera released")

        # Close MediaPipe hands
        if self.hands:
            self.hands.close()
            logger.info("✓ MediaPipe closed")

        logger.info("✓ Cleanup complete")


# Global instance (will be initialized in main.py)
hand_tracking_service: Optional[HandTrackingService] = None


def get_hand_tracking_service() -> HandTrackingService:
    """
    Get the global hand tracking service instance.

    Returns:
        HandTrackingService instance

    Raises:
        RuntimeError: If service is not initialized
    """
    if hand_tracking_service is None:
        raise RuntimeError("Hand tracking service not initialized")
    return hand_tracking_service
