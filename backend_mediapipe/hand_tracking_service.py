"""
AirClick - MediaPipe Hand Tracking Service
===========================================

This service provides real-time hand tracking using MediaPipe and OpenCV.
It captures video from the webcam, detects hand landmarks, and streams
the data to connected clients via WebSocket.

Architecture:
    Camera (OpenCV) -> MediaPipe Hands -> WebSocket Server -> Frontend

Author: Muhammad Shawaiz
Project: AirClick FYP
"""

import cv2
import mediapipe as mp
import asyncio
import websockets
import json
import logging
from datetime import datetime
from typing import Optional, Dict, List

# Configure logging for debugging and monitoring
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class HandTrackingService:
    """
    Main service class that handles camera access, hand detection,
    and WebSocket communication.

    Attributes:
        mp_hands: MediaPipe Hands solution object
        mp_drawing: MediaPipe drawing utilities
        hands: Configured MediaPipe Hands detector
        cap: OpenCV video capture object
        clients: Set of connected WebSocket clients
    """

    def __init__(self, camera_index: int = 0):
        """
        Initialize the hand tracking service.

        Args:
            camera_index: Camera device index (0 for default webcam)
        """
        logger.info("Initializing Hand Tracking Service...")

        # Initialize MediaPipe Hands
        # mp.solutions.hands provides the hand tracking functionality
        self.mp_hands = mp.solutions.hands
        self.mp_drawing = mp.solutions.drawing_utils
        self.mp_drawing_styles = mp.solutions.drawing_styles

        # Configure MediaPipe Hands with optimal settings
        # static_image_mode=False: Optimized for video stream
        # max_num_hands=2: Detect up to 2 hands simultaneously
        # min_detection_confidence=0.5: Lower threshold for better detection
        # min_tracking_confidence=0.5: Smooth tracking between frames
        self.hands = self.mp_hands.Hands(
            static_image_mode=False,
            max_num_hands=2,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )

        # Initialize camera capture
        # cv2.VideoCapture opens the webcam
        self.cap = cv2.VideoCapture(camera_index)

        # Set camera properties for optimal performance
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)   # Width: 640px
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)  # Height: 480px
        self.cap.set(cv2.CAP_PROP_FPS, 30)            # 30 frames per second

        # Check if camera opened successfully
        if not self.cap.isOpened():
            logger.error("Failed to open camera!")
            raise RuntimeError("Camera not accessible")

        logger.info("Camera initialized successfully")

        # Store connected WebSocket clients
        # Using a set to automatically handle duplicates
        self.clients = set()

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
        # ret: boolean indicating success
        # frame: numpy array containing the image
        ret, frame = self.cap.read()

        if not ret:
            logger.warning("Failed to read frame from camera")
            return None

        # Convert BGR (OpenCV format) to RGB (MediaPipe format)
        # OpenCV uses BGR color space, but MediaPipe expects RGB
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

        # Process the frame to detect hand landmarks
        # results.multi_hand_landmarks: List of detected hands
        # results.multi_handedness: Left/Right hand classification
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
            # Each landmark has x, y, z coordinates (normalized 0-1)
            landmarks = []
            for landmark in hand_landmarks.landmark:
                landmarks.append({
                    'x': landmark.x,      # Normalized x coordinate (0-1)
                    'y': landmark.y,      # Normalized y coordinate (0-1)
                    'z': landmark.z       # Depth relative to wrist (negative = closer)
                })

            # Create hand data object
            hand_data = {
                'handedness': handedness.label,           # "Left" or "Right"
                'confidence': handedness.score,           # Detection confidence (0-1)
                'landmarks': landmarks,                   # All 21 landmarks
                'landmark_count': len(landmarks)          # Should always be 21
            }

            hands_data.append(hand_data)

        # Return complete data package
        return {
            'timestamp': datetime.now().isoformat(),      # ISO format timestamp
            'hands': hands_data,                          # List of detected hands
            'hand_count': len(hands_data),                # Number of hands detected
            'frame_size': {
                'width': frame_shape[1],
                'height': frame_shape[0]
            }
        }


    async def handle_client(self, websocket):
        """
        Handle a new WebSocket client connection.

        This method:
        1. Registers the new client
        2. Sends hand tracking data continuously
        3. Handles disconnection gracefully

        Args:
            websocket: WebSocket connection object
        """
        # Register new client
        self.clients.add(websocket)
        client_id = id(websocket)
        logger.info(f"New client connected: {client_id}")
        logger.info(f"Total clients: {len(self.clients)}")

        try:
            # Keep connection alive and send data
            while True:
                # Process frame and get hand data
                hand_data = self.process_frame()

                if hand_data:
                    # Convert to JSON and send to client
                    json_data = json.dumps(hand_data)
                    await websocket.send(json_data)

                # Small delay to control frame rate
                # 0.033 seconds = ~30 FPS
                await asyncio.sleep(0.033)

        except websockets.exceptions.ConnectionClosed:
            logger.info(f"Client disconnected: {client_id}")
        except Exception as e:
            logger.error(f"Error handling client {client_id}: {e}")
        finally:
            # Remove client from set
            self.clients.discard(websocket)
            logger.info(f"Total clients: {len(self.clients)}")


    async def start_server(self, host: str = "localhost", port: int = 8765):
        """
        Start the WebSocket server.

        Args:
            host: Server host address
            port: Server port number
        """
        logger.info(f"Starting WebSocket server on ws://{host}:{port}")
        self.is_running = True

        # Create WebSocket server
        # This will call handle_client() for each new connection
        async with websockets.serve(self.handle_client, host, port):
            logger.info("✓ Server started successfully!")
            logger.info("✓ Camera is active and tracking hands")
            logger.info("✓ Waiting for frontend connections...")

            # Keep server running indefinitely
            await asyncio.Future()  # Run forever


    def cleanup(self):
        """
        Clean up resources before shutdown.

        This method releases the camera and closes MediaPipe resources.
        """
        logger.info("Cleaning up resources...")

        # Release camera
        if self.cap:
            self.cap.release()
            logger.info("Camera released")

        # Close MediaPipe hands
        if self.hands:
            self.hands.close()
            logger.info("MediaPipe closed")

        logger.info("Cleanup complete")


def main():
    """
    Main entry point for the hand tracking service.

    This function:
    1. Creates the HandTrackingService instance
    2. Starts the WebSocket server
    3. Handles shutdown gracefully
    """
    try:
        # Create service instance
        service = HandTrackingService(camera_index=0)

        # Start the server
        asyncio.run(service.start_server(host="localhost", port=8765))

    except KeyboardInterrupt:
        logger.info("\nShutdown requested by user")
    except Exception as e:
        logger.error(f"Fatal error: {e}")
    finally:
        # Always cleanup resources
        service.cleanup()
        logger.info("Service stopped")


# Entry point - runs when script is executed directly
if __name__ == "__main__":
    print("=" * 60)
    print("  AirClick - Hand Tracking Service")
    print("  Real-time MediaPipe Hand Landmark Detection")
    print("=" * 60)
    print()

    main()
