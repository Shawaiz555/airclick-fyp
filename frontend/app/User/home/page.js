/**
 * AirClick - User Home Page with Real-time Hand Tracking
 * ========================================================
 *
 * This is the main dashboard where users can:
 * 1. Start/stop camera for hand tracking via WebSocket
 * 2. See real-time hand landmark detection
 * 3. View detected gestures in real-time
 * 4. Control hybrid mode and application context
 *
 * Flow:
 * - Connect to FastAPI MediaPipe backend (ws://localhost:8000/ws/hand-tracking)
 * - Receive hand tracking data in real-time
 * - Display hand skeleton on canvas
 * - Show gesture detection feedback
 *
 * Author: Muhammad Shawaiz
 * Project: AirClick FYP
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import ProtectedRoute from '../../components/ProtectedRoute';

export default function Home() {
  // ==================== STATE MANAGEMENT ====================

  // Camera and detection state
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [detectedGesture, setDetectedGesture] = useState(null);
  const [landmarkDetected, setLandmarkDetected] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // App settings state
  const [activeApp, setActiveApp] = useState('POWERPOINT');
  const [hybridMode, setHybridMode] = useState(true);

  // WebSocket state
  const [isConnected, setIsConnected] = useState(false);
  const [handDetected, setHandDetected] = useState(false);

  // Automatic gesture recognition state
  const [recognitionFrames, setRecognitionFrames] = useState([]);
  const [userGestures, setUserGestures] = useState([]);
  const [matchedGesture, setMatchedGesture] = useState(null);
  const [similarity, setSimilarity] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [isMatching, setIsMatching] = useState(false);

  // ==================== REFS ====================

  const wsRef = useRef(null);                    // WebSocket connection
  const canvasRef = useRef(null);                // Canvas for drawing hand skeleton
  const gestureTimeoutRef = useRef(null);        // Timeout for clearing gestures
  const matchCooldownRef = useRef(false);        // Prevent matching during cooldown

  // ==================== CONSTANTS ====================

  const apps = ['POWERPOINT', 'WORD', 'GLOBAL'];

  // ==================== LOAD USER GESTURES ====================

  useEffect(() => {
    loadUserGestures();
  }, []);

  const loadUserGestures = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:8000/api/gestures/', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setUserGestures(data);
        setStatusMessage(`✓ Loaded ${data.length} gestures`);
      }
    } catch (error) {
      console.error('Error loading gestures:', error);
      setStatusMessage('⚠ Error loading gestures');
    }
  };

  // Hand skeleton connections (21 landmarks)
  // Each connection is defined as [start_landmark, end_landmark]
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
      console.log('WebSocket connected to FastAPI backend (MediaPipe service)');
      setIsConnected(true);
      setIsProcessing(false);
      wsRef.current = ws;
    };

    // Receive hand tracking data
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Check if hand is detected
        const handsDetected = data.hand_count > 0;
        setHandDetected(handsDetected);
        setLandmarkDetected(handsDetected);

        // Draw hand skeleton on canvas
        if (handsDetected && canvasRef.current) {
          drawHand(data);

          // AUTOMATIC: Continuously collect frames for gesture recognition
          const frame = {
            timestamp: Date.now(),
            landmarks: data.hands[0].landmarks,
            handedness: data.hands[0].handedness,
            confidence: data.hands[0].confidence
          };

          setRecognitionFrames(prev => {
            const newFrames = [...prev, frame];

            // Keep only last 60 frames (2 seconds at 30fps) - sliding window
            const framesToKeep = newFrames.slice(-60);

            // Auto-match when we have 60 frames and not in cooldown
            if (framesToKeep.length === 60 && !matchCooldownRef.current) {
              // Trigger matching
              matchGesture(framesToKeep);
              // Clear frames after matching
              return [];
            }

            return framesToKeep;
          });
        } else if (canvasRef.current) {
          // Clear canvas if no hand detected
          const canvas = canvasRef.current;
          const ctx = canvas.getContext('2d');
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          // Clear frames when hand is lost
          setRecognitionFrames([]);
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    };

    // Connection closed
    ws.onclose = () => {
      console.log('WebSocket connection closed');
      setIsConnected(false);
      setHandDetected(false);
      setLandmarkDetected(false);

      // Auto-reconnect if camera is still active
      if (isCameraActive) {
        setTimeout(() => {
          console.log('Attempting to reconnect...');
          connectWebSocket();
        }, 3000);
      }
    };

    // Connection error
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setIsConnected(false);
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
      ctx.lineWidth = 2;

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
        ctx.arc(x, y, index === 0 ? 8 : 4, 0, 2 * Math.PI);
        ctx.fill();

        // Draw landmark index for debugging (optional)
        // ctx.fillStyle = '#FFFFFF';
        // ctx.font = '10px Arial';
        // ctx.fillText(index, x + 5, y - 5);
        // ctx.fillStyle = handColor;
      });
    });
  };

  /**
   * Detect gesture from hand landmarks
   * This is a simplified gesture recognition - in production, use ML model
   *
   * @param {Object} handData - Hand tracking data
   */
  const detectGestureFromLandmarks = (handData) => {
    if (handData.hand_count === 0) return;

    const hand = handData.hands[0];
    const landmarks = hand.landmarks;

    // Simple gesture detection based on landmark positions
    // This is a placeholder - replace with actual ML model

    // Example: Detect thumbs up (thumb tip higher than thumb base)
    const isThumbUp = landmarks[4].y < landmarks[3].y - 0.1;

    // Example: Detect fist (all fingertips close to palm)
    const isFist = landmarks[8].y > landmarks[6].y &&
      landmarks[12].y > landmarks[10].y &&
      landmarks[16].y > landmarks[14].y &&
      landmarks[20].y > landmarks[18].y;

    // Example: Detect open hand (all fingers extended)
    const isOpenHand = landmarks[8].y < landmarks[6].y &&
      landmarks[12].y < landmarks[10].y &&
      landmarks[16].y < landmarks[14].y &&
      landmarks[20].y < landmarks[18].y;

    // Determine detected gesture
    let gesture = null;
    if (isThumbUp) {
      gesture = 'Thumbs Up';
    } else if (isFist) {
      gesture = 'Fist';
    } else if (isOpenHand) {
      gesture = 'Open Hand';
    }

    // Update detected gesture if found
    if (gesture && (!detectedGesture || detectedGesture.gesture !== gesture)) {
      setDetectedGesture({
        gesture: gesture,
        timestamp: Date.now()
      });

      // Clear previous timeout
      if (gestureTimeoutRef.current) {
        clearTimeout(gestureTimeoutRef.current);
      }

      // Auto-clear gesture after 3 seconds
      gestureTimeoutRef.current = setTimeout(() => {
        setDetectedGesture(null);
      }, 3000);
    }
  };

  // ==================== AUTOMATIC GESTURE RECOGNITION ====================

  /**
   * Match collected frames against stored gestures and auto-execute
   */
  const matchGesture = async (frames) => {
    // Skip if no gestures stored
    if (userGestures.length === 0) {
      return;
    }

    // Skip if not enough frames
    if (frames.length < 30) {
      return;
    }

    // Set cooldown to prevent multiple matches
    matchCooldownRef.current = true;
    setIsMatching(true);
    setStatusMessage('🔍 Matching gesture...');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:8000/api/gestures/match', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(frames)
      });

      const result = await response.json();

      if (result.matched) {
        setMatchedGesture(result.gesture);
        setSimilarity(result.similarity);

        // Check if context matches
        if (result.gesture.app_context === activeApp) {
          setStatusMessage(`✅ Matched: ${result.gesture.name} (${(result.similarity * 100).toFixed(0)}%) - Executing...`);
          // Auto-execute immediately
          await executeGestureAction(result.gesture.id);
        } else {
          setStatusMessage(`✅ Matched: ${result.gesture.name} - Switch to ${result.gesture.app_context} context to execute`);
        }

        // Clear matched gesture after 2 seconds
        setTimeout(() => {
          setMatchedGesture(null);
          setStatusMessage('👋 Ready - Perform a gesture');
        }, 2000);
      } else {
        // Don't show "no match" messages to avoid spam
        setStatusMessage('👋 Ready - Perform a gesture');
      }
    } catch (error) {
      console.error('Match error:', error);
      setStatusMessage('❌ Error matching gesture');
    } finally {
      setIsMatching(false);
      // Release cooldown after 1 second to allow next gesture
      setTimeout(() => {
        matchCooldownRef.current = false;
      }, 1000);
    }
  };

  /**
   * Execute a gesture's action
   */
  const executeGestureAction = async (gestureId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:8000/api/gestures/execute?gesture_id=${gestureId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const result = await response.json();

      if (result.success) {
        const windowInfo = result.window_switched ? ` in ${result.window_title}` : '';
        setStatusMessage(`✅ Executed: ${result.action_name}${windowInfo}`);
      } else if (result.app_not_found) {
        setStatusMessage(`❌ ${result.context} app not running! Please open ${result.context} first.`);
      } else {
        setStatusMessage(`❌ Failed: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Execution error:', error);
      setStatusMessage('❌ Error executing action');
    }
  };

  // ==================== CAMERA CONTROL ====================

  /**
   * Toggle camera on/off
   * When enabled, connects to WebSocket and starts receiving hand data
   */
  const toggleCamera = () => {
    if (!isCameraActive) {
      // Start camera
      setIsCameraActive(true);
      setIsProcessing(true);
      connectWebSocket();
    } else {
      // Stop camera
      setIsCameraActive(false);
      setIsConnected(false);
      setHandDetected(false);
      setLandmarkDetected(false);
      setDetectedGesture(null);

      // Close WebSocket connection
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      // Clear canvas
      if (canvasRef.current) {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  };

  // ==================== LIFECYCLE ====================

  /**
   * Cleanup on component unmount
   */
  useEffect(() => {
    return () => {
      // Close WebSocket connection
      if (wsRef.current) {
        wsRef.current.close();
      }

      // Clear gesture timeout
      if (gestureTimeoutRef.current) {
        clearTimeout(gestureTimeoutRef.current);
      }
    };
  }, []);

  // ==================== RENDER ====================

  return (
    <ProtectedRoute allowedRoles={['USER']}>
      <div className="md:ml-64 min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800 text-white">
        <div className="container py-12">
          {/* Main Content */}
          <div className="max-w-7xl mx-auto">
            {/* Camera Preview - INCREASED SIZE */}
            <div className="relative rounded-2xl overflow-hidden border-4 border-dashed border-cyan-500/50 bg-gray-800/50 mb-6 flex items-center justify-center" style={{ height: '700px' }}>
              {isCameraActive ? (
                <>
                  {/* Canvas for hand skeleton drawing - LARGER RESOLUTION */}
                  <canvas
                    ref={canvasRef}
                    width={1280}
                    height={720}
                    className="absolute inset-0 w-full h-full object-contain"
                  />

                  <div className="absolute inset-0 bg-gradient-to-br from-cyan-900/20 to-blue-900/20"></div>

                  <div className="relative z-10 text-center">
                    {!landmarkDetected ? (
                      <div className="flex flex-col items-center">
                        <div className="w-12 h-12 mb-3 rounded-full bg-amber-500/20 flex items-center justify-center animate-pulse">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                          </svg>
                        </div>
                        <p className="text-lg font-medium text-amber-300">
                          {isConnected ? 'Detecting hand...' : 'Connecting to camera...'}
                        </p>
                      </div>
                    ) : (
                      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-center">
                  <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className="text-lg">Position your hand in the frame</p>
                  <p className="text-cyan-300 text-sm mt-1">Make a clear, consistent gesture</p>
                </div>
              )}

              {/* Camera status indicator */}
              <div className="absolute top-4 right-4 bg-black/50 px-3 py-1 rounded-full text-xs flex items-center">
                <div className={`w-2 h-2 rounded-full mr-2 ${isCameraActive && isConnected ? 'bg-red-500 animate-pulse' : 'bg-green-500'
                  }`}></div>
                <span>
                  {isCameraActive
                    ? (isConnected ? 'Camera: Active' : 'Camera: Connecting...')
                    : 'Camera: Ready'}
                </span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex flex-col sm:flex-row gap-4 mb-8">
              <button
                onClick={toggleCamera}
                className={`flex-1 py-4 px-6 rounded-xl font-bold text-lg transition-all duration-300 flex items-center justify-center gap-2 hover:cursor-pointer ${isCameraActive
                    ? 'bg-gradient-to-r from-red-500 to-amber-500 hover:from-red-600 hover:to-amber-600'
                    : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700'
                  } focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-opacity-50`}
              >
                {isCameraActive ? (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                    </svg>
                    Stop Camera
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Start Camera
                  </>
                )}
              </button>

              <button
                onClick={() => setHybridMode(!hybridMode)}
                className={`flex-1 py-4 px-6 rounded-xl font-bold text-lg transition-all duration-300 flex items-center justify-center gap-2 hover:cursor-pointer ${hybridMode
                    ? 'bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700'
                    : 'bg-gray-700 hover:bg-gray-600'
                  }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                </svg>
                {hybridMode ? 'Hybrid Mode: ON' : 'Hybrid Mode: OFF'}
              </button>
            </div>

            {/* Context Indicator */}
            <div className="bg-gray-800/30 backdrop-blur-sm rounded-2xl p-6 border border-cyan-500/20 mb-8">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-semibold text-cyan-200 mb-2">Active Application</h3>
                  <select
                    value={activeApp}
                    onChange={(e) => setActiveApp(e.target.value)}
                    className="bg-gray-700/50 border border-cyan-500/30 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    {apps.map(app => (
                      <option key={app} value={app} className="bg-gray-800">{app}</option>
                    ))}
                  </select>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-400">Context Mode</p>
                  <p className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500">
                    {activeApp}
                  </p>
                </div>
              </div>
            </div>

            {/* Automatic Gesture Recognition Status */}
            <div className="bg-gray-800/30 backdrop-blur-sm rounded-2xl p-6 border border-cyan-500/20 mb-8">
              <h3 className="text-lg font-semibold text-cyan-200 mb-4">🤖 Automatic Gesture Recognition</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                {/* Status Info */}
                <div className="bg-gray-700/30 rounded-lg p-4">
                  <div className="text-sm text-gray-400 space-y-2">
                    <div className="flex justify-between">
                      <span>Camera:</span>
                      <span className={isConnected ? 'text-green-400' : 'text-red-400'}>
                        {isConnected ? '✓ Active' : '✗ Inactive'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Hand Detection:</span>
                      <span className={handDetected ? 'text-green-400' : 'text-gray-400'}>
                        {handDetected ? '✓ Detected' : '✗ No hand'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Recognition:</span>
                      <span className={isCameraActive && handDetected ? 'text-green-400 animate-pulse' : 'text-gray-400'}>
                        {isCameraActive && handDetected ? '● ACTIVE' : '○ Standby'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Gestures:</span>
                      <span className="text-cyan-400">{userGestures.length} loaded</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Context:</span>
                      <span className="text-cyan-400 font-semibold">{activeApp}</span>
                    </div>
                  </div>
                </div>

                {/* Real-time Status */}
                <div className="bg-gray-700/30 rounded-lg p-4 flex flex-col justify-center">
                  {isCameraActive && handDetected ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                        <span className="text-green-400 font-medium">Listening for gestures...</span>
                      </div>
                      {recognitionFrames.length > 0 && (
                        <div className="w-full bg-gray-600 rounded-full h-2">
                          <div
                            className="bg-gradient-to-r from-cyan-500 to-blue-500 h-2 rounded-full transition-all duration-200"
                            style={{ width: `${(recognitionFrames.length / 60) * 100}%` }}
                          ></div>
                        </div>
                      )}
                      {isMatching && (
                        <div className="flex items-center gap-2 text-amber-400 text-sm">
                          <div className="w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
                          <span>Analyzing...</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center text-gray-400 text-sm">
                      {!isCameraActive ? (
                        <>👆 Start camera to begin</>
                      ) : (
                        <>✋ Show your hand to activate</>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Status Message */}
              {statusMessage && (
                <div className="bg-gray-700/50 rounded-lg p-3 border border-cyan-500/30 mb-4">
                  <p className="text-sm text-center text-cyan-200">{statusMessage}</p>
                </div>
              )}

              {/* Matched Gesture Display */}
              {matchedGesture && (
                <div className="bg-gradient-to-r from-green-500/20 to-cyan-500/20 rounded-lg p-4 border border-green-500/30 mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-lg font-bold text-green-400">✅ {matchedGesture.name}</span>
                    <span className="text-sm text-green-300">{(similarity * 100).toFixed(0)}% match</span>
                  </div>
                  <div className="text-sm text-gray-300">
                    Action: <span className="text-white font-medium">{matchedGesture.action}</span> | Context: <span className="text-white font-medium">{matchedGesture.app_context}</span>
                  </div>
                </div>
              )}

              {/* Instructions */}
              <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-lg p-3">
                <p className="text-xs text-cyan-300 mb-2"><strong>ℹ️ How it works:</strong></p>
                <ul className="text-xs text-cyan-300/80 space-y-1 list-disc list-inside">
                  <li>Recognition is <strong>fully automatic</strong> when camera is on</li>
                  <li>Just show your hand and perform any gesture you&apos;ve recorded</li>
                  <li>System collects 2 seconds of movement and matches in real-time</li>
                  <li>Actions execute <strong>immediately</strong> if context matches</li>
                  <li>Make sure you&apos;re in the correct app context: <strong>{activeApp}</strong></li>
                </ul>
                <p className="text-xs text-amber-300 mt-2">
                  <strong>💡 Tips:</strong> Keep gestures smooth • Hold hand steady after gesture • Switch context above if needed
                </p>
              </div>
            </div>

            {/* Gesture Detection Feedback (OLD - keeping for backward compatibility) */}
            {detectedGesture && (
              <div className="bg-green-500/20 border border-green-500/30 rounded-2xl p-6 mb-8 animate-fade-in">
                <div className="flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-green-500/30 flex items-center justify-center mr-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xl font-bold text-green-300">✔ {detectedGesture.gesture} Detected</p>
                    <p className="text-green-400 text-sm">Gesture executed successfully</p>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Link href="/User/gestures-management" className="bg-gray-800/30 backdrop-blur-sm rounded-2xl p-6 border border-cyan-500/20 hover:border-cyan-500/40 transition-all duration-300 hover:scale-105">
                <div className="flex items-center space-x-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-cyan-500/20 to-blue-500/20 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-cyan-200">Custom Gestures</h3>
                </div>
                <p className="text-cyan-300 text-sm">Create and manage your own gestures</p>
              </Link>

              <Link href="/User/settings" className="bg-gray-800/30 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/20 hover:border-purple-500/40 transition-all duration-300 hover:scale-105">
                <div className="flex items-center space-x-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-purple-500/20 to-pink-500/20 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-purple-200">Settings</h3>
                </div>
                <p className="text-purple-300 text-sm">Adjust sensitivity and accessibility</p>
              </Link>

              <div className="bg-gray-800/30 backdrop-blur-sm rounded-2xl p-6 border border-amber-500/20">
                <div className="flex items-center space-x-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-amber-500/20 to-orange-500/20 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-amber-200">Performance</h3>
                </div>
                <p className="text-amber-300 text-sm">Latency: {isConnected ? '~33ms (30 FPS)' : 'Not connected'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
