// src/pages/Settings.tsx
import { useState, useEffect, useCallback } from 'react';
import { Volume2, Mic, MicOff, Play, RotateCcw, Type, CaseSensitive, Printer, RefreshCw, Zap, Monitor, Wifi, WifiOff, ScanSearch, Bug } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  toggleAudioNotifications,
  toggleVoiceNotifications,
  setSoundEffectsVolume,
  setVoiceVolume,
  resetSettings,
  setProcessingMode,
  setRequireDoubleTap,
  setItemNameFontSize,
  toggleItemNameUppercase,
  setSelectedPrinterName,
  setPaperWidth,
  toggleAutoPrint,
  setStationView,
  setKdsHostIp,
  setDebugMode,
  toggleTmbillNotifications,
  setTmbillNotificationVolume,
  setTmbillCustomSoundPath,
  setTmbillScheduledAlertMinutes,
  type StationView,
} from '../store/slices/uiSlice';
import { audioNotificationService } from '../utils/audioNotifications';
import { toast } from 'react-toastify';

// ── Printer status helpers ────────────────────────────────────────────────────
function printerStatusDot(status: number) {
  if (status === 3) return { color: 'bg-green-500', label: 'Ready' };
  if (status === 4) return { color: 'bg-amber-400', label: 'Printing' };
  if (status === 5) return { color: 'bg-red-500', label: 'Offline' };
  return { color: 'bg-slate-400', label: 'Unknown' };
}

export default function Settings() {
  const dispatch = useAppDispatch();
  const settings = useAppSelector((state) => state.ui.settings);
  const printerSettings = settings.printer;

  // ── KDS Server section state (host only) ─────────────────────────────────
  const isElectronApp = typeof window !== 'undefined' && !!window.electron?.kdsServer;
  const isKdsServer = isElectronApp && settings.stationView === 'all';
  const [kdsClientCount, setKdsClientCount] = useState<number>(0);
  const [localIps, setLocalIps] = useState<string[]>([]);

  // ── KDS Client section state (kitchen screens) ────────────────────────────
  const isKdsClient = isElectronApp && settings.stationView !== 'all';
  const [kdsHostIpInput, setKdsHostIpInput] = useState<string>(settings.kdsHostIp ?? '');

  // ── Update panel state ────────────────────────────────────────────────────
  type UpdateStatus = 'idle' | 'checking' | 'up-to-date' | 'available' | 'downloading' | 'ready' | 'error';
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>('idle');
  const [updateInfo, setUpdateInfo] = useState<{ version: string; releaseDate?: string } | null>(null);
  const [downloadPercent, setDownloadPercent] = useState(0);
  const [appVersion, setAppVersion] = useState<string>('');
  const [updateError, setUpdateError] = useState<string>('');

  useEffect(() => {
    if (!window.electron?.autoUpdater) return;
    window.electron.autoUpdater.getAppVersion().then(setAppVersion).catch(() => {});
    window.electron.autoUpdater.onCheckingForUpdate(() => setUpdateStatus('checking'));
    window.electron.autoUpdater.onUpdateAvailable((info) => {
      setUpdateInfo({ version: info.version, releaseDate: info.releaseDate });
      setUpdateStatus('available');
    });
    window.electron.autoUpdater.onUpdateNotAvailable(() => setUpdateStatus('up-to-date'));
    window.electron.autoUpdater.onUpdateProgress((p) => {
      setDownloadPercent(Math.round(p.percent));
      setUpdateStatus('downloading');
    });
    window.electron.autoUpdater.onUpdateDownloaded((info) => {
      setUpdateInfo((prev) => ({ ...prev, version: info.version }));
      setUpdateStatus('ready');
    });
    window.electron.autoUpdater.onUpdateError((err) => {
      setUpdateError(err);
      setUpdateStatus('error');
    });
  }, []);
  const [scanning, setScanning] = useState(false);
  // Sync input if saved value changes externally (e.g. clear button)
  useEffect(() => { setKdsHostIpInput(settings.kdsHostIp ?? ''); }, [settings.kdsHostIp]);

  useEffect(() => {
    if (!isKdsServer) return;
    window.electron.kdsServer.getClientCount().then(setKdsClientCount).catch(() => {});
    window.electron.kdsServer.getLocalIps().then(setLocalIps).catch(() => {});
    const unsub = window.electron.kdsServer.onClientCountChanged((count) => setKdsClientCount(count));
    return unsub;
  }, [isKdsServer]);

  const handleScan = async () => {
    if (scanning) return;
    setScanning(true);
    try {
      const found = await window.electron.kdsServer.scan();
      if (found) {
        setKdsHostIpInput(found);
        dispatch(setKdsHostIp(found));
        toast.success(`KDS host found at ${found} — connected!`);
      } else {
        toast.warn('No KDS host found on the network. Enter the IP manually.');
      }
    } catch {
      toast.error('Scan failed. Check network connection.');
    } finally {
      setScanning(false);
    }
  };

  // ── Printer section state ─────────────────────────────────────────────────
  const [printerList, setPrinterList] = useState<any[]>([]);
  const [loadingPrinters, setLoadingPrinters] = useState(false);
  const [testPrinting, setTestPrinting] = useState(false);
  const [ipInput, setIpInput] = useState('');
  const [printerIps, setPrinterIps] = useState<Record<string, string>>({});
  const [resolvingIps, setResolvingIps] = useState(false);
  const isElectron = typeof window !== 'undefined' && !!window.electron?.printer;
  const isWindows = window.electron?.platform === 'win32';

  const resolveNetworkIps = useCallback(async (printers: any[]) => {
    if (!isWindows || !window.electron?.printer?.getPrinterIp) return;
    setResolvingIps(true);
    setPrinterIps({});
    await Promise.all(printers.map(async (p) => {
      try {
        const res = await window.electron.printer.getPrinterIp(p.name);
        if (res.success && res.ip) {
          setPrinterIps(prev => ({ ...prev, [p.name]: res.ip! }));
        }
      } catch {}
    }));
    setResolvingIps(false);
  }, [isWindows]);

  const loadPrinters = useCallback(async () => {
    if (!isElectron) return;
    setLoadingPrinters(true);
    try {
      const list = await window.electron.printer.getPrinters();
      setPrinterList(list);
      resolveNetworkIps(list);
    } catch {
      setPrinterList([]);
    } finally {
      setLoadingPrinters(false);
    }
  }, [isElectron, resolveNetworkIps]);

  useEffect(() => { loadPrinters(); }, [loadPrinters]);

  const handleTestPrint = async () => {
    if (!isElectron) return;
    if (!printerSettings?.selectedPrinterName) {
      toast.warn('No printer selected. Select a printer or enter an IP address above.');
      return;
    }
    setTestPrinting(true);
    const printerName = printerSettings.selectedPrinterName;
    const isIp = /^\d{1,3}(\.\d{1,3}){3}(:\d+)?$/.test(printerName);
    try {
      // IP-based printer → ESC/POS TCP (bypasses CUPS)
      if (isIp && window.electron?.printer?.printOrderEscpos) {
        const result = await window.electron.printer.printOrderEscpos(
          {
            orderNumber:    'TEST',
            restaurantName: 'CocoEats UK',
            orderType:      'TEST PRINT',
            customerName:   '',
            items: [{ name: 'If you can read this, printing works!', quantity: 1 }],
            totalAmount:    '0',
            createdAt:      new Date().toISOString(),
            paperWidth:     printerSettings.paperWidth as 58 | 80,
          },
          printerName,
        );
        if (result?.success) {
          toast.success(`Test sent to ${printerName} — check it printed correctly`);
        } else {
          console.error('ESC/POS test print failed:', result?.error);
          toast.error(`Test print failed: ${result?.error ?? 'Unknown error'}`);
        }
        return;
      }

      // Regular CUPS/Windows printer → HTML path
      if (printerList.length === 0) {
        toast.error('No printers found. Connect a printer and click Refresh first.');
        return;
      }
      const testHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
        *{margin:0;padding:0;box-sizing:border-box;}
        body{font-family:monospace;font-size:12px;width:${printerSettings.paperWidth}mm;padding:5mm;}
      </style></head><body>
        <div style="text-align:center;border-bottom:2px dashed #000;padding-bottom:8px;margin-bottom:8px;">
          <div style="font-size:18px;font-weight:bold;">CocoEats UK</div>
          <div style="font-size:11px;margin-top:2px;">TEST PRINT</div>
        </div>
        <div style="margin-bottom:6px;">Paper width: ${printerSettings.paperWidth}mm</div>
        <div style="margin-bottom:6px;">Printer: ${printerName}</div>
        <div style="margin-bottom:6px;">Time: ${new Date().toLocaleString('en-GB')}</div>
        <div style="text-align:center;margin-top:10px;border-top:2px dashed #000;padding-top:8px;font-size:10px;">
          If you can read this, printing works!
        </div>
      </body></html>`;
      const result = await window.electron.printer.printOrder(testHtml, printerName, printerSettings.paperWidth);
      if (result?.success) {
        toast.success(`Test sent to ${printerName} — check it printed correctly`);
      } else {
        console.error('Test print failed:', result?.error);
        toast.error(`Test print failed: ${result?.error ?? 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Test print error:', err);
      toast.error('Test print failed. Check the printer connection.');
    } finally {
      setTestPrinting(false);
    }
  };

  const handleTestReady = async () => {
    await audioNotificationService.testReadySound();
    if (settings.audioNotifications.voiceEnabled) {
      // Wait a bit before playing voice
      setTimeout(() => {
        audioNotificationService.testReadyVoice();
      }, 500);
    }
  };

  const handleTestOverdue = async () => {
    await audioNotificationService.testOverdueSound();
    if (settings.audioNotifications.voiceEnabled) {
      setTimeout(() => {
        audioNotificationService.testOverdueVoice();
      }, 500);
    }
  };

  const handleTestNewOrder = async () => {
  await audioNotificationService.testNewOrderSound();
  if (settings.audioNotifications.voiceEnabled) {
    setTimeout(() => {
      audioNotificationService.testNewOrderVoice();
    }, 500);
  }
};

  const handleReset = () => {
    if (confirm('Reset all settings to default values?')) {
      dispatch(resetSettings());
    }
  };

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-3xl font-bold text-slate-900 dark:text-kds-text-primary mb-6">Settings</h1>

      {/* This Screen / Station View */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold text-slate-800 mb-1 flex items-center gap-2">
          <Monitor className="w-5 h-5" />
          This Screen
        </h2>
        <p className="text-sm text-slate-500 mb-4">
          Set which station this screen belongs to. Chef screens will only show items assigned to their station.
          Set to <strong>All (Packing)</strong> for the main packing/manager screen.
        </p>

        {(() => {
          const stations: { id: StationView; label: string; sub: string; activeClass: string; dotClass: string }[] = [
            {
              id: 'all',
              label: 'All (Packing)',
              sub: 'Shows every item from all stations — for the packing counter or manager screen',
              activeClass: 'border-blue-500 bg-blue-50',
              dotClass: 'bg-blue-500',
            },
            {
              id: 'main_kitchen',
              label: 'Main Kitchen',
              sub: 'Shows only items assigned to Main Kitchen',
              activeClass: 'border-orange-500 bg-orange-50',
              dotClass: 'bg-orange-500',
            },
            {
              id: 'grill',
              label: 'Grill & Shawarma',
              sub: 'Shows only items assigned to Grill & Shawarma',
              activeClass: 'border-red-500 bg-red-50',
              dotClass: 'bg-red-500',
            },
          ];
          const current = settings.stationView ?? 'all';
          return (
            <div className="space-y-2">
              {stations.map(s => {
                const active = current === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => dispatch(setStationView(s.id))}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border-2 text-left transition-colors ${
                      active ? s.activeClass : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <span className={`w-3 h-3 rounded-full shrink-0 ${s.dotClass} ${active ? 'opacity-100' : 'opacity-30'}`} />
                    <div className="min-w-0">
                      <p className={`text-sm font-semibold ${active ? 'text-slate-800' : 'text-slate-600'}`}>{s.label}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{s.sub}</p>
                    </div>
                    {active && (
                      <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-white border border-current font-medium shrink-0" style={{ color: 'inherit' }}>
                        Active
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* KDS Host Connection (kitchen screens only) */}
      {isKdsClient && (
        <div className="bg-white dark:bg-kds-bg-secondary rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-slate-800 dark:text-kds-text-primary mb-1 flex items-center gap-2">
            <WifiOff className="w-5 h-5" />
            KDS Host Connection
          </h2>
          <p className="text-sm text-slate-500 dark:text-kds-text-muted mb-4">
            Enter the local IP address of the <strong>packing/manager screen</strong> (the computer set to <em>All</em>).
            This screen will receive station-filtered orders from it in real time.
            Leave blank to fetch orders independently (useful for testing on a single machine).
          </p>

          <div className="space-y-3">
            {/* Auto-detect button */}
            <button
              onClick={handleScan}
              disabled={scanning}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors"
            >
              {scanning ? (
                <>
                  <ScanSearch className="w-4 h-4 animate-pulse" />
                  Scanning network…
                </>
              ) : (
                <>
                  <ScanSearch className="w-4 h-4" />
                  Auto-detect KDS Host
                </>
              )}
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 border-t border-slate-200 dark:border-kds-border" />
              <span className="text-xs text-slate-400 dark:text-kds-text-muted">or enter manually</span>
              <div className="flex-1 border-t border-slate-200 dark:border-kds-border" />
            </div>

            {/* Manual IP input */}
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={kdsHostIpInput}
                onChange={(e) => setKdsHostIpInput(e.target.value)}
                placeholder="e.g. 192.168.1.10"
                className="flex-1 border border-slate-300 dark:border-kds-border rounded-lg px-3 py-2 text-sm font-mono bg-white dark:bg-kds-surface text-slate-800 dark:text-kds-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={() => {
                  const val = kdsHostIpInput.trim() || null;
                  dispatch(setKdsHostIp(val));
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Save
              </button>
              {settings.kdsHostIp && (
                <button
                  onClick={() => { setKdsHostIpInput(''); dispatch(setKdsHostIp(null)); }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-kds-surface dark:hover:bg-kds-border text-slate-600 dark:text-kds-text-secondary text-sm font-medium rounded-lg transition-colors"
                >
                  Clear
                </button>
              )}
            </div>

            {settings.kdsHostIp && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700">
                <Wifi className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0" />
                <p className="text-xs text-green-700 dark:text-green-300">
                  Connecting to <span className="font-mono font-semibold">{settings.kdsHostIp}:7654</span> — connection status shown in the dashboard header.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* KDS Server Section */}
      {isKdsServer && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-slate-800 mb-1 flex items-center gap-2">
            <Wifi className="w-5 h-5" />
            KDS Server
          </h2>
          <p className="text-sm text-slate-500 mb-4">
            This computer acts as the KDS mediator. Kitchen screens connect here via WebSocket to receive station-filtered order updates.
          </p>

          <div className="space-y-3">
            {/* Port */}
            <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-slate-50 border border-slate-200">
              <div>
                <p className="text-sm font-medium text-slate-700">Server Port</p>
                <p className="text-xs text-slate-400 mt-0.5">WebSocket port the server listens on</p>
              </div>
              <span className="font-mono text-sm font-semibold text-slate-800 bg-white border border-slate-300 px-3 py-1 rounded-lg">7654</span>
            </div>

            {/* Connected clients */}
            <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-slate-50 border border-slate-200">
              <div>
                <p className="text-sm font-medium text-slate-700">Connected Kitchen Screens</p>
                <p className="text-xs text-slate-400 mt-0.5">Live count of connected thin-client screens</p>
              </div>
              <span className={`text-lg font-bold font-mono px-3 py-1 rounded-lg border ${
                kdsClientCount > 0
                  ? 'bg-green-50 border-green-300 text-green-700'
                  : 'bg-slate-100 border-slate-300 text-slate-400'
              }`}>
                {kdsClientCount}
              </span>
            </div>

            {/* This machine's local IPs */}
            {localIps.length > 0 && (
              <div className="px-4 py-3 rounded-lg bg-slate-50 border border-slate-200">
                <p className="text-xs font-medium text-slate-600 mb-2">This computer's IP address{localIps.length > 1 ? 'es' : ''}</p>
                <div className="flex flex-wrap gap-2">
                  {localIps.map(ip => (
                    <span key={ip} className="font-mono text-sm font-semibold bg-white border border-slate-300 px-3 py-1 rounded-lg text-slate-800 select-all">
                      {ip}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-slate-400 mt-2">Enter one of these on each kitchen screen under <em>KDS Host Connection</em>.</p>
              </div>
            )}

            {/* Connection hint */}
            <div className="px-4 py-3 rounded-lg bg-blue-50 border border-blue-200">
              <p className="text-xs font-medium text-blue-700 mb-1">How to connect a kitchen screen</p>
              <p className="text-xs text-blue-600 leading-relaxed">
                On each kitchen screen, open CocoFlow, go to Settings, set the station (Main Kitchen / Grill),
                then tap <strong>Auto-detect KDS Host</strong> — or enter this computer's IP manually.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Audio Notifications Section */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Volume2 className="w-5 h-5" />
          Audio Notifications
        </h2>

        {/* Master Audio Toggle */}
        <div className="flex items-center justify-between py-3 border-b">
          <div>
            <p className="font-medium text-slate-800">Enable Audio Notifications</p>
            <p className="text-sm text-slate-500">Play sounds when orders are ready or overdue</p>
          </div>
          <button
            onClick={() => dispatch(toggleAudioNotifications())}
            className={`relative w-14 h-7 rounded-full transition-colors ${
              settings.audioNotifications.enabled ? 'bg-green-500' : 'bg-slate-300'
            }`}
          >
            <span
              className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform ${
                settings.audioNotifications.enabled ? 'translate-x-7' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Voice Toggle */}
        <div className="flex items-center justify-between py-3 border-b">
          <div className="flex items-center gap-3">
            {settings.audioNotifications.voiceEnabled ? (
              <Mic className="w-5 h-5 text-blue-600" />
            ) : (
              <MicOff className="w-5 h-5 text-slate-400" />
            )}
            <div>
              <p className="font-medium text-slate-800">Voice Announcements</p>
              <p className="text-sm text-slate-500">
                Play voice messages after sound effects
              </p>
            </div>
          </div>
          <button
            onClick={() => dispatch(toggleVoiceNotifications())}
            disabled={!settings.audioNotifications.enabled}
            className={`relative w-14 h-7 rounded-full transition-colors ${
              !settings.audioNotifications.enabled
                ? 'bg-slate-200 cursor-not-allowed'
                : settings.audioNotifications.voiceEnabled
                ? 'bg-blue-500'
                : 'bg-slate-300'
            }`}
          >
            <span
              className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform ${
                settings.audioNotifications.voiceEnabled ? 'translate-x-7' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Sound Effects Volume */}
        <div className="py-4 border-b">
          <div className="flex items-center justify-between mb-2">
            <label className="font-medium text-slate-800">Sound Effects Volume</label>
            <span className="text-sm text-slate-600 font-mono">
              {settings.audioNotifications.soundEffectsVolume}%
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={settings.audioNotifications.soundEffectsVolume}
            onChange={(e) => dispatch(setSoundEffectsVolume(Number(e.target.value)))}
            disabled={!settings.audioNotifications.enabled}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
          />
          <div className="flex justify-between text-xs text-slate-500 mt-1">
            <span>Silent</span>
            <span>Loud</span>
          </div>
        </div>

        {/* Voice Volume */}
        <div className="py-4 border-b">
          <div className="flex items-center justify-between mb-2">
            <label className="font-medium text-slate-800">Voice Volume</label>
            <span className="text-sm text-slate-600 font-mono">
              {settings.audioNotifications.voiceVolume}%
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={settings.audioNotifications.voiceVolume}
            onChange={(e) => dispatch(setVoiceVolume(Number(e.target.value)))}
            disabled={!settings.audioNotifications.enabled || !settings.audioNotifications.voiceEnabled}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
          />
          <div className="flex justify-between text-xs text-slate-500 mt-1">
            <span>Silent</span>
            <span>Loud</span>
          </div>
        </div>

        {/* Test Buttons */}
<div className="pt-4">
  <p className="text-sm text-slate-600 mb-3">Test Audio Notifications:</p>
  <div className="flex flex-wrap gap-3">
    <button
      onClick={handleTestNewOrder}  // ✅ NEW
      disabled={!settings.audioNotifications.enabled}
      className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed"
    >
      <Play className="w-4 h-4" />
      Test "New Order" Sound
    </button>
    <button
      onClick={handleTestReady}
      disabled={!settings.audioNotifications.enabled}
      className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed"
    >
      <Play className="w-4 h-4" />
      Test "Ready" Sound
    </button>
    <button
      onClick={handleTestOverdue}
      disabled={!settings.audioNotifications.enabled}
      className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed"
    >
      <Play className="w-4 h-4" />
      Test "Overdue" Alarm
    </button>
  </div>
</div>
      </div>

      {/* TMBILL Notifications Section — only shown when TMBILL is enabled */}
      {window.tmbill && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-slate-800 mb-1 flex items-center gap-2">
            <Volume2 className="w-5 h-5" />
            TMBILL Order Notifications
          </h2>
          <p className="text-sm text-slate-500 mb-4">Audio alert when a new TMBILL POS order arrives</p>

          {/* Enable toggle */}
          <div className="flex items-center justify-between py-3 border-b">
            <div>
              <p className="font-medium text-slate-800">Enable TMBILL Notifications</p>
              <p className="text-sm text-slate-500">Play a sound when a new TMBILL order comes in</p>
            </div>
            <button
              onClick={() => dispatch(toggleTmbillNotifications())}
              className={`relative w-14 h-7 rounded-full transition-colors ${
                settings.tmbillNotifications?.enabled ? 'bg-green-500' : 'bg-slate-300'
              }`}
            >
              <span
                className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform ${
                  settings.tmbillNotifications?.enabled ? 'translate-x-7' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Volume */}
          <div className="py-4 border-b">
            <div className="flex items-center justify-between mb-2">
              <label className="font-medium text-slate-800">Volume</label>
              <span className="text-sm text-slate-600 font-mono">
                {settings.tmbillNotifications?.volume ?? 80}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={settings.tmbillNotifications?.volume ?? 80}
              onChange={(e) => dispatch(setTmbillNotificationVolume(Number(e.target.value)))}
              disabled={!settings.tmbillNotifications?.enabled}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
            />
            <div className="flex justify-between text-xs text-slate-500 mt-1">
              <span>Silent</span>
              <span>Loud</span>
            </div>
          </div>

          {/* Custom sound file picker */}
          <div className="py-4 border-b">
            <p className="font-medium text-slate-800 mb-1">Notification Sound</p>
            <p className="text-sm text-slate-500 mb-3">
              {settings.tmbillNotifications?.customSoundPath
                ? `Custom: ${settings.tmbillNotifications.customSoundPath.split(/[\\/]/).pop()}`
                : 'Default (same as CocoEats new order sound)'}
            </p>
            <div className="flex gap-3">
              <button
                onClick={async () => {
                  const path = await window.electron.pickAudioFile();
                  if (path) {
                    dispatch(setTmbillCustomSoundPath(path));
                    audioNotificationService.reloadTmbillSound(path);
                    toast.success('Custom sound saved');
                  }
                }}
                disabled={!settings.tmbillNotifications?.enabled}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Choose File
              </button>
              {settings.tmbillNotifications?.customSoundPath && (
                <button
                  onClick={() => {
                    dispatch(setTmbillCustomSoundPath(null));
                    audioNotificationService.reloadTmbillSound(null);
                    toast.success('Reset to default sound');
                  }}
                  className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-sm transition-colors"
                >
                  Reset to Default
                </button>
              )}
            </div>
          </div>

          {/* Scheduled order alert threshold */}
          <div className="py-4 border-b">
            <div className="flex items-center justify-between mb-1">
              <label className="font-medium text-slate-800">Scheduled Order Alert</label>
              <span className="text-sm text-slate-600 font-mono">
                {settings.tmbillNotifications?.scheduledAlertMinutes ?? 30} min before
              </span>
            </div>
            <p className="text-sm text-slate-500 mb-3">
              Play the ready chime this many minutes before a scheduled TMBILL order's time.
            </p>
            <input
              type="range"
              min="5"
              max="60"
              step="5"
              value={settings.tmbillNotifications?.scheduledAlertMinutes ?? 30}
              onChange={(e) => dispatch(setTmbillScheduledAlertMinutes(Number(e.target.value)))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-slate-500 mt-1">
              <span>5 min</span>
              <span>60 min</span>
            </div>
          </div>

          {/* Test button */}
          <div className="pt-4">
            <button
              onClick={() => audioNotificationService.testTmbillSound()}
              disabled={!settings.tmbillNotifications?.enabled}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed"
            >
              <Play className="w-4 h-4" />
              Test TMBILL Sound
            </button>
          </div>
        </div>
      )}

      {/* Interaction Settings */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold text-slate-800 mb-4">Interaction</h2>
        <div className="flex items-center justify-between py-3 border-b">
          <div>
            <p className="font-medium text-slate-800">Order Processing Mode</p>
          <p className="text-sm text-slate-500">Choose how orders are processed: action buttons or header double-tap.</p>
          </div>
          <div className="flex gap-3">
    <button
      onClick={() => dispatch(setProcessingMode('buttons'))}
      className={`flex-1 px-4 py-2 rounded-lg border transition-colors ${
        settings.interaction.processingMode === 'buttons'
          ? 'bg-blue-600 text-white border-blue-600'
          : 'bg-white border-slate-300 text-slate-600 hover:border-blue-400'
      }`}
    >
      Buttons Mode
    </button>

    <button
      onClick={() => dispatch(setProcessingMode('header'))}
      className={`flex-1 px-4 py-2 rounded-lg border transition-colors ${
        settings.interaction.processingMode === 'header'
          ? 'bg-blue-600 text-white border-blue-600'
          : 'bg-white border-slate-300 text-slate-600 hover:border-blue-400'
      }`}
    >
      Header Mode
    </button>
    
  </div>
  
        </div>

        {/* Require double-tap (disabled when Header mode is active) */}
        <div
          className={`flex items-center justify-between py-3 border-b ${
            settings.interaction.processingMode === 'header' ? 'opacity-50 pointer-events-none' : ''
          }`}
          aria-disabled={settings.interaction.processingMode === 'header'}
        >
          <div>
            <p className="font-medium text-slate-800">Require double-tap to confirm actions</p>
            <p className="text-sm text-slate-500">
              When enabled, action buttons require a double-click / double-tap
              {settings.interaction.processingMode === 'header' && (
                <span className="ml-2 text-xs italic text-slate-400">(disabled in Header mode)</span>
              )}
            </p>
          </div>
          <button
            onClick={() => {
              if (settings.interaction.processingMode === 'header') return;
              dispatch(setRequireDoubleTap());
            }}
            disabled={settings.interaction.processingMode === 'header'}
            className={`relative w-14 h-7 rounded-full transition-colors ${
              settings.interaction.requireDoubleTap ? 'bg-green-500' : 'bg-slate-300'
            } ${settings.interaction.processingMode === 'header' ? 'cursor-not-allowed' : ''}`}
            aria-pressed={settings.interaction.requireDoubleTap}
          >
            <span
              className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform ${
                settings.interaction.requireDoubleTap ? 'translate-x-7' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>


      {/* Display Settings Section */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Type className="w-5 h-5" />
          Display Settings
        </h2>

        {/* Item Name Font Size */}
        <div className="py-4 border-b">
          <div className="mb-3">
            <p className="font-medium text-slate-800">Item Name Font Size</p>
            <p className="text-sm text-slate-500">
              Larger sizes wrap to 2 lines so full names stay readable
            </p>
          </div>
          <div className="flex gap-2">
            {(['sm', 'base', 'lg', 'xl'] as const).map((size) => {
              const labels = { sm: 'S', base: 'M', lg: 'L', xl: 'XL' };
              const preview = { sm: 'text-sm', base: 'text-base', lg: 'text-lg', xl: 'text-xl' };
              const isActive = settings.display.itemNameFontSize === size;
              return (
                <button
                  key={size}
                  onClick={() => dispatch(setItemNameFontSize(size))}
                  className={`flex-1 py-2 rounded-lg border font-semibold transition-colors ${preview[size]} ${
                    isActive
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white border-slate-300 text-slate-600 hover:border-blue-400'
                  }`}
                >
                  {labels[size]}
                </button>
              );
            })}
          </div>
          {/* Live preview */}
          <div className="mt-3 px-3 py-2 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-xs text-slate-400 block mb-1">Preview:</span>
            <span className={`font-medium text-slate-800 ${
              { sm: 'text-sm', base: 'text-base', lg: 'text-lg', xl: 'text-xl' }[settings.display.itemNameFontSize]
            } ${settings.display.itemNameUppercase ? 'uppercase' : ''}`}>
              2x Grilled Chicken Burger
            </span>
          </div>
        </div>

        {/* Item Name Capitalisation */}
        <div className="flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <CaseSensitive className="w-5 h-5 text-slate-500" />
            <div>
              <p className="font-medium text-slate-800">Uppercase Item Names</p>
              <p className="text-sm text-slate-500">Display all item names in UPPERCASE</p>
            </div>
          </div>
          <button
            onClick={() => dispatch(toggleItemNameUppercase())}
            className={`relative w-14 h-7 rounded-full transition-colors ${
              settings.display.itemNameUppercase ? 'bg-green-500' : 'bg-slate-300'
            }`}
          >
            <span
              className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform ${
                settings.display.itemNameUppercase ? 'translate-x-7' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Printer Settings Section */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Printer className="w-5 h-5" />
          Printer Settings
        </h2>

        {!isElectron && (
          <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Printer settings are only available in the desktop app.
          </p>
        )}

        {isElectron && (
          <>
            {/* Printer List */}
            <div className="py-4 border-b">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-medium text-slate-800">Select Printer</p>
                  <p className="text-sm text-slate-500">Choose which printer to use for receipts</p>
                </div>
                <button
                  onClick={loadPrinters}
                  disabled={loadingPrinters}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-700 dark:text-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 dark:hover:text-slate-200 disabled:opacity-50 transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingPrinters ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>

              {(loadingPrinters || resolvingIps) && (
                <div className="text-sm text-slate-400 py-2">
                  {loadingPrinters ? 'Scanning for printers…' : 'Resolving network IPs…'}
                </div>
              )}

              {!loadingPrinters && printerList.length === 0 && (
                <div className="text-sm text-slate-400 py-2">
                  No printers found. Make sure your printer is connected and try refreshing.
                </div>
              )}

              {!loadingPrinters && printerList.length > 0 && (
                <div className="space-y-2">
                  {printerList.map((printer: any) => {
                    const isSelected = printerSettings?.selectedPrinterName === printer.name;
                    const dot = printerStatusDot(printer.status ?? 0);
                    return (
                      <button
                        key={printer.name}
                        onClick={() => dispatch(setSelectedPrinterName(isSelected ? null : printer.name))}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border-2 text-left transition-colors ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        {/* Status dot */}
                        <div className="flex-shrink-0 flex items-center gap-1.5">
                          <span className={`w-2.5 h-2.5 rounded-full ${dot.color}`} />
                          <span className="text-xs text-slate-400 w-12">{dot.label}</span>
                        </div>
                        {/* Name */}
                        <span className={`flex-1 text-sm font-medium ${isSelected ? 'text-blue-700' : 'text-slate-700'}`}>
                          {printer.name}
                        </span>
                        {/* Badges */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {printerIps[printer.name] && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-mono">
                              {printerIps[printer.name]}
                            </span>
                          )}
                          {printer.isDefault && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">Default</span>
                          )}
                          {isSelected && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-600 font-medium">Selected</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Direct IP entry (Linux ESC/POS TCP printing) */}
              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Direct IP Printer</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mb-2">
                  For thermal printers connected over the network (ESC/POS via TCP). Enter the printer's IP address, e.g. <span className="font-mono">192.168.1.167</span> or <span className="font-mono">192.168.1.167:9100</span>
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={ipInput}
                    onChange={e => setIpInput(e.target.value)}
                    placeholder="e.g. 192.168.1.167"
                    className="flex-1 px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  />
                  <button
                    onClick={() => {
                      const val = ipInput.trim();
                      if (!val) return;
                      dispatch(setSelectedPrinterName(val));
                      setIpInput('');
                      toast.success(`Printer set to ${val}`);
                    }}
                    disabled={!ipInput.trim()}
                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors"
                  >
                    Use
                  </button>
                </div>
                {printerSettings?.selectedPrinterName && /^\d{1,3}(\.\d{1,3}){3}(:\d+)?$/.test(printerSettings.selectedPrinterName) && (
                  <p className="mt-2 text-xs text-blue-600 font-mono">
                    ✓ Active: {printerSettings.selectedPrinterName}
                  </p>
                )}
              </div>
            </div>

            {/* Paper Width */}
            <div className="py-4 border-b">
              <p className="font-medium text-slate-800 mb-1">Paper Width</p>
              <p className="text-sm text-slate-500 mb-3">Match your thermal printer's paper roll width</p>
              <div className="flex gap-2 w-48">
                {([58, 80] as const).map((w) => (
                  <button
                    key={w}
                    onClick={() => dispatch(setPaperWidth(w))}
                    className={`flex-1 py-2 rounded-lg border font-semibold text-sm transition-colors ${
                      printerSettings?.paperWidth === w
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white border-slate-300 text-slate-600 hover:border-blue-400'
                    }`}
                  >
                    {w}mm
                  </button>
                ))}
              </div>
            </div>

            {/* Auto-Print */}
            <div className="flex items-center justify-between py-4 border-b">
              <div className="flex items-center gap-3">
                <Zap className="w-5 h-5 text-slate-500" />
                <div>
                  <p className="font-medium text-slate-800">Auto-Print New Orders</p>
                  <p className="text-sm text-slate-500">Automatically print receipt when a new CocoEats order arrives</p>
                </div>
              </div>
              <button
                onClick={() => dispatch(toggleAutoPrint())}
                className={`relative w-14 h-7 rounded-full transition-colors ${
                  printerSettings?.autoPrint ? 'bg-green-500' : 'bg-slate-300'
                }`}
              >
                <span className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform ${
                  printerSettings?.autoPrint ? 'translate-x-7' : 'translate-x-0'
                }`} />
              </button>
            </div>

            {/* Test Print */}
            <div className="pt-4">
              <p className="text-sm text-slate-600 mb-3">
                Send a test receipt to verify your printer is working correctly.
              </p>
              <button
                onClick={handleTestPrint}
                disabled={testPrinting}
                className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-800 disabled:opacity-50 text-white rounded-lg transition-colors text-sm"
              >
                <Printer className="w-4 h-4" />
                {testPrinting ? 'Sending test print…' : 'Print Test Receipt'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Developer Settings Section */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold text-slate-800 mb-1 flex items-center gap-2">
          <Bug className="w-5 h-5" />
          Developer
        </h2>
        <p className="text-sm text-slate-500 mb-4">
          Debug tools for troubleshooting in production. Enabling this shows KDS and TMBILL debug panels in Utilities.
          Disable in normal operation — logging adds no overhead when off.
        </p>
        <div className="flex items-center justify-between py-3 border-b">
          <div>
            <p className="font-medium text-slate-800">Debug Mode</p>
            <p className="text-sm text-slate-500">Enables KDS log capture and shows debug panels under Utilities</p>
          </div>
          <button
            onClick={() => dispatch(setDebugMode(!(settings.debugMode ?? false)))}
            className={`relative w-14 h-7 rounded-full transition-colors ${
              settings.debugMode ? 'bg-amber-500' : 'bg-slate-300'
            }`}
          >
            <span className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform ${
              settings.debugMode ? 'translate-x-7' : 'translate-x-0'
            }`} />
          </button>
        </div>
        {settings.debugMode && (
          <p className="mt-3 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Debug mode is on — KDS log capture is active. Go to Utilities to view debug panels. Disable when not needed.
          </p>
        )}
      </div>

      {/* App Updates */}
      {isElectronApp && (
        <div className="bg-white dark:bg-kds-surface rounded-xl p-5 border border-slate-200 dark:border-kds-border">
          <h3 className="font-semibold text-slate-800 dark:text-kds-text-primary mb-4">App Updates</h3>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Current version</p>
              <p className="font-mono text-slate-800 dark:text-kds-text-primary font-medium">v{appVersion || import.meta.env.VITE_APP_VERSION}</p>
            </div>
            <button
              onClick={() => { setUpdateStatus('checking'); window.electron.autoUpdater.checkForUpdates(); }}
              disabled={updateStatus === 'checking' || updateStatus === 'downloading'}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-4 h-4 ${updateStatus === 'checking' ? 'animate-spin' : ''}`} />
              {updateStatus === 'checking' ? 'Checking...' : 'Check for Updates'}
            </button>
          </div>

          {updateStatus === 'up-to-date' && (
            <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded-lg px-3 py-2">
              <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
              You're on the latest version
            </div>
          )}

          {updateStatus === 'available' && updateInfo && (
            <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-blue-800 dark:text-blue-300">Update Available — v{updateInfo.version}</p>
                  {updateInfo.releaseDate && (
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
                      Released {new Date(updateInfo.releaseDate).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => { setUpdateStatus('downloading'); window.electron.autoUpdater.downloadUpdate(); }}
                  className="shrink-0 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Download
                </button>
              </div>
            </div>
          )}

          {updateStatus === 'downloading' && (
            <div className="rounded-lg border border-slate-200 dark:border-kds-border bg-slate-50 dark:bg-slate-800/50 p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Downloading update...</p>
                <span className="text-sm font-mono text-slate-600 dark:text-slate-400">{downloadPercent}%</span>
              </div>
              <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-all duration-300" style={{ width: `${downloadPercent}%` }} />
              </div>
            </div>
          )}

          {updateStatus === 'ready' && updateInfo && (
            <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-semibold text-green-800 dark:text-green-300">v{updateInfo.version} ready to install</p>
                  <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">The app will restart to apply the update</p>
                </div>
                <button
                  onClick={() => window.electron.autoUpdater.installUpdate()}
                  className="shrink-0 px-4 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Install & Restart
                </button>
              </div>
            </div>
          )}

          {updateStatus === 'error' && (
            <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
              <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
              Update check failed: {updateError || 'Unknown error'}
            </div>
          )}
        </div>
      )}

      {/* Reset Button */}
      <div className="flex justify-end">
        <button
          onClick={handleReset}
          className="flex items-center gap-2 px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          Reset to Defaults
        </button>
      </div>
    </div>
  );
}