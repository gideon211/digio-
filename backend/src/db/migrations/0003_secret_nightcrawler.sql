CREATE TABLE "driver_locations" (
	"driver_id" uuid PRIMARY KEY NOT NULL,
	"location" geography(Point,4326) NOT NULL,
	"heading" numeric(5, 2),
	"speed_kph" numeric(5, 2),
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trip_positions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"seq" integer NOT NULL,
	"lat" numeric(9, 6) NOT NULL,
	"lng" numeric(9, 6) NOT NULL,
	"kind" text DEFAULT 'route' NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN "vehicle_id" uuid;--> statement-breakpoint
ALTER TABLE "driver_locations" ADD CONSTRAINT "driver_locations_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_positions" ADD CONSTRAINT "trip_positions_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "driver_locations_location_idx" ON "driver_locations" USING gist ("location");--> statement-breakpoint
CREATE INDEX "trip_positions_booking_seq_idx" ON "trip_positions" USING btree ("booking_id","seq");--> statement-breakpoint
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Pair each seeded driver with a car so live tracking can report vehicle + plate
-- (transfers never set bookings.vehicle_id). Idempotent and safe to re-run.
UPDATE "drivers" d
SET "vehicle_id" = v."id"
FROM (
	SELECT "id", row_number() OVER (ORDER BY "created_at", "phone") AS rn
	FROM "drivers"
) dnum
JOIN (
	SELECT "id", row_number() OVER (ORDER BY "created_at", "plate") AS rn
	FROM "vehicles"
) v ON v.rn = dnum.rn
WHERE dnum."id" = d."id";