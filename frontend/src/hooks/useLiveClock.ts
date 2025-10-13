// src/hooks/useLiveClock.ts
import { useState, useEffect } from 'react';

/**
 * Hook that returns current time and updates every second
 * Use this for live clocks and real-time displays
 */
export function useLiveClock(): Date {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    // Update immediately on mount
    setCurrentTime(new Date());

    // Update every second
    const intervalId = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    // Cleanup
    return () => clearInterval(intervalId);
  }, []);

  return currentTime;
}