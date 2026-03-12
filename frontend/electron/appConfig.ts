// electron/appConfig.ts
// Reads and writes config.json in the app's userData directory.
// This file persists across app updates — safe to edit manually.
//
// Locations:
//   Windows : C:\Users\<user>\AppData\Roaming\CocoKDS\config.json
//   macOS   : ~/Library/Application Support/CocoKDS/config.json
//   Linux   : ~/.config/CocoKDS/config.json

import { app } from 'electron';
import path from 'path';
import fs from 'fs';

export interface AppConfig {
  tmbill_enabled: boolean;
  talecom_enabled: boolean;
  talecom_auto_accept: boolean;
}

const DEFAULTS: AppConfig = {
  tmbill_enabled: true,
  talecom_enabled: true,
  talecom_auto_accept: true,
};

const CONFIG_PATH = path.join(app.getPath('userData'), 'config.json');

export function readAppConfig(): AppConfig {
  try {
    if (!fs.existsSync(CONFIG_PATH)) {
      // First launch — write defaults and return them
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULTS, null, 2), 'utf-8');
      console.log('📝 Created default config at:', CONFIG_PATH);
      return DEFAULTS;
    }
    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
    // Spread DEFAULTS first so any new keys added in future versions are filled in
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch (err) {
    console.warn('⚠️ Failed to read config, using defaults:', err);
    return DEFAULTS;
  }
}

export function writeAppConfig(patch: Partial<AppConfig>): AppConfig {
  try {
    const current = readAppConfig();
    const updated = { ...current, ...patch };
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(updated, null, 2), 'utf-8');
    console.log('✅ Config saved:', updated);
    return updated;
  } catch (err) {
    console.error('❌ Failed to save config:', err);
    throw err;
  }
}
