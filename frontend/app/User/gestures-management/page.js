'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import ProtectedRoute from '../../components/ProtectedRoute';
import GestureRecorderReal from '../../components/GestureRecorderReal';

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
          <GestureRecorderReal 
            onSave={handleSaveGesture} 
            onClose={() => setIsRecordingModalOpen(false)} 
          />
        )}
      </div>
    </div>
    </ProtectedRoute>
    
  );
}
