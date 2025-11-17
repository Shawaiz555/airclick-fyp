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
from app.services.hybrid_state_machine import HybridState

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

        # Initialize MediaPipe immediately at startup
        logger.info("🔧 Loading MediaPipe Hands model...")
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
        logger.info("✅ MediaPipe Hands loaded successfully")

        # Store camera index
        self.camera_index = camera_index
        self.cap = None

        # Store connected WebSocket clients
        self.clients: Set[WebSocket] = set()

        # Service running flag
        self.is_running = False

        # OPTIMIZATION: Pre-warm camera on startup for instant availability
        logger.info("🔥 Pre-warming camera for instant availability...")
        try:
            self._open_camera()
            # Warm-up: Capture and discard a few frames to stabilize camera
            for i in range(5):
                if self.cap and self.cap.isOpened():
                    ret, _ = self.cap.read()
                    if not ret:
                        logger.warning(f"Failed to read warm-up frame {i+1}/5")
            logger.info("✅ Camera pre-warmed and ready")
        except Exception as e:
            logger.warning(f"⚠️ Camera pre-warming failed (will retry on connect): {e}")
            self.cap = None

        logger.info("✓ Hand Tracking Service initialized")

    def _open_camera(self):
        """Open the camera if not already open."""
        if self.cap is not None and self.cap.isOpened():
            return  # Camera already open

        logger.info(f"📹 Opening camera {self.camera_index}...")
        self.cap = cv2.VideoCapture(self.camera_index, cv2.CAP_DSHOW)  # DirectShow on Windows for faster init

        # Set camera properties for optimal performance
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        self.cap.set(cv2.CAP_PROP_FPS, 30)

        # OPTIMIZATION: Reduce buffer size for lower latency
        self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)  # Minimize frame buffering

        # Check if camera opened successfully
        if not self.cap.isOpened():
            logger.error("❌ Failed to open camera!")
            self.cap = None
            raise RuntimeError("Camera not accessible")

        logger.info("✅ Camera opened successfully")


    def _close_camera(self):
        """Close the camera if open."""
        if self.cap is not None:
            logger.info("📹 Closing camera...")
            self.cap.release()
            self.cap = None
            logger.info("✅ Camera closed")


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
        # Check if camera is open
        if self.cap is None or not self.cap.isOpened():
            logger.warning("Camera not open - cannot process frame")
            return None

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
        logger.info("="*80)
        logger.info("🎬 handle_client() CALLED")
        logger.info(f"   hybrid_mode={hybrid_mode}")
        logger.info("="*80)

        # Accept the WebSocket connection
        logger.info("📞 About to call websocket.accept()...")
        await websocket.accept()
        logger.info("✅ websocket.accept() completed")

        # Register new client
        self.clients.add(websocket)
        client_id = id(websocket)
        logger.info(f"✓ New client connected: {client_id} (hybrid_mode={hybrid_mode})")
        logger.info(f"✓ Total clients: {len(self.clients)}")

        # Ensure camera is open (should already be pre-warmed at startup)
        if not self.cap or not self.cap.isOpened():
            logger.warning("Camera not pre-warmed, opening now...")
            try:
                self._open_camera()
            except Exception as e:
                logger.error(f"Failed to open camera: {e}")
                self.clients.discard(websocket)
                await websocket.close(code=1011, reason="Camera initialization failed")
                return

        # OPTIMIZATION: Send initial frame IMMEDIATELY before heavy auth check
        # This makes the UI feel instant while auth happens in background
        try:
            initial_frame = self.process_frame()
            if initial_frame:
                await websocket.send_text(json.dumps(initial_frame))
                logger.info(f"⚡ Sent initial frame immediately to client {client_id}")
        except Exception as e:
            logger.warning(f"Could not send initial frame: {e}")

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

                # Register authentication check callback (SECURITY FIX + RECORDING STATE FIX)
                # Use closure to capture gesture_matching_enabled value
                auth_block_logged = False  # Track if we've already logged the block reason

                def auth_check_callback():
                    """
                    Check if user is authenticated AND has gestures to match AND not recording.
                    Called by state machine BEFORE starting frame collection.

                    Returns False if:
                    - User is not authenticated
                    - User has no gestures
                    - User is currently recording/updating a gesture (to avoid interference)
                    """
                    nonlocal auth_block_logged

                    # CRITICAL: Check if user is recording a gesture FIRST
                    import os
                    recording_state_path = os.path.join(os.path.expanduser("~"), ".airclick-recording")

                    try:
                        if os.path.exists(recording_state_path):
                            with open(recording_state_path, 'r') as f:
                                is_recording = f.read().strip() == "true"

                            if is_recording:
                                if not auth_block_logged:
                                    logger.warning("⚠️ BLOCKING gesture matching - User is recording/updating a gesture")
                                    auth_block_logged = True
                                return False
                    except Exception as e:
                        logger.error(f"Failed to check recording state: {e}")

                    # Then check authentication
                    if not gesture_matching_enabled:
                        if not auth_block_logged:
                            logger.warning(f"⚠️ BLOCKING gesture matching - gesture_matching_enabled={gesture_matching_enabled}")
                            logger.info("💡 TIP: Log in to the web app to enable gesture matching")
                            auth_block_logged = True
                        return False

                    # Reset flag when authentication succeeds
                    if auth_block_logged:
                        logger.info("✅ Gesture matching ALLOWED - Starting frame collection")
                        auth_block_logged = False
                    return True

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
                                    'action': g.action,  # Include action for execution
                                    'app_context': g.app_context,  # Include app context
                                    'landmark_data': g.landmark_data  # Should contain 'frames' key
                                }
                                gestures_list.append(gesture_dict)

                            # Match gesture
                            matcher = get_gesture_matcher()
                            result = matcher.match_gesture(frames, gestures_list)

                            # Result is Optional[Tuple[Dict, float]]
                            if result:
                                matched_gesture, similarity = result

                                # CRITICAL FIX: Log match result FIRST, before action execution
                                logger.info(f"")
                                logger.info(f"{'='*60}")
                                logger.info(f"✅ GESTURE MATCHED: {matched_gesture['name']}")
                                logger.info(f"   Similarity: {similarity:.1%}")
                                logger.info(f"   Gesture ID: {matched_gesture.get('id')}")
                                logger.info(f"{'='*60}")

                                # Get action details
                                gesture_action = matched_gesture.get('action')
                                gesture_app_context = matched_gesture.get('app_context')

                                # Update gesture stats in database BEFORE action execution
                                try:
                                    gesture_record = db.query(Gesture).filter(Gesture.id == matched_gesture.get('id')).first()
                                    if gesture_record:
                                        gesture_record.total_similarity = (gesture_record.total_similarity or 0.0) + similarity
                                        gesture_record.match_count = (gesture_record.match_count or 0) + 1
                                        gesture_record.accuracy_score = gesture_record.total_similarity / gesture_record.match_count
                                        db.commit()
                                        logger.debug(f"📊 Updated gesture stats: match_count={gesture_record.match_count}, accuracy={gesture_record.accuracy_score:.1%}")
                                except Exception as e:
                                    logger.warning(f"Failed to update gesture stats: {e}")
                                    db.rollback()

                                # Execute action AFTER logging match result
                                if gesture_action:
                                    logger.info(f"")
                                    logger.info(f"🎬 Executing action: {gesture_action}")
                                    logger.info(f"   App context: {gesture_app_context}")
                                    logger.info(f"   Gesture: '{matched_gesture['name']}'")

                                    # Import action executor
                                    from app.services.action_executor import get_action_executor

                                    # Execute the action
                                    executor = get_action_executor()
                                    action_result = executor.execute_action(
                                        gesture_action,
                                        gesture_app_context
                                    )

                                    if action_result.get("success"):
                                        logger.info(f"✅ Action executed successfully: {gesture_action}")
                                        logger.info(f"   Action name: {action_result.get('action_name')}")
                                        logger.info(f"   Keyboard shortcut: {action_result.get('keyboard_shortcut')}")
                                        if action_result.get('window_switched'):
                                            logger.info(f"   Window switched to: {action_result.get('window_title')}")
                                    else:
                                        logger.error(f"❌ Action execution failed: {action_result.get('error')}")
                                        if action_result.get('app_not_found'):
                                            logger.error(f"   ⚠️ {gesture_app_context} application is not running!")

                                    return {
                                        "matched": True,
                                        "gesture_name": matched_gesture['name'],
                                        "gesture_id": matched_gesture.get('id'),
                                        "similarity": similarity,
                                        "action": gesture_action,
                                        "action_executed": action_result.get("success", False),
                                        "action_result": action_result
                                    }
                                else:
                                    logger.warning(f"⚠️ Gesture '{matched_gesture['name']}' has no action assigned")
                                    return {
                                        "matched": True,
                                        "gesture_name": matched_gesture['name'],
                                        "gesture_id": matched_gesture.get('id'),
                                        "similarity": similarity,
                                        "action": None,
                                        "action_executed": False,
                                        "error": "No action assigned to gesture"
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
                            # CRITICAL FIX: Add gesture_matching_enabled status to state machine metadata
                            if 'state_machine' in hybrid_result:
                                hybrid_result['state_machine']['gesture_matching_enabled'] = gesture_matching_enabled
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
                else:
                    # No hands detected - IMPORTANT: Notify state machine to trigger matching if collecting
                    if hybrid_mode and hybrid_controller:
                        try:
                            # LOG: Track no-hand detection during collection
                            current_state = hybrid_controller.state_machine.state
                            if current_state == HybridState.COLLECTING:
                                logger.info(f"🚫 NO HAND detected while COLLECTING ({len(hybrid_controller.state_machine.collected_frames)} frames collected)")

                            # Process "no hand" frame to allow state machine to finish collection
                            # CRITICAL FIX: State machine now handles IDLE transition internally
                            no_hand_result = hybrid_controller.state_machine.handle_no_hand_detected(
                                match_callback=hybrid_controller.gesture_match_callback
                            )

                            # Log match result if triggered
                            if no_hand_result.get('trigger') == 'hand_removed':
                                logger.info(f"🎯 Gesture match result: {no_hand_result.get('match_result')}")

                            # IMPORTANT: Get the full state machine info including match_result in IDLE state
                            # This ensures the overlay receives the match result even when hand is gone
                            state_machine_info = hybrid_controller.state_machine.get_state_info()
                            # CRITICAL FIX: Add gesture_matching_enabled status
                            state_machine_info['gesture_matching_enabled'] = gesture_matching_enabled

                            # Send no hand status to client with match result if available
                            no_hand_data = {
                                'timestamp': datetime.now().isoformat(),
                                'hands': [],
                                'hand_count': 0,
                                'frame_size': {'width': 640, 'height': 480},
                                'hybrid': {
                                    'success': False,
                                    'error': 'No hands detected',
                                    'state_machine': state_machine_info,  # Send full state info including match_result
                                    'hybrid_mode_enabled': True
                                }
                            }

                            json_data = json.dumps(no_hand_data)
                            try:
                                await websocket.send_text(json_data)
                            except Exception as send_error:
                                logger.error(f"Failed to send no-hand frame to client {client_id}: {send_error}")
                                break
                        except Exception as e:
                            logger.error(f"Error handling no hand detection: {e}")

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
            logger.info(f"✓ Client disconnected - remaining clients: {len(self.clients)}")

            # IMPORTANT: Keep camera open even when all clients disconnect
            # Camera will only close on backend shutdown or explicit cleanup
            # This prevents reopening delays when switching between home page and Electron overlay
            if len(self.clients) == 0:
                logger.info("📹 All clients disconnected - keeping camera open for quick reconnection")
                logger.info("💡 Camera will remain open until backend shutdown")


    def cleanup(self):
        """
        Clean up resources before shutdown.

        This method releases the camera and closes MediaPipe resources.
        """
        logger.info("🧹 Cleaning up Hand Tracking Service resources...")

        # Close camera using helper method
        self._close_camera()

        # Close MediaPipe hands
        if self.hands:
            self.hands.close()
            logger.info("✅ MediaPipe closed")

        logger.info("✅ Cleanup complete")


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
