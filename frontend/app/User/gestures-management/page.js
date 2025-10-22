'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import ProtectedRoute from '../../components/ProtectedRoute';
import GestureRecorderReal from '../../components/GestureRecorderReal';
import toast from 'react-hot-toast';
import ConfirmModal from '../../components/ConfirmModal';

export default function CustomGestureManagement() {
  const [isRecordingModalOpen, setIsRecordingModalOpen] = useState(false);
  const [gestures, setGestures] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [gestureToDelete, setGestureToDelete] = useState(null);

  // Load gestures from database
  useEffect(() => {
    loadGesturesFromDatabase();
  }, []);

  const loadGesturesFromDatabase = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:8000/api/gestures/', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setGestures(data);
        if (data.length > 0) {
          toast.success(`Loaded ${data.length} gesture${data.length > 1 ? 's' : ''} from database`);
        }
      } else {
        toast.error('Failed to load gestures');
      }
    } catch (error) {
      console.error('Error loading gestures:', error);
      toast.error('Error loading gestures');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveGesture = async (gestureData) => {
    // Gesture is already saved by GestureRecorderReal component
    // Just reload the list
    await loadGesturesFromDatabase();
    toast.success('Gesture saved successfully!');
  };

  const handleDeleteGesture = async (id) => {
    setGestureToDelete(id);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:8000/api/gestures/${gestureToDelete}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        // Remove from local state
        setGestures(gestures.filter(g => g.id !== gestureToDelete));
        toast.success('Gesture deleted successfully!');
      } else {
        toast.error('Failed to delete gesture');
      }
    } catch (error) {
      console.error('Error deleting gesture:', error);
      toast.error('Error deleting gesture');
    } finally {
      setGestureToDelete(null);
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

          {/* Loading State */}
          {isLoading && (
            <div className="flex justify-center items-center py-12">
              <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
              <span className="ml-3 text-cyan-300">Loading gestures...</span>
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
          {!isLoading && (
            gestures.length === 0 ? (
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
                        <div className="flex-1">
                          <h3 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500">
                            {gesture.name}
                          </h3>
                          <p className="text-cyan-300 text-sm mt-1">
                            Action: {gesture.action}
                          </p>
                          <p className="text-purple-300 text-xs mt-1">
                            Context: {gesture.app_context}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleDeleteGesture(gesture.id)}
                            className="p-2 rounded-lg hover:bg-rose-500/10 transition-colors"
                            title="Delete gesture"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      <div className="mt-4 flex items-center text-sm text-gray-400">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                        </svg>
                        {gesture.landmark_data?.metadata?.total_frames || 0} frames
                      </div>

                      <div className="mt-2 flex items-center text-sm text-gray-400">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {new Date(gesture.created_at).toLocaleDateString()}
                      </div>

                      <div className="mt-4 flex items-center text-sm text-gray-400">
                        <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
                        <span>Stored in database</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>

        {/* Recording Modal */}
        {isRecordingModalOpen && (
          <GestureRecorderReal
            onSave={handleSaveGesture}
            onClose={() => setIsRecordingModalOpen(false)}
          />
        )}

        {/* Delete Confirmation Modal */}
        <ConfirmModal
          isOpen={showDeleteConfirm}
          onClose={() => {
            setShowDeleteConfirm(false);
            setGestureToDelete(null);
          }}
          onConfirm={confirmDelete}
          title="Delete Gesture"
          message="Are you sure you want to delete this gesture? This action cannot be undone."
          confirmText="Delete"
          cancelText="Cancel"
        />
      </div>
    </div>
    </ProtectedRoute>

  );
}
