import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, asc, desc, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import { type Database, DB } from '../../db/database.module';
import { bookings, driverLocations, drivers, tripPositions, vehicles, zones } from '../../db/schema';
import {
  bearing,
  cumulativeLengths,
  decimate,
  interpolate,
  type LngLat,
  nearestIndex,
  projectOnRoute,
  roundLngLat,
  straightLine,
} from './geometry';

export type TrackingPhase =
  | 'awaiting_driver'
  | 'to_pickup'
  | 'arrived'
  | 'on_trip'
  | 'completed'
  | 'cancelled';

export interface TrackingDriver {
  id: string;
  name: string;
  rating: number;
  vehicle: string;
  plate: string;
  initials: string;
}

export interface TrackingPosition {
  lat: number;
  lng: number;
  heading: number;
  speedKph: number;
  updatedAt: string;
}

/** The contract the web/app frontends are built against. */
export interface TrackingView {
  ref: string;
  status: string;
  phase: TrackingPhase;
  pickup: { label: string; lat: number | null; lng: number | null };
  dropoff: { label: string; lat: number | null; lng: number | null };
  route: { coordinates: [number, number][] };
  driver: TrackingDriver | null;
  position: TrackingPosition | null;
  etaSeconds: number | null;
  distanceMetres: number | null;
  updatedAt: string;
}

export interface NearbyDriver {
  id: string;
  name: string;
  lat: number;
  lng: number;
  distanceMetres: number;
  heading: number;
}

/** Realistic average for Accra city traffic; the simulator jitters around it. */
const AVERAGE_SPEED_KPH = 35;
const SIMULATION_INTERVAL_MS = 2000;
/** A gap between ticks (restart, laptop sleep) must not teleport the car. */
const MAX_TICK_GAP_SECONDS = 15;
const ARRIVAL_RADIUS_METRES = 25;
/** OSRM polylines are denser than a map needs; one row every ~25 m. */
const ROUTE_MIN_SPACING_METRES = 25;
const OSRM_TIMEOUT_MS = 5_000;
const NEARBY_LIMIT = 25;
const ACTIVE_TRIP_LIMIT = 100;

const ACTIVE_STATUSES = ['assigned', 'in_progress'] as const;
const TERMINAL_STATUSES = new Set(['completed', 'cancelled', 'expired']);

type BookingRow = typeof bookings.$inferSelect;

/** The database handle, or the transaction handle inside `db.transaction`. */
type DbOrTx = Database | Parameters<Parameters<Database['transaction']>[0]>[0];

interface ActiveTrip {
  id: string;
  ref: string;
  driverId: string | null;
  status: BookingRow['status'];
  pickupLabel: string;
  dropoffLabel: string;
}

interface RouteAnchor {
  point: LngLat;
  recordedAt: Date;
  seq: number;
  /** Metres along the route, when known (trace rows carry it). */
  distanceAlong: number | null;
}

type ZonePoint = { lat: number; lng: number };

/**
 * The SSE stream stays open while the booking can still change, and closes the
 * moment it reaches a terminal state — an EventSource that never ends is a leak.
 */
export function isLiveTrackingStatus(status: string): boolean {
  return (
    status === 'pending' ||
    status === 'deposit_paid' ||
    status === 'assigned' ||
    status === 'in_progress'
  );
}

/**
 * Live trip tracking: driver pings, the nearest-car query, the stored route and
 * the simulator that plays a trip forward so the flow can be demonstrated
 * end to end before any real driver app exists.
 */
@Injectable()
export class TrackingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TrackingService.name);
  private readonly simulationEnabled: boolean;
  private simulationTimer: NodeJS.Timeout | undefined;
  private tickRunning = false;

  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {
    const raw = this.config.get<string>('TRACKING_SIMULATION');
    this.simulationEnabled =
      raw === undefined ? this.config.get<string>('NODE_ENV') !== 'production' : raw === 'true';
  }

  onModuleInit(): void {
    if (!this.simulationEnabled) {
      this.logger.log('Trip simulation is off (TRACKING_SIMULATION=false)');
      return;
    }
    this.simulationTimer = setInterval(() => {
      void this.runSimulationTick();
    }, SIMULATION_INTERVAL_MS);
    this.logger.log(`Trip simulation running every ${SIMULATION_INTERVAL_MS}ms`);
  }

  onModuleDestroy(): void {
    if (this.simulationTimer) {
      clearInterval(this.simulationTimer);
      this.simulationTimer = undefined;
    }
  }

  // -------------------------------------------------------------------------
  // Driver positions
  // -------------------------------------------------------------------------

  /** Latest ping wins: one row per driver, upserted atomically on driver_id. */
  async driverPing(
    driverId: string,
    input: { lat: number; lng: number; heading: number; speedKph: number },
  ): Promise<void> {
    await this.assertDriver(driverId);
    await this.upsertPosition(
      driverId,
      [input.lng, input.lat],
      input.heading,
      input.speedKph,
      new Date(),
    );
  }

  /** Where is the nearest car? PostGIS answers with ST_DWithin + ST_Distance. */
  async nearbyDrivers(lat: number, lng: number, radiusMetres = 3000): Promise<NearbyDriver[]> {
    const result = await this.db.execute<{
      id: string;
      name: string;
      lat: number;
      lng: number;
      distance_metres: string;
      heading: string | null;
    }>(sql`
      select d.id,
             d.name,
             st_y(dl.location::geometry) as lat,
             st_x(dl.location::geometry) as lng,
             round(
               st_distance(
                 dl.location,
                 st_setsrid(st_makepoint(${lng}, ${lat}), 4326)::geography
               )::numeric,
               1
             ) as distance_metres,
             dl.heading
      from driver_locations dl
      join drivers d on d.id = dl.driver_id
      where d.status = 'available'
        and st_dwithin(
          dl.location,
          st_setsrid(st_makepoint(${lng}, ${lat}), 4326)::geography,
          ${radiusMetres}
        )
      order by distance_metres asc
      limit ${NEARBY_LIMIT}
    `);

    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      lat: Number(row.lat),
      lng: Number(row.lng),
      distanceMetres: Number(row.distance_metres),
      heading: row.heading === null ? 0 : Number(row.heading),
    }));
  }

  // -------------------------------------------------------------------------
  // Assignment and route
  // -------------------------------------------------------------------------

  /**
   * Assign a driver to a booking: status → assigned, the route (driver →
   * pick-up → drop-off) is fetched from OSRM and stored, and the driver's
   * position is seeded at the route start so playback has a clock to read.
   */
  async assignTrip(bookingRef: string, driverId: string): Promise<TrackingView> {
    const booking = await this.findBooking(bookingRef);
    if (TERMINAL_STATUSES.has(booking.status)) {
      throw new ConflictException({
        code: 'BOOKING_NOT_ASSIGNABLE',
        message: 'This booking can no longer be assigned a driver',
      });
    }
    await this.assertDriver(driverId);

    // Route I/O happens before the transaction opens: a slow network must
    // never hold a database lock. The write below is then one atomic switch —
    // a reader never sees "assigned" without its route.
    const coordinates = await this.buildRoute(booking, driverId);
    const now = new Date();

    await this.db.transaction(async (tx) => {
      await tx
        .update(bookings)
        .set({ status: 'assigned', driverId, updatedAt: now })
        .where(eq(bookings.id, booking.id));

      if (coordinates.length > 1) {
        await this.persistRoute(tx, booking.id, coordinates);
      }
      if (coordinates.length > 0) {
        const start = coordinates[0];
        const heading = coordinates.length > 1 ? bearing(start, coordinates[1]) : 0;
        await this.upsertPosition(driverId, start, heading, 0, now, tx);
      }
    });

    return this.currentView(bookingRef);
  }

  /**
   * Fetch the driving route for a booking — from the assigned driver's
   * position to pick-up, then pick-up to drop-off — and persist it as the
   * `route` rows playback will follow. A network failure degrades to a
   * straight line: the trip must still be trackable offline.
   */
  async routeGeometry(bookingRef: string): Promise<{ coordinates: [number, number][] }> {
    const booking = await this.findBooking(bookingRef);
    const coordinates = await this.buildRoute(booking, booking.driverId);

    if (coordinates.length > 1) {
      await this.db.transaction(async (tx) => {
        await this.persistRoute(tx, booking.id, coordinates);
      });
    }

    return { coordinates };
  }

  // -------------------------------------------------------------------------
  // Read model
  // -------------------------------------------------------------------------

  async currentView(bookingRef: string): Promise<TrackingView> {
    const [row] = await this.db
      .select({ booking: bookings, driver: drivers })
      .from(bookings)
      .leftJoin(drivers, eq(drivers.id, bookings.driverId))
      .where(eq(bookings.ref, bookingRef))
      .limit(1);

    if (!row) {
      throw new NotFoundException({ code: 'BOOKING_NOT_FOUND', message: 'Booking not found' });
    }

    const booking = row.booking;
    const driver = row.driver;
    const vehicleId = booking.vehicleId ?? driver?.vehicleId ?? null;

    const [vehicle, routeCoordinates, zoneMap, position, lastTrace] = await Promise.all([
      vehicleId ? this.vehicleById(vehicleId) : Promise.resolve(null),
      this.routePoints(booking.id),
      this.zonePoints([booking.pickupLabel, booking.dropoffLabel]),
      driver ? this.driverPosition(driver.id) : Promise.resolve(null),
      this.lastTracePoint(booking.id),
    ]);

    const pickup = zoneMap.get(stripLabel(booking.pickupLabel)) ?? null;
    const dropoff = zoneMap.get(stripLabel(booking.dropoffLabel)) ?? null;
    const pickupPoint: LngLat | null = pickup ? [pickup.lng, pickup.lat] : null;

    const cumulative = routeCoordinates.length > 0 ? cumulativeLengths(routeCoordinates) : [];
    const total = cumulative[cumulative.length - 1] ?? 0;
    const travelled =
      routeCoordinates.length > 1
        ? (lastTrace?.distanceAlong ??
          (position ? projectOnRoute([position.lng, position.lat], routeCoordinates, cumulative) : 0))
        : 0;

    let phase = phaseFor(booking.status);
    if (phase === 'to_pickup' && pickupPoint && routeCoordinates.length > 1 && position) {
      const leg1Length = cumulative[nearestIndex(pickupPoint, routeCoordinates)];
      if (leg1Length - travelled <= ARRIVAL_RADIUS_METRES) phase = 'arrived';
    }

    const { etaSeconds, distanceMetres } = remainingFor(phase, {
      cumulative,
      total,
      travelled,
      leg1Length:
        pickupPoint && routeCoordinates.length > 1
          ? cumulative[nearestIndex(pickupPoint, routeCoordinates)]
          : 0,
    });

    return {
      ref: booking.ref,
      status: booking.status,
      phase,
      pickup: { label: booking.pickupLabel, lat: pickup?.lat ?? null, lng: pickup?.lng ?? null },
      dropoff: { label: booking.dropoffLabel, lat: dropoff?.lat ?? null, lng: dropoff?.lng ?? null },
      route: { coordinates: routeCoordinates },
      driver: driver
        ? {
            id: driver.id,
            name: driver.name,
            rating: Number(driver.rating),
            vehicle: vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : '',
            plate: vehicle?.plate ?? '',
            initials: initialsOf(driver.name),
          }
        : null,
      position,
      etaSeconds,
      distanceMetres,
      updatedAt: booking.updatedAt.toISOString(),
    };
  }

  /** Throws BOOKING_NOT_FOUND before an SSE stream commits its headers. */
  async assertExists(bookingRef: string): Promise<void> {
    await this.findBooking(bookingRef);
  }

  // -------------------------------------------------------------------------
  // Simulator
  // -------------------------------------------------------------------------

  /**
   * Advance every active trip one tick along its stored route. Cheap first: a
   * single indexed count-shaped query decides whether there is anything to do,
   * so an idle API does not hammer the database every two seconds.
   */
  async advanceTrips(): Promise<number> {
    const active = await this.db
      .select({
        id: bookings.id,
        ref: bookings.ref,
        driverId: bookings.driverId,
        status: bookings.status,
        pickupLabel: bookings.pickupLabel,
        dropoffLabel: bookings.dropoffLabel,
      })
      .from(bookings)
      .where(and(inArray(bookings.status, [...ACTIVE_STATUSES]), isNotNull(bookings.driverId)))
      .limit(ACTIVE_TRIP_LIMIT);

    if (active.length === 0) return 0;

    const zoneMap = await this.allZonePoints();

    let moved = 0;
    for (const trip of active) {
      try {
        if (await this.advanceTrip(trip, zoneMap)) moved += 1;
      } catch (error) {
        this.logger.error(
          `Could not advance ${trip.ref}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }
    return moved;
  }

  private async advanceTrip(trip: ActiveTrip, zoneMap: Map<string, ZonePoint>): Promise<boolean> {
    if (!trip.driverId) return false;

    const route = await this.routePoints(trip.id);
    if (route.length < 2) return false;

    const cumulative = cumulativeLengths(route);
    const total = cumulative[cumulative.length - 1];
    if (!(total > 0)) return false;

    const [lastTrace, driverAnchor] = await Promise.all([
      this.lastTracePoint(trip.id),
      this.driverAnchor(trip.driverId),
    ]);
    const anchor = lastTrace ?? driverAnchor;
    // Trace rows carry their exact distance along the route; only a bare
    // driver position (first tick) needs projecting back onto the polyline.
    const travelled = anchor
      ? (anchor.distanceAlong ?? projectOnRoute(anchor.point, route, cumulative))
      : 0;
    const elapsedSeconds = anchor
      ? Math.min(
          MAX_TICK_GAP_SECONDS,
          Math.max(0, (Date.now() - anchor.recordedAt.getTime()) / 1000),
        )
      : 0;

    // ~35 km/h in city traffic, jittered per tick so the car does not move
    // like it is on rails.
    const jitterKph = AVERAGE_SPEED_KPH + Math.random() * 6 - 3;
    const nextDistance = Math.min(total, travelled + (jitterKph / 3.6) * elapsedSeconds);

    const pickupZone = zoneMap.get(stripLabel(trip.pickupLabel));
    const leg1Length = pickupZone
      ? cumulative[nearestIndex([pickupZone.lng, pickupZone.lat], route)]
      : 0;

    let nextStatus = trip.status;
    if (trip.status === 'assigned') {
      // Reaches the pick-up point → the ride itself begins.
      if (nextDistance >= leg1Length - 0.5) nextStatus = 'in_progress';
    } else if (trip.status === 'in_progress') {
      // Reaches the drop-off → the trip is done.
      if (nextDistance >= total - 0.5) nextStatus = 'completed';
    }

    const sample = interpolate(route, cumulative, nextDistance);
    const speedKph = nextStatus === 'completed' ? 0 : Math.round(jitterKph * 10) / 10;
    const now = new Date();

    await this.upsertPosition(trip.driverId, sample.position, sample.heading, speedKph, now);

    await this.db.insert(tripPositions).values({
      bookingId: trip.id,
      seq: lastTrace ? lastTrace.seq + 1 : route.length,
      lat: sample.position[1].toFixed(6),
      lng: sample.position[0].toFixed(6),
      kind: 'trace',
      distanceAlong: nextDistance.toFixed(2),
      recordedAt: now,
    });

    if (nextStatus !== trip.status) {
      await this.db
        .update(bookings)
        .set({ status: nextStatus, updatedAt: now })
        .where(and(eq(bookings.id, trip.id), eq(bookings.status, trip.status)));
      this.logger.log(`Trip ${trip.ref}: ${trip.status} → ${nextStatus}`);
    }

    return true;
  }

  /** Runs on the interval; never overlaps itself and never throws upward. */
  private async runSimulationTick(): Promise<void> {
    if (this.tickRunning) return;
    this.tickRunning = true;
    try {
      await this.advanceTrips();
    } catch (error) {
      this.logger.error(
        'Simulation tick failed',
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      this.tickRunning = false;
    }
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  private async upsertPosition(
    driverId: string,
    point: LngLat,
    heading: number,
    speedKph: number,
    recordedAt: Date,
    db: DbOrTx = this.db,
  ): Promise<void> {
    const headingValue = heading.toFixed(2);
    const speedValue = speedKph.toFixed(2);

    await db
      .insert(driverLocations)
      .values({
        driverId,
        location: sql`ST_SetSRID(ST_MakePoint(${point[0]}, ${point[1]}), 4326)::geography`,
        heading: headingValue,
        speedKph: speedValue,
        recordedAt,
      })
      .onConflictDoUpdate({
        target: driverLocations.driverId,
        set: {
          location: sql`excluded.location`,
          heading: headingValue,
          speedKph: speedValue,
          recordedAt,
        },
      });
  }

  /** Replace the booking's stored route in one statement pair. */
  private async persistRoute(
    tx: DbOrTx,
    bookingId: string,
    coordinates: LngLat[],
  ): Promise<void> {
    await tx.delete(tripPositions).where(eq(tripPositions.bookingId, bookingId));
    await tx.insert(tripPositions).values(
      coordinates.map((point, index) => ({
        bookingId,
        seq: index,
        lat: point[1].toFixed(6),
        lng: point[0].toFixed(6),
        kind: 'route',
      })),
    );
  }

  private async buildRoute(booking: BookingRow, driverId: string | null): Promise<LngLat[]> {
    const zoneMap = await this.zonePoints([booking.pickupLabel, booking.dropoffLabel]);
    const pickupZone = zoneMap.get(stripLabel(booking.pickupLabel));
    const dropoffZone = zoneMap.get(stripLabel(booking.dropoffLabel));
    if (!pickupZone || !dropoffZone) return [];

    const pickup: LngLat = [pickupZone.lng, pickupZone.lat];
    const dropoff: LngLat = [dropoffZone.lng, dropoffZone.lat];
    if (pickup[0] === dropoff[0] && pickup[1] === dropoff[1]) return [];

    const legs: LngLat[][] = [];
    const driverPoint = driverId ? await this.driverPositionPoint(driverId) : null;
    if (driverPoint && (driverPoint[0] !== pickup[0] || driverPoint[1] !== pickup[1])) {
      legs.push(decimate(await this.osrmRoute(driverPoint, pickup), ROUTE_MIN_SPACING_METRES));
    }
    legs.push(decimate(await this.osrmRoute(pickup, dropoff), ROUTE_MIN_SPACING_METRES));

    const merged: LngLat[] = [];
    for (const leg of legs) {
      for (const point of leg) {
        const last = merged[merged.length - 1];
        if (last && last[0] === point[0] && last[1] === point[1]) continue;
        merged.push(point);
      }
    }
    return merged;
  }

  private async osrmRoute(from: LngLat, to: LngLat): Promise<LngLat[]> {
    const url =
      `https://router.project-osrm.org/route/v1/driving/${from[0]},${from[1]};${to[0]},${to[1]}` +
      '?overview=full&geometries=geojson';
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(OSRM_TIMEOUT_MS) });
      if (!response.ok) throw new Error(`OSRM responded ${response.status}`);
      const body = (await response.json()) as {
        routes?: { geometry?: { coordinates?: unknown } }[];
      };
      const raw = body.routes?.[0]?.geometry?.coordinates;
      if (!Array.isArray(raw) || raw.length < 2) throw new Error('OSRM returned no route');
      return raw.map((pair) => {
        const [lng, lat] = pair as [number, number];
        return roundLngLat([Number(lng), Number(lat)]);
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn(`OSRM unavailable (${reason}); falling back to a straight line`);
      return straightLine(roundLngLat(from), roundLngLat(to));
    }
  }

  private async findBooking(bookingRef: string): Promise<BookingRow> {
    const [booking] = await this.db
      .select()
      .from(bookings)
      .where(eq(bookings.ref, bookingRef))
      .limit(1);

    if (!booking) {
      throw new NotFoundException({ code: 'BOOKING_NOT_FOUND', message: 'Booking not found' });
    }
    return booking;
  }

  private async assertDriver(driverId: string): Promise<typeof drivers.$inferSelect> {
    const [driver] = await this.db
      .select()
      .from(drivers)
      .where(eq(drivers.id, driverId))
      .limit(1);

    if (!driver) {
      throw new NotFoundException({ code: 'DRIVER_NOT_FOUND', message: 'Driver not found' });
    }
    return driver;
  }

  private async vehicleById(vehicleId: string): Promise<typeof vehicles.$inferSelect | null> {
    const [row] = await this.db
      .select()
      .from(vehicles)
      .where(eq(vehicles.id, vehicleId))
      .limit(1);
    return row ?? null;
  }

  /** The stored `route` rows — the polyline playback follows. */
  private async routePoints(bookingId: string): Promise<LngLat[]> {
    const rows = await this.db
      .select({ lat: tripPositions.lat, lng: tripPositions.lng })
      .from(tripPositions)
      .where(and(eq(tripPositions.bookingId, bookingId), eq(tripPositions.kind, 'route')))
      .orderBy(asc(tripPositions.seq));

    return rows.map((row) => [Number(row.lng), Number(row.lat)] as LngLat);
  }

  private async lastTracePoint(bookingId: string): Promise<RouteAnchor | null> {
    const rows = await this.db
      .select({
        seq: tripPositions.seq,
        lat: tripPositions.lat,
        lng: tripPositions.lng,
        distanceAlong: tripPositions.distanceAlong,
        recordedAt: tripPositions.recordedAt,
      })
      .from(tripPositions)
      .where(and(eq(tripPositions.bookingId, bookingId), eq(tripPositions.kind, 'trace')))
      .orderBy(desc(tripPositions.seq))
      .limit(1);

    const row = rows[0];
    if (!row) return null;
    return {
      point: [Number(row.lng), Number(row.lat)],
      recordedAt: row.recordedAt,
      seq: row.seq,
      distanceAlong: row.distanceAlong === null ? null : Number(row.distanceAlong),
    };
  }

  private async driverAnchor(driverId: string): Promise<RouteAnchor | null> {
    const rows = await this.db.execute<{ lat: number; lng: number; recorded_at: Date }>(sql`
      select st_y(location::geometry) as lat,
             st_x(location::geometry) as lng,
             recorded_at
      from driver_locations
      where driver_id = ${driverId}
      limit 1
    `);
    const row = rows.rows[0];
    if (!row) return null;
    return {
      point: [Number(row.lng), Number(row.lat)],
      recordedAt: new Date(row.recorded_at),
      seq: -1,
      distanceAlong: null,
    };
  }

  private async driverPositionPoint(driverId: string): Promise<LngLat | null> {
    const anchor = await this.driverAnchor(driverId);
    return anchor?.point ?? null;
  }

  private async driverPosition(driverId: string): Promise<TrackingPosition | null> {
    const rows = await this.db.execute<{
      lat: number;
      lng: number;
      heading: string | null;
      speed_kph: string | null;
      recorded_at: Date;
    }>(sql`
      select st_y(location::geometry) as lat,
             st_x(location::geometry) as lng,
             heading,
             speed_kph,
             recorded_at
      from driver_locations
      where driver_id = ${driverId}
      limit 1
    `);

    const row = rows.rows[0];
    if (!row) return null;
    return {
      lat: Number(row.lat),
      lng: Number(row.lng),
      heading: row.heading === null ? 0 : Number(row.heading),
      speedKph: row.speed_kph === null ? 0 : Number(row.speed_kph),
      updatedAt: new Date(row.recorded_at).toISOString(),
    };
  }

  private async zonePoints(labels: string[]): Promise<Map<string, ZonePoint>> {
    const wanted = [...new Set(labels.map(stripLabel))];
    const map = new Map<string, ZonePoint>();
    if (wanted.length === 0) return map;

    const rows = await this.db
      .select({ name: zones.name, lat: zones.lat, lng: zones.lng })
      .from(zones)
      .where(inArray(zones.name, wanted));

    for (const row of rows) {
      if (row.lat === null || row.lng === null) continue;
      map.set(row.name, { lat: Number(row.lat), lng: Number(row.lng) });
    }
    return map;
  }

  private async allZonePoints(): Promise<Map<string, ZonePoint>> {
    const rows = await this.db
      .select({ name: zones.name, lat: zones.lat, lng: zones.lng })
      .from(zones);

    const map = new Map<string, ZonePoint>();
    for (const row of rows) {
      if (row.lat === null || row.lng === null) continue;
      map.set(row.name, { lat: Number(row.lat), lng: Number(row.lng) });
    }
    return map;
  }
}

function stripLabel(label: string): string {
  return label.replace(/ \(delivered\)$/, '');
}

function phaseFor(status: BookingRow['status']): TrackingPhase {
  switch (status) {
    case 'pending':
    case 'deposit_paid':
      return 'awaiting_driver';
    case 'assigned':
      return 'to_pickup';
    case 'in_progress':
      return 'on_trip';
    case 'completed':
      return 'completed';
    default:
      // cancelled and expired share the terminal phase the frontend draws.
      return 'cancelled';
  }
}

interface RemainingInput {
  cumulative: number[];
  total: number;
  travelled: number;
  leg1Length: number;
}

/**
 * ETA and remaining distance to the current target: the pick-up while the
 * driver is still inbound, the drop-off once the ride has started. Derived
 * from the same 35 km/h average the simulator drives at.
 */
function remainingFor(
  phase: TrackingPhase,
  input: RemainingInput,
): { etaSeconds: number | null; distanceMetres: number | null } {
  if (phase === 'completed') return { etaSeconds: null, distanceMetres: 0 };

  let remaining: number | null = null;
  if (phase === 'to_pickup' || phase === 'arrived') {
    if (input.cumulative.length > 1) remaining = Math.max(0, input.leg1Length - input.travelled);
  } else if (phase === 'on_trip') {
    if (input.cumulative.length > 1) remaining = Math.max(0, input.total - input.travelled);
  }

  if (remaining === null) return { etaSeconds: null, distanceMetres: null };

  const metresPerSecond = AVERAGE_SPEED_KPH / 3.6;
  return {
    etaSeconds: Math.round(remaining / metresPerSecond),
    distanceMetres: Math.round(remaining),
  };
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}
