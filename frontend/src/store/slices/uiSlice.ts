// src/store/slices/uiSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface UIState {
  sidebarOpen: boolean;
  navbarOpen: boolean;
  selectedStation: string;
  theme: 'dark' | 'light';
  settings: {
    audioNotifications: {
      enabled: boolean;
      voiceEnabled: boolean;
      soundEffectsVolume: number; // 0-100
      voiceVolume: number; // 0-100
    };
    display: {
      showOrderAge: boolean;
      autoRefresh: boolean;
    };
    requireDoubleTap: boolean;
    interaction: {
      processingMode: 'buttons' | 'header';
      requireDoubleTap: boolean;
    };
  };
}

// Load settings from localStorage
const loadSettings = (): UIState['settings'] => {
  try {
    const saved = localStorage.getItem('kds-settings');
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (error) {
    console.error('Failed to load settings:', error);
  }
  
  // Default settings
  return {
    audioNotifications: {
      enabled: true,
      voiceEnabled: true,
      soundEffectsVolume: 70,
      voiceVolume: 90,
    },
    display: {
      showOrderAge: true,
      autoRefresh: true,
    },
    requireDoubleTap: true,
    interaction: {
      processingMode: 'buttons',
      requireDoubleTap: true,
    }
  };
};

const initialState: UIState = {
  sidebarOpen: true,
  navbarOpen: true,
  selectedStation: 'Main Kitchen',
  theme: 'dark',
  settings: loadSettings(),
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    // Sidebar & Navbar
    toggleSidebar: (state) => {
      state.sidebarOpen = !state.sidebarOpen;
    },
    setSidebarOpen: (state, action: PayloadAction<boolean>) => {
      state.sidebarOpen = action.payload;
    },
    toggleNavbar: (state) => {
      state.navbarOpen = !state.navbarOpen;
    },
    setNavbarOpen: (state, action: PayloadAction<boolean>) => {
      state.navbarOpen = action.payload;
    },
    
    // Station Selection
    setSelectedStation: (state, action: PayloadAction<string>) => {
      state.selectedStation = action.payload;
    },
    
    // Theme
    toggleTheme: (state) => {
      state.theme = state.theme === 'dark' ? 'light' : 'dark';
    },
    setTheme: (state, action: PayloadAction<'dark' | 'light'>) => {
      state.theme = action.payload;
    },
    
    // Audio notification settings
    toggleAudioNotifications: (state) => {
      state.settings.audioNotifications.enabled = !state.settings.audioNotifications.enabled;
      localStorage.setItem('kds-settings', JSON.stringify(state.settings));
    },
    toggleVoiceNotifications: (state) => {
      state.settings.audioNotifications.voiceEnabled = !state.settings.audioNotifications.voiceEnabled;
      localStorage.setItem('kds-settings', JSON.stringify(state.settings));
    },
    setSoundEffectsVolume: (state, action: PayloadAction<number>) => {
      state.settings.audioNotifications.soundEffectsVolume = action.payload;
      localStorage.setItem('kds-settings', JSON.stringify(state.settings));
    },
    setVoiceVolume: (state, action: PayloadAction<number>) => {
      state.settings.audioNotifications.voiceVolume = action.payload;
      localStorage.setItem('kds-settings', JSON.stringify(state.settings));
    },
    
    // Display settings
    toggleShowOrderAge: (state) => {
      state.settings.display.showOrderAge = !state.settings.display.showOrderAge;
      localStorage.setItem('kds-settings', JSON.stringify(state.settings));
    },
    toggleAutoRefresh: (state) => {
      state.settings.display.autoRefresh = !state.settings.display.autoRefresh;
      localStorage.setItem('kds-settings', JSON.stringify(state.settings));
    },

    toggleRequireDoubleTap(state) {
      state.settings.requireDoubleTap = !state.settings.requireDoubleTap;
      localStorage.setItem('kds-settings', JSON.stringify(state.settings));
    },

    //Interaction settings
    setProcessingMode: (state, action: PayloadAction<'buttons' | 'header'>) => {
      state.settings.interaction.processingMode = action.payload;
      localStorage.setItem('kds-settings', JSON.stringify(state.settings));
    },
    setRequireDoubleTap(state){
      state.settings.interaction.requireDoubleTap = !state.settings.interaction.requireDoubleTap;
      localStorage.setItem('kds-settings', JSON.stringify(state.settings));
    },
    
    // Reset to defaults
    resetSettings: (state) => {
      state.settings = {
        audioNotifications: {
          enabled: true,
          voiceEnabled: true,
          soundEffectsVolume: 70,
          voiceVolume: 90,
        },
        display: {
          showOrderAge: true,
          autoRefresh: true,
        },
        requireDoubleTap: true,
        interaction: {
          processingMode: 'buttons',
          requireDoubleTap: true,
        }
      };
      localStorage.setItem('kds-settings', JSON.stringify(state.settings));
    },
  },
});

export const {
  toggleSidebar,
  setSidebarOpen,
  toggleNavbar,
  setNavbarOpen,
  setSelectedStation,
  toggleTheme,
  setTheme,
  toggleAudioNotifications,
  toggleVoiceNotifications,
  setSoundEffectsVolume,
  setVoiceVolume,
  toggleShowOrderAge,
  toggleAutoRefresh,
  toggleRequireDoubleTap,
  setProcessingMode,
  setRequireDoubleTap,
  resetSettings,
} = uiSlice.actions;

export default uiSlice.reducer;