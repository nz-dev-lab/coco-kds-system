// src/utils/kdsLogger.ts
// Module-level ring buffer for KDS debug logs.
// Persists across component mounts (navigation doesn't clear it — unlike component state).
// Used by useKdsServerBroadcast, useKdsClient, and KdsDebugPanel.

const MAX_ENTRIES = 150;

export type KdsLogSource = 'server' | 'host' | 'client';
export type KdsLogLevel  = 'info' | 'warn' | 'error';

export interface KdsLogEntry {
  ts:     string;       // HH:MM:SS
  msg:    string;
  source: KdsLogSource;
  level:  KdsLogLevel;
}

// ── Debug gate ────────────────────────────────────────────────────────────────
// All kdsLog calls are no-ops when disabled — zero cost in production.
let debugEnabled = false;

export function setKdsDebugEnabled(enabled: boolean) {
  debugEnabled = enabled;
  if (!enabled) {
    buffer.length = 0;
    notify();
  }
}

const buffer: KdsLogEntry[] = [];
type Listener = (entries: KdsLogEntry[]) => void;
const listeners = new Set<Listener>();

function notify() {
  const snapshot = [...buffer];
  listeners.forEach(fn => fn(snapshot));
}

export function kdsLog(
  msg: string,
  source: KdsLogSource = 'host',
  level: KdsLogLevel = 'info',
) {
  if (!debugEnabled) return; // zero cost in production
  const entry: KdsLogEntry = {
    ts: new Date().toLocaleTimeString('en-GB'),
    msg,
    source,
    level,
  };
  buffer.push(entry);
  if (buffer.length > MAX_ENTRIES) buffer.shift();
  notify();
}

export function getKdsLogs(): KdsLogEntry[] {
  return [...buffer];
}

/** Subscribe to log updates. Immediately fires with the current buffer. Returns unsubscribe fn. */
export function subscribeKdsLogs(fn: Listener): () => void {
  listeners.add(fn);
  fn([...buffer]);
  return () => listeners.delete(fn);
}

export function clearKdsLogs() {
  buffer.length = 0;
  notify();
}

// ── Main-process log bridge ───────────────────────────────────────────────────
// Call once at app start (useKdsServerBroadcast does this).
// Routes [KDS Server] logs from the Electron main process into this buffer.

let mainLogSubscribed = false;

export function initKdsMainProcessLog() {
  if (mainLogSubscribed) return;
  if (!window.electron?.kdsServer?.onLog) return;
  mainLogSubscribed = true;
  window.electron.kdsServer.onLog((msg: string) => {
    const level: KdsLogLevel = msg.toLowerCase().includes('error') ? 'error' : 'info';
    kdsLog(msg, 'server', level);
  });
}
