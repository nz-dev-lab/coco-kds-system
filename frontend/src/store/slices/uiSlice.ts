// src/store/slices/uiSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type StationView = 'all' | 'main_kitchen' | 'grill';

interface UIState {
  sidebarOpen: boolean;
  navbarOpen: boolean;
  selectedStation: string;
  selectedSource: 'all' | 'cocoeats' | 'tmbill';
  theme: 'dark' | 'light';
  // Transient — order IDs currently showing the new-order animation.
  // Not persisted. Populated by detection points (App.tsx, useTmbillOrders).
  // Cleared by each card after 60 s or on user interaction.
  flashOrderIds: string[];
  settings: {
    stationView: StationView;
    // IP of the KDS host PC (packing screen). Set on kitchen PCs to receive orders via WebSocket.
    // Null = standalone mode (fetch from API directly).
    kdsHostIp: string | null;
    audioNotifications: {
      enabled: boolean;
      voiceEnabled: boolean;
      soundEffectsVolume: number; // 0-100
      voiceVolume: number; // 0-100
      // How many times to repeat the notification sound on client/kitchen screens.
      // Host screen always plays once — only kitchen screens pass this to the audio service.
      notificationRepeatCount: number; // 1-5
    };
    tmbillNotifications: {
      enabled: boolean;
      customSoundPath: string | null; // absolute path to user-chosen audio file; null = default beep
      volume: number; // 0-100
      scheduledAlertMinutes: number; // minutes before scheduled time to fire alert
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
    printer: {
      selectedPrinterName: string | null;
      paperWidth: 58 | 80;
      autoPrint: boolean;
    };
    debugMode: boolean;
  };
  focusedOrderId: string | null;
  focusedOrderPosition: number | null;
  recentlyUpdatedOrderIds: string[];
}

// ============================================
// ✅ STEP 1: INCREMENT THIS WHEN ADDING NEW SETTINGS
// ============================================
// Current version: 10 (added scheduledAlertMinutes to tmbillNotifications)
const SETTINGS_VERSION = 10;

// ============================================
// ✅ STEP 2: ADD NEW FIELDS HERE
// ============================================
const getDefaultSettings = (): UIState['settings'] => ({
  stationView: 'all',
  kdsHostIp: null,
  audioNotifications: {
    enabled: true,
    voiceEnabled: true,
    soundEffectsVolume: 70,
    voiceVolume: 90,
    notificationRepeatCount: 3,
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
  tmbillNotifications: {
    enabled: true,
    customSoundPath: null,
    volume: 80,
    scheduledAlertMinutes: 30,
  },
  printer: {
    selectedPrinterName: null,
    paperWidth: 80,
    autoPrint: false,
  },
  debugMode: false,
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

  // Migration v3 → v4: Added printer settings
  if (oldVersion < 4) {
    console.log('📦 Migrating settings v3 → v4: Adding printer settings');
    settings.printer = {
      selectedPrinterName: null,
      paperWidth: 80,
      autoPrint: false,
    };
  }

  // Migration v4 → v5: Added stationView
  if (oldVersion < 5) {
    console.log('📦 Migrating settings v4 → v5: Adding stationView');
    settings.stationView = 'all';
  }

  // Migration v5 → v6: Added kdsHostIp
  if (oldVersion < 6) {
    console.log('📦 Migrating settings v5 → v6: Adding kdsHostIp');
    settings.kdsHostIp = null;
  }

  // Migration v6 → v7: Added debugMode
  if (oldVersion < 7) {
    console.log('📦 Migrating settings v6 → v7: Adding debugMode');
    settings.debugMode = false;
  }

  // Migration v7 → v8: Added tmbillNotifications
  if (oldVersion < 8) {
    console.log('📦 Migrating settings v7 → v8: Adding tmbillNotifications');
    settings.tmbillNotifications = {
      enabled: true,
      customSoundPath: null,
      volume: 80,
    };
  }

  // Migration v8 → v9: Added notificationRepeatCount to audioNotifications
  if (oldVersion < 9) {
    console.log('📦 Migrating settings v8 → v9: Adding notificationRepeatCount');
    settings.audioNotifications = {
      ...settings.audioNotifications,
      notificationRepeatCount: 3,
    };
  }

  // Migration v9 → v10: Added scheduledAlertMinutes to tmbillNotifications
  if (oldVersion < 10) {
    console.log('📦 Migrating settings v9 → v10: Adding scheduledAlertMinutes');
    settings.tmbillNotifications = {
      ...settings.tmbillNotifications,
      scheduledAlertMinutes: 30,
    };
  }

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
  flashOrderIds: [],
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
    // Flash Order IDs (transient — not persisted)
    // Marks orders as "new" for the animation. Populated by detection points
    // (App.tsx for kitchen screen, useTmbillOrders for TMBILL on host).
    // Cleared by each card component after 60 s or on user interaction.
    // ========================================
    addFlashOrder: (state, action: PayloadAction<string>) => {
      if (!state.flashOrderIds.includes(action.payload)) {
        state.flashOrderIds.push(action.payload);
      }
    },
    clearFlashOrder: (state, action: PayloadAction<string>) => {
      state.flashOrderIds = state.flashOrderIds.filter((id) => id !== action.payload);
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
    setNotificationRepeatCount: (state, action: PayloadAction<number>) => {
      state.settings.audioNotifications.notificationRepeatCount = action.payload;
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
    // Station View (saves to localStorage)
    // ========================================
    setStationView: (state, action: PayloadAction<StationView>) => {
      state.settings.stationView = action.payload;
      saveSettings(state.settings);
    },

    // ========================================
    // KDS Host IP (saves to localStorage)
    // ========================================
    setKdsHostIp: (state, action: PayloadAction<string | null>) => {
      state.settings.kdsHostIp = action.payload;
      saveSettings(state.settings);
    },

    // ========================================
    // Printer Settings (saves to localStorage)
    // ========================================
    setSelectedPrinterName: (state, action: PayloadAction<string | null>) => {
      if (!state.settings.printer) state.settings.printer = { selectedPrinterName: null, paperWidth: 80, autoPrint: false };
      state.settings.printer.selectedPrinterName = action.payload;
      saveSettings(state.settings);
    },
    setPaperWidth: (state, action: PayloadAction<58 | 80>) => {
      if (!state.settings.printer) state.settings.printer = { selectedPrinterName: null, paperWidth: 80, autoPrint: false };
      state.settings.printer.paperWidth = action.payload;
      saveSettings(state.settings);
    },
    toggleAutoPrint: (state) => {
      if (!state.settings.printer) state.settings.printer = { selectedPrinterName: null, paperWidth: 80, autoPrint: false };
      state.settings.printer.autoPrint = !state.settings.printer.autoPrint;
      saveSettings(state.settings);
    },

    // ========================================
    // TMBILL Notification Settings (saves to localStorage)
    // ========================================
    toggleTmbillNotifications: (state) => {
      state.settings.tmbillNotifications.enabled = !state.settings.tmbillNotifications.enabled;
      saveSettings(state.settings);
    },
    setTmbillNotificationVolume: (state, action: PayloadAction<number>) => {
      state.settings.tmbillNotifications.volume = action.payload;
      saveSettings(state.settings);
    },
    setTmbillCustomSoundPath: (state, action: PayloadAction<string | null>) => {
      state.settings.tmbillNotifications.customSoundPath = action.payload;
      saveSettings(state.settings);
    },
    setTmbillScheduledAlertMinutes: (state, action: PayloadAction<number>) => {
      state.settings.tmbillNotifications.scheduledAlertMinutes = action.payload;
      saveSettings(state.settings);
    },

    // ========================================
    // Debug Mode (saves to localStorage)
    // ========================================
    setDebugMode: (state, action: PayloadAction<boolean>) => {
      state.settings.debugMode = action.payload;
      saveSettings(state.settings);
    },

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
  addFlashOrder,
  clearFlashOrder,
  setStationView,
  toggleAudioNotifications,
  toggleVoiceNotifications,
  setSoundEffectsVolume,
  setVoiceVolume,
  setNotificationRepeatCount,
  toggleShowOrderAge,
  toggleAutoRefresh,
  toggleRequireDoubleTap,
  setProcessingMode,
  setRequireDoubleTap,
  setItemNameFontSize,
  toggleItemNameUppercase,
  setSelectedPrinterName,
  setPaperWidth,
  toggleAutoPrint,
  setKdsHostIp,
  setDebugMode,
  toggleTmbillNotifications,
  setTmbillNotificationVolume,
  setTmbillCustomSoundPath,
  setTmbillScheduledAlertMinutes,
  resetSettings,
} = uiSlice.actions;

export default uiSlice.reducer;