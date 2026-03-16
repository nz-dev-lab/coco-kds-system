// src/components/IncomingCallBar.tsx
// Global incoming-call overlay — rendered at the app root so it appears on every page.
// Only mounted when tailcom is enabled (tailcomEnabled flag from preload).

import { useEffect, useState, useCallback, useRef } from 'react';
import { Phone, PhoneOff } from 'lucide-react';
import { toast } from 'react-toastify';

type CallState = 'idle' | 'incoming' | 'active';

let ringtone: HTMLAudioElement | null = null;
try {
  ringtone = new Audio('./sounds/yo-phone-linging-67788.mp3');
  ringtone.loop = true;
  ringtone.volume = 1;
  ringtone.onerror = () => {
    console.error('[IncomingCallBar] Failed to load ringtone');
    ringtone = null;
  };
} catch {
  ringtone = null;
}

export default function IncomingCallBar() {
  const [callState, setCallState] = useState<CallState>('idle');
  const ringingRef = useRef(false);

  const startRing = useCallback(() => {
    if (ringingRef.current) return;
    ringingRef.current = true;
    if (!ringtone) {
      toast.warn('Ringtone unavailable — sound file could not be loaded');
      return;
    }
    ringtone.currentTime = 0;
    ringtone.play().catch((err) => {
      console.error('[IncomingCallBar] ringtone.play() failed:', err);
      toast.warn('Ringtone could not play — incoming call (no audio)');
    });
  }, []);

  const stopRing = useCallback(() => {
    if (!ringingRef.current) return;
    ringingRef.current = false;
    if (!ringtone) return;
    ringtone.pause();
    ringtone.currentTime = 0;
  }, []);

  const handleIncoming  = useCallback(() => { setCallState('incoming'); startRing(); },  [startRing]);
  const handleStarted   = useCallback(() => { setCallState('active');   stopRing(); },   [stopRing]);
  const handleEnded     = useCallback(() => { setCallState('idle');     stopRing(); },   [stopRing]);

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
    stopRing();
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
