import { Inject, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';

export interface PaystackInitializeInput {
  email: string;
  /** Integer pesewas. Paystack Ghana expects the minor unit. */
  amountPesewas: number;
  reference: string;
  callbackUrl: string;
  metadata?: Record<string, unknown>;
}

export interface PaystackInitializeResult {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
}

export interface PaystackChargeEvent {
  event: string;
  data: {
    id?: number;
    reference?: string;
    amount?: number;
    status?: string;
    channel?: string;
    paid_at?: string;
    customer?: { email?: string };
    metadata?: Record<string, unknown>;
    [key: string]: unknown;
  };
}

/**
 * The only place that talks to Paystack.
 *
 * Signature verification is deliberately separated from initialization: the
 * webhook path must be able to verify a payload without any network access.
 */
@Injectable()
export class PaystackGateway {
  private readonly logger = new Logger(PaystackGateway.name);

  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  get secretKey(): string | undefined {
    return this.config.get<string>('PAYSTACK_SECRET_KEY') || undefined;
  }

  /** True when real Paystack calls are possible. */
  get enabled(): boolean {
    return Boolean(this.secretKey);
  }

  /**
   * Paystack signs the raw request body with HMAC-SHA512 using the secret key
   * (or the dashboard webhook secret when one is configured).
   */
  verifySignature(rawBody: Buffer, signature: string | undefined): boolean {
    const secret =
      this.config.get<string>('PAYSTACK_WEBHOOK_SECRET') || this.secretKey;

    if (!secret || !signature) return false;

    const expected = createHmac('sha512', secret).update(rawBody).digest('hex');
    const expectedBuffer = Buffer.from(expected, 'utf8');
    const providedBuffer = Buffer.from(signature, 'utf8');

    // timingSafeEqual throws on length mismatch, which is itself a signal.
    if (expectedBuffer.length !== providedBuffer.length) return false;

    return timingSafeEqual(expectedBuffer, providedBuffer);
  }

  async initialize(input: PaystackInitializeInput): Promise<PaystackInitializeResult> {
    const body = await this.request('/transaction/initialize', {
      method: 'POST',
      body: JSON.stringify({
        email: input.email,
        amount: input.amountPesewas,
        reference: input.reference,
        callback_url: input.callbackUrl,
        channels: ['mobile_money', 'card'],
        metadata: input.metadata ?? {},
      }),
    });

    const data = body.data as
      | { authorization_url?: string; access_code?: string; reference?: string }
      | undefined;

    if (!data?.authorization_url) {
      throw new ServiceUnavailableException({
        code: 'PAYSTACK_INITIALIZE_FAILED',
        message: 'Paystack did not return a checkout URL',
      });
    }

    return {
      authorizationUrl: data.authorization_url,
      accessCode: data.access_code ?? '',
      reference: data.reference ?? input.reference,
    };
  }

  async verify(reference: string): Promise<{
    status: string;
    amountPesewas: number;
    paidAt: string | null;
  }> {
    const body = await this.request(`/transaction/verify/${encodeURIComponent(reference)}`, {
      method: 'GET',
    });

    const data = body.data as
      | { status?: string; amount?: number; paid_at?: string | null }
      | undefined;

    if (!data) {
      throw new ServiceUnavailableException({
        code: 'PAYSTACK_VERIFY_FAILED',
        message: 'Paystack did not return a transaction',
      });
    }

    return {
      status: data.status ?? 'unknown',
      amountPesewas: Number(data.amount ?? 0),
      paidAt: data.paid_at ?? null,
    };
  }

  private async request(
    path: string,
    init: { method: 'GET' | 'POST'; body?: string },
  ): Promise<{ data?: unknown }> {
    const secret = this.secretKey;
    if (!secret) {
      throw new ServiceUnavailableException({
        code: 'PAYSTACK_NOT_CONFIGURED',
        message: 'Payments are not configured',
      });
    }

    const baseUrl = this.config.get<string>('PAYSTACK_API_URL') ?? 'https://api.paystack.co';

    let response: Response;
    try {
      response = await fetch(`${baseUrl}${path}`, {
        method: init.method,
        headers: {
          authorization: `Bearer ${secret}`,
          'content-type': 'application/json',
        },
        body: init.body,
        signal: AbortSignal.timeout(10_000),
      });
    } catch (error) {
      this.logger.error(`Paystack ${path} failed: ${(error as Error).message}`);
      throw new ServiceUnavailableException({
        code: 'PAYSTACK_UNAVAILABLE',
        message: 'Could not reach the payment provider, please retry',
      });
    }

    const body = (await response.json().catch(() => null)) as
      | { status?: boolean; message?: string; data?: unknown }
      | null;

    if (!response.ok || !body?.status) {
      this.logger.error(
        `Paystack ${path} returned ${response.status}: ${body?.message ?? 'no message'}`,
      );
      throw new ServiceUnavailableException({
        code: 'PAYSTACK_ERROR',
        message: body?.message ?? 'The payment provider rejected the request',
      });
    }

    return body;
  }
}
