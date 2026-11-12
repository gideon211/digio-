/**
 * Postgres error codes, read through whatever wrapper the driver layer used.
 *
 * Drizzle wraps driver failures in `DrizzleQueryError`, so the SQLSTATE sits on
 * `error.cause`, not on the error the service catches. Walking the chain keeps
 * this independent of the wrapper's shape.
 */
export const PG_UNIQUE_VIOLATION = '23505';
export const PG_EXCLUSION_VIOLATION = '23P01';

export function pgErrorCode(error: unknown): string | undefined {
  let current: unknown = error;

  for (let depth = 0; depth < 5 && typeof current === 'object' && current !== null; depth += 1) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === 'string') return code;
    current = (current as { cause?: unknown }).cause;
  }

  return undefined;
}

export function isUniqueViolation(error: unknown): boolean {
  return pgErrorCode(error) === PG_UNIQUE_VIOLATION;
}

/** Raised when a GiST exclusion constraint rejects overlapping rows. */
export function isExclusionViolation(error: unknown): boolean {
  return pgErrorCode(error) === PG_EXCLUSION_VIOLATION;
}
