import { z } from 'zod';

export const chauffeurExtrasSchema = z.enum([
  'meet_greet',
  'child_seat',
  'extra_stop',
  'refreshments',
]);

export const createChauffeurQuoteSchema = z.object({
  classSlug: z.string().min(1).max(40),
  fromZoneSlug: z.string().min(1).max(60),
  toZoneSlug: z.string().min(1).max(60),
  passengers: z.coerce.number().int().min(1).max(7),
  bags: z.coerce.number().int().min(0).max(10).default(0),
  startsAt: z.coerce.date(),
  flightNumber: z.string().trim().max(12).optional(),
  extras: z.array(chauffeurExtrasSchema).max(4).default([]),
  promoCode: z
    .string()
    .trim()
    .max(32)
    .transform((code) => code.toUpperCase())
    .optional(),
  membershipPercent: z.coerce.number().int().min(0).max(25).default(0),
});

export type CreateChauffeurQuoteInput = z.infer<typeof createChauffeurQuoteSchema>;
