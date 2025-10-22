// app/settings/page.js
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import ProtectedRoute from '../../components/ProtectedRoute';
import toast from 'react-hot-toast';
import ConfirmModal from '../../components/ConfirmModal';

export default function UserSettings() {
  const [settings, setSettings] = useState({
    gestureSensitivity: 50,
    dwellClickEnabled: true,
    dwellClickTime: 500,
    highContrast: false,
    fontSize: 'medium',
    voiceCommands: false,
    showSkeleton: true,
    vibrationFeedback: true
  });
  const [isSaving, setIsSaving] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Load settings from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('userSettings');
    if (saved) {
      setSettings(JSON.parse(saved));
    }
  }, []);

  const handleSettingChange = (key, value) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    localStorage.setItem('userSettings', JSON.stringify(newSettings));
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);

    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      localStorage.setItem('userSettings', JSON.stringify(settings));
      toast.success('Settings saved successfully!');
    } catch (error) {
      toast.error('Failed to save settings.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetSettings = () => {
    setShowResetConfirm(true);
  };

  const confirmReset = () => {
    const defaultSettings = {
      gestureSensitivity: 50,
      dwellClickEnabled: true,
      dwellClickTime: 500,
      highContrast: false,
      fontSize: 'medium',
      voiceCommands: false,
      showSkeleton: true,
      vibrationFeedback: true
    };
    setSettings(defaultSettings);
    localStorage.setItem('userSettings', JSON.stringify(defaultSettings));
    toast.success('Settings reset to defaults');
  };

  return (
    <ProtectedRoute allowedRoles={['USER']}>
      <div className="md:ml-64 min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800 text-white">
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-4xl mx-auto">
            <div className="mb-8">
              <h1 className="text-3xl md:text-4xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500">
                User Settings
              </h1>
              <p className="text-purple-200">Customize your gesture control experience</p>
            </div>

            {/* Settings Form */}
            <div className="space-y-8">
              {/* Gesture Sensitivity */}
              <div className="bg-gray-800/30 backdrop-blur-sm rounded-2xl p-6 border border-cyan-500/20">
                <h2 className="text-xl font-semibold mb-4 text-cyan-200 flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                  </svg>
                  Gesture Sensitivity
                </h2>

                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-2">
                      <label className="text-sm font-medium text-cyan-200">Sensitivity Level</label>
                      <span className="text-sm text-gray-400">{settings.gestureSensitivity}%</span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="100"
                      value={settings.gestureSensitivity}
                      onChange={(e) => handleSettingChange('gestureSensitivity', parseInt(e.target.value))}
                      className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>Low (Fewer false triggers)</span>
                      <span>High (More responsive)</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-800/30 rounded-lg border border-cyan-500/20">
                    <div>
                      <p className="font-medium">Show Skeleton Overlay</p>
                      <p className="text-sm text-gray-400">Display hand landmark visualization</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.showSkeleton}
                        onChange={(e) => handleSettingChange('showSkeleton', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-cyan-500/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500"></div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Dwell Click Settings */}
              <div className="bg-gray-800/30 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/20">
                <h2 className="text-xl font-semibold mb-4 text-purple-200 flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                  Dwell Click
                </h2>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-800/30 rounded-lg border border-purple-500/20">
                    <div>
                      <p className="font-medium">Enable Dwell Click</p>
                      <p className="text-sm text-gray-400">Hold hand still to trigger click</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.dwellClickEnabled}
                        onChange={(e) => handleSettingChange('dwellClickEnabled', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-500/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-500"></div>
                    </label>
                  </div>

                  {settings.dwellClickEnabled && (
                    <div>
                      <label className="block text-sm font-medium mb-2 text-purple-200">Dwell Time (ms)</label>
                      <div className="flex items-center space-x-4">
                        <input
                          type="range"
                          min="200"
                          max="2000"
                          step="100"
                          value={settings.dwellClickTime}
                          onChange={(e) => handleSettingChange('dwellClickTime', parseInt(e.target.value))}
                          className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                        />
                        <span className="w-16 text-sm font-medium">{settings.dwellClickTime}ms</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Time to hold hand still before clicking</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Accessibility Settings */}
              <div className="bg-gray-800/30 backdrop-blur-sm rounded-2xl p-6 border border-amber-500/20">
                <h2 className="text-xl font-semibold mb-4 text-amber-200 flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Accessibility
                </h2>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-800/30 rounded-lg border border-amber-500/20">
                    <div>
                      <p className="font-medium">High Contrast Mode</p>
                      <p className="text-sm text-gray-400">Improve visibility for low vision users</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.highContrast}
                        onChange={(e) => handleSettingChange('highContrast', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-500/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                    </label>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2 text-amber-200">Font Size</label>
                    <select
                      value={settings.fontSize}
                      onChange={(e) => handleSettingChange('fontSize', e.target.value)}
                      className="w-full bg-gray-800/50 border border-amber-500/30 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent text-white"
                    >
                      <option value="small" className="bg-gray-800">Small</option>
                      <option value="medium" className="bg-gray-800">Medium</option>
                      <option value="large" className="bg-gray-800">Large</option>
                      <option value="x-large" className="bg-gray-800">Extra Large</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-800/30 rounded-lg border border-amber-500/20">
                    <div>
                      <p className="font-medium">Voice Commands</p>
                      <p className="text-sm text-gray-400">Enable voice control as alternative</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.voiceCommands}
                        onChange={(e) => handleSettingChange('voiceCommands', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-500/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-800/30 rounded-lg border border-amber-500/20">
                    <div>
                      <p className="font-medium">Vibration Feedback</p>
                      <p className="text-sm text-gray-400">Haptic feedback on gesture detection</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.vibrationFeedback}
                        onChange={(e) => handleSettingChange('vibrationFeedback', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-500/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                    </label>
                  </div>
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
              title="Reset Settings"
              message="Are you sure you want to reset all settings to their default values? This action cannot be undone."
              confirmText="Reset"
              cancelText="Cancel"
              confirmButtonClass="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700"
            />
          </div>
        </div>
      </div>
    </ProtectedRoute>

  );
}