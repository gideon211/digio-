import {
  ConflictException,
  GoneException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, desc, eq, gte, inArray } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import { DB, type Database } from '../../db/database.module';
import { bookings, customers, notificationOutbox, payments } from '../../db/schema';
import type { PaystackChargeEvent } from './paystack.gateway';
import { PaystackGateway } from './paystack.gateway';
import type { InitializePaymentInput } from './payments.dto';

/** An abandoned checkout is reusable for this long instead of creating a new one. */
const CHECKOUT_REUSE_MINUTES = 30;

/** Drizzle transaction handle, so outbox writes join the payment transaction. */
type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

/** WhatsApp is attempted immediately; SMS waits so it can act as a fallback. */
const SMS_FALLBACK_DELAY_SECONDS = 60;

export interface PaymentView {
  reference: string;
  bookingRef: string;
  kind: 'deposit' | 'balance';
  amountPesewas: number;
  currency: 'GHS';
  channel: string;
  status: string;
  authorizationUrl: string | null;
  simulated: boolean;
  paidAt: string | null;
  createdAt: string;
}

export interface InitializePaymentView extends PaymentView {
  email: string;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(PaystackGateway) private readonly paystack: PaystackGateway,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  get simulated(): boolean {
    return !this.paystack.enabled && this.config.get<string>('NODE_ENV') !== 'production';
  }

  async initialize(input: InitializePaymentInput): Promise<InitializePaymentView> {
    const [row] = await this.db
      .select({ booking: bookings, customer: customers })
      .from(bookings)
      .leftJoin(customers, eq(bookings.customerId, customers.id))
      .where(eq(bookings.ref, input.bookingRef))
      .limit(1);

    if (!row) {
      throw new NotFoundException({ code: 'BOOKING_NOT_FOUND', message: 'Booking not found' });
    }

    const { booking, customer } = row;

    if (booking.status === 'cancelled' || booking.status === 'expired') {
      throw new GoneException({
        code: 'BOOKING_NOT_PAYABLE',
        message: 'This booking is no longer open for payment',
      });
    }

    const amountPesewas = booking.depositDuePesewas - booking.paidPesewas;
    if (amountPesewas <= 0) {
      throw new ConflictException({
        code: 'NOTHING_TO_PAY',
        message: 'This booking has no outstanding deposit',
      });
    }

    const email =
      input.email ??
      customer?.email ??
      this.config.get<string>('PAYMENTS_FALLBACK_EMAIL') ??
      'bookings@digiogh.com';

    const reusable = await this.db
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.bookingId, booking.id),
          inArray(payments.status, ['initialized', 'pending']),
          eq(payments.amountPesewas, amountPesewas),
          gte(
            payments.createdAt,
            new Date(Date.now() - CHECKOUT_REUSE_MINUTES * 60_000),
          ),
        ),
      )
      .orderBy(desc(payments.createdAt))
      .limit(1);

    if (reusable[0]?.authorizationUrl) {
      return { ...this.toView(reusable[0], booking.ref), email };
    }

    if (!this.paystack.enabled && !this.simulated) {
      throw new ServiceUnavailableException({
        code: 'PAYMENTS_NOT_CONFIGURED',
        message: 'Card and mobile money payments are not available yet',
      });
    }

    const reference = `${booking.ref}-D-${randomBytes(4).toString('hex').toUpperCase()}`;
    const callbackUrl =
      input.callbackUrl ??
      this.config.get<string>('PAYSTACK_CALLBACK_URL') ??
      `${this.appUrl}/book/return`;

    const [created] = await this.db
      .insert(payments)
      .values({
        bookingId: booking.id,
        provider: 'paystack',
        providerRef: reference,
        kind: 'deposit',
        amountPesewas,
        channel: input.channel,
        status: 'initialized',
      })
      .returning();

    if (!created) throw new Error('Failed to create payment');

    if (this.simulated) {
      const apiPublicUrl =
        this.config.get<string>('API_PUBLIC_URL') ?? 'http://localhost:4000';

      const [updated] = await this.db
        .update(payments)
        .set({
          status: 'pending',
          accessCode: 'simulated',
          authorizationUrl: `${apiPublicUrl}/v1/payments/simulate/${reference}`,
          updatedAt: new Date(),
        })
        .where(eq(payments.id, created.id))
        .returning();

      return { ...this.toView(updated ?? created, booking.ref), email };
    }

    try {
      const checkout = await this.paystack.initialize({
        email,
        amountPesewas,
        reference,
        callbackUrl,
        metadata: {
          bookingRef: booking.ref,
          kind: 'deposit',
          pickup: booking.pickupLabel,
          dropoff: booking.dropoffLabel,
        },
      });

      const [updated] = await this.db
        .update(payments)
        .set({
          status: 'pending',
          accessCode: checkout.accessCode,
          authorizationUrl: checkout.authorizationUrl,
          updatedAt: new Date(),
        })
        .where(eq(payments.id, created.id))
        .returning();

      return { ...this.toView(updated ?? created, booking.ref), email };
    } catch (error) {
      await this.db
        .update(payments)
        .set({
          status: 'failed',
          failureReason: (error as Error).message,
          updatedAt: new Date(),
        })
        .where(eq(payments.id, created.id));
      throw error;
    }
  }

  async getByReference(reference: string): Promise<PaymentView> {
    const [row] = await this.db
      .select({ payment: payments, bookingRef: bookings.ref })
      .from(payments)
      .innerJoin(bookings, eq(payments.bookingId, bookings.id))
      .where(eq(payments.providerRef, reference))
      .limit(1);

    if (!row) {
      throw new NotFoundException({ code: 'PAYMENT_NOT_FOUND', message: 'Payment not found' });
    }

    return this.toView(row.payment, row.bookingRef);
  }

  async listForBooking(bookingRef: string): Promise<PaymentView[]> {
    const [booking] = await this.db
      .select({ id: bookings.id, ref: bookings.ref })
      .from(bookings)
      .where(eq(bookings.ref, bookingRef))
      .limit(1);

    if (!booking) {
      throw new NotFoundException({ code: 'BOOKING_NOT_FOUND', message: 'Booking not found' });
    }

    const rows = await this.db
      .select()
      .from(payments)
      .where(eq(payments.bookingId, booking.id))
      .orderBy(desc(payments.createdAt));

    return rows.map((row) => this.toView(row, booking.ref));
  }

  /**
   * Handles a verified Paystack `charge.success`.
   *
   * Idempotent by construction: the payment row is locked, and a row that is
   * already `succeeded` is returned untouched. Replaying the webhook therefore
   * cannot credit a booking twice or resend a confirmation.
   */
  async handleWebhook(event: PaystackChargeEvent): Promise<{ applied: boolean; reason: string }> {
    if (event.event !== 'charge.success') {
      return { applied: false, reason: `ignored:${event.event}` };
    }

    const reference = event.data?.reference;
    if (!reference) {
      return { applied: false, reason: 'missing_reference' };
    }

    return this.applySuccessfulPayment(reference, event.data as Record<string, unknown>);
  }

  async applySuccessfulPayment(
    reference: string,
    raw: Record<string, unknown>,
  ): Promise<{ applied: boolean; reason: string }> {
    return this.db.transaction(async (tx) => {
      const [payment] = await tx
        .select()
        .from(payments)
        .where(eq(payments.providerRef, reference))
        .for('update');

      if (!payment) {
        this.logger.warn(`Payment ${reference} not found for webhook`);
        return { applied: false, reason: 'unknown_reference' };
      }

      if (payment.status === 'succeeded') {
        return { applied: false, reason: 'already_processed' };
      }

      if (payment.status === 'refunded') {
        return { applied: false, reason: 'refunded' };
      }

      const chargedAmount = Number(raw.amount ?? payment.amountPesewas);
      if (Number.isFinite(chargedAmount) && chargedAmount !== payment.amountPesewas) {
        this.logger.error(
          `Amount mismatch for ${reference}: charged ${chargedAmount}, expected ${payment.amountPesewas}`,
        );
        return { applied: false, reason: 'amount_mismatch' };
      }

      const [booking] = await tx
        .select()
        .from(bookings)
        .where(eq(bookings.id, payment.bookingId))
        .for('update');

      if (!booking) {
        return { applied: false, reason: 'booking_missing' };
      }

      const paidAt = raw.paid_at ? new Date(String(raw.paid_at)) : new Date();

      await tx
        .update(payments)
        .set({
          status: 'succeeded',
          paidAt: Number.isNaN(paidAt.getTime()) ? new Date() : paidAt,
          raw,
          updatedAt: new Date(),
        })
        .where(eq(payments.id, payment.id));

      const paidPesewas = booking.paidPesewas + payment.amountPesewas;
      const fullyCoveredDeposit = paidPesewas >= booking.depositDuePesewas;

      const nextStatus =
        booking.status === 'cancelled' || booking.status === 'expired'
          ? booking.status
          : fullyCoveredDeposit && booking.status === 'pending'
            ? 'deposit_paid'
            : booking.status;

      await tx
        .update(bookings)
        .set({ paidPesewas, status: nextStatus, updatedAt: new Date() })
        .where(eq(bookings.id, booking.id));

      if (booking.status === 'cancelled') {
        this.logger.warn(`Payment ${reference} settled on cancelled booking ${booking.ref}`);
      }

      await this.enqueueConfirmation(tx, {
        bookingId: booking.id,
        bookingRef: booking.ref,
        paidPesewas,
        depositDuePesewas: booking.depositDuePesewas,
        totalPesewas: booking.totalPesewas,
        pickup: booking.pickupLabel,
        dropoff: booking.dropoffLabel,
        startsAt: booking.startsAt,
      });

      return { applied: true, reason: 'succeeded' };
    });
  }

  private async enqueueConfirmation(
    tx: Transaction,
    booking: {
      bookingId: string;
      bookingRef: string;
      paidPesewas: number;
      depositDuePesewas: number;
      totalPesewas: number;
      pickup: string;
      dropoff: string;
      startsAt: Date;
    },
  ): Promise<void> {
    const [customer] = await tx
      .select({ phone: customers.phone })
      .from(customers)
      .innerJoin(bookings, eq(bookings.customerId, customers.id))
      .where(eq(bookings.id, booking.bookingId))
      .limit(1);

    if (!customer?.phone) return;

    const payload = {
      ref: booking.bookingRef,
      pickup: booking.pickup,
      dropoff: booking.dropoff,
      startsAt: booking.startsAt.toISOString(),
      totalPesewas: booking.totalPesewas,
      paidPesewas: booking.paidPesewas,
      balancePesewas: Math.max(0, booking.totalPesewas - booking.paidPesewas),
      manageUrl: `${this.appUrl}/b/${booking.bookingRef}`,
    };

    const now = new Date();

    await tx
      .insert(notificationOutbox)
      .values([
        {
          bookingId: booking.bookingId,
          event: 'booking.confirmed',
          channel: 'whatsapp',
          recipient: customer.phone,
          template: 'booking_confirmed_v1',
          payload,
          nextAttemptAt: now,
        },
        {
          bookingId: booking.bookingId,
          event: 'booking.confirmed',
          channel: 'sms',
          recipient: customer.phone,
          template: 'booking_confirmed_v1',
          payload,
          // The delivery worker cancels this if WhatsApp lands first.
          nextAttemptAt: new Date(now.getTime() + SMS_FALLBACK_DELAY_SECONDS * 1000),
        },
      ])
      .onConflictDoNothing();
  }

  private get appUrl(): string {
    return this.config.get<string>('APP_URL') ?? 'http://localhost:3000';
  }

  private toView(
    payment: typeof payments.$inferSelect,
    bookingRef: string,
  ): PaymentView {
    return {
      reference: payment.providerRef,
      bookingRef,
      kind: payment.kind,
      amountPesewas: payment.amountPesewas,
      currency: 'GHS',
      channel: payment.channel,
      status: payment.status,
      authorizationUrl: payment.authorizationUrl,
      simulated: payment.accessCode === 'simulated',
      paidAt: payment.paidAt?.toISOString() ?? null,
      createdAt: payment.createdAt.toISOString(),
    };
  }
}
