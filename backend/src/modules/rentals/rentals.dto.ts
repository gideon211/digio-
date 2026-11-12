import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { RENTAL_EXTRA_CODES } from '../pricing/rental-extras';

export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
  .refine((value) => !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime()), 'Invalid date');

export const rentalRangeSchema = z.object({
  classSlug: z.string().min(1).max(40),
  fromDate: isoDate,
  toDate: isoDate,
});

export const createRentalQuoteSchema = z.object({
  product: z.enum(['self_drive', 'chauffeur_hire']).default('self_drive'),
  classSlug: z.string().min(1).max(40),
  fromDate: isoDate,
  toDate: isoDate,
  deliveryZoneSlug: z.string().min(1).max(60).optional(),
  extras: z
    .array(z.enum(RENTAL_EXTRA_CODES as [string, ...string[]]))
    .max(3)
    .default([]),
  promoCode: z
    .string()
    .trim()
    .max(32)
    .transform((code) => code.toUpperCase())
    .optional(),
  membershipPercent: z.coerce.number().int().min(0).max(25).default(0),
});

export type CreateRentalQuoteInput = z.infer<typeof createRentalQuoteSchema>;
export type RentalRangeInput = z.infer<typeof rentalRangeSchema>;

export const MAX_RENTAL_DAYS = 60;

export interface RentalWindow {
  fromDate: string;
  toDate: string;
  days: number;
}

/**
 * A rental day is a calendar day. The window is half-open [from, to), which is
 * exactly how `daterange` and the exclusion constraint read it — one definition
 * shared by pricing, availability and storage.
 */
export function rentalWindow(fromDate: string, toDate: string): RentalWindow {
  const from = new Date(`${fromDate}T00:00:00Z`);
  const to = new Date(`${toDate}T00:00:00Z`);

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new BadRequestException({ code: 'DATES_INVALID', message: 'Pick valid dates' });
  }

  const days = Math.round((to.getTime() - from.getTime()) / 86_400_000);

  if (days < 1) {
    throw new BadRequestException({
      code: 'DATE_RANGE_INVALID',
      message: 'The return date must be after the pick-up date',
    });
  }

  if (days > MAX_RENTAL_DAYS) {
    throw new BadRequestException({
      code: 'RENTAL_TOO_LONG',
      message: `Rentals are limited to ${MAX_RENTAL_DAYS} days online — contact us for longer hire`,
    });
  }

  return { fromDate, toDate, days };
}
