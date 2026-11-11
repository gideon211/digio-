import { Inject, Injectable } from '@nestjs/common';
import { and, asc, count, eq } from 'drizzle-orm';
import { DB, type Database } from '../../db/database.module';
import { vehicleClasses, vehicles, zones } from '../../db/schema';
import { CHAUFFEUR_EXTRAS } from '../pricing/extras';

export interface VehicleClassView {
  slug: string;
  name: string;
  description: string;
  seats: number;
  bags: number;
  multiplier: number;
  availableVehicles: number;
}

@Injectable()
export class CatalogService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async vehicleClasses(): Promise<VehicleClassView[]> {
    const [classes, availability] = await Promise.all([
      this.db
        .select()
        .from(vehicleClasses)
        .orderBy(asc(vehicleClasses.sortOrder), asc(vehicleClasses.name)),
      this.db
        .select({ classId: vehicles.classId, available: count() })
        .from(vehicles)
        .where(eq(vehicles.status, 'available'))
        .groupBy(vehicles.classId),
    ]);

    const availableById = new Map(availability.map((row) => [row.classId, Number(row.available)]));

    return classes.map((vehicleClass) => ({
      slug: vehicleClass.slug,
      name: vehicleClass.name,
      description: vehicleClass.description,
      seats: vehicleClass.seats,
      bags: vehicleClass.bags,
      multiplier: Number(vehicleClass.multiplier),
      availableVehicles: availableById.get(vehicleClass.id) ?? 0,
    }));
  }

  async activeZones(): Promise<
    { slug: string; name: string; airport: boolean; sortOrder: number }[]
  > {
    return this.db
      .select({
        slug: zones.slug,
        name: zones.name,
        airport: zones.airport,
        sortOrder: zones.sortOrder,
      })
      .from(zones)
      .where(and(eq(zones.active, true)))
      .orderBy(asc(zones.sortOrder), asc(zones.name));
  }

  extras(): { code: string; label: string; pricePesewas: number }[] {
    return Object.entries(CHAUFFEUR_EXTRAS).map(([code, extra]) => ({
      code,
      label: extra.label,
      pricePesewas: extra.pricePesewas,
    }));
  }
}
