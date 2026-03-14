// Runs as a standalone child process (plain Node.js, NOT inside Electron).
// Kept separate so that @roamhq/wrtc does not conflict with Electron's
// native WebRTC libraries — same root cause as the SIGABRT fix in tailcom-dashboard.
//
// tailcom-client is an optionalDependency — only present on machines where
// tailcom_enabled: true. This worker is never spawned unless that flag is set.

import { execSync } from 'child_process';

let TailcomClient: any;
try {
  ({ TailcomClient } = require('tailcom-client'));
} catch {
  console.error('[intercom] tailcom-client package not installed — exiting');
  process.exit(1);
}

const INTERCOM_PORT = 7655; // 7654 is used by the KDS server
const autoAccept = process.env.TAILCOM_AUTO_ACCEPT !== 'false'; // defaults to true

console.log(`[intercom] starting — port=${INTERCOM_PORT} autoAccept=${autoAccept} platform=${process.platform}`);

// ── Startup audio device diagnostics ─────────────────────────────────────────
if (process.platform !== 'win32') {
  try {
    const inp = execSync('arecord -l 2>&1', { timeout: 3000 }).toString().trim();
    console.log('[intercom:devices] INPUT DEVICES:\n' + inp);
  } catch (e: any) {
    console.error('[intercom:devices] arecord -l failed:', e.message);
  }
  try {
    const out = execSync('aplay -l 2>&1', { timeout: 3000 }).toString().trim();
    console.log('[intercom:devices] OUTPUT DEVICES:\n' + out);
  } catch (e: any) {
    console.error('[intercom:devices] aplay -l failed:', e.message);
  }
}

const client = new TailcomClient({ port: INTERCOM_PORT, autoAccept });

let callStartTime: number | null = null;

client.on('local-level',  (rms: number) => {
  (process as any).parentPort?.postMessage({ type: 'audio-level', channel: 'local', rms });
});
client.on('remote-level', (rms: number) => {
  (process as any).parentPort?.postMessage({ type: 'audio-level', channel: 'remote', rms });
});

client.on('incoming-call', () => console.log('[intercom] incoming-call'));
client.on('call-started',  () => {
  callStartTime = Date.now();
  console.log('[intercom] call started');
});
client.on('call-ended', () => {
  const dur = callStartTime ? ((Date.now() - callStartTime) / 1000).toFixed(1) : '?';
  callStartTime = null;
  console.log(`[intercom] call ended (duration: ${dur}s)`);
});
client.on('error', (err: any) => console.error('[intercom] error:', err.message, err.stack ?? ''));

// Accept / reject commands sent from the main process via utilityProcess IPC
;(process as any).parentPort?.on('message', (e: { data: { type: string } }) => {
  if (e.data.type === 'accept') client.acceptCall();
  if (e.data.type === 'reject') client.rejectCall();
});

client.start()
  .then(() => console.log(`[intercom] listening on port ${INTERCOM_PORT}`))
  .catch((err: any) => {
    console.error('[intercom] failed to start:', err.message);
    process.exit(1);
  });

// Graceful shutdown when Electron kills this process
process.on('SIGTERM', () => { client.stop(); process.exit(0); });
process.on('SIGINT',  () => { client.stop(); process.exit(0); });
