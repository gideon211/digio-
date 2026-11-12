import { z } from 'zod';

export const nearbyQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radiusMetres: z.coerce.number().min(50).max(50_000).default(3000),
});

export const assignTripSchema = z.object({
  driverId: z.uuid(),
});

/** The shape a driver app (or the simulator) posts every few seconds. */
export const driverPingSchema = z.object({
  driverId: z.uuid(),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  heading: z.coerce.number().min(0).max(360).default(0),
  speedKph: z.coerce.number().min(0).max(300).default(0),
});

export type NearbyQueryInput = z.infer<typeof nearbyQuerySchema>;
export type AssignTripInput = z.infer<typeof assignTripSchema>;
export type DriverPingInput = z.infer<typeof driverPingSchema>;
