import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { DeliveryResult } from './whatsapp.provider';

/**
 * SMS adapter. Hubtel is the default because the same account can collect
 * mobile money and send SMS, which keeps procurement to one vendor.
 *
 * Sender IDs must be registered with the NCA in Ghana; an unregistered ID is
 * filtered or rewritten to a random shortcode.
 */
@Injectable()
export class SmsProvider {
  private readonly logger = new Logger(SmsProvider.name);

  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  get configured(): boolean {
    const provider = this.config.get<string>('SMS_PROVIDER');
    if (provider === 'termii') return Boolean(this.config.get<string>('SMS_API_KEY'));
    if (provider === 'hubtel') {
      return Boolean(
        this.config.get<string>('SMS_CLIENT_ID') && this.config.get<string>('SMS_API_KEY'),
      );
    }
    return false;
  }

  async send(to: string, text: string): Promise<DeliveryResult> {
    if (!this.configured) {
      this.logger.log(`[sms:log] to=${to}\n${text}`);
      return { delivered: false, providerRef: 'log' };
    }

    const provider = this.config.get<string>('SMS_PROVIDER');
    return provider === 'termii' ? this.sendTermii(to, text) : this.sendHubtel(to, text);
  }

  private async sendHubtel(to: string, text: string): Promise<DeliveryResult> {
    const clientId = this.config.getOrThrow<string>('SMS_CLIENT_ID');
    const clientSecret = this.config.getOrThrow<string>('SMS_API_KEY');
    const senderId = this.config.get<string>('SMS_SENDER_ID') ?? 'DIGIO';

    const url = new URL('https://smsc.hubtel.com/v1/messages/send');
    url.searchParams.set('clientid', clientId);
    url.searchParams.set('clientsecret', clientSecret);
    url.searchParams.set('from', senderId);
    url.searchParams.set('to', to.replace(/^\+/, ''));
    url.searchParams.set('content', text);

    const response = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(10_000) });
    const payload = (await response.json().catch(() => null)) as
      | { status?: number; messageId?: string; message?: string }
      | null;

    if (!response.ok || (payload?.status !== undefined && payload.status >= 100)) {
      throw new Error(payload?.message ?? `Hubtel returned ${response.status}`);
    }

    return { delivered: true, providerRef: payload?.messageId };
  }

  private async sendTermii(to: string, text: string): Promise<DeliveryResult> {
    const apiKey = this.config.getOrThrow<string>('SMS_API_KEY');
    const senderId = this.config.get<string>('SMS_SENDER_ID') ?? 'DIGIO';

    const response = await fetch('https://api.ng.termii.com/api/sms/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        to: to.replace(/^\+/, ''),
        from: senderId,
        sms: text,
        type: 'plain',
        channel: 'generic',
      }),
      signal: AbortSignal.timeout(10_000),
    });

    const payload = (await response.json().catch(() => null)) as
      | { message_id?: string; message?: string }
      | null;

    if (!response.ok) {
      throw new Error(payload?.message ?? `Termii returned ${response.status}`);
    }

    return { delivered: true, providerRef: payload?.message_id };
  }
}
