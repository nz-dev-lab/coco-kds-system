import { useEffect } from 'react';
import { toast } from 'react-toastify';

export default function UpdateManager() {
  useEffect(() => {
    console.log('🔔 UpdateManager mounted');
    
    if (!window.electron?.autoUpdater) {
      console.log('⚠️ Auto-updater not available (web mode)');
      return;
    }
    
    console.log('✅ Auto-updater API is available');

    // 1. New update available
    window.electron.autoUpdater.onUpdateAvailable((info) => {
      console.log('📦 Update available:', info.version);
      
      toast.info(
        <div className="flex flex-col gap-2">
          <div className="font-semibold">🎉 Update Available!</div>
          <div className="text-sm text-slate-600">
            Version {info.version} is ready to download
          </div>
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => {
                toast.dismiss();
                window.electron.autoUpdater.downloadUpdate();
                toast.loading('Downloading update...', {
                  toastId: 'downloading',
                  autoClose: false,
                });
              }}
              className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors"
            >
              Download Now
            </button>
            <button
              onClick={() => toast.dismiss()}
              className="px-3 py-1 bg-slate-200 text-slate-700 rounded text-sm hover:bg-slate-300 transition-colors"
            >
              Later
            </button>
          </div>
        </div>,
        {
          position: 'top-right',
          autoClose: 30000, // 30 seconds
          hideProgressBar: false,
          closeOnClick: false,
          pauseOnHover: true,
          draggable: false,
          closeButton: true,
        }
      );
    });

    // 2. Download progress
    window.electron.autoUpdater.onUpdateProgress((progress) => {
      const percent = Math.round(progress.percent);
      console.log(`📥 Download progress: ${percent}%`);
      
      toast.update('downloading', {
        render: `Downloading update... ${percent}%`,
        type: 'info',
        isLoading: true,
      });
    });

    // 3. Update downloaded
    window.electron.autoUpdater.onUpdateDownloaded((info) => {
      console.log('✅ Update downloaded:', info.version);
      
      // Dismiss the downloading toast
      toast.dismiss('downloading');
      
      toast.success(
        <div className="flex flex-col gap-2">
          <div className="font-semibold">✅ Update Ready!</div>
          <div className="text-sm text-slate-600">
            Version {info.version} is ready to install
          </div>
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => {
                toast.dismiss();
                window.electron.autoUpdater.installUpdate();
              }}
              className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 transition-colors"
            >
              Install & Restart
            </button>
            <button
              onClick={() => toast.dismiss()}
              className="px-3 py-1 bg-slate-200 text-slate-700 rounded text-sm hover:bg-slate-300 transition-colors"
            >
              Install on Exit
            </button>
          </div>
        </div>,
        {
          position: 'top-right',
          autoClose: false, // Stay until user acts
          hideProgressBar: true,
          closeOnClick: false,
          pauseOnHover: true,
          draggable: false,
          closeButton: true,
        }
      );
    });

    // No cleanup needed - these listeners persist for app lifetime
  }, []);

  return null; // No UI - just manages updates
}