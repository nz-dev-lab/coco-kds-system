// components/WindowControls.tsx
import { useState, useEffect } from 'react';
import { Minus, Square, X, Maximize2 } from 'lucide-react';

export default function WindowControls() {
  const [isMaximized, setIsMaximized] = useState(false);
  const isElectron = typeof window !== 'undefined' && window.electron;

  // Debug: Log to see if Electron API is detected
  useEffect(() => {
    console.log('WindowControls mounted');
    console.log('Is Electron?', isElectron);
    console.log('window.electronAPI:', window.electron);
  }, []);

  useEffect(() => {
    if (isElectron) {
      // Check initial maximized state
      window.electron.isMaximized().then((maximized) => {
        console.log('Initial maximized state:', maximized);
        setIsMaximized(maximized);
      });
    }
  }, [isElectron]);

  const handleMinimize = () => {
    console.log('Minimize clicked');
    if (isElectron) {
      window.electron.minimizeWindow();
    }
  };

  const handleMaximize = () => {
    console.log('Maximize clicked');
    if (isElectron) {
      window.electron.maximizeWindow();
      setIsMaximized(!isMaximized);
    }
  };

  const handleClose = () => {
    console.log('Close clicked');
    if (isElectron) {
      window.electron.closeWindow();
    }
  };

  // Always render the controls (even in browser for testing)
  return (
    <div className="flex items-center h-full">
      {/* Minimize Button */}
      <button
        onClick={handleMinimize}
        className="h-full px-4 hover:bg-kds-surface transition-colors group"
        aria-label="Minimize"
        title="Minimize"
      >
        <Minus className="w-4 h-4 text-kds-text-muted group-hover:text-kds-text-primary transition-colors" />
      </button>

      {/* Maximize/Restore Button */}
      <button
        onClick={handleMaximize}
        className="h-full px-4 hover:bg-kds-surface transition-colors group"
        aria-label={isMaximized ? 'Restore' : 'Maximize'}
        title={isMaximized ? 'Restore' : 'Maximize'}
      >
        {isMaximized ? (
          <Square className="w-3.5 h-3.5 text-kds-text-muted group-hover:text-kds-text-primary transition-colors" />
        ) : (
          <Maximize2 className="w-3.5 h-3.5 text-kds-text-muted group-hover:text-kds-text-primary transition-colors" />
        )}
      </button>

      {/* Close Button */}
      <button
        onClick={handleClose}
        className="h-full px-4 hover:bg-red-600 transition-colors group"
        aria-label="Close"
        title="Close"
      >
        <X className="w-4 h-4 text-kds-text-muted group-hover:text-white transition-colors" />
      </button>
    </div>
  );
}