import type { ZodType } from 'zod';

/**
 * Discounts are expressed once, resolved from a promo row, and applied by the
 * engine. Percent values are whole numbers (10 = 10%).
 */
export interface DiscountInput {
  code: string;
  label: string;
  type: 'percent' | 'fixed';
  value: number;
  maxDiscountPesewas?: number;
}

export interface ExtraInput {
  code: string;
  label: string;
  pricePesewas: number;
}

export interface LineItem {
  code: string;
  label: string;
  amountPesewas: number;
}

export interface QuoteTotals {
  lineItems: LineItem[];
  subtotalPesewas: number;
  discountPesewas: number;
  totalPesewas: number;
  /** Deposit owed to confirm the booking (30% by default). */
  depositPesewas: number;
  balancePesewas: number;
}

export interface BaseQuoteInput {
  extras?: ExtraInput[];
  discounts?: DiscountInput[];
  /** Hard ceiling on stacked discounts, as a whole percent. */
  maxDiscountPercent?: number;
  depositPercent?: number;
  /** Price ladder rounding, applied to vehicle amounts only. */
  roundingStepPesewas?: number;
  minimumTotalPesewas?: number;
}

export interface ChauffeurQuoteInput extends BaseQuoteInput {
  /** Zone-pair base price for a sedan. */
  basePricePesewas: number;
  /** Vehicle class multiplier. 1 = sedan, 1.6 = SUV, 2.1 = van. */
  multiplier?: number;
}

export interface RentalQuoteInput extends BaseQuoteInput {
  dailyRatePesewas: number;
  days: number;
  deliveryFeePesewas?: number;
  /** Refundable, held not charged. Reported separately from the total. */
  securityDepositPesewas?: number;
}

const DEFAULT_DEPOSIT_PERCENT = 30;
const DEFAULT_MAX_DISCOUNT_PERCENT = 25;

function nonNegativeInt(value: number, field: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${field} must be a non-negative number`);
  }
  return Math.round(value);
}

function applyDiscounts(
  subtotalPesewas: number,
  discounts: DiscountInput[],
  maxDiscountPercent: number,
): { items: LineItem[]; total: number } {
  const items: LineItem[] = [];
  let total = 0;

  for (const discount of discounts) {
    if (discount.value <= 0) continue;

    const raw =
      discount.type === 'percent'
        ? Math.floor((subtotalPesewas * discount.value) / 100)
        : nonNegativeInt(discount.value, `discount ${discount.code}`);

    const capped =
      discount.maxDiscountPesewas !== undefined
        ? Math.min(raw, discount.maxDiscountPesewas)
        : raw;

    const amount = Math.min(capped, subtotalPesewas);
    if (amount <= 0) continue;

    items.push({ code: discount.code, label: discount.label, amountPesewas: -amount });
    total += amount;
  }

  const ceiling = Math.floor((subtotalPesewas * maxDiscountPercent) / 100);
  if (total > ceiling) {
    const scale = ceiling / total;
    total = ceiling;
    for (const item of items) {
      item.amountPesewas = -Math.floor(-item.amountPesewas * scale);
    }
  }

  return { items, total: Math.min(total, subtotalPesewas) };
}

function depositFor(totalPesewas: number, depositPercent: number): number {
  if (totalPesewas <= 0) return 0;
  const raw = Math.round((totalPesewas * depositPercent) / 100);
  // Deposits settle to the nearest cedi so Paystack amounts stay readable.
  return Math.max(100, Math.round(raw / 100) * 100);
}

function finalise(
  lineItems: LineItem[],
  subtotalPesewas: number,
  discounts: DiscountInput[],
  input: BaseQuoteInput,
): QuoteTotals {
  const maxDiscountPercent = input.maxDiscountPercent ?? DEFAULT_MAX_DISCOUNT_PERCENT;
  const depositPercent = input.depositPercent ?? DEFAULT_DEPOSIT_PERCENT;
  const minimumTotal = input.minimumTotalPesewas ?? 0;

  const discounted = applyDiscounts(subtotalPesewas, discounts, maxDiscountPercent);
  const totalPesewas = Math.max(minimumTotal, subtotalPesewas - discounted.total);
  const depositPesewas = depositFor(totalPesewas, depositPercent);

  return {
    lineItems: [...lineItems, ...discounted.items],
    subtotalPesewas,
    discountPesewas: subtotalPesewas - totalPesewas,
    totalPesewas,
    depositPesewas,
    balancePesewas: totalPesewas - depositPesewas,
  };
}

/**
 * Point-to-point chauffeur transfer: base zone-pair price × class multiplier,
 * plus extras, minus discounts.
 */
export function quoteChauffeur(input: ChauffeurQuoteInput): QuoteTotals {
  const base = nonNegativeInt(input.basePricePesewas, 'basePricePesewas');
  const multiplier = input.multiplier ?? 1;

  if (!Number.isFinite(multiplier) || multiplier <= 0) {
    throw new Error('multiplier must be greater than zero');
  }

  const step = input.roundingStepPesewas ?? 500;
  const vehicleAmount = Math.round(Math.round((base * multiplier) / step) * step);

  const extras = input.extras ?? [];
  const extraItems: LineItem[] = extras.map((extra) => ({
    code: extra.code,
    label: extra.label,
    amountPesewas: nonNegativeInt(extra.pricePesewas, `extra ${extra.code}`),
  }));

  const subtotal = vehicleAmount + extraItems.reduce((sum, item) => sum + item.amountPesewas, 0);

  return finalise(
    [{ code: 'vehicle', label: 'Vehicle', amountPesewas: vehicleAmount }, ...extraItems],
    subtotal,
    input.discounts ?? [],
    input,
  );
}

/**
 * Self-drive or chauffeur day hire: day rate × days, plus delivery and extras.
 * The security deposit is reported alongside the total, never inside it.
 */
export function quoteRental(input: RentalQuoteInput): QuoteTotals & {
  securityDepositPesewas: number;
} {
  const dailyRate = nonNegativeInt(input.dailyRatePesewas, 'dailyRatePesewas');
  const days = Math.max(1, nonNegativeInt(input.days, 'days'));
  const delivery = nonNegativeInt(input.deliveryFeePesewas ?? 0, 'deliveryFeePesewas');

  const rentalItem: LineItem = {
    code: 'rental_days',
    label: `${days} day${days === 1 ? '' : 's'} × ${(dailyRate / 100).toFixed(0)} GHS`,
    amountPesewas: dailyRate * days,
  };

  const extraItems: LineItem[] = (input.extras ?? []).map((extra) => ({
    code: extra.code,
    label: extra.label,
    amountPesewas: nonNegativeInt(extra.pricePesewas, `extra ${extra.code}`),
  }));

  const deliveryItems: LineItem[] =
    delivery > 0 ? [{ code: 'delivery', label: 'Delivery and collection', amountPesewas: delivery }] : [];

  const lineItems = [rentalItem, ...deliveryItems, ...extraItems];
  const subtotal = lineItems.reduce((sum, item) => sum + item.amountPesewas, 0);

  const totals = finalise(lineItems, subtotal, input.discounts ?? [], input);
  return {
    ...totals,
    securityDepositPesewas: input.securityDepositPesewas ?? 0,
  };
}

/** Narrow runtime guard used by Nest pipes that accept a Zod schema. */
export function isZodSchema(value: unknown): value is ZodType {
  return (
    typeof value === 'object' &&
    value !== null &&
    'safeParse' in value &&
    typeof (value as { safeParse: unknown }).safeParse === 'function'
  );
}
