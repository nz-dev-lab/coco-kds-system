import { useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import type { AppDispatch } from '@/store';
import { audioNotificationService } from '@/utils/audioNotifications';
import { kdsLog } from '@/utils/kdsLogger';
import {
  setTmbillOrders,
  removeTmbillOrder,
  removeTmbillOrderByTableId,
  setTmbillConnected,
  setTmbillMenu,
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
  const stationView = useAppSelector((s) => s.ui.settings.stationView ?? 'all');

  // Track known order IDs to detect genuinely new orders on each refresh (running + settled)
  const knownRunningIdsRef  = useRef<Set<string>>(new Set());
  const knownSettledIdsRef  = useRef<Set<string>>(new Set());
  // Skip notification on the very first refresh after mount — those orders already exist,
  // we're just populating the baseline. Without this, a reload notifies for every open order.
  const isFirstRefreshRef   = useRef(true);

  // ── Connection + scan + retry ──────────────────────────────────────────
  useEffect(() => {
    if (!window.tmbill) return;
    // Kitchen screens are pure KDS clients — they get orders from the host via
    // WebSocket, not from TMBILL directly. Skip auto-connect to avoid spurious
    // "Reconnecting to TMBILL POS" toasts on kitchen screens.
    if (stationView !== 'all') return;

    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;

    async function doAutoConnect() {
      if (stopped) return;
      await runTmbillAutoConnect(dispatch);

      if (stopped) return;
      // Always schedule next check — handles both retry-on-failure and reconnect
      // detection if the POS drops after a successful initial connection.
      // When already connected, runTmbillAutoConnect just calls fetchRunningTables()
      // and returns, so this also acts as a periodic order-list refresh.
      retryTimer = setTimeout(doAutoConnect, RETRY_INTERVAL);
    }

    doAutoConnect();

    return () => {
      stopped = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [dispatch, stationView]);

  // ── Real-time event listeners ──────────────────────────────────────────
  useEffect(() => {
    if (!window.tmbill) return;
    if (stationView !== 'all') {
      kdsLog(`[TMBILL] event listeners NOT registered — stationView is '${stationView}' (only 'all' receives notifications)`, 'host', 'warn');
      return;
    }
    kdsLog(`[TMBILL] event listeners registered (stationView='all')`, 'host');

    const unsubRefresh = window.tmbill.onOrdersRefreshed((data) => {
      // Detect new orders by diffing running + settled against known IDs
      const incomingRunning = new Set<string>(data.running.map((o: any) => String(o.id)));
      // settled orders are sent raw from the plugin — their identifier is order_id, not id
      const incomingSettled = new Set<string>(data.settled.map((o: any) => String(o.order_id ?? o.id)));

      kdsLog(`[TMBILL] onOrdersRefreshed — running: ${data.running.length}, settled: ${data.settled.length} | known running: ${knownRunningIdsRef.current.size}, known settled: ${knownSettledIdsRef.current.size}`, 'host');

      // First refresh after mount: just snapshot current IDs as baseline, no notification.
      // Without this, every reload fires a notification for all existing open orders.
      if (isFirstRefreshRef.current) {
        isFirstRefreshRef.current      = false;
        knownRunningIdsRef.current     = incomingRunning;
        knownSettledIdsRef.current     = incomingSettled;
        kdsLog(`[TMBILL] first refresh — baseline snapshot taken, notification suppressed`, 'host');
        dispatch(setTmbillOrders({ running: data.running, settled: data.settled }));
        return;
      }

      const newRunning = [...incomingRunning].filter((id) => !knownRunningIdsRef.current.has(id));
      const newSettled = [...incomingSettled].filter((id) => !knownSettledIdsRef.current.has(id));

      kdsLog(`[TMBILL] diff — new running: [${newRunning.join(', ') || 'none'}], new settled: [${newSettled.join(', ') || 'none'}]`, 'host');

      if (newRunning.length > 0 || newSettled.length > 0) {
        console.log(`🔔 New TMBILL orders — running: ${newRunning.length}, settled (quickbill): ${newSettled.length}`);
        kdsLog(`[TMBILL] 🔔 triggering notification — running: ${newRunning.length}, quickbill: ${newSettled.length}`, 'host');
        audioNotificationService.playTmbillNotification();
      } else {
        kdsLog(`[TMBILL] no new orders — notification skipped`, 'host');
      }

      knownRunningIdsRef.current = incomingRunning;
      knownSettledIdsRef.current = incomingSettled;

      dispatch(setTmbillOrders({ running: data.running, settled: data.settled }));
    });

    const unsubRemoved = window.tmbill.onOrderRemoved((data) => {
      dispatch(removeTmbillOrder({ id: data.id }));
    });

    const unsubSettled = window.tmbill.onOrderSettled((data) => {
      dispatch(removeTmbillOrderByTableId({ tableId: data.tableId }));
    });

    const unsubMenu = window.tmbill.onMenuRefreshed((data) => {
      dispatch(setTmbillMenu(data.items));
    });

    return () => {
      unsubRefresh?.();
      unsubRemoved?.();
      unsubSettled?.();
      unsubMenu?.();
    };
  }, [dispatch, stationView]);
}
