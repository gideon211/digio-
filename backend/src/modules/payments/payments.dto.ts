import { z } from 'zod';

export const bookingRefSchema = z.string().regex(/^DG-[A-Z0-9]{6}$/);

export const initializePaymentSchema = z.object({
  bookingRef: bookingRefSchema,
  channel: z.enum(['mobile_money', 'card']).default('mobile_money'),
  /** Defaults to the booking's customer email, then the ops mailbox. */
  email: z.email().max(120).optional(),
  callbackUrl: z.url().max(300).optional(),
});

export type InitializePaymentInput = z.infer<typeof initializePaymentSchema>;

export const paymentReferenceSchema = z
  .string()
  .regex(/^DG-[A-Z0-9]{6}-[A-Z0-9-]{2,40}$/)
  .max(64);
