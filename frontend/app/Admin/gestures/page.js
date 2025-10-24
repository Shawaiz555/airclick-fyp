/**
 * AirClick - Admin Gesture Profile Management
 * =============================================
 *
 * This page allows administrators to manage gesture profiles and
 * test gestures in real-time using the Python MediaPipe backend.
 *
 * Features:
 * - Create/edit/delete gesture profiles
 * - Live gesture testing with camera
 * - Gesture-to-action mappings
 * - Application context management
 *
 * Author: Muhammad Shawaiz
 * Project: AirClick FYP
 */

'use client';

import { useState, useEffect } from 'react';
import Head from 'next/head';
import AdminSidebar from '../../components/AdminSidebar';
import ProtectedRoute from '../../components/ProtectedRoute';
import LoadingSpinner from '../../components/LoadingSpinner';
import GestureTester from '../../components/GestureTester';
import toast from 'react-hot-toast';
import ConfirmModal from '../../components/ConfirmModal';

export default function GestureProfileManagement() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [profileToDelete, setProfileToDelete] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterContext, setFilterContext] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [viewMode, setViewMode] = useState('cards'); // 'cards' or 'table'

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
    const loadProfiles = async () => {
      // Simulate loading from API
      await new Promise(resolve => setTimeout(resolve, 500));
      const mockProfiles = [
        { id: '1', name: 'YouTube Play/Pause', gesture: 'THUMB_UP', action: 'PLAY_PAUSE', appContext: 'YOUTUBE', isActive: true },
        { id: '2', name: 'Zoom Mute', gesture: 'FIST', action: 'MUTE_MIC', appContext: 'ZOOM', isActive: true },
        { id: '3', name: 'Global Volume Up', gesture: 'SWIPE_UP', action: 'VOLUME_UP', appContext: 'GLOBAL', isActive: true },
        { id: '4', name: 'PowerPoint Next', gesture: 'SWIPE_RIGHT', action: 'NEXT_TRACK', appContext: 'POWERPOINT', isActive: false }
      ];
      setProfiles(mockProfiles);
      setIsLoading(false);
    };
    loadProfiles();
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
      toast.success('Gesture profile updated successfully');
    } else {
      // Add new
      const newProfile = { ...currentProfile, id: Date.now().toString() };
      setProfiles([...profiles, newProfile]);
      toast.success('Gesture profile created successfully');
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
    setProfileToDelete(id);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    setProfiles(profiles.filter(p => p.id !== profileToDelete));
    toast.success('Gesture profile deleted successfully');
    setProfileToDelete(null);
  };

  /**
   * Handle live gesture testing
   * Opens the GestureTester component which connects to Python MediaPipe backend
   */
  const handleTestGesture = () => {
    setShowTestModal(true);
    setTestResult(null);
  };

  /**
   * Handle test completion callback from GestureTester
   * @param {Object} result - Test result {success: boolean, gesture?: string}
   */
  const handleTestComplete = (result) => {
    setTestResult({
      success: result.success,
      message: result.success
        ? `Gesture "${result.gesture}" detected successfully! Mapping is working correctly.`
        : 'Gesture not recognized. Please check your gesture definition.'
    });
  };

  // Dynamic data calculations
  const availableContexts = ['ALL', ...new Set(profiles.map(p => p.appContext))].sort((a, b) => {
    if (a === 'ALL') return -1;
    if (b === 'ALL') return 1;
    return a.localeCompare(b);
  });

  // Filter and search logic
  const filteredProfiles = profiles.filter(profile => {
    const matchesSearch = profile.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      profile.gesture.toLowerCase().includes(searchQuery.toLowerCase()) ||
      profile.action.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesContext = filterContext === 'ALL' || profile.appContext === filterContext;
    const matchesStatus = filterStatus === 'ALL' ||
      (filterStatus === 'ACTIVE' && profile.isActive) ||
      (filterStatus === 'INACTIVE' && !profile.isActive);
    return matchesSearch && matchesContext && matchesStatus;
  });

  // Statistics
  const stats = {
    total: profiles.length,
    active: profiles.filter(p => p.isActive).length,
    inactive: profiles.filter(p => !p.isActive).length,
    global: profiles.filter(p => p.appContext === 'GLOBAL').length
  };

  // Get context color
  const getContextColor = (context) => {
    const colors = {
      'GLOBAL': { bg: 'bg-purple-500/20', text: 'text-purple-300', border: 'border-purple-500/30', gradient: 'from-purple-500 to-pink-500' },
      'YOUTUBE': { bg: 'bg-red-500/20', text: 'text-red-300', border: 'border-red-500/30', gradient: 'from-red-500 to-rose-500' },
      'POWERPOINT': { bg: 'bg-orange-500/20', text: 'text-orange-300', border: 'border-orange-500/30', gradient: 'from-orange-500 to-amber-500' },
      'ZOOM': { bg: 'bg-blue-500/20', text: 'text-blue-300', border: 'border-blue-500/30', gradient: 'from-blue-500 to-cyan-500' },
      'SPOTIFY': { bg: 'bg-emerald-500/20', text: 'text-emerald-300', border: 'border-emerald-500/30', gradient: 'from-emerald-500 to-green-500' },
      'NETFLIX': { bg: 'bg-rose-500/20', text: 'text-rose-300', border: 'border-rose-500/30', gradient: 'from-rose-500 to-red-500' }
    };
    return colors[context] || { bg: 'bg-cyan-500/20', text: 'text-cyan-300', border: 'border-cyan-500/30', gradient: 'from-cyan-500 to-blue-500' };
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

        <main className="md:ml-66 min-h-screen p-4 md:p-8">
          {isLoading ? (
            <div className="flex items-center justify-center min-h-[80vh]">
              <LoadingSpinner message="Loading gesture profiles..." size="lg" />
            </div>
          ) : (
            <div className="max-w-7xl">
              {/* Header */}
              <div className="mb-8">
                <h1 className="text-3xl md:text-4xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500">
                  Gesture Profile Management
                </h1>
                <p className="text-purple-200">Manage global gesture → action mappings across different applications</p>
              </div>

              {/* Statistics Overview */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div className="bg-gray-800/30 backdrop-blur-md rounded-2xl p-5 py-8 md:p-6 md:py-8 border border-cyan-500/20 hover:border-cyan-500/40 transition-all duration-300">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs md:text-lg font-bold text-gray-400">Total Profiles</p>
                      <p className="text-xl md:text-2xl font-bold text-white">{stats.total}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-800/30 backdrop-blur-md rounded-2xl p-5 py-8 md:p-6 md:py-8 border border-emerald-500/20 hover:border-emerald-500/40 transition-all duration-300">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500/20 to-green-500/20 border border-emerald-500/30">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs md:text-lg font-bold text-gray-400">Active</p>
                      <p className="text-xl md:text-2xl font-bold text-white">{stats.active}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-800/30 backdrop-blur-md rounded-2xl p-5 py-8 md:p-6 md:py-8 border border-amber-500/20 hover:border-amber-500/40 transition-all duration-300">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs md:text-lg font-bold text-gray-400">Inactive</p>
                      <p className="text-xl md:text-2xl font-bold text-white">{stats.inactive}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-800/30 backdrop-blur-md rounded-2xl p-5 py-8 md:p-6 md:py-8 border border-purple-500/20 hover:border-purple-500/40 transition-all duration-300">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs md:text-lg font-bold text-gray-400">Global</p>
                      <p className="text-xl md:text-2xl font-bold text-white">{stats.global}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Search and Actions Bar */}
              <div className="bg-gray-800/30 backdrop-blur-sm rounded-2xl p-5 py-8 md:p-6 md:py-10 border border-cyan-500/20 mb-8">
                <div className="space-y-4">
                  {/* Top Row: Search and Action Buttons */}
                  <div className="flex flex-col lg:flex-row gap-3 lg:gap-4">
                    {/* Search Bar */}
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        placeholder="Search profiles, gestures, or actions..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-gray-800/50 border border-cyan-500/30 rounded-xl px-4 py-3 pl-11 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-white placeholder-gray-500"
                      />
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3">
                      <button
                        onClick={handleAddProfile}
                        className="flex-1 lg:flex-none px-4 md:px-6 py-3 hover:cursor-pointer bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl font-medium hover:from-cyan-600 hover:to-blue-700 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-opacity-50 flex items-center justify-center gap-2"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        <span className="hidden sm:inline">Add Profile</span>
                        <span className="sm:hidden">Add</span>
                      </button>
                      <button
                        onClick={handleTestGesture}
                        className="flex-1 lg:flex-none px-4 md:px-6 py-3 hover:cursor-pointer bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl font-medium hover:from-purple-600 hover:to-pink-700 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-opacity-50 flex items-center justify-center gap-2"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        <span className="hidden sm:inline">Test Gesture</span>
                        <span className="sm:hidden">Test</span>
                      </button>
                    </div>
                  </div>

                  {/* Bottom Row: Filters and View Toggle */}
                  <div className="flex flex-col sm:flex-row justify-between gap-3">
                    {/* Filters */}
                    <div className="flex flex-wrap gap-2">
                      {/* Context Filter */}
                      {availableContexts.map(context => {
                        const count = context === 'ALL' ? profiles.length : profiles.filter(p => p.appContext === context).length;
                        return (
                          <button
                            key={context}
                            onClick={() => setFilterContext(context)}
                            className={`px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-medium transition-all duration-300 hover:cursor-pointer ${filterContext === context
                                ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white'
                                : 'bg-gray-800/50 text-gray-300 hover:bg-gray-700/50'
                              }`}
                          >
                            {context} ({count})
                          </button>
                        );
                      })}

                      {/* Status Filter */}
                      <div className="w-full sm:w-auto border-l border-gray-700/50 pl-2 ml-2 flex gap-2">
                        {['ALL', 'ACTIVE', 'INACTIVE'].map(status => (
                          <button
                            key={status}
                            onClick={() => setFilterStatus(status)}
                            className={`px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-medium transition-all duration-300 hover:cursor-pointer ${filterStatus === status
                                ? status === 'ACTIVE'
                                  ? 'bg-gradient-to-r from-emerald-500 to-green-500 text-white'
                                  : status === 'INACTIVE'
                                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white'
                                    : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                                : 'bg-gray-800/50 text-gray-300 hover:bg-gray-700/50'
                              }`}
                          >
                            {status === 'ALL' ? 'All' : status === 'ACTIVE' ? 'Active' : 'Inactive'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* View Toggle */}
                    <div className="flex gap-2 bg-gray-800/50 p-1 rounded-lg w-full sm:w-auto">
                      <button
                        onClick={() => setViewMode('cards')}
                        className={`flex-1 sm:flex-none px-4 py-2 rounded-md text-sm font-medium transition-all duration-300 hover:cursor-pointer ${viewMode === 'cards'
                            ? 'bg-cyan-500 text-white'
                            : 'text-gray-400 hover:text-white'
                          }`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => setViewMode('table')}
                        className={`flex-1 sm:flex-none px-4 py-2 rounded-md text-sm font-medium transition-all duration-300 hover:cursor-pointer ${viewMode === 'table'
                            ? 'bg-cyan-500 text-white'
                            : 'text-gray-400 hover:text-white'
                          }`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Empty State */}
              {filteredProfiles.length === 0 ? (
                <div className="bg-gray-800/30 backdrop-blur-sm rounded-2xl border border-cyan-500/20 p-12 text-center">
                  <div className="max-w-md mx-auto">
                    <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-bold mb-2 text-white">No profiles found</h3>
                    <p className="text-gray-400 mb-6">
                      {searchQuery || filterContext !== 'ALL' || filterStatus !== 'ALL'
                        ? 'Try adjusting your search or filters'
                        : 'Get started by creating your first gesture profile'}
                    </p>
                    {(!searchQuery && filterContext === 'ALL' && filterStatus === 'ALL') && (
                      <button
                        onClick={handleAddProfile}
                        className="px-6 py-3 hover:cursor-pointer bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl font-medium hover:from-cyan-600 hover:to-blue-700 transition-all duration-300"
                      >
                        Create First Profile
                      </button>
                    )}
                  </div>
                </div>
              ) : viewMode === 'cards' ? (
                /* Card View */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredProfiles.map((profile) => {
                    const contextColors = getContextColor(profile.appContext);
                    return (
                      <div
                        key={profile.id}
                        className="group bg-gray-800/30 backdrop-blur-md rounded-2xl border border-gray-700/50 hover:border-cyan-500/50 transition-all duration-300 overflow-hidden hover:scale-[1.02] hover:shadow-xl hover:shadow-cyan-500/10"
                      >
                        {/* Color Stripe */}
                        <div className={`h-1.5 bg-gradient-to-r ${contextColors.gradient}`}></div>

                        <div className="p-6">
                          {/* Header */}
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex-1">
                              <h3 className="text-lg font-bold text-white mb-1">{profile.name}</h3>
                              <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${contextColors.bg} ${contextColors.text} border ${contextColors.border}`}>
                                {profile.appContext}
                              </span>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${profile.isActive
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              }`}>
                              {profile.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </div>

                          {/* Gesture and Action */}
                          <div className="space-y-3 mb-4">
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
                                </svg>
                              </div>
                              <div>
                                <p className="text-xs text-gray-400">Gesture</p>
                                <p className="text-sm font-medium text-cyan-300">{profile.gesture.replace(/_/g, ' ')}</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                              </div>
                              <div>
                                <p className="text-xs text-gray-400">Action</p>
                                <p className="text-sm font-medium text-emerald-300">{profile.action.replace(/_/g, ' ')}</p>
                              </div>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex gap-2 pt-4 border-t border-gray-700/50">
                            <button
                              onClick={() => handleEditProfile(profile)}
                              className="flex-1 py-2 px-4 hover:cursor-pointer bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 hover:border-cyan-500/50 rounded-lg transition-all duration-300 flex items-center justify-center gap-2 text-cyan-300 hover:text-cyan-200"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                              <span className="text-sm font-medium">Edit</span>
                            </button>
                            <button
                              onClick={() => handleDeleteProfile(profile.id)}
                              className="flex-1 py-2 px-4 hover:cursor-pointer bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 hover:border-rose-500/50 rounded-lg transition-all duration-300 flex items-center justify-center gap-2 text-rose-300 hover:text-rose-200"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              <span className="text-sm font-medium">Delete</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Table View */
                <div className="bg-gray-800/30 backdrop-blur-sm rounded-2xl border border-cyan-500/20 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="border-b border-cyan-500/20 bg-gray-800/50">
                        <tr>
                          <th className="text-left p-4 font-semibold text-cyan-200">Profile Name</th>
                          <th className="text-center p-4 font-semibold text-cyan-200">Gesture</th>
                          <th className="text-center p-4 font-semibold text-cyan-200">Action</th>
                          <th className="text-center p-4 font-semibold text-cyan-200">App Context</th>
                          <th className="text-center p-4 font-semibold text-cyan-200">Status</th>
                          <th className="text-right p-4 font-semibold text-cyan-200">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredProfiles.map((profile) => {
                          const contextColors = getContextColor(profile.appContext);
                          return (
                            <tr key={profile.id} className="border-b border-gray-700/50 hover:bg-gray-800/30 transition-colors">
                              <td className="p-4 font-medium text-white">{profile.name}</td>
                              <td className="p-4 text-center">
                                <span className="text-cyan-300 text-sm">{profile.gesture.replace(/_/g, ' ')}</span>
                              </td>
                              <td className="p-4 text-center">
                                <span className="text-emerald-300 text-sm">{profile.action.replace(/_/g, ' ')}</span>
                              </td>
                              <td className="p-4 text-center">
                                <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${contextColors.bg} ${contextColors.text} border ${contextColors.border}`}>
                                  {profile.appContext}
                                </span>
                              </td>
                              <td className="p-4 text-center">
                                <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${profile.isActive
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                  }`}>
                                  {profile.isActive ? 'Active' : 'Inactive'}
                                </span>
                              </td>
                              <td className="p-4 text-right">
                                <div className="flex justify-end space-x-2">
                                  <button
                                    onClick={() => handleEditProfile(profile)}
                                    className="p-2 rounded-lg hover:cursor-pointer hover:bg-cyan-500/10 transition-colors group"
                                    title="Edit"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-cyan-400 group-hover:text-cyan-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => handleDeleteProfile(profile.id)}
                                    className="p-2 rounded-lg hover:cursor-pointer hover:bg-rose-500/10 transition-colors group"
                                    title="Delete"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-rose-400 group-hover:text-rose-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Edit Modal */}
              {isEditing && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                  <div className="relative w-full max-w-xl bg-gray-900/90 backdrop-blur-lg rounded-2xl overflow-hidden border border-cyan-500/30 shadow-2xl">
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 to-blue-500"></div>

                    <div className="p-10 py-8">
                      <div className="flex justify-between items-center mb-6">
                        <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500">
                          {currentProfile.id ? 'Edit Profile' : 'Add New Profile'}
                        </h2>
                        <button
                          onClick={() => setIsEditing(false)}
                          className="text-gray-400 hover:cursor-pointer hover:text-white transition-colors p-2 rounded-full hover:bg-gray-800/50"
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
                            onChange={(e) => setCurrentProfile({ ...currentProfile, name: e.target.value })}
                            className="w-full bg-gray-800/50 border border-cyan-500/30 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-white"
                            placeholder="e.g., YouTube Play/Pause"
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium mb-2 text-cyan-200">Gesture</label>
                            <select
                              value={currentProfile.gesture}
                              onChange={(e) => setCurrentProfile({ ...currentProfile, gesture: e.target.value })}
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
                              onChange={(e) => setCurrentProfile({ ...currentProfile, action: e.target.value })}
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
                            onChange={(e) => setCurrentProfile({ ...currentProfile, appContext: e.target.value })}
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
                            onChange={(e) => setCurrentProfile({ ...currentProfile, isActive: e.target.checked })}
                            className="w-4 h-4 text-cyan-500 bg-gray-700 border-gray-600 rounded focus:ring-cyan-500 focus:ring-2"
                          />
                          <label htmlFor="isActive" className="ml-2 text-sm font-medium text-gray-300">Active</label>
                        </div>
                      </div>

                      <div className="flex gap-4 pt-6">
                        <button
                          onClick={handleSaveProfile}
                          className="flex-1 py-3 hover:cursor-pointer px-6 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl font-medium hover:from-cyan-600 hover:to-blue-700 transition-all duration-300"
                        >
                          Save Profile
                        </button>
                        <button
                          onClick={() => setIsEditing(false)}
                          className="flex-1 py-3 px-6 hover:cursor-pointer bg-gray-700 rounded-xl font-medium hover:bg-gray-600 transition-all duration-300"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Test Modal - Real gesture testing with camera */}
              {showTestModal && (
                <GestureTester
                  onClose={() => setShowTestModal(false)}
                  onTestComplete={handleTestComplete}
                />
              )}

              {/* Delete Confirmation Modal */}
              <ConfirmModal
                isOpen={showDeleteConfirm}
                onClose={() => {
                  setShowDeleteConfirm(false);
                  setProfileToDelete(null);
                }}
                onConfirm={confirmDelete}
                title="Delete Gesture Profile"
                message="Are you sure you want to delete this gesture profile? This action cannot be undone."
                confirmText="Delete"
                cancelText="Cancel"
              />
            </div>
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
}