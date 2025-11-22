// app/User/settings/page.js
'use client';

import { useState, useEffect, useCallback } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import LoadingSpinner from '../../components/LoadingSpinner';
import toast from 'react-hot-toast';
import ConfirmModal from '../../components/ConfirmModal';
import { settingsAPI } from '../../utils/api';

// Default settings (matches backend defaults)
const DEFAULT_SETTINGS = {
  cursor: {
    cursor_speed: 1.5,
    smoothing_level: 0.5,
    dead_zone: 0.0,
    cursor_enabled: true
  },
  click: {
    click_sensitivity: 0.08,
    click_enabled: true
  },
  gesture: {
    gesture_sensitivity: 0.75,
    gesture_hold_time: 1.5
  },
  display: {
    show_skeleton: true,
    high_contrast: false
  }
};

export default function UserSettings() {
  const [isLoading, setIsLoading] = useState(true);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [isSaving, setIsSaving] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [originalSettings, setOriginalSettings] = useState(null);

  // Load settings from backend
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await settingsAPI.getSettings();
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

  // Save settings to backend
  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      const response = await settingsAPI.updateSettings(settings);
      if (response.settings) {
        setSettings(response.settings);
        setOriginalSettings(response.settings);
        setHasChanges(false);

        if (response.applied_to_runtime) {
          toast.success('Settings saved and applied!');
        } else {
          toast.success('Settings saved! Restart gesture system to apply.');
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
      const response = await settingsAPI.resetSettings();
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

  // Slider component for consistency
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

  // Toggle component for consistency
  const SettingToggle = ({ label, description, checked, onChange, color = "cyan" }) => (
    <div className="flex items-center justify-between p-4 bg-gray-800/30 rounded-lg border border-gray-700/50">
      <div>
        <p className="font-medium">{label}</p>
        <p className="text-sm text-gray-400">{description}</p>
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
    <ProtectedRoute allowedRoles={['USER']}>
      <div className="md:ml-64 min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800 text-white">
        {isLoading ? (
          <div className="flex items-center justify-center min-h-screen">
            <LoadingSpinner message="Loading settings..." size="lg" />
          </div>
        ) : (
        <div className="py-6 md:py-10 px-4 lg:px-8">
          <div className="max-w-4xl">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-3xl md:text-[44px] font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400">
                Accessibility Settings
              </h1>
              <p className="text-purple-200/90">Customize your gesture control experience</p>
              {hasChanges && (
                <p className="text-amber-400 text-sm mt-2">You have unsaved changes</p>
              )}
            </div>

            {/* Settings Form */}
            <div className="space-y-8">

              {/* Cursor Control Section */}
              <div className="bg-gray-800/30 backdrop-blur-sm rounded-2xl p-6 border border-cyan-500/20">
                <h2 className="text-xl font-semibold mb-6 text-cyan-200 flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                  </svg>
                  Cursor Control
                </h2>

                <div className="space-y-6">
                  {/* Cursor Speed */}
                  <SettingSlider
                    label="Cursor Speed"
                    value={settings.cursor.cursor_speed}
                    onChange={(v) => updateSetting('cursor', 'cursor_speed', v)}
                    min={0.5}
                    max={4.0}
                    step={0.1}
                    displayValue={`${settings.cursor.cursor_speed.toFixed(1)}x`}
                    leftLabel="Slow (precise)"
                    rightLabel="Fast (quick)"
                    description="How much cursor moves relative to hand movement"
                  />

                  {/* Cursor Smoothing */}
                  <SettingSlider
                    label="Cursor Smoothing"
                    value={settings.cursor.smoothing_level}
                    onChange={(v) => updateSetting('cursor', 'smoothing_level', v)}
                    min={0.1}
                    max={2.0}
                    step={0.1}
                    displayValue={settings.cursor.smoothing_level <= 0.5 ? "Smooth" : settings.cursor.smoothing_level >= 1.5 ? "Responsive" : "Balanced"}
                    leftLabel="Smooth (less jitter)"
                    rightLabel="Responsive (instant)"
                    description="Lower = smoother but slightly delayed, Higher = instant but may jitter"
                  />

                  {/* Dead Zone */}
                  <SettingSlider
                    label="Dead Zone"
                    value={settings.cursor.dead_zone}
                    onChange={(v) => updateSetting('cursor', 'dead_zone', v)}
                    min={0.0}
                    max={0.1}
                    step={0.01}
                    displayValue={settings.cursor.dead_zone === 0 ? "None" : `${(settings.cursor.dead_zone * 100).toFixed(0)}%`}
                    leftLabel="None (max sensitivity)"
                    rightLabel="Large (filters micro-movements)"
                    description="Helps users with tremors by filtering tiny movements"
                  />

                  {/* Enable Cursor Control */}
                  <SettingToggle
                    label="Enable Cursor Control"
                    description="Move cursor with your hand"
                    checked={settings.cursor.cursor_enabled}
                    onChange={(v) => updateSetting('cursor', 'cursor_enabled', v)}
                    color="cyan"
                  />
                </div>
              </div>

              {/* Click Detection Section */}
              <div className="bg-gray-800/30 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/20">
                <h2 className="text-xl font-semibold mb-6 text-purple-200 flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                  </svg>
                  Click Detection
                </h2>

                <div className="space-y-6">
                  {/* Click Sensitivity */}
                  <SettingSlider
                    label="Click Sensitivity"
                    value={settings.click.click_sensitivity}
                    onChange={(v) => updateSetting('click', 'click_sensitivity', v)}
                    min={0.03}
                    max={0.15}
                    step={0.01}
                    displayValue={settings.click.click_sensitivity <= 0.05 ? "Precise" : settings.click.click_sensitivity >= 0.12 ? "Easy" : "Normal"}
                    leftLabel="Precise (small pinch)"
                    rightLabel="Easy (large pinch)"
                    description="How close thumb and finger must be to trigger a click"
                  />

                  {/* Enable Click Detection */}
                  <SettingToggle
                    label="Enable Click Detection"
                    description="Pinch to click (thumb + index finger)"
                    checked={settings.click.click_enabled}
                    onChange={(v) => updateSetting('click', 'click_enabled', v)}
                    color="purple"
                  />
                </div>
              </div>

              {/* Gesture Recognition Section */}
              <div className="bg-gray-800/30 backdrop-blur-sm rounded-2xl p-6 border border-green-500/20">
                <h2 className="text-xl font-semibold mb-6 text-green-200 flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
                  </svg>
                  Gesture Recognition
                </h2>

                <div className="space-y-6">
                  {/* Gesture Sensitivity */}
                  <SettingSlider
                    label="Gesture Matching Sensitivity"
                    value={settings.gesture.gesture_sensitivity}
                    onChange={(v) => updateSetting('gesture', 'gesture_sensitivity', v)}
                    min={0.5}
                    max={0.95}
                    step={0.05}
                    displayValue={`${(settings.gesture.gesture_sensitivity * 100).toFixed(0)}%`}
                    leftLabel="Lenient (more matches)"
                    rightLabel="Strict (precise matches)"
                    description="How closely your gesture must match the recorded template"
                  />

                  {/* Gesture Hold Time */}
                  <SettingSlider
                    label="Gesture Trigger Delay"
                    value={settings.gesture.gesture_hold_time}
                    onChange={(v) => updateSetting('gesture', 'gesture_hold_time', v)}
                    min={0.5}
                    max={3.0}
                    step={0.1}
                    displayValue={`${settings.gesture.gesture_hold_time.toFixed(1)}s`}
                    leftLabel="Quick (0.5s)"
                    rightLabel="Slow (3.0s)"
                    description="How long to hold hand still before gesture collection starts"
                  />
                </div>
              </div>

              {/* Display Settings Section */}
              <div className="bg-gray-800/30 backdrop-blur-sm rounded-2xl p-6 border border-amber-500/20">
                <h2 className="text-xl font-semibold mb-6 text-amber-200 flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Display & Feedback
                </h2>

                <div className="space-y-4">
                  {/* Show Skeleton */}
                  <SettingToggle
                    label="Show Hand Skeleton"
                    description="Display hand landmark visualization overlay"
                    checked={settings.display.show_skeleton}
                    onChange={(v) => updateSetting('display', 'show_skeleton', v)}
                    color="amber"
                  />

                  {/* High Contrast */}
                  <SettingToggle
                    label="High Contrast Mode"
                    description="Improve visibility for low vision users"
                    checked={settings.display.high_contrast}
                    onChange={(v) => updateSetting('display', 'high_contrast', v)}
                    color="amber"
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
                    <p className="font-medium mb-1">Settings are applied immediately</p>
                    <p className="text-blue-300/80">Changes take effect in real-time when the gesture control system is running. Your preferences are saved to your account and will be restored on your next login.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Reset Confirmation Modal */}
            <ConfirmModal
              isOpen={showResetConfirm}
              onClose={() => setShowResetConfirm(false)}
              onConfirm={confirmReset}
              title="Reset Settings"
              message="Are you sure you want to reset all settings to their default values? This will affect cursor speed, click sensitivity, gesture recognition, and display options."
              confirmText="Reset"
              cancelText="Cancel"
              confirmButtonClass="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700"
            />
          </div>
        </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
