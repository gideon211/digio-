import { z } from 'zod';

export const createBookingSchema = z.object({
  quoteToken: z.uuid(),
  customer: z.object({
    name: z.string().trim().min(2).max(80),
    phone: z.string().trim().min(9).max(16),
    email: z.email().max(120).optional(),
  }),
  paymentChannel: z
    .enum(['mobile_money', 'card', 'bank_transfer', 'corporate_invoice'])
    .default('mobile_money'),
  notes: z.string().trim().max(500).optional(),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;

export const bookingRefSchema = z.string().regex(/^DG-[A-Z0-9]{6}$/);
