import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { PaystackGateway } from './paystack.gateway';

const SECRET = 'sk_test_digio_secret';

function gateway(values: Record<string, string> = { PAYSTACK_SECRET_KEY: SECRET }): PaystackGateway {
  const config = { get: (key: string) => values[key] };
  return new PaystackGateway(config as never);
}

function sign(body: string, secret = SECRET): string {
  return createHmac('sha512', secret).update(body).digest('hex');
}

const BODY = JSON.stringify({
  event: 'charge.success',
  data: { reference: 'DG-ABCDEF-D-1A2B3C', amount: 8000, status: 'success' },
});

describe('PaystackGateway.verifySignature', () => {
  it('accepts a signature computed over the exact raw body', () => {
    expect(gateway().verifySignature(Buffer.from(BODY), sign(BODY))).toBe(true);
  });

  it('prefers the configured webhook secret over the API key', () => {
    const webhookSecret = 'whsec_digio';
    const instance = gateway({
      PAYSTACK_SECRET_KEY: SECRET,
      PAYSTACK_WEBHOOK_SECRET: webhookSecret,
    });

    expect(instance.verifySignature(Buffer.from(BODY), sign(BODY, webhookSecret))).toBe(true);
    expect(instance.verifySignature(Buffer.from(BODY), sign(BODY, SECRET))).toBe(false);
  });

  it('rejects a body that changed after signing', () => {
    const signature = sign(BODY);
    const tampered = BODY.replace('"amount":8000', '"amount":100');

    expect(gateway().verifySignature(Buffer.from(tampered), signature)).toBe(false);
  });

  it('rejects a signature of the wrong length without throwing', () => {
    expect(gateway().verifySignature(Buffer.from(BODY), 'deadbeef')).toBe(false);
  });

  it('rejects when no signature header is present', () => {
    expect(gateway().verifySignature(Buffer.from(BODY), undefined)).toBe(false);
  });

  it('rejects everything when no secret is configured', () => {
    expect(gateway({}).verifySignature(Buffer.from(BODY), sign(BODY))).toBe(false);
  });
});
