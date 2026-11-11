import {
  ConflictException,
  GoneException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { DB, type Database } from '../../db/database.module';
import { bookings, customers, quotes, zones } from '../../db/schema';
import { bookingRef, normaliseGhanaPhone } from '../../common/refs';
import { QuotesService } from '../quotes/quotes.service';
import type { CreateBookingInput } from './bookings.dto';

/** Transfers are quoted as a block of time, not a hard arrival estimate. */
const TRANSFER_BLOCK_MINUTES = 90;

export interface BookingView {
  ref: string;
  status: string;
  product: string;
  currency: string;
  pickup: string;
  dropoff: string;
  startsAt: string;
  endsAt: string;
  passengers: number;
  bags: number;
  flightNumber: string | null;
  subtotalPesewas: number;
  discountPesewas: number;
  totalPesewas: number;
  depositDuePesewas: number;
  paidPesewas: number;
  balancePesewas: number;
  payment: { status: 'unpaid'; channel: string };
  createdAt: string;
}

@Injectable()
export class BookingsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(QuotesService) private readonly quotes: QuotesService,
  ) {}

  async create(input: CreateBookingInput): Promise<BookingView> {
    const phone = normaliseGhanaPhone(input.customer.phone);
    if (!phone) {
      throw new UnprocessableEntityException({
        code: 'PHONE_INVALID',
        message: 'Enter a Ghana mobile number, e.g. 024 123 4567',
      });
    }

    const quote = await this.quotes.findByToken(input.quoteToken);

    if (quote.product !== 'chauffeur_transfer') {
      throw new UnprocessableEntityException({
        code: 'PRODUCT_NOT_SUPPORTED',
        message: 'Rental bookings are not open yet',
      });
    }

    const payload = quote.payload as {
      startsAt?: string;
      passengers?: number;
      bags?: number;
      flightNumber?: string | null;
      fromZoneSlug?: string;
      toZoneSlug?: string;
    };

    const startsAt = payload.startsAt ? new Date(payload.startsAt) : null;
    if (!startsAt || Number.isNaN(startsAt.getTime())) {
      throw new UnprocessableEntityException({ code: 'QUOTE_INVALID', message: 'Quote is incomplete' });
    }

    const [fromZone] = await this.db
      .select({ name: zones.name })
      .from(zones)
      .where(inArray(zones.slug, [payload.fromZoneSlug ?? '']))
      .limit(1);

    const [toZone] = await this.db
      .select({ name: zones.name })
      .from(zones)
      .where(inArray(zones.slug, [payload.toZoneSlug ?? '']))
      .limit(1);

    const pickupLabel = fromZone?.name ?? payload.fromZoneSlug ?? 'Pick-up';
    const dropoffLabel = toZone?.name ?? payload.toZoneSlug ?? 'Drop-off';
    const endsAt = new Date(startsAt.getTime() + TRANSFER_BLOCK_MINUTES * 60_000);
    const ref = bookingRef();

    try {
      return await this.db.transaction(async (tx) => {
        // Burn the quote first: if another request already used it, this is a
        // duplicate submission and must not create a second booking.
        const [claimedQuote] = await tx
          .update(quotes)
          .set({ consumedAt: new Date() })
          .where(and(eq(quotes.token, input.quoteToken), isNull(quotes.consumedAt)))
          .returning({ id: quotes.id });

        if (!claimedQuote) {
          throw new ConflictException({
            code: 'QUOTE_ALREADY_USED',
            message: 'This quote was already turned into a booking',
          });
        }

        const [customer] = await tx
          .insert(customers)
          .values({
            phone,
            name: input.customer.name,
            email: input.customer.email ?? null,
          })
          .onConflictDoUpdate({
            target: customers.phone,
            set: {
              name: sql`coalesce(${customers.name}, excluded.name)`,
              email: sql`coalesce(${customers.email}, excluded.email)`,
            },
          })
          .returning();

        if (!customer) throw new Error('Failed to upsert customer');

        const [booking] = await tx
          .insert(bookings)
          .values({
            ref,
            product: quote.product,
            status: 'pending',
            customerId: customer.id,
            quoteId: quote.id,
            startsAt,
            endsAt,
            pickupLabel,
            dropoffLabel,
            passengers: payload.passengers ?? 1,
            bags: payload.bags ?? 0,
            flightNumber: payload.flightNumber ?? null,
            subtotalPesewas: quote.subtotalPesewas,
            discountPesewas: quote.discountPesewas,
            totalPesewas: quote.totalPesewas,
            depositDuePesewas: quote.depositPesewas,
            paidPesewas: 0,
            notes: input.notes ?? null,
          })
          .returning();

        if (!booking) throw new Error('Failed to create booking');

        return this.toView(booking, input.paymentChannel);
      });
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      if (isUniqueViolation(error)) {
        throw new ConflictException({
          code: 'BOOKING_CONFLICT',
          message: 'Booking could not be created, please retry',
        });
      }
      throw error;
    }
  }

  async getByRef(ref: string): Promise<BookingView> {
    const [booking] = await this.db.select().from(bookings).where(eq(bookings.ref, ref)).limit(1);

    if (!booking) {
      throw new NotFoundException({ code: 'BOOKING_NOT_FOUND', message: 'Booking not found' });
    }

    return this.toView(booking);
  }

  async cancelByRef(ref: string): Promise<BookingView> {
    const [booking] = await this.db
      .update(bookings)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(and(eq(bookings.ref, ref), inArray(bookings.status, ['pending', 'deposit_paid'])))
      .returning();

    if (!booking) {
      const existing = await this.db.select().from(bookings).where(eq(bookings.ref, ref)).limit(1);
      if (!existing[0]) {
        throw new NotFoundException({ code: 'BOOKING_NOT_FOUND', message: 'Booking not found' });
      }
      throw new GoneException({
        code: 'BOOKING_NOT_CANCELLABLE',
        message: 'This booking can no longer be cancelled online',
      });
    }

    return this.toView(booking);
  }

  private toView(
    booking: typeof bookings.$inferSelect,
    channel = 'mobile_money',
  ): BookingView {
    return {
      ref: booking.ref,
      status: booking.status,
      product: booking.product,
      currency: booking.currency,
      pickup: booking.pickupLabel,
      dropoff: booking.dropoffLabel,
      startsAt: booking.startsAt.toISOString(),
      endsAt: booking.endsAt.toISOString(),
      passengers: booking.passengers,
      bags: booking.bags,
      flightNumber: booking.flightNumber,
      subtotalPesewas: booking.subtotalPesewas,
      discountPesewas: booking.discountPesewas,
      totalPesewas: booking.totalPesewas,
      depositDuePesewas: booking.depositDuePesewas,
      paidPesewas: booking.paidPesewas,
      balancePesewas: booking.totalPesewas - booking.paidPesewas,
      payment: { status: 'unpaid', channel },
      createdAt: booking.createdAt.toISOString(),
    };
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === '23505'
  );
}
