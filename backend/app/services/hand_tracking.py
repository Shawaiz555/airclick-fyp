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
                from app.services.gesture_matcher import get_gesture_matcher
                from sqlalchemy.orm import Session
                from app.core.database import SessionLocal

                # CHECK 1: Verify user is authenticated and has gestures
                # NOTE: Cursor control always works in hybrid mode
                # Only gesture matching is disabled without authentication
                import os
                token_path = os.path.join(os.path.expanduser("~"), ".airclick-token")

                gesture_matching_enabled = False  # Track if gesture matching should work

                if not os.path.exists(token_path):
                    # No token file - cursor works, but no gesture matching
                    logger.warning("⚠️ No authentication token found - gesture matching disabled (cursor still works)")
                    try:
                        await websocket.send_text(json.dumps({
                            "status": "disabled",
                            "reason": "not_authenticated",
                            "message": "Authentication required"
                        }))
                    except Exception as send_error:
                        logger.error(f"Failed to send auth status to client {client_id}: {send_error}")
                    gesture_matching_enabled = False
                else:
                    # Token exists - check if user has gestures
                    try:
                        with open(token_path, 'r') as f:
                            token = f.read().strip()

                        if not token:
                            logger.warning("⚠️ Empty token - gesture matching disabled (cursor still works)")
                            try:
                                await websocket.send_text(json.dumps({
                                    "status": "disabled",
                                    "reason": "not_authenticated",
                                    "message": "Authentication required"
                                }))
                            except Exception as send_error:
                                logger.error(f"Failed to send auth status to client {client_id}: {send_error}")
                            gesture_matching_enabled = False
                        else:
                            # Validate token and check gesture count
                            from app.core.security import decode_access_token
                            from app.models.gesture import Gesture

                            payload = decode_access_token(token)
                            if not payload:
                                logger.warning("⚠️ Invalid token - gesture matching disabled (cursor still works)")
                                try:
                                    await websocket.send_text(json.dumps({
                                        "status": "disabled",
                                        "reason": "invalid_token",
                                        "message": "Invalid or expired token"
                                    }))
                                except Exception as send_error:
                                    logger.error(f"Failed to send auth status to client {client_id}: {send_error}")
                                gesture_matching_enabled = False
                            else:
                                # JWT tokens use "sub" for user ID, not "user_id"
                                user_id = payload.get("sub") or payload.get("user_id")
                                if not user_id:
                                    logger.warning("⚠️ No user_id in token - gesture matching disabled (cursor still works)")
                                    try:
                                        await websocket.send_text(json.dumps({
                                            "status": "disabled",
                                            "reason": "invalid_token",
                                            "message": "Invalid token"
                                        }))
                                    except Exception as send_error:
                                        logger.error(f"Failed to send auth status to client {client_id}: {send_error}")
                                    gesture_matching_enabled = False
                                else:
                                    # Check gesture count
                                    db = SessionLocal()
                                    try:
                                        gesture_count = db.query(Gesture).filter(Gesture.user_id == user_id).count()

                                        if gesture_count == 0:
                                            # No gestures - cursor works but no gesture matching
                                            logger.warning(f"⚠️ User {user_id} has no gestures - gesture matching disabled (cursor still works)")
                                            try:
                                                await websocket.send_text(json.dumps({
                                                    "status": "disabled",
                                                    "reason": "no_gestures",
                                                    "message": "No gestures recorded",
                                                    "gesture_count": 0
                                                }))
                                            except Exception as send_error:
                                                logger.error(f"Failed to send auth status to client {client_id}: {send_error}")
                                            gesture_matching_enabled = False
                                        else:
                                            # User has gestures - enable gesture matching
                                            logger.info(f"✅ User {user_id} has {gesture_count} gesture(s) - enabling gesture matching")
                                            try:
                                                await websocket.send_text(json.dumps({
                                                    "status": "enabled",
                                                    "reason": "ready",
                                                    "message": "Gesture matching enabled",
                                                    "gesture_count": gesture_count
                                                }))
                                            except Exception as send_error:
                                                logger.error(f"Failed to send auth status to client {client_id}: {send_error}")
                                            gesture_matching_enabled = True
                                    finally:
                                        db.close()

                    except Exception as e:
                        logger.error(f"Error checking authentication: {e}")
                        try:
                            await websocket.send_text(json.dumps({
                                "status": "disabled",
                                "reason": "error",
                                "message": f"Authentication check failed: {str(e)}"
                            }))
                        except Exception as send_error:
                            logger.error(f"Failed to send error status to client {client_id}: {send_error}")
                        gesture_matching_enabled = False

                # ALWAYS initialize hybrid controller (for cursor control)
                # Gesture matching will be conditionally enabled based on authentication
                hybrid_controller = get_hybrid_mode_controller()

                # Register authentication check callback (SECURITY FIX)
                # Use closure to capture gesture_matching_enabled value
                def auth_check_callback():
                    """
                    Check if user is authenticated AND has gestures to match.
                    Called by state machine BEFORE starting frame collection.

                    Returns the gesture_matching_enabled flag determined at connection time.
                    """
                    return gesture_matching_enabled

                # Register the auth check callback
                hybrid_controller.state_machine.set_auth_check_callback(auth_check_callback)

                # Register gesture matching callback (PHASE 3 FIX)
                def gesture_match_callback(frames):
                    """
                    Callback for gesture matching during hybrid mode.
                    Called by state machine when 60 frames are collected.

                    SECURITY: Requires user authentication via token file.
                    """
                    try:
                        # Read token from file (same method as Electron overlay)
                        import os
                        token_path = os.path.join(os.path.expanduser("~"), ".airclick-token")

                        if not os.path.exists(token_path):
                            logger.warning("❌ No auth token found - gesture matching disabled")
                            return {"matched": False, "reason": "Authentication required", "authenticated": False}

                        try:
                            with open(token_path, 'r') as f:
                                token = f.read().strip()
                        except Exception as e:
                            logger.error(f"Failed to read token file: {e}")
                            return {"matched": False, "reason": "Authentication error", "authenticated": False}

                        if not token:
                            logger.warning("❌ Empty token - gesture matching disabled")
                            return {"matched": False, "reason": "Invalid token", "authenticated": False}

                        # Validate token and get user
                        from app.core.security import decode_access_token
                        from app.models.user import User

                        try:
                            payload = decode_access_token(token)
                            if not payload:
                                logger.warning("❌ Invalid or expired token")
                                return {"matched": False, "reason": "Invalid token", "authenticated": False}

                            # JWT tokens use "sub" for user ID
                            user_id = payload.get("sub") or payload.get("user_id")
                            if not user_id:
                                logger.warning("❌ Invalid token payload - no user_id")
                                return {"matched": False, "reason": "Invalid token", "authenticated": False}

                        except Exception as e:
                            logger.warning(f"❌ Token validation failed: {e}")
                            return {"matched": False, "reason": "Invalid or expired token", "authenticated": False}

                        logger.info(f"✅ User authenticated: user_id={user_id}")

                        db = SessionLocal()
                        try:
                            # Import here to avoid circular dependency
                            from app.models.gesture import Gesture

                            # Get ONLY the authenticated user's gestures (SECURITY FIX)
                            gestures = db.query(Gesture).filter(Gesture.user_id == user_id).all()

                            if not gestures:
                                logger.warning("No gestures found for matching")
                                return {"matched": False, "reason": "No gestures in database"}

                            # Convert to list format for matcher
                            gestures_list = []
                            for g in gestures:
                                gesture_dict = {
                                    'id': g.id,
                                    'name': g.name,
                                    'landmark_data': g.landmark_data  # Should contain 'frames' key
                                }
                                gestures_list.append(gesture_dict)

                            # Match gesture
                            matcher = get_gesture_matcher()
                            result = matcher.match_gesture(frames, gestures_list)

                            # Result is Optional[Tuple[Dict, float]]
                            if result:
                                matched_gesture, similarity = result
                                logger.info(f"✅ Gesture matched: {matched_gesture['name']} (similarity: {similarity:.1%})")
                                return {
                                    "matched": True,
                                    "gesture_name": matched_gesture['name'],
                                    "gesture_id": matched_gesture.get('id'),
                                    "similarity": similarity
                                }
                            else:
                                logger.debug("No gesture match found")
                                return {"matched": False, "similarity": 0.0}

                        finally:
                            db.close()

                    except Exception as e:
                        logger.error(f"Gesture match callback error: {e}")
                        return {"matched": False, "error": str(e)}

                # Register the callback
                hybrid_controller.set_gesture_match_callback(gesture_match_callback)
                hybrid_controller.enable_hybrid_mode()
                logger.info(f"✅ Hybrid mode ENABLED for client {client_id} with gesture matching")

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
                    try:
                        await websocket.send_text(json_data)
                    except Exception as send_error:
                        logger.error(f"Failed to send frame data to client {client_id}: {send_error}")
                        # Break the loop to exit gracefully if we can't send
                        break

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
