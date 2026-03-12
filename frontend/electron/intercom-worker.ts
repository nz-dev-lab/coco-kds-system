// Runs as a standalone child process (plain Node.js, NOT inside Electron).
// Kept separate so that @roamhq/wrtc does not conflict with Electron's
// native WebRTC libraries — same root cause as the SIGABRT fix in tailcom-dashboard.
//
// tailcom-client is an optionalDependency — only present on machines where
// talecom_enabled: true. This worker is never spawned unless that flag is set.

let TailcomClient: any;
try {
  ({ TailcomClient } = require('tailcom-client'));
} catch {
  console.error('[intercom] tailcom-client package not installed — exiting');
  process.exit(1);
}

const INTERCOM_PORT = 7655 // 7654 is used by the KDS server
const autoAccept = process.env.TALECOM_AUTO_ACCEPT !== 'false' // defaults to true

const client = new TailcomClient({
  port: INTERCOM_PORT,
  autoAccept,
})

client.on('incoming-call', () => console.log('[intercom] incoming-call'))
client.on('call-started',  () => console.log('[intercom] call started'))
client.on('call-ended',    () => console.log('[intercom] call ended'))
client.on('error', (err: any) => console.error('[intercom] error:', err.message))

// Accept / reject commands sent from the main process via utilityProcess IPC
;(process as any).parentPort?.on('message', (e: { data: { type: string } }) => {
  if (e.data.type === 'accept') client.acceptCall()
  if (e.data.type === 'reject') client.rejectCall()
})

client.start()
  .then(() => console.log(`[intercom] listening on port ${INTERCOM_PORT}`))
  .catch((err: any) => {
    console.error('[intercom] failed to start:', err.message)
    process.exit(1)
  })

// Graceful shutdown when Electron kills this process
process.on('SIGTERM', () => { client.stop(); process.exit(0) })
process.on('SIGINT',  () => { client.stop(); process.exit(0) })
