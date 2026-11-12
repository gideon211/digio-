import { describe, expect, it } from 'vitest';
import { isExclusionViolation, isUniqueViolation, pgErrorCode } from './pg-errors';

describe('pgErrorCode', () => {
  it('reads the code off the driver error itself', () => {
    expect(pgErrorCode({ code: '23505' })).toBe('23505');
  });

  it('finds a code buried in the cause chain', () => {
    const driverError = Object.assign(new Error('conflicting key value violates exclusion'), {
      code: '23P01',
    });

    // Drizzle wraps the driver failure, which is exactly the shape a service sees.
    expect(pgErrorCode(new Error('Failed query', { cause: driverError }))).toBe('23P01');
  });

  it('walks more than one level when the wrapper has its own wrapper', () => {
    const driverError = Object.assign(new Error('duplicate key'), { code: '23505' });
    const drizzleError = new Error('Failed query', { cause: driverError });

    expect(pgErrorCode(new Error('transaction failed', { cause: drizzleError }))).toBe('23505');
  });

  it('ignores an error with no SQLSTATE', () => {
    expect(pgErrorCode(new Error('boom'))).toBeUndefined();
    expect(pgErrorCode(null)).toBeUndefined();
  });

  it('stops after a bounded number of levels rather than looping forever', () => {
    const selfCause: { cause?: unknown } = {};
    selfCause.cause = selfCause;

    expect(pgErrorCode(selfCause)).toBeUndefined();
  });
});

describe('violation predicates', () => {
  it('recognises an exclusion violation from a wrapped driver error', () => {
    const driverError = Object.assign(new Error('conflict'), { code: '23P01' });

    expect(isExclusionViolation(new Error('Failed query', { cause: driverError }))).toBe(true);
    expect(isUniqueViolation(new Error('Failed query', { cause: driverError }))).toBe(false);
  });

  it('recognises a unique violation from a wrapped driver error', () => {
    const driverError = Object.assign(new Error('duplicate'), { code: '23505' });

    expect(isUniqueViolation(new Error('Failed query', { cause: driverError }))).toBe(true);
    expect(isExclusionViolation(new Error('Failed query', { cause: driverError }))).toBe(false);
  });

  it('rejects an unrelated SQLSTATE', () => {
    expect(isExclusionViolation(new Error('syntax'))).toBe(false);
    expect(isUniqueViolation(new Error('syntax'))).toBe(false);
  });
});
