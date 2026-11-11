import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { toPesewas } from '../common/money';
import {
  drivers,
  promos,
  vehicleClasses,
  vehicles,
  zonePairs,
  zones,
} from './schema';

/**
 * Seed data mirrors the prototype so the UI can be ported against real numbers.
 * Idempotent: safe to run repeatedly in development.
 */

const CLASSES = [
  { slug: 'sedan', name: 'Executive Sedan', seats: 3, bags: 2, multiplier: '1.00', sortOrder: 1, description: 'Toyota Camry or similar' },
  { slug: 'suv', name: 'Premium SUV', seats: 4, bags: 4, multiplier: '1.60', sortOrder: 2, description: 'Toyota Prado or similar' },
  { slug: 'van', name: 'Executive Van', seats: 7, bags: 6, multiplier: '2.10', sortOrder: 3, description: 'Toyota Hiace VIP or similar' },
] as const;

/** Fare from the prototype, in cedis, used as the airport ↔ zone price. */
const ZONES = [
  { slug: 'kotoka-airport', name: 'Kotoka International Airport', airport: true, fare: 0, lat: 5.6052, lng: -0.1668 },
  { slug: 'airport-city', name: 'Airport City', airport: false, fare: 45, lat: 5.6061, lng: -0.1745 },
  { slug: 'cantonments', name: 'Cantonments', airport: false, fare: 60, lat: 5.5757, lng: -0.1791 },
  { slug: 'labone', name: 'Labone', airport: false, fare: 75, lat: 5.5617, lng: -0.1781 },
  { slug: 'osu', name: 'Osu', airport: false, fare: 85, lat: 5.5569, lng: -0.1808 },
  { slug: 'labadi', name: 'Labadi', airport: false, fare: 90, lat: 5.5541, lng: -0.1746 },
  { slug: 'dzorwulu', name: 'Dzorwulu', airport: false, fare: 90, lat: 5.6123, lng: -0.1926 },
  { slug: 'east-legon', name: 'East Legon', airport: false, fare: 95, lat: 5.6357, lng: -0.1597 },
  { slug: 'ridge', name: 'Ridge', airport: false, fare: 100, lat: 5.5593, lng: -0.2003 },
  { slug: 'spintex', name: 'Spintex', airport: false, fare: 120, lat: 5.6200, lng: -0.1000 },
  { slug: 'tema-community-18', name: 'Tema (Community 18)', airport: false, fare: 160, lat: 5.6697, lng: -0.0166 },
] as const;

const VEHICLES = [
  { plate: 'GR 4821-24', classSlug: 'sedan', make: 'Toyota', model: 'Camry', year: 2024, color: 'black', dailyRate: 800, mileageCapKm: 200 },
  { plate: 'GN 2210-23', classSlug: 'sedan', make: 'Toyota', model: 'Camry', year: 2023, color: 'black', dailyRate: 750, mileageCapKm: 200 },
  { plate: 'GE 7734-24', classSlug: 'suv', make: 'Toyota', model: 'Prado', year: 2024, color: 'black', dailyRate: 1400, mileageCapKm: 250 },
  { plate: 'GW 5062-24', classSlug: 'suv', make: 'Toyota', model: 'Prado', year: 2024, color: 'white', dailyRate: 1400, mileageCapKm: 250 },
  { plate: 'GT 1198-23', classSlug: 'van', make: 'Toyota', model: 'Hiace VIP', year: 2023, color: 'black', dailyRate: 1600, mileageCapKm: 300 },
] as const;

const DRIVERS = [
  { name: 'Kwame Asante', phone: '+233551234567', rating: '4.97', languages: ['English', 'Twi'] },
  { name: 'Efua Mensah', phone: '+233551234568', rating: '4.94', languages: ['English', 'Ewe'] },
  { name: 'Yaw Boateng', phone: '+233551234569', rating: '4.91', languages: ['English', 'Twi'] },
  { name: 'Nana Kusi', phone: '+233551234570', rating: '4.89', languages: ['English', 'Fante'] },
  { name: 'Abena Owusu', phone: '+233551234571', rating: '4.99', languages: ['English', 'Twi', 'Ga'] },
] as const;

function roundToFiveCedis(cedis: number): number {
  return Math.round(cedis / 5) * 5;
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is required');

  const pool = new Pool({ connectionString, max: 1 });
  const db = drizzle(pool);

  try {
    await db.execute(sql`create extension if not exists postgis`);

    for (const vehicleClass of CLASSES) {
      await db
        .insert(vehicleClasses)
        .values(vehicleClass)
        .onConflictDoUpdate({
          target: vehicleClasses.slug,
          set: {
            name: vehicleClass.name,
            description: vehicleClass.description,
            seats: vehicleClass.seats,
            bags: vehicleClass.bags,
            multiplier: vehicleClass.multiplier,
            sortOrder: vehicleClass.sortOrder,
          },
        });
    }

    for (const [index, zone] of ZONES.entries()) {
      await db
        .insert(zones)
        .values({
          slug: zone.slug,
          name: zone.name,
          airport: zone.airport,
          lat: String(zone.lat),
          lng: String(zone.lng),
          sortOrder: index,
        })
        .onConflictDoUpdate({
          target: zones.slug,
          set: {
            name: zone.name,
            airport: zone.airport,
            lat: String(zone.lat),
            lng: String(zone.lng),
            sortOrder: index,
          },
        });
    }

    // The centroid column lives outside the Drizzle schema (PostGIS type).
    await db.execute(
      sql`update zones
          set centroid = ST_SetSRID(ST_MakePoint(lng::float8, lat::float8), 4326)::geography
          where lat is not null and lng is not null`,
    );

    const classRows = await db.select().from(vehicleClasses);
    const zoneRows = await db.select().from(zones);
    const classBySlug = new Map(classRows.map((row) => [row.slug, row]));
    const zoneBySlug = new Map(zoneRows.map((row) => [row.slug, row]));
    const airport = zoneBySlug.get('kotoka-airport');

    if (!airport) throw new Error('Airport zone missing from seed');

    for (const zone of ZONES) {
      if (zone.airport) continue;
      const cityZone = zoneBySlug.get(zone.slug);
      if (!cityZone) continue;

      for (const vehicleClass of CLASSES) {
        const classRow = classBySlug.get(vehicleClass.slug);
        if (!classRow) continue;
        const multiplier = Number(vehicleClass.multiplier);

        const pairs: { from: string; to: string; cedis: number }[] = [
          { from: airport.id, to: cityZone.id, cedis: zone.fare },
          { from: cityZone.id, to: airport.id, cedis: zone.fare },
        ];

        for (const pair of pairs) {
          await db
            .insert(zonePairs)
            .values({
              fromZoneId: pair.from,
              toZoneId: pair.to,
              classId: classRow.id,
              pricePesewas: toPesewas(roundToFiveCedis(pair.cedis * multiplier)),
            })
            .onConflictDoUpdate({
              target: [zonePairs.fromZoneId, zonePairs.toZoneId, zonePairs.classId],
              set: { pricePesewas: toPesewas(roundToFiveCedis(pair.cedis * multiplier)) },
            });
        }
      }
    }

    // City-to-city pairs, derived the same way the prototype estimated them.
    const cityZones = ZONES.filter((zone) => !zone.airport);
    for (const from of cityZones) {
      for (const to of cityZones) {
        if (from.slug === to.slug) continue;
        const fromRow = zoneBySlug.get(from.slug);
        const toRow = zoneBySlug.get(to.slug);
        if (!fromRow || !toRow) continue;

        const base = Math.max(50, Math.abs(from.fare - to.fare) * 1.2 + 40);

        for (const vehicleClass of CLASSES) {
          const classRow = classBySlug.get(vehicleClass.slug);
          if (!classRow) continue;
          const price = toPesewas(roundToFiveCedis(base * Number(vehicleClass.multiplier)));

          await db
            .insert(zonePairs)
            .values({ fromZoneId: fromRow.id, toZoneId: toRow.id, classId: classRow.id, pricePesewas: price })
            .onConflictDoUpdate({
              target: [zonePairs.fromZoneId, zonePairs.toZoneId, zonePairs.classId],
              set: { pricePesewas: price },
            });
        }
      }
    }

    for (const vehicle of VEHICLES) {
      const classRow = classBySlug.get(vehicle.classSlug);
      if (!classRow) continue;
      await db
        .insert(vehicles)
        .values({
          plate: vehicle.plate,
          classId: classRow.id,
          make: vehicle.make,
          model: vehicle.model,
          year: vehicle.year,
          color: vehicle.color,
          dailyRatePesewas: toPesewas(vehicle.dailyRate),
          mileageCapKm: vehicle.mileageCapKm,
        })
        .onConflictDoUpdate({
          target: vehicles.plate,
          set: {
            classId: classRow.id,
            make: vehicle.make,
            model: vehicle.model,
            year: vehicle.year,
            color: vehicle.color,
            dailyRatePesewas: toPesewas(vehicle.dailyRate),
            mileageCapKm: vehicle.mileageCapKm,
          },
        });
    }

    for (const driver of DRIVERS) {
      await db
        .insert(drivers)
        .values({ ...driver, languages: [...driver.languages] })
        .onConflictDoUpdate({
          target: drivers.phone,
          set: { name: driver.name, rating: driver.rating, languages: [...driver.languages] },
        });
    }

    await db
      .insert(promos)
      .values({ code: 'AKWAABA10', type: 'percent', value: 10, maxDiscountPesewas: toPesewas(200) })
      .onConflictDoUpdate({
        target: promos.code,
        set: { type: 'percent', value: 10, maxDiscountPesewas: toPesewas(200), active: true },
      });

    const [counts] = await db
      .select({
        zones: sql<number>`(select count(*)::int from zones)`,
        classes: sql<number>`(select count(*)::int from vehicle_classes)`,
        pairs: sql<number>`(select count(*)::int from zone_pairs)`,
        vehicles: sql<number>`(select count(*)::int from vehicles)`,
        drivers: sql<number>`(select count(*)::int from drivers)`,
      })
      .from(sql`(select 1) as t`);

    // eslint-disable-next-line no-console
    console.log('Seed complete:', counts);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Seed failed', error);
  process.exit(1);
});
