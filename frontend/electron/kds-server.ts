// electron/kds-server.ts
// KDS WebSocket server — KDS computer acts as mediator for all kitchen screens.
// Kitchen screens connect here and receive station-filtered order updates.
// TMBILL orders are naturally segregated: if TMBILL is disabled in config,
// no TMBILL orders will be in the broadcast payload.

import { WebSocketServer, WebSocket } from 'ws';
import * as net from 'net';
import * as os from 'os';
import { getAllCanonicalItems } from './database';

export const KDS_SERVER_PORT = 7654;

type StationView = 'all' | 'main_kitchen' | 'grill';

interface KdsClient {
  ws: WebSocket;
  stationView: StationView;
}

let wss: WebSocketServer | null = null;
const clients = new Set<KdsClient>();
let cachedOrders: any[] = [];
let clientChangedCb: ((count: number) => void) | null = null;

// ── Station filtering helpers ─────────────────────────────────────────────────

function parseStations(station: string | null | undefined): string[] {
  if (!station) return [];
  try {
    const parsed = JSON.parse(station);
    return Array.isArray(parsed) ? parsed : [station];
  } catch {
    return [station];
  }
}

/**
 * Filter orders for a specific station.
 * - 'all': returns everything (packing screen)
 * - other: returns only orders that have at least one item assigned to that station
 *          items for other stations are stripped from the order object
 *
 * Items with no station assignment are ONLY shown on 'all' screens.
 * This function reads fresh canonical data from SQLite on each call —
 * better-sqlite3 is synchronous so this is safe on main thread.
 */
function filterOrdersForStation(orders: any[], stationView: StationView): any[] {
  if (stationView === 'all') return orders;

  const result = getAllCanonicalItems();
  if (!result.success || !result.data) return [];

  // Build lookup maps from canonical data
  const foodStations   = new Map<string, string[]>(); // cocoeats food_id   → stations
  const tmbillStations = new Map<number, string[]>(); // tmbill item_id     → stations
  const tmbillNameSt   = new Map<string, string[]>(); // tmbill item_name   → stations (QB fallback)

  for (const canonical of result.data) {
    const stations = parseStations(canonical.station);
    if (stations.length === 0) continue;
    for (const m of canonical.cocoeats_maps) foodStations.set(m.food_id, stations);
    for (const m of canonical.tmbill_maps) {
      tmbillStations.set(m.item_id, stations);
      tmbillNameSt.set(m.item_name.toLowerCase(), stations);
    }
  }

  const filtered: any[] = [];

  for (const order of orders) {
    const isTmbill = order._source === 'tmbill';

    const filteredItems = (order.items ?? []).filter((item: any) => {
      // Running KOT orders: food_id = menu item_id as string → ID lookup works.
      // Settled/QB orders:  food_id = order child row id    → ID lookup fails,
      //                     fall back to name match against tmbill_maps.item_name.
      const stations = isTmbill
        ? (tmbillStations.get(parseInt(item.food_id)) ?? tmbillNameSt.get((item.name as string).toLowerCase()) ?? [])
        : (foodStations.get(item.food_id) ?? []);

      // Unassigned items → visible only on 'all' screens
      if (stations.length === 0) return false;
      return stations.includes(stationView);
    });

    // Keep ready items for strikethrough display; only drop the order when all done.
    const allDone = filteredItems.every((item: any) => item.isReady);
    if (!allDone) {
      filtered.push({ ...order, items: filteredItems });
    }
  }

  return filtered;
}

// ── WebSocket helpers ─────────────────────────────────────────────────────────

function send(client: KdsClient, msg: object) {
  if (client.ws.readyState === WebSocket.OPEN) {
    client.ws.send(JSON.stringify(msg));
  }
}

function notifyClientCount() {
  clientChangedCb?.(clients.size);
}

// ── Server lifecycle ──────────────────────────────────────────────────────────

export function startKdsServer(onClientChanged?: (count: number) => void): number {
  if (wss) return KDS_SERVER_PORT;

  if (onClientChanged) clientChangedCb = onClientChanged;

  wss = new WebSocketServer({ port: KDS_SERVER_PORT });

  wss.on('connection', (ws) => {
    const client: KdsClient = { ws, stationView: 'all' };
    clients.add(client);
    notifyClientCount();

    send(client, { type: 'connected', port: KDS_SERVER_PORT });
    console.log(`[KDS Server] Client connected (${clients.size} total)`);

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());

        if (msg.type === 'register') {
          client.stationView = (msg.stationView as StationView) ?? 'all';

          // Send current canonical/station config
          const cfgResult = getAllCanonicalItems();
          send(client, { type: 'station_config', canonicals: cfgResult.data ?? [] });

          // Send current orders pre-filtered for this station
          const filtered = filterOrdersForStation(cachedOrders, client.stationView);
          send(client, { type: 'orders_update', orders: filtered });

          console.log(`[KDS Server] Client registered as: ${client.stationView}`);

        } else if (msg.type === 'ping') {
          send(client, { type: 'pong' });
        }
      } catch {
        // Ignore malformed messages
      }
    });

    ws.on('close', () => {
      clients.delete(client);
      notifyClientCount();
      console.log(`[KDS Server] Client disconnected (${clients.size} total)`);
    });

    ws.on('error', () => {
      clients.delete(client);
      notifyClientCount();
    });
  });

  wss.on('error', (err: Error) => {
    console.error('[KDS Server] Server error:', err.message);
  });

  console.log(`[KDS Server] Listening on ws://0.0.0.0:${KDS_SERVER_PORT}`);
  return KDS_SERVER_PORT;
}

/**
 * Called by IPC handler whenever the renderer's order state changes.
 * Broadcasts station-filtered orders to every connected client.
 */
export function broadcastOrders(orders: any[]) {
  cachedOrders = orders;
  for (const client of clients) {
    const filtered = filterOrdersForStation(orders, client.stationView);
    send(client, { type: 'orders_update', orders: filtered });
  }
}

export function getClientCount(): number {
  return clients.size;
}

export function stopKdsServer() {
  wss?.close();
  wss = null;
  clients.clear();
  console.log('[KDS Server] Stopped');
}

// ── Network utilities ─────────────────────────────────────────────────────────

/** Returns true for RFC 1918 private LAN addresses (excludes Tailscale, VPNs, etc.) */
function isPrivateLanIp(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4) return false;
  return (
    parts[0] === 10 ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168)
  );
}

/** Returns non-loopback RFC 1918 IPv4 addresses of this machine (LAN only). */
export function getLocalIpAddresses(): string[] {
  const ips: string[] = [];
  for (const iface of Object.values(os.networkInterfaces())) {
    for (const alias of iface ?? []) {
      if (alias.family === 'IPv4' && !alias.internal && isPrivateLanIp(alias.address)) {
        ips.push(alias.address);
      }
    }
  }
  return ips;
}

const SCAN_PROBE_TIMEOUT_MS = 400;
const SCAN_BATCH_SIZE = 30;

function isPortOpen(host: string, port: number): Promise<boolean> {
  return new Promise(resolve => {
    const socket = new net.Socket();
    let settled = false;
    const finish = (result: boolean) => {
      if (!settled) { settled = true; socket.destroy(); resolve(result); }
    };
    socket.setTimeout(SCAN_PROBE_TIMEOUT_MS);
    socket.on('connect', () => finish(true));
    socket.on('timeout', () => finish(false));
    socket.on('error',   () => finish(false));
    socket.connect(port, host);
  });
}

/**
 * Scans the local subnet(s) for a KDS server on KDS_SERVER_PORT.
 * Skips this machine's own IPs — caller is a kitchen screen looking for the host.
 * Returns the first IP found, or null if none.
 */
export async function scanForKdsServer(): Promise<string | null> {
  const subnets = new Set<string>();
  const ownIps  = new Set(getLocalIpAddresses());

  for (const iface of Object.values(os.networkInterfaces())) {
    for (const alias of iface ?? []) {
      if (alias.family === 'IPv4' && !alias.internal) {
        subnets.add(alias.address.split('.').slice(0, 3).join('.'));
      }
    }
  }

  for (const subnet of subnets) {
    for (let start = 1; start < 255; start += SCAN_BATCH_SIZE) {
      const end = Math.min(start + SCAN_BATCH_SIZE, 255);
      const results = await Promise.all(
        Array.from({ length: end - start }, (_, i) => {
          const ip = `${subnet}.${start + i}`;
          if (ownIps.has(ip)) return Promise.resolve(null); // skip self
          return isPortOpen(ip, KDS_SERVER_PORT).then(open => open ? ip : null);
        })
      );
      const found = results.find(Boolean);
      if (found) return found;
    }
  }

  return null;
}
