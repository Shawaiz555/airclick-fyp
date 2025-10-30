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
import LoadingSpinner from '../../components/LoadingSpinner';

export default function Home() {
  // ==================== STATE MANAGEMENT ====================

  // Initial loading state
  const [isLoading, setIsLoading] = useState(true);

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
    } finally {
      setIsLoading(false);
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
        {isLoading ? (
          <div className="flex items-center justify-center min-h-screen">
            <LoadingSpinner message="Loading dashboard..." size="lg" />
          </div>
        ) : (
          <div className="py-6 md:py-10 px-4 lg:px-8">
            <div className="max-w-[1400px] mx-auto">
              {/* Header */}
              <div className="mb-8">
                <h1 className="text-3xl md:text-[44px] font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400">
                  Gesture Control Dashboard
                </h1>
                <p className="text-purple-200/90">Monitor and control your hand gesture recognition system</p>
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {/* Camera Status */}
                <div className="bg-gray-800/30 backdrop-blur-md rounded-2xl p-4 py-8 border border-cyan-500/20">
                  <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}></div>
                    <div>
                      <p className="text-md font-bold text-gray-400">Camera</p>
                      <p className="text-sm font-bold text-white">{isConnected ? 'Active' : 'Inactive'}</p>
                    </div>
                  </div>
                </div>

                {/* Hand Detection */}
                <div className="bg-gray-800/30 backdrop-blur-md rounded-2xl p-4 py-8 border border-purple-500/20">
                  <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-full ${handDetected ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}></div>
                    <div>
                      <p className="text-md font-bold text-gray-400">Hand</p>
                      <p className="text-sm font-bold text-white">{handDetected ? 'Detected' : 'No Hand'}</p>
                    </div>
                  </div>
                </div>

                {/* Loaded Gestures */}
                <div className="bg-gray-800/30 backdrop-blur-md rounded-2xl p-4 py-8 border border-amber-500/20">
                  <div className="flex items-center gap-3">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                    </svg>
                    <div>
                      <p className="text-md font-bold text-gray-400">Gestures</p>
                      <p className="text-sm font-bold text-white">{userGestures.length}</p>
                    </div>
                  </div>
                </div>

                {/* Context */}
                <div className="bg-gray-800/30 backdrop-blur-md rounded-2xl p-4 py-8 border border-emerald-500/20">
                  <div className="flex items-center gap-3">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <div>
                      <p className="text-md font-bold text-gray-400">Context</p>
                      <p className="text-sm font-bold text-white truncate">{activeApp}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Main Grid: Camera + Controls */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">

                {/* Left: Camera Feed (2/3 width) */}
                <div className="lg:col-span-2 space-y-4">
                  {/* Camera Preview */}
                  <div className="relative rounded-3xl overflow-hidden border-2 border-cyan-500/30 bg-gray-900/30 backdrop-blur-md shadow-2xl" style={{ height: '540px' }}>
                    {isCameraActive ? (
                      <>
                        <canvas
                          ref={canvasRef}
                          width={1280}
                          height={720}
                          className="absolute inset-0 w-full h-full object-contain"
                        />
                        <div className="absolute inset-0 bg-gradient-to-br from-cyan-900/10 to-blue-900/10"></div>

                        {!landmarkDetected ? (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="text-center">
                              <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-amber-500/20 flex items-center justify-center animate-pulse">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                                </svg>
                              </div>
                              <p className="text-lg font-medium text-amber-300">{isConnected ? 'Detecting hand...' : 'Connecting...'}</p>
                            </div>
                          </div>
                        ) : (
                          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                            <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center">
                          <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </div>
                          <p className="text-xl font-semibold mb-2">Camera Ready</p>
                          <p className="text-cyan-300 text-sm">Click Start Camera to begin</p>
                        </div>
                      </div>
                    )}

                    {/* Camera Indicator */}
                    <div className="absolute top-4 right-4 bg-gray-900/90 backdrop-blur-md px-4 py-2 rounded-xl border border-cyan-500/30 shadow-lg">
                      <div className="flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${isCameraActive && isConnected ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`}></div>
                        <span className="text-xs font-medium">{isCameraActive ? (isConnected ? 'LIVE' : 'Connecting...') : 'Ready'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Control Buttons */}
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={toggleCamera}
                      className={`py-4 px-6 rounded-2xl font-bold transition-all duration-300 flex items-center justify-center gap-3 shadow-lg ${
                        isCameraActive
                          ? 'bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 hover:shadow-red-500/40'
                          : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 hover:shadow-cyan-500/40'
                      } transform hover:scale-[1.02] cursor-pointer`}
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
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Start Camera
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => setHybridMode(!hybridMode)}
                      className={`py-4 px-6 rounded-2xl font-bold transition-all duration-300 flex items-center justify-center gap-3 shadow-lg ${
                        hybridMode
                          ? 'bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 hover:shadow-purple-500/40'
                          : 'bg-gray-800/60 hover:bg-gray-700/60 border-2 border-gray-600/50'
                      } transform hover:scale-[1.02] cursor-pointer`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                      </svg>
                      {hybridMode ? 'Hybrid: ON' : 'Hybrid: OFF'}
                    </button>
                  </div>
                </div>

                {/* Right: Status Panel (1/3 width) */}
                <div className="space-y-4">

                  {/* Recognition Status */}
                  <div className="w-full h-[340px] bg-gray-800/30 backdrop-blur-md rounded-3xl p-6 border border-emerald-500/20 shadow-xl">
                    <div className="flex items-center gap-2 mb-4">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      <h3 className="text-lg font-bold text-white">Recognition Status</h3>
                    </div>

                    <div className="space-y-3">
                      {isCameraActive && handDetected ? (
                        <>
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                            <span className="text-sm text-green-400 font-medium">Active - Listening</span>
                          </div>

                          {recognitionFrames.length > 0 && (
                            <div>
                              <div className="flex justify-between text-xs text-gray-400 mb-1">
                                <span>Recording</span>
                                <span>{recognitionFrames.length}/60 frames</span>
                              </div>
                              <div className="w-full bg-gray-700 rounded-full h-2">
                                <div
                                  className="bg-gradient-to-r from-cyan-500 to-blue-500 h-2 rounded-full transition-all"
                                  style={{ width: `${(recognitionFrames.length / 60) * 100}%` }}
                                ></div>
                              </div>
                            </div>
                          )}

                          {isMatching && (
                            <div className="flex items-center gap-2 bg-amber-500/10 rounded-lg p-3 border border-amber-500/20">
                              <div className="w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
                              <span className="text-sm text-amber-400">Analyzing gesture...</span>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="text-center py-8 text-gray-400">
                          {!isCameraActive ? (
                            <div>
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-2 mt-10 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                              <p className="text-md">Start camera to begin</p>
                            </div>
                          ) : (
                            <div>
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-2 mt-10 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
                              </svg>
                              <p className="text-md">Show your hand</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Matched Gesture */}
                  {matchedGesture && (
                    <div className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 backdrop-blur-md rounded-2xl p-5 border border-green-500/40 shadow-xl">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-green-500/30 flex items-center justify-center flex-shrink-0">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between items-start mb-1">
                            <p className="font-bold text-green-300">{matchedGesture.name}</p>
                            <span className="text-xs bg-green-500/30 px-2 py-1 rounded-full text-green-300">{(similarity * 100).toFixed(0)}%</span>
                          </div>
                          <p className="text-xs text-green-200/80">Action: {matchedGesture.action}</p>
                          <p className="text-xs text-green-200/60">Context: {matchedGesture.app_context}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* App Context Selector */}
                  <div className="bg-gray-800/30 backdrop-blur-md rounded-3xl p-6 py-8 border border-cyan-500/20 shadow-xl">
                    <div className="flex items-center gap-2 mb-4">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      <h3 className="text-sm font-bold text-white">Application Context</h3>
                    </div>
                    <select
                      value={activeApp}
                      onChange={(e) => setActiveApp(e.target.value)}
                      className="w-full bg-gray-700/50 border-2 border-cyan-500/30 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer font-medium"
                    >
                      {apps.map(app => (
                        <option key={app} value={app} className="bg-gray-900">{app}</option>
                      ))}
                    </select>
                  </div>

                </div>
              </div>

              {/* Bottom Section: Quick Actions */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Link href="/User/gestures-management" className="group bg-gray-800/30 backdrop-blur-md rounded-3xl p-6 border border-cyan-500/20 hover:border-cyan-500/40 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-cyan-500/20 cursor-pointer">
                  <div className="flex items-center gap-4 mb-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-bold text-cyan-200 group-hover:text-cyan-100 transition-colors">Manage Gestures</h3>
                  </div>
                  <p className="text-sm text-cyan-300/80">Create and manage your custom hand gestures</p>
                </Link>

                <Link href="/User/settings" className="group bg-gray-800/30 backdrop-blur-md rounded-3xl p-6 border border-purple-500/20 hover:border-purple-500/40 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-purple-500/20 cursor-pointer">
                  <div className="flex items-center gap-4 mb-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-bold text-purple-200 group-hover:text-purple-100 transition-colors">Settings</h3>
                  </div>
                  <p className="text-sm text-purple-300/80">Configure system preferences and options</p>
                </Link>

                <div className="bg-gray-800/30 backdrop-blur-md rounded-3xl p-6 border border-amber-500/20 shadow-xl">
                  <div className="flex items-center gap-4 mb-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-bold text-amber-200">Performance</h3>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-amber-300/80">Latency</span>
                      <span className="font-bold text-green-400">{isConnected ? '~33ms' : 'N/A'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-amber-300/80">Frame Rate</span>
                      <span className="font-bold text-green-400">{isConnected ? '30 FPS' : 'N/A'}</span>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}