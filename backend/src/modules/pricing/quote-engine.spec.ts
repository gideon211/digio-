import { describe, expect, it } from 'vitest';
import { quoteChauffeur, quoteRental } from './quote-engine';

const GH = 100; // pesewas per cedi

describe('quoteChauffeur', () => {
  it('prices a sedan transfer at the zone-pair rate', () => {
    const quote = quoteChauffeur({ basePricePesewas: 600 * GH });

    expect(quote.subtotalPesewas).toBe(600 * GH);
    expect(quote.totalPesewas).toBe(600 * GH);
    expect(quote.discountPesewas).toBe(0);
    expect(quote.depositPesewas).toBe(180 * GH);
    expect(quote.balancePesewas).toBe(420 * GH);
  });

  it('applies the vehicle class multiplier and rounds up the ladder', () => {
    const quote = quoteChauffeur({ basePricePesewas: 455 * GH, multiplier: 1.6 });
    // 455 * 1.6 = 728 → nearest GH₵5 = 730
    expect(quote.lineItems[0]?.amountPesewas).toBe(730 * GH);
  });

  it('adds server-resolved extras to the subtotal', () => {
    const quote = quoteChauffeur({
      basePricePesewas: 450 * GH,
      extras: [
        { code: 'meet_greet', label: 'Meet and greet', pricePesewas: 30 * GH },
        { code: 'child_seat', label: 'Child seat', pricePesewas: 25 * GH },
      ],
    });

    expect(quote.subtotalPesewas).toBe(505 * GH);
    expect(quote.lineItems).toHaveLength(3);
  });

  it('applies a percentage promo', () => {
    const quote = quoteChauffeur({
      basePricePesewas: 480 * GH,
      discounts: [{ code: 'AKWAABA10', label: 'Promo AKWAABA10', type: 'percent', value: 10 }],
    });

    expect(quote.discountPesewas).toBe(48 * GH);
    expect(quote.totalPesewas).toBe(432 * GH);
    expect(quote.depositPesewas).toBe(130 * GH); // 129.6 → nearest cedi
  });

  it('stacks promo and membership additively', () => {
    const quote = quoteChauffeur({
      basePricePesewas: 500 * GH,
      discounts: [
        { code: 'AKWAABA10', label: 'Promo', type: 'percent', value: 10 },
        { code: 'vesper', label: 'Vesper member', type: 'percent', value: 10 },
      ],
    });

    expect(quote.discountPesewas).toBe(100 * GH);
    expect(quote.totalPesewas).toBe(400 * GH);
  });

  it('caps stacked discounts at the ceiling', () => {
    const quote = quoteChauffeur({
      basePricePesewas: 500 * GH,
      maxDiscountPercent: 25,
      discounts: [
        { code: 'a', label: 'A', type: 'percent', value: 10 },
        { code: 'b', label: 'B', type: 'percent', value: 10 },
        { code: 'c', label: 'C', type: 'percent', value: 10 },
      ],
    });

    expect(quote.discountPesewas).toBe(125 * GH);
    expect(quote.totalPesewas).toBe(375 * GH);
  });

  it('respects a per-promo discount cap', () => {
    const quote = quoteChauffeur({
      basePricePesewas: 1000 * GH,
      maxDiscountPercent: 100,
      discounts: [
        { code: 'BIG', label: 'Big promo', type: 'percent', value: 50, maxDiscountPesewas: 200 * GH },
      ],
    });

    expect(quote.discountPesewas).toBe(200 * GH);
  });

  it('never discounts below zero', () => {
    const quote = quoteChauffeur({
      basePricePesewas: 100 * GH,
      maxDiscountPercent: 100,
      discounts: [{ code: 'FREE', label: 'Free ride', type: 'fixed', value: 500 * GH }],
    });

    expect(quote.totalPesewas).toBe(0);
    expect(quote.depositPesewas).toBe(0);
  });

  it('honours a minimum total', () => {
    const quote = quoteChauffeur({
      basePricePesewas: 100 * GH,
      minimumTotalPesewas: 80 * GH,
      maxDiscountPercent: 100,
      discounts: [{ code: 'BIG', label: 'Big promo', type: 'percent', value: 50 }],
    });

    expect(quote.totalPesewas).toBe(80 * GH);
  });

  it('rejects negative base prices', () => {
    expect(() => quoteChauffeur({ basePricePesewas: -1 })).toThrow();
  });
});

describe('quoteRental', () => {
  it('prices days, delivery and extras and holds the deposit separately', () => {
    const quote = quoteRental({
      dailyRatePesewas: 800 * GH,
      days: 3,
      deliveryFeePesewas: 50 * GH,
      extras: [{ code: 'child_seat', label: 'Child seat', pricePesewas: 25 * GH }],
      securityDepositPesewas: 500 * GH,
    });

    expect(quote.subtotalPesewas).toBe(2475 * GH);
    expect(quote.totalPesewas).toBe(2475 * GH);
    expect(quote.depositPesewas).toBe(743 * GH); // 742.5 → nearest cedi
    expect(quote.balancePesewas).toBe(1732 * GH);
    expect(quote.securityDepositPesewas).toBe(500 * GH);
  });

  it('treats a zero-day request as one day', () => {
    const quote = quoteRental({ dailyRatePesewas: 800 * GH, days: 0 });
    expect(quote.subtotalPesewas).toBe(800 * GH);
  });
});
