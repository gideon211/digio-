CREATE EXTENSION IF NOT EXISTS postgis;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS btree_gist;--> statement-breakpoint
CREATE TYPE "public"."booking_status" AS ENUM('pending', 'deposit_paid', 'assigned', 'in_progress', 'completed', 'cancelled', 'expired');--> statement-breakpoint
CREATE TYPE "public"."discount_type" AS ENUM('percent', 'fixed');--> statement-breakpoint
CREATE TYPE "public"."document_owner" AS ENUM('driver', 'vehicle', 'customer');--> statement-breakpoint
CREATE TYPE "public"."driver_status" AS ENUM('available', 'on_trip', 'off_duty');--> statement-breakpoint
CREATE TYPE "public"."enquiry_kind" AS ENUM('jet', 'yacht', 'corporate', 'wedding', 'long_term');--> statement-breakpoint
CREATE TYPE "public"."payment_channel" AS ENUM('mobile_money', 'card', 'bank_transfer', 'cash', 'corporate_invoice');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('initialized', 'pending', 'succeeded', 'failed', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."product_type" AS ENUM('chauffeur_transfer', 'chauffeur_hire', 'self_drive');--> statement-breakpoint
CREATE TYPE "public"."vehicle_status" AS ENUM('available', 'on_trip', 'servicing', 'retired');--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ref" text NOT NULL,
	"product" "product_type" NOT NULL,
	"status" "booking_status" DEFAULT 'pending' NOT NULL,
	"customer_id" uuid,
	"quote_id" uuid,
	"vehicle_id" uuid,
	"driver_id" uuid,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"pickup_label" text NOT NULL,
	"dropoff_label" text NOT NULL,
	"passengers" integer DEFAULT 1 NOT NULL,
	"bags" integer DEFAULT 0 NOT NULL,
	"flight_number" text,
	"subtotal_pesewas" integer NOT NULL,
	"discount_pesewas" integer DEFAULT 0 NOT NULL,
	"total_pesewas" integer NOT NULL,
	"deposit_due_pesewas" integer NOT NULL,
	"paid_pesewas" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'GHS' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookings_ref_unique" UNIQUE("ref")
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" text NOT NULL,
	"name" text,
	"email" text,
	"membership_percent" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customers_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_type" "document_owner" NOT NULL,
	"owner_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"file_key" text NOT NULL,
	"expires_at" date,
	"verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drivers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"licence_no" text,
	"licence_expiry" date,
	"rating" numeric(3, 2) DEFAULT '5.00' NOT NULL,
	"languages" text[] DEFAULT '{}' NOT NULL,
	"status" "driver_status" DEFAULT 'available' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "drivers_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
CREATE TABLE "enquiries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "enquiry_kind" NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"message" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"provider" text DEFAULT 'paystack' NOT NULL,
	"provider_ref" text NOT NULL,
	"amount_pesewas" integer NOT NULL,
	"channel" "payment_channel" NOT NULL,
	"status" "payment_status" DEFAULT 'initialized' NOT NULL,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_provider_ref_unique" UNIQUE("provider_ref")
);
--> statement-breakpoint
CREATE TABLE "promos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"type" "discount_type" NOT NULL,
	"value" integer NOT NULL,
	"min_subtotal_pesewas" integer DEFAULT 0 NOT NULL,
	"max_discount_pesewas" integer,
	"max_uses" integer,
	"used_count" integer DEFAULT 0 NOT NULL,
	"valid_from" timestamp with time zone,
	"valid_to" timestamp with time zone,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "promos_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" text NOT NULL,
	"product" "product_type" NOT NULL,
	"payload" jsonb NOT NULL,
	"breakdown" jsonb NOT NULL,
	"subtotal_pesewas" integer NOT NULL,
	"discount_pesewas" integer DEFAULT 0 NOT NULL,
	"total_pesewas" integer NOT NULL,
	"deposit_pesewas" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quotes_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "rental_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"booking_id" uuid NOT NULL,
	"period" daterange NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicle_classes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"seats" integer NOT NULL,
	"bags" integer NOT NULL,
	"multiplier" numeric(4, 2) DEFAULT '1.00' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vehicle_classes_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "vehicles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"class_id" uuid NOT NULL,
	"plate" text NOT NULL,
	"make" text NOT NULL,
	"model" text NOT NULL,
	"year" integer NOT NULL,
	"color" text DEFAULT 'black' NOT NULL,
	"status" "vehicle_status" DEFAULT 'available' NOT NULL,
	"daily_rate_pesewas" integer DEFAULT 0 NOT NULL,
	"mileage_cap_km" integer DEFAULT 200 NOT NULL,
	"transmission" text DEFAULT 'automatic' NOT NULL,
	"fuel" text DEFAULT 'petrol' NOT NULL,
	"seats" integer,
	"bags" integer,
	"photos" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vehicles_plate_unique" UNIQUE("plate")
);
--> statement-breakpoint
CREATE TABLE "zone_pairs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_zone_id" uuid NOT NULL,
	"to_zone_id" uuid NOT NULL,
	"class_id" uuid NOT NULL,
	"price_pesewas" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"airport" boolean DEFAULT false NOT NULL,
	"lat" numeric(9, 6),
	"lng" numeric(9, 6),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "zones_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_periods" ADD CONSTRAINT "rental_periods_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_periods" ADD CONSTRAINT "rental_periods_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_class_id_vehicle_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."vehicle_classes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zone_pairs" ADD CONSTRAINT "zone_pairs_from_zone_id_zones_id_fk" FOREIGN KEY ("from_zone_id") REFERENCES "public"."zones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zone_pairs" ADD CONSTRAINT "zone_pairs_to_zone_id_zones_id_fk" FOREIGN KEY ("to_zone_id") REFERENCES "public"."zones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zone_pairs" ADD CONSTRAINT "zone_pairs_class_id_vehicle_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."vehicle_classes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bookings_starts_at_idx" ON "bookings" USING btree ("starts_at");--> statement-breakpoint
CREATE INDEX "bookings_status_idx" ON "bookings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payments_booking_idx" ON "payments" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "quotes_token_idx" ON "quotes" USING btree ("token");--> statement-breakpoint
CREATE INDEX "rental_periods_vehicle_idx" ON "rental_periods" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX "vehicles_class_idx" ON "vehicles" USING btree ("class_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "zone_pairs_unique_idx" ON "zone_pairs" USING btree ("from_zone_id","to_zone_id","class_id");
-- PostGIS column is managed outside Drizzle (drizzle-kit quotes custom type names).--> statement-breakpoint
ALTER TABLE "zones" ADD COLUMN "centroid" geography(Point,4326);--> statement-breakpoint
CREATE INDEX "zones_centroid_idx" ON "zones" USING gist ("centroid");--> statement-breakpoint
ALTER TABLE "rental_periods" ADD CONSTRAINT "rental_periods_no_overlap" EXCLUDE USING gist ("vehicle_id" WITH =, "period" WITH &&);
