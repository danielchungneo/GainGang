import type { ExerciseUnit } from '@/types';
import { UNIT_LABELS } from '@/types';

/** Format an amount with its unit (e.g. "120 reps", "1.2 km", "45 sec"). */
export function formatAmount(amount: number, unit: ExerciseUnit): string {
  if (unit === 'meters') {
    if (amount >= 1000) return `${(amount / 1000).toFixed(amount % 1000 === 0 ? 0 : 1)} km`;
    return `${amount} m`;
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
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}
