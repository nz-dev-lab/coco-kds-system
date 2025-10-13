// src/pages/Settings.tsx
import { Volume2, VolumeX, Mic, MicOff, Play, RotateCcw } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  toggleAudioNotifications,
  toggleVoiceNotifications,
  setSoundEffectsVolume,
  setVoiceVolume,
  resetSettings,
} from '../store/slices/uiSlice';
import { audioNotificationService } from '../utils/audioNotifications';

export default function Settings() {
  const dispatch = useAppDispatch();
  const settings = useAppSelector((state) => state.ui.settings);

  const handleTestReady = async () => {
    await audioNotificationService.testReadySound();
    if (settings.audioNotifications.voiceEnabled) {
      // Wait a bit before playing voice
      setTimeout(() => {
        audioNotificationService.testReadyVoice();
      }, 500);
    }
  };

  const handleTestOverdue = async () => {
    await audioNotificationService.testOverdueSound();
    if (settings.audioNotifications.voiceEnabled) {
      setTimeout(() => {
        audioNotificationService.testOverdueVoice();
      }, 500);
    }
  };

  const handleReset = () => {
    if (confirm('Reset all settings to default values?')) {
      dispatch(resetSettings());
    }
  };

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-3xl font-bold text-slate-800 mb-6">Settings</h1>

      {/* Audio Notifications Section */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Volume2 className="w-5 h-5" />
          Audio Notifications
        </h2>

        {/* Master Audio Toggle */}
        <div className="flex items-center justify-between py-3 border-b">
          <div>
            <p className="font-medium text-slate-800">Enable Audio Notifications</p>
            <p className="text-sm text-slate-500">Play sounds when orders are ready or overdue</p>
          </div>
          <button
            onClick={() => dispatch(toggleAudioNotifications())}
            className={`relative w-14 h-7 rounded-full transition-colors ${
              settings.audioNotifications.enabled ? 'bg-green-500' : 'bg-slate-300'
            }`}
          >
            <span
              className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform ${
                settings.audioNotifications.enabled ? 'translate-x-7' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Voice Toggle */}
        <div className="flex items-center justify-between py-3 border-b">
          <div className="flex items-center gap-3">
            {settings.audioNotifications.voiceEnabled ? (
              <Mic className="w-5 h-5 text-blue-600" />
            ) : (
              <MicOff className="w-5 h-5 text-slate-400" />
            )}
            <div>
              <p className="font-medium text-slate-800">Voice Announcements</p>
              <p className="text-sm text-slate-500">
                Play voice messages after sound effects
              </p>
            </div>
          </div>
          <button
            onClick={() => dispatch(toggleVoiceNotifications())}
            disabled={!settings.audioNotifications.enabled}
            className={`relative w-14 h-7 rounded-full transition-colors ${
              !settings.audioNotifications.enabled
                ? 'bg-slate-200 cursor-not-allowed'
                : settings.audioNotifications.voiceEnabled
                ? 'bg-blue-500'
                : 'bg-slate-300'
            }`}
          >
            <span
              className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform ${
                settings.audioNotifications.voiceEnabled ? 'translate-x-7' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Sound Effects Volume */}
        <div className="py-4 border-b">
          <div className="flex items-center justify-between mb-2">
            <label className="font-medium text-slate-800">Sound Effects Volume</label>
            <span className="text-sm text-slate-600 font-mono">
              {settings.audioNotifications.soundEffectsVolume}%
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={settings.audioNotifications.soundEffectsVolume}
            onChange={(e) => dispatch(setSoundEffectsVolume(Number(e.target.value)))}
            disabled={!settings.audioNotifications.enabled}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
          />
          <div className="flex justify-between text-xs text-slate-500 mt-1">
            <span>Silent</span>
            <span>Loud</span>
          </div>
        </div>

        {/* Voice Volume */}
        <div className="py-4 border-b">
          <div className="flex items-center justify-between mb-2">
            <label className="font-medium text-slate-800">Voice Volume</label>
            <span className="text-sm text-slate-600 font-mono">
              {settings.audioNotifications.voiceVolume}%
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={settings.audioNotifications.voiceVolume}
            onChange={(e) => dispatch(setVoiceVolume(Number(e.target.value)))}
            disabled={!settings.audioNotifications.enabled || !settings.audioNotifications.voiceEnabled}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
          />
          <div className="flex justify-between text-xs text-slate-500 mt-1">
            <span>Silent</span>
            <span>Loud</span>
          </div>
        </div>

        {/* Test Buttons */}
        <div className="pt-4">
          <p className="text-sm text-slate-600 mb-3">Test Audio Notifications:</p>
          <div className="flex gap-3">
            <button
              onClick={handleTestReady}
              disabled={!settings.audioNotifications.enabled}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed"
            >
              <Play className="w-4 h-4" />
              Test "Ready" Sound
            </button>
            <button
              onClick={handleTestOverdue}
              disabled={!settings.audioNotifications.enabled}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed"
            >
              <Play className="w-4 h-4" />
              Test "Overdue" Alarm
            </button>
          </div>
        </div>
      </div>

      {/* Display Settings Section */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold text-slate-800 mb-4">Display Settings</h2>

        <div className="space-y-3">
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="font-medium text-slate-800">Show Order Age</p>
              <p className="text-sm text-slate-500">Display time elapsed since order placement</p>
            </div>
            <span className="text-sm text-slate-400 italic">Coming soon</span>
          </div>

          <div className="flex items-center justify-between py-2">
            <div>
              <p className="font-medium text-slate-800">Auto Refresh</p>
              <p className="text-sm text-slate-500">Automatically update order list</p>
            </div>
            <span className="text-sm text-slate-400 italic">Coming soon</span>
          </div>
        </div>
      </div>

      {/* Reset Button */}
      <div className="flex justify-end">
        <button
          onClick={handleReset}
          className="flex items-center gap-2 px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          Reset to Defaults
        </button>
      </div>
    </div>
  );
}