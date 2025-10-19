/**
 * AirClick - Hand Tracking WebSocket Client
 * ==========================================
 *
 * This component connects to the Python MediaPipe backend via WebSocket
 * and receives real-time hand landmark data. It draws the hand skeleton
 * on a canvas and provides callbacks for gesture detection.
 *
 * Architecture:
 *   Python Backend (ws://localhost:8765) → WebSocket → This Component → Canvas Drawing
 *
 * Author: Muhammad Shawaiz
 * Project: AirClick FYP
 */

'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * HandTrackingClient Component
 *
 * Props:
 *   @param {Function} onHandDetected - Callback when hand is detected (optional)
 *   @param {Function} onHandLost - Callback when hand is lost (optional)
 *   @param {Function} onLandmarks - Callback with landmark data (optional)
 *   @param {boolean} showVideo - Whether to show the video feed (default: true)
 *   @param {boolean} drawSkeleton - Whether to draw hand skeleton (default: true)
 */
export default function HandTrackingClient({
  onHandDetected = null,
  onHandLost = null,
  onLandmarks = null,
  showVideo = true,
  drawSkeleton = true
}) {
  // ==================== STATE MANAGEMENT ====================

  // WebSocket connection state
  const [isConnected, setIsConnected] = useState(false);

  // Hand detection state
  const [handDetected, setHandDetected] = useState(false);

  // Number of hands currently detected
  const [handCount, setHandCount] = useState(0);

  // Connection error message
  const [error, setError] = useState('');

  // ==================== REFS ====================

  // WebSocket connection reference
  const wsRef = useRef(null);

  // Canvas reference for drawing
  const canvasRef = useRef(null);

  // Reconnection timer reference
  const reconnectTimerRef = useRef(null);

  /**
   * MediaPipe Hand Landmarks Connections
   * Defines which landmarks should be connected to form the hand skeleton
   * Each pair represents a connection: [startPoint, endPoint]
   *
   * Landmark numbering (21 points total):
   * 0: Wrist
   * 1-4: Thumb (base to tip)
   * 5-8: Index finger (base to tip)
   * 9-12: Middle finger (base to tip)
   * 13-16: Ring finger (base to tip)
   * 17-20: Pinky finger (base to tip)
   */
  const HAND_CONNECTIONS = [
    // Thumb connections
    [0, 1], [1, 2], [2, 3], [3, 4],

    // Index finger connections
    [0, 5], [5, 6], [6, 7], [7, 8],

    // Middle finger connections
    [0, 9], [9, 10], [10, 11], [11, 12],

    // Ring finger connections
    [0, 13], [13, 14], [14, 15], [15, 16],

    // Pinky finger connections
    [0, 17], [17, 18], [18, 19], [19, 20],

    // Palm connections
    [5, 9], [9, 13], [13, 17]
  ];

  /**
   * Draw hand skeleton on canvas
   *
   * @param {Object} handData - Hand data from WebSocket containing landmarks
   */
  const drawHand = (handData) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Get canvas dimensions
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;

    // Process each detected hand
    handData.hands.forEach((hand, handIndex) => {
      const landmarks = hand.landmarks;

      // Determine color based on handedness
      // Right hand: Cyan, Left hand: Pink
      const handColor = hand.handedness === 'Right' ? '#00FFFF' : '#FF00FF';

      if (drawSkeleton) {
        // Draw connections (bones) between landmarks
        ctx.strokeStyle = handColor;
        ctx.lineWidth = 2;

        HAND_CONNECTIONS.forEach(([startIdx, endIdx]) => {
          const start = landmarks[startIdx];
          const end = landmarks[endIdx];

          // Convert normalized coordinates (0-1) to canvas pixels
          const startX = start.x * canvasWidth;
          const startY = start.y * canvasHeight;
          const endX = end.x * canvasWidth;
          const endY = end.y * canvasHeight;

          // Draw line connection
          ctx.beginPath();
          ctx.moveTo(startX, startY);
          ctx.lineTo(endX, endY);
          ctx.stroke();
        });

        // Draw landmark points (joints)
        ctx.fillStyle = handColor;
        landmarks.forEach((landmark) => {
          // Convert normalized coordinates to canvas pixels
          const x = landmark.x * canvasWidth;
          const y = landmark.y * canvasHeight;

          // Draw circle for each landmark
          ctx.beginPath();
          ctx.arc(x, y, 4, 0, 2 * Math.PI);
          ctx.fill();

          // Draw outline for better visibility
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 1;
          ctx.stroke();
        });
      }

      // Draw hand label (Left/Right)
      if (landmarks[0]) {
        const wristX = landmarks[0].x * canvasWidth;
        const wristY = landmarks[0].y * canvasHeight;

        ctx.fillStyle = handColor;
        ctx.font = 'bold 14px Arial';
        ctx.fillText(
          `${hand.handedness} (${(hand.confidence * 100).toFixed(0)}%)`,
          wristX + 10,
          wristY - 10
        );
      }
    });
  };

  /**
   * Connect to WebSocket server
   * Establishes connection to Python MediaPipe backend
   */
  const connectWebSocket = () => {
    try {
      // Create WebSocket connection to FastAPI backend
      const ws = new WebSocket('ws://localhost:8000/ws/hand-tracking');

      /**
       * WebSocket Event: Connection Opened
       * Triggered when connection is successfully established
       */
      ws.onopen = () => {
        console.log('✓ Connected to FastAPI backend (MediaPipe service)');
        setIsConnected(true);
        setError('');
        wsRef.current = ws;
      };

      /**
       * WebSocket Event: Message Received
       * Triggered when hand tracking data is received from Python backend
       *
       * @param {MessageEvent} event - WebSocket message event
       */
      ws.onmessage = (event) => {
        try {
          // Parse JSON data from Python backend
          const data = JSON.parse(event.data);

          // Update hand detection state
          const handsDetected = data.hand_count > 0;

          if (handsDetected !== handDetected) {
            setHandDetected(handsDetected);

            // Trigger callbacks
            if (handsDetected && onHandDetected) {
              onHandDetected(data.hands);
            } else if (!handsDetected && onHandLost) {
              onHandLost();
            }
          }

          setHandCount(data.hand_count);

          // Clear canvas and draw new frame
          const canvas = canvasRef.current;
          if (canvas) {
            const ctx = canvas.getContext('2d');

            // Clear previous frame
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Draw dark background for better visibility
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Draw hands if detected
            if (handsDetected) {
              drawHand(data);
            } else {
              // Show "No hand detected" message
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

          // Trigger landmarks callback
          if (onLandmarks && handsDetected) {
            onLandmarks(data.hands);
          }

        } catch (err) {
          console.error('Error processing hand data:', err);
        }
      };

      /**
       * WebSocket Event: Error
       * Triggered when connection error occurs
       */
      ws.onerror = (err) => {
        console.error('WebSocket error:', err);
        setError('Connection error. Is the backend server running?');
      };

      /**
       * WebSocket Event: Connection Closed
       * Triggered when connection is closed
       * Automatically attempts to reconnect after 3 seconds
       */
      ws.onclose = () => {
        console.log('✗ Disconnected from FastAPI backend');
        setIsConnected(false);
        setHandDetected(false);
        wsRef.current = null;

        // Attempt reconnection after 3 seconds
        reconnectTimerRef.current = setTimeout(() => {
          console.log('Attempting to reconnect...');
          connectWebSocket();
        }, 3000);
      };

    } catch (err) {
      console.error('Failed to connect:', err);
      setError('Failed to connect. Is the backend server running?');
    }
  };

  /**
   * Initialize WebSocket connection on component mount
   * Cleanup on component unmount
   */
  useEffect(() => {
    // Connect to WebSocket when component mounts
    connectWebSocket();

    // Cleanup function - runs when component unmounts
    return () => {
      // Close WebSocket connection
      if (wsRef.current) {
        wsRef.current.close();
      }

      // Clear reconnection timer
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
    };
  }, []); // Empty dependency array = run once on mount

  // ==================== RENDER ====================

  return (
    <div className="hand-tracking-client">
      {/* Status Indicator */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Connection Status Dot */}
          <div className={`w-3 h-3 rounded-full ${
            isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
          }`}></div>

          {/* Status Text */}
          <span className="text-sm">
            {isConnected ? (
              handDetected ? (
                <span className="text-green-400">
                  ✓ {handCount} Hand{handCount !== 1 ? 's' : ''} Detected
                </span>
              ) : (
                <span className="text-amber-400">
                  ⚠ No Hand Detected
                </span>
              )
            ) : (
              <span className="text-red-400">
                ✗ Disconnected from Backend
              </span>
            )}
          </span>
        </div>

        {/* Manual Reconnect Button */}
        {!isConnected && (
          <button
            onClick={connectWebSocket}
            className="px-3 py-1 bg-cyan-500 hover:bg-cyan-600 rounded text-sm transition-colors"
          >
            Reconnect
          </button>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300 text-sm">
          {error}
          <div className="mt-2 text-xs text-red-400">
            Make sure the backend server is running:
            <code className="block mt-1 bg-black/30 p-2 rounded">
              cd backend && uvicorn app.main:app --reload
            </code>
          </div>
        </div>
      )}

      {/* Canvas for Hand Skeleton Visualization */}
      <div className="relative rounded-xl overflow-hidden border-2 border-dashed border-cyan-500/30 bg-gray-800/50">
        <canvas
          ref={canvasRef}
          width={640}
          height={480}
          className="w-full h-auto"
        />

        {/* Overlay Info */}
        <div className="absolute bottom-4 left-4 bg-black/50 px-3 py-2 rounded-lg text-xs">
          <div>Resolution: 640x480</div>
          <div>FPS: ~30</div>
          <div>Backend: FastAPI + MediaPipe</div>
        </div>
      </div>

      {/* Connection Instructions */}
      {!isConnected && (
        <div className="mt-4 p-4 bg-cyan-500/10 border border-cyan-500/20 rounded-lg">
          <h3 className="text-cyan-400 font-semibold mb-2">
            🚀 Start Backend Server
          </h3>
          <ol className="text-sm text-cyan-300 space-y-1 list-decimal list-inside">
            <li>Open terminal in project folder</li>
            <li>Run: <code className="bg-black/30 px-2 py-1 rounded">cd backend</code></li>
            <li>Run: <code className="bg-black/30 px-2 py-1 rounded">pip install -r requirements.txt</code></li>
            <li>Run: <code className="bg-black/30 px-2 py-1 rounded">uvicorn app.main:app --reload</code></li>
          </ol>
        </div>
      )}
    </div>
  );
}
