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
        # CRITICAL: max_num_hands=1 to prevent two-hand detection issues
        self.hands = self.mp_hands.Hands(
            static_image_mode=False,
            max_num_hands=1,  # FIXED: Only detect ONE hand to avoid confusion
            min_detection_confidence=0.8,
            min_tracking_confidence=0.8
        )
        logger.info("✅ MediaPipe Hands loaded successfully (single-hand mode)")

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

        # Flip horizontally so the image is a mirror of what the user sees.
        # Without this, MediaPipe labels the user's left hand as "Right" and
        # vice-versa, and x-coordinates are inverted (left side of screen → x≈0.8).
        frame = cv2.flip(frame, 1)

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
            - hand_count: Number of hands detected
            - too_many_hands: Boolean flag if >1 hand detected
            - frame_size: Original frame dimensions
        """
        hands_data = []
        hand_count = len(results.multi_hand_landmarks) if results.multi_hand_landmarks else 0

        # NOTE: With max_num_hands=1, we will never detect >1 hand
        # This is the intended behavior to prevent confusion

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

            # CRITICAL FIX: Ignore hands with low detection confidence to prevent "ghost" hands
            # handedness.score is the detection confidence for this hand
            if handedness.score < 0.8:
                logger.debug(f"⚠️ Ignoring low-confidence hand: {handedness.score:.2f}")
                continue

            # Create hand data object
            hand_data = {
                'handedness': handedness.label,
                'confidence': handedness.score,
                'landmarks': landmarks,
                'landmark_count': len(landmarks)
            }

            hands_data.append(hand_data)

        # Re-update hand_count after filtering
        hand_count = len(hands_data)

        # Return complete data package
        return {
            'timestamp': datetime.now().isoformat(),
            'hands': hands_data,
            'hand_count': hand_count,
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
                                    # Check user role and gesture count
                                    db = SessionLocal()
                                    try:
                                        from app.models.user import User
                                        user = db.query(User).filter(User.id == user_id).first()

                                        # Admin accounts cannot perform gestures
                                        if user and user.role == "ADMIN":
                                            logger.warning(f"⚠️ Admin account {user_id} - gesture matching disabled")
                                            try:
                                                await websocket.send_text(json.dumps({
                                                    "status": "disabled",
                                                    "reason": "admin_account",
                                                    "message": "Admin accounts cannot perform gestures",
                                                    "gesture_count": 0
                                                }))
                                            except Exception as send_error:
                                                logger.error(f"Failed to send auth status to client {client_id}: {send_error}")
                                            gesture_matching_enabled = False
                                        else:
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
                    Check if user is recording AND if authentication is required for current mode.
                    Called by state machine BEFORE starting frame collection.

                    Returns False if:
                    - User is currently recording/updating a gesture (always block to avoid interference)
                    - Hybrid mode is ON AND user is not authenticated (cursor control requires clean workflow)

                    CRITICAL FIX: When hybrid mode is OFF, authentication is NOT enforced for gesture collection.
                    The user can still collect and match gestures even without logging in (if they have gestures).
                    The gesture_match_callback will handle the actual authentication check during matching.
                    """
                    nonlocal auth_block_logged

                    # CRITICAL: Check if user is recording a gesture FIRST
                    # ALWAYS block gesture collection when recording (regardless of hybrid mode)
                    import os
                    recording_state_path = os.path.join(os.path.expanduser("~"), ".airclick-recording")

                    try:
                        if os.path.exists(recording_state_path):
                            with open(recording_state_path, 'r') as f:
                                is_recording = f.read().strip() == "true"

                            if is_recording:
                                if not auth_block_logged:
                                    logger.warning("⚠️ BLOCKING gesture collection - User is recording/updating a gesture")
                                    auth_block_logged = True
                                return False
                    except Exception as e:
                        logger.error(f"Failed to check recording state: {e}")

                    # HYBRID MODE CHECK: Only enforce authentication when cursor control is active
                    # When hybrid mode is ON: Cursor control + gesture recognition work together,
                    #                         so we need clean authenticated workflow
                    # When hybrid mode is OFF: Only gesture recognition is active,
                    #                          so allow collection to proceed (matching will check auth)
                    if hybrid_controller.hybrid_mode_enabled:
                        # Hybrid mode ON - enforce authentication for clean cursor+gesture workflow
                        if not gesture_matching_enabled:
                            if not auth_block_logged:
                                logger.warning(f"⚠️ BLOCKING gesture collection - Hybrid mode ON requires authentication")
                                logger.info("💡 TIP: Log in to the web app to enable gesture matching")
                                auth_block_logged = True
                            return False
                    else:
                        # Hybrid mode OFF - allow gesture collection without strict auth enforcement
                        # The gesture_match_callback will handle authentication during actual matching
                        if auth_block_logged and not gesture_matching_enabled:
                            logger.info("✅ Gesture collection ALLOWED - Hybrid mode OFF (cursor disabled, gesture-only mode)")
                            logger.info("   Note: Gesture matching still requires authentication")
                            auth_block_logged = False

                    # Reset flag when authentication succeeds (hybrid mode ON + authenticated)
                    if auth_block_logged:
                        logger.info("✅ Gesture collection ALLOWED - Authentication successful")
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
                            from app.models.gesture import Gesture
                            from app.services.gesture_store import get_user_gestures, load_user_gestures
                            import time as perf_time

                            # Use in-memory store (loaded at login) — falls back to DB if not cached
                            load_start = perf_time.time()
                            gestures_list = get_user_gestures(user_id)

                            if gestures_list is None:
                                # Not in store yet — load from DB and cache for next time
                                logger.info(f"📊 GestureStore miss for user {user_id} — loading from DB")
                                load_user_gestures(user_id, db)
                                gestures_list = get_user_gestures(user_id)

                            load_time = (perf_time.time() - load_start) * 1000
                            logger.info(f"📊 Gestures loaded in {load_time:.1f}ms ({len(gestures_list)} gestures, from {'cache' if load_time < 2 else 'DB'})")

                            if not gestures_list:
                                logger.warning("No gestures found for matching")
                                return {"matched": False, "reason": "No gestures in database"}

                            # CONTEXT FILTERING: Read active context from file
                            active_context = "ALL"
                            context_path = os.path.join(os.path.expanduser("~"), ".airclick-context")
                            if os.path.exists(context_path):
                                try:
                                    with open(context_path, 'r') as f:
                                        active_context = f.read().strip().upper()
                                    logger.info(f"🎯 Active context: {active_context}")
                                except Exception as e:
                                    logger.warning(f"Failed to read context file: {e}, using ALL")
                                    active_context = "ALL"
                            else:
                                logger.info(f"🎯 Active context: ALL (file not found)")

                            # Match gesture - CRITICAL: Use return_best_candidate=True for false trigger tracking
                            matcher = get_gesture_matcher()

                            # PHASE 1 OPTIMIZATION: Track matching performance
                            match_start = perf_time.time()
                            result = matcher.match_gesture(
                                frames,
                                gestures_list,
                                user_id=user_id,
                                return_best_candidate=True  # Get best match even if below threshold
                            )
                            match_time = (perf_time.time() - match_start) * 1000
                            logger.info(f"📊 Gesture matching completed in {match_time:.1f}ms")

                            # Result is Optional[Tuple[Dict, float]]
                            if result:
                                matched_gesture, similarity = result

                                # Get gesture-specific threshold
                                gesture_threshold = matched_gesture.get('adaptive_threshold', matcher.similarity_threshold)
                                is_true_match = similarity >= gesture_threshold

                                if is_true_match:
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

                                    # CONTEXT FILTERING: Check if matched gesture context matches active context
                                    context_mismatch = False
                                    if active_context != "ALL" and gesture_app_context != active_context:
                                        context_mismatch = True
                                        logger.warning(f"")
                                        logger.warning(f"⚠️ CONTEXT MISMATCH DETECTED!")
                                        logger.warning(f"   Gesture context: {gesture_app_context}")
                                        logger.warning(f"   Active context: {active_context}")
                                        logger.warning(f"   Action will NOT be executed")
                                        logger.warning(f"")

                                    # PHASE 1 OPTIMIZATION: Fast database update using raw SQL
                                    # Only update stats if context matches (don't count context mismatches as successful matches)
                                    if not context_mismatch:
                                        try:
                                            from sqlalchemy import text
                                            gesture_id = matched_gesture.get('id')

                                            # Use raw SQL for faster update (bypasses ORM overhead)
                                            update_query = text("""
                                                UPDATE gestures
                                                SET total_similarity = COALESCE(total_similarity, 0) + :similarity,
                                                    match_count = COALESCE(match_count, 0) + 1,
                                                    accuracy_score = (COALESCE(total_similarity, 0) + :similarity) / (COALESCE(match_count, 0) + 1),
                                                    updated_at = NOW()
                                                WHERE id = :gesture_id
                                            """)

                                            db.execute(update_query, {"similarity": similarity, "gesture_id": gesture_id})
                                            db.commit()
                                            logger.debug(f"📊 Updated gesture stats (fast SQL) for gesture_id={gesture_id}")
                                        except Exception as e:
                                            logger.warning(f"Failed to update gesture stats: {e}")
                                            db.rollback()

                                    # Execute action ONLY if context matches
                                    if gesture_action and not context_mismatch:
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
                                            "action_result": action_result,
                                            "context_mismatch": False,
                                            "gesture_context": gesture_app_context,
                                            "active_context": active_context
                                        }
                                    elif context_mismatch:
                                        # Context mismatch - gesture matched but wrong context
                                        return {
                                            "matched": True,
                                            "gesture_name": matched_gesture['name'],
                                            "gesture_id": matched_gesture.get('id'),
                                            "similarity": similarity,
                                            "action": gesture_action,
                                            "action_executed": False,
                                            "context_mismatch": True,
                                            "gesture_context": gesture_app_context,
                                            "active_context": active_context,
                                            "error": f"Gesture is from {gesture_app_context} context, currently in {active_context} context"
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
                                            "error": "No action assigned to gesture",
                                            "context_mismatch": False,
                                            "gesture_context": gesture_app_context,
                                            "active_context": active_context
                                        }
                                else:
                                    # FALSE TRIGGER: Similarity below threshold
                                    # CRITICAL FIX: Track false triggers for analytics
                                    logger.info(f"")
                                    logger.info(f"{'='*60}")
                                    logger.info(f"⚠️ FALSE TRIGGER DETECTED")
                                    logger.info(f"   Closest gesture: {matched_gesture['name']}")
                                    logger.info(f"   Similarity: {similarity:.1%}")
                                    logger.info(f"   Threshold: {gesture_threshold:.1%}")
                                    logger.info(f"   Delta: {(gesture_threshold - similarity):.1%}")
                                    logger.info(f"{'='*60}")

                                    # PHASE 1 OPTIMIZATION: Fast database update using raw SQL
                                    try:
                                        from sqlalchemy import text
                                        gesture_id = matched_gesture.get('id')

                                        # Use raw SQL for faster update
                                        update_query = text("""
                                            UPDATE gestures
                                            SET false_trigger_count = COALESCE(false_trigger_count, 0) + 1,
                                                updated_at = NOW()
                                            WHERE id = :gesture_id
                                        """)

                                        db.execute(update_query, {"gesture_id": gesture_id})
                                        db.commit()
                                        logger.debug(f"📊 False trigger count updated (fast SQL) for gesture_id={gesture_id}")
                                    except Exception as e:
                                        logger.warning(f"Failed to update false trigger count: {e}")
                                        db.rollback()

                                    return {
                                        "matched": False,
                                        "false_trigger": True,
                                        "closest_gesture": matched_gesture['name'],
                                        "gesture_id": matched_gesture.get('id'),
                                        "similarity": similarity,
                                        "threshold": gesture_threshold,
                                        "reason": f"Similarity {similarity:.1%} below threshold {gesture_threshold:.1%}"
                                    }
                            else:
                                logger.debug("No gesture match found (no candidates)")
                                return {"matched": False, "similarity": 0.0}

                        finally:
                            db.close()

                    except Exception as e:
                        logger.error(f"Gesture match callback error: {e}")
                        return {"matched": False, "error": str(e)}

                # Register the callback
                hybrid_controller.set_gesture_match_callback(gesture_match_callback)

                # CRITICAL FIX: Read hybrid mode preference from file
                # User can toggle hybrid mode ON/OFF from the frontend
                # When OFF: Disable cursor control, but keep gesture recognition and state machine working
                # When ON: Enable cursor control + gesture recognition
                hybrid_mode_preference = True  # Default to True
                hybrid_mode_file = os.path.join(os.path.expanduser("~"), ".airclick-hybridmode")

                if os.path.exists(hybrid_mode_file):
                    try:
                        with open(hybrid_mode_file, 'r') as f:
                            hybrid_mode_value = f.read().strip().lower()
                            hybrid_mode_preference = hybrid_mode_value == 'true'
                            logger.info(f"📖 Read hybrid mode preference from file: {hybrid_mode_preference}")
                    except Exception as e:
                        logger.warning(f"Failed to read hybrid mode file: {e}, using default: True")
                        hybrid_mode_preference = True
                else:
                    logger.info(f"📄 Hybrid mode file does not exist, using default: True")
                    hybrid_mode_preference = True

                # Enable/disable hybrid mode based on user preference
                if hybrid_mode_preference:
                    hybrid_controller.enable_hybrid_mode()
                    logger.info(f"✅ Hybrid mode ENABLED for client {client_id} (cursor control ON)")
                else:
                    hybrid_controller.disable_hybrid_mode()
                    logger.info(f"⚠️ Hybrid mode DISABLED for client {client_id} (cursor control OFF, gesture recognition still active)")

            except Exception as e:
                logger.error(f"Failed to initialize hybrid mode: {e}")
                hybrid_mode = False

        try:
            # FPS and latency tracking
            import time
            frame_times = []
            last_frame_time = time.time()

            # Hybrid mode preference tracking
            last_hybrid_check_time = time.time()
            hybrid_check_interval = 5.0  # Check hybrid mode preference every 5 seconds (reduced from 1s to prevent rapid toggling)

            # Keep connection alive and send data
            while True:
                # DYNAMIC HYBRID MODE CHECK: Periodically check if user toggled hybrid mode
                current_time = time.time()
                if hybrid_mode and hybrid_controller and (current_time - last_hybrid_check_time) >= hybrid_check_interval:
                    last_hybrid_check_time = current_time

                    # Read current hybrid mode preference from file
                    hybrid_mode_file = os.path.join(os.path.expanduser("~"), ".airclick-hybridmode")
                    current_hybrid_preference = True  # Default

                    if os.path.exists(hybrid_mode_file):
                        try:
                            with open(hybrid_mode_file, 'r') as f:
                                hybrid_mode_value = f.read().strip().lower()
                                current_hybrid_preference = hybrid_mode_value == 'true'
                        except Exception as e:
                            logger.warning(f"Failed to read hybrid mode file: {e}")
                            current_hybrid_preference = True

                    # Check if preference changed
                    if current_hybrid_preference != hybrid_controller.hybrid_mode_enabled:
                        if current_hybrid_preference:
                            hybrid_controller.enable_hybrid_mode()
                            logger.info(f"🔄 Hybrid mode dynamically ENABLED (cursor control ON)")
                        else:
                            hybrid_controller.disable_hybrid_mode()
                            logger.info(f"🔄 Hybrid mode dynamically DISABLED (cursor control OFF)")

                # Track frame start time for latency calculation
                frame_start = time.time()

                # Process frame and get hand data
                hand_data = self.process_frame()

                # Calculate processing latency
                processing_latency = int((time.time() - frame_start) * 1000)  # Convert to ms

                if hand_data:
                    # Calculate FPS (based on last 10 frames)
                    current_time = time.time()
                    frame_times.append(current_time)
                    if len(frame_times) > 10:
                        frame_times.pop(0)

                    # Calculate FPS from frame times
                    if len(frame_times) >= 2:
                        time_diff = frame_times[-1] - frame_times[0]
                        fps = int((len(frame_times) - 1) / time_diff) if time_diff > 0 else 0
                    else:
                        fps = 0

                    # Add performance metrics to hand_data
                    hand_data['fps'] = fps
                    hand_data['latency'] = processing_latency

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
                            current_state = hybrid_controller.state_machine.state

                            if current_state == HybridState.COLLECTING:
                                logger.info(f"🚫 NO HAND detected while COLLECTING ({len(hybrid_controller.state_machine.collected_frames)} frames collected)")
                                # Non-blocking: transition to MATCHING and kick off match in background thread
                                frames_to_match = hybrid_controller.state_machine.start_matching_non_blocking()
                                if frames_to_match and hybrid_controller.gesture_match_callback:
                                    callback = hybrid_controller.gesture_match_callback
                                    state_machine = hybrid_controller.state_machine

                                    def run_match():
                                        try:
                                            result = callback(frames_to_match)
                                            logger.info(f"🎯 Gesture match result: {result}")
                                        except Exception as e:
                                            logger.error(f"❌ Match callback error: {e}")
                                            result = {"matched": False, "error": str(e)}
                                        state_machine.finish_matching(result)

                                    loop = asyncio.get_event_loop()
                                    loop.run_in_executor(None, run_match)

                            # Send current state (MATCHING or other) to client immediately
                            state_machine_info = hybrid_controller.state_machine.get_state_info()
                            state_machine_info['gesture_matching_enabled'] = gesture_matching_enabled

                            no_hand_data = {
                                'timestamp': datetime.now().isoformat(),
                                'hands': [],
                                'hand_count': 0,
                                'frame_size': {'width': 640, 'height': 480},
                                'hybrid': {
                                    'success': False,
                                    'error': 'No hands detected',
                                    'state_machine': state_machine_info,
                                    'hybrid_mode_enabled': hybrid_controller.hybrid_mode_enabled,
                                    'cursor_enabled': False
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

                # Fix 2: yield to event loop without artificial delay — the camera's
                # own 30 FPS capture rate limits throughput; sleeping 33ms on top of
                # capture + inference was capping effective FPS to ~17.
                await asyncio.sleep(0)

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
