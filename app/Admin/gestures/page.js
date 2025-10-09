'use client';

import { useState, useEffect } from 'react';
import Head from 'next/head';
import AdminSidebar from '../../components/AdminSidebar';
import ProtectedRoute from '@/app/components/ProtectedRoute';

export default function GestureProfileManagement() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [profiles, setProfiles] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [currentProfile, setCurrentProfile] = useState({
    id: '',
    name: '',
    gesture: '',
    action: '',
    appContext: '',
    isActive: true
  });
  const [showTestModal, setShowTestModal] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const gestureOptions = [
    'SWIPE_LEFT',
    'SWIPE_RIGHT', 
    'PINCH_TO_ZOOM',
    'THUMB_UP',
    'FIST',
    'OPEN_HAND',
    'TWO_FINGERS_TAP',
    'THREE_FINGERS_SWIPE'
  ];

  const actionOptions = [
    'PLAY_PAUSE',
    'VOLUME_UP',
    'VOLUME_DOWN',
    'NEXT_TRACK',
    'PREV_TRACK',
    'MUTE_MIC',
    'SCREENSHOT',
    'OPEN_APP'
  ];

  const appContexts = ['GLOBAL', 'YOUTUBE', 'POWERPOINT', 'ZOOM', 'SPOTIFY', 'NETFLIX'];

  // Load profiles from mock database
  useEffect(() => {
    const mockProfiles = [
      { id: '1', name: 'YouTube Play/Pause', gesture: 'THUMB_UP', action: 'PLAY_PAUSE', appContext: 'YOUTUBE', isActive: true },
      { id: '2', name: 'Zoom Mute', gesture: 'FIST', action: 'MUTE_MIC', appContext: 'ZOOM', isActive: true },
      { id: '3', name: 'Global Volume Up', gesture: 'SWIPE_UP', action: 'VOLUME_UP', appContext: 'GLOBAL', isActive: true },
      { id: '4', name: 'PowerPoint Next', gesture: 'SWIPE_RIGHT', action: 'NEXT_TRACK', appContext: 'POWERPOINT', isActive: false }
    ];
    setProfiles(mockProfiles);
  }, []);

  const handleAddProfile = () => {
    setCurrentProfile({
      id: '',
      name: '',
      gesture: '',
      action: '',
      appContext: 'GLOBAL',
      isActive: true
    });
    setIsEditing(true);
  };

  const handleEditProfile = (profile) => {
    setCurrentProfile(profile);
    setIsEditing(true);
  };

  const handleSaveProfile = () => {
    if (currentProfile.id) {
      // Update existing
      setProfiles(profiles.map(p => p.id === currentProfile.id ? currentProfile : p));
    } else {
      // Add new
      const newProfile = { ...currentProfile, id: Date.now().toString() };
      setProfiles([...profiles, newProfile]);
    }
    setIsEditing(false);
    setCurrentProfile({
      id: '',
      name: '',
      gesture: '',
      action: '',
      appContext: '',
      isActive: true
    });
  };

  const handleDeleteProfile = (id) => {
    if (confirm('Are you sure you want to delete this gesture profile?')) {
      setProfiles(profiles.filter(p => p.id !== id));
    }
  };

  const handleTestGesture = () => {
    setShowTestModal(true);
    setTestResult(null);
    
    // Simulate gesture test
    setTimeout(() => {
      const success = Math.random() > 0.3;
      setTestResult({
        success,
        message: success 
          ? 'Gesture detected successfully! Mapping is working correctly.' 
          : 'Gesture not recognized. Please check your gesture definition.'
      });
    }, 2000);
  };

  return (
    <ProtectedRoute allowedRoles={['ADMIN']}>
        <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800 text-white">
      <Head>
        <title>Gesture Profiles | Admin Dashboard</title>
        <meta name="description" content="Manage gesture to action mappings" />
      </Head>

      <AdminSidebar 
        isOpen={isSidebarOpen} 
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)} 
        activeTab="gestures" 
      />

      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        ></div>
      )}

      <main className="md:ml-64 min-h-screen p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500">
              Gesture Profile Management
            </h1>
            <p className="text-purple-200">Manage global gesture → action mappings across different applications</p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <button
              onClick={handleAddProfile}
              className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl font-medium hover:from-cyan-600 hover:to-blue-700 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-opacity-50"
            >
              Add New Profile
            </button>
            <button
              onClick={handleTestGesture}
              className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl font-medium hover:from-purple-600 hover:to-pink-700 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-opacity-50"
            >
              Live Test Gesture
            </button>
          </div>

          {/* Profiles Table */}
          <div className="bg-gray-800/30 backdrop-blur-sm rounded-2xl border border-cyan-500/20 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-cyan-500/20">
                  <tr>
                    <th className="text-center p-4 font-semibold text-cyan-200">Profile Name</th>
                    <th className="text-center p-4 font-semibold text-cyan-200">Gesture</th>
                    <th className="text-center p-4 font-semibold text-cyan-200">Action</th>
                    <th className="text-center p-4 font-semibold text-cyan-200">App Context</th>
                    <th className="text-center p-4 font-semibold text-cyan-200">Status</th>
                    <th className="text-right p-4 font-semibold text-cyan-200">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {profiles.map((profile) => (
                    <tr key={profile.id} className="border-b border-gray-700/50 hover:bg-gray-800/20 text-center transition-colors">
                      <td className="p-4 font-medium">{profile.name}</td>
                      <td className="p-4 text-cyan-300">{profile.gesture}</td>
                      <td className="p-4 text-emerald-300">{profile.action}</td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          profile.appContext === 'GLOBAL' 
                            ? 'bg-purple-500/20 text-purple-300' 
                            : 'bg-blue-500/20 text-blue-300'
                        }`}>
                          {profile.appContext}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          profile.isActive 
                            ? 'bg-green-500/20 text-green-300' 
                            : 'bg-amber-500/20 text-amber-300'
                        }`}>
                          {profile.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => handleEditProfile(profile)}
                            className="p-2 rounded-lg hover:bg-cyan-500/10 transition-colors"
                            title="Edit"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDeleteProfile(profile.id)}
                            className="p-2 rounded-lg hover:bg-rose-500/10 transition-colors"
                            title="Delete"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Edit Modal */}
          {isEditing && (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="relative w-full max-w-2xl bg-gray-900/90 backdrop-blur-lg rounded-2xl overflow-hidden border border-cyan-500/30 shadow-2xl">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 to-blue-500"></div>
                
                <div className="p-6">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500">
                      {currentProfile.id ? 'Edit Profile' : 'Add New Profile'}
                    </h2>
                    <button 
                      onClick={() => setIsEditing(false)}
                      className="text-gray-400 hover:text-white transition-colors p-2 rounded-full hover:bg-gray-800/50"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2 text-cyan-200">Profile Name</label>
                      <input
                        type="text"
                        value={currentProfile.name}
                        onChange={(e) => setCurrentProfile({...currentProfile, name: e.target.value})}
                        className="w-full bg-gray-800/50 border border-cyan-500/30 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-white"
                        placeholder="e.g., YouTube Play/Pause"
                      />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2 text-cyan-200">Gesture</label>
                        <select
                          value={currentProfile.gesture}
                          onChange={(e) => setCurrentProfile({...currentProfile, gesture: e.target.value})}
                          className="w-full bg-gray-800/50 border border-cyan-500/30 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-white"
                        >
                          <option value="">Select Gesture</option>
                          {gestureOptions.map(gesture => (
                            <option key={gesture} value={gesture}>{gesture.replace(/_/g, ' ')}</option>
                          ))}
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium mb-2 text-cyan-200">Action</label>
                        <select
                          value={currentProfile.action}
                          onChange={(e) => setCurrentProfile({...currentProfile, action: e.target.value})}
                          className="w-full bg-gray-800/50 border border-cyan-500/30 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-white"
                        >
                          <option value="">Select Action</option>
                          {actionOptions.map(action => (
                            <option key={action} value={action}>{action.replace(/_/g, ' ')}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium mb-2 text-cyan-200">Application Context</label>
                      <select
                        value={currentProfile.appContext}
                        onChange={(e) => setCurrentProfile({...currentProfile, appContext: e.target.value})}
                        className="w-full bg-gray-800/50 border border-cyan-500/30 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-white"
                      >
                        {appContexts.map(context => (
                          <option key={context} value={context}>{context === 'GLOBAL' ? 'Global (All Apps)' : context}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="isActive"
                        checked={currentProfile.isActive}
                        onChange={(e) => setCurrentProfile({...currentProfile, isActive: e.target.checked})}
                        className="w-4 h-4 text-cyan-500 bg-gray-700 border-gray-600 rounded focus:ring-cyan-500 focus:ring-2"
                      />
                      <label htmlFor="isActive" className="ml-2 text-sm font-medium text-gray-300">Active</label>
                    </div>
                  </div>
                  
                  <div className="flex gap-4 pt-6">
                    <button
                      onClick={handleSaveProfile}
                      className="flex-1 py-3 px-6 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl font-medium hover:from-cyan-600 hover:to-blue-700 transition-all duration-300"
                    >
                      Save Profile
                    </button>
                    <button
                      onClick={() => setIsEditing(false)}
                      className="flex-1 py-3 px-6 bg-gray-700 rounded-xl font-medium hover:bg-gray-600 transition-all duration-300"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Test Modal */}
          {showTestModal && (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="relative w-full max-w-md bg-gray-900/90 backdrop-blur-lg rounded-2xl overflow-hidden border border-cyan-500/30 shadow-2xl">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 to-blue-500"></div>
                
                <div className="p-6">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500">
                      Live Gesture Test
                    </h2>
                    <button 
                      onClick={() => setShowTestModal(false)}
                      className="text-gray-400 hover:text-white transition-colors p-2 rounded-full hover:bg-gray-800/50"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  
                  <div className="text-center py-8">
                    {testResult === null ? (
                      <>
                        <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center animate-pulse">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <p className="text-lg mb-2">Position your hand in front of the camera</p>
                        <p className="text-cyan-300 text-sm">Make the gesture you want to test</p>
                        <div className="mt-4 w-full bg-gray-700 rounded-full h-2">
                          <div className="bg-gradient-to-r from-cyan-500 to-blue-500 h-2 rounded-full animate-pulse" style={{width: '60%'}}></div>
                        </div>
                      </>
                    ) : (
                      <div className={`p-6 rounded-xl ${testResult.success ? 'bg-green-500/20 border border-green-500/30' : 'bg-amber-500/20 border border-amber-500/30'}`}>
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center">
                          {testResult.success ? (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                          )}
                        </div>
                        <p className="text-lg font-medium mb-2">{testResult.success ? 'Success!' : 'Test Failed'}</p>
                        <p className={testResult.success ? 'text-green-300' : 'text-amber-300'}>{testResult.message}</p>
                      </div>
                    )}
                  </div>
                  
                  {testResult && (
                    <div className="flex gap-4 pt-4">
                      <button
                        onClick={() => setShowTestModal(false)}
                        className="flex-1 py-3 px-6 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl font-medium hover:from-cyan-600 hover:to-blue-700 transition-all duration-300"
                      >
                        Close
                      </button>
                      {!testResult.success && (
                        <button
                          onClick={() => {
                            setTestResult(null);
                            setTimeout(() => {
                              const success = Math.random() > 0.3;
                              setTestResult({
                                success,
                                message: success 
                                  ? 'Gesture detected successfully! Mapping is working correctly.' 
                                  : 'Gesture not recognized. Please check your gesture definition.'
                              });
                            }, 2000);
                          }}
                          className="flex-1 py-3 px-6 bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl font-medium hover:from-purple-600 hover:to-pink-700 transition-all duration-300"
                        >
                          Retry Test
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
    </ProtectedRoute>
    
  );
}