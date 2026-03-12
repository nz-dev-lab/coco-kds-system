// src/pages/utilities/TalecomPanel.tsx
import { useEffect, useState } from 'react';
import { Phone, PhoneOff, PhoneIncoming, RefreshCw } from 'lucide-react';
import { toast } from 'react-toastify';

interface IntercomStatus {
  enabled: boolean;
  running: boolean;
  ready: boolean;
  port: number;
}

export default function TalecomPanel() {
  const [status, setStatus] = useState<IntercomStatus | null>(null);
  const [config, setConfig] = useState<{ talecom_auto_accept: boolean } | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);

  const fetchStatus = async () => {
    try {
      const s = await window.electron.intercom.getStatus();
      setStatus(s);
    } catch {
      setStatus(null);
    }
  };

  const fetchConfig = async () => {
    try {
      const cfg = await window.electron.config.get();
      setConfig({ talecom_auto_accept: cfg.talecom_auto_accept });
    } catch {}
  };

  useEffect(() => {
    fetchStatus();
    fetchConfig();
    const interval = setInterval(fetchStatus, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleAutoAccept = async () => {
    if (!config) return;
    setSavingConfig(true);
    try {
      const updated = await window.electron.config.set({
        talecom_auto_accept: !config.talecom_auto_accept,
      });
      setConfig({ talecom_auto_accept: updated.talecom_auto_accept });
      toast.success(
        updated.talecom_auto_accept
          ? 'Auto-accept enabled — calls will connect automatically'
          : 'Auto-accept disabled — callers will wait for you to answer'
      );
    } catch {
      toast.error('Failed to save setting');
    } finally {
      setSavingConfig(false);
    }
  };

  // Status dot logic
  const dot = status?.ready
    ? { color: 'bg-green-500', pulse: true,  label: 'Ready', sub: `Listening on port ${status.port}` }
    : status?.running
    ? { color: 'bg-amber-400', pulse: true,  label: 'Starting…', sub: 'Worker process is initialising' }
    : { color: 'bg-red-500',   pulse: false, label: 'Offline', sub: 'Intercom worker is not running' };

  return (
    <div className="p-6 max-w-2xl space-y-6">

      {/* Status card */}
      <div className="bg-white dark:bg-kds-bg-secondary rounded-xl border border-slate-200 dark:border-kds-border shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-kds-text-primary flex items-center gap-2">
            <Phone className="w-5 h-5 text-teal-500" />
            Intercom Status
          </h2>
          <button
            onClick={fetchStatus}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-kds-surface transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-kds-text-primary"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-4 p-4 rounded-lg bg-slate-50 dark:bg-kds-surface border border-slate-100 dark:border-kds-border">
          {/* Animated dot */}
          <div className="relative flex-shrink-0">
            <span className={`w-4 h-4 rounded-full block ${dot.color}`} />
            {dot.pulse && (
              <span className={`absolute inset-0 rounded-full ${dot.color} animate-ping opacity-50`} />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p className="font-semibold text-slate-800 dark:text-kds-text-primary">{dot.label}</p>
            <p className="text-sm text-slate-500 dark:text-kds-text-muted">{dot.sub}</p>
          </div>

          {status?.ready ? (
            <PhoneIncoming className="w-5 h-5 text-green-500 flex-shrink-0" />
          ) : (
            <PhoneOff className="w-5 h-5 text-slate-300 dark:text-kds-text-muted flex-shrink-0" />
          )}
        </div>

        {/* Info row */}
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-kds-surface border border-slate-100 dark:border-kds-border">
            <p className="text-xs text-slate-400 dark:text-kds-text-muted mb-0.5">Port</p>
            <p className="font-mono text-sm font-semibold text-slate-800 dark:text-kds-text-primary">
              {status?.port ?? 7655}
            </p>
          </div>
          <div className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-kds-surface border border-slate-100 dark:border-kds-border">
            <p className="text-xs text-slate-400 dark:text-kds-text-muted mb-0.5">Worker process</p>
            <p className={`text-sm font-semibold ${status?.running ? 'text-green-600' : 'text-slate-400 dark:text-kds-text-muted'}`}>
              {status?.running ? 'Running' : 'Stopped'}
            </p>
          </div>
        </div>
      </div>

      {/* Auto-accept toggle */}
      <div className="bg-white dark:bg-kds-bg-secondary rounded-xl border border-slate-200 dark:border-kds-border shadow-sm p-5">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-kds-text-primary mb-4">
          Call Settings
        </h2>

        <div className="flex items-center justify-between py-3 border-t border-slate-100 dark:border-kds-border">
          <div className="flex items-center gap-3">
            <PhoneIncoming className="w-5 h-5 text-teal-500 flex-shrink-0" />
            <div>
              <p className="font-medium text-slate-800 dark:text-kds-text-primary">Auto-accept calls</p>
              <p className="text-sm text-slate-500 dark:text-kds-text-muted">
                {config?.talecom_auto_accept
                  ? 'Incoming calls connect automatically'
                  : 'Caller waits — kitchen staff must answer'}
              </p>
            </div>
          </div>
          <button
            onClick={handleToggleAutoAccept}
            disabled={savingConfig || config === null}
            className={`relative w-14 h-7 rounded-full transition-colors disabled:opacity-50 ${
              config?.talecom_auto_accept ? 'bg-teal-500' : 'bg-slate-300 dark:bg-kds-surface'
            }`}
          >
            <span className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform ${
              config?.talecom_auto_accept ? 'translate-x-7' : 'translate-x-0'
            }`} />
          </button>
        </div>
      </div>

    </div>
  );
}
