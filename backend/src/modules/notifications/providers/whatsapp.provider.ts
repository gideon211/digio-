import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface DeliveryResult {
  /** False when the provider is not configured and the message was only logged. */
  delivered: boolean;
  providerRef?: string;
}

/**
 * WhatsApp Cloud API.
 *
 * Real sends use a pre-approved utility template when `WHATSAPP_TEMPLATE_NAME`
 * is set, because Meta rejects free-form text outside a 24-hour service window.
 * Without credentials the message is rendered into the log instead of sent, so
 * local development can exercise the whole pipeline.
 */
@Injectable()
export class WhatsAppProvider {
  private readonly logger = new Logger(WhatsAppProvider.name);

  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  get configured(): boolean {
    return Boolean(
      this.config.get<string>('WHATSAPP_TOKEN') && this.config.get<string>('WHATSAPP_PHONE_ID'),
    );
  }

  async send(to: string, text: string, template: string): Promise<DeliveryResult> {
    if (!this.configured) {
      this.logger.log(`[whatsapp:log] to=${to} template=${template}\n${text}`);
      return { delivered: false, providerRef: 'log' };
    }

    const phoneId = this.config.get<string>('WHATSAPP_PHONE_ID');
    const token = this.config.get<string>('WHATSAPP_TOKEN');
    const version = this.config.get<string>('WHATSAPP_API_VERSION') ?? 'v21.0';
    const templateName = this.config.get<string>('WHATSAPP_TEMPLATE_NAME');

    const body = templateName
      ? {
          messaging_product: 'whatsapp',
          to,
          type: 'template',
          template: {
            name: templateName,
            language: { code: this.config.get<string>('WHATSAPP_TEMPLATE_LANG') ?? 'en' },
            components: [
              {
                type: 'body',
                parameters: [{ type: 'text', text }],
              },
            ],
          },
        }
      : {
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { preview_url: false, body: text },
        };

    const response = await fetch(`https://graph.facebook.com/${version}/${phoneId}/messages`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });

    const payload = (await response.json().catch(() => null)) as
      | { messages?: { id?: string }[]; error?: { message?: string } }
      | null;

    if (!response.ok) {
      throw new Error(payload?.error?.message ?? `WhatsApp returned ${response.status}`);
    }

    return { delivered: true, providerRef: payload?.messages?.[0]?.id };
  }
}
