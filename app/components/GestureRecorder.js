// components/GestureRecorder.js
import { useState, useRef, useEffect } from 'react';

export default function GestureRecorder({ onSave }) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [selectedAction, setSelectedAction] = useState('play-pause');
  const [gestureName, setGestureName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [validationMessage, setValidationMessage] = useState('');
  const [landmarkDetected, setLandmarkDetected] = useState(false);
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
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

  // Simulate camera access and hand detection
  useEffect(() => {
    if (isRecording) {
      setRecordingTime(0);
      setLandmarkDetected(false);
      
      // Simulate hand detection after 1 second
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
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRecording]);

  const startRecording = () => {
    setIsRecording(true);
    setValidationMessage('');
    setLandmarkDetected(false);
  };

  const stopRecording = () => {
    setIsRecording(false);
    setIsProcessing(true);
    
    // Simulate processing landmark vectors
    setTimeout(() => {
      // In a real app, this would process actual landmark data
      const isValid = Math.random() > 0.2; // 80% success rate for demo
      
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
              // In real app: landmarkData: processedLandmarks
            });
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
    <div className="space-y-6">
      {/* Camera Preview with Hand Detection Simulation */}
      <div className="relative rounded-xl overflow-hidden border-2 border-dashed border-cyan-500/30 bg-gray-800/50 aspect-video flex items-center justify-center">
        {isRecording ? (
          <>
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-900/20 to-blue-900/20"></div>
            
            {/* Simulated hand landmark visualization */}
            {landmarkDetected && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative">
                  {/* Simulated hand skeleton */}
                  <div className="w-32 h-32 border-2 border-cyan-400 rounded-lg opacity-70 relative">
                    {/* Palm */}
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-cyan-500 rounded-full opacity-60"></div>
                    
                    {/* Fingers */}
                    <div className="absolute top-2 left-1/2 transform -translate-x-1/2 w-1 h-6 bg-cyan-400 rounded-full"></div>
                    <div className="absolute top-2 left-1/3 transform -translate-x-1/2 w-1 h-5 bg-cyan-400 rounded-full"></div>
                    <div className="absolute top-2 right-1/3 transform translate-x-1/2 w-1 h-5 bg-cyan-400 rounded-full"></div>
                    <div className="absolute top-2 right-1/2 transform translate-x-1/2 w-1 h-6 bg-cyan-400 rounded-full"></div>
                    <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 w-1 h-4 bg-cyan-400 rounded-full"></div>
                  </div>
                  
                  {/* Connection lines */}
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                    <div className="w-16 h-0.5 bg-cyan-400 absolute top-0 left-0"></div>
                    <div className="w-12 h-0.5 bg-cyan-400 absolute top-2 left-2"></div>
                    <div className="w-12 h-0.5 bg-cyan-400 absolute top-2 right-2"></div>
                    <div className="w-16 h-0.5 bg-cyan-400 absolute bottom-0 left-0"></div>
                    <div className="w-8 h-0.5 bg-cyan-400 absolute bottom-4 left-4"></div>
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
        
        {/* Camera status indicator */}
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
  );
}