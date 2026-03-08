// src/store/slices/uiSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface UIState {
  sidebarOpen: boolean;
  navbarOpen: boolean;
  selectedStation: string;
  selectedSource: 'all' | 'cocoeats' | 'tmbill';
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
      itemNameFontSize: 'sm' | 'base' | 'lg' | 'xl';
      itemNameUppercase: boolean;
    };
    requireDoubleTap: boolean;
    interaction: {
      processingMode: 'buttons' | 'header';
      requireDoubleTap: boolean;
    };
    // 🔮 EXAMPLE: Future setting (v3)
    // notifications: {
    //   desktop: boolean;
    //   sound: boolean;
    //   vibration: boolean;
    // };
  };
  focusedOrderId: string | null;
  focusedOrderPosition: number | null;
  recentlyUpdatedOrderIds: string[];
}

// ============================================
// ✅ STEP 1: INCREMENT THIS WHEN ADDING NEW SETTINGS
// ============================================
// Current version: 2 (added 'interaction' field)
// When you add 'notifications' field → change to: 3
// When you add 'printer' field → change to: 4
// etc.
const SETTINGS_VERSION = 3;

// ============================================
// ✅ STEP 2: ADD NEW FIELDS HERE
// ============================================
const getDefaultSettings = (): UIState['settings'] => ({
  audioNotifications: {
    enabled: true,
    voiceEnabled: true,
    soundEffectsVolume: 70,
    voiceVolume: 90,
  },
  display: {
    showOrderAge: true,
    autoRefresh: true,
    itemNameFontSize: 'sm' as const,
    itemNameUppercase: false,
  },
  requireDoubleTap: true,
  interaction: {
    processingMode: 'buttons',
    requireDoubleTap: true,
  },
  // 🔮 EXAMPLE: When adding new field, uncomment and increment SETTINGS_VERSION to 3:
  // notifications: {
  //   desktop: true,
  //   sound: true,
  //   vibration: false,
  // },
});

// ============================================
// ✅ HELPER: Save settings with version tracking
// ============================================
const saveSettings = (settings: UIState['settings']) => {
  localStorage.setItem('kds-settings', JSON.stringify(settings));
  localStorage.setItem('kds-settings-version', SETTINGS_VERSION.toString());
};

// ============================================
// ✅ STEP 3: ADD MIGRATION LOGIC HERE
// ============================================
const migrateSettings = (oldSettings: any, oldVersion: number): UIState['settings'] => {
  let settings = { ...oldSettings };

  // Migration v1 → v2: Added 'interaction' field
  if (oldVersion < 2) {
    console.log('📦 Migrating settings v1 → v2: Adding interaction field');
    settings.interaction = {
      processingMode: 'buttons',
      requireDoubleTap: settings.requireDoubleTap ?? true,
    };
  }

  // Migration v2 → v3: Added itemNameFontSize and itemNameUppercase
  if (oldVersion < 3) {
    console.log('📦 Migrating settings v2 → v3: Adding item name display settings');
    settings.display = {
      showOrderAge: true,
      autoRefresh: true,
      ...(settings.display ?? {}),
      itemNameFontSize: 'sm',
      itemNameUppercase: false,
    };
  }

  // 🔮 EXAMPLE: Migration v3 → v4 (when you add 'notifications')
  // Uncomment this when you actually add the notifications field:
  //
  // if (oldVersion < 3) {
  //   console.log('📦 Migrating settings v2 → v3: Adding notifications field');
  //   settings.notifications = {
  //     desktop: true,
  //     sound: true,
  //     vibration: false,
  //   };
  // }

  // 🔮 EXAMPLE: Migration v3 → v4 (if you add 'printer' later)
  //
  // if (oldVersion < 4) {
  //   console.log('📦 Migrating settings v3 → v4: Adding printer field');
  //   settings.printer = {
  //     defaultPrinter: null,
  //     autoPrint: false,
  //   };
  // }

  return settings as UIState['settings'];
};

// ============================================
// ✅ LOAD SETTINGS WITH AUTO-MIGRATION
// ============================================
const loadSettings = (): UIState['settings'] => {
  try {
    const saved = localStorage.getItem('kds-settings');
    const savedVersion = parseInt(localStorage.getItem('kds-settings-version') || '1', 10);

    if (saved) {
      const parsed = JSON.parse(saved);

      // Check if migration needed
      if (savedVersion < SETTINGS_VERSION) {
        console.log(`🔄 Migrating settings: v${savedVersion} → v${SETTINGS_VERSION}`);
        const migrated = migrateSettings(parsed, savedVersion);
        saveSettings(migrated);
        console.log('✅ Settings migration complete');
        return migrated;
      }

      // No migration needed
      return parsed;
    }
  } catch (error) {
    console.error('❌ Failed to load settings:', error);
    // Clear corrupted data
    localStorage.removeItem('kds-settings');
    localStorage.removeItem('kds-settings-version');
  }

  // New install or error recovery - use defaults
  console.log('🆕 Creating default settings (new user or error recovery)');
  const defaults = getDefaultSettings();
  saveSettings(defaults);
  return defaults;
};

// ============================================
// ✅ INITIAL STATE
// ============================================
const initialState: UIState = {
  sidebarOpen: true,
  navbarOpen: true,
  selectedStation: 'Main Kitchen',
  selectedSource: 'all',
  theme: 'dark',
  settings: loadSettings(),
  focusedOrderId: null,
  focusedOrderPosition: null,
  recentlyUpdatedOrderIds: [],
};

// ============================================
// ✅ REDUX SLICE
// ============================================
const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    // ========================================
    // Sidebar & Navbar (no localStorage)
    // ========================================
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
    
    // ========================================
    // Station & Theme (no localStorage)
    // ========================================
    setSelectedStation: (state, action: PayloadAction<string>) => {
      state.selectedStation = action.payload;
    },
    setSelectedSource: (state, action: PayloadAction<'all' | 'cocoeats' | 'tmbill'>) => {
      state.selectedSource = action.payload;
    },
    toggleTheme: (state) => {
      state.theme = state.theme === 'dark' ? 'light' : 'dark';
    },
    setTheme: (state, action: PayloadAction<'dark' | 'light'>) => {
      state.theme = action.payload;
    },

    // ========================================
    // Focus Management (no localStorage)
    // ========================================
    setFocusedOrder: (state, action: PayloadAction<{ orderId: string; position: number }>) => {
      state.focusedOrderId = action.payload.orderId;
      state.focusedOrderPosition = action.payload.position;
    },
    releaseFocus: (state) => {
      state.focusedOrderId = null;
      state.focusedOrderPosition = null;
    },
    addRecentlyUpdated: (state, action: PayloadAction<string>) => {
      if (!state.recentlyUpdatedOrderIds.includes(action.payload)) {
        state.recentlyUpdatedOrderIds.push(action.payload);
      }
    },
    removeRecentlyUpdated: (state, action: PayloadAction<string>) => {
      state.recentlyUpdatedOrderIds = state.recentlyUpdatedOrderIds.filter(
        (id) => id !== action.payload
      );
    },
    clearRecentlyUpdated: (state) => {
      state.recentlyUpdatedOrderIds = [];
    },

    // ========================================
    // Audio Settings (saves to localStorage)
    // ========================================
    toggleAudioNotifications: (state) => {
      state.settings.audioNotifications.enabled = !state.settings.audioNotifications.enabled;
      saveSettings(state.settings);
    },
    toggleVoiceNotifications: (state) => {
      state.settings.audioNotifications.voiceEnabled = !state.settings.audioNotifications.voiceEnabled;
      saveSettings(state.settings);
    },
    setSoundEffectsVolume: (state, action: PayloadAction<number>) => {
      state.settings.audioNotifications.soundEffectsVolume = action.payload;
      saveSettings(state.settings);
    },
    setVoiceVolume: (state, action: PayloadAction<number>) => {
      state.settings.audioNotifications.voiceVolume = action.payload;
      saveSettings(state.settings);
    },

    // ========================================
    // Display Settings (saves to localStorage)
    // ========================================
    toggleShowOrderAge: (state) => {
      state.settings.display.showOrderAge = !state.settings.display.showOrderAge;
      saveSettings(state.settings);
    },
    toggleAutoRefresh: (state) => {
      state.settings.display.autoRefresh = !state.settings.display.autoRefresh;
      saveSettings(state.settings);
    },
    setItemNameFontSize: (state, action: PayloadAction<'sm' | 'base' | 'lg' | 'xl'>) => {
      state.settings.display.itemNameFontSize = action.payload;
      saveSettings(state.settings);
    },
    toggleItemNameUppercase: (state) => {
      state.settings.display.itemNameUppercase = !state.settings.display.itemNameUppercase;
      saveSettings(state.settings);
    },
    toggleRequireDoubleTap: (state) => {
      state.settings.requireDoubleTap = !state.settings.requireDoubleTap;
      saveSettings(state.settings);
    },

    // ========================================
    // Interaction Settings (saves to localStorage)
    // ========================================
    setProcessingMode: (state, action: PayloadAction<'buttons' | 'header'>) => {
      state.settings.interaction.processingMode = action.payload;
      saveSettings(state.settings);
    },
    setRequireDoubleTap: (state) => {
      state.settings.interaction.requireDoubleTap = !state.settings.interaction.requireDoubleTap;
      saveSettings(state.settings);
    },

    // 🔮 EXAMPLE: When you add 'notifications' settings:
    //
    // toggleDesktopNotifications: (state) => {
    //   state.settings.notifications.desktop = !state.settings.notifications.desktop;
    //   saveSettings(state.settings);
    // },
    // toggleSoundNotifications: (state) => {
    //   state.settings.notifications.sound = !state.settings.notifications.sound;
    //   saveSettings(state.settings);
    // },
    // toggleVibration: (state) => {
    //   state.settings.notifications.vibration = !state.settings.notifications.vibration;
    //   saveSettings(state.settings);
    // },

    // ========================================
    // Reset Settings (saves to localStorage)
    // ========================================
    resetSettings: (state) => {
      state.settings = getDefaultSettings();
      saveSettings(state.settings);
    },
  },
});

// ============================================
// ✅ EXPORTS
// ============================================
export const {
  toggleSidebar,
  setSidebarOpen,
  toggleNavbar,
  setNavbarOpen,
  setSelectedStation,
  setSelectedSource,
  toggleTheme,
  setTheme,
  setFocusedOrder,
  releaseFocus,
  addRecentlyUpdated,
  removeRecentlyUpdated,
  clearRecentlyUpdated,
  toggleAudioNotifications,
  toggleVoiceNotifications,
  setSoundEffectsVolume,
  setVoiceVolume,
  toggleShowOrderAge,
  toggleAutoRefresh,
  toggleRequireDoubleTap,
  setProcessingMode,
  setRequireDoubleTap,
  setItemNameFontSize,
  toggleItemNameUppercase,
  resetSettings,
  // 🔮 EXAMPLE: Export new actions when you add them:
  // toggleDesktopNotifications,
  // toggleSoundNotifications,
  // toggleVibration,
} = uiSlice.actions;

export default uiSlice.reducer;