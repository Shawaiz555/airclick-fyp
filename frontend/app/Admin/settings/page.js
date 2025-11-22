// pages/admin/settings.js
'use client';

import { useState, useEffect } from 'react';
import AdminSidebar from '../../components/AdminSidebar';
import ProtectedRoute from '../../components/ProtectedRoute';
import LoadingSpinner from '../../components/LoadingSpinner';
import toast from 'react-hot-toast';
import ConfirmModal from '../../components/ConfirmModal';

export default function SystemSettings() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [settings, setSettings] = useState({
    systemName: 'Gesture Control Pro',
    maintenanceMode: false,
    maxConcurrentSessions: 1000,
    gestureSensitivity: 'medium',
    cloudSyncEnabled: true,
    auditLogging: true,
    emailNotifications: true,
    autoUpdate: true,
    dataRetentionDays: 30,
    defaultAppContext: 'GLOBAL'
  });
  const [isSaving, setIsSaving] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const appContexts = ['GLOBAL', 'YOUTUBE', 'POWERPOINT', 'ZOOM', 'SPOTIFY', 'NETFLIX'];
  const sensitivityLevels = [
    { value: 'low', label: 'Low (Less sensitive, fewer false triggers)' },
    { value: 'medium', label: 'Medium (Balanced accuracy and responsiveness)' },
    { value: 'high', label: 'High (More sensitive, may have more false triggers)' }
  ];

  useEffect(() => {
    // Simulate loading settings from API
    const loadSettings = async () => {
      await new Promise(resolve => setTimeout(resolve, 500));
      setIsLoading(false);
    };
    loadSettings();
  }, []);

  const handleInputChange = (field, value) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);

    try {
      // Simulate API call to save settings
      await new Promise(resolve => setTimeout(resolve, 1500));

      toast.success('Settings saved successfully!');
    } catch (error) {
      toast.error('Failed to save settings. Please try again.');
      console.error('Save error:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetSettings = () => {
    setShowResetConfirm(true);
  };

  const confirmReset = () => {
    setSettings({
      systemName: 'Gesture Control Pro',
      maintenanceMode: false,
      maxConcurrentSessions: 1000,
      gestureSensitivity: 'medium',
      cloudSyncEnabled: true,
      auditLogging: true,
      emailNotifications: true,
      autoUpdate: true,
      dataRetentionDays: 30,
      defaultAppContext: 'GLOBAL'
    });
    toast.success('Settings reset to defaults');
  };

  return (
    <ProtectedRoute allowedRoles={['ADMIN']}>
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800 text-white">
        <AdminSidebar
          isOpen={isSidebarOpen}
          onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        />

        {isSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-30 md:hidden"
            onClick={() => setIsSidebarOpen(false)}
          ></div>
        )}

        <main className="md:ml-68 min-h-screen p-4 md:p-8">
          {isLoading ? (
            <div className="flex items-center justify-center min-h-[80vh]">
              <LoadingSpinner message="Loading settings..." size="lg" />
            </div>
          ) : (
          <div className="max-w-4xl">
            <div className="mb-8">
              <h1 className="text-3xl md:text-[44px] font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500">
                System Settings
              </h1>
              <p className="text-purple-200">Configure system-wide preferences and behaviors</p>
            </div>

            {/* Settings Form */}
            <div className="bg-gray-800/30 backdrop-blur-sm rounded-2xl border border-cyan-500/20 p-6 space-y-8">
              {/* General Settings */}
              <div>
                <h2 className="text-xl font-semibold mb-4 text-cyan-200 flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  </svg>
                  General Settings
                </h2>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-cyan-200">System Name</label>
                    <input
                      type="text"
                      value={settings.systemName}
                      onChange={(e) => handleInputChange('systemName', e.target.value)}
                      className="w-full bg-gray-800/50 border border-cyan-500/30 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-white"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2 text-cyan-200">Max Concurrent Sessions</label>
                      <input
                        type="number"
                        min="1"
                        max="10000"
                        value={settings.maxConcurrentSessions}
                        onChange={(e) => handleInputChange('maxConcurrentSessions', parseInt(e.target.value))}
                        className="w-full bg-gray-800/50 border border-cyan-500/30 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2 text-cyan-200">Data Retention (Days)</label>
                      <input
                        type="number"
                        min="1"
                        max="365"
                        value={settings.dataRetentionDays}
                        onChange={(e) => handleInputChange('dataRetentionDays', parseInt(e.target.value))}
                        className="w-full bg-gray-800/50 border border-cyan-500/30 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2 text-cyan-200">Default App Context</label>
                    <select
                      value={settings.defaultAppContext}
                      onChange={(e) => handleInputChange('defaultAppContext', e.target.value)}
                      className="w-full bg-gray-800/50 border border-cyan-500/30 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-white"
                    >
                      {appContexts.map(context => (
                        <option key={context} value={context}>{context === 'GLOBAL' ? 'Global (All Apps)' : context}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Gesture Settings */}
              <div className="border-t border-cyan-500/20 pt-8">
                <h2 className="text-xl font-semibold mb-4 text-emerald-200 flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                  </svg>
                  Gesture Recognition
                </h2>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-cyan-200">Gesture Sensitivity</label>
                    <div className="space-y-2">
                      {sensitivityLevels.map(level => (
                        <label key={level.value} className="flex items-start">
                          <input
                            type="radio"
                            name="sensitivity"
                            value={level.value}
                            checked={settings.gestureSensitivity === level.value}
                            onChange={(e) => handleInputChange('gestureSensitivity', e.target.value)}
                            className="mt-1 mr-3 h-4 w-4 text-cyan-500 bg-gray-700 border-gray-600 focus:ring-cyan-500"
                          />
                          <div>
                            <span className="font-medium capitalize">{level.value}</span>
                            <p className="text-sm text-gray-400 mt-1">{level.label}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* System Features */}
              <div className="border-t border-cyan-500/20 pt-8">
                <h2 className="text-xl font-semibold mb-4 text-purple-200 flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                  </svg>
                  System Features
                </h2>
              </div>

              {/* Maintenance Mode */}
              <div className="border-t border-cyan-500/20 pt-8">
                <h2 className="text-xl font-semibold mb-4 text-amber-200 flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  Maintenance Mode
                </h2>

                <div className="flex items-center justify-between p-4 bg-amber-500/10 rounded-lg border border-amber-500/30">
                  <div>
                    <p className="font-medium">Enable Maintenance Mode</p>
                    <p className="text-sm text-amber-300">Temporarily disable user access for system maintenance</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.maintenanceMode}
                      onChange={(e) => handleInputChange('maintenanceMode', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-500/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                  </label>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 pt-6">
                <button
                  onClick={handleSaveSettings}
                  disabled={isSaving}
                  className="flex-1 py-3 px-6 hover:cursor-pointer bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl font-medium hover:from-cyan-600 hover:to-blue-700 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-opacity-50 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSaving ? (
                    <>
                      <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Saving...
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Save Settings
                    </>
                  )}
                </button>

                <button
                  onClick={handleResetSettings}
                  className="flex-1 py-3 px-6 hover:cursor-pointer bg-gray-700 rounded-xl font-medium hover:bg-gray-600 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-opacity-50"
                >
                  Reset to Defaults
                </button>
              </div>
            </div>

            {/* Reset Confirmation Modal */}
            <ConfirmModal
              isOpen={showResetConfirm}
              onClose={() => setShowResetConfirm(false)}
              onConfirm={confirmReset}
              title="Reset System Settings"
              message="Are you sure you want to reset all system settings to their default values? This will affect all users and cannot be undone."
              confirmText="Reset"
              cancelText="Cancel"
              confirmButtonClass="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700"
            />
          </div>
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
}