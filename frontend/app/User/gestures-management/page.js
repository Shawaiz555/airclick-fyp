'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import ProtectedRoute from '../../components/ProtectedRoute';
import LoadingSpinner from '../../components/LoadingSpinner';
import GestureRecorderReal from '../../components/GestureRecorderReal';
import toast from 'react-hot-toast';
import ConfirmModal from '../../components/ConfirmModal';

export default function CustomGestureManagement() {
  const [isRecordingModalOpen, setIsRecordingModalOpen] = useState(false);
  const [gestures, setGestures] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [gestureToDelete, setGestureToDelete] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterContext, setFilterContext] = useState('ALL');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'

  // Edit gesture state
  const [editingGesture, setEditingGesture] = useState(null);

  // Hybrid mode state management (for cursor control disable during recording)
  const [savedHybridMode, setSavedHybridMode] = useState(null);

  // Load gestures from database
  useEffect(() => {
    loadGesturesFromDatabase();
  }, []);

  // Disable hybrid mode when recording/editing starts
  const disableHybridMode = async () => {
    try {
      // Get current hybrid mode state from localStorage
      const currentHybridMode = localStorage.getItem('hybridMode');
      console.log('💡 Saving hybrid mode state:', currentHybridMode);

      // Save current state
      setSavedHybridMode(currentHybridMode);

      // Disable hybrid mode in localStorage
      localStorage.setItem('hybridMode', 'false');
      console.log('🛑 Hybrid mode disabled for gesture recording');

      // SET RECORDING STATE (disable gesture matching)
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('http://localhost:8000/api/gestures/recording-state', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ is_recording: true })
        });

        if (response.ok) {
          const data = await response.json();
          console.log('📹 Recording state set to TRUE', data);
          console.log('📂 File path:', data.path);
        } else {
          console.error('❌ Failed to set recording state:', response.status, response.statusText);
        }
      } catch (err) {
        console.error('❌ Network error setting recording state:', err);
      }

      // Sync to Electron overlay via token-helper
      try {
        await fetch('http://localhost:3001/save-hybrid-mode', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hybridMode: false })
        });
        console.log('✅ Hybrid mode synced to Electron overlay');
      } catch (err) {
        console.warn('⚠️ Could not sync to Electron (token-helper not running)');
      }

      // Broadcast change using CustomEvent (works in same window)
      window.dispatchEvent(new CustomEvent('hybridModeChange', {
        detail: { hybridMode: false, oldValue: currentHybridMode }
      }));

      // Also dispatch storage event for other tabs/windows
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'hybridMode',
        oldValue: currentHybridMode,
        newValue: 'false',
        storageArea: localStorage
      }));
    } catch (error) {
      console.error('Error disabling hybrid mode:', error);
    }
  };

  // Re-enable hybrid mode after recording/editing completes
  const restoreHybridMode = async () => {
    try {
      // Restore previous state (default to 'true' if it was null/undefined)
      const restoreValue = savedHybridMode !== null ? savedHybridMode : 'true';
      console.log('🔄 Restoring hybrid mode to:', restoreValue);

      localStorage.setItem('hybridMode', restoreValue);
      console.log('✅ Hybrid mode restored');

      // CLEAR RECORDING STATE (re-enable gesture matching)
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('http://localhost:8000/api/gestures/recording-state', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ is_recording: false })
        });

        if (response.ok) {
          const data = await response.json();
          console.log('📹 Recording state set to FALSE', data);
        } else {
          console.error('❌ Failed to clear recording state:', response.status);
        }
      } catch (err) {
        console.error('❌ Network error clearing recording state:', err);
      }

      // Sync to Electron overlay via token-helper
      try {
        await fetch('http://localhost:3001/save-hybrid-mode', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hybridMode: restoreValue === 'true' })
        });
        console.log('✅ Hybrid mode synced to Electron overlay');
      } catch (err) {
        console.warn('⚠️ Could not sync to Electron (token-helper not running)');
      }

      // Broadcast change using CustomEvent (works in same window)
      window.dispatchEvent(new CustomEvent('hybridModeChange', {
        detail: { hybridMode: restoreValue === 'true', oldValue: 'false' }
      }));

      // Also dispatch storage event for other tabs/windows
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'hybridMode',
        oldValue: 'false',
        newValue: restoreValue,
        storageArea: localStorage
      }));

      // Clear saved state
      setSavedHybridMode(null);
    } catch (error) {
      console.error('Error restoring hybrid mode:', error);
    }
  };

  const loadGesturesFromDatabase = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      // Optimize: Don't load landmark data for list view (reduces payload by ~90%)
      const response = await fetch('http://localhost:8000/api/gestures/?include_landmarks=false', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();

        // DEBUG: Log the first gesture to see its structure
        if (data.length > 0) {
          console.log('📊 First gesture data:', data[0]);
          console.log('📊 Landmark data:', data[0].landmark_data);
          console.log('📊 Metadata:', data[0].landmark_data?.metadata);
          console.log('📊 Total frames:', data[0].landmark_data?.metadata?.total_frames);
        }

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
    console.log('📝 handleSaveGesture called');

    // Gesture is already saved by GestureRecorderReal component
    // Just reload the list and show toast
    await loadGesturesFromDatabase();

    // Show success toast based on whether it was an edit or create
    if (editingGesture) {
      toast.success('Gesture updated successfully!');
    } else {
      toast.success('Gesture saved successfully!');
    }

    // Restore hybrid mode after successful save
    console.log('🔄 About to restore hybrid mode...');
    await restoreHybridMode();
    console.log('✅ Hybrid mode restoration complete');
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

  // Handle edit gesture - open recorder with existing data
  const handleEditGesture = (gesture) => {
    disableHybridMode();  // Disable hybrid mode before opening editor
    setEditingGesture(gesture);
  };

  // Handle opening new gesture recorder
  const handleOpenRecorder = () => {
    disableHybridMode();  // Disable hybrid mode before opening recorder
    setIsRecordingModalOpen(true);
  };

  // Handle closing recorder/editor without saving
  const handleCloseRecorder = () => {
    restoreHybridMode();  // Restore hybrid mode when closing without save
    setIsRecordingModalOpen(false);
  };

  const handleCloseEditor = () => {
    restoreHybridMode();  // Restore hybrid mode when closing without save
    setEditingGesture(null);
  };

  // Dynamically get all unique contexts from gestures
  const availableContexts = ['ALL', ...new Set(gestures.map(g => g.app_context))].sort((a, b) => {
    if (a === 'ALL') return -1;
    if (b === 'ALL') return 1;
    return a.localeCompare(b);
  });

  // Filter and search gestures
  const filteredGestures = gestures.filter(gesture => {
    const matchesSearch = gesture.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      gesture.action.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesContext = filterContext === 'ALL' || gesture.app_context === filterContext;
    return matchesSearch && matchesContext;
  });

  // Calculate statistics dynamically
  const stats = {
    total: gestures.length,
    global: gestures.filter(g => g.app_context === 'GLOBAL').length,
    totalFrames: gestures.reduce((sum, g) => sum + (g.landmark_data?.metadata?.total_frames || g.landmark_data?.frames?.length || 0), 0),
    byContext: {} // Will be populated dynamically
  };

  // Populate context statistics dynamically
  availableContexts.forEach(context => {
    if (context !== 'ALL') {
      stats.byContext[context] = gestures.filter(g => g.app_context === context).length;
    }
  });

  // Get context color classes dynamically
  const getContextColor = (context) => {
    const colors = {
      'POWERPOINT': { bg: 'bg-purple-500/20', text: 'text-purple-300', border: 'border-purple-500/30', gradient: 'from-purple-500 to-pink-500' },
      'WORD': { bg: 'bg-emerald-500/20', text: 'text-emerald-300', border: 'border-emerald-500/30', gradient: 'from-emerald-500 to-teal-500' },
      'EXCEL': { bg: 'bg-green-500/20', text: 'text-green-300', border: 'border-green-500/30', gradient: 'from-green-500 to-emerald-500' },
      'CHROME': { bg: 'bg-blue-500/20', text: 'text-blue-300', border: 'border-blue-500/30', gradient: 'from-blue-500 to-cyan-500' },
      'GLOBAL': { bg: 'bg-amber-500/20', text: 'text-amber-300', border: 'border-amber-500/30', gradient: 'from-amber-500 to-orange-500' },
    };

    // Return specific color if exists, otherwise return a default cyan color
    return colors[context] || { bg: 'bg-cyan-500/20', text: 'text-cyan-300', border: 'border-cyan-500/30', gradient: 'from-cyan-500 to-blue-500' };
  };

  return (
    <ProtectedRoute allowedRoles={['USER']}>
      <div className="md:ml-64 min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800 text-white">
        {isLoading ? (
          <div className="flex items-center justify-center min-h-screen">
            <LoadingSpinner message="Loading gestures..." size="lg" />
          </div>
        ) : (
          <div className="py-6 md:py-10 px-4 lg:px-8">
            <div className="max-w-[1400px] mx-auto">
              {/* Header Section */}
              <div className="mb-8">
                <h1 className="text-3xl md:text-[44px] font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400">
                  Gesture Management
                </h1>
                <p className="text-purple-200/90">
                  Record, organize, and manage your custom hand gestures.
                </p>
              </div>

              {/* Actions Bar - Fully Responsive */}
              <div className="bg-gray-800/30 backdrop-blur-sm rounded-2xl p-4 md:p-6 border border-cyan-500/20 mb-8">
                <div className="space-y-4">
                  {/* Top Row: Search and Record Button */}
                  <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                    {/* Search */}
                    <div className="flex-1 w-full">
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                        </div>
                        <input
                          type="text"
                          placeholder="Search gestures..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full pl-10 pr-4 py-2.5 bg-gray-700/50 border border-cyan-500/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-300"
                        />
                      </div>
                    </div>

                    {/* Record Button */}
                    <button
                      onClick={handleOpenRecorder}
                      className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-lg font-bold hover:cursor-pointer shadow-lg hover:shadow-cyan-500/30 transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-opacity-50 flex items-center justify-center gap-2 whitespace-nowrap"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      <span className="hidden sm:inline">Record New</span>
                      <span className="sm:hidden">New Gesture</span>
                    </button>
                  </div>

                  {/* Bottom Row: Filters and View Toggle */}
                  <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-center justify-between">
                    {/* Filter by Context - Dynamic */}
                    <div className="flex gap-2 flex-wrap flex-1">
                      {availableContexts.map((context) => {
                        const count = context === 'ALL' ? stats.total : stats.byContext[context];
                        return (
                          <button
                            key={context}
                            onClick={() => setFilterContext(context)}
                            className={`px-3 sm:px-4 py-2 rounded-lg font-medium text-sm sm:text-base transition-all duration-300 hover:cursor-pointer ${filterContext === context
                              ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/30'
                              : 'bg-gray-700/50 text-gray-300 hover:bg-gray-700'
                              }`}
                          >
                            <span className="hidden sm:inline">{context}</span>
                            <span className="sm:hidden">{context.length > 8 ? context.substring(0, 8) + '...' : context}</span>
                            <span className="ml-1.5 sm:ml-2 text-xs opacity-75">({count})</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* View Mode Toggle */}
                    <div className="flex gap-2 bg-gray-700/50 rounded-lg p-1 w-full sm:w-auto justify-center">
                      <button
                        onClick={() => setViewMode('grid')}
                        className={`flex-1 sm:flex-none p-2 rounded-lg hover:cursor-pointer transition-all duration-300 ${viewMode === 'grid' ? 'bg-cyan-500 text-white' : 'text-gray-400 hover:text-white'
                          }`}
                        title="Grid view"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => setViewMode('list')}
                        className={`flex-1 sm:flex-none p-2 rounded-lg hover:cursor-pointer transition-all duration-300 ${viewMode === 'list' ? 'bg-cyan-500 text-white' : 'text-gray-400 hover:text-white'
                          }`}
                        title="List view"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Gesture List */}
              {filteredGestures.length === 0 ? (
                <div className="text-center py-16">
                  <div className="inline-block p-8 bg-gray-800/30 backdrop-blur-sm rounded-2xl border border-dashed border-cyan-500/30">
                    <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                      </svg>
                    </div>
                    <h3 className="text-2xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500">
                      {gestures.length === 0 ? 'No gestures recorded yet' : 'No gestures found'}
                    </h3>
                    <p className="text-purple-200 max-w-md mx-auto mb-6">
                      {gestures.length === 0
                        ? 'Start creating custom gestures to control your applications with hand movements'
                        : 'Try adjusting your search or filter criteria'}
                    </p>
                    {gestures.length === 0 && (
                      <button
                        onClick={handleOpenRecorder}
                        className="px-8 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl font-bold hover:cursor-pointer shadow-lg hover:shadow-cyan-500/30 transition-all duration-300 transform hover:scale-105"
                      >
                        Record Your First Gesture
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  {/* Results Count */}
                  <div className="mb-4 text-sm text-purple-200">
                    Showing {filteredGestures.length} of {gestures.length} gesture{gestures.length !== 1 ? 's' : ''}
                  </div>

                  {/* Grid View */}
                  {viewMode === 'grid' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {filteredGestures.map((gesture) => {
                        const colors = getContextColor(gesture.app_context);
                        return (
                          <div
                            key={gesture.id}
                            className="bg-gray-800/30 backdrop-blur-sm rounded-2xl overflow-hidden border border-cyan-500/20 transition-all duration-300 hover:border-cyan-500/40 hover:shadow-lg hover:shadow-cyan-500/10 hover:scale-[1.02]"
                          >
                            {/* Context Badge */}
                            <div className={`h-2 bg-gradient-to-r ${colors.gradient}`}></div>

                            <div className="p-6">
                              <div className="flex justify-between items-start mb-4">
                                <div className="flex-1">
                                  <h3 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500 mb-2">
                                    {gesture.name}
                                  </h3>
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${colors.bg} ${colors.text} border ${colors.border}`}>
                                      {gesture.app_context}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleEditGesture(gesture)}
                                    className="p-2 hover:cursor-pointer rounded-lg hover:bg-cyan-500/20 border border-transparent hover:border-cyan-500/30 transition-all duration-300"
                                    title="Edit gesture"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => handleDeleteGesture(gesture.id)}
                                    className="p-2 hover:cursor-pointer rounded-lg hover:bg-rose-500/20 border border-transparent hover:border-rose-500/30 transition-all duration-300"
                                    title="Delete gesture"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </div>
                              </div>

                              <div className="space-y-3">
                                <div className="flex items-center gap-2 text-cyan-300">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                  </svg>
                                  <span className="text-sm font-medium">Action:</span>
                                  <span className="text-sm text-gray-300">{gesture.action}</span>
                                </div>

                                <div className="flex items-center gap-2 text-purple-300">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                                  </svg>
                                  <span className="text-sm font-medium">Frames:</span>
                                  <span className="text-sm text-gray-300">
                                    {gesture.landmark_data?.metadata?.original_frame_count ??
                                     gesture.landmark_data?.frames?.length ??
                                     'N/A'} recorded frames
                                  </span>
                                </div>

                                <div className="flex items-center gap-2 text-gray-400">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  <span className="text-sm">{new Date(gesture.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                </div>

                                <div className="pt-3 mt-3 border-t border-gray-700/50 flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                                    <span className="text-xs text-green-400">Active</span>
                                  </div>
                                  <span className="text-xs text-gray-500">ID: {gesture.id}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    /* List View */
                    <div className="space-y-4">
                      {filteredGestures.map((gesture) => {
                        const colors = getContextColor(gesture.app_context);
                        return (
                          <div
                            key={gesture.id}
                            className="bg-gray-800/30 backdrop-blur-sm rounded-2xl border border-cyan-500/20 transition-all duration-300 hover:border-cyan-500/40 hover:shadow-lg hover:shadow-cyan-500/10"
                          >
                            <div className="p-6 flex items-center gap-6">
                              {/* Context Indicator */}
                              <div className={`w-1 h-20 rounded-full bg-gradient-to-b ${colors.gradient}`}></div>

                              {/* Main Info */}
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <h3 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500">
                                    {gesture.name}
                                  </h3>
                                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${colors.bg} ${colors.text} border ${colors.border}`}>
                                    {gesture.app_context}
                                  </span>
                                </div>
                                <div className="flex items-center gap-6 text-sm text-gray-400">
                                  <div className="flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                    <span className="text-cyan-300 font-medium">Action:</span>
                                    <span>{gesture.action}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                                    </svg>
                                    <span>
                                      {gesture.landmark_data?.metadata?.total_frames ??
                                       gesture.landmark_data?.frames?.length ??
                                       'N/A'} frames
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span>{new Date(gesture.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Actions */}
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleEditGesture(gesture)}
                                  className="p-3 hover:cursor-pointer rounded-xl hover:bg-cyan-500/20 border border-transparent hover:border-cyan-500/30 transition-all duration-300"
                                  title="Edit gesture"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => handleDeleteGesture(gesture.id)}
                                  className="p-3 hover:cursor-pointer rounded-xl hover:bg-rose-500/20 border border-transparent hover:border-rose-500/30 transition-all duration-300"
                                  title="Delete gesture"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Recording Modal - For creating new gestures */}
            {isRecordingModalOpen && (
              <GestureRecorderReal
                onSave={async (data) => {
                  await handleSaveGesture(data);
                  setIsRecordingModalOpen(false);
                }}
                onClose={handleCloseRecorder}
              />
            )}

            {/* Edit Gesture Modal - Same component, just with existing data */}
            {editingGesture && (
              <GestureRecorderReal
                editingGesture={editingGesture}
                onSave={async (data) => {
                  await handleSaveGesture(data);
                  setEditingGesture(null);
                }}
                onClose={handleCloseEditor}
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
        )}
      </div>
    </ProtectedRoute>
  );
}
