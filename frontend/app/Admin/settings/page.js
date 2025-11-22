// pages/admin/settings.js
'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminSidebar from '../../components/AdminSidebar';
import ProtectedRoute from '../../components/ProtectedRoute';
import LoadingSpinner from '../../components/LoadingSpinner';
import toast from 'react-hot-toast';
import ConfirmModal from '../../components/ConfirmModal';
import { adminAPI } from '../../utils/api';

// Default settings (matches backend defaults)
const DEFAULT_SETTINGS = {
  system: {
    system_name: 'AirClick Gesture Control',
    maintenance_mode: false,
    default_app_context: 'GLOBAL'
  },
  defaults: {
    default_cursor_speed: 1.5,
    default_gesture_sensitivity: 0.75,
    default_click_sensitivity: 0.08,
    default_smoothing_level: 0.5
  },
  gesture_system: {
    global_similarity_threshold: 0.75,
    gesture_collection_frames: 90,
    stationary_duration_threshold: 1.5,
    gesture_cooldown_duration: 1.0
  }
};

const APP_CONTEXTS = ['GLOBAL', 'POWERPOINT', 'WORD'];

export default function SystemSettings() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [originalSettings, setOriginalSettings] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Load settings from backend
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await adminAPI.getSettings();
        if (response.settings) {
          setSettings(response.settings);
          setOriginalSettings(response.settings);
        }
      } catch (error) {
        console.error('Failed to load settings:', error);
        toast.error('Failed to load settings. Using defaults.');
        setSettings(DEFAULT_SETTINGS);
        setOriginalSettings(DEFAULT_SETTINGS);
      } finally {
        setIsLoading(false);
      }
    };
    loadSettings();
  }, []);

  // Track changes
  useEffect(() => {
    if (originalSettings) {
      const changed = JSON.stringify(settings) !== JSON.stringify(originalSettings);
      setHasChanges(changed);
    }
  }, [settings, originalSettings]);

  // Update nested setting
  const updateSetting = useCallback((category, key, value) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: value
      }
    }));
  }, []);

  // Save settings
  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      const response = await adminAPI.updateSettings(settings);
      if (response.settings) {
        setSettings(response.settings);
        setOriginalSettings(response.settings);
        setHasChanges(false);

        if (response.applied_to_runtime) {
          toast.success('Settings saved and applied to system!');
        } else {
          toast.success('Settings saved!');
        }
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast.error('Failed to save settings: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Reset settings
  const handleResetSettings = () => {
    setShowResetConfirm(true);
  };

  const confirmReset = async () => {
    setShowResetConfirm(false);
    setIsSaving(true);
    try {
      const response = await adminAPI.resetSettings();
      if (response.settings) {
        setSettings(response.settings);
        setOriginalSettings(response.settings);
        setHasChanges(false);
        toast.success('Settings reset to defaults!');
      }
    } catch (error) {
      console.error('Failed to reset settings:', error);
      toast.error('Failed to reset settings: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Slider component
  const SettingSlider = ({ label, description, value, onChange, min, max, step, displayValue, leftLabel, rightLabel }) => (
    <div className="space-y-2">
      <div className="flex justify-between mb-1">
        <label className="text-sm font-medium text-gray-200">{label}</label>
        <span className="text-sm text-gray-400">{displayValue}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
      />
      <div className="flex justify-between text-xs text-gray-500">
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
      {description && <p className="text-xs text-gray-500 mt-1">{description}</p>}
    </div>
  );

  // Toggle component
  const SettingToggle = ({ label, description, checked, onChange, color = "cyan", warning = false }) => (
    <div className={`flex items-center justify-between p-4 rounded-lg border ${warning ? 'bg-amber-500/10 border-amber-500/30' : 'bg-gray-800/30 border-gray-700/50'}`}>
      <div>
        <p className="font-medium">{label}</p>
        <p className={`text-sm ${warning ? 'text-amber-300' : 'text-gray-400'}`}>{description}</p>
      </div>
      <label className="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only peer"
        />
        <div className={`w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-${color}-500/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-${color}-500`}></div>
      </label>
    </div>
  );

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
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-3xl md:text-[44px] font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500">
                System Settings
              </h1>
              <p className="text-purple-200">Configure system-wide preferences and behaviors</p>
              {hasChanges && (
                <p className="text-amber-400 text-sm mt-2">You have unsaved changes</p>
              )}
            </div>

            {/* Settings Form */}
            <div className="space-y-8">

              {/* System Settings Section */}
              <div className="bg-gray-800/30 backdrop-blur-sm rounded-2xl p-6 border border-cyan-500/20">
                <h2 className="text-xl font-semibold mb-6 text-cyan-200 flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  </svg>
                  System Configuration
                </h2>

                <div className="space-y-4">
                  {/* System Name */}
                  <div>
                    <label className="block text-sm font-medium mb-2 text-cyan-200">System Name</label>
                    <input
                      type="text"
                      value={settings.system.system_name}
                      onChange={(e) => updateSetting('system', 'system_name', e.target.value)}
                      className="w-full bg-gray-800/50 border border-cyan-500/30 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-white"
                      placeholder="AirClick Gesture Control"
                    />
                    <p className="text-xs text-gray-500 mt-1">Display name shown in the application</p>
                  </div>

                  {/* Default App Context */}
                  <div>
                    <label className="block text-sm font-medium mb-2 text-cyan-200">Default Application Context</label>
                    <select
                      value={settings.system.default_app_context}
                      onChange={(e) => updateSetting('system', 'default_app_context', e.target.value)}
                      className="w-full bg-gray-800/50 border border-cyan-500/30 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-white"
                    >
                      {APP_CONTEXTS.map(context => (
                        <option key={context} value={context}>
                          {context === 'GLOBAL' ? 'Global (All Applications)' : context}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">Default context for gesture actions</p>
                  </div>

                  {/* Maintenance Mode */}
                  <SettingToggle
                    label="Maintenance Mode"
                    description="Temporarily disable user access for system maintenance"
                    checked={settings.system.maintenance_mode}
                    onChange={(v) => updateSetting('system', 'maintenance_mode', v)}
                    color="amber"
                    warning={true}
                  />
                </div>
              </div>

              {/* Default User Settings Section */}
              <div className="bg-gray-800/30 backdrop-blur-sm rounded-2xl p-6 border border-green-500/20">
                <h2 className="text-xl font-semibold mb-6 text-green-200 flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  Default User Settings
                </h2>
                <p className="text-sm text-gray-400 mb-6">These values are applied as defaults for new users</p>

                <div className="space-y-6">
                  {/* Default Cursor Speed */}
                  <SettingSlider
                    label="Default Cursor Speed"
                    value={settings.defaults.default_cursor_speed}
                    onChange={(v) => updateSetting('defaults', 'default_cursor_speed', v)}
                    min={0.5}
                    max={4.0}
                    step={0.1}
                    displayValue={`${settings.defaults.default_cursor_speed.toFixed(1)}x`}
                    leftLabel="Slow"
                    rightLabel="Fast"
                    description="Default cursor movement multiplier for new users"
                  />

                  {/* Default Gesture Sensitivity */}
                  <SettingSlider
                    label="Default Gesture Sensitivity"
                    value={settings.defaults.default_gesture_sensitivity}
                    onChange={(v) => updateSetting('defaults', 'default_gesture_sensitivity', v)}
                    min={0.5}
                    max={0.95}
                    step={0.05}
                    displayValue={`${(settings.defaults.default_gesture_sensitivity * 100).toFixed(0)}%`}
                    leftLabel="Lenient"
                    rightLabel="Strict"
                    description="Default gesture matching threshold for new users"
                  />

                  {/* Default Click Sensitivity */}
                  <SettingSlider
                    label="Default Click Sensitivity"
                    value={settings.defaults.default_click_sensitivity}
                    onChange={(v) => updateSetting('defaults', 'default_click_sensitivity', v)}
                    min={0.03}
                    max={0.15}
                    step={0.01}
                    displayValue={settings.defaults.default_click_sensitivity <= 0.05 ? "Precise" : settings.defaults.default_click_sensitivity >= 0.12 ? "Easy" : "Normal"}
                    leftLabel="Precise"
                    rightLabel="Easy"
                    description="Default pinch sensitivity for new users"
                  />

                  {/* Default Smoothing Level */}
                  <SettingSlider
                    label="Default Smoothing Level"
                    value={settings.defaults.default_smoothing_level}
                    onChange={(v) => updateSetting('defaults', 'default_smoothing_level', v)}
                    min={0.1}
                    max={2.0}
                    step={0.1}
                    displayValue={settings.defaults.default_smoothing_level <= 0.5 ? "Smooth" : settings.defaults.default_smoothing_level >= 1.5 ? "Responsive" : "Balanced"}
                    leftLabel="Smooth"
                    rightLabel="Responsive"
                    description="Default cursor smoothing level for new users"
                  />
                </div>
              </div>

              {/* Gesture System Settings Section */}
              <div className="bg-gray-800/30 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/20">
                <h2 className="text-xl font-semibold mb-6 text-purple-200 flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
                  </svg>
                  Gesture Recognition System
                </h2>
                <p className="text-sm text-gray-400 mb-6">System-wide gesture detection and matching parameters</p>

                <div className="space-y-6">
                  {/* Global Similarity Threshold */}
                  <SettingSlider
                    label="Global Similarity Threshold"
                    value={settings.gesture_system.global_similarity_threshold}
                    onChange={(v) => updateSetting('gesture_system', 'global_similarity_threshold', v)}
                    min={0.5}
                    max={0.95}
                    step={0.05}
                    displayValue={`${(settings.gesture_system.global_similarity_threshold * 100).toFixed(0)}%`}
                    leftLabel="Lenient (more matches)"
                    rightLabel="Strict (precise matches)"
                    description="Minimum similarity score required to match a gesture"
                  />

                  {/* Gesture Collection Frames */}
                  <div className="space-y-2">
                    <div className="flex justify-between mb-1">
                      <label className="text-sm font-medium text-gray-200">Gesture Collection Frames</label>
                      <span className="text-sm text-gray-400">{settings.gesture_system.gesture_collection_frames} frames</span>
                    </div>
                    <input
                      type="range"
                      min={30}
                      max={150}
                      step={10}
                      value={settings.gesture_system.gesture_collection_frames}
                      onChange={(e) => updateSetting('gesture_system', 'gesture_collection_frames', parseInt(e.target.value))}
                      className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                    />
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>30 (quick)</span>
                      <span>150 (detailed)</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Maximum frames collected for gesture matching</p>
                  </div>

                  {/* Stationary Duration Threshold */}
                  <SettingSlider
                    label="Hand Still Duration"
                    value={settings.gesture_system.stationary_duration_threshold}
                    onChange={(v) => updateSetting('gesture_system', 'stationary_duration_threshold', v)}
                    min={0.5}
                    max={3.0}
                    step={0.1}
                    displayValue={`${settings.gesture_system.stationary_duration_threshold.toFixed(1)}s`}
                    leftLabel="Quick (0.5s)"
                    rightLabel="Slow (3.0s)"
                    description="Time hand must be still before gesture collection starts"
                  />

                  {/* Gesture Cooldown */}
                  <SettingSlider
                    label="Gesture Cooldown"
                    value={settings.gesture_system.gesture_cooldown_duration}
                    onChange={(v) => updateSetting('gesture_system', 'gesture_cooldown_duration', v)}
                    min={0.5}
                    max={3.0}
                    step={0.1}
                    displayValue={`${settings.gesture_system.gesture_cooldown_duration.toFixed(1)}s`}
                    leftLabel="Short (0.5s)"
                    rightLabel="Long (3.0s)"
                    description="Cooldown period after a gesture is matched before next detection"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 pt-6">
                <button
                  onClick={handleSaveSettings}
                  disabled={isSaving || !hasChanges}
                  className={`flex-1 py-3 px-6 rounded-xl font-medium transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-opacity-50 flex items-center justify-center gap-2
                    ${hasChanges
                      ? 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 hover:cursor-pointer'
                      : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                    }
                    disabled:opacity-50`}
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
                  disabled={isSaving}
                  className="flex-1 py-3 px-6 hover:cursor-pointer bg-gray-700 rounded-xl font-medium hover:bg-gray-600 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-opacity-50 disabled:opacity-50"
                >
                  Reset to Defaults
                </button>
              </div>

              {/* Info Box */}
              <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-4 mt-4">
                <div className="flex items-start gap-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="text-sm text-blue-200">
                    <p className="font-medium mb-1">Admin Settings</p>
                    <p className="text-blue-300/80">These settings affect the entire system. Changes to gesture system settings are applied immediately to the running detection system. Default user settings only affect newly created accounts.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Reset Confirmation Modal */}
            <ConfirmModal
              isOpen={showResetConfirm}
              onClose={() => setShowResetConfirm(false)}
              onConfirm={confirmReset}
              title="Reset System Settings"
              message="Are you sure you want to reset all system settings to their default values? This will affect gesture detection parameters and default user preferences."
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
