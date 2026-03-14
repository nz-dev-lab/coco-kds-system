/**
 * Utilities for detecting and resolving scheduled times from TMBILL free-text fields.
 *
 * Shop hours: 11:00 AM – 11:00 PM
 * AM/PM resolution rules:
 *   1–10   → always PM  (shop not open 1–10 AM)
 *   12     → noon (PM)
 *   11     → ambiguous: compare vs current time
 *             - current time < 12:00 → 11 AM (opening slot)
 *             - current time ≥ 12:00 → 11 PM (closing slot)
 */

export type ScheduleConfidence = 'high' | 'medium' | 'none';

export interface TmbillScheduleInfo {
  detected: boolean;
  scheduledTime?: Date;
  scheduledTimeFormatted?: string;
  confidence: ScheduleConfidence;
  minutesUntil?: number;
  isOverdue?: boolean;
  isApproaching?: boolean; // within alertMinutes
}

// ── Regex patterns ──────────────────────────────────────────────────────────

// Matches: 7:30pm, 7:30 pm, 7pm, 19:30, 19.30, 7.30pm
const TIME_PATTERN =
  /\b(\d{1,2})(?:[:.:](\d{2}))?\s*(am|pm)?\b/gi;

// Keywords that suggest this is a scheduled/booking order
const SCHEDULE_KEYWORDS = /\b(sched|schedule|scheduled|booking|booked|book|reserve|reserved|reservation)\b/i;

// ── Core parser ──────────────────────────────────────────────────────────────

interface ParsedTime {
  hour: number;
  minute: number;
  hasMinutes: boolean; // true when H:MM separator was present
  hasAmPm: boolean;
  ampm?: 'am' | 'pm';
}

function parseTimeFromText(text: string): ParsedTime | null {
  if (!text) return null;
  TIME_PATTERN.lastIndex = 0;
  const match = TIME_PATTERN.exec(text);
  if (!match) return null;

  const hour = parseInt(match[1], 10);
  const minute = match[2] ? parseInt(match[2], 10) : 0;
  const ampmStr = match[3]?.toLowerCase() as 'am' | 'pm' | undefined;
  const hasMinutes = !!match[2];

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;

  // Reject bare numbers entirely (no colon separator AND no AM/PM).
  // These are almost always table/person counts, not times.
  // Only 24h numbers (13–23) are unambiguous without a separator.
  if (!hasMinutes && !ampmStr && hour < 13) return null;

  return { hour, minute, hasMinutes, hasAmPm: !!ampmStr, ampm: ampmStr };
}

/**
 * Resolve a parsed hour to 24h format using shop-hours rules.
 * Returns resolved hour or null if outside shop hours (11–23).
 */
function resolveHour(parsed: ParsedTime, now: Date): { hour24: number; confidence: ScheduleConfidence } | null {
  let { hour, hasAmPm, ampm } = parsed;

  // Already 24h format
  if (hour >= 13) {
    if (hour > 23) return null;
    return { hour24: hour, confidence: 'high' };
  }

  // Explicit AM/PM given
  if (hasAmPm) {
    if (ampm === 'pm' && hour !== 12) hour += 12;
    if (ampm === 'am' && hour === 12) hour = 0;
    if (hour < 11 || hour > 23) return null; // outside shop hours
    return { hour24: hour, confidence: 'high' };
  }

  // No AM/PM — apply shop-hours rules
  if (hour === 0) return null; // midnight, not valid
  if (hour === 12) return { hour24: 12, confidence: 'high' }; // noon
  if (hour >= 1 && hour <= 10) {
    // Always PM (shop not open 1–10 AM)
    return { hour24: hour + 12, confidence: 'medium' };
  }
  if (hour === 11) {
    // Ambiguous — use current time to decide
    const isBeforeNoon = now.getHours() < 12;
    return { hour24: isBeforeNoon ? 11 : 23, confidence: 'medium' };
  }

  return null;
}

/**
 * Scan multiple free-text fields and return the best detected time.
 * Fields are tried in priority order: kot_note → order_note → customer_name → table_number
 */
export function detectScheduledTime(order: {
  kot_note?: string | null;
  order_note?: string | null;
  customer_name?: string | null;
  table_number?: string | null;
}, now: Date = new Date()): { scheduledTime: Date; confidence: ScheduleConfidence } | null {
  const fields = [
    order.kot_note,
    order.order_note,
    order.customer_name,
    order.table_number,
  ].filter(Boolean) as string[];

  const hasKeyword = fields.some((f) => SCHEDULE_KEYWORDS.test(f));

  for (const field of fields) {
    const parsed = parseTimeFromText(field);
    if (!parsed) continue;
    // H:MM without AM/PM is still ambiguous (e.g. "7:30" in a note about 7 items at 30p).
    // Require a schedule keyword in any field before treating it as a time.
    if (parsed.hasMinutes && !parsed.hasAmPm && parsed.hour < 13 && !hasKeyword) continue;
    const resolved = resolveHour(parsed, now);
    if (!resolved) continue;

    const scheduledTime = new Date(now);
    scheduledTime.setHours(resolved.hour24, parsed.minute, 0, 0);

    // If the resolved time is in the past (e.g. it's 8pm and we parsed "7:30")
    // it's likely yesterday or a data entry artefact — skip
    if (scheduledTime <= now && (now.getTime() - scheduledTime.getTime()) > 5 * 60 * 1000) {
      continue;
    }

    // Boost confidence if a schedule keyword was also present in any field
    const confidence: ScheduleConfidence =
      resolved.confidence === 'high' || hasKeyword ? 'high' : 'medium';

    return { scheduledTime, confidence };
  }

  // No time found but has a schedule keyword — return null (caller shows "needs time" state)
  return null;
}

// ── Info builder (used by card + hook) ───────────────────────────────────────

export function getTmbillScheduleInfo(
  scheduledTime: Date | null,
  confidence: ScheduleConfidence,
  alertMinutes: number,
  now: Date = new Date()
): TmbillScheduleInfo {
  if (!scheduledTime) {
    return { detected: false, confidence: 'none' };
  }

  const msUntil = scheduledTime.getTime() - now.getTime();
  const minutesUntil = Math.floor(msUntil / 60000);
  const isOverdue = minutesUntil < 0;
  const isApproaching = !isOverdue && minutesUntil <= alertMinutes;

  return {
    detected: true,
    scheduledTime,
    scheduledTimeFormatted: formatTmbillTime(scheduledTime),
    confidence,
    minutesUntil,
    isOverdue,
    isApproaching,
  };
}

export function formatTmbillTime(date: Date): string {
  return date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function formatTmbillCountdown(minutes: number): string {
  const abs = Math.abs(minutes);
  if (abs < 60) return `${abs}min`;
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/**
 * Parse a manually entered time string (e.g. "7:30", "19:30") and an explicit ampm
 * into a Date for today. Returns null if unparseable.
 */
export function parseManualTime(
  timeStr: string,
  ampm: 'am' | 'pm',
  now: Date = new Date()
): Date | null {
  const match = /^(\d{1,2})[.:](\d{2})$/.exec(timeStr.trim());
  if (!match) return null;
  let hour = parseInt(match[1], 10);
  const minute = parseInt(match[2], 10);
  if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return null;
  if (ampm === 'pm' && hour !== 12) hour += 12;
  if (ampm === 'am' && hour === 12) hour = 0;
  const result = new Date(now);
  result.setHours(hour, minute, 0, 0);
  return result;
}
