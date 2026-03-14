// src/components/IncomingCallBar.tsx
// Global incoming-call overlay — rendered at the app root so it appears on every page.
// Only mounted when tailcom is enabled (tailcomEnabled flag from preload).

import { useEffect, useState, useCallback } from 'react';
import { Phone, PhoneOff } from 'lucide-react';

type CallState = 'idle' | 'incoming' | 'active';

export default function IncomingCallBar() {
  const [callState, setCallState] = useState<CallState>('idle');

  const handleIncoming  = useCallback(() => setCallState('incoming'), []);
  const handleStarted   = useCallback(() => setCallState('active'),   []);
  const handleEnded     = useCallback(() => setCallState('idle'),     []);

  useEffect(() => {
    const api = window.electron?.intercom;
    if (!api) return;
    api.onIncomingCall(handleIncoming);
    api.onCallStarted(handleStarted);
    api.onCallEnded(handleEnded);
    return () => {
      api.offIncomingCall(handleIncoming);
      api.offCallStarted(handleStarted);
      api.offCallEnded(handleEnded);
    };
  }, [handleIncoming, handleStarted, handleEnded]);

  const accept = async () => {
    await window.electron.intercom.acceptCall();
  };

  const reject = async () => {
    await window.electron.intercom.rejectCall();
    setCallState('idle');
  };

  if (callState === 'idle') return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] pointer-events-none">
      <div
        className="pointer-events-auto flex items-center gap-4 px-6 py-4 rounded-2xl shadow-2xl
          bg-white dark:bg-[#112233] border border-slate-200 dark:border-[#1e3a4a]
          animate-slide-up"
      >
        {/* Pulsing phone icon */}
        <div className="relative flex-shrink-0">
          <div className="w-12 h-12 rounded-full bg-teal-500/10 flex items-center justify-center">
            <Phone className="w-6 h-6 text-teal-500" />
          </div>
          {callState === 'incoming' && (
            <span className="absolute inset-0 rounded-full bg-teal-500/30 animate-ping" />
          )}
        </div>

        {/* Label */}
        <div className="min-w-0">
          <p className="font-semibold text-slate-800 dark:text-white text-sm">
            {callState === 'incoming' ? 'Incoming call' : 'Call in progress'}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {callState === 'incoming' ? 'From the front desk' : 'Connected'}
          </p>
        </div>

        {/* Buttons — only shown while ringing */}
        {callState === 'incoming' && (
          <div className="flex items-center gap-3 ml-2">
            <button
              onClick={reject}
              className="w-11 h-11 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-lg transition-colors"
              aria-label="Reject call"
            >
              <PhoneOff className="w-5 h-5 text-white" />
            </button>
            <button
              onClick={accept}
              className="w-11 h-11 rounded-full bg-teal-500 hover:bg-teal-600 flex items-center justify-center shadow-lg transition-colors"
              aria-label="Accept call"
            >
              <Phone className="w-5 h-5 text-white" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
