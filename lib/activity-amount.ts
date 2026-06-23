import type { ExerciseUnit } from '@/types';

/** Whether the unit accepts fractional amounts (e.g. 2.5 miles). */
export function unitAllowsDecimals(unit: ExerciseUnit): boolean {
  return unit === 'miles';
}

/** Restrict keystrokes while the user types an amount. */
export function sanitizeAmountInput(raw: string, unit: ExerciseUnit): string {
  if (unitAllowsDecimals(unit)) {
    let cleaned = raw.replace(/[^\d.]/g, '');
    const dotIndex = cleaned.indexOf('.');
    if (dotIndex !== -1) {
      const before = cleaned.slice(0, dotIndex + 1);
      const after = cleaned.slice(dotIndex + 1).replace(/\./g, '').slice(0, 1);
      cleaned = before + after;
    }
    return cleaned;
  }

  return raw.replace(/\D/g, '');
}

/** Parse a user-entered amount string for the given unit. */
export function parseActivityAmount(input: string, unit: ExerciseUnit): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const value = Number(trimmed);
  if (!Number.isFinite(value) || value <= 0) return null;

  if (!unitAllowsDecimals(unit)) {
    if (!Number.isInteger(value)) return null;
    return value;
  }

  const rounded = Math.round(value * 10) / 10;
  if (rounded <= 0) return null;
  return rounded;
}

/** Human-readable validation error, or null when valid. */
export function validateAmountInput(input: string, unit: ExerciseUnit): string | null {
  const trimmed = input.trim();
  if (!trimmed) return 'Enter an amount';

  if (unitAllowsDecimals(unit)) {
    if (!/^\d+(\.\d)?$/.test(trimmed)) {
      return 'Enter miles with at most one decimal (e.g. 2.5)';
    }
  } else if (!/^\d+$/.test(trimmed)) {
    return unit === 'reps'
      ? 'Reps must be a whole number'
      : 'Seconds must be a whole number';
  }

  const parsed = parseActivityAmount(trimmed, unit);
  if (parsed === null || parsed <= 0) return 'Enter a valid amount greater than 0';
  return null;
}

/** Format a stored amount for display inside an input field. */
export function formatAmountInputValue(amount: number, unit: ExerciseUnit): string {
  if (unitAllowsDecimals(unit)) {
    return Number.isInteger(amount) ? String(amount) : amount.toFixed(1);
  }
  return String(Math.round(amount));
}

/** Placeholder hint for amount inputs. */
export function amountInputPlaceholder(unit: ExerciseUnit): string {
  if (unit === 'miles') return 'e.g. 2.5';
  if (unit === 'seconds') return 'e.g. 60';
  return 'e.g. 20';
}
