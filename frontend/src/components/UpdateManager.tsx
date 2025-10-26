import { useEffect } from 'react';
import toast from 'react-hot-toast';

export default function UpdateManager() {
  useEffect(() => {
    if (!window.electron?.autoUpdater) {
      console.log('⚠️ Auto-updater not available (web mode)');
      return;
    }

    // 1. New update available
    window.electron.autoUpdater.onUpdateAvailable((info) => {
      console.log('📦 Update available:', info.version);
      
      toast(
        (t) => (
          <div className="flex flex-col gap-2">
            <div className="font-semibold">🎉 Update Available!</div>
            <div className="text-sm text-slate-600">
              Version {info.version} is ready to download
            </div>
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => {
                  toast.dismiss(t.id);
                  window.electron.autoUpdater.downloadUpdate();
                  toast.loading('Downloading update...', { id: 'downloading' });
                }}
                className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
              >
                Download Now
              </button>
              <button
                onClick={() => toast.dismiss(t.id)}
                className="px-3 py-1 bg-slate-200 text-slate-700 rounded text-sm hover:bg-slate-300"
              >
                Later
              </button>
            </div>
          </div>
        ),
        {
          duration: 30000, // 30 seconds
          position: 'top-right',
        }
      );
    });

    // 2. Download progress
    window.electron.autoUpdater.onUpdateProgress((progress) => {
      console.log(`📥 Download progress: ${Math.round(progress.percent)}%`);
      
      toast.loading(
        `Downloading update... ${Math.round(progress.percent)}%`,
        { id: 'downloading' }
      );
    });

    // 3. Update downloaded
    window.electron.autoUpdater.onUpdateDownloaded((info) => {
      console.log('✅ Update downloaded:', info.version);
      
      toast.dismiss('downloading');
      
      toast(
        (t) => (
          <div className="flex flex-col gap-2">
            <div className="font-semibold">✅ Update Ready!</div>
            <div className="text-sm text-slate-600">
              Version {info.version} is ready to install
            </div>
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => {
                  toast.dismiss(t.id);
                  window.electron.autoUpdater.installUpdate();
                }}
                className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
              >
                Install & Restart
              </button>
              <button
                onClick={() => toast.dismiss(t.id)}
                className="px-3 py-1 bg-slate-200 text-slate-700 rounded text-sm hover:bg-slate-300"
              >
                Install on Exit
              </button>
            </div>
          </div>
        ),
        {
          duration: Infinity, // Stay until user acts
          position: 'top-right',
        }
      );
    });

  }, []);

  return null; // No UI - just manages updates
}