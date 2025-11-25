// app/User/settings/page.js
'use client';

import { useState, useEffect, useCallback } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import LoadingSpinner from '../../components/LoadingSpinner';
import toast from 'react-hot-toast';
import ConfirmModal from '../../components/ConfirmModal';
import { settingsAPI } from '../../utils/api';
import {
  FuturisticSlider,
  FuturisticToggle,
  SettingsSection,
  ActionButtons,
  InfoBox,
  SettingsHeader,
  Icons
} from '../../components/SettingsComponents';

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

  return (
    <ProtectedRoute allowedRoles={['USER']}>
      <div className="md:ml-64 min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800 text-white">
        {/* Subtle background pattern */}
        <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-500/10 via-transparent to-transparent pointer-events-none"></div>

        {isLoading ? (
          <div className="flex items-center justify-center min-h-screen">
            <LoadingSpinner message="Loading settings..." size="lg" />
          </div>
        ) : (
          <div className="relative py-8 md:py-12 px-4 lg:px-8">
            <div className="max-w-4xl">
              {/* Header */}
              <SettingsHeader
                title="Accessibility Settings"
                subtitle="Customize your gesture control experience for optimal comfort"
                hasChanges={hasChanges}
              />

              {/* Settings Sections */}
              <div className="space-y-6">

                {/* Cursor Control Section */}
                <SettingsSection
                  title="Cursor Control"
                  description="Configure how your hand movements control the cursor"
                  icon={Icons.cursor}
                  color="cyan"
                >
                  <FuturisticSlider
                    label="Cursor Speed"
                    value={settings.cursor.cursor_speed}
                    onChange={(v) => updateSetting('cursor', 'cursor_speed', v)}
                    min={0.5}
                    max={4.0}
                    step={0.1}
                    displayValue={`${settings.cursor.cursor_speed.toFixed(1)}x`}
                    leftLabel="Slow (precise)"
                    rightLabel="Fast (quick)"
                    description="How much the cursor moves relative to your hand movement"
                    color="cyan"
                  />

                  <FuturisticSlider
                    label="Cursor Smoothing"
                    value={settings.cursor.smoothing_level}
                    onChange={(v) => updateSetting('cursor', 'smoothing_level', v)}
                    min={0.1}
                    max={2.0}
                    step={0.1}
                    displayValue={settings.cursor.smoothing_level <= 0.5 ? "Smooth" : settings.cursor.smoothing_level >= 1.5 ? "Responsive" : "Balanced"}
                    leftLabel="Smooth (less jitter)"
                    rightLabel="Responsive (instant)"
                    description="Lower values reduce jitter, higher values feel more immediate"
                    color="cyan"
                  />

                  <FuturisticSlider
                    label="Dead Zone"
                    value={settings.cursor.dead_zone}
                    onChange={(v) => updateSetting('cursor', 'dead_zone', v)}
                    min={0.0}
                    max={0.1}
                    step={0.01}
                    displayValue={settings.cursor.dead_zone === 0 ? "None" : `${(settings.cursor.dead_zone * 100).toFixed(0)}%`}
                    leftLabel="None (max sensitivity)"
                    rightLabel="Large (filters tremors)"
                    description="Filters tiny movements - helpful for users with tremors"
                    color="cyan"
                  />

                  <FuturisticToggle
                    label="Enable Cursor Control"
                    description="Move the cursor using your hand"
                    checked={settings.cursor.cursor_enabled}
                    onChange={(v) => updateSetting('cursor', 'cursor_enabled', v)}
                    color="cyan"
                  />
                </SettingsSection>

                {/* Click Detection Section */}
                <SettingsSection
                  title="Click Detection"
                  description="Adjust pinch-to-click sensitivity and behavior"
                  icon={Icons.click}
                  color="purple"
                >
                  <FuturisticSlider
                    label="Click Sensitivity"
                    value={settings.click.click_sensitivity}
                    onChange={(v) => updateSetting('click', 'click_sensitivity', v)}
                    min={0.03}
                    max={0.15}
                    step={0.01}
                    displayValue={settings.click.click_sensitivity <= 0.05 ? "Precise" : settings.click.click_sensitivity >= 0.12 ? "Easy" : "Normal"}
                    leftLabel="Precise (small pinch)"
                    rightLabel="Easy (large pinch)"
                    description="How close your thumb and finger must be to trigger a click"
                    color="purple"
                  />

                  <FuturisticToggle
                    label="Enable Click Detection"
                    description="Pinch thumb and index finger to click"
                    checked={settings.click.click_enabled}
                    onChange={(v) => updateSetting('click', 'click_enabled', v)}
                    color="purple"
                  />
                </SettingsSection>

                {/* Gesture Recognition Section */}
                <SettingsSection
                  title="Gesture Recognition"
                  description="Fine-tune how gestures are detected and matched"
                  icon={Icons.gesture}
                  color="green"
                >
                  <FuturisticSlider
                    label="Gesture Matching Sensitivity"
                    value={settings.gesture.gesture_sensitivity}
                    onChange={(v) => updateSetting('gesture', 'gesture_sensitivity', v)}
                    min={0.5}
                    max={0.95}
                    step={0.05}
                    displayValue={`${(settings.gesture.gesture_sensitivity * 100).toFixed(0)}%`}
                    leftLabel="Lenient (more matches)"
                    rightLabel="Strict (precise only)"
                    description="How closely your gesture must match the recorded template"
                    color="green"
                  />

                  <FuturisticSlider
                    label="Gesture Trigger Delay"
                    value={settings.gesture.gesture_hold_time}
                    onChange={(v) => updateSetting('gesture', 'gesture_hold_time', v)}
                    min={0.5}
                    max={3.0}
                    step={0.1}
                    displayValue={`${settings.gesture.gesture_hold_time.toFixed(1)}s`}
                    leftLabel="Quick (0.5s)"
                    rightLabel="Slow (3.0s)"
                    description="How long to hold your hand still before gesture collection starts"
                    color="green"
                  />
                </SettingsSection>

                {/* Action Buttons */}
                <ActionButtons
                  onSave={handleSaveSettings}
                  onReset={handleResetSettings}
                  isSaving={isSaving}
                  hasChanges={hasChanges}
                />

                {/* Info Box */}
                <InfoBox
                  title="Real-time Settings"
                  message="Changes are applied immediately when the gesture control system is running. Your preferences are saved to your account and will be restored on your next login."
                  color="blue"
                />
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
