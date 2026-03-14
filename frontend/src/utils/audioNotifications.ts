// src/utils/audioNotifications.ts
import { store } from '../store';
import { kdsLog } from './kdsLogger';

// Audio notification system with sound files and settings support
class AudioNotificationService {
  private hasPlayedReadyNotification = new Set<string>();

  // Sound effects
  private chimeReady: HTMLAudioElement;
  private alarmOverdue: HTMLAudioElement;
  private newOrderSound: HTMLAudioElement;

  // Voice files
  private voiceReady: HTMLAudioElement;
  private voiceOverdue: HTMLAudioElement;
  private newOrderVoice: HTMLAudioElement;

  // TMBILL notification sound — reloaded when user picks a custom file
  private tmbillSound: HTMLAudioElement;

  constructor() {
    // Load sound effects
    this.chimeReady = new Audio('./sounds/chime-ready.mp3');
    this.alarmOverdue = new Audio('./sounds/alarm-overdue.mp3');
    this.newOrderSound = new Audio('./sounds/new_order.mp3');

    // Load voice files
    this.voiceReady = new Audio('./sounds/ready-voice.mp3');
    this.voiceOverdue = new Audio('./sounds/overdue-voice.mp3');
    this.newOrderVoice = new Audio('./sounds/new_order_voice.mp3');

    // TMBILL sound — default to the same new_order sound until user picks a custom one
    this.tmbillSound = new Audio('./sounds/new_order.mp3');

    // Volumes will be set dynamically based on settings
    this.updateVolumes();

    // Preload all audio
    this.chimeReady.load();
    this.alarmOverdue.load();
    this.voiceReady.load();
    this.voiceOverdue.load();
    this.newOrderSound.load();
    this.newOrderVoice.load();
    this.tmbillSound.load();

    console.log('✅ Audio notification system initialized');

    // Log if files fail to load
    this.chimeReady.onerror = () => console.error('❌ Failed to load chime-ready.mp3');
    this.alarmOverdue.onerror = () => console.error('❌ Failed to load alarm-overdue.mp3');
    this.voiceReady.onerror = () => console.error('❌ Failed to load ready-voice.mp3');
    this.voiceOverdue.onerror = () => console.error('❌ Failed to load overdue-voice.mp3');
    this.newOrderSound.onerror = () => console.error('❌ Failed to load new_order.mp3');
    this.newOrderVoice.onerror = () => console.error('❌ Failed to load new_order_voice.mp3');
    this.tmbillSound.onerror = () => console.error('❌ Failed to load TMBILL notification sound');

    // Apply custom TMBILL sound path from saved settings on startup
    const saved = store.getState().ui.settings.tmbillNotifications?.customSoundPath;
    if (saved) this.reloadTmbillSound(saved);
  }

  // Update volumes based on Redux settings
  private updateVolumes() {
    const { audioNotifications, tmbillNotifications } = store.getState().ui.settings;

    // Convert 0-100 to 0-1
    this.chimeReady.volume = audioNotifications.soundEffectsVolume / 100;
    this.alarmOverdue.volume = audioNotifications.soundEffectsVolume / 100;
    this.newOrderSound.volume = audioNotifications.soundEffectsVolume / 100;
    this.voiceReady.volume = audioNotifications.voiceVolume / 100;
    this.voiceOverdue.volume = audioNotifications.voiceVolume / 100;
    this.newOrderVoice.volume = audioNotifications.voiceVolume / 100;
    this.tmbillSound.volume = (tmbillNotifications?.volume ?? 80) / 100;
  }

  // Reload TMBILL sound from a new file path (called when user picks a custom file).
  // Uses IPC to read the file in the main process — the only reliable approach, because
  // Chromium silently suppresses audio output for file:// URLs in Electron renderers.
  reloadTmbillSound(filePath: string | null) {
    if (!filePath) {
      this.tmbillSound = new Audio('./sounds/new_order.mp3');
      this.updateVolumes();
      kdsLog('[Audio] TMBILL sound reset to default', 'host');
      return;
    }

    if (!window.tmbill?.readAudioFile) {
      kdsLog('[Audio] TMBILL readAudioFile IPC not available', 'host', 'error');
      return;
    }

    kdsLog(`[Audio] TMBILL sound loading via IPC: ${filePath}`, 'host');
    window.tmbill.readAudioFile(filePath)
      .then(buffer => {
        if (!buffer) {
          kdsLog('[Audio] TMBILL readAudioFile returned null — file not found or unreadable', 'host', 'error');
          return;
        }
        const blobUrl = URL.createObjectURL(new Blob([buffer]));
        this.tmbillSound = new Audio(blobUrl);
        this.tmbillSound.onerror = (e) => {
          const err = (this.tmbillSound as any).error;
          const msg = err ? `code=${err.code}` : String(e);
          console.error('❌ TMBILL sound error after IPC load:', msg);
          kdsLog(`[Audio] TMBILL IPC play ERROR — ${msg}`, 'host', 'error');
        };
        this.tmbillSound.oncanplaythrough = () => {
          kdsLog(`[Audio] TMBILL sound IPC ready ✓ (${filePath})`, 'host');
        };
        this.tmbillSound.load();
        this.updateVolumes();
        console.log('🔊 TMBILL sound loaded via IPC:', filePath);
      })
      .catch(err => {
        console.error('❌ TMBILL IPC read failed:', err);
        kdsLog(`[Audio] TMBILL IPC read FAILED (${err})`, 'host', 'error');
      });
  }

  // Check if audio is enabled
  private isEnabled(): boolean {
    return store.getState().ui.settings.audioNotifications.enabled;
  }

  // Check if voice is enabled
  private isVoiceEnabled(): boolean {
    return store.getState().ui.settings.audioNotifications.voiceEnabled;
  }

  // Play a sound N times, chaining via onended. Calls onAllDone after the last play.
  private playRepeated(sound: HTMLAudioElement, times: number, onAllDone?: () => void) {
    let remaining = Math.max(1, times);
    const playNext = () => {
      if (remaining <= 0) { onAllDone?.(); return; }
      remaining--;
      sound.currentTime = 0;
      sound.onended = playNext;
      sound.play().catch((e) => console.error('Audio play error:', e));
    };
    playNext();
  }

  async playReadyNotification(orderId: string) {
    // Check if notifications are disabled
    if (!this.isEnabled()) {
      console.log('🔇 Audio notifications disabled');
      return;
    }

    if (this.hasPlayedReadyNotification.has(orderId)) {
      return;
    }

    console.log('🔔 Playing READY notification for order:', orderId);
    this.hasPlayedReadyNotification.add(orderId);

    // Update volumes before playing
    this.updateVolumes();

    try {
      // Step 1: Play chime sound
      this.chimeReady.currentTime = 0; // Reset to start
      await this.chimeReady.play();

      // Step 2: Wait for chime to finish, then play voice (if enabled)
      this.chimeReady.onended = () => {
        if (this.isVoiceEnabled()) {
          this.voiceReady.currentTime = 0;
          this.voiceReady.play().catch(e => console.error('Voice play error:', e));
        } else {
          console.log('🔇 Voice notifications disabled');
        }
      };
    } catch (error) {
      console.error('❌ Audio play error:', error);
    }
  }

  async playOverdueWarning(orderId: string) {
    // Check if notifications are disabled
    if (!this.isEnabled()) {
      console.log('🔇 Audio notifications disabled');
      return;
    }

    console.log('🚨 Playing OVERDUE warning for order:', orderId);

    // Update volumes before playing
    this.updateVolumes();

    try {
      // Step 1: Play alarm sound
      this.alarmOverdue.currentTime = 0;
      await this.alarmOverdue.play();

      // Step 2: Wait for alarm to finish, then play voice (if enabled)
      this.alarmOverdue.onended = () => {
        if (this.isVoiceEnabled()) {
          this.voiceOverdue.currentTime = 0;
          this.voiceOverdue.play().catch(e => console.error('Voice play error:', e));
        } else {
          console.log('🔇 Voice notifications disabled');
        }
      };
    } catch (error) {
      console.error('❌ Audio play error:', error);
    }
  }

  // New order notification. repeat=1 on host (default), >1 on kitchen screens.
  playNewOrderNotification(repeat = 1) {
    if (!this.isEnabled()) {
      console.log('🔇 Audio notifications disabled');
      return;
    }
    console.log(`🔔 Playing NEW ORDER notification (×${repeat})`);
    this.updateVolumes();
    this.playRepeated(this.newOrderSound, repeat, () => {
      if (this.isVoiceEnabled()) {
        this.newOrderVoice.currentTime = 0;
        this.newOrderVoice.play().catch((e) => console.error('Voice play error:', e));
      }
    });
  }

  // Test sounds (used in settings page)
  async testReadySound() {
    this.updateVolumes();
    this.chimeReady.currentTime = 0;
    await this.chimeReady.play();
  }

  async testOverdueSound() {
    this.updateVolumes();
    this.alarmOverdue.currentTime = 0;
    await this.alarmOverdue.play();
  }

  async testReadyVoice() {
    this.updateVolumes();
    this.voiceReady.currentTime = 0;
    await this.voiceReady.play();
  }

  async testOverdueVoice() {
    this.updateVolumes();
    this.voiceOverdue.currentTime = 0;
    await this.voiceOverdue.play();
  }

  // ✅ ADD THIS - Test new order sound
  async testNewOrderSound() {
    this.updateVolumes();
    this.newOrderSound.currentTime = 0;
    await this.newOrderSound.play();
  }

  // ✅ ADD THIS - Test new order voice
  async testNewOrderVoice() {
    this.updateVolumes();
    this.newOrderVoice.currentTime = 0;
    await this.newOrderVoice.play();
  }

  // TMBILL new order notification. repeat=1 on host (default), >1 on kitchen screens.
  playTmbillNotification(repeat = 1) {
    const tmbillSettings = store.getState().ui.settings.tmbillNotifications;
    kdsLog(`[Audio] playTmbillNotification called — enabled=${tmbillSettings?.enabled ?? false}, volume=${tmbillSettings?.volume ?? 80}, repeat=${repeat}`, 'host');
    if (!tmbillSettings?.enabled) {
      console.log('🔇 TMBILL notifications disabled');
      kdsLog('[Audio] TMBILL notification blocked — disabled in settings', 'host', 'warn');
      return;
    }

    const src = this.tmbillSound.src || '(empty)';
    console.log(`🔔 Playing TMBILL new order notification (×${repeat})`);
    kdsLog(`[Audio] playing TMBILL sound — src: ${src}`, 'host');
    this.updateVolumes();
    this.playRepeated(this.tmbillSound, repeat, () => {
      kdsLog('[Audio] TMBILL sound sequence complete ✓', 'host');
    });
  }

  async testTmbillSound() {
    const src = this.tmbillSound.src || '(empty)';
    kdsLog(`[Audio] TEST TMBILL sound — src: ${src}, volume: ${this.tmbillSound.volume}`, 'host');
    this.updateVolumes();
    this.tmbillSound.currentTime = 0;
    try {
      await this.tmbillSound.play();
      kdsLog('[Audio] TEST TMBILL sound played ✓', 'host');
    } catch (error) {
      kdsLog(`[Audio] TEST TMBILL sound error: ${error}`, 'host', 'error');
      console.error('❌ TMBILL test audio error:', error);
    }
  }

  resetOrderNotification(orderId: string) {
    this.hasPlayedReadyNotification.delete(orderId);
  }
}

export const audioNotificationService = new AudioNotificationService();