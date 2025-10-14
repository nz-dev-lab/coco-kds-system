// src/hooks/useCurrentTime.ts
import { useState, useEffect } from 'react';

// Global timer - updates once per minute for ALL components
let globalTime = new Date();
let listeners: Set<(time: Date) => void> = new Set();
let intervalId: NodeJS.Timeout | null = null;

// Start global timer on first use
function startGlobalTimer() {
  if (intervalId) return; // Already running

  intervalId = setInterval(() => {
    globalTime = new Date();
    console.log('🕐 Global time updated:', globalTime.toLocaleTimeString());
    
    // Notify all listeners
    listeners.forEach(listener => listener(globalTime));
  }, 60000); // 1 minute

  console.log('✅ Global time updater started');
}

// Stop global timer when no components using it
function stopGlobalTimer() {
  if (intervalId && listeners.size === 0) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('⏹️ Global time updater stopped');
  }
}

/**
 * Hook to get current time that updates every minute.
 * Uses a single global timer shared across all components for efficiency.
 * 
 * @returns Current Date object that updates every minute
 */
export function useCurrentTime(): Date {
  // ✨ FIX: Always start with fresh time
  const [currentTime, setCurrentTime] = useState(() => new Date());

  useEffect(() => {
    // ✨ FIX: Update immediately on mount to sync
    setCurrentTime(new Date());
    
    listeners.add(setCurrentTime);
    startGlobalTimer();
    
    return () => {
      listeners.delete(setCurrentTime);
      stopGlobalTimer();
    };
  }, []);

  return currentTime;
}