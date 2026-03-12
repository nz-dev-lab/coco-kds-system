// src/pages/utilities/KdsDebugPanel.tsx
// KDS multi-screen debug panel — shows connection status and a live log terminal.
// Logs are stored in the module-level kdsLogger ring buffer so they persist
// across navigation and are visible here regardless of where they originated.

import { useEffect, useState, useRef, useMemo } from 'react';
import { useAppSelector } from '../../store/hooks';
import {
  KdsLogEntry,
  subscribeKdsLogs,
  clearKdsLogs,
} from '../../utils/kdsLogger';

// ── Pure helpers (defined outside component — stable references, no re-creation) ──

function levelColor(level: KdsLogEntry['level']) {
  if (level === 'error') return 'text-red-400';
  if (level === 'warn')  return 'text-yellow-400';
  return 'text-gray-300';
}

function sourceTag(source: KdsLogEntry['source']) {
  if (source === 'server') return <span className="text-blue-400">[server]</span>;
  if (source === 'client') return <span className="text-purple-400">[client]</span>;
  return <span className="text-emerald-400">[host]</span>;
}

// ─────────────────────────────────────────────────────────────────────────────

export default function KdsDebugPanel() {
  const stationView = useAppSelector((s) => s.ui.settings.stationView ?? 'all');
  const kdsHostIp   = useAppSelector((s) => s.ui.settings.kdsHostIp ?? null);

  const [logs, setLogs]               = useState<KdsLogEntry[]>([]);
  const [clientCount, setClientCount] = useState<number | null>(null);
  const [localIps, setLocalIps]       = useState<string[]>([]);
  const logEndRef                     = useRef<HTMLDivElement>(null);
  const autoScrollRef                 = useRef(true);

  const isHost   = stationView === 'all';
  const isClient = stationView !== 'all' && !!kdsHostIp;

  // Subscribe to the shared log buffer
  useEffect(() => {
    const unsub = subscribeKdsLogs(setLogs);
    return unsub;
  }, []);

  // Auto-scroll to bottom when new logs arrive (if user hasn't scrolled up)
  useEffect(() => {
    if (autoScrollRef.current) {
      logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  // Host: poll client count every 2s
  useEffect(() => {
    if (!isHost || !window.electron?.kdsServer) return;
    const poll = () =>
      window.electron!.kdsServer!.getClientCount().then(setClientCount).catch(() => {});
    poll();
    const id = setInterval(poll, 2000);
    return () => clearInterval(id);
  }, [isHost]);

  // Host: fetch local IPs once
  useEffect(() => {
    if (!isHost || !window.electron?.kdsServer) return;
    window.electron.kdsServer.getLocalIps().then(setLocalIps).catch(() => {});
  }, [isHost]);

  // Memoize rendered log rows — only re-renders when the logs array reference changes
  const renderedLogs = useMemo(() => logs.map((entry, i) => (
    <div key={i} className={`flex gap-2 hover:bg-white/5 px-1 rounded ${levelColor(entry.level)}`}>
      <span className="text-gray-500 shrink-0">{entry.ts}</span>
      <span className="shrink-0">{sourceTag(entry.source)}</span>
      <span className="break-all">{entry.msg}</span>
    </div>
  )), [logs]);

  return (
    <div className="h-full flex flex-col p-6 gap-4 overflow-y-auto">

      {/* Status cards */}
      <div className="grid grid-cols-2 gap-4">
        {/* Mode */}
        <div className="bg-white dark:bg-kds-bg-secondary rounded-xl border border-slate-200 dark:border-kds-border p-4">
          <p className="text-xs text-slate-500 dark:text-kds-text-muted mb-1">Mode</p>
          <p className="text-lg font-semibold text-slate-800 dark:text-kds-text-primary">
            {isHost ? 'Host (packing screen)' : isClient ? `Client — ${stationView}` : `Standalone — ${stationView}`}
          </p>
          {isClient && (
            <p className="text-xs text-slate-400 dark:text-kds-text-muted mt-1">
              Host IP: <span className="font-mono">{kdsHostIp}</span>
            </p>
          )}
          {isHost && localIps.length > 0 && (
            <p className="text-xs text-slate-400 dark:text-kds-text-muted mt-1">
              This IP: <span className="font-mono">{localIps.join(', ')}</span>
            </p>
          )}
        </div>

        {/* Connected kitchen screens (host only) */}
        <div className="bg-white dark:bg-kds-bg-secondary rounded-xl border border-slate-200 dark:border-kds-border p-4">
          <p className="text-xs text-slate-500 dark:text-kds-text-muted mb-1">Kitchen screens connected</p>
          {isHost ? (
            <p className="text-3xl font-bold text-slate-800 dark:text-kds-text-primary">
              {clientCount ?? '—'}
            </p>
          ) : (
            <p className="text-sm text-slate-400 dark:text-kds-text-muted italic">
              Only visible on host screen
            </p>
          )}
        </div>
      </div>

      {/* Log terminal */}
      <div className="flex-1 flex flex-col bg-gray-950 rounded-xl border border-gray-800 overflow-hidden min-h-[320px]">
        {/* Terminal toolbar */}
        <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800 shrink-0">
          <span className="text-xs font-mono text-gray-400">KDS log ({logs.length} entries)</span>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer select-none">
              <input
                type="checkbox"
                defaultChecked
                onChange={(e) => { autoScrollRef.current = e.target.checked; }}
                className="accent-blue-500"
              />
              Auto-scroll
            </label>
            <button
              onClick={clearKdsLogs}
              className="text-xs px-3 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Log entries */}
        <div
          className="flex-1 overflow-y-auto p-3 font-mono text-xs space-y-0.5"
          onScroll={(e) => {
            const el = e.currentTarget;
            autoScrollRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
          }}
        >
          {logs.length === 0 ? (
            <p className="text-gray-600 p-2">No log entries yet. Logs appear here as KDS events occur.</p>
          ) : (
            renderedLogs
          )}
          <div ref={logEndRef} />
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-kds-text-muted">
        <span className="flex items-center gap-1"><span className="text-emerald-400 font-mono">[host]</span> host renderer</span>
        <span className="flex items-center gap-1"><span className="text-blue-400 font-mono">[server]</span> Electron main process (KDS WebSocket server)</span>
        <span className="flex items-center gap-1"><span className="text-purple-400 font-mono">[client]</span> kitchen screen WebSocket client</span>
      </div>
    </div>
  );
}
