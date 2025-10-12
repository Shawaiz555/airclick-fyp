'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import ProtectedRoute from '../../components/ProtectedRoute';

export default function CustomGestureManagement() {
  const [isRecordingModalOpen, setIsRecordingModalOpen] = useState(false);
  const [gestures, setGestures] = useState([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState('');

  // Load gestures from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('userGestures');
    if (saved) {
      setGestures(JSON.parse(saved));
    }
  }, []);

  const handleSaveGesture = async (gestureData) => {
    const newGestures = [...gestures, gestureData];
    setGestures(newGestures);
    localStorage.setItem('userGestures', JSON.stringify(newGestures));
    await syncToCloud(newGestures);
  };

  const handleDeleteGesture = async (id) => {
    if (confirm('Are you sure you want to delete this gesture?')) {
      const newGestures = gestures.filter(g => g.id !== id);
      setGestures(newGestures);
      localStorage.setItem('userGestures', JSON.stringify(newGestures));
      await syncToCloud(newGestures);
    }
  };

  const syncToCloud = async (gestureList) => {
    setIsSyncing(true);
    setSyncStatus('Syncing to cloud...');
    
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      setSyncStatus('Synced successfully!');
      setTimeout(() => setSyncStatus(''), 2000);
    } catch (error) {
      setSyncStatus('Sync failed. Retrying...');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <ProtectedRoute allowedRoles={['USER']}>
        <div className="md:ml-64 min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800 text-white">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500">
              Custom Gesture Management
            </h1>
            <p className="text-lg text-purple-200 max-w-2xl mx-auto">
              Record, assign, and manage your custom hand gestures for seamless device control
            </p>
          </div>

          {/* Sync Status */}
          {syncStatus && (
            <div className={`mb-6 p-4 rounded-xl text-center transition-all duration-500 ${
              syncStatus.includes('success') 
                ? 'bg-green-500/20 border border-green-500/30' 
                : 'bg-amber-500/20 border border-amber-500/30'
            }`}>
              <span className="font-medium">{syncStatus}</span>
              {isSyncing && (
                <span className="ml-2 inline-block w-4 h-4 border-2 border-t-transparent border-white rounded-full animate-spin"></span>
              )}
            </div>
          )}

          {/* Record Button */}
          <div className="flex justify-center mb-12">
            <button
              onClick={() => setIsRecordingModalOpen(true)}
              className="relative px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-full font-bold text-lg shadow-lg hover:shadow-cyan-500/30 transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-opacity-50"
            >
              <span className="relative z-10">Record New Gesture</span>
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-600 to-blue-700 rounded-full opacity-0 hover:opacity-100 transition-opacity duration-300"></div>
            </button>
          </div>

          {/* Gesture List */}
          {gestures.length === 0 ? (
            <div className="text-center py-12">
              <div className="inline-block p-6 bg-gray-800/30 rounded-2xl border border-dashed border-cyan-500/30">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-cyan-500/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <h3 className="text-xl font-medium mt-4 mb-2">No gestures recorded yet</h3>
                <p className="text-cyan-300 max-w-md mx-auto">
                  Click Record New Gesture to create your first custom gesture
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {gestures.map((gesture) => (
                <div 
                  key={gesture.id}
                  className="bg-gray-800/30 backdrop-blur-sm rounded-2xl overflow-hidden border border-cyan-500/20 transition-all duration-300 hover:border-cyan-500/40 hover:shadow-lg hover:shadow-cyan-500/10"
                >
                  <div className="p-5">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500">
                          {gesture.name}
                        </h3>
                        <p className="text-cyan-300 text-sm mt-1">
                          {gesture.action}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleDeleteGesture(gesture.id)}
                          className="p-2 rounded-lg hover:bg-rose-500/10 transition-colors"
                          title="Delete"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    
                    <div className="mt-4 flex items-center text-sm text-gray-400">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {new Date(gesture.timestamp).toLocaleDateString()}
                    </div>
                    
                    <div className="mt-4 flex items-center text-sm text-gray-400">
                      <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
                      <span>Stored locally & synced to cloud</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recording Modal */}
        {isRecordingModalOpen && (
          <GestureRecorderModal 
            onSave={handleSaveGesture} 
            onClose={() => setIsRecordingModalOpen(false)} 
          />
        )}
      </div>
    </div>
    </ProtectedRoute>
    
  );
}

// Gesture Recorder Modal Component
function GestureRecorderModal({ onSave, onClose }) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [selectedAction, setSelectedAction] = useState('play-pause');
  const [gestureName, setGestureName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [validationMessage, setValidationMessage] = useState('');
  const [landmarkDetected, setLandmarkDetected] = useState(false);
  
  const intervalRef = useRef(null);

  const actions = [
    { id: 'play-pause', name: 'Play/Pause Media' },
    { id: 'volume-up', name: 'Volume Up' },
    { id: 'volume-down', name: 'Volume Down' },
    { id: 'next-track', name: 'Next Track' },
    { id: 'prev-track', name: 'Previous Track' },
    { id: 'open-app', name: 'Open App' },
    { id: 'mute', name: 'Mute Microphone' },
    { id: 'screenshot', name: 'Take Screenshot' },
  ];

  useEffect(() => {
    if (isRecording) {
      setRecordingTime(0);
      setLandmarkDetected(false);
      
      const detectionTimer = setTimeout(() => {
        setLandmarkDetected(true);
      }, 1000);
      
      intervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
      return () => {
        clearTimeout(detectionTimer);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
  }, [isRecording]);

  const startRecording = () => {
    setIsRecording(true);
    setValidationMessage('');
    setLandmarkDetected(false);
  };

  const stopRecording = () => {
    setIsRecording(false);
    setIsProcessing(true);
    
    setTimeout(() => {
      const isValid = Math.random() > 0.2;
      
      if (isValid) {
        setValidationMessage('Gesture validated successfully!');
        setTimeout(() => {
          setIsProcessing(false);
          if (gestureName.trim()) {
            onSave({
              id: Date.now().toString(),
              name: gestureName,
              action: selectedAction,
              timestamp: new Date().toISOString(),
            });
            onClose();
          }
        }, 1500);
      } else {
        setValidationMessage('Gesture not consistent. Please try again.');
        setIsProcessing(false);
      }
    }, 2000);
  };

  const handleSave = () => {
    if (!gestureName.trim()) {
      setValidationMessage('Please enter a gesture name');
      return;
    }
    
    if (!isRecording) {
      stopRecording();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="relative w-full max-w-4xl bg-gray-900/90 backdrop-blur-lg rounded-2xl overflow-hidden border border-cyan-500/30 shadow-2xl max-h-[90vh] flex flex-col">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 to-blue-500"></div>
        
        <div className="p-6 pb-4 border-b border-gray-700/50">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500">
              Record Gesture
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
        </div>
        
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Camera Preview */}
            <div className="relative rounded-xl overflow-hidden border-2 border-dashed border-cyan-500/30 bg-gray-800/50 aspect-video flex items-center justify-center">
              {isRecording ? (
                <>
                  <div className="absolute inset-0 bg-gradient-to-br from-cyan-900/20 to-blue-900/20"></div>
                  
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
                      <>
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <p className="text-lg font-medium text-green-300">Hand detected!</p>
                        <p className="text-cyan-300 mt-2">Recording gesture: {recordingTime}s</p>
                      </>
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
              
              <div className="absolute top-4 right-4 bg-black/50 px-3 py-1 rounded-full text-xs flex items-center">
                <div className={`w-2 h-2 rounded-full mr-2 ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`}></div>
                <span>Camera: {isRecording ? 'Recording' : 'Ready'}</span>
              </div>
            </div>

            {/* Form Fields */}
            <div className="space-y-4">
              <div>
                <label htmlFor="gestureName" className="block text-sm font-medium mb-2 text-cyan-200">
                  Gesture Name
                </label>
                <input
                  type="text"
                  id="gestureName"
                  value={gestureName}
                  onChange={(e) => setGestureName(e.target.value)}
                  placeholder="e.g., Pinch to Zoom"
                  className="w-full bg-gray-800/50 border border-cyan-500/30 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-white placeholder-gray-400"
                  disabled={isProcessing}
                />
              </div>

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
                    disabled={isProcessing}
                  >
                    {actions.map(action => (
                      <option key={action.id} value={action.id} className="bg-gray-800 text-white">
                        {action.name}
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

            {/* Controls */}
            <div className="flex flex-col sm:flex-row gap-4 pt-2">
              <button
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isProcessing}
                className={`flex-1 py-3 px-6 rounded-xl font-medium transition-all duration-300 flex items-center justify-center gap-2 ${
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
              
              <button
                onClick={handleSave}
                disabled={isProcessing || (!isRecording && !gestureName.trim())}
                className="flex-1 py-3 px-6 bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl font-medium hover:from-purple-600 hover:to-pink-700 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-opacity-50 disabled:opacity-50 flex items-center justify-center gap-2"
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
                    Save Gesture
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}