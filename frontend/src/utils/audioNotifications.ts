// src/utils/audioNotifications.ts
import { store } from '../store';

// Audio notification system with sound files and settings support
class AudioNotificationService {
  private hasPlayedReadyNotification = new Set<string>();
  
  // Sound effects
  private chimeReady: HTMLAudioElement;
  private alarmOverdue: HTMLAudioElement;
  
  // Voice files
  private voiceReady: HTMLAudioElement;
  private voiceOverdue: HTMLAudioElement;

  constructor() {
    // Load sound effects
      this.chimeReady = new Audio('./sounds/chime-ready.mp3');       // ✅ FIXED
  this.alarmOverdue = new Audio('./sounds/alarm-overdue.mp3');   // ✅ FIXED
  
  // Load voice files
  this.voiceReady = new Audio('./sounds/ready-voice.mp3');       // ✅ FIXED
  this.voiceOverdue = new Audio('./sounds/overdue-voice.mp3'); 
    
    // Volumes will be set dynamically based on settings
    this.updateVolumes();
    
    // Preload all audio
    this.chimeReady.load();
    this.alarmOverdue.load();
    this.voiceReady.load();
    this.voiceOverdue.load();
    
    console.log('✅ Audio notification system initialized');
    
    // Log if files fail to load
    this.chimeReady.onerror = () => console.error('❌ Failed to load chime-ready.mp3');
    this.alarmOverdue.onerror = () => console.error('❌ Failed to load alarm-overdue.mp3');
    this.voiceReady.onerror = () => console.error('❌ Failed to load ready-voice.mp3');
    this.voiceOverdue.onerror = () => console.error('❌ Failed to load overdue-voice.mp3');
  }

  // Update volumes based on Redux settings
  private updateVolumes() {
    const settings = store.getState().ui.settings.audioNotifications;
    
    // Convert 0-100 to 0-1
    this.chimeReady.volume = settings.soundEffectsVolume / 100;
    this.alarmOverdue.volume = settings.soundEffectsVolume / 100;
    this.voiceReady.volume = settings.voiceVolume / 100;
    this.voiceOverdue.volume = settings.voiceVolume / 100;
  }

  // Check if audio is enabled
  private isEnabled(): boolean {
    return store.getState().ui.settings.audioNotifications.enabled;
  }

  // Check if voice is enabled
  private isVoiceEnabled(): boolean {
    return store.getState().ui.settings.audioNotifications.voiceEnabled;
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

  resetOrderNotification(orderId: string) {
    this.hasPlayedReadyNotification.delete(orderId);
  }
}

export const audioNotificationService = new AudioNotificationService();