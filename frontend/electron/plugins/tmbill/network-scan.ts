/**
 * TMBILL POS Network Scanner
 *
 * Scans the local LAN for a TMBILL POS server on a given port.
 * All operations run in the Electron main process (Node.js) via the `net` module.
 *
 * Strategy:
 *  1. Detect local IPv4 subnets via os.networkInterfaces()
 *  2. Probe all 254 hosts in parallel batches with a short TCP timeout
 *  3. For each open port, verify it's actually TMBILL by hitting POST /login
 *  4. Return the first matching IP
 */

import * as net from 'net';
import * as os from 'os';

const PROBE_TIMEOUT_MS = 400;   // TCP connect timeout per host
const VERIFY_TIMEOUT_MS = 2000; // HTTP verify timeout
const BATCH_SIZE = 30;          // parallel probes at once

/** Returns true if TCP port is open on host within timeout. */
function isPortOpen(host: string, port: number): Promise<boolean> {
  return new Promise(resolve => {
    const socket = new net.Socket();
    let settled = false;
    const finish = (result: boolean) => {
      if (!settled) { settled = true; socket.destroy(); resolve(result); }
    };
    socket.setTimeout(PROBE_TIMEOUT_MS);
    socket.on('connect', () => finish(true));
    socket.on('timeout', () => finish(false));
    socket.on('error',   () => finish(false));
    socket.connect(port, host);
  });
}

/**
 * Verifies the host is a TMBILL POS server by hitting POST /login.
 * TMBILL always responds with { status: number } even for wrong credentials.
 */
async function isTmbillServer(host: string, port: number): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS);
  try {
    const res = await fetch(`http://${host}:${port}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: '', password: '' }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    const data = await res.json() as any;
    // TMBILL login always returns { status: 200|400|401, ... }
    return typeof data?.status === 'number';
  } catch {
    clearTimeout(timer);
    return false;
  }
}

/** Returns unique /24 subnets for all non-loopback IPv4 interfaces. */
function getLocalSubnets(): string[] {
  const subnets = new Set<string>();
  for (const iface of Object.values(os.networkInterfaces())) {
    for (const alias of iface ?? []) {
      if (alias.family === 'IPv4' && !alias.internal) {
        subnets.add(alias.address.split('.').slice(0, 3).join('.'));
      }
    }
  }
  return [...subnets];
}

/**
 * Scans all local subnets for a TMBILL POS server.
 * Returns the first matching IP, or null if none found.
 */
export async function scanForTmbill(port = 3000): Promise<string | null> {
  const subnets = getLocalSubnets();

  for (const subnet of subnets) {
    for (let start = 1; start < 255; start += BATCH_SIZE) {
      const end = Math.min(start + BATCH_SIZE, 255);

      // Probe all IPs in batch in parallel
      const openIps = (await Promise.all(
        Array.from({ length: end - start }, (_, i) => {
          const ip = `${subnet}.${start + i}`;
          return isPortOpen(ip, port).then(open => open ? ip : null);
        })
      )).filter(Boolean) as string[];

      // Verify each open IP is actually TMBILL
      for (const ip of openIps) {
        if (await isTmbillServer(ip, port)) return ip;
      }
    }
  }

  return null;
}
