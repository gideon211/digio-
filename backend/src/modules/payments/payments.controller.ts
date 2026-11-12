import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Inject,
  Logger,
  NotFoundException,
  Param,
  Post,
  RawBodyRequest,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeEndpoint, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import {
  initializePaymentSchema,
  paymentReferenceSchema,
  type InitializePaymentInput,
} from './payments.dto';
import { PaymentsService } from './payments.service';
import { PaystackGateway, type PaystackChargeEvent } from './paystack.gateway';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(
    @Inject(PaymentsService) private readonly payments: PaymentsService,
    @Inject(PaystackGateway) private readonly paystack: PaystackGateway,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  @Post('initialize')
  @ApiOperation({
    summary: 'Start a deposit payment',
    description:
      'Creates (or reuses) a Paystack checkout for the outstanding deposit. Returns the ' +
      'authorization URL the client should open. The amount is always server-owned.',
  })
  initialize(@Body(new ZodValidationPipe(initializePaymentSchema)) body: InitializePaymentInput) {
    return this.payments.initialize(body);
  }

  @Get('booking/:bookingRef')
  @ApiOperation({ summary: 'List payments for a booking' })
  list(@Param('bookingRef') bookingRef: string) {
    return this.payments.listForBooking(bookingRef);
  }

  @Get(':reference')
  @ApiOperation({ summary: 'Poll a payment status' })
  get(@Param('reference', new ZodValidationPipe(paymentReferenceSchema)) reference: string) {
    return this.payments.getByReference(reference);
  }

  /**
   * Paystack signs the raw bytes, so the body must be read before any parser
   * touches it. Nest's `rawBody: true` keeps that copy available on the request.
   */
  @Post('webhook/paystack')
  @HttpCode(200)
  @ApiExcludeEndpoint()
  async webhook(
    @Req() request: RawBodyRequest<FastifyRequest>,
    @Headers('x-paystack-signature') signature?: string,
  ): Promise<{ status: string }> {
    const raw = request.rawBody;
    if (!raw || raw.length === 0) {
      throw new BadRequestException({
        code: 'EMPTY_BODY',
        message: 'Webhook body is required',
      });
    }

    if (!this.paystack.verifySignature(raw, signature)) {
      this.logger.warn('Rejected Paystack webhook with an invalid signature');
      throw new UnauthorizedException({
        code: 'INVALID_SIGNATURE',
        message: 'Signature verification failed',
      });
    }

    let event: PaystackChargeEvent;
    try {
      event = JSON.parse(raw.toString('utf8')) as PaystackChargeEvent;
    } catch {
      throw new BadRequestException({ code: 'INVALID_JSON', message: 'Malformed webhook body' });
    }

    const result = await this.payments.handleWebhook(event);
    this.logger.log(
      `Webhook ${event.event} ${event.data?.reference ?? ''} → ${result.reason}`,
    );

    // Always 200 once the signature is valid: a retry cannot change the outcome.
    return { status: 'ok' };
  }

  /**
   * Local checkout stand-in. Only exists when no Paystack key is configured and
   * the app is not running in production, so it can never take real money or
   * masquerade as a payment provider.
   */
  @Get('simulate/:reference')
  @ApiExcludeEndpoint()
  async simulatePage(
    @Param('reference', new ZodValidationPipe(paymentReferenceSchema)) reference: string,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    this.assertSimulated();
    const payment = await this.payments.getByReference(reference);

    const amount = new Intl.NumberFormat('en-GH', {
      style: 'currency',
      currency: 'GHS',
      minimumFractionDigits: 2,
    }).format(payment.amountPesewas / 100);

    await reply.type('text/html; charset=utf-8').send(simulateHtml(payment.bookingRef, amount, reference));
  }

  @Post('simulate/:reference')
  @ApiExcludeEndpoint()
  async simulatePay(
    @Param('reference', new ZodValidationPipe(paymentReferenceSchema)) reference: string,
  ): Promise<{ status: string; redirectUrl: string }> {
    this.assertSimulated();

    const result = await this.payments.applySuccessfulPayment(reference, {
      reference,
      amount: undefined,
      status: 'success',
      channel: 'mobile_money',
      paid_at: new Date().toISOString(),
      simulated: true,
    });

    const appUrl = this.config.get<string>('APP_URL') ?? 'http://localhost:3000';

    return {
      status: result.applied ? 'succeeded' : result.reason,
      redirectUrl: `${appUrl}/book/return?reference=${encodeURIComponent(reference)}`,
    };
  }

  private assertSimulated(): void {
    if (!this.payments.simulated) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Not found' });
    }
  }
}

function simulateHtml(bookingRef: string, amount: string, reference: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Digio · Simulated checkout</title>
  <style>
    :root { color-scheme: light; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center;
      background: #f7f6f2; color: #16211b;
      font: 15px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .card { width: min(92vw, 380px); background: #fff; border: 1px solid #d5dbd3;
      border-radius: 16px; padding: 24px; }
    .tag { font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: #9a6f1a; }
    h1 { font-size: 20px; margin: 8px 0 4px; }
    .amount { font-size: 34px; font-weight: 700; letter-spacing: -.02em; margin: 12px 0; }
    .meta { font-size: 13px; color: #5e6b63; }
    button { width: 100%; margin-top: 20px; min-height: 48px; border: 0; border-radius: 14px;
      background: #b8841f; color: #1b1403; font-size: 16px; font-weight: 600; cursor: pointer; }
    button:disabled { opacity: .6; cursor: progress; }
    .note { margin-top: 14px; font-size: 12px; color: #5e6b63; }
  </style>
</head>
<body>
  <div class="card">
    <div class="tag">Simulated checkout</div>
    <h1>Deposit for ${escapeHtml(bookingRef)}</h1>
    <div class="amount">${escapeHtml(amount)}</div>
    <div class="meta">No Paystack key is configured, so this page marks the payment as paid locally. Nothing is charged.</div>
    <button id="pay">Pay ${escapeHtml(amount)}</button>
    <p class="note" id="note">Reference ${escapeHtml(reference)}</p>
  </div>
  <script>
    const button = document.getElementById('pay');
    button.addEventListener('click', async () => {
      button.disabled = true;
      button.textContent = 'Processing…';
      try {
        const response = await fetch(location.pathname, { method: 'POST' });
        const body = await response.json();
        location.href = body.redirectUrl;
      } catch (error) {
        button.disabled = false;
        button.textContent = 'Try again';
        document.getElementById('note').textContent = 'Could not complete the simulation.';
      }
    });
  </script>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
