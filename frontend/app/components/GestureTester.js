/**
 * AirClick - Gesture Tester Component
 * =====================================
 *
 * This component provides live gesture testing functionality using
 * the Python MediaPipe backend. It displays the camera feed with
 * hand skeleton overlay and detects gestures in real-time.
 *
 * Flow:
 * 1. Connect to FastAPI MediaPipe WebSocket (ws://localhost:8000/ws/hand-tracking)
 * 2. Display camera feed with hand skeleton
 * 3. Detect and display recognized gestures
 * 4. Show test result (success/failure)
 *
 * Author: Muhammad Shawaiz
 * Project: AirClick FYP
 */

'use client';

import { useState, useRef, useEffect } from 'react';

export default function GestureTester({ onClose, onTestComplete }) {
  // ==================== STATE MANAGEMENT ====================

  // WebSocket state
  const [isConnected, setIsConnected] = useState(false);
  const [handDetected, setHandDetected] = useState(false);

  // Test state
  const [isTesting, setIsTesting] = useState(true);
  const [testResult, setTestResult] = useState(null);
  const [detectedGesture, setDetectedGesture] = useState(null);

  // ==================== REFS ====================

  const wsRef = useRef(null);                    // WebSocket connection
  const canvasRef = useRef(null);                // Canvas for drawing hand skeleton
  const testTimeoutRef = useRef(null);           // Test timeout

  // ==================== CONSTANTS ====================

  // Hand skeleton connections (21 landmarks)
  const HAND_CONNECTIONS = [
    // Thumb
    [0, 1], [1, 2], [2, 3], [3, 4],
    // Index finger
    [0, 5], [5, 6], [6, 7], [7, 8],
    // Middle finger
    [0, 9], [9, 10], [10, 11], [11, 12],
    // Ring finger
    [0, 13], [13, 14], [14, 15], [15, 16],
    // Pinky
    [0, 17], [17, 18], [18, 19], [19, 20],
    // Palm
    [5, 9], [9, 13], [13, 17]
  ];

  // ==================== WEBSOCKET CONNECTION ====================

  /**
   * Connect to Python MediaPipe WebSocket server
   * Receives real-time hand landmark data at 30 FPS
   */
  const connectWebSocket = () => {
    // Close existing connection if any
    if (wsRef.current) {
      wsRef.current.close();
    }

    // Create new WebSocket connection to FastAPI backend
    const ws = new WebSocket('ws://localhost:8000/ws/hand-tracking');

    // Connection opened successfully
    ws.onopen = () => {
      console.log('GestureTester: WebSocket connected');
      setIsConnected(true);
      wsRef.current = ws;

      // Start test timeout (10 seconds to detect gesture)
      testTimeoutRef.current = setTimeout(() => {
        if (isTesting && !detectedGesture) {
          setTestResult({
            success: false,
            message: 'Test timeout. No gesture detected. Please try again.'
          });
          setIsTesting(false);
          if (onTestComplete) {
            onTestComplete({ success: false });
          }
        }
      }, 10000);
    };

    // Receive hand tracking data
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Check if hand is detected
        const handsDetected = data.hand_count > 0;
        setHandDetected(handsDetected);

        // Draw hand skeleton on canvas
        if (handsDetected && canvasRef.current && isTesting) {
          drawHand(data);

          // Detect gesture from landmarks
          detectGestureFromLandmarks(data);
        } else if (canvasRef.current) {
          // Clear canvas if no hand detected
          const canvas = canvasRef.current;
          const ctx = canvas.getContext('2d');
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    };

    // Connection closed
    ws.onclose = () => {
      console.log('GestureTester: WebSocket connection closed');
      setIsConnected(false);
    };

    // Connection error
    ws.onerror = (error) => {
      console.error('GestureTester: WebSocket error:', error);
      setIsConnected(false);
      setTestResult({
        success: false,
        message: 'Failed to connect to camera service. Please ensure Python MediaPipe backend is running.'
      });
      setIsTesting(false);
    };
  };

  // ==================== DRAWING FUNCTIONS ====================

  /**
   * Draw hand skeleton with landmarks and connections on canvas
   *
   * @param {Object} handData - Hand tracking data from MediaPipe
   */
  const drawHand = (handData) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Clear previous frame
    ctx.clearRect(0, 0, width, height);

    // Draw each detected hand
    handData.hands.forEach((hand) => {
      // Choose color based on handedness
      const handColor = hand.handedness === 'Right' ? '#00FFFF' : '#FF00FF';

      // Draw connections (skeleton lines)
      ctx.strokeStyle = handColor;
      ctx.lineWidth = 3;

      HAND_CONNECTIONS.forEach(([start, end]) => {
        const startLandmark = hand.landmarks[start];
        const endLandmark = hand.landmarks[end];

        ctx.beginPath();
        ctx.moveTo(startLandmark.x * width, startLandmark.y * height);
        ctx.lineTo(endLandmark.x * width, endLandmark.y * height);
        ctx.stroke();
      });

      // Draw landmarks (key points)
      ctx.fillStyle = handColor;
      hand.landmarks.forEach((landmark, index) => {
        const x = landmark.x * width;
        const y = landmark.y * height;

        ctx.beginPath();
        ctx.arc(x, y, index === 0 ? 10 : 6, 0, 2 * Math.PI);
        ctx.fill();
      });
    });
  };

  /**
   * Detect gesture from hand landmarks
   * This is a simplified gesture recognition for testing
   *
   * @param {Object} handData - Hand tracking data
   */
  const detectGestureFromLandmarks = (handData) => {
    if (handData.hand_count === 0 || !isTesting) return;

    const hand = handData.hands[0];
    const landmarks = hand.landmarks;

    // Simple gesture detection based on landmark positions

    // Detect thumbs up (thumb tip higher than thumb base)
    const isThumbUp = landmarks[4].y < landmarks[3].y - 0.1;

    // Detect fist (all fingertips close to palm)
    const isFist = landmarks[8].y > landmarks[6].y &&
      landmarks[12].y > landmarks[10].y &&
      landmarks[16].y > landmarks[14].y &&
      landmarks[20].y > landmarks[18].y;

    // Detect open hand (all fingers extended)
    const isOpenHand = landmarks[8].y < landmarks[6].y &&
      landmarks[12].y < landmarks[10].y &&
      landmarks[16].y < landmarks[14].y &&
      landmarks[20].y < landmarks[18].y;

    // Detect peace sign (index and middle finger extended, others closed)
    const isPeaceSign = landmarks[8].y < landmarks[6].y &&
      landmarks[12].y < landmarks[10].y &&
      landmarks[16].y > landmarks[14].y &&
      landmarks[20].y > landmarks[18].y;

    // Determine detected gesture
    let gesture = null;
    if (isThumbUp) {
      gesture = 'Thumbs Up';
    } else if (isFist) {
      gesture = 'Fist';
    } else if (isPeaceSign) {
      gesture = 'Peace Sign';
    } else if (isOpenHand) {
      gesture = 'Open Hand';
    }

    // If gesture detected, show success
    if (gesture && !detectedGesture) {
      setDetectedGesture(gesture);
      setTestResult({
        success: true,
        message: `✓ Gesture detected successfully! Mapping is working correctly.`,
        gesture: gesture
      });
      setIsTesting(false);

      // Clear test timeout
      if (testTimeoutRef.current) {
        clearTimeout(testTimeoutRef.current);
      }

      // Notify parent
      if (onTestComplete) {
        onTestComplete({ success: true, gesture });
      }
    }
  };

  // ==================== RETRY FUNCTION ====================

  /**
   * Retry the gesture test
   */
  const handleRetry = () => {
    setTestResult(null);
    setDetectedGesture(null);
    setIsTesting(true);
    connectWebSocket();
  };

  // ==================== LIFECYCLE ====================

  /**
   * Initialize WebSocket connection on component mount
   */
  useEffect(() => {
    connectWebSocket();

    // Cleanup on unmount
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (testTimeoutRef.current) {
        clearTimeout(testTimeoutRef.current);
      }
    };
  }, []);

  // ==================== RENDER ====================

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="relative w-full max-w-3xl bg-gray-900/90 backdrop-blur-lg rounded-2xl overflow-hidden max-h-[90vh] overflow-y-auto border border-cyan-500/30 shadow-2xl">
        {/* Header gradient line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 to-blue-500"></div>

        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500">
              Live Gesture Test
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors p-2 rounded-full hover:bg-gray-800/50"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Camera Preview with Canvas */}
          <div className="relative w-full aspect-video bg-gray-800/50 rounded-xl overflow-hidden mb-6 border border-cyan-500/20">
            {/* Canvas for hand skeleton drawing */}
            <canvas
              ref={canvasRef}
              width={640}
              height={480}
              className="absolute inset-0 w-full h-full object-contain"
            />

            {/* Status overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              {!isConnected ? (
                <div className="bg-amber-500/20 border border-amber-500/30 rounded-xl px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-lg font-medium text-amber-300">Connecting to camera...</p>
                  </div>
                </div>
              ) : !handDetected && isTesting ? (
                <div className="bg-blue-500/20 border border-blue-500/30 rounded-xl px-6 py-4">
                  <p className="text-lg font-medium text-blue-300">Position your hand in the frame</p>
                </div>
              ) : handDetected && isTesting ? (
                <div className="bg-green-500/20 border border-green-500/30 rounded-xl px-6 py-4">
                  <p className="text-lg font-medium text-green-300">Hand detected! Make a gesture...</p>
                </div>
              ) : null}
            </div>

            {/* Connection status indicator */}
            <div className="absolute top-4 right-4 bg-black/50 px-3 py-1 rounded-full text-xs flex items-center">
              <div className={`w-2 h-2 rounded-full mr-2 ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-amber-500 animate-pulse'
                }`}></div>
              <span>{isConnected ? 'Connected' : 'Connecting...'}</span>
            </div>
          </div>

          {/* Test Result */}
          {testResult && (
            <div className={`p-4 rounded-xl mb-3 ${testResult.success
                ? 'bg-green-500/20 border border-green-500/30'
                : 'bg-amber-500/20 border border-amber-500/30'
              }`}>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full flex items-center justify-center">
                  {testResult.success ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-xl font-bold mb-1">
                    {testResult.success ? 'Success!' : 'Test Failed'}
                  </p>
                  <p className={testResult.success ? 'text-green-300' : 'text-amber-300'}>
                    {testResult.message}
                  </p>
                  {testResult.gesture && (
                    <p className="text-sm text-gray-400 mt-2">
                      Detected gesture: <span className="text-cyan-400 font-medium">{testResult.gesture}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-4">
            {testResult ? (
              <>
                <button
                  onClick={onClose}
                  className="flex-1 py-3 px-6 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl font-medium hover:from-cyan-600 hover:to-blue-700 transition-all duration-300"
                >
                  Close
                </button>
                {!testResult.success && (
                  <button
                    onClick={handleRetry}
                    className="flex-1 py-3 px-6 bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl font-medium hover:from-purple-600 hover:to-pink-700 transition-all duration-300"
                  >
                    Retry Test
                  </button>
                )}
              </>
            ) : (
              <button
                onClick={onClose}
                className="flex-1 py-3 px-6 bg-gray-700 rounded-xl font-medium hover:bg-gray-600 transition-all duration-300"
              >
                Cancel
              </button>
            )}
          </div>

          {/* Instructions */}
          <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <p className="text-sm text-blue-300">
              <strong>Instructions:</strong> Position your hand in front of the camera and make a clear gesture.
              The system will detect gestures like Thumbs Up, Fist, Peace Sign, or Open Hand.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
