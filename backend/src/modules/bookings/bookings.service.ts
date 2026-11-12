import {
  ConflictException,
  GoneException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { isExclusionViolation, isUniqueViolation } from '../../common/pg-errors';
import { bookingRef, normaliseGhanaPhone } from '../../common/refs';
import { type Database, DB } from '../../db/database.module';
import { bookings, customers, quotes, rentalPeriods, vehicles, zones } from '../../db/schema';
import { QuotesService } from '../quotes/quotes.service';
import { rentalWindow } from '../rentals/rentals.dto';
import type { CreateBookingInput } from './bookings.dto';

/** Transfers are quoted as a block of time, not a hard arrival estimate. */
const TRANSFER_BLOCK_MINUTES = 90;

/** Rentals start and end at the counter, 09:00 Accra time. */
const RENTAL_HANDOVER_HOUR_UTC = 9;

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
  payment: { status: PaymentState; channel: string };
  vehicle: { plate: string; description: string } | null;
  rental: {
    days: number;
    fromDate: string;
    toDate: string;
    deliveryFeePesewas: number;
    securityDepositPesewas: number;
  } | null;
  createdAt: string;
}

export type PaymentState = 'unpaid' | 'part_paid' | 'deposit_paid' | 'paid_in_full';

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
    const isRental = quote.product !== 'chauffeur_transfer';

    const payload = quote.payload as {
      startsAt?: string;
      passengers?: number;
      bags?: number;
      flightNumber?: string | null;
      fromZoneSlug?: string;
      toZoneSlug?: string;
      vehicleId?: string;
      fromDate?: string;
      toDate?: string;
      deliveryZoneName?: string | null;
      priceSnapshot?: {
        deliveryFeePesewas?: number;
        securityDepositPesewas?: number;
      };
    };

    const rentalDay = (date: string): Date =>
      new Date(`${date}T${String(RENTAL_HANDOVER_HOUR_UTC).padStart(2, '0')}:00:00Z`);

    let startsAt: Date;
    let endsAt: Date;
    let pickupLabel: string;
    let dropoffLabel: string;
    let vehicleId: string | null = null;
    let vehicleView: BookingView['vehicle'] = null;
    let rentalDays: number | null = null;
    let deliveryFeePesewas = 0;
    let securityDepositPesewas = 0;

    if (isRental) {
      if (!payload.fromDate || !payload.toDate || !payload.vehicleId) {
        throw new UnprocessableEntityException({
          code: 'QUOTE_INVALID',
          message: 'Quote is incomplete',
        });
      }

      const window = rentalWindow(payload.fromDate, payload.toDate);

      const [vehicle] = await this.db
        .select()
        .from(vehicles)
        .where(eq(vehicles.id, payload.vehicleId))
        .limit(1);

      if (!vehicle) {
        throw new UnprocessableEntityException({
          code: 'QUOTE_INVALID',
          message: 'The quoted vehicle no longer exists',
        });
      }

      if (vehicle.status !== 'available') {
        throw new ConflictException({
          code: 'VEHICLE_UNAVAILABLE',
          message: 'That car is no longer available — request a fresh quote',
        });
      }

      startsAt = rentalDay(window.fromDate);
      endsAt = rentalDay(window.toDate);

      const place = payload.deliveryZoneName
        ? `${payload.deliveryZoneName} (delivered)`
        : 'Digio garage, Accra';
      pickupLabel = place;
      dropoffLabel = place;
      vehicleId = vehicle.id;
      vehicleView = { plate: vehicle.plate, description: describeVehicle(vehicle) };
      rentalDays = window.days;
      deliveryFeePesewas = Number(payload.priceSnapshot?.deliveryFeePesewas ?? 0);
      securityDepositPesewas = Number(payload.priceSnapshot?.securityDepositPesewas ?? 0);
    } else {
      const transferStart = payload.startsAt ? new Date(payload.startsAt) : null;
      if (!transferStart || Number.isNaN(transferStart.getTime())) {
        throw new UnprocessableEntityException({
          code: 'QUOTE_INVALID',
          message: 'Quote is incomplete',
        });
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

      startsAt = transferStart;
      endsAt = new Date(transferStart.getTime() + TRANSFER_BLOCK_MINUTES * 60_000);
      pickupLabel = fromZone?.name ?? payload.fromZoneSlug ?? 'Pick-up';
      dropoffLabel = toZone?.name ?? payload.toZoneSlug ?? 'Drop-off';
    }

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
            vehicleId,
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
            rentalDays,
            deliveryFeePesewas,
            securityDepositPesewas,
            paidPesewas: 0,
            notes: input.notes ?? null,
          })
          .returning();

        if (!booking) throw new Error('Failed to create booking');

        if (vehicleId) {
          // The exclusion constraint — not this code — decides whether the
          // period is free. A conflict aborts the whole transaction.
          await tx.insert(rentalPeriods).values({
            vehicleId,
            bookingId: booking.id,
            period: sql`daterange(${payload.fromDate}::date, ${payload.toDate}::date, '[)')` as unknown as string,
          });
        }

        return this.toView(booking, input.paymentChannel, vehicleView);
      });
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      if (isExclusionViolation(error)) {
        throw new ConflictException({
          code: 'VEHICLE_UNAVAILABLE',
          message: 'That car was just taken for those dates — request a fresh quote',
        });
      }
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
    const [row] = await this.db
      .select({ booking: bookings, vehicle: vehicles })
      .from(bookings)
      .leftJoin(vehicles, eq(vehicles.id, bookings.vehicleId))
      .where(eq(bookings.ref, ref))
      .limit(1);

    if (!row) {
      throw new NotFoundException({ code: 'BOOKING_NOT_FOUND', message: 'Booking not found' });
    }

    return this.toView(row.booking, undefined, describeRowVehicle(row.vehicle));
  }

  async cancelByRef(ref: string): Promise<BookingView> {
    return this.db.transaction(async (tx) => {
      const [booking] = await tx
        .update(bookings)
        .set({ status: 'cancelled', updatedAt: new Date() })
        .where(and(eq(bookings.ref, ref), inArray(bookings.status, ['pending', 'deposit_paid'])))
        .returning();

      if (!booking) {
        const existing = await tx.select().from(bookings).where(eq(bookings.ref, ref)).limit(1);
        if (!existing[0]) {
          throw new NotFoundException({ code: 'BOOKING_NOT_FOUND', message: 'Booking not found' });
        }
        throw new GoneException({
          code: 'BOOKING_NOT_CANCELLABLE',
          message: 'This booking can no longer be cancelled online',
        });
      }

      // A cancelled rental must free the car again. Dropping the period row is
      // the only correct release: the exclusion constraint then stops seeing it.
      await tx.delete(rentalPeriods).where(eq(rentalPeriods.bookingId, booking.id));

      const [row] = await tx
        .select({ vehicle: vehicles })
        .from(vehicles)
        .where(eq(vehicles.id, booking.vehicleId ?? ''))
        .limit(1);

      return this.toView(booking, undefined, describeRowVehicle(row?.vehicle));
    });
  }

  private toView(
    booking: typeof bookings.$inferSelect,
    channel = 'mobile_money',
    vehicle?: BookingView['vehicle'],
  ): BookingView {
    const rental =
      booking.rentalDays !== null && booking.startsAt && booking.endsAt
        ? {
            days: booking.rentalDays,
            fromDate: booking.startsAt.toISOString().slice(0, 10),
            toDate: booking.endsAt.toISOString().slice(0, 10),
            deliveryFeePesewas: booking.deliveryFeePesewas,
            securityDepositPesewas: booking.securityDepositPesewas,
          }
        : null;

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
      payment: { status: paymentState(booking), channel },
      vehicle: vehicle ?? null,
      rental,
      createdAt: booking.createdAt.toISOString(),
    };
  }
}

type VehicleRow = typeof vehicles.$inferSelect;

function describeRowVehicle(vehicle: VehicleRow | null | undefined): BookingView['vehicle'] {
  if (!vehicle) return null;
  return { plate: vehicle.plate, description: describeVehicle(vehicle) };
}

/**
 * Derived, never stored: a booking's payment state is a function of what has
 * actually been collected. One source of truth, no drift between two columns.
 */
function paymentState(booking: typeof bookings.$inferSelect): PaymentState {
  if (booking.paidPesewas <= 0) return 'unpaid';
  if (booking.paidPesewas >= booking.totalPesewas) return 'paid_in_full';
  if (booking.paidPesewas >= booking.depositDuePesewas) return 'deposit_paid';
  return 'part_paid';
}

function describeVehicle(vehicle: VehicleRow): string {
  return `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
}
