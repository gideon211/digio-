import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  GoneException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, asc, count, eq, gt, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import { type Database, DB } from '../../db/database.module';
import { promos, quotes, vehicleClasses, vehicles, zonePairs, zones } from '../../db/schema';
import { CHAUFFEUR_EXTRAS } from '../pricing/extras';
import {
  type DiscountInput,
  type ExtraInput,
  type LineItem,
  quoteChauffeur,
  quoteRental,
} from '../pricing/quote-engine';
import { DELIVERY_FEE_PESEWAS, RENTAL_EXTRAS } from '../pricing/rental-extras';
import { type CreateRentalQuoteInput, rentalWindow } from '../rentals/rentals.dto';
import { RentalsService } from '../rentals/rentals.service';
import type { CompareTransfersInput, CreateChauffeurQuoteInput } from './quotes.dto';

export interface RentalQuoteDetails {
  vehiclePlate: string;
  vehicleDescription: string;
  fromDate: string;
  toDate: string;
  days: number;
  securityDepositPesewas: number;
}

export interface QuoteView {
  token: string;
  product: string;
  currency: 'GHS';
  expiresAt: string;
  route: { from: string; to: string; vehicleClass: string };
  lineItems: LineItem[];
  subtotalPesewas: number;
  discountPesewas: number;
  totalPesewas: number;
  depositPesewas: number;
  balancePesewas: number;
  /** Present for self-drive and chauffeur day hire. */
  rental?: RentalQuoteDetails;
  request: Record<string, unknown>;
}

/** One class priced on a route. No token — nothing is reserved by browsing. */
export interface TransferPrice {
  classSlug: string;
  name: string;
  description: string;
  seats: number;
  bags: number;
  availableVehicles: number;
  subtotalPesewas: number;
  discountPesewas: number;
  totalPesewas: number;
  depositPesewas: number;
  balancePesewas: number;
  lineItems: LineItem[];
}

@Injectable()
export class QuotesService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(RentalsService) private readonly rentals: RentalsService,
  ) {}

  async createChauffeurQuote(input: CreateChauffeurQuoteInput): Promise<QuoteView> {
    const [vehicleClass] = await this.db
      .select()
      .from(vehicleClasses)
      .where(eq(vehicleClasses.slug, input.classSlug))
      .limit(1);

    if (!vehicleClass) {
      throw new NotFoundException({ code: 'VEHICLE_CLASS_NOT_FOUND', message: 'Unknown vehicle class' });
    }

    if (input.passengers > vehicleClass.seats) {
      throw new UnprocessableEntityException({
        code: 'VEHICLE_TOO_SMALL',
        message: `${vehicleClass.name} seats ${vehicleClass.seats} passengers`,
      });
    }

    const [fromZone] = await this.db
      .select()
      .from(zones)
      .where(and(eq(zones.slug, input.fromZoneSlug), eq(zones.active, true)))
      .limit(1);

    const [toZone] = await this.db
      .select()
      .from(zones)
      .where(and(eq(zones.slug, input.toZoneSlug), eq(zones.active, true)))
      .limit(1);

    if (!fromZone || !toZone) {
      throw new NotFoundException({ code: 'ZONE_NOT_FOUND', message: 'Unknown pick-up or drop-off area' });
    }

    const [pair] = await this.db
      .select()
      .from(zonePairs)
      .where(
        and(
          eq(zonePairs.fromZoneId, fromZone.id),
          eq(zonePairs.toZoneId, toZone.id),
          eq(zonePairs.classId, vehicleClass.id),
          eq(zonePairs.active, true),
        ),
      )
      .limit(1);

    if (!pair) {
      throw new NotFoundException({
        code: 'ZONE_PAIR_UNAVAILABLE',
        message: 'No fixed price for this route yet — request a quote',
      });
    }

    const extras: ExtraInput[] = input.extras.map((code) => ({
      code,
      label: CHAUFFEUR_EXTRAS[code].label,
      pricePesewas: CHAUFFEUR_EXTRAS[code].pricePesewas,
    }));

    const discounts: DiscountInput[] = [];

    if (input.promoCode) {
      const promo = await this.resolvePromo(input.promoCode, pair.pricePesewas);
      discounts.push({
        code: promo.code,
        label: `Promo ${promo.code}`,
        type: promo.type,
        value: promo.value,
        maxDiscountPesewas: promo.maxDiscountPesewas ?? undefined,
      });
    }

    if (input.membershipPercent > 0) {
      discounts.push({
        code: 'membership',
        label: 'Vesper member',
        type: 'percent',
        value: input.membershipPercent,
      });
    }

    const totals = quoteChauffeur({
      basePricePesewas: pair.pricePesewas,
      multiplier: Number(vehicleClass.multiplier),
      extras,
      discounts,
      maxDiscountPercent: 25,
      depositPercent: 30,
    });

    const ttlMinutes = this.config.get<number>('QUOTE_TTL_MINUTES') ?? 15;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlMinutes * 60_000);
    const token = randomUUID();

    const request = {
      classSlug: input.classSlug,
      fromZoneSlug: input.fromZoneSlug,
      toZoneSlug: input.toZoneSlug,
      passengers: input.passengers,
      bags: input.bags,
      startsAt: input.startsAt.toISOString(),
      flightNumber: input.flightNumber ?? null,
      extras: input.extras,
      promoCode: input.promoCode ?? null,
      membershipPercent: input.membershipPercent,
      priceSnapshot: {
        fromZoneId: fromZone.id,
        toZoneId: toZone.id,
        classId: vehicleClass.id,
        basePricePesewas: pair.pricePesewas,
        multiplier: Number(vehicleClass.multiplier),
      },
    };

    const [row] = await this.db
      .insert(quotes)
      .values({
        token,
        product: 'chauffeur_transfer',
        payload: request,
        breakdown: { lineItems: totals.lineItems },
        subtotalPesewas: totals.subtotalPesewas,
        discountPesewas: totals.discountPesewas,
        totalPesewas: totals.totalPesewas,
        depositPesewas: totals.depositPesewas,
        expiresAt,
      })
      .returning();

    if (!row) {
      throw new Error('Failed to persist quote');
    }

    return this.toView(row, {
      from: fromZone.name,
      to: toZone.name,
      vehicleClass: vehicleClass.name,
    });
  }

  /**
   * Prices every class on one route without writing a quote.
   *
   * The "choose your car" step needs all three prices at once, but issuing
   * three tokens would reserve nothing and burn three rows. This runs the same
   * pure engine with the same inputs the real quote will use, so the number
   * shown here and the number on the issued quote never disagree.
   */
  async compareTransfers(input: CompareTransfersInput): Promise<TransferPrice[]> {
    const [fromResult, toResult] = await Promise.all([
      this.db
        .select()
        .from(zones)
        .where(and(eq(zones.slug, input.fromZoneSlug), eq(zones.active, true)))
        .limit(1),
      this.db
        .select()
        .from(zones)
        .where(and(eq(zones.slug, input.toZoneSlug), eq(zones.active, true)))
        .limit(1),
    ]);

    const fromZone = fromResult[0];
    const toZone = toResult[0];

    if (!fromZone || !toZone) {
      throw new NotFoundException({
        code: 'ZONE_NOT_FOUND',
        message: 'Unknown pick-up or drop-off area',
      });
    }

    const classes = await this.db
      .select()
      .from(vehicleClasses)
      .orderBy(asc(vehicleClasses.sortOrder), asc(vehicleClasses.name));

    const classIds = classes.map((vehicleClass) => vehicleClass.id);
    if (classIds.length === 0) return [];

    const [pairs, availability] = await Promise.all([
      this.db
        .select()
        .from(zonePairs)
        .where(
          and(
            eq(zonePairs.fromZoneId, fromZone.id),
            eq(zonePairs.toZoneId, toZone.id),
            eq(zonePairs.active, true),
            inArray(zonePairs.classId, classIds),
          ),
        ),
      this.db
        .select({ classId: vehicles.classId, total: count() })
        .from(vehicles)
        .where(eq(vehicles.status, 'available'))
        .groupBy(vehicles.classId),
    ]);

    const pairByClass = new Map(pairs.map((pair) => [pair.classId, pair]));
    const availableByClass = new Map(
      availability.map((row) => [row.classId, Number(row.total)]),
    );

    const extras: ExtraInput[] = input.extras.map((code) => ({
      code,
      label: CHAUFFEUR_EXTRAS[code].label,
      pricePesewas: CHAUFFEUR_EXTRAS[code].pricePesewas,
    }));

    const prices: TransferPrice[] = [];

    for (const vehicleClass of classes) {
      const pair = pairByClass.get(vehicleClass.id);
      if (!pair) continue;

      const discounts: DiscountInput[] = [];

      if (input.promoCode) {
        const promo = await this.resolvePromo(input.promoCode, pair.pricePesewas);
        discounts.push({
          code: promo.code,
          label: `Promo ${promo.code}`,
          type: promo.type,
          value: promo.value,
          maxDiscountPesewas: promo.maxDiscountPesewas ?? undefined,
        });
      }

      if (input.membershipPercent > 0) {
        discounts.push({
          code: 'membership',
          label: 'Vesper member',
          type: 'percent',
          value: input.membershipPercent,
        });
      }

      const totals = quoteChauffeur({
        basePricePesewas: pair.pricePesewas,
        multiplier: Number(vehicleClass.multiplier),
        extras,
        discounts,
        maxDiscountPercent: 25,
        depositPercent: 30,
      });

      prices.push({
        classSlug: vehicleClass.slug,
        name: vehicleClass.name,
        description: vehicleClass.description,
        seats: vehicleClass.seats,
        bags: vehicleClass.bags,
        availableVehicles: availableByClass.get(vehicleClass.id) ?? 0,
        subtotalPesewas: totals.subtotalPesewas,
        discountPesewas: totals.discountPesewas,
        totalPesewas: totals.totalPesewas,
        depositPesewas: totals.depositPesewas,
        balancePesewas: totals.balancePesewas,
        lineItems: totals.lineItems,
      });
    }

    return prices;
  }

  /**
   * Self-drive and chauffeur day hire.
   *
   * A quote pins a specific vehicle, not a class: the rate comes from that car
   * and the reservation is made against it. If it is taken by the time the
   * customer pays, the booking fails loudly instead of silently swapping cars.
   */
  async createRentalQuote(input: CreateRentalQuoteInput): Promise<QuoteView> {
    const window = rentalWindow(input.fromDate, input.toDate);

    const vehicleClass = await this.rentals.findClass(input.classSlug);
    if (!vehicleClass) {
      throw new NotFoundException({
        code: 'VEHICLE_CLASS_NOT_FOUND',
        message: 'Unknown vehicle class',
      });
    }

    const available = await this.rentals.availableVehicles(
      input.classSlug,
      window.fromDate,
      window.toDate,
    );

    if (available.length === 0) {
      throw new ConflictException({
        code: 'VEHICLE_UNAVAILABLE',
        message: `${vehicleClass.name} is fully booked for those dates`,
      });
    }

    const vehicle = available[0];
    if (!vehicle) {
      throw new ConflictException({
        code: 'VEHICLE_UNAVAILABLE',
        message: `${vehicleClass.name} is fully booked for those dates`,
      });
    }

    const isSelfDrive = input.product === 'self_drive';
    const dailyRatePesewas = isSelfDrive
      ? vehicle.dailyRatePesewas
      : vehicleClass.chauffeurDayRatePesewas;

    if (dailyRatePesewas <= 0) {
      throw new UnprocessableEntityException({
        code: 'RATE_NOT_SET',
        message: 'This class is not available for online booking yet',
      });
    }

    const extras: ExtraInput[] = input.extras.map((code) => ({
      code,
      label: `${RENTAL_EXTRAS[code as keyof typeof RENTAL_EXTRAS].label} × ${window.days} day${
        window.days === 1 ? '' : 's'
      }`,
      pricePesewas: RENTAL_EXTRAS[code as keyof typeof RENTAL_EXTRAS].dailyPesewas * window.days,
    }));

    const deliveryFeePesewas = input.deliveryZoneSlug ? DELIVERY_FEE_PESEWAS : 0;

    let deliveryZoneName: string | null = null;
    if (input.deliveryZoneSlug) {
      const [zone] = await this.db
        .select({ name: zones.name })
        .from(zones)
        .where(and(eq(zones.slug, input.deliveryZoneSlug), eq(zones.active, true)))
        .limit(1);

      if (!zone) {
        throw new NotFoundException({
          code: 'ZONE_NOT_FOUND',
          message: 'Unknown delivery area',
        });
      }
      deliveryZoneName = zone.name;
    }

    const subtotalPesewas =
      dailyRatePesewas * window.days +
      deliveryFeePesewas +
      extras.reduce((sum, extra) => sum + extra.pricePesewas, 0);

    const discounts: DiscountInput[] = [];
    if (input.promoCode) {
      const promo = await this.resolvePromo(input.promoCode, subtotalPesewas);
      discounts.push({
        code: promo.code,
        label: `Promo ${promo.code}`,
        type: promo.type,
        value: promo.value,
        maxDiscountPesewas: promo.maxDiscountPesewas ?? undefined,
      });
    }

    if (input.membershipPercent > 0) {
      discounts.push({
        code: 'membership',
        label: 'Vesper member',
        type: 'percent',
        value: input.membershipPercent,
      });
    }

    const securityDepositPesewas = isSelfDrive ? vehicleClass.securityDepositPesewas : 0;

    const totals = quoteRental({
      dailyRatePesewas,
      days: window.days,
      deliveryFeePesewas,
      extras,
      discounts,
      securityDepositPesewas,
      maxDiscountPercent: 25,
      depositPercent: 30,
    });

    const ttlMinutes = this.config.get<number>('QUOTE_TTL_MINUTES') ?? 15;
    const expiresAt = new Date(Date.now() + ttlMinutes * 60_000);
    const token = randomUUID();

    const request = {
      product: input.product,
      classSlug: input.classSlug,
      vehicleId: vehicle.id,
      vehiclePlate: vehicle.plate,
      fromDate: window.fromDate,
      toDate: window.toDate,
      days: window.days,
      deliveryZoneSlug: input.deliveryZoneSlug ?? null,
      deliveryZoneName,
      extras: input.extras,
      promoCode: input.promoCode ?? null,
      membershipPercent: input.membershipPercent,
      priceSnapshot: {
        classId: vehicleClass.id,
        vehicleId: vehicle.id,
        dailyRatePesewas,
        deliveryFeePesewas,
        securityDepositPesewas,
      },
    };

    const [row] = await this.db
      .insert(quotes)
      .values({
        token,
        product: input.product,
        payload: request,
        breakdown: { lineItems: totals.lineItems },
        subtotalPesewas: totals.subtotalPesewas,
        discountPesewas: totals.discountPesewas,
        totalPesewas: totals.totalPesewas,
        depositPesewas: totals.depositPesewas,
        securityDepositPesewas,
        expiresAt,
      })
      .returning();

    if (!row) throw new Error('Failed to persist quote');

    return this.toView(
      row,
      {
        from: deliveryZoneName ?? 'Digio garage, Accra',
        to: deliveryZoneName ?? 'Digio garage, Accra',
        vehicleClass: vehicleClass.name,
      },
      {
        vehiclePlate: vehicle.plate,
        vehicleDescription: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
        fromDate: window.fromDate,
        toDate: window.toDate,
        days: window.days,
        securityDepositPesewas,
      },
    );
  }

  async findByToken(token: string) {
    const [row] = await this.db.select().from(quotes).where(eq(quotes.token, token)).limit(1);

    if (!row) {
      throw new NotFoundException({ code: 'QUOTE_NOT_FOUND', message: 'Quote not found' });
    }
    if (row.expiresAt.getTime() <= Date.now()) {
      throw new GoneException({ code: 'QUOTE_EXPIRED', message: 'This quote has expired' });
    }
    return row;
  }

  async getByToken(token: string): Promise<QuoteView> {
    const row = await this.findByToken(token);
    const payload = row.payload as Record<string, unknown>;
    const breakdown = row.breakdown as { lineItems?: LineItem[] };

    const rental =
      row.product === 'chauffeur_transfer'
        ? undefined
        : {
            vehiclePlate: String(payload.vehiclePlate ?? ''),
            vehicleDescription: String(payload.vehicleDescription ?? ''),
            fromDate: String(payload.fromDate ?? ''),
            toDate: String(payload.toDate ?? ''),
            days: Number(payload.days ?? 0),
            securityDepositPesewas: row.securityDepositPesewas,
          };

    return {
      token: row.token,
      product: row.product,
      currency: 'GHS',
      expiresAt: row.expiresAt.toISOString(),
      route: {
        from: String(payload.fromZoneSlug ?? ''),
        to: String(payload.toZoneSlug ?? ''),
        vehicleClass: String(payload.classSlug ?? ''),
      },
      lineItems: breakdown.lineItems ?? [],
      subtotalPesewas: row.subtotalPesewas,
      discountPesewas: row.discountPesewas,
      totalPesewas: row.totalPesewas,
      depositPesewas: row.depositPesewas,
      balancePesewas: row.totalPesewas - row.depositPesewas,
      ...(rental
        ? {
            rental: {
              ...rental,
              vehicleDescription: rental.vehicleDescription || rental.vehiclePlate,
            },
          }
        : {}),
      request: payload,
    };
  }

  /** Atomically burns a quote. Returns false when it was already used. */
  async consume(token: string): Promise<boolean> {
    const [row] = await this.db
      .update(quotes)
      .set({ consumedAt: new Date() })
      .where(and(eq(quotes.token, token), isNull(quotes.consumedAt)))
      .returning({ id: quotes.id });

    return Boolean(row);
  }

  private async resolvePromo(code: string, subtotalPesewas: number) {
    const now = new Date();
    const [promo] = await this.db
      .select()
      .from(promos)
      .where(
        and(
          eq(promos.code, code),
          eq(promos.active, true),
          or(isNull(promos.validFrom), lte(promos.validFrom, now)),
          or(isNull(promos.validTo), gt(promos.validTo, now)),
        ),
      )
      .limit(1);

    if (!promo) {
      throw new BadRequestException({ code: 'PROMO_INVALID', message: 'Code not valid' });
    }
    if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) {
      throw new BadRequestException({ code: 'PROMO_EXHAUSTED', message: 'Code no longer available' });
    }
    if (subtotalPesewas < promo.minSubtotalPesewas) {
      throw new UnprocessableEntityException({
        code: 'PROMO_MINIMUM_NOT_MET',
        message: 'Booking total is below this code’s minimum',
      });
    }

    return promo;
  }

  private toView(
    row: typeof quotes.$inferSelect,
    route: { from: string; to: string; vehicleClass: string },
    rental?: RentalQuoteDetails,
  ): QuoteView {
    const breakdown = row.breakdown as { lineItems?: LineItem[] };
    return {
      token: row.token,
      product: row.product,
      currency: 'GHS',
      expiresAt: row.expiresAt.toISOString(),
      route,
      lineItems: breakdown.lineItems ?? [],
      subtotalPesewas: row.subtotalPesewas,
      discountPesewas: row.discountPesewas,
      totalPesewas: row.totalPesewas,
      depositPesewas: row.depositPesewas,
      balancePesewas: row.totalPesewas - row.depositPesewas,
      ...(rental ? { rental } : {}),
      request: row.payload,
    };
  }

  /** Exposed for ops tooling: count live quotes (used by health/diagnostics later). */
  async countActive(): Promise<number> {
    const result = await this.db
      .select({ value: sql<number>`count(*)::int` })
      .from(quotes)
      .where(and(isNull(quotes.consumedAt), gt(quotes.expiresAt, new Date())));
    return result[0]?.value ?? 0;
  }
}
