import { z } from 'zod';

/**
 * Non-booking revenue: corporate accounts, weddings, long-term hire, jets,
 * yachts and new-city partnerships. These cannot be priced online, so they
 * collect a contact instead.
 */
export const createEnquirySchema = z.object({
  kind: z.enum(['jet', 'yacht', 'corporate', 'wedding', 'long_term', 'city']),
  name: z.string().trim().min(2, 'Tell us your name').max(80),
  // 20 characters so an international number with a country code and spacing
  // fits — a 16-character cap silently rejected most non-local numbers.
  phone: z.string().trim().min(9, 'Enter a phone number').max(20),
  email: z.email('Enter a valid email').max(120).optional(),
  message: z.string().trim().max(1000).optional(),
});

export type CreateEnquiryInput = z.infer<typeof createEnquirySchema>;
