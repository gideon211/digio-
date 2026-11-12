import { Inject, Injectable } from '@nestjs/common';
import { asc, eq, sql } from 'drizzle-orm';
import { type Database, DB } from '../../db/database.module';
import { vehicleClasses } from '../../db/schema';

export interface AvailableVehicle {
  id: string;
  plate: string;
  make: string;
  model: string;
  year: number;
  color: string;
  dailyRatePesewas: number;
}

export interface ClassAvailability {
  slug: string;
  name: string;
  seats: number;
  bags: number;
  dailyRateFromPesewas: number;
  chauffeurDayRatePesewas: number;
  securityDepositPesewas: number;
  availableVehicles: number;
}

/**
 * Availability is answered by Postgres, not by an `if` statement. The same
 * `daterange && daterange` predicate that backs the exclusion constraint decides
 * what is free, so the query and the write agree by construction.
 */
@Injectable()
export class RentalsService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async availableVehicles(
    classSlug: string,
    fromDate: string,
    toDate: string,
  ): Promise<AvailableVehicle[]> {
    const result = await this.db.execute<{
      id: string;
      plate: string;
      make: string;
      model: string;
      year: number;
      color: string;
      daily_rate_pesewas: number;
    }>(sql`
      select v.id, v.plate, v.make, v.model, v.year, v.color, v.daily_rate_pesewas
      from vehicles v
      join vehicle_classes c on c.id = v.class_id
      where c.slug = ${classSlug}
        and v.status = 'available'
        and not exists (
          select 1 from rental_periods rp
          where rp.vehicle_id = v.id
            and rp.period && daterange(${fromDate}::date, ${toDate}::date, '[)')
        )
      order by v.daily_rate_pesewas asc, v.created_at asc
    `);

    return result.rows.map((row) => ({
      id: row.id,
      plate: row.plate,
      make: row.make,
      model: row.model,
      year: row.year,
      color: row.color,
      dailyRatePesewas: row.daily_rate_pesewas,
    }));
  }

  async classAvailability(fromDate: string, toDate: string): Promise<ClassAvailability[]> {
    const result = await this.db.execute<{
      slug: string;
      name: string;
      seats: number;
      bags: number;
      daily_rate_from_pesewas: number | null;
      chauffeur_day_rate_pesewas: number;
      security_deposit_pesewas: number;
      available_vehicles: number;
      sort_order: number;
    }>(sql`
      select c.slug, c.name, c.seats, c.bags, c.sort_order,
             c.chauffeur_day_rate_pesewas, c.security_deposit_pesewas,
             (select min(v2.daily_rate_pesewas) from vehicles v2 where v2.class_id = c.id) as daily_rate_from_pesewas,
             count(v.id)::int as available_vehicles
      from vehicle_classes c
      left join vehicles v
        on v.class_id = c.id
       and v.status = 'available'
       and not exists (
         select 1 from rental_periods rp
         where rp.vehicle_id = v.id
           and rp.period && daterange(${fromDate}::date, ${toDate}::date, '[)')
       )
      group by c.id
      order by c.sort_order asc, c.name asc
    `);

    return result.rows.map((row) => ({
      slug: row.slug,
      name: row.name,
      seats: row.seats,
      bags: row.bags,
      dailyRateFromPesewas: row.daily_rate_from_pesewas ?? 0,
      chauffeurDayRatePesewas: row.chauffeur_day_rate_pesewas,
      securityDepositPesewas: row.security_deposit_pesewas,
      availableVehicles: Number(row.available_vehicles),
    }));
  }

  async findClass(slug: string) {
    const [row] = await this.db
      .select()
      .from(vehicleClasses)
      .where(eq(vehicleClasses.slug, slug))
      .limit(1);

    return row ?? null;
  }

  /** Cheapest-first list, used by the catalog page. */
  async classesByPrice() {
    return this.db
      .select()
      .from(vehicleClasses)
      .orderBy(asc(vehicleClasses.sortOrder));
  }
}
