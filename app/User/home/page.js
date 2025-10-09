// app/page.js
'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import ProtectedRoute from '@/app/components/ProtectedRoute';

export default function Home() {
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [detectedGesture, setDetectedGesture] = useState(null);
  const [activeApp, setActiveApp] = useState('PowerPoint');
  const [hybridMode, setHybridMode] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [landmarkDetected, setLandmarkDetected] = useState(false);
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const apps = ['PowerPoint', 'YouTube', 'Zoom', 'Spotify', 'Netflix', 'Global'];

  // Simulate camera and gesture detection
  useEffect(() => {
    if (isCameraActive) {
      setIsProcessing(true);
      setLandmarkDetected(false);
      
      // Simulate hand detection
      const detectionTimer = setTimeout(() => {
        setLandmarkDetected(true);
        setIsProcessing(false);
      }, 1500);
      
      // Simulate gesture detection
      const gestureTimer = setInterval(() => {
        if (landmarkDetected) {
          const gestures = ['Swipe Left', 'Swipe Right', 'Pinch to Zoom', 'Thumb Up', 'Fist'];
          const randomGesture = gestures[Math.floor(Math.random() * gestures.length)];
          setDetectedGesture({
            gesture: randomGesture,
            timestamp: Date.now()
          });
          
          // Clear after 3 seconds
          setTimeout(() => {
            setDetectedGesture(prev => prev?.timestamp === Date.now() - 3000 ? null : prev);
          }, 3000);
        }
      }, 4000);
      
      return () => {
        clearTimeout(detectionTimer);
        clearInterval(gestureTimer);
      };
    }
  }, [isCameraActive, landmarkDetected]);

  const toggleCamera = () => {
    setIsCameraActive(!isCameraActive);
    if (!isCameraActive) {
      setDetectedGesture(null);
      setLandmarkDetected(false);
    }
  };

  return (
    <ProtectedRoute allowedRoles={['USER']}>
          <div className="md:ml-64 min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800 text-white">
      <div className="container mx-auto px-4 py-12">
        {/* Main Content */}
        <div className="max-w-4xl mx-auto">
          {/* Camera Preview */}
          <div className="relative rounded-2xl overflow-hidden border-2 border-dashed border-cyan-500/30 bg-gray-800/50 aspect-video mb-6 flex items-center justify-center">
            {isCameraActive ? (
              <>
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-900/20 to-blue-900/20"></div>
                
                {/* Simulated hand skeleton */}
                {landmarkDetected && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="relative">
                      <div className="w-32 h-32 border-2 border-cyan-400 rounded-lg opacity-70 relative">
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-cyan-500 rounded-full opacity-60"></div>
                        <div className="absolute top-2 left-1/2 transform -translate-x-1/2 w-1 h-6 bg-cyan-400 rounded-full"></div>
                        <div className="absolute top-2 left-1/3 transform -translate-x-1/2 w-1 h-5 bg-cyan-400 rounded-full"></div>
                        <div className="absolute top-2 right-1/3 transform translate-x-1/2 w-1 h-5 bg-cyan-400 rounded-full"></div>
                        <div className="absolute top-2 right-1/2 transform translate-x-1/2 w-1 h-6 bg-cyan-400 rounded-full"></div>
                        <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 w-1 h-4 bg-cyan-400 rounded-full"></div>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="relative z-10 text-center">
                  {!landmarkDetected ? (
                    <div className="flex flex-col items-center">
                      <div className="w-12 h-12 mb-3 rounded-full bg-amber-500/20 flex items-center justify-center animate-pulse">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                      </div>
                      <p className="text-lg font-medium text-amber-300">Detecting hand...</p>
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
            
            {/* Camera status */}
            <div className="absolute top-4 right-4 bg-black/50 px-3 py-1 rounded-full text-xs flex items-center">
              <div className={`w-2 h-2 rounded-full mr-2 ${isCameraActive ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`}></div>
              <span>Camera: {isCameraActive ? 'Active' : 'Ready'}</span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-col sm:flex-row gap-4 mb-8">
            <button
              onClick={toggleCamera}
              className={`flex-1 py-4 px-6 rounded-xl font-bold text-lg transition-all duration-300 flex items-center justify-center gap-2 ${
                isCameraActive 
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
              className={`flex-1 py-4 px-6 rounded-xl font-bold text-lg transition-all duration-300 flex items-center justify-center gap-2 ${
                hybridMode 
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

          {/* Gesture Detection Feedback */}
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
              <p className="text-amber-300 text-sm">Latency: {Math.floor(Math.random() * 150) + 50}ms</p>
            </div>
          </div>
        </div>
      </div>
    </div>
    </ProtectedRoute>
    
  );
}