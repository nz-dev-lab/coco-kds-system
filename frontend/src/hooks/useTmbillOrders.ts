import { useEffect } from 'react';
import { toast } from 'react-toastify';
import { useAppDispatch } from '@/store/hooks';
import type { AppDispatch } from '@/store';
import {
  setTmbillOrders,
  removeTmbillOrder,
  removeTmbillOrderByTableId,
  setTmbillConnected,
} from '@/store/slices/tmbillOrdersSlice';

const TMBILL_PORT    = 3000;
const RETRY_INTERVAL = 30_000; // retry every 30s when POS not found
const CREDS_KEY      = 'tmbill_credentials';

// ── Credential helpers ──────────────────────────────────────────────────────

interface SavedCreds {
  host: string;
  port: number;
  username: string;
  password: string;
}

/** Reads credentials. Handles both old { service, username, password } and new flat format. */
function loadCreds(): SavedCreds | null {
  try {
    const raw = localStorage.getItem(CREDS_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    // New flat format — host is optional (empty = will scan)
    if (p.username) return {
      host: p.host || '',
      port: p.port ?? TMBILL_PORT,
      username: p.username,
      password: p.password || '',
    };
    // Old nested format
    if (p.service?.host && p.username) return {
      host: p.service.host, port: p.service.port ?? TMBILL_PORT,
      username: p.username, password: p.password,
    };
    return null;
  } catch { return null; }
}

/** Saves credentials in flat format after every successful connection. */
export function saveTmbillCreds(host: string, port: number, username: string, password: string) {
  localStorage.setItem(CREDS_KEY, JSON.stringify({ host, port, username, password }));
}

function makeService(host: string, port: number) {
  return {
    name: `TMBILL POS (${host})`,
    host, port,
    addresses: [host],
    type: '_http._tcp',
    txt: { url: `http://${host}:${port}/`, manual: 'true' },
  };
}

// ── Core connection helpers (module-level, no dispatch needed) ──────────────

async function connectWith(host: string, port: number, username: string, password: string): Promise<boolean> {
  const auth = await window.tmbill.authenticate(makeService(host, port), username, password);
  if (!auth.success) return false;
  const conn = await window.tmbill.connectSocket();
  return conn.success;
}

/** Fast path: try the last known IP. Shows a brief loading toast. */
async function tryWithCachedIP(creds: SavedCreds): Promise<boolean> {
  const TOAST_ID = 'tmbill-cached';
  toast.loading(`Reconnecting to TMBILL POS at ${creds.host}...`, { toastId: TOAST_ID });
  try {
    const ok = await connectWith(creds.host, creds.port ?? TMBILL_PORT, creds.username, creds.password);
    if (ok) {
      toast.update(TOAST_ID, {
        render: `TMBILL POS reconnected (${creds.host})`,
        type: 'success',
        isLoading: false,
        autoClose: 3000,
      });
      saveTmbillCreds(creds.host, creds.port ?? TMBILL_PORT, creds.username, creds.password);
      return true;
    }
    toast.dismiss(TOAST_ID);
    return false;
  } catch {
    toast.dismiss(TOAST_ID);
    return false;
  }
}

/** Slow path: scan LAN subnet for port 3000, verify TMBILL, connect. */
async function tryWithScan(creds: SavedCreds): Promise<boolean> {
  const SCAN_ID = 'tmbill-scan';
  toast.loading('Scanning network for TMBILL POS...', { toastId: SCAN_ID });

  try {
    const result = await window.tmbill.scanNetwork(creds.port ?? TMBILL_PORT);

    if (!result.found || !result.host) {
      toast.update(SCAN_ID, {
        render: 'TMBILL POS not found on network — CocoEats orders still active.',
        type: 'warning',
        isLoading: false,
        autoClose: 8000,
      });
      return false;
    }

    toast.update(SCAN_ID, {
      render: `Found TMBILL POS at ${result.host} — connecting...`,
      type: 'info',
      isLoading: false,
      autoClose: 2500,
    });

    const ok = await connectWith(result.host, TMBILL_PORT, creds.username, creds.password);
    if (ok) {
      saveTmbillCreds(result.host, TMBILL_PORT, creds.username, creds.password);
      toast.success(`TMBILL POS connected (${result.host})`, {
        toastId: 'tmbill-connected',
        autoClose: 4000,
      });
      return true;
    }

    toast.error(
      'Found TMBILL POS but login failed — check credentials in TMBILL debug panel.',
      { autoClose: 8000 }
    );
    return false;

  } catch {
    toast.update(SCAN_ID, {
      render: 'Network scan failed — CocoEats orders still active.',
      type: 'error',
      isLoading: false,
      autoClose: 5000,
    });
    return false;
  }
}

// ── Exported auto-connect function (callable from Dashboard button) ──────────

let autoConnectRunning = false;

/**
 * Runs the full TMBILL auto-connect flow:
 * 1. Already connected -> fetch tables
 * 2. Cached IP -> fast reconnect with brief toast
 * 3. LAN scan -> toast progress
 *
 * Safe to call from both the hook and a UI button — duplicate calls are no-ops.
 */
export async function runTmbillAutoConnect(dispatch: AppDispatch): Promise<void> {
  if (!window.tmbill) return;
  if (autoConnectRunning) {
    toast.info('Already scanning for TMBILL POS...', { toastId: 'tmbill-busy', autoClose: 3000 });
    return;
  }
  autoConnectRunning = true;

  try {
    // Already connected (e.g. hot-reload)
    const state = await window.tmbill.getState();
    if (state.connected && state.authenticated) {
      await window.tmbill.fetchRunningTables();
      dispatch(setTmbillConnected(true));
      return;
    }

    const creds = loadCreds();
    if (!creds?.username || !creds?.password) {
      toast.info(
        'No TMBILL credentials saved — open the TMBILL debug panel to connect manually.',
        { toastId: 'tmbill-no-creds', autoClose: 7000 }
      );
      return;
    }

    // 1. Cached IP — fast, shows a brief loading toast
    if (creds.host && await tryWithCachedIP(creds)) {
      dispatch(setTmbillConnected(true));
      return;
    }

    // 2. LAN scan — shows toast progress
    if (await tryWithScan(creds)) {
      dispatch(setTmbillConnected(true));
    }

  } finally {
    autoConnectRunning = false;
  }
}

// ── Hook ────────────────────────────────────────────────────────────────────

export function useTmbillOrders() {
  const dispatch = useAppDispatch();

  // ── Connection + scan + retry ──────────────────────────────────────────
  useEffect(() => {
    if (!window.tmbill) return;

    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;

    async function doAutoConnect() {
      if (stopped) return;
      await runTmbillAutoConnect(dispatch);

      if (stopped) return;
      // If still not connected after the attempt, schedule retry
      const state = await window.tmbill.getState();
      if (!state.connected || !state.authenticated) {
        retryTimer = setTimeout(doAutoConnect, RETRY_INTERVAL);
      }
    }

    doAutoConnect();

    return () => {
      stopped = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [dispatch]);

  // ── Real-time event listeners ──────────────────────────────────────────
  useEffect(() => {
    if (!window.tmbill) return;

    const unsubRefresh = window.tmbill.onOrdersRefreshed((data) => {
      dispatch(setTmbillOrders({ running: data.running, settled: data.settled }));
    });

    const unsubRemoved = window.tmbill.onOrderRemoved((data) => {
      dispatch(removeTmbillOrder({ id: data.id }));
    });

    const unsubSettled = window.tmbill.onOrderSettled((data) => {
      dispatch(removeTmbillOrderByTableId({ tableId: data.tableId }));
    });

    return () => {
      unsubRefresh?.();
      unsubRemoved?.();
      unsubSettled?.();
    };
  }, [dispatch]);
}
