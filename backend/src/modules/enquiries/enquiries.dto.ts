import { z } from 'zod';

/**
 * Non-booking revenue: corporate accounts, weddings, long-term hire, jets and
 * yachts. These cannot be priced online, so they collect a contact instead.
 */
export const createEnquirySchema = z.object({
  kind: z.enum(['jet', 'yacht', 'corporate', 'wedding', 'long_term']),
  name: z.string().trim().min(2, 'Tell us your name').max(80),
  phone: z.string().trim().min(9, 'Enter a phone number').max(16),
  email: z.email('Enter a valid email').max(120).optional(),
  message: z.string().trim().max(1000).optional(),
});

export type CreateEnquiryInput = z.infer<typeof createEnquirySchema>;
