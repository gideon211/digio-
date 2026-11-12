import { z } from 'zod';

/**
 * Environment contract. Parsed once at boot — the process refuses to start
 * with an invalid or missing value rather than failing later at runtime.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  HOST: z.string().default('0.0.0.0'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  /** Minutes a quote stays valid. Client never sees the price source, only the token. */
  QUOTE_TTL_MINUTES: z.coerce.number().int().min(1).max(120).default(15),

  /** CORS origins, comma separated. Empty means "reflect request origin" in dev. */
  CORS_ORIGINS: z.string().default(''),

  PAYSTACK_SECRET_KEY: z.string().optional(),
  PAYSTACK_WEBHOOK_SECRET: z.string().optional(),
  PAYSTACK_API_URL: z.string().url().default('https://api.paystack.co'),
  /** Where Paystack returns the customer after checkout. */
  PAYSTACK_CALLBACK_URL: z.string().url().optional(),
  /** Used when a booking has no customer email; Paystack requires one. */
  PAYMENTS_FALLBACK_EMAIL: z.string().email().default('bookings@digiogh.com'),

  /** Customer web app, used for manage-booking links in messages. */
  APP_URL: z.string().url().default('http://localhost:3000'),
  /** Public base URL of this API, used for local checkout simulation. */
  API_PUBLIC_URL: z.string().url().default('http://localhost:4000'),

  WHATSAPP_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_ID: z.string().optional(),
  WHATSAPP_VERIFY_TOKEN: z.string().optional(),
  WHATSAPP_API_VERSION: z.string().default('v21.0'),
  WHATSAPP_TEMPLATE_NAME: z.string().optional(),
  WHATSAPP_TEMPLATE_LANG: z.string().default('en'),

  SMS_PROVIDER: z.enum(['hubtel', 'termii']).optional(),
  SMS_API_KEY: z.string().optional(),
  SMS_CLIENT_ID: z.string().optional(),
  SMS_SENDER_ID: z.string().default('DIGIO'),

  NOTIFICATIONS_DISPATCH_ENABLED: z.string().default('true'),

  /** Live trip simulator. Defaults on outside production; set 'false' to disable. */
  TRACKING_SIMULATION: z.enum(['true', 'false']).optional(),

  S3_ENDPOINT: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}

export function corsOrigins(env: Env): string[] {
  return env.CORS_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}
