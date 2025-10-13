// src/utils/scheduledOrderUtils.ts

export interface ScheduledOrderInfo {
  isScheduled: boolean;
  scheduledTime?: Date;
  scheduledTimeFormatted?: string;
  prepWindowOpens?: Date;
  canStartPreparing?: boolean;
  minutesUntilPrep?: number;
  minutesUntilScheduled?: number;
  status?: 'locked' | 'ready' | 'overdue';
  displayMessage?: string;
}

export const getScheduledInfo = (
  scheduleAt: string,
  createdAt: string,
  orderType: 'delivery' | 'take_away' | 'dine_in',
  currentTime: Date = new Date()
): ScheduledOrderInfo => {
  const scheduledTime = new Date(scheduleAt);
  const orderCreatedTime = new Date(createdAt);
  const now = currentTime;

  // Check if truly scheduled (scheduled time > creation time)
  const isTrulyScheduled = scheduledTime > orderCreatedTime;
  
  if (!isTrulyScheduled) {
    return { isScheduled: false };
  }

  // Calculate preparation lead time (PRODUCTION VALUES)
  const prepLeadTimeMinutes =
    orderType === 'delivery' ? 45 :
    orderType === 'take_away' ? 20 : 
    15;

  const prepWindowOpens = new Date(scheduledTime);
  prepWindowOpens.setMinutes(prepWindowOpens.getMinutes() - prepLeadTimeMinutes);

  const canStartPreparing = now >= prepWindowOpens;
  const minutesUntilPrep = Math.max(0, Math.floor((prepWindowOpens.getTime() - now.getTime()) / 60000));
  const minutesUntilScheduled = Math.max(0, Math.floor((scheduledTime.getTime() - now.getTime()) / 60000));

  // Determine status
  let status: 'locked' | 'ready' | 'overdue';
  let displayMessage: string;

  if (now > scheduledTime) {
    status = 'overdue';
    displayMessage = '⚠️ Overdue!';
  } else if (canStartPreparing) {
    status = 'ready';
    displayMessage = '✓ Ready to cook';
  } else {
    status = 'locked';
    displayMessage = '🔒 Locked';
  }

  return {
    isScheduled: true,
    scheduledTime,
    scheduledTimeFormatted: formatScheduledTime(scheduledTime),
    prepWindowOpens,
    canStartPreparing,
    minutesUntilPrep,
    minutesUntilScheduled,
    status,
    displayMessage
  };
};

export const formatScheduledTime = (date: Date): string => {
  return date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
};

export const formatCountdown = (minutes: number): string => {
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
};