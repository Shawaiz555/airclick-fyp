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

  // ==================== REFS ====================

  const wsRef = useRef(null);                    // WebSocket connection
  const canvasRef = useRef(null);                // Canvas for drawing
  const intervalRef = useRef(null);              // Recording timer
  const reconnectTimerRef = useRef(null);        // Auto-reconnect timer
  const isMountedRef = useRef(true);             // Track if component is mounted
  const isRecordingRef = useRef(false);          // Ref for recording state (fixes closure issue)

  // ==================== API FUNCTIONS ====================

  /**
   * Fetch available actions for the selected context from API
   */
  const fetchActionsForContext = async (context) => {
    setIsLoadingActions(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `http://localhost:8000/api/action-mappings/context/${context}?active_only=true`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

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
        if (!selectedAction && formattedActions.length > 0) {
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

              // Record frame if recording is active (use ref to avoid stale closure)
              if (isRecordingRef.current) {
                const frame = {
                  timestamp: Date.now(),
                  landmarks: data.hands[0].landmarks,
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
  }, [isRecording, drawHand]); // Dependencies: isRecording and drawHand

  // ==================== LIFECYCLE HOOKS ====================

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
        throw new Error(isEditMode ? 'Failed to update gesture' : 'Failed to save gesture');
      }

      const data = await response.json();

      // Call parent callback first
      if (onSave) {
        onSave(data);
      }

      // Close immediately - parent will handle success message
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
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-cyan-500/20">

        {/* Modal Header */}
        <div className="flex justify-between items-center p-6 border-b border-cyan-500/20">
          <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500">
            {isEditMode ? 'Edit Gesture' : 'Record New Gesture'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:cursor-pointer hover:bg-gray-700/50 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-6">

          {/* Connection Status Bar */}
          <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${
                isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
              }`}></div>
              <span className="text-sm">
                {isConnected ? (
                  handDetected ? (
                    <span className="text-green-400">✓ Hand Detected</span>
                  ) : (
                    <span className="text-amber-400">⚠ No Hand</span>
                  )
                ) : (
                  <span className="text-red-400">✗ Backend Disconnected</span>
                )}
              </span>
            </div>
            {!isConnected && (
              <button
                onClick={connectWebSocket}
                className="px-3 py-1 bg-cyan-500 hover:bg-cyan-600 rounded text-xs transition-colors"
              >
                Reconnect
              </button>
            )}
          </div>

          {/* Canvas Preview */}
          <div className="relative rounded-xl overflow-hidden border-2 border-dashed border-cyan-500/30 bg-gray-800/50">
            <canvas
              ref={canvasRef}
              width={640}
              height={480}
              className="w-full h-auto"
            />

            {/* Recording Indicator */}
            {isRecording && (
              <div className="absolute top-4 left-4 bg-red-500/80 px-3 py-1 rounded-full text-xs flex items-center animate-pulse">
                <div className="w-2 h-2 rounded-full bg-white mr-2"></div>
                <span>Recording: {recordingTime}s</span>
              </div>
            )}

            {/* Info Overlay */}
            <div className="absolute bottom-4 left-4 bg-black/50 px-3 py-2 rounded-lg text-xs">
              <div>Backend: Python MediaPipe</div>
              <div>Frames Recorded: {recordedFrames.length}</div>
            </div>
          </div>

          {/* Form Fields */}
          <div className="space-y-4">
            {/* Gesture Name */}
            <div>
              <label htmlFor="gestureName" className="block text-sm font-medium mb-2 text-cyan-200">
                Gesture Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                id="gestureName"
                value={gestureName}
                onChange={(e) => setGestureName(e.target.value)}
                placeholder="e.g., Pinch to Zoom"
                className={`w-full bg-gray-800/50 border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-white placeholder-gray-400 ${
                  recordedFrames.length > 0 && !gestureName.trim()
                    ? 'border-red-500/50 ring-1 ring-red-500/30'
                    : 'border-cyan-500/30'
                }`}
                disabled={isProcessing || isRecording}
              />
              {recordedFrames.length > 0 && !gestureName.trim() && (
                <p className="mt-1 text-sm text-red-400">Please enter a name to save your gesture</p>
              )}
            </div>

            {/* App Context Selector */}
            <div>
              <label htmlFor="context" className="block text-sm font-medium mb-2 text-cyan-200">
                Application Context
              </label>
              <div className="relative">
                <select
                  id="context"
                  value={selectedContext}
                  onChange={(e) => {
                    const newContext = e.target.value;
                    setSelectedContext(newContext);
                    // Actions will be fetched automatically by useEffect
                  }}
                  className="w-full bg-gray-800/50 border border-cyan-500/30 rounded-lg px-4 py-3 pr-10 appearance-none focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-white"
                  disabled={isProcessing || isRecording}
                >
                  {APP_CONTEXTS.map(context => (
                    <option key={context.id} value={context.id} className="bg-gray-800 text-white">
                      {context.name}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-cyan-400">
                  <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Assign Action */}
            <div>
              <label htmlFor="action" className="block text-sm font-medium mb-2 text-cyan-200">
                Assign Action
              </label>
              <div className="relative">
                <select
                  id="action"
                  value={selectedAction}
                  onChange={(e) => setSelectedAction(e.target.value)}
                  className="w-full bg-gray-800/50 border border-cyan-500/30 rounded-lg px-4 py-3 pr-10 appearance-none focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-white"
                  disabled={isProcessing || isRecording || isLoadingActions}
                >
                  {isLoadingActions ? (
                    <option>Loading actions...</option>
                  ) : availableActions.length === 0 ? (
                    <option>No actions available for this context</option>
                  ) : (
                    availableActions.map(action => (
                      <option key={action.id} value={action.id} className="bg-gray-800 text-white" title={action.description}>
                        {action.name}
                      </option>
                    ))
                  )}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-cyan-400">
                  {isLoadingActions ? (
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              </div>
              {availableActions.length === 0 && !isLoadingActions && (
                <p className="mt-1 text-xs text-amber-400">
                  No actions available. Please contact admin to add actions for {selectedContext} context.
                </p>
              )}
            </div>
          </div>

          {/* Validation Message */}
          {validationMessage && (
            <div className={`p-3 rounded-lg text-center ${
              validationMessage.includes('success')
                ? 'bg-green-500/20 text-green-300'
                : 'bg-amber-500/20 text-amber-300'
            }`}>
              {validationMessage}
            </div>
          )}

          {/* Control Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 pt-2">
            {/* Record/Stop Button */}
            <button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isProcessing || !isConnected}
              className={`flex-1 py-3 px-6 hover:cursor-pointer rounded-xl font-medium transition-all duration-300 flex items-center justify-center gap-2 ${
                isRecording
                  ? 'bg-gradient-to-r from-red-500 to-amber-500 hover:from-red-600 hover:to-amber-600'
                  : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700'
              } focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-opacity-50 disabled:opacity-50`}
            >
              {isRecording ? (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                  </svg>
                  Stop Recording
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Start Recording
                </>
              )}
            </button>

            {/* Save Button */}
            <button
              onClick={handleSave}
              disabled={isProcessing || isRecording || recordedFrames.length === 0 || !gestureName.trim()}
              className="flex-1 py-3 px-6 hover:cursor-pointer bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl font-medium hover:from-purple-600 hover:to-pink-700 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-opacity-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              title={!gestureName.trim() && recordedFrames.length > 0 ? "Please enter a gesture name" : ""}
            >
              {isProcessing ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Save Gesture ({recordedFrames.length} frames)
                </>
              )}
            </button>
          </div>

          {/* Backend Start Instructions (shown when disconnected) */}
          {!isConnected && (
            <div className="mt-4 p-4 bg-cyan-500/10 border border-cyan-500/20 rounded-lg">
              <h3 className="text-cyan-400 font-semibold mb-2">
                🚀 Start Python MediaPipe Backend
              </h3>
              <ol className="text-sm text-cyan-300 space-y-1 list-decimal list-inside">
                <li>Open terminal in project folder</li>
                <li>Run: <code className="bg-black/30 px-2 py-1 rounded">cd backend_mediapipe</code></li>
                <li>Run: <code className="bg-black/30 px-2 py-1 rounded">pip install -r requirements.txt</code></li>
                <li>Run: <code className="bg-black/30 px-2 py-1 rounded">python hand_tracking_service.py</code></li>
              </ol>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
