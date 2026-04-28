/**
 * AirClick - Gesture Recorder with WebSocket MediaPipe Integration
 * =================================================================
 *
 * This component allows users to record custom gestures by connecting to
 * the Python MediaPipe backend via WebSocket. It receives real-time hand
 * landmarks and saves them to the FastAPI backend database.
 *
 * Flow:
 * 1. Connect to FastAPI WebSocket (ws://localhost:8000/ws/hand-tracking)
 * 2. Receive hand landmarks in real-time
 * 3. Draw hand skeleton on canvas
 * 4. Record frames when user clicks "Start Recording"
 * 5. Save to FastAPI backend when user clicks "Save"
 *
 * Author: Muhammad Shawaiz
 * Project: AirClick FYP
 */

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * MediaPipe Hand Connections - defines hand skeleton structure
 * Each array defines connections between landmark points
 */
const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],           // Thumb
  [0, 5], [5, 6], [6, 7], [7, 8],           // Index finger
  [0, 9], [9, 10], [10, 11], [11, 12],      // Middle finger
  [0, 13], [13, 14], [14, 15], [15, 16],    // Ring finger
  [0, 17], [17, 18], [18, 19], [19, 20],    // Pinky finger
  [5, 9], [9, 13], [13, 17]                 // Palm connections
];

/**
 * Application contexts for gestures
 */
const APP_CONTEXTS = [
  { id: 'GLOBAL', name: 'Global (All Apps)' },
  { id: 'POWERPOINT', name: 'PowerPoint' },
  { id: 'WORD', name: 'MS Word' },
];

// Actions will be fetched from API dynamically

export default function GestureRecorderReal({ onSave, onClose, editingGesture = null }) {
  // ==================== STATE MANAGEMENT ====================

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordedFrames, setRecordedFrames] = useState([]);

  // Form state
  const [gestureName, setGestureName] = useState(editingGesture?.name || '');
  const [selectedContext, setSelectedContext] = useState(editingGesture?.app_context || 'GLOBAL');
  const [selectedAction, setSelectedAction] = useState(editingGesture?.action || '');
  const [availableActions, setAvailableActions] = useState([]);
  const [isEditMode] = useState(!!editingGesture); // Track if we're editing
  const [isLoadingActions, setIsLoadingActions] = useState(false);

  // UI state
  const [isProcessing, setIsProcessing] = useState(false);
  const [validationMessage, setValidationMessage] = useState('');

  // WebSocket state
  const [isConnected, setIsConnected] = useState(false);
  const [handDetected, setHandDetected] = useState(false);

  // Hand readiness state (orientation + stability)
  const [handFacingCamera, setHandFacingCamera] = useState(false);
  const [handStable, setHandStable] = useState(false);
  const [postureHint, setPostureHint] = useState('');

  // ==================== REFS ====================

  const wsRef = useRef(null);                    // WebSocket connection
  const canvasRef = useRef(null);                // Canvas for drawing
  const intervalRef = useRef(null);              // Recording timer
  const reconnectTimerRef = useRef(null);        // Auto-reconnect timer
  const isMountedRef = useRef(true);             // Track if component is mounted
  const isRecordingRef = useRef(false);          // Ref for recording state (fixes closure issue)
  const recentWristPositions = useRef([]);       // Rolling buffer for stability check (last 10 frames)
  const recentOrientations = useRef([]);         // Rolling buffer for orientation check (last 10 frames)
  const handFacingCameraRef = useRef(false);     // Mirror of handFacingCamera for WS callback
  const handStableRef = useRef(false);           // Mirror of handStable for WS callback

  // ==================== API FUNCTIONS ====================

  /**
   * Fetch available actions for the selected context from API
   * OPTIMIZATION: Use /available endpoint to exclude already assigned actions
   */
  const fetchActionsForContext = async (context) => {
    setIsLoadingActions(true);
    try {
      const token = localStorage.getItem('token');

      // Build URL with exclude_gesture_id for edit mode
      let url = `http://localhost:8000/api/action-mappings/context/${context}/available?active_only=true`;
      if (isEditMode && editingGesture?.id) {
        url += `&exclude_gesture_id=${editingGesture.id}`;
      }

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const actions = await response.json();
        // Format actions for dropdown: { id: action_id, name: "icon name" }
        const formattedActions = actions.map(action => ({
          id: action.action_id,
          name: action.icon ? `${action.icon} ${action.name}` : action.name,
          description: action.description
        }));

        setAvailableActions(formattedActions);

        // If no action is selected yet and actions are available, select the first one
        // In edit mode, keep the current action selected if available
        if (isEditMode && editingGesture?.action) {
          setSelectedAction(editingGesture.action);
        } else if (!selectedAction && formattedActions.length > 0) {
          setSelectedAction(formattedActions[0].id);
        }
      } else {
        console.error('Failed to fetch actions');
        setValidationMessage('Failed to load actions. Using offline mode.');
        // Keep empty array to show error state
        setAvailableActions([]);
      }
    } catch (error) {
      console.error('Error fetching actions:', error);
      setValidationMessage('Failed to connect to server. Please check backend.');
      setAvailableActions([]);
    } finally {
      setIsLoadingActions(false);
    }
  };

  // Load actions when component mounts or context changes
  useEffect(() => {
    fetchActionsForContext(selectedContext);
  }, [selectedContext]);

  // Sync isRecording state with ref (ensures ref always has current value)
  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  // ==================== DRAWING FUNCTIONS ====================

  /**
   * Draw hand skeleton on canvas
   * @param {Object} handData - Hand data from Python backend containing landmarks
   */
  const drawHand = useCallback((handData) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;

    // Draw each detected hand
    handData.hands.forEach((hand) => {
      const landmarks = hand.landmarks;

      // Color based on handedness: Right = Cyan, Left = Pink
      const handColor = hand.handedness === 'Right' ? '#00FFFF' : '#FF00FF';

      // Draw connections (bones) between landmarks
      ctx.strokeStyle = handColor;
      ctx.lineWidth = 2;

      HAND_CONNECTIONS.forEach(([startIdx, endIdx]) => {
        const start = landmarks[startIdx];
        const end = landmarks[endIdx];

        // Convert normalized coordinates (0-1) to pixel coordinates
        const startX = start.x * canvasWidth;
        const startY = start.y * canvasHeight;
        const endX = end.x * canvasWidth;
        const endY = end.y * canvasHeight;

        // Draw line
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
      });

      // Draw landmark points (joints)
      ctx.fillStyle = handColor;
      landmarks.forEach((landmark) => {
        const x = landmark.x * canvasWidth;
        const y = landmark.y * canvasHeight;

        // Draw circle for each landmark
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, 2 * Math.PI);
        ctx.fill();

        // White outline for better visibility
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1;
        ctx.stroke();
      });
    });
  }, []); // No dependencies needed

  // ==================== HAND READINESS HELPERS ====================

  /**
   * Compute palm-facing-camera score from one frame's landmarks.
   * Returns the palm normal Z component (negative = facing camera).
   */
  const getPalmNormalZ = (landmarks) => {
    if (!landmarks || landmarks.length < 18) return null;
    const wrist = landmarks[0];
    const indexMcp = landmarks[5];
    const pinkyMcp = landmarks[17];
    const v1 = [indexMcp.x - wrist.x, indexMcp.y - wrist.y, (indexMcp.z ?? 0) - (wrist.z ?? 0)];
    const v2 = [pinkyMcp.x - wrist.x, pinkyMcp.y - wrist.y, (pinkyMcp.z ?? 0) - (wrist.z ?? 0)];
    // Cross product
    const nx = v1[1] * v2[2] - v1[2] * v2[1];
    const ny = v1[2] * v2[0] - v1[0] * v2[2];
    const nz = v1[0] * v2[1] - v1[1] * v2[0];
    const mag = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (mag < 1e-6) return null;
    return nz / mag;
  };

  /**
   * Update orientation and stability state from fresh landmark data.
   * Called every WebSocket frame when a hand is detected.
   */
  const updateHandReadiness = useCallback((landmarks) => {
    const BUFFER_SIZE = 10;

    // --- Orientation ---
    const nz = getPalmNormalZ(landmarks);
    if (nz !== null) {
      const buf = recentOrientations.current;
      buf.push(nz);
      if (buf.length > BUFFER_SIZE) buf.shift();

      const avgNz = buf.reduce((a, b) => a + b, 0) / buf.length;
      // Relaxed threshold: negative = palm, near 0 = side, positive (> 0.4) = back
      const facing = buf.length >= 5 && avgNz < 0.4;
      handFacingCameraRef.current = facing;
      setHandFacingCamera(facing);
    }

    // --- Stability (wrist position variance) ---
    const wrist = landmarks[0];
    const posBuf = recentWristPositions.current;
    posBuf.push([wrist.x, wrist.y, wrist.z ?? 0]);
    if (posBuf.length > BUFFER_SIZE) posBuf.shift();

    if (posBuf.length >= 5) {
      const meanX = posBuf.reduce((a, p) => a + p[0], 0) / posBuf.length;
      const meanY = posBuf.reduce((a, p) => a + p[1], 0) / posBuf.length;
      const varX = posBuf.reduce((a, p) => a + (p[0] - meanX) ** 2, 0) / posBuf.length;
      const varY = posBuf.reduce((a, p) => a + (p[1] - meanY) ** 2, 0) / posBuf.length;
      const stable = Math.max(varX, varY) < 0.0002;
      handStableRef.current = stable;
      setHandStable(stable);
    }
  }, []);

  /**
   * Draw the real-time posture hint overlay on the canvas.
   * Shows colour-coded guide text so the user knows what to fix.
   */
  const drawPostureHint = useCallback((ctx, canvas, facing, stable, hasHand) => {
    if (!hasHand) return;

    const issues = [];
    if (!facing) issues.push('Hand flipped - please show your palm');
    if (!stable) issues.push('Hold your hand still');

    if (issues.length === 0) {
      // All good — green tick
      ctx.save();
      ctx.font = 'bold 15px Arial';
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(8, 8, 230, 30);
      ctx.fillStyle = '#4ade80';
      ctx.fillText('✓ Hand ready — press Start Recording', 16, 28);
      ctx.restore();
    } else {
      // Show issues in amber/red banner
      const lineH = 22;
      const boxH = 10 + issues.length * lineH;
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(8, 8, 300, boxH);
      ctx.font = 'bold 13px Arial';
      ctx.textAlign = 'left';
      issues.forEach((msg, i) => {
        ctx.fillStyle = '#fbbf24';
        ctx.fillText('⚠ ' + msg, 16, 26 + i * lineH);
      });
      ctx.restore();
    }
  }, []);

  // Keep postureHint string in sync for the status bar
  useEffect(() => {
    if (!handDetected) {
      setPostureHint('');
      return;
    }
    if (!handFacingCamera && !handStable) {
      setPostureHint('Show palm to camera & hold still');
    } else if (!handFacingCamera) {
      setPostureHint('Hand flipped - show your palm');
    } else if (!handStable) {
      setPostureHint('Hold your hand still');
    } else {
      setPostureHint('');
    }
  }, [handDetected, handFacingCamera, handStable]);

  // Reset readiness buffers when no hand is visible
  useEffect(() => {
    if (!handDetected) {
      recentOrientations.current = [];
      recentWristPositions.current = [];
      handFacingCameraRef.current = false;
      handStableRef.current = false;
      setHandFacingCamera(false);
      setHandStable(false);
    }
  }, [handDetected]);

  // ==================== WEBSOCKET FUNCTIONS ====================

  /**
   * Connect to Python MediaPipe backend via WebSocket
   * Establishes connection and sets up event handlers
   */
  const connectWebSocket = useCallback(() => {
    // Don't connect if component is unmounted
    if (!isMountedRef.current) {
      return;
    }

    // Close existing connection if any
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    try {
      const ws = new WebSocket('ws://localhost:8000/ws/hand-tracking');

      /**
       * WebSocket Event: Connection Opened
       */
      ws.onopen = () => {
        if (!isMountedRef.current) {
          ws.close();
          return;
        }
        console.log('✓ Connected to FastAPI backend (MediaPipe service)');
        setIsConnected(true);
        setValidationMessage('');
        wsRef.current = ws;
      };

      /**
       * WebSocket Event: Message Received
       * Receives hand landmark data from Python backend
       */
      ws.onmessage = (event) => {
        if (!isMountedRef.current) return;

        try {
          // Parse JSON data from Python
          const data = JSON.parse(event.data);
          const handsDetected = data.hand_count > 0;

          setHandDetected(handsDetected);

          // Draw on canvas
          const canvas = canvasRef.current;
          if (canvas) {
            const ctx = canvas.getContext('2d');

            // Clear canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Dark background
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            if (handsDetected) {
              // Draw hand skeleton
              drawHand(data);

              // Update orientation + stability and draw posture hint
              const landmarks = data.hands[0].landmarks;
              updateHandReadiness(landmarks);
              drawPostureHint(ctx, canvas, handFacingCameraRef.current, handStableRef.current, true);

              // Record frame if recording is active (use ref to avoid stale closure)
              if (isRecordingRef.current) {
                const frame = {
                  timestamp: Date.now(),
                  landmarks,
                  handedness: data.hands[0].handedness,
                  confidence: data.hands[0].confidence
                };
                setRecordedFrames(prev => [...prev, frame]);
              }
            } else {
              // Show "No hand" message
              ctx.fillStyle = '#666666';
              ctx.font = '16px Arial';
              ctx.textAlign = 'center';
              ctx.fillText(
                'Show your hand to the camera',
                canvas.width / 2,
                canvas.height / 2
              );
            }
          }
        } catch (err) {
          console.error('Error processing hand data:', err);
        }
      };

      /**
       * WebSocket Event: Error
       */
      ws.onerror = (err) => {
        console.error('WebSocket error:', err);
        if (isMountedRef.current) {
          setValidationMessage('Connection error. Is Python backend running?');
        }
      };

      /**
       * WebSocket Event: Connection Closed
       * Automatically attempts to reconnect after 3 seconds ONLY if component is still mounted
       */
      ws.onclose = () => {
        console.log('✗ Disconnected from Python MediaPipe backend');

        if (!isMountedRef.current) {
          // Component unmounted, don't reconnect
          return;
        }

        setIsConnected(false);
        setHandDetected(false);
        wsRef.current = null;

        // Auto-reconnect after 3 seconds ONLY if still mounted
        if (isMountedRef.current) {
          reconnectTimerRef.current = setTimeout(() => {
            if (isMountedRef.current) {
              console.log('Attempting to reconnect...');
              connectWebSocket();
            }
          }, 3000);
        }
      };

    } catch (err) {
      console.error('Failed to connect:', err);
      if (isMountedRef.current) {
        setValidationMessage('Failed to connect. Start Python backend first.');
      }
    }
  }, [isRecording, drawHand, updateHandReadiness, drawPostureHint]); // Dependencies

  // ==================== LIFECYCLE HOOKS ====================

  /**
   * Notify system that recording modal is open/closed
   * This disables cursor control in Electron overlay during recording
   */
  useEffect(() => {
    const setRecordingState = async (isRecording) => {
      // CRITICAL FIX: Check if state is already set to avoid duplicate API calls
      const currentState = localStorage.getItem('airclick_recording');
      if (currentState === isRecording.toString()) {
        console.log(`ℹ️ Recording state already ${isRecording} - skipping API call`);
        return;
      }

      // CRITICAL FIX: Use localStorage for immediate communication
      // Electron overlay can read localStorage and respond instantly
      try {
        localStorage.setItem('airclick_recording', isRecording.toString());
        console.log(`✅ Recording state set in localStorage: ${isRecording}`);
      } catch (error) {
        console.warn('⚠️ Could not set localStorage:', error.message);
      }

      // CRITICAL FIX: Send authentication token with API request
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('http://localhost:8000/api/gestures/recording-state', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` // CRITICAL: Include auth token
          },
          body: JSON.stringify({ is_recording: isRecording }),
        });

        if (response.ok) {
          console.log(`✅ Recording state set via API: ${isRecording}`);
        } else {
          const error = await response.text();
          console.warn('⚠️ Failed to set recording state via API:', error);
        }
      } catch (error) {
        console.warn('⚠️ Could not notify recording state via API:', error.message);
      }
    };

    // Modal opened - disable cursor control
    console.log('🎬 Gesture recording modal OPENED - Disabling cursor control');
    setRecordingState(true);

    // Modal closed - re-enable cursor control
    return () => {
      console.log('✅ Gesture recording modal CLOSED - Re-enabling cursor control');
      setRecordingState(false);
    };
  }, []); // Run once on mount and cleanup on unmount

  /**
   * Initialize WebSocket connection when component mounts
   */
  useEffect(() => {
    // Mark component as mounted
    isMountedRef.current = true;

    // Connect to WebSocket
    connectWebSocket();

    // Cleanup on unmount
    return () => {
      // Mark component as unmounted to prevent reconnections
      isMountedRef.current = false;

      // Close WebSocket connection
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      // Clear reconnect timer
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };
  }, [connectWebSocket]); // Depend on connectWebSocket

  /**
   * Recording timer - updates every second when recording
   */
  useEffect(() => {
    if (isRecording) {
      setRecordingTime(0);
      setRecordedFrames([]);

      intervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }
  }, [isRecording]);

  // ==================== RECORDING FUNCTIONS ====================

  /**
   * Start recording gesture frames
   */
  const startRecording = () => {
    if (!handDetected) {
      setValidationMessage('Please show your hand to the camera first');
      return;
    }
    setIsRecording(true);
    isRecordingRef.current = true;  // Update ref immediately for WebSocket callback
    setValidationMessage('');
    setRecordedFrames([]);
  };

  /**
   * Stop recording gesture frames
   */
  const stopRecording = () => {
    setIsRecording(false);
    isRecordingRef.current = false;  // Update ref immediately for WebSocket callback
  };

  /**
   * Save recorded gesture to FastAPI backend database
   */
  const handleSave = async () => {
    // Validation: Check gesture name
    if (!gestureName.trim()) {
      setValidationMessage('Please enter a gesture name');
      return;
    }

    // Validation: Check minimum recording length (1 second = ~10 frames)
    // Only check if new recording was made OR if creating new gesture
    if (!isEditMode || recordedFrames.length > 0) {
      if (recordedFrames.length < 10) {
        setValidationMessage('Please record for at least 1 second');
        return;
      }
    }

    setIsProcessing(true);

    try {
      // Get JWT token from localStorage
      const token = localStorage.getItem('token');

      let response;

      if (isEditMode) {
        // UPDATE existing gesture
        const updatePayload = {
          name: gestureName,
          action: selectedAction,
          app_context: selectedContext
        };

        // Only include frames if new recording was made
        if (recordedFrames.length > 0) {
          updatePayload.frames = recordedFrames;
        }

        response = await fetch(`http://localhost:8000/api/gestures/${editingGesture.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(updatePayload)
        });
      } else {
        // CREATE new gesture
        response = await fetch('http://localhost:8000/api/gestures/record', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            name: gestureName,
            action: selectedAction,
            app_context: selectedContext,
            frames: recordedFrames
          })
        });
      }

      if (!response.ok) {
        // CRITICAL FIX: Handle duplicate errors with clear user feedback
        if (response.status === 409) {
          // Conflict - duplicate name or duplicate gesture
          const errorData = await response.json();

          // Check if it's a duplicate gesture (landmarks) or duplicate name
          if (typeof errorData.detail === 'object' && errorData.detail.type === 'duplicate_gesture') {
            // Duplicate gesture landmarks detected
            const similarity = errorData.detail.similarity || 95;
            const existingName = errorData.detail.existing_gesture_name || 'an existing gesture';
            const existingAction = errorData.detail.existing_action || 'Unknown action';

            // Format action name to be more readable
            const formattedAction = existingAction
              .split('_')
              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ');

            setValidationMessage(
              `⚠️ Duplicate Gesture Detected!\n\n` +
              `This gesture is too similar (${similarity}%) to your existing gesture:\n\n` +
              `📌 Gesture: "${existingName}"\n` +
              `🎯 Action: ${formattedAction}\n\n` +
              `Please perform a different gesture to avoid conflicts.`
            );
          } else {
            // Duplicate name
            const message = typeof errorData.detail === 'string'
              ? errorData.detail
              : errorData.detail.message || 'A gesture with this name already exists';

            setValidationMessage(`⚠️ ${message}\n\nPlease choose a different name.`);
          }
          setIsProcessing(false);
          return; // Don't throw, just show validation message
        }

        // Other errors - throw generic message
        throw new Error(isEditMode ? 'Failed to update gesture' : 'Failed to save gesture');
      }

      const data = await response.json();

      // CRITICAL FIX: Ensure recording state is cleared before closing
      // This guarantees cursor re-enables even if cleanup doesn't run immediately
      try {
        localStorage.setItem('airclick_recording', 'false');
        const token = localStorage.getItem('token');
        await fetch('http://localhost:8000/api/gestures/recording-state', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ is_recording: false }),
        });
        console.log('✅ Recording state explicitly cleared before closing modal');
      } catch (error) {
        console.warn('⚠️ Could not clear recording state:', error.message);
      }

      // Call parent callback first
      if (onSave) {
        onSave(data);
      }

      // Close immediately - parent will handle success message and restore state
      setIsProcessing(false);
      onClose();

    } catch (error) {
      console.error('Save error:', error);
      setValidationMessage(isEditMode ? 'Failed to update gesture. Please try again.' : 'Failed to save gesture. Please try again.');
      setIsProcessing(false);
    }
  };

  // ==================== RENDER ====================

  return (
    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-center justify-center p-6">
      <div className="bg-[#0f111a] rounded-2xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col border border-slate-800 overflow-hidden">

        {/* Header - Clean & Professional */}
        <div className="flex justify-between items-center px-8 py-5 border-b border-slate-800">
          <div className="flex items-center gap-4">
            <div className="w-2 h-8 bg-cyan-500 rounded-full"></div>
            <div>
              <h2 className="text-xl font-semibold text-white tracking-tight">
                {isEditMode ? 'Edit Gesture' : 'Record New Gesture'}
              </h2>
              <p className="text-slate-500 text-xs font-medium">Gesture Studio • Analysis Mode</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content Area - Balanced Spacing */}
        <div className="flex-1 p-8 grid grid-cols-1 lg:grid-cols-2 gap-8 overflow-hidden">

          {/* Left Column: Visualizer */}
          <div className="flex flex-col h-full space-y-4">
            <div className="flex-1 relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950/50 flex items-center justify-center shadow-inner group">
              <canvas
                ref={canvasRef}
                width={640}
                height={480}
                className="max-w-full max-h-full object-contain"
              />

              {/* Status Overlays - Compact */}
              <div className="absolute top-4 left-4 flex flex-col gap-2">
                {isRecording && (
                  <div className="bg-red-500/10 border border-red-500/50 px-3 py-1.5 rounded-lg text-[10px] font-bold text-red-500 flex items-center animate-pulse">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 mr-2"></div>
                    RECORDING: {recordingTime}s
                  </div>
                )}
                {!isConnected && (
                  <div className="bg-amber-500/10 border border-amber-500/50 px-3 py-1.5 rounded-lg text-[10px] font-bold text-amber-500 flex items-center">
                    OFFLINE
                  </div>
                )}
              </div>

              {/* Frame Counter - Bottom Right */}
              <div className="absolute bottom-4 right-4 bg-slate-900/80 backdrop-blur px-3 py-1.5 rounded-lg border border-slate-800 text-[10px] text-slate-400 font-mono">
                {recordedFrames.length} FRAMES
              </div>
            </div>

            {/* Tracking Status Indicator */}
            {isConnected && handDetected && (
              <div className={`px-5 py-3 rounded-lg border flex items-center gap-3 transition-colors ${!postureHint ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400' : 'bg-amber-500/5 border-amber-500/20 text-amber-400'
                }`}>
                <div className={`w-2 h-2 rounded-full ${!postureHint ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`}></div>
                <span className="text-xs font-semibold tracking-wide uppercase">
                  {!postureHint ? 'Hand Position Optimal' : postureHint}
                </span>
              </div>
            )}
          </div>

          {/* Right Column: Controls */}
          <div className="flex flex-col h-full space-y-6 overflow-y-auto pr-2 custom-scrollbar">

            {/* Status Panel */}
            <div className="bg-slate-900/50 border border-slate-800 p-5 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                <span className="text-sm font-medium text-slate-300">
                  {isConnected ? 'Connection Stable' : 'Connection Lost'}
                </span>
              </div>
              {!isConnected && (
                <button
                  onClick={connectWebSocket}
                  className="text-[10px] font-bold text-cyan-500 uppercase hover:text-cyan-400 transition-colors"
                >
                  Reconnect Handlers
                </button>
              )}
            </div>

            {/* Configuration Form */}
            <div className="space-y-6 bg-slate-900/30 border border-slate-800 p-6 rounded-xl">
              {/* Gesture Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Gesture Identifier
                </label>
                <input
                  type="text"
                  value={gestureName}
                  onChange={(e) => setGestureName(e.target.value)}
                  placeholder="e.g. SWIPE_LEFT"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cyan-500/50 transition-colors text-sm font-medium"
                  disabled={isProcessing || isRecording}
                />
              </div>

              {/* Context Selector */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Scope / Context
                  </label>
                  <select
                    value={selectedContext}
                    onChange={(e) => setSelectedContext(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cyan-500/50 transition-colors text-sm font-medium appearance-none"
                    disabled={isProcessing || isRecording}
                  >
                    {APP_CONTEXTS.map(context => (
                      <option key={context.id} value={context.id}>{context.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Assigned Action
                  </label>
                  <select
                    value={selectedAction}
                    onChange={(e) => setSelectedAction(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cyan-500/50 transition-colors text-sm font-medium appearance-none"
                    disabled={isProcessing || isRecording || isLoadingActions}
                  >
                    {isLoadingActions ? (
                      <option>Loading...</option>
                    ) : (
                      availableActions.map(action => (
                        <option key={action.id} value={action.id}>{action.name}</option>
                      ))
                    )}
                  </select>
                </div>
              </div>
            </div>

            {/* Validation Feedback */}
            {validationMessage && (
              <div className={`p-4 rounded-lg border text-sm flex items-start gap-3 ${validationMessage.includes('success')
                ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400'
                : 'bg-red-500/5 border-red-500/20 text-red-400'
                }`}>
                <svg className="h-5 w-5 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="font-medium leading-relaxed">{validationMessage}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-4 pt-4 mt-auto">
              <button
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isProcessing || !isConnected || (!isRecording && (!handDetected || !handFacingCamera || !handStable))}
                className={`py-4 rounded-xl flex items-center justify-center gap-3 font-semibold text-sm transition-all shadow-lg active:scale-95 ${isRecording
                  ? 'bg-red-600 text-white hover:bg-red-700 hover:shadow-red-600/20'
                  : 'bg-white text-slate-950 hover:bg-slate-100 disabled:opacity-20'
                  }`}
              >
                {isRecording ? (
                  <>
                    <div className="w-3 h-3 bg-white rounded-sm animate-pulse"></div>
                    Stop Capturing
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    </svg>
                    Begin recording
                  </>
                )}
              </button>

              <button
                onClick={handleSave}
                disabled={isProcessing || isRecording || recordedFrames.length === 0 || !gestureName.trim()}
                className="bg-cyan-500 text-slate-950 py-4 rounded-xl flex items-center justify-center gap-3 font-semibold text-sm hover:bg-cyan-400 transition-all shadow-lg shadow-cyan-500/20 disabled:opacity-20 active:scale-95"
              >
                {isProcessing ? (
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {isProcessing ? 'Saving...' : 'Save Gesture'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
