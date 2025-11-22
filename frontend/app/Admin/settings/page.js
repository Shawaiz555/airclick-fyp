// pages/admin/settings.js
'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminSidebar from '../../components/AdminSidebar';
import ProtectedRoute from '../../components/ProtectedRoute';
import LoadingSpinner from '../../components/LoadingSpinner';
import toast from 'react-hot-toast';
import ConfirmModal from '../../components/ConfirmModal';
import { adminAPI } from '../../utils/api';
import {
  FuturisticSlider,
  FuturisticToggle,
  FuturisticInput,
  FuturisticSelect,
  SettingsSection,
  ActionButtons,
  InfoBox,
  SettingsHeader,
  Icons
} from '../../components/SettingsComponents';

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

const APP_CONTEXT_OPTIONS = [
  { value: 'GLOBAL', label: 'Global (All Applications)' },
  { value: 'POWERPOINT', label: 'PowerPoint' },
  { value: 'WORD', label: 'Word' }
];

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

  return (
    <ProtectedRoute allowedRoles={['ADMIN']}>
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800 text-white">
        {/* Subtle background pattern */}
        <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-500/10 via-transparent to-transparent pointer-events-none"></div>

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
            <div className="relative max-w-4xl">
              {/* Header */}
              <SettingsHeader
                title="System Settings"
                subtitle="Configure system-wide preferences and default behaviors"
                hasChanges={hasChanges}
              />

              {/* Settings Sections */}
              <div className="space-y-6">

                {/* System Configuration Section */}
                <SettingsSection
                  title="System Configuration"
                  description="Core system settings and display options"
                  icon={Icons.settings}
                  color="cyan"
                >
                  <FuturisticInput
                    label="System Name"
                    value={settings.system.system_name}
                    onChange={(e) => updateSetting('system', 'system_name', e.target.value)}
                    placeholder="AirClick Gesture Control"
                    description="Display name shown throughout the application"
                    color="cyan"
                  />

                  <FuturisticSelect
                    label="Default Application Context"
                    value={settings.system.default_app_context}
                    onChange={(e) => updateSetting('system', 'default_app_context', e.target.value)}
                    options={APP_CONTEXT_OPTIONS}
                    description="Default context for gesture actions when no app is detected"
                    color="cyan"
                  />

                  <FuturisticToggle
                    label="Maintenance Mode"
                    description="Temporarily disable user access for system maintenance"
                    checked={settings.system.maintenance_mode}
                    onChange={(v) => updateSetting('system', 'maintenance_mode', v)}
                    color="amber"
                    warning={true}
                  />
                </SettingsSection>

                {/* Default User Settings Section */}
                <SettingsSection
                  title="Default User Settings"
                  description="These values are applied as defaults for newly registered users"
                  icon={Icons.users}
                  color="green"
                >
                  <FuturisticSlider
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
                    color="green"
                  />

                  <FuturisticSlider
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
                    color="green"
                  />

                  <FuturisticSlider
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
                    color="green"
                  />

                  <FuturisticSlider
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
                    color="green"
                  />
                </SettingsSection>

                {/* Gesture Recognition System Section */}
                <SettingsSection
                  title="Gesture Recognition System"
                  description="System-wide gesture detection and matching parameters"
                  icon={Icons.gesture}
                  color="purple"
                >
                  <FuturisticSlider
                    label="Global Similarity Threshold"
                    value={settings.gesture_system.global_similarity_threshold}
                    onChange={(v) => updateSetting('gesture_system', 'global_similarity_threshold', v)}
                    min={0.5}
                    max={0.95}
                    step={0.05}
                    displayValue={`${(settings.gesture_system.global_similarity_threshold * 100).toFixed(0)}%`}
                    leftLabel="Lenient (more matches)"
                    rightLabel="Strict (precise only)"
                    description="Minimum similarity score required to match a gesture system-wide"
                    color="purple"
                  />

                  <FuturisticSlider
                    label="Gesture Collection Frames"
                    value={settings.gesture_system.gesture_collection_frames}
                    onChange={(v) => updateSetting('gesture_system', 'gesture_collection_frames', Math.round(v))}
                    min={30}
                    max={150}
                    step={10}
                    displayValue={`${settings.gesture_system.gesture_collection_frames} frames`}
                    leftLabel="30 (quick)"
                    rightLabel="150 (detailed)"
                    description="Maximum frames collected for gesture matching"
                    color="purple"
                  />

                  <FuturisticSlider
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
                    color="purple"
                  />

                  <FuturisticSlider
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
                    color="purple"
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
                  title="Admin Settings"
                  message="These settings affect the entire system. Gesture system changes are applied immediately to all active sessions. Default user settings only affect newly created accounts."
                  color="blue"
                />
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
