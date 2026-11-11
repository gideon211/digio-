/**
 * All money in this codebase is an integer number of pesewas (1/100 GHS).
 * Never store or compute prices as floats; format only at the boundary.
 */
export type Pesewas = number;

export const PESEWAS_PER_CEDI = 100;
export const CURRENCY = 'GHS' as const;

const cedisFormatter = new Intl.NumberFormat('en-GH', {
  style: 'currency',
  currency: CURRENCY,
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const cedisPreciseFormatter = new Intl.NumberFormat('en-GH', {
  style: 'currency',
  currency: CURRENCY,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Display helper. Whole cedis by default, as shown in the product UI. */
export function formatGhs(amount: Pesewas, options: { precise?: boolean } = {}): string {
  const cedis = amount / PESEWAS_PER_CEDI;
  return (options.precise ? cedisPreciseFormatter : cedisFormatter).format(cedis);
}

export function toPesewas(cedis: number): Pesewas {
  return Math.round(cedis * PESEWAS_PER_CEDI);
}

export function toCedis(amount: Pesewas): number {
  return amount / PESEWAS_PER_CEDI;
}

/**
 * Round to a step (default GH₵5), matching the prototype's price ladder.
 * Always rounds half up so the business never undercharges by a rounding cent.
 */
export function roundToStep(amount: Pesewas, stepPesewas = toPesewas(5)): Pesewas {
  if (stepPesewas <= 0) return Math.round(amount);
  return Math.round(amount / stepPesewas) * stepPesewas;
}

export function assertPesewas(value: number, field: string): asserts value is Pesewas {
  if (!Number.isFinite(value) || value < 0 || !Number.isInteger(value)) {
    throw new Error(`${field} must be a non-negative integer number of pesewas`);
  }
}
