import { z } from 'zod';

/** Search-as-you-type against OSM data. */
export const placeSearchSchema = z.object({
  q: z.string().trim().min(2, 'Type at least two characters').max(120),
  limit: z.coerce.number().int().min(1).max(8).default(6),
  /** Bias results toward this point; defaults to central Accra. */
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
});

/** A point on earth, WGS84. */
export const coordinatesSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

export type PlaceSearchInput = z.infer<typeof placeSearchSchema>;
export type CoordinatesInput = z.infer<typeof coordinatesSchema>;

/** One OSM place, flattened into what the booking form actually needs. */
export interface Place {
  label: string;
  lat: number;
  lng: number;
  /** 'airport' is special-cased in the UI as a one-tap chip. */
  kind: 'airport' | 'place' | 'street' | 'poi' | 'other';
}

/** The zone a point belongs to for pricing purposes. */
export interface ZoneMatch {
  zone: { slug: string; name: string; airport: boolean } | null;
  distanceMetres: number;
  /** False when the point is too far from Accra to be served. */
  withinServiceArea: boolean;
}
