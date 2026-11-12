import { Inject, Injectable } from '@nestjs/common';
import { and, asc, count, eq, sql } from 'drizzle-orm';
import { type Database, DB } from '../../db/database.module';
import { vehicleClasses, vehicles, zonePairs, zones } from '../../db/schema';
import { CHAUFFEUR_EXTRAS } from '../pricing/extras';
import { RENTAL_EXTRAS } from '../pricing/rental-extras';
import { quoteChauffeur } from '../pricing/quote-engine';

/** One destination in the published airport price list. */
export interface SampleFare {
  zoneSlug: string;
  zone: string;
  prices: { classSlug: string; className: string; pricePesewas: number }[];
}

export interface VehicleClassView {
  slug: string;
  name: string;
  description: string;
  seats: number;
  bags: number;
  multiplier: number;
  /** Cheapest self-drive day rate in this class; 0 when no car is priced. */
  dailyRateFromPesewas: number;
  chauffeurDayRatePesewas: number;
  securityDepositPesewas: number;
  availableVehicles: number;
}

@Injectable()
export class CatalogService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async vehicleClasses(): Promise<VehicleClassView[]> {
    const [classes, availability, rates] = await Promise.all([
      this.db
        .select()
        .from(vehicleClasses)
        .orderBy(asc(vehicleClasses.sortOrder), asc(vehicleClasses.name)),
      this.db
        .select({ classId: vehicles.classId, available: count() })
        .from(vehicles)
        .where(eq(vehicles.status, 'available'))
        .groupBy(vehicles.classId),
      this.db
        .select({
          classId: vehicles.classId,
          cheapest: sql<number>`min(${vehicles.dailyRatePesewas})`,
        })
        .from(vehicles)
        .where(eq(vehicles.status, 'available'))
        .groupBy(vehicles.classId),
    ]);

    const availableById = new Map(availability.map((row) => [row.classId, Number(row.available)]));
    const rateById = new Map(rates.map((row) => [row.classId, Number(row.cheapest)]));

    return classes.map((vehicleClass) => ({
      slug: vehicleClass.slug,
      name: vehicleClass.name,
      description: vehicleClass.description,
      seats: vehicleClass.seats,
      bags: vehicleClass.bags,
      multiplier: Number(vehicleClass.multiplier),
      dailyRateFromPesewas: rateById.get(vehicleClass.id) ?? 0,
      chauffeurDayRatePesewas: vehicleClass.chauffeurDayRatePesewas,
      securityDepositPesewas: vehicleClass.securityDepositPesewas,
      availableVehicles: availableById.get(vehicleClass.id) ?? 0,
    }));
  }

  async activeZones(): Promise<
    { slug: string; name: string; airport: boolean; lat: number | null; lng: number | null; sortOrder: number }[]
  > {
    const rows = await this.db
      .select({
        slug: zones.slug,
        name: zones.name,
        airport: zones.airport,
        lat: zones.lat,
        lng: zones.lng,
        sortOrder: zones.sortOrder,
      })
      .from(zones)
      .where(and(eq(zones.active, true)))
      .orderBy(asc(zones.sortOrder), asc(zones.name));

    // numeric comes back as a string; the client wants numbers.
    return rows.map((row) => ({
      ...row,
      lat: row.lat === null ? null : Number(row.lat),
      lng: row.lng === null ? null : Number(row.lng),
    }));
  }

  extras(): { code: string; label: string; pricePesewas: number }[] {
    return Object.entries(CHAUFFEUR_EXTRAS).map(([code, extra]) => ({
      code,
      label: extra.label,
      pricePesewas: extra.pricePesewas,
    }));
  }

  /** Rental extras are quoted per day; the API multiplies by the rental length. */
  rentalExtras(): { code: string; label: string; dailyPesewas: number }[] {
    return Object.entries(RENTAL_EXTRAS).map(([code, extra]) => ({
      code,
      label: extra.label,
      dailyPesewas: extra.dailyPesewas,
    }));
  }

  /**
   * The published airport price list.
   *
   * Priced with the same pure engine the quote endpoint calls, from the same
   * zone-pair rows, so a fare printed on the homepage cannot drift from what a
   * booking actually charges. Multipliers are applied here rather than stored,
   * because the ladder lives in one place.
   */
  async airportFares(): Promise<{ from: string; routes: SampleFare[] }> {
    const [airport] = await this.db
      .select({ id: zones.id, name: zones.name })
      .from(zones)
      .where(and(eq(zones.airport, true), eq(zones.active, true)))
      .orderBy(asc(zones.sortOrder))
      .limit(1);

    if (!airport) return { from: 'Kotoka International Airport', routes: [] };

    const rows = await this.db
      .select({
        zoneId: zones.id,
        zoneSlug: zones.slug,
        zoneName: zones.name,
        classSlug: vehicleClasses.slug,
        className: vehicleClasses.name,
        multiplier: vehicleClasses.multiplier,
        base: zonePairs.pricePesewas,
      })
      .from(zonePairs)
      .innerJoin(zones, eq(zones.id, zonePairs.toZoneId))
      .innerJoin(vehicleClasses, eq(vehicleClasses.id, zonePairs.classId))
      .where(
        and(
          eq(zonePairs.fromZoneId, airport.id),
          eq(zonePairs.active, true),
          eq(zones.airport, false),
          eq(zones.active, true),
        ),
      )
      .orderBy(asc(zones.sortOrder), asc(vehicleClasses.sortOrder));

    const byZone = new Map<string, SampleFare>();

    for (const row of rows) {
      const route = byZone.get(row.zoneId) ?? {
        zoneSlug: row.zoneSlug,
        zone: row.zoneName,
        prices: [],
      };

      const totals = quoteChauffeur({
        basePricePesewas: row.base,
        multiplier: Number(row.multiplier),
        maxDiscountPercent: 25,
        depositPercent: 30,
      });

      route.prices.push({
        classSlug: row.classSlug,
        className: row.className,
        pricePesewas: totals.totalPesewas,
      });

      byZone.set(row.zoneId, route);
    }

    return { from: airport.name, routes: [...byZone.values()] };
  }
}
