import { randomBytes } from 'node:crypto';

/** Crockford-style alphabet: no I, O, 0 or 1 to survive being read over the phone. */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function bookingRef(): string {
  const bytes = randomBytes(6);
  const body = Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join('');
  return `DG-${body}`;
}

/**
 * Ghana mobile numbers: 0XXXXXXXXX locally, +233XXXXXXXXX internationally.
 * Store one canonical form (E.164) so lookups and OTP delivery are stable.
 */
export function normaliseGhanaPhone(raw: string): string | null {
  const digits = raw.replace(/[\s-]/g, '');
  if (/^0\d{9}$/.test(digits)) return `+233${digits.slice(1)}`;
  if (/^\+233\d{9}$/.test(digits)) return digits;
  if (/^233\d{9}$/.test(digits)) return `+${digits}`;
  return null;
}
