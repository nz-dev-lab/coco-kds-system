// src/pages/utilities/TailcomPanel.tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import { Phone, PhoneOff, PhoneIncoming, RefreshCw, Trash2, Activity } from 'lucide-react';
import { toast } from 'react-toastify';

const BUFFER_SIZE = 120; // 12 s of history at 10 Hz

interface IntercomStatus {
  enabled: boolean;
  running: boolean;
  ready: boolean;
  port: number;
}

// ── ECG canvas draw ──────────────────────────────────────────────────────────
function drawEcg(
  canvas: HTMLCanvasElement,
  buf: Float32Array,
  color: string,
  glow: string,
  label: string,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);

  // Background
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, w, h);

  // Centre baseline
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, h / 2);
  ctx.lineTo(w, h / 2);
  ctx.stroke();

  // Label (top-left)
  ctx.fillStyle = '#475569';
  ctx.font = '10px monospace';
  ctx.fillText(label, 4, 12);

  // Waveform
  const amplitude = h / 2 - 6;
  const midY = h / 2;
  ctx.beginPath();
  for (let i = 0; i < BUFFER_SIZE; i++) {
    const x = (i / (BUFFER_SIZE - 1)) * w;
    const y = midY - buf[i] * amplitude;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.shadowBlur = 8;
  ctx.shadowColor = glow;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Peak value (top-right)
  const peak = buf.reduce((a, v) => Math.max(a, v), 0);
  ctx.fillStyle = peak > 0.01 ? color : '#334155';
  ctx.font = '10px monospace';
  const peakStr = (peak * 100).toFixed(0) + '%';
  ctx.fillText(peakStr, w - 30, 12);
}

export default function TailcomPanel() {
  const [status, setStatus]             = useState<IntercomStatus | null>(null);
  const [config, setConfig]             = useState<{ tailcom_auto_accept: boolean } | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);
  const [logs, setLogs]                 = useState<string[]>([]);
  const [autoScroll, setAutoScroll]     = useState(true);
  const logRef = useRef<HTMLDivElement>(null);

  // ── ECG refs (no state — avoids re-renders at 10 Hz) ───────────────────────
  const localBuf        = useRef(new Float32Array(BUFFER_SIZE));
  const remoteBuf       = useRef(new Float32Array(BUFFER_SIZE));
  const localCanvasRef  = useRef<HTMLCanvasElement>(null);
  const remoteCanvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef          = useRef(0);

  // ── Polling ────────────────────────────────────────────────────────────────
  const fetchStatus = async () => {
    try { setStatus(await window.electron.intercom.getStatus()); } catch { setStatus(null); }
  };

  const fetchConfig = async () => {
    try {
      const cfg = await window.electron.config.get();
      setConfig({ tailcom_auto_accept: cfg.tailcom_auto_accept });
    } catch {}
  };

  const fetchLogs = async () => {
    try { setLogs(await window.electron.intercom.getLogs()); } catch {}
  };

  useEffect(() => {
    fetchStatus();
    fetchConfig();
    fetchLogs();
    const interval = setInterval(() => { fetchStatus(); fetchLogs(); }, 2000);
    return () => clearInterval(interval);
  }, []);

  // ── Auto-scroll ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (autoScroll && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  // ── ECG animation + IPC subscription ───────────────────────────────────────
  const animate = useCallback(() => {
    try {
      if (localCanvasRef.current)  drawEcg(localCanvasRef.current,  localBuf.current,  '#2dd4bf', '#0d9488', 'Outgoing (mic)');
      if (remoteCanvasRef.current) drawEcg(remoteCanvasRef.current, remoteBuf.current, '#a78bfa', '#7c3aed', 'Incoming (speaker)');
    } catch { /* never crash the panel */ }
    rafRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    // Size canvases to their CSS layout width on mount
    const size = (canvas: HTMLCanvasElement | null) => {
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      if (rect.width > 0) {
        canvas.width  = rect.width  * dpr;
        canvas.height = rect.height * dpr;
      }
    };
    size(localCanvasRef.current);
    size(remoteCanvasRef.current);

    rafRef.current = requestAnimationFrame(animate);

    // Subscribe to audio level IPC events
    const unsub = window.electron?.intercom?.onAudioLevel?.((data) => {
      const buf = data.channel === 'local' ? localBuf.current : remoteBuf.current;
      buf.copyWithin(0, 1);              // shift left
      buf[BUFFER_SIZE - 1] = data.rms;  // append new sample
    });

    return () => {
      cancelAnimationFrame(rafRef.current);
      try { unsub?.(); } catch { /* ignore */ }
    };
  }, [animate]);

  // ── Toggle auto-accept ─────────────────────────────────────────────────────
  const handleToggleAutoAccept = async () => {
    if (!config) return;
    setSavingConfig(true);
    try {
      const updated = await window.electron.config.set({ tailcom_auto_accept: !config.tailcom_auto_accept });
      setConfig({ tailcom_auto_accept: updated.tailcom_auto_accept });
      toast.success(updated.tailcom_auto_accept
        ? 'Auto-accept enabled — calls connect automatically'
        : 'Auto-accept disabled — staff must answer calls');
    } catch {
      toast.error('Failed to save setting');
    } finally {
      setSavingConfig(false);
    }
  };

  // ── Status dot ─────────────────────────────────────────────────────────────
  const dot = status?.ready
    ? { color: 'bg-green-500', pulse: true,  label: 'Ready',     sub: `Listening on port ${status.port}` }
    : status?.running
    ? { color: 'bg-amber-400', pulse: true,  label: 'Starting…', sub: 'Worker process is initialising' }
    : { color: 'bg-red-500',   pulse: false, label: 'Offline',   sub: 'Intercom worker is not running' };

  // ── Log line colour ────────────────────────────────────────────────────────
  const logColor = (line: string) => {
    if (/ERR|error|failed|ENOENT|exit code [^0]/.test(line)) return 'text-red-400';
    if (/connected|listening|healthy|first frame/.test(line))  return 'text-green-400';
    if (/devices|INPUT DEVICES|OUTPUT DEVICES/.test(line))     return 'text-blue-300';
    if (/webrtc|iceConnect|connectionState|ontrack/.test(line)) return 'text-purple-300';
    if (/call started|call ended|incoming-call/.test(line))    return 'text-yellow-300';
    return 'text-slate-300';
  };

  return (
    <div className="p-6 max-w-3xl space-y-6">

      {/* Status card */}
      <div className="bg-white dark:bg-kds-bg-secondary rounded-xl border border-slate-200 dark:border-kds-border shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-kds-text-primary flex items-center gap-2">
            <Phone className="w-5 h-5 text-teal-500" />
            Tailcom Status
          </h2>
          <button
            onClick={() => { fetchStatus(); fetchLogs(); }}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-kds-surface transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-kds-text-primary"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-4 p-4 rounded-lg bg-slate-50 dark:bg-kds-surface border border-slate-100 dark:border-kds-border">
          <div className="relative flex-shrink-0">
            <span className={`w-4 h-4 rounded-full block ${dot.color}`} />
            {dot.pulse && <span className={`absolute inset-0 rounded-full ${dot.color} animate-ping opacity-50`} />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-slate-800 dark:text-kds-text-primary">{dot.label}</p>
            <p className="text-sm text-slate-500 dark:text-kds-text-muted">{dot.sub}</p>
          </div>
          {status?.ready
            ? <PhoneIncoming className="w-5 h-5 text-green-500 flex-shrink-0" />
            : <PhoneOff className="w-5 h-5 text-slate-300 dark:text-kds-text-muted flex-shrink-0" />}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-kds-surface border border-slate-100 dark:border-kds-border">
            <p className="text-xs text-slate-400 dark:text-kds-text-muted mb-0.5">Port</p>
            <p className="font-mono text-sm font-semibold text-slate-800 dark:text-kds-text-primary">{status?.port ?? 7655}</p>
          </div>
          <div className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-kds-surface border border-slate-100 dark:border-kds-border">
            <p className="text-xs text-slate-400 dark:text-kds-text-muted mb-0.5">Worker</p>
            <p className={`text-sm font-semibold ${status?.running ? 'text-green-600' : 'text-slate-400 dark:text-kds-text-muted'}`}>
              {status?.running ? 'Running' : 'Stopped'}
            </p>
          </div>
        </div>
      </div>

      {/* Audio Monitor */}
      <div className="bg-white dark:bg-kds-bg-secondary rounded-xl border border-slate-200 dark:border-kds-border shadow-sm p-5">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-kds-text-primary flex items-center gap-2 mb-3">
          <Activity className="w-5 h-5 text-teal-500" />
          Audio Monitor
        </h2>
        <p className="text-xs text-slate-400 dark:text-kds-text-muted mb-3">
          Live audio levels during an active call · 12 s window · 10 Hz
        </p>
        <div className="space-y-2 rounded-lg overflow-hidden border border-slate-200 dark:border-kds-border">
          <canvas
            ref={localCanvasRef}
            style={{ width: '100%', height: '56px', display: 'block' }}
          />
          <canvas
            ref={remoteCanvasRef}
            style={{ width: '100%', height: '56px', display: 'block' }}
          />
        </div>
        <p className="text-xs text-slate-400 dark:text-kds-text-muted mt-2">
          <span className="text-teal-400">teal = outgoing mic (your side)</span>
          <span className="mx-2">·</span>
          <span className="text-purple-400">purple = incoming speaker (client side)</span>
          <span className="mx-2">·</span>
          flat line = no call active
        </p>
      </div>

      {/* Call settings — hidden for now; staff must answer/reject calls manually */}
      {false && (
      <div className="bg-white dark:bg-kds-bg-secondary rounded-xl border border-slate-200 dark:border-kds-border shadow-sm p-5">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-kds-text-primary mb-4">Call Settings</h2>
        <div className="flex items-center justify-between py-3 border-t border-slate-100 dark:border-kds-border">
          <div className="flex items-center gap-3">
            <PhoneIncoming className="w-5 h-5 text-teal-500 flex-shrink-0" />
            <div>
              <p className="font-medium text-slate-800 dark:text-kds-text-primary">Auto-accept calls</p>
              <p className="text-sm text-slate-500 dark:text-kds-text-muted">
                {config?.tailcom_auto_accept ? 'Incoming calls connect automatically' : 'Caller waits — kitchen staff must answer'}
              </p>
            </div>
          </div>
          <button
            onClick={handleToggleAutoAccept}
            disabled={savingConfig || config === null}
            className={`relative w-14 h-7 rounded-full transition-colors disabled:opacity-50 ${
              config?.tailcom_auto_accept ? 'bg-teal-500' : 'bg-slate-300 dark:bg-kds-surface'
            }`}
          >
            <span className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform ${
              config?.tailcom_auto_accept ? 'translate-x-7' : 'translate-x-0'
            }`} />
          </button>
        </div>
      </div>
      )}

      {/* Live worker log */}
      <div className="bg-white dark:bg-kds-bg-secondary rounded-xl border border-slate-200 dark:border-kds-border shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-kds-text-primary">Worker Log</h2>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-kds-text-muted cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
                className="accent-teal-500"
              />
              Auto-scroll
            </label>
            <button
              onClick={() => setLogs([])}
              title="Clear log view"
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-kds-surface text-slate-400 hover:text-slate-600 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div
          ref={logRef}
          onScroll={() => {
            if (!logRef.current) return;
            const { scrollTop, scrollHeight, clientHeight } = logRef.current;
            setAutoScroll(scrollHeight - scrollTop - clientHeight < 30);
          }}
          className="h-72 overflow-y-auto bg-slate-900 rounded-lg p-3 font-mono text-xs leading-5"
        >
          {logs.length === 0
            ? <p className="text-slate-500 italic">No logs yet — waiting for worker output…</p>
            : logs.map((line, i) => <p key={i} className={logColor(line)}>{line}</p>)
          }
        </div>

        <p className="text-xs text-slate-400 dark:text-kds-text-muted mt-2">
          Refreshes every 2 s · Colour:
          <span className="text-green-500 ml-1">green=OK</span>
          <span className="text-red-400 ml-1">red=error</span>
          <span className="text-blue-300 ml-1">blue=audio devices</span>
          <span className="text-purple-300 ml-1">purple=WebRTC</span>
          <span className="text-yellow-300 ml-1">yellow=call events</span>
        </p>
      </div>

    </div>
  );
}
