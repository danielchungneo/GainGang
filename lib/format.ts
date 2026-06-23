import type { ExerciseUnit } from '@/types';
import { UNIT_LABELS } from '@/types';

/** Format an amount with its unit (e.g. "120 reps", "2.5 mi", "45 sec"). */
export function formatAmount(amount: number, unit: ExerciseUnit): string {
  if (unit === 'miles') {
    const formatted = Number.isInteger(amount) ? String(amount) : amount.toFixed(1);
    return `${formatted} ${UNIT_LABELS.miles.short}`;
  }
  if (unit === 'seconds') {
    if (amount >= 60) {
      const m = Math.floor(amount / 60);
      const s = amount % 60;
      return s ? `${m}m ${s}s` : `${m}m`;
    }
    return `${amount} sec`;
  }
  return `${amount.toLocaleString()} ${UNIT_LABELS[unit].short}`;
}

/** Compact relative time, e.g. "now", "5m", "3h", "2d". */
export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 45) return 'now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d`;
  const wk = Math.floor(day / 7);
  if (wk < 5) return `${wk}w`;
  return new Date(iso).toLocaleDateString();
}

/** Initials for avatar fallbacks. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Today's date as a YYYY-MM-DD string (local). */
export function todayISO(): string {
  return toLocalDateISO(new Date());
}

/** YYYY-MM-DD for a Date in local time. */
export function toLocalDateISO(date: Date): string {
  const tz = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - tz).toISOString().slice(0, 10);
}

/** YYYY-MM-DD for an ISO timestamp in local time. */
export function isoTimestampToLocalDate(iso: string): string {
  return toLocalDateISO(new Date(iso));
}

/** Section header for activity groups, e.g. "Today", "Yesterday", "Monday, Jun 23". */
export function activityDateLabel(isoDate: string): string {
  const today = todayISO();
  if (isoDate === today) return 'Today';

  const yesterday = toLocalDateISO(new Date(Date.now() - 86_400_000));
  if (isoDate === yesterday) return 'Yesterday';

  return new Date(`${isoDate}T12:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

/** "June 2026" style month label. */
export function monthYearLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
}

/** End of the given YYYY-MM-DD calendar day in local time. */
export function endOfLocalDay(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day, 23, 59, 59, 999);
}

/** Start of the given YYYY-MM-DD calendar day in local time. */
export function startOfLocalDay(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

export type TimeLeftUrgency = 'comfortable' | 'moderate' | 'urgent' | 'critical' | 'ended';

export interface TimeLeftStatus {
  label: string;
  urgency: TimeLeftUrgency;
}

function formatTimeLeftLabel(ms: number): string {
  const hours = Math.floor(ms / (1000 * 60 * 60));
  if (hours >= 24) return `${Math.floor(hours / 24)}d left`;
  if (hours >= 1) return `${hours}h left`;

  const minutes = Math.max(1, Math.floor(ms / (1000 * 60)));
  return `${minutes}m left`;
}

function urgencyFromRemainingRatio(ratio: number): TimeLeftUrgency {
  if (ratio > 0.5) return 'comfortable';
  if (ratio > 0.25) return 'moderate';
  if (ratio > 0.1) return 'urgent';
  return 'critical';
}

/** Countdown label and urgency tier for a goal window. */
export function timeLeftStatus(startsOn: string, endsOn: string): TimeLeftStatus {
  const end = endOfLocalDay(endsOn).getTime();
  const start = startOfLocalDay(startsOn).getTime();
  const remaining = end - Date.now();

  if (remaining <= 0) return { label: 'Ended', urgency: 'ended' };

  const windowMs = Math.max(end - start, 1);
  const ratio = remaining / windowMs;

  return {
    label: formatTimeLeftLabel(remaining),
    urgency: urgencyFromRemainingRatio(ratio),
  };
}

/** Goal header label for a calendar day, e.g. "Monday Goal". */
export function dayGoalLabel(isoDate: string): string {
  const day = new Date(`${isoDate}T12:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
  });
  return `${day} Goal`;
}

/** Countdown until a calendar date ends, e.g. "14h left" or "Ended". */
export function timeLeftUntilDateEnd(isoDate: string): string {
  return timeLeftStatus(isoDate, isoDate).label;
}
