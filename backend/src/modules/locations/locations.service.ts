import {
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DB, type Database } from '../../db/database.module';
import type { CoordinatesInput, Place, PlaceSearchInput, ZoneMatch } from './locations.dto';

/**
 * Place lookup runs through OSM data via Photon, and zone resolution runs on
 * PostGIS. Both live here so the provider can be swapped (Google, Mapbox)
 * without a single line of the booking flow changing.
 */
const PHOTON_BASE = 'https://photon.komoot.io';
const LOOKUP_TIMEOUT_MS = 4_000;
const CACHE_TTL_MS = 60_000;
const CACHE_MAX_ENTRIES = 200;
const USER_AGENT = 'Digio/0.1 (+https://digio.gh)';

/** Past this, a point is not in the Accra service area. Tema sits at ~30 km. */
export const SERVICE_RADIUS_METRES = 40_000;

/** Without a bias Photon ranks by global popularity, which buries Accra. */
const ACCRA_BIAS = { lat: 5.6037, lng: -0.187 };

interface PhotonProperties {
  name?: string;
  street?: string;
  housenumber?: string;
  city?: string;
  state?: string;
  country?: string;
  osm_key?: string;
  osm_value?: string;
}

interface PhotonFeature {
  geometry?: { coordinates?: unknown[] };
  properties?: PhotonProperties;
}

interface CacheEntry {
  at: number;
  value: unknown;
}

@Injectable()
export class LocationsService {
  private readonly logger = new Logger(LocationsService.name);
  private readonly cache = new Map<string, CacheEntry>();

  constructor(@Inject(DB) private readonly db: Database) {}

  /** Search-as-you-type over OSM places, streets and points of interest. */
  async search(input: PlaceSearchInput): Promise<Place[]> {
    const biasLat = input.lat ?? ACCRA_BIAS.lat;
    const biasLng = input.lng ?? ACCRA_BIAS.lng;
    const key = `search:${input.q.toLowerCase()}:${input.limit}:${biasLat},${biasLng}`;
    const cached = this.readCache<Place[]>(key);
    if (cached) return cached;

    const url =
      `${PHOTON_BASE}/api/?q=${encodeURIComponent(input.q)}` +
      `&limit=${input.limit}&lang=en&lat=${biasLat}&lon=${biasLng}`;

    const json = await this.fetchJson(url);
    const places = ((json?.features ?? []) as PhotonFeature[])
      .map(toPlace)
      .filter((place): place is Place => place !== null);

    // Photon ranks by global relevance, so a village in Côte d'Ivoire can beat
    // the airport in Accra. Keep its order but float everything inside the
    // service area to the top — a local match is always the one being asked for.
    const ordered = [
      ...places.filter((place) => distanceKm(place, biasLat, biasLng) <= SERVICE_RADIUS_METRES / 1000),
      ...places.filter((place) => distanceKm(place, biasLat, biasLng) > SERVICE_RADIUS_METRES / 1000),
    ];

    this.writeCache(key, ordered);
    return ordered;
  }

  /** Turn GPS coordinates into a readable address. */
  async reverse(input: CoordinatesInput): Promise<Place | null> {
    const key = `reverse:${input.lat.toFixed(4)},${input.lng.toFixed(4)}`;
    const cached = this.readCache<Place | null>(key);
    if (cached) return cached;

    const url = `${PHOTON_BASE}/reverse?lat=${input.lat}&lon=${input.lng}&lang=en`;
    const json = await this.fetchJson(url);

    const features = (json?.features ?? []) as PhotonFeature[];
    const place = toPlace(features[0] ?? null);
    this.writeCache(key, place);
    return place;
  }

  /**
   * Nearest pricing zone for a point, by PostGIS KNN.
   *
   * The client sends coordinates, never a zone slug it invented — so a
   * pick-up dropped on a map still prices from the same table the form does.
   */
  async resolveZone(input: CoordinatesInput): Promise<ZoneMatch> {
    const point = sql`st_setsrid(st_makepoint(${input.lng}::float8, ${input.lat}::float8), 4326)::geography`;

    const result = await this.db.execute<{
      slug: string;
      name: string;
      airport: boolean;
      metres: string;
    }>(sql`
      select z.slug, z.name, z.airport,
             st_distance(z.centroid, ${point}) as metres
      from zones z
      where z.active
        and z.centroid is not null
      order by z.centroid <-> ${point}
      limit 1
    `);

    const row = result.rows[0];
    const distanceMetres = row ? Math.round(Number(row.metres)) : Number.POSITIVE_INFINITY;

    return {
      zone: row ? { slug: row.slug, name: row.name, airport: row.airport } : null,
      distanceMetres: Number.isFinite(distanceMetres) ? distanceMetres : 0,
      withinServiceArea: distanceMetres <= SERVICE_RADIUS_METRES,
    };
  }

  /** Reverse lookup and zone resolution in one round trip. */
  async locate(input: CoordinatesInput): Promise<{ place: Place | null; zoneMatch: ZoneMatch }> {
    const [place, zoneMatch] = await Promise.all([this.reverse(input), this.resolveZone(input)]);
    return { place, zoneMatch };
  }

  private async fetchJson(url: string): Promise<Record<string, unknown> | null> {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
        headers: { accept: 'application/json', 'user-agent': USER_AGENT },
      });

      if (!response.ok) {
        throw new Error(`upstream responded ${response.status}`);
      }

      return (await response.json()) as Record<string, unknown>;
    } catch (error) {
      this.logger.warn(`Location lookup failed (${url}) — ${String(error)}`);
      throw new ServiceUnavailableException({
        code: 'LOCATION_LOOKUP_UNAVAILABLE',
        message: 'Could not look that up — check your connection and try again',
      });
    }
  }

  private readCache<T>(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() - entry.at > CACHE_TTL_MS) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  private writeCache(key: string, value: unknown): void {
    if (this.cache.size >= CACHE_MAX_ENTRIES) {
      const oldest = this.cache.keys().next().value;
      if (oldest) this.cache.delete(oldest);
    }
    this.cache.set(key, { at: Date.now(), value });
  }
}

function toPlace(feature: PhotonFeature | null): Place | null {
  if (!feature) return null;

  const coordinates = feature.geometry?.coordinates ?? [];
  const lng = coordinates[0];
  const lat = coordinates[1];

  if (typeof lng !== 'number' || typeof lat !== 'number') return null;
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;

  const properties = feature.properties ?? {};
  const streetLine = [properties.housenumber, properties.street].filter(Boolean).join(' ');

  // A named place leads with its name — "Accra International Airport" beats
  // "Giffard Road". An unnamed result is an address, so it leads with the street.
  const named = Boolean(properties.name && properties.name !== properties.street);
  const first = named ? String(properties.name) : streetLine || String(properties.name ?? '');

  const label = Array.from(
    new Set([first, properties.city, properties.state, properties.country].filter(Boolean)),
  ).join(', ');

  if (!label) return null;

  return { label, lat, lng, kind: kindOf(properties) };
}

/** Great-circle distance in kilometres, used only for ranking. */
function distanceKm(place: Place, lat: number, lng: number): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(place.lat - lat);
  const dLng = toRad(place.lng - lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat)) * Math.cos(toRad(place.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

function kindOf(properties: PhotonProperties): Place['kind'] {
  const key = String(properties.osm_key ?? '');
  const value = String(properties.osm_value ?? '');
  const name = String(properties.name ?? '').toLowerCase();

  if (
    key === 'aeroway' ||
    value === 'aerodrome' ||
    value === 'airport' ||
    name.includes('airport')
  ) {
    return 'airport';
  }
  if (key === 'place') return 'place';
  if (key === 'highway' || key === 'railway' || value === 'street' || value === 'pedestrian') {
    return 'street';
  }
  if (key === 'amenity' || key === 'shop' || key === 'tourism' || key === 'leisure') return 'poi';
  return 'other';
}
